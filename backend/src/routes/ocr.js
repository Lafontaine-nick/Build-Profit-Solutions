const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  createOpenAiClient,
  getAiModels,
  getAiRuntimeSettings,
  getOpenAiApiKey,
  hasValidOpenAiKey,
} = require('../config/aiConfig');
const ENABLE_MOCK_OCR = process.env.ENABLE_MOCK_OCR === 'true';
const aiModels = getAiModels();
const aiRuntime = getAiRuntimeSettings();

function getOcrClient() {
  const apiKey = getOpenAiApiKey();
  if (!hasValidOpenAiKey(apiKey)) return null;
  return createOpenAiClient(apiKey);
}

const JSON_OBJECT_FORMAT = { type: 'json_object' };

function parseVisionJsonContent(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  if (s.startsWith('```json')) {
    s = s.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  } else if (s.startsWith('```')) {
    s = s.replace(/^```\w*\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    s = s.slice(start, end + 1);
  }
  return JSON.parse(s);
}

function coerceMoney(raw) {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const n = parseFloat(String(raw).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function normalizeReceiptData(data) {
  if (!data || typeof data !== 'object') return null;
  const out = { ...data };
  out.amount = coerceMoney(out.amount);
  out.taxAmount = coerceMoney(out.taxAmount);
  if (!Array.isArray(out.items)) out.items = [];
  else {
    out.items = out.items
      .slice(0, 12)
      .map((it) => ({
        ...it,
        description: String(it?.description ?? '').trim() || 'Item',
        amount: coerceMoney(it?.amount),
        unitPrice: coerceMoney(it?.unitPrice),
        quantity:
          typeof it?.quantity === 'number' && Number.isFinite(it.quantity) ? it.quantity : undefined,
      }));
  }
  out.vendor = typeof out.vendor === 'string' ? out.vendor : String(out.vendor || '').trim();
  out.date = typeof out.date === 'string' ? out.date : String(out.date || '').trim();
  out.category = typeof out.category === 'string' ? out.category : String(out.category || 'Other');
  const conf = Number(out.confidence);
  out.confidence = Number.isFinite(conf) ? Math.min(100, Math.max(0, conf)) : 75;
  return out;
}

const RECEIPT_VISION_PROMPT = `Analyze this receipt image and return one JSON object with:
- vendor: store name as printed (string, empty if illegible)
- date: YYYY-MM-DD if visible (string, empty if unknown)
- amount: final total charged as a number (not subtotal; prefer TOTAL / AMOUNT DUE)
- category: one of Materials, Tools, Equipment, Labor, Fuel, Meals, Other
- items: up to 8 line objects { description, amount, quantity?, unitPrice? }
- taxAmount: number if visible else 0
- confidence: 0-100 how sure you are`;

async function runReceiptVisionExtraction(client, imageBase64, multerMimeType) {
  const mime =
    multerMimeType && String(multerMimeType).startsWith('image/') ? multerMimeType : 'image/jpeg';

  const buildPayload = (useJsonObjectFormat) => ({
    model: aiModels.ocr.receipt,
    temperature: aiRuntime.ocr.receipt.temperature,
    max_tokens: aiRuntime.ocr.receipt.maxTokens,
    ...(useJsonObjectFormat ? { response_format: JSON_OBJECT_FORMAT } : {}),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${RECEIPT_VISION_PROMPT}

Respond with JSON only matching the shape described.`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mime};base64,${imageBase64}`,
            },
          },
        ],
      },
    ],
  });

  const parseFromResponse = (response) => {
    const raw = response.choices[0]?.message?.content;
    const parsed = parseVisionJsonContent(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Empty or invalid JSON from vision model');
    }
    return normalizeReceiptData(parsed);
  };

  try {
    const response = await client.chat.completions.create(buildPayload(true));
    return parseFromResponse(response);
  } catch (firstErr) {
    console.warn('OCR vision (json_object) failed, retrying without response_format:', firstErr?.message || firstErr);
    const response = await client.chat.completions.create(buildPayload(false));
    return parseFromResponse(response);
  }
}

// Configure multer for handling image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * POST /api/ocr/receipt
 * Process receipt image with OCR
 * Uses OpenAI Vision API if available; only uses mock data if no key.
 */
router.post('/receipt', upload.single('image'), async (req, res) => {
  try {
    if (!req.file && !req.body.image) {
      return res.status(400).json({
        success: false,
        error: 'No image provided'
      });
    }

    const client = getOcrClient();

    if (client) {
      try {
        let imageData;
        if (req.file) {
          imageData = req.file.buffer.toString('base64');
        } else if (req.body.image) {
          imageData = req.body.image;
        }

        const receiptData = await runReceiptVisionExtraction(client, imageData, req.file?.mimetype);

        if (!receiptData.confidence) {
          receiptData.confidence = 85;
        }

        console.log('✅ OCR Success: Extracted receipt data using OpenAI');

        return res.json({
          success: true,
          data: receiptData,
          confidence: receiptData.confidence,
        });
      } catch (openaiError) {
        console.error('OpenAI OCR error:', openaiError);
        if (!ENABLE_MOCK_OCR) {
          return res.status(502).json({
            success: false,
            error: 'OCR service unavailable (OpenAI request failed)',
            confidence: 0,
          });
        }
        return res.status(500).json({
          success: false,
          error: 'OpenAI OCR failed',
          confidence: 0,
        });
      }
    } else {
      if (!ENABLE_MOCK_OCR) {
        return res.status(503).json({
          success: false,
          error: 'OCR unavailable: OPENAI_API_KEY not configured',
          confidence: 0
        });
      }
      console.warn('⚠️ OpenAI API key not configured - using mock OCR data (ENABLE_MOCK_OCR=true)');
    }

    // Fallback to mock OCR data only if OpenAI is not configured
    const mockReceiptData = {
      vendor: "Home Depot",
      date: new Date().toISOString().split('T')[0],
      amount: 127.49,
      category: "Materials",
      items: [
        { description: "2x4 Lumber", amount: 45.60, quantity: 8, unitPrice: 5.70 },
        { description: "Wood Screws", amount: 15.99, quantity: 2, unitPrice: 7.99 },
        { description: "Paint Primer", amount: 28.50, quantity: 1, unitPrice: 28.50 },
        { description: "Drop Cloth", amount: 12.40, quantity: 1, unitPrice: 12.40 }
      ],
      taxAmount: 10.20,
      confidence: 87
    };

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    res.json({
      success: true,
      data: mockReceiptData,
      confidence: mockReceiptData.confidence,
      mock: true
    });

  } catch (error) {
    console.error('OCR processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process receipt',
      confidence: 0
    });
  }
});

/**
 * POST /api/ocr/receipt/openai
 * Process receipt using OpenAI Vision API (production implementation)
 */
router.post('/receipt/openai', upload.single('image'), async (req, res) => {
  try {
    const client = getOcrClient();

    if (!client) {
      return res.status(503).json({
        success: false,
        error: 'OpenAI API key not configured'
      });
    }

    let imageData;
    if (req.file) {
      imageData = req.file.buffer.toString('base64');
    } else if (req.body.image) {
      imageData = req.body.image;
    } else {
      return res.status(400).json({
        success: false,
        error: 'No image provided'
      });
    }

    const receiptData = await runReceiptVisionExtraction(client, imageData, req.file?.mimetype);

    return res.json({
      success: true,
      data: receiptData,
      confidence: receiptData.confidence || 85,
    });
  } catch (error) {
    console.error('OpenAI OCR error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to process receipt with AI',
      confidence: 0,
    });
  }
});

module.exports = router;
