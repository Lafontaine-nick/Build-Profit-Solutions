import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export async function exportProposalPdf(html: string, fileBase = "proposal") {
  console.log('📄 NEW PROPOSAL PDF EXPORT - Creating PDF from HTML...');
  console.log('📄 HTML length:', html.length);
  console.log('📄 HTML preview (first 200 chars):', html.substring(0, 200));
  
  const { uri } = await Print.printToFileAsync({ html });
  console.log('📄 PDF generated at:', uri);
  
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { UTI: "com.adobe.pdf", mimeType: "application/pdf" });
  }
  return uri;
}


