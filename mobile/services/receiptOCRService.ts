import * as FileSystem from 'expo-file-system/legacy';
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

const isLikelyMockReceiptData = (data: any, confidence?: number): boolean => {
  if (!data || typeof data !== 'object') return false;
  const vendor = String(data.vendor || '').toLowerCase().trim();
  const amount = Number(data.amount || 0);
  const conf = Number(confidence ?? data.confidence ?? 0);
  const itemDescriptions = Array.isArray(data.items)
    ? data.items.map((item: any) => String(item?.description || '').toLowerCase())
    : [];

  // Signature of the backend demo payload currently causing incorrect autofill.
  const looksLikeKnownDemoPayload =
    vendor === 'home depot' &&
    Math.abs(amount - 127.49) < 0.01 &&
    Math.abs(conf - 87) <= 1 &&
    itemDescriptions.some((d: string) => d.includes('2x4 lumber'));

  return looksLikeKnownDemoPayload;
};

class ReceiptOCRService {
  private apiBaseUrl: string;
  private readonly OCR_TIMEOUT_MS = 22000;
  private readonly ENABLE_MOCK_OCR_FALLBACK = process.env.EXPO_PUBLIC_ENABLE_MOCK_OCR === 'true';

  constructor() {
    this.apiBaseUrl = this.resolveApiBaseUrl();
  }

  private resolveApiBaseUrl(): string {
    const PRODUCTION_URL = 'https://build-profit-solutions-backend.onrender.com';
    const allowLocalBackend =
      process.env.EXPO_PUBLIC_USE_LOCALHOST === 'true' ||
      process.env.EXPO_PUBLIC_SIMULATOR_USE_LOCAL === 'true' ||
      process.env.EXPO_PUBLIC_EMULATOR_USE_LOCAL === 'true';

    const normalize = (url: string) => url.trim().replace(/\/api\/?$/, '');
    const isLocal = (url: string) =>
      url.includes('localhost') || url.includes('192.168.') || url.includes('10.0.2.2');

    const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (envUrl) {
      const normalized = normalize(envUrl);
      if (isLocal(normalized) && !allowLocalBackend) {
        if (__DEV__) console.log('⚠️ receiptOCRService ignoring local env URL, using production');
        return PRODUCTION_URL;
      }
      return normalized;
    }

    const configUrl = Constants.expoConfig?.extra?.apiBaseUrl;
    if (configUrl) {
      const normalized = normalize(configUrl);
      if (isLocal(normalized) && !allowLocalBackend) {
        if (__DEV__) console.log('⚠️ receiptOCRService ignoring local config URL, using production');
        return PRODUCTION_URL;
      }
      return normalized;
    }

    return PRODUCTION_URL;
  }

