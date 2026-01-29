/**
 * ⚠️ DEPRECATED - OLD PDF EXPORT SYSTEM
 * 
 * This file is NO LONGER USED.
 * 
 * Use the NEW PROPOSAL SYSTEM instead:
 * - mobile/lib/proposals/exportPdf.ts
 * 
 * This old file is kept for reference only.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';

/**
 * Exports contract HTML as a PDF and optionally shares it
 * @param html - The HTML content to convert to PDF
 * @param filename - The name for the PDF file
 * @param share - Whether to open the share dialog after generation
 */
export async function exportContractPdf(
  html: string,
  filename: string = 'contract.pdf',
  share: boolean = true
): Promise<string | null> {
  try {
    // Generate PDF from HTML
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    if (!uri) {
      throw new Error('Failed to generate PDF');
    }

    console.log('📄 PDF generated:', uri);

    // Share the PDF if requested
    if (share) {
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Contract',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(
          'PDF Generated',
          `Contract saved to: ${uri}`,
          [{ text: 'OK' }]
        );
      }
    }

    return uri;
  } catch (error) {
    console.error('PDF export error:', error);
    Alert.alert(
      'Export Failed',
      'Unable to generate PDF. Please try again.',
      [{ text: 'OK' }]
    );
    return null;
  }
}

/**
 * Prints the contract directly (iOS/Android native print dialog)
 * @param html - The HTML content to print
 */
export async function printContract(html: string): Promise<void> {
  try {
    await Print.printAsync({
      html,
    });
  } catch (error) {
    console.error('Print error:', error);
    Alert.alert(
      'Print Failed',
      'Unable to print contract. Please try again.',
      [{ text: 'OK' }]
    );
  }
}




