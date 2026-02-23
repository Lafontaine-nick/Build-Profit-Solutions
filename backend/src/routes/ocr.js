const express = require('express');
const multer = require('multer');
const router = express.Router();
const ENABLE_MOCK_OCR = process.env.ENABLE_MOCK_OCR === 'true';

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

    // Check if OpenAI API key is configured
    const hasOpenAIKey = process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' &&
      !process.env.OPENAI_API_KEY.includes('YOUR_OPE') &&
      process.env.OPENAI_API_KEY.length > 20;

    if (hasOpenAIKey) {
      
      // Use OpenAI Vision API for real OCR
      try {
        const openai = require('openai');
        const client = new openai.OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });

        let imageData;
        if (req.file) {
          imageData = req.file.buffer.toString('base64');
        } else if (req.body.image) {
          imageData = req.body.image;
        }

        const response = await client.chat.completions.create({
          model: "gpt-4o",
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
                  
                  Extraction rules:
                  - vendor must be the merchant name printed at the top/header (not guessed from typical stores).
                  - amount must be the FINAL TOTAL charged (prefer lines labeled TOTAL / GRAND TOTAL / AMOUNT DUE).
                  - Do NOT use subtotal or tax as amount.
                  - If vendor is not visible/legible, set vendor to an empty string and confidence below 70.
                  - Include up to 8 top line items under "items" as supplies/materials.
                  - If uncertain, return confidence below 70 and still provide best parsed values.

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
          // Clean the content - remove markdown code blocks if present
          let cleanedContent = content.trim();
          if (cleanedContent.startsWith('```json')) {
            cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
          } else if (cleanedContent.startsWith('```')) {
            cleanedContent = cleanedContent.replace(/```\n?/g, '').replace(/```\n?/g, '');
          }
          
          const receiptData = JSON.parse(cleanedContent);
          
          // Ensure confidence is set
          if (!receiptData.confidence) {
            receiptData.confidence = 85; // Default confidence
          }
          
          console.log('✅ OCR Success: Extracted receipt data using OpenAI');
          
          return res.json({
            success: true,
            data: receiptData,
            confidence: receiptData.confidence
          });
        } catch (parseError) {
          console.error('Failed to parse OpenAI response:', parseError);
          console.error('Raw response:', content);
          return res.status(500).json({
            success: false,
            error: 'Failed to parse receipt data from OpenAI',
            confidence: 0
          });
        }
      } catch (openaiError) {
        console.error('OpenAI OCR error:', openaiError);
        if (!ENABLE_MOCK_OCR) {
          return res.status(502).json({
            success: false,
            error: 'OCR service unavailable (OpenAI request failed)',
            confidence: 0
          });
        }
        return res.status(500).json({
          success: false,
          error: 'OpenAI OCR failed',
          confidence: 0
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
    const openai = require('openai');
    
    const hasOpenAIKey = process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' &&
      !process.env.OPENAI_API_KEY.includes('YOUR_OPE') &&
      process.env.OPENAI_API_KEY.length > 20;

    if (!hasOpenAIKey) {
      return res.status(503).json({
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
      model: "gpt-4o",
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
              
              Extraction rules:
              - vendor must be the merchant name printed at the top/header (not guessed from typical stores).
              - amount must be the FINAL TOTAL charged (prefer lines labeled TOTAL / GRAND TOTAL / AMOUNT DUE).
              - Do NOT use subtotal or tax as amount.
              - If uncertain, return confidence below 70 and still provide best parsed values.
              - Include up to 8 top line items in "items".

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
      max_tokens: 1000,
      temperature: 0.1
    });

    const content = response.choices[0].message.content;
    
    try {
      let cleanedContent = String(content || '').trim();
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/```\n?/g, '').replace(/```\n?/g, '');
      }

      const receiptData = JSON.parse(cleanedContent);
      
      res.json({
        success: true,
        data: receiptData,
        confidence: receiptData.confidence || 85
      });
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      console.error('Raw OpenAI OCR content:', content);
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