  /**
   * Process receipt image using OCR and AI
   * @param imageUri - Local URI of the receipt image
   * @returns Extracted receipt data
   */
  async processReceipt(imageUri: string): Promise<OCRResult> {
    try {
      // Fast path: upload image file directly (smaller payload than JSON base64).
      // If this fails or times out, continue to base64 fallback instead of failing hard.
      try {
        const fileResult = await this.callBackendAPIWithFile(imageUri);
        if (fileResult.success) {
          return fileResult;
        }
      } catch (fileError: any) {
        console.warn('⚠️ File-upload OCR path failed, trying base64 fallback:', fileError?.message || fileError);
      }

      // Fallback path: convert to base64 if direct upload fails.
      console.log('📸 Fallback: converting image to base64 from URI:', imageUri);
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64',
      });
      return await this.processBase64Image(base64Image);
    } catch (error: any) {
      console.error('❌ Error processing receipt:', error);
      return {
        success: false,
        error: error?.message || 'Failed to process receipt',
        confidence: 0,
      };
    }
  }

  /**
   * Process receipt with base64 data directly (from ImagePicker)
   * @param base64Data - Base64 encoded image data
   * @returns Extracted receipt data
   */
  async processReceiptWithBase64(base64Data: string): Promise<OCRResult> {
    console.log('📸 Processing receipt with provided base64 data, length:', base64Data.length);
    return await this.processBase64Image(base64Data);
  }

  /**
   * Internal method to process base64 image
   */
  private async processBase64Image(base64Image: string): Promise<OCRResult> {
    // Try to call the real backend API first
    try {
      console.log('🌐 Calling backend OCR API...');
      const result = await this.callBackendAPIWithBase64(base64Image);
      if (result.success) {
        console.log('✅ Backend OCR succeeded');
        return result;
      }
      console.warn('⚠️ Backend OCR returned no structured result');
    } catch (apiError: any) {
      console.warn('⚠️ Backend OCR API error:', apiError?.message || apiError);
    }

    // Mock fallback only when explicitly enabled for demos/dev.
    if (this.ENABLE_MOCK_OCR_FALLBACK) {
      console.log('🔄 Using mock OCR service (explicitly enabled)');
      const result = await this.mockOCRService(base64Image);
      return result;
    }

    return {
      success: false,
      error: 'Could not extract receipt details from image. Please enter vendor and amount manually.',
      confidence: 0,
    };
  }

  /**
   * POST helper with timeout to avoid long UI hangs.
   */
  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs = this.OCR_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async callBackendAPIWithFile(imageUri: string): Promise<OCRResult> {
    try {
      const openAiUrl = `${this.apiBaseUrl}/api/ocr/receipt/openai`;
      const fallbackUrl = `${this.apiBaseUrl}/api/ocr/receipt`;
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        name: 'receipt.jpg',
        type: 'image/jpeg',
      } as any);

      const attempt = async (url: string): Promise<OCRResult> => {
        const response = await this.fetchWithTimeout(
          url,
          {
            method: 'POST',
            body: formData,
            // Let RN set multipart boundary automatically.
            headers: {
              Accept: 'application/json',
            },
          },
          this.OCR_TIMEOUT_MS
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OCR API error: ${response.status} - ${errorText.substring(0, 100)}`);
        }

        const result = await response.json();
        const confidence = result.confidence || result?.data?.confidence || 0;
        if (result?.mock === true || isLikelyMockReceiptData(result?.data, confidence)) {
          return {
            success: false,
            error: 'OCR returned demo/mock data. Real OCR is unavailable.',
            confidence: 0,
          };
        }
        if (result.success && result.data) {
          return {
            success: true,
            data: result.data,
            confidence: confidence || 85,
          };
        }
        return {
          success: false,
          error: result.error || 'Failed to extract receipt data',
          confidence: 0,
        };
      };

      try {
        return await attempt(openAiUrl);
      } catch (openAiErr) {
        // Compatibility fallback for older backend deployments.
        return await attempt(fallbackUrl);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('OCR request timed out on file upload path.');
      }
      throw error;
    }
  }

  /**
   * Call the backend OCR API with JSON base64 payload (fallback).
   */
  private async callBackendAPIWithBase64(base64Image: string): Promise<OCRResult> {
    try {
      const openAiUrl = `${this.apiBaseUrl}/api/ocr/receipt/openai`;
      const fallbackUrl = `${this.apiBaseUrl}/api/ocr/receipt`;
      console.log('🌐 Calling backend at:', openAiUrl);
      console.log('📊 Image data size:', base64Image.length, 'characters');

      const attempt = async (url: string): Promise<OCRResult> => {
        const response = await this.fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: base64Image,
          }),
        });

        console.log('📡 Response status:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Backend error response:', errorText);
          throw new Error(`OCR API error: ${response.status} - ${errorText.substring(0, 100)}`);
        }

        const result = await response.json();
        const confidence = result.confidence || result?.data?.confidence || 0;
        if (result?.mock === true || isLikelyMockReceiptData(result?.data, confidence)) {
          return {
            success: false,
            error: 'OCR returned demo/mock data. Real OCR is unavailable.',
            confidence: 0,
          };
        }
        console.log('📄 Backend response:', JSON.stringify(result).substring(0, 200));
        
        if (result.success && result.data) {
          return {
            success: true,
            data: result.data,
            confidence: confidence || 85,
          };
        }
        return {
          success: false,
          error: result.error || 'Failed to extract receipt data',
          confidence: 0,
        };
      };

      try {
        return await attempt(openAiUrl);
      } catch (openAiErr) {
        // Compatibility fallback for older backend deployments.
        return await attempt(fallbackUrl);
      }
    } catch (error: any) {
      console.warn('⚠️ Backend OCR API error:', error?.message || error);
      console.warn('OCR error details:', {
        message: error?.message,
        stack: error?.stack?.substring(0, 200),
      });
      throw error;
    }
  }

  /**
   * Mock OCR service for demonstration
   * Replace this with actual OCR service integration
   */
  private async mockOCRService(base64Image: string): Promise<OCRResult> {
    // Keep fallback snappy so users can continue manual entry quickly.
    await new Promise(resolve => setTimeout(resolve, 250));

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
