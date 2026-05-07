/**
 * Web-only: expo-file-system often has no writable cache dir in the browser;
 * trigger a file download from string or binary content (CSV, XLSX, etc.).
 */
export function decodeBase64ToUint8Array(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function triggerBrowserFileDownload(filename: string, content: string | Uint8Array, mimeType: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Browser download requires a browser environment.');
  }
  const blob =
    typeof content === 'string'
      ? new Blob([content], { type: mimeType.includes('csv') ? `${mimeType};charset=utf-8` : mimeType })
      : new Blob([content as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    const revokeUrl = url;
    setTimeout(() => URL.revokeObjectURL(revokeUrl), 2_000);
  }
}
