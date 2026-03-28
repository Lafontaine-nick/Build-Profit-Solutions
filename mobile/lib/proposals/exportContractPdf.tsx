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

/**
 * Order matters: explicit PDF URL first, then simulator hosts, then Metro LAN IP,
 * then devApiBaseUrl, then resolveBackendRestApiBaseUrl().
 * Do not auto-append Render in __DEV__ — production deploy may not include POST /contracts/render-pdf yet.
 */
const getCandidateApiBases = () => {
  const candidates: string[] = [];
  const devApiBaseUrl = (Constants.expoConfig?.extra?.devApiBaseUrl as string | undefined)?.trim();
  const pdfApiBaseUrl = (
    (process.env.EXPO_PUBLIC_PDF_API_BASE_URL as string | undefined) ||
    (Constants.expoConfig?.extra?.pdfApiBaseUrl as string | undefined)
  )?.trim();

  if (pdfApiBaseUrl) {
    candidates.push(ensureApiSuffix(pdfApiBaseUrl));
  }

  if (Platform.OS === "ios" && Constants.isDevice === false) {
    candidates.push("http://localhost:3001/api");
  }
  if (Platform.OS === "android" && Constants.isDevice === false) {
    candidates.push("http://10.0.2.2:3001/api");
  }

  // Same host as Metro / Expo (reliable on phone + Expo Go when LAN IP changes)
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
  // On a physical phone, localhost/127.0.0.1 is the device itself — never use it for PDF.
  if (Constants.isDevice) {
    return merged.filter(
      (url) => !/localhost|127\.0\.0\.1/i.test(url),
    );
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
  const attemptErrors: string[] = [];

  for (const apiBase of apiBases) {
    try {
      const response = await fetch(`${apiBase}/contracts/render-pdf`, {
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
      });

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

  const hint =
    "On a phone: same Wi‑Fi as your Mac, backend running (npm start in backend/), set EXPO_PUBLIC_DEV_API_BASE_URL or EXPO_PUBLIC_PDF_API_BASE_URL to http://YOUR_MAC_IP:3001/api, restart Expo. " +
    "For Render: deploy the latest backend and confirm GET /api/contracts/pdf-ready returns ok.";
  throw new Error(
    `Could not render contract PDF. ${hint}\nAttempts:\n${attemptErrors.map((e, i) => `  ${i + 1}. ${e}`).join("\n")}`,
  );
}
