/**
 * PDF Generator Utility
 *
 * Bridges @react-pdf/renderer with Expo file storage / sharing.
 */

import '../lib/proposals/reactPdfBufferPolyfill';
import type { ReactElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { fromByteArray, toByteArray } from 'base64-js';
import { triggerBrowserPdfDownload } from './triggerBrowserPdfDownload';

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
type PdfInstance = ReturnType<typeof pdf>;

type ChunkStream = {
  on: (ev: string, fn: (...args: unknown[]) => void) => void;
};

/**
 * Prefer the stream from `toBuffer()` on React Native: `Blob` / `arrayBuffer()`
 * are often incomplete in Hermes, which breaks `toBlob()`.
 */
async function pdfInstanceToBase64String(instance: PdfInstance): Promise<string> {
  const stream = (await instance.toBuffer()) as unknown as ChunkStream;

  const chunks: Uint8Array[] = [];

  return await new Promise((resolve, reject) => {
    stream.on('data', (chunk: unknown) => {
      if (chunk instanceof Uint8Array) {
        chunks.push(chunk);
      } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(chunk)) {
        chunks.push(new Uint8Array(chunk));
      } else {
        chunks.push(new Uint8Array(chunk as ArrayBuffer));
      }
    });
    stream.on('end', () => {
      const total = chunks.reduce((sum, c) => sum + c.length, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.length;
      }
      resolve(fromByteArray(merged));
    });
    stream.on('error', reject);
  });
}

export async function generateAndSavePdf(
  document: ReactElement,
  options: GeneratePdfOptions
): Promise<string> {
  try {
    console.log('📄 Generating PDF...');
    const instance = pdf(document as any);
    let base64data: string;
    try {
      base64data = await pdfInstanceToBase64String(instance);
    } catch (streamErr) {
      console.warn('📄 PDF stream export failed, trying Blob path:', streamErr);
      const blob = await pdf(document as any).toBlob();
      base64data = await blobToBase64(blob);
    }
    const safeFilename = options.filename.toLowerCase().endsWith('.pdf')
      ? options.filename
      : `${options.filename}.pdf`;

    if (Platform.OS === 'web') {
      triggerBrowserPdfDownload(safeFilename, toByteArray(base64data));
      console.log('✅ PDF download triggered (web):', safeFilename);
      return `web-download:${safeFilename}`;
    }

    const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;

    if (!baseDir) {
      throw new Error('No writable file system directory is available for PDF export.');
    }

    const path = `${baseDir}${safeFilename}`;
    await FileSystem.writeAsStringAsync(
      path,
      base64data,
      { encoding: 'base64' }
    );

    console.log('✅ PDF saved to:', path);

    if (options.autoShare && await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
      });
    }

    return path;
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown PDF generation error';
    throw new Error(`Failed to generate PDF: ${message}`);
  }
}

/**
 * Convert a Blob to a bare base64 payload.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof blob.arrayBuffer === 'function') {
    const arrayBuffer = await blob.arrayBuffer();
    return fromByteArray(new Uint8Array(arrayBuffer));
  }

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
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



