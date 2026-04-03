import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { fromByteArray } from "base64-js";
import { ContractDoc } from "../contracts/types";
import { ContractBuildOptions } from "./contractTemplate";
import { buildProposalHtml, getContractPdfPrintFooterParts } from "./buildProposalHtml";
import { resolveBackendRestApiBaseUrl } from "../../utils/resolveBackendRestApiUrl";
import { getNetworkInfo } from "../../utils/networkDetection";

const sanitizeFilenamePart = (value: string) =>
  String(value || "contract")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "contract";

const ensureApiSuffix = (url: string) => {
  const trimmed = String(url || "").trim().replace(/\/$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
};

const unique = <T,>(items: T[]) => [...new Set(items)];

const PDF_FETCH_TIMEOUT_MS = 14_000;

/** Private LAN IPv4 embedded in Metro / Expo host strings (Expo Go on device). */
function extractLanIpv4FromHostString(src: string | undefined): string | null {
  if (!src || typeof src !== "string") return null;
  const m = src.match(/\b((?:192\.168\.|10\.|172\.(?:1[6-9]|2\d|3[0-1])\.)\d{1,3}\.\d{1,3})\b/);
  return m ? m[1] : null;
}

function isPrivateHttpLanApiBase(url: string): boolean {
  const u = url.trim().toLowerCase();
  return /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(u);
}

/**
 * On __DEV__ + physical device (Expo Go): try Mac LAN :3001 before EXPO_PUBLIC_PDF_API_BASE_URL.
 * Many .env.local files point PDF at Render while Puppeteer is broken there — local backend still works.
 */
function collectDevDeviceLanPdfBases(): string[] {
  const out: string[] = [];
  const push = (base: string) => {
    const b = ensureApiSuffix(base.replace(/\/+$/, ""));
    if (!out.includes(b)) out.push(b);
  };

  const expoConfig: any = Constants.expoConfig || (Constants as any).manifest;
  const hostSources = [
    (Constants as any).expoGoConfig?.debuggerHost,
    expoConfig?.hostUri,
    expoConfig?.debuggerHost,
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri,
  ];

  for (const raw of hostSources) {
    const ip = extractLanIpv4FromHostString(String(raw || ""));
    if (ip) push(`http://${ip}:3001`);
  }

  try {
    const { recommendedApiUrl } = getNetworkInfo();
    const withApi = ensureApiSuffix(String(recommendedApiUrl || "").trim());
    if (withApi && isPrivateHttpLanApiBase(withApi)) push(withApi);
  } catch {
    /* ignore */
  }

  const extraDev = (Constants.expoConfig?.extra?.devApiBaseUrl as string | undefined)?.trim();
  const envDev = (process.env.EXPO_PUBLIC_DEV_API_BASE_URL as string | undefined)?.trim();
  for (const raw of [extraDev, envDev]) {
    if (!raw) continue;
    const withApi = ensureApiSuffix(raw);
    if (isPrivateHttpLanApiBase(withApi)) push(withApi);
  }

  return out;
}

/**
 * Order matters. Expo Go on a phone: LAN :3001 first, then explicit PDF URL, then fallbacks.
 * Simulators: localhost / 10.0.2.2 before remote.
 */
const getCandidateApiBases = () => {
  const candidates: string[] = [];
  const devApiBaseUrl = (Constants.expoConfig?.extra?.devApiBaseUrl as string | undefined)?.trim();
  const pdfApiBaseUrl = (
    (process.env.EXPO_PUBLIC_PDF_API_BASE_URL as string | undefined) ||
    (Constants.expoConfig?.extra?.pdfApiBaseUrl as string | undefined)
  )?.trim();

  const devOnPhysicalDevice = __DEV__ && Constants.isDevice && Platform.OS !== "web";

  if (devOnPhysicalDevice) {
    candidates.push(...collectDevDeviceLanPdfBases());
  }

  if (pdfApiBaseUrl) {
    candidates.push(ensureApiSuffix(pdfApiBaseUrl));
  }

  if (Platform.OS === "ios" && Constants.isDevice === false) {
    candidates.push("http://localhost:3001/api");
  }
  if (Platform.OS === "android" && Constants.isDevice === false) {
    candidates.push("http://10.0.2.2:3001/api");
  }

  if (!devOnPhysicalDevice) {
    const expoConfig: any = Constants.expoConfig || (Constants as any).manifest;
    const hostUri: string | undefined =
      expoConfig?.hostUri ||
      expoConfig?.debuggerHost ||
      (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;
    if (hostUri && typeof hostUri === "string") {
      const maybeIp = hostUri.split(":")[0];
      if (maybeIp && /^\d{1,3}(\.\d{1,3}){3}$/.test(maybeIp)) {
        candidates.push(`http://${maybeIp}:3001/api`);
      }
    }
  }

  try {
    const { recommendedApiUrl } = getNetworkInfo();
    if (recommendedApiUrl && !recommendedApiUrl.includes("render.com")) {
      candidates.push(ensureApiSuffix(recommendedApiUrl));
    }
  } catch {
    /* ignore */
  }

  if (devApiBaseUrl) {
    candidates.push(ensureApiSuffix(devApiBaseUrl));
  }

  candidates.push(resolveBackendRestApiBaseUrl());

  const merged = unique(candidates.filter(Boolean));
  if (Constants.isDevice) {
    return merged.filter((url) => !/localhost|127\.0\.0\.1/i.test(url));
  }
  return merged;
};

/**
 * `options.contractAudience`:
 * - `'client'` (default) — terms page uses client-ready copy; no “generic draft” / preflight bullet list on the PDF.
 * - `'internal'` — full “review before send” strip + all warnings on the terms page (draft preview).
 */
export async function exportContractPdf(
  doc: ContractDoc,
  options: ContractBuildOptions,
  fileBase = "contract",
) {
  const safeBase = sanitizeFilenamePart(fileBase);
  const filename = `${safeBase}.pdf`;

  // @react-pdf/renderer uses yoga-layout-prebuilt (Emscripten/WASM). Hermes/Expo Go does not
  // provide HEAPU32 etc., so React PDF crashes on native. Use Web-only React PDF; native uses
  // buildProposalHtml + backend Puppeteer (same content, HTML/CSS pipeline).
  if (Platform.OS === "web") {
    try {
      const [{ generateAndSavePdf }, contractMod, React] = await Promise.all([
        import("../../utils/pdfGenerator"),
        import("./ContractPdfDocument"),
        import("react"),
      ]);
      const ContractPdfDocument = contractMod.ContractPdfDocument ?? contractMod.default;
      console.log("📄 Contract PDF: generating in browser with React PDF…");
      return await generateAndSavePdf(
        React.createElement(ContractPdfDocument, { doc, options }),
        { filename, autoShare: true },
      );
    } catch (reactPdfError) {
      console.warn(
        "📄 React PDF (web) failed; falling back to backend HTML:",
        reactPdfError instanceof Error ? reactPdfError.message : reactPdfError,
      );
    }
  }

  const html = buildProposalHtml(doc, options);
  const { footerLeft, footerCenter } = getContractPdfPrintFooterParts(doc, options);
  const apiBases = getCandidateApiBases();
  if (__DEV__) {
    console.log("📄 Contract PDF API candidates (order):", apiBases, {
      isDevice: Constants.isDevice,
      expoGo: Constants.executionEnvironment === "storeClient",
      platform: Platform.OS,
    });
  }
  const attemptErrors: string[] = [];

  for (const apiBase of apiBases) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PDF_FETCH_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(`${apiBase}/contracts/render-pdf`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/pdf",
          },
          body: JSON.stringify({
            filename,
            html,
            footerLeft,
            footerCenter,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        let message = errText;
        try {
          const j = JSON.parse(errText);
          message = j?.message || j?.error || errText;
        } catch {
          /* use errText */
        }
        throw new Error(message || `Backend PDF render failed with ${response.status}`);
      }

      if (!contentType.includes("application/pdf")) {
        const errText = await response.text().catch(() => "");
        throw new Error(errText || "Server did not return a PDF (wrong content type).");
      }

      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength < 100) {
        throw new Error("Server returned an empty PDF.");
      }

      const bytes = new Uint8Array(arrayBuffer);
      const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
      if (magic !== "%PDF") {
        const preview = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 400));
        if (preview.trim().startsWith("{")) {
          throw new Error(
            "Server returned JSON instead of a binary PDF. Restart the backend and reload the app, then try again.",
          );
        }
        throw new Error("Invalid PDF from server (missing %PDF header).");
      }

      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!baseDir) {
        throw new Error("No writable file system directory is available for PDF export.");
      }

      const outputPath = `${baseDir}${filename}`;
      const base64Payload = fromByteArray(bytes);
      await FileSystem.writeAsStringAsync(outputPath, base64Payload, {
        encoding: "base64",
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(outputPath, {
          UTI: "com.adobe.pdf",
          mimeType: "application/pdf",
        });
      }

      return outputPath;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      attemptErrors.push(`${apiBase}: ${err.message}`);
      console.warn(`Contract PDF export failed via ${apiBase}:`, err.message);
    }
  }

  const hint = buildContractPdfFailureHint(attemptErrors);
  throw new Error(
    `Could not render contract PDF. ${hint}\nAttempts:\n${attemptErrors.map((e, i) => `  ${i + 1}. ${e}`).join("\n")}`,
  );
}

