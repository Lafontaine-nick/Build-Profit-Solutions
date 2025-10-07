const express = require('express');
const multer = require('multer');
const router = express.Router();

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
 */
router.post('/receipt', upload.single('image'), async (req, res) => {
  try {
    if (!req.file && !req.body.image) {
      return res.status(400).json({
        success: false,
        error: 'No image provided'
      });
    }

    // For now, return mock OCR data
    // In production, integrate with OpenAI Vision API, Google Cloud Vision, or AWS Textract
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
      confidence: mockReceiptData.confidence
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
    const openai = require('openai');
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured'
      });
    }

    const client = new openai.OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

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

    const response = await client.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please analyze this receipt image and extract the following information in JSON format:
              {
                "vendor": "store/company name",
                "date": "YYYY-MM-DD",
                "amount": total_amount_as_number,
                "category": "categorize as Materials, Tools, Equipment, Labor, Fuel, Meals, or Other",
                "items": [
                  {
                    "description": "item name",
                    "amount": item_price_as_number,
                    "quantity": quantity_if_visible,
                    "unitPrice": unit_price_if_visible
                  }
                ],
                "taxAmount": tax_amount_as_number_if_visible,
                "confidence": confidence_percentage_as_number
              }
              
              Only return valid JSON, no other text.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageData}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    });

    const content = response.choices[0].message.content;
    
    try {
      const receiptData = JSON.parse(content);
      
      res.json({
        success: true,
        data: receiptData,
        confidence: receiptData.confidence || 85
      });
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      res.status(500).json({
        success: false,
        error: 'Failed to parse receipt data',
        confidence: 0
      });
    }

  } catch (error) {
    console.error('OpenAI OCR error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process receipt with AI',
      confidence: 0
    });
  }
});

module.exports = router;
