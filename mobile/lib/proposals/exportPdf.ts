import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

/** Must match expo-print defaults and HTML viewport so WKWebView layout width = PDF page width (Letter @ 72 PPI). */
const LETTER_PAGE_WIDTH_PX = 612;
const LETTER_PAGE_HEIGHT_PX = 792;

export async function exportProposalPdf(html: string, fileBase = "proposal") {
  console.log('📄 NEW PROPOSAL PDF EXPORT - Creating PDF from HTML...');
  console.log('📄 HTML length:', html.length);
  console.log('📄 HTML preview (first 200 chars):', html.substring(0, 200));

  const { uri } = await Print.printToFileAsync({
    html,
    width: LETTER_PAGE_WIDTH_PX,
    height: LETTER_PAGE_HEIGHT_PX,
    ...(Platform.OS === "ios"
      ? {
          margins: {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
          },
        }
      : {}),
  });
  console.log('📄 PDF generated at:', uri);
  
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { UTI: "com.adobe.pdf", mimeType: "application/pdf" });
  }
  return uri;
}


