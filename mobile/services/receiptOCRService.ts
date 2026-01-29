import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

// Type definitions for receipt data
export interface ReceiptData {
  vendor: string;
  date: string;
  amount: number;
  category: string;
  items: ReceiptItem[];
  taxAmount?: number;
  confidence: number;
}

export interface ReceiptItem {
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
}

export interface OCRResult {
  success: boolean;
  data?: ReceiptData;
  error?: string;
  confidence: number;
}

class ReceiptOCRService {
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl =
      Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:3001';
  }

  /**
   * Process receipt image using OCR and AI
   * @param imageUri - Local URI of the receipt image
   * @returns Extracted receipt data
   */
  async processReceipt(imageUri: string): Promise<OCRResult> {
    try {
      // First, convert image to base64
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // For now, we'll use a mock OCR service
      // In production, you would integrate with Google Vision API, AWS Textract, or OpenAI Vision
      const result = await this.mockOCRService(base64Image);

      return result;
    } catch (error) {
      console.error('Error processing receipt:', error);
      return {
        success: false,
        error: 'Failed to process receipt',
        confidence: 0,
      };
    }
  }

  /**
   * Mock OCR service for demonstration
   * Replace this with actual OCR service integration
   */
  private async mockOCRService(base64Image: string): Promise<OCRResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate realistic mock receipt data
    const mockReceipts = [
      {
        vendor: 'Home Depot',
        date: new Date().toISOString().split('T')[0],
        amount: 247.83,
        category: 'Materials',
        items: [
          {
            description: '2x4 Lumber (10ft)',
            amount: 45.6,
            quantity: 8,
            unitPrice: 5.7,
          },
          {
            description: 'Drywall Screws (1lb)',
            amount: 12.99,
            quantity: 2,
            unitPrice: 6.5,
          },
          {
            description: 'Joint Compound (5gal)',
            amount: 34.99,
            quantity: 1,
            unitPrice: 34.99,
          },
          {
            description: 'Paint Primer (1gal)',
            amount: 28.5,
            quantity: 2,
            unitPrice: 14.25,
          },
          {
            description: 'Contractor Trash Bags',
            amount: 18.75,
            quantity: 1,
            unitPrice: 18.75,
          },
        ],
        taxAmount: 21.45,
        confidence: 92,
      },
      {
        vendor: 'Lowes',
        date: new Date().toISOString().split('T')[0],
        amount: 156.42,
        category: 'Labor',
        items: [
          {
            description: 'Cordless Drill',
            amount: 89.99,
            quantity: 1,
            unitPrice: 89.99,
          },
          {
            description: 'Drill Bit Set',
            amount: 24.99,
            quantity: 1,
            unitPrice: 24.99,
          },
          {
            description: 'Safety Glasses',
            amount: 8.99,
            quantity: 2,
            unitPrice: 4.5,
          },
          {
            description: 'Work Gloves',
            amount: 12.99,
            quantity: 1,
            unitPrice: 12.99,
          },
        ],
        taxAmount: 12.46,
        confidence: 88,
      },
      {
        vendor: 'Ace Hardware',
        date: new Date().toISOString().split('T')[0],
        amount: 78.34,
        category: 'Hardware',
        items: [
          {
            description: 'Wood Screws (assorted)',
            amount: 15.99,
            quantity: 3,
            unitPrice: 5.33,
          },
          {
            description: 'Toggle Bolts',
            amount: 8.99,
            quantity: 2,
            unitPrice: 4.5,
          },
          {
            description: 'Electrical Wire (25ft)',
            amount: 22.5,
            quantity: 1,
            unitPrice: 22.5,
          },
          {
            description: 'Wire Nuts (pack)',
            amount: 6.99,
            quantity: 1,
            unitPrice: 6.99,
          },
        ],
        taxAmount: 6.23,
        confidence: 85,
      },
    ];

    // Randomly select a mock receipt
    const selectedReceipt =
      mockReceipts[Math.floor(Math.random() * mockReceipts.length)];

    return {
      success: true,
      data: selectedReceipt,
      confidence: selectedReceipt.confidence,
    };
  }

  /**
   * Integrate with OpenAI Vision API for real OCR
   * This would be used in production
   */
  private async openAIVisionOCR(base64Image: string): Promise<OCRResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/ocr/receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          prompt: `Please extract the following information from this receipt:
            - Vendor/Store name
            - Date of purchase
            - Total amount
            - Individual items with descriptions and prices
            - Tax amount if visible
            - Categorize the purchase (Materials, Tools, Labor, Equipment, etc.)
            
            Return the data in JSON format.`,
        }),
      });

      if (!response.ok) {
        throw new Error(`OCR API error: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('OpenAI Vision OCR error:', error);
      return {
        success: false,
        error: 'OCR service unavailable',
        confidence: 0,
      };
    }
  }

  /**
   * Extract text patterns from receipt using regex
   * Fallback method for basic text extraction
   */
  private extractReceiptPatterns(text: string): Partial<ReceiptData> {
    const patterns = {
      // Common store names
      vendor: /(home depot|lowes|menards|ace hardware|walmart|target|amazon)/i,
      // Date patterns (MM/DD/YYYY, MM-DD-YYYY, etc.)
      date: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      // Currency amounts ($X.XX, $XX.XX, etc.)
      amount: /\$(\d+\.?\d{0,2})/g,
      // Tax patterns
      tax: /tax.*?\$(\d+\.?\d{0,2})/i,
      // Total patterns
      total: /total.*?\$(\d+\.?\d{0,2})/i,
    };

    const extracted: Partial<ReceiptData> = {};

    // Extract vendor
    const vendorMatch = text.match(patterns.vendor);
    if (vendorMatch) {
      extracted.vendor = vendorMatch[1];
    }

    // Extract date
    const dateMatch = text.match(patterns.date);
    if (dateMatch) {
      extracted.date = dateMatch[1];
    }

    // Extract amounts
    const amountMatches = text.match(patterns.amount);
    if (amountMatches) {
      const amounts = amountMatches.map(match =>
        parseFloat(match.replace('$', ''))
      );
      extracted.amount = Math.max(...amounts); // Assume highest amount is total
    }

    return extracted;
  }

  /**
   * Auto-categorize expense based on vendor and items
   */
  private categorizeExpense(vendor: string, items: ReceiptItem[]): string {
    const vendorCategories: Record<string, string> = {
      'home depot': 'Materials',
      lowes: 'Materials',
      menards: 'Materials',
      'ace hardware': 'Hardware',
      grainger: 'Tools',
      uhaul: 'Equipment',
      shell: 'Fuel',
      exxon: 'Fuel',
      chevron: 'Fuel',
      subway: 'Meals',
      mcdonalds: 'Meals',
      starbucks: 'Meals',
    };

    const vendorLower = vendor.toLowerCase();

    // Check direct vendor mapping
    for (const [key, category] of Object.entries(vendorCategories)) {
      if (vendorLower.includes(key)) {
        return category;
      }
    }

    // Analyze items for category hints
    const itemText = items
      .map(item => item.description.toLowerCase())
      .join(' ');

    if (
      itemText.includes('lumber') ||
      itemText.includes('drywall') ||
      itemText.includes('paint')
    ) {
      return 'Materials';
    }

    if (
      itemText.includes('drill') ||
      itemText.includes('saw') ||
      itemText.includes('hammer')
    ) {
      return 'Labor';
    }

    if (
      itemText.includes('gas') ||
      itemText.includes('fuel') ||
      itemText.includes('diesel')
    ) {
      return 'Fuel';
    }

    return 'Other';
  }
}

export const receiptOCRService = new ReceiptOCRService();
export default receiptOCRService;
