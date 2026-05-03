/**
 * Web-only: expo-file-system has no writable dirs; trigger a file download instead.
 */
export function triggerBrowserPdfDownload(filename: string, pdfBytes: Uint8Array): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("PDF download requires a browser environment.");
  }
  const name = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    // Immediate revoke can cancel the download in Safari (blob URL invalidated before fetch starts).
    const revokeUrl = url;
    setTimeout(() => URL.revokeObjectURL(revokeUrl), 2_000);
  }
}
