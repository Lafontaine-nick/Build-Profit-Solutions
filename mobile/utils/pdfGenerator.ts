/**
 * PDF Generator Utility
 * 
 * Bridges @react-pdf/renderer with Expo's file system for React Native
 * Note: This requires a web-based rendering approach for full compatibility
 */

import { pdf } from '@react-pdf/renderer';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type GeneratePdfOptions = {
  filename: string;
  autoShare?: boolean;
};

/**
 * Generate and save a PDF from a React PDF document
 * 
 * @param document - React PDF Document component
 * @param options - Generation options
 * @returns Path to the saved PDF file
 * 
 * @example
 * ```typescript
 * const path = await generateAndSavePdf(
 *   <CompleteContract data={contractData} />,
 *   { filename: 'Contract_12345.pdf', autoShare: true }
 * );
 * ```
 */
export async function generateAndSavePdf(
  document: React.ReactElement,
  options: GeneratePdfOptions
): Promise<string> {
  try {
    // Generate PDF blob
    console.log('📄 Generating PDF...');
    const blob = await pdf(document).toBlob();
    
    // Convert blob to base64
    const base64data = await blobToBase64(blob);
    
    // Save to file system
    const path = FileSystem.documentDirectory + options.filename;
    await FileSystem.writeAsStringAsync(
      path,
      base64data.split(',')[1],
      { encoding: 'base64' }
    );
    
    console.log('✅ PDF saved to:', path);
    
    // Auto-share if requested
    if (options.autoShare && await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path);
    }
    
    return path;
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

/**
 * Convert a Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Helper to format contract data from bid state
 * 
 * @param bid - Bid data from estimate generator
 * @param user - User profile data
 * @param materialsCart - Materials from cart
 * @param laborLineItems - Labor line items
 * @returns Formatted contract data ready for PDF generation
 */
export function formatContractData(
  bid: any,
  user: any,
  materialsCart: any[],
  laborLineItems: any[]
) {
  return {
    companyName: user.company || "American Building",
    contractId: bid.id?.toString() || Date.now().toString(),
    dateStr: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }),
    customer: {
      name: bid.clientName || "Customer Name",
      email: bid.clientEmail,
      phone: bid.clientPhone,
    },
    project: {
      name: bid.projectName || "Project",
      address: bid.location,
      duration: bid.duration ? `${bid.duration} days` : "30 days",
      warranty: "1 year workmanship warranty",
    },
    scopeSummary: bid.scope || "Project includes materials and labor per specifications.",
    materials: materialsCart.map(item => ({
      description: item.name || item.description,
      quantity: item.quantity,
      unit: item.unit || 'ea',
      materials: item.price || item.materials || 0,
      section: item.section || item.category || 'General Materials',
    })),
    labor: laborLineItems.map(item => ({
      task: item.description || item.task,
      amount: item.labor || item.amount || 0,
    })),
    taxRate: 0.0838, // Nevada sales tax - make this configurable per location
    currency: "USD",
    minVisibleMaterialAmount: 75, // Hide materials under $75
  };
}

/**
 * Calculate contract totals
 */
export function calculateContractTotals(data: {
  materials: Array<{ materials?: number }>;
  labor: Array<{ amount?: number }>;
  taxRate?: number;
}) {
  const materialsTotal = data.materials.reduce((sum, item) => sum + (item.materials ?? 0), 0);
  const laborTotal = data.labor.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const subtotal = materialsTotal + laborTotal;
  const tax = subtotal * (data.taxRate ?? 0);
  const grandTotal = subtotal + tax;

  return {
    materialsTotal: Math.round(materialsTotal * 100) / 100,
    laborTotal: Math.round(laborTotal * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
  };
}