/** Explains the three common independent failures seen in logs (Render / LAN / localhost). */
function buildContractPdfFailureHint(attemptErrors: string[]): string {
  const blob = attemptErrors.join("\n");
  const parts: string[] = [];

  if (/render\.com.*Chrome|Could not find Chrome|puppeteer/i.test(blob)) {
    parts.push(
      "ROOT 1 — Hosted backend (Render): Puppeteer cannot find Chrome on the server. Redeploy backend with the Puppeteer cache fix (see backend render.yaml + server.js PUPPETEER_CACHE_DIR). Verify GET …/api/contracts/pdf-ready returns ok and chromeOnDisk true.",
    );
  }

  if (/localhost|127\.0\.0\.1/.test(blob)) {
    parts.push(
      "ROOT 2 — localhost in the list: that only works on iOS/Android simulators where the backend runs on the same machine. If you are on a physical phone, you should NOT see localhost; if you do, something reported isDevice=false. On a real device, localhost is the phone itself — it will always fail.",
    );
  }

  if (/\b192\.168\.|\b10\.|\b172\.(1[6-9]|2\d|3[0-1])\./.test(blob) && /Network request failed|Failed to fetch|ECONNREFUSED/i.test(blob)) {
    const iosExpoGo =
      Platform.OS === "ios" && Constants.executionEnvironment === "storeClient";
    parts.push(
      iosExpoGo
        ? "ROOT 3 — LAN http://…:3001 failed: Expo Go on iOS often cannot reach your Mac over plain HTTP (ATS / local network). Turn ON Settings → Privacy & Security → Local Network → Expo Go. Ensure Mac runs `npm start` in backend/ (listening on 0.0.0.0), same Wi‑Fi, firewall allows 3001. Or fix Render (ROOT 1) so PDF uses HTTPS. Or use an EAS development / TestFlight build (your app’s Info.plist can allow local HTTP)."
        : "ROOT 3 — LAN http://…:3001 failed: confirm backend is running (`npm start` in backend/), listens on 0.0.0.0, Mac firewall allows port 3001, phone and Mac on same Wi‑Fi (no guest isolation). From Mac: `curl -sS http://YOUR_LAN_IP:3001/api/contracts/pdf-ready`.",
    );
  }

  parts.push(
    "Quick checks: (1) Render pdf-ready endpoint. (2) `npx expo start --lan` + backend on 3001. (3) EXPO_PUBLIC_PDF_API_BASE_URL only if it is reachable from the device (HTTPS tunnel if Expo Go blocks HTTP).",
  );

  return parts.join("\n");
}
