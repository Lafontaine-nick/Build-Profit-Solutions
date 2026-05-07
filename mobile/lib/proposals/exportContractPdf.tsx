import { Platform } from "react-native";
import { ContractDoc } from "../contracts/types";
import { ContractBuildOptions } from "./contractTemplate";
import { buildProposalHtml, getContractPdfPrintFooterParts } from "./buildProposalHtml";
import { renderHtmlPdfViaBackend } from "../pdf/renderHtmlPdfViaBackend";

const sanitizeFilenamePart = (value: string) =>
  String(value || "contract")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "contract";

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

  // Same pipeline on all platforms: buildProposalHtml + backend Puppeteer (Chrome print).
  // React PDF is not used here — it diverged from native layout/fonts; web now matches the app.

  const html = buildProposalHtml(doc, options);
  const { footerLeft, footerCenter } = getContractPdfPrintFooterParts(doc, options);

  const path = await renderHtmlPdfViaBackend({
    html,
    filename,
    footerLeft,
    footerCenter,
    displayHeaderFooter: true,
    autoShareOnNative: true,
  });

  if (path === null && Platform.OS === "web") {
    return `web-download:${filename}`;
  }

  return path ?? "";
}
