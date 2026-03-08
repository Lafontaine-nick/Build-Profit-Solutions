const twilio = require('twilio');

// Initialize Twilio client
let twilioClient = null;

function initializeTwilio() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !phoneNumber) {
    console.warn('⚠️ Twilio credentials not configured. SMS functionality will be disabled.');
    return null;
  }

  try {
    twilioClient = twilio(accountSid, authToken);
    console.log('✅ Twilio client initialized successfully');
    console.log(`📞 Using phone number: ${phoneNumber}`);
    return twilioClient;
  } catch (error) {
    console.error('❌ Failed to initialize Twilio client:', error.message);
    return null;
  }
}

// Initialize on module load
if (!twilioClient) {
  twilioClient = initializeTwilio();
}

/**
 * Send SMS to a single phone number
 * @param {string} to - Recipient phone number (E.164 format: +1234567890)
 * @param {string} message - Message content
 * @returns {Promise<{success: boolean, messageSid?: string, error?: string}>}
 */
async function sendSMS(to, message) {
  if (!twilioClient) {
    // Try to initialize if not already done
    twilioClient = initializeTwilio();
    if (!twilioClient) {
      return {
        success: false,
        error: 'Twilio not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your .env file.'
      };
    }
  }

  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  // Validate phone number format (should be E.164: +1234567890)
  if (!to || !to.startsWith('+')) {
    return {
      success: false,
      error: `Invalid phone number format. Expected E.164 format (e.g., +1234567890), got: ${to}`
    };
  }

  // Validate message
  if (!message || message.trim().length === 0) {
    return {
      success: false,
      error: 'Message content cannot be empty'
    };
  }

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: fromNumber,
      to: to
    });

    console.log(`✅ SMS sent successfully to ${to}. Message SID: ${result.sid}, Status: ${result.status}`);
    
    // Check for toll-free verification issues
    if (result.errorCode === 30032) {
      console.error(`❌ Toll-free number not verified. Error 30032: Toll-free numbers require business verification for messaging.`);
      return {
        success: false,
        error: 'Toll-free number not verified. Toll-free numbers (8XX) require business verification for SMS. Please complete verification in Twilio Console or use a regular phone number.',
        errorCode: result.errorCode,
        messageSid: result.sid,
        status: result.status
      };
    }
    
    // Check for A2P 10DLC registration issues
    if (result.errorCode === 30034) {
      console.error(`❌ A2P 10DLC unregistered number. Error 30034: US local numbers require A2P 10DLC registration.`);
      return {
        success: false,
        error: 'A2P 10DLC registration required. US local phone numbers require A2P 10DLC brand and campaign registration for SMS. You can either: 1) Complete toll-free verification for your 877 number, or 2) Register for A2P 10DLC in Twilio Console (Messaging → Regulatory Compliance → A2P 10DLC).',
        errorCode: result.errorCode,
        messageSid: result.sid,
        status: result.status
      };
    }
    
    // Check if message was queued (trial accounts may queue but not deliver to unverified numbers)
    if (result.status === 'queued' || result.status === 'sent') {
      // For trial accounts, warn if this might not deliver
      const isTrialAccount = process.env.TWILIO_ACCOUNT_SID?.startsWith('AC') && 
                             !process.env.TWILIO_ACCOUNT_SID?.includes('prod');
      
      if (isTrialAccount) {
        console.warn(`⚠️ Trial account: Message queued to ${to}. On trial accounts, SMS only delivers to verified phone numbers.`);
      }
    }
    
    return {
      success: true,
      messageSid: result.sid,
      status: result.status,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage
    };
  } catch (error) {
    console.error(`❌ Failed to send SMS to ${to}:`, error.message);
    
    // Provide more helpful error messages for common Twilio errors
    let errorMessage = error.message || 'Failed to send SMS';
    if (error.code === 21211) {
      errorMessage = 'Invalid phone number format. Please verify the phone number is correct.';
    } else if (error.code === 21608) {
      errorMessage = 'This phone number is not verified. On Twilio trial accounts, you can only send SMS to verified phone numbers. Please verify this number in the Twilio Console.';
    } else if (error.code === 21610) {
      errorMessage = 'Unverified sender number. Please verify your Twilio phone number in the Twilio Console.';
    } else if (error.code === 30032) {
      errorMessage = 'Toll-free number not verified. Toll-free numbers (8XX) require business verification for SMS messaging. Please complete verification in Twilio Console (Phone Numbers → Configure → Messaging toll-free verification) or use a regular phone number instead.';
    } else if (error.code === 30034) {
      errorMessage = 'A2P 10DLC registration required. US local phone numbers require A2P 10DLC brand and campaign registration for SMS. Options: 1) Complete toll-free verification for your 877 number (easier, can use personal info), or 2) Register for A2P 10DLC in Twilio Console (Messaging → Regulatory Compliance → A2P 10DLC).';
    }
    
    return {
      success: false,
      error: errorMessage,
      errorCode: error.code
    };
  }
}

/**
 * Send SMS to multiple phone numbers (for team notifications)
 * @param {string[]} phoneNumbers - Array of recipient phone numbers (E.164 format)
 * @param {string} message - Message content
 * @returns {Promise<{success: boolean, results: Array, errors: Array}>}
 */
async function sendBulkSMS(phoneNumbers, message) {
  if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
    return {
      success: false,
      errors: ['No phone numbers provided']
    };
  }

  const results = [];
  const errors = [];

  // Send messages in parallel
  const promises = phoneNumbers.map(async (phoneNumber) => {
    const result = await sendSMS(phoneNumber, message);
    if (result.success) {
      results.push({ phoneNumber, messageSid: result.messageSid });
    } else {
      errors.push({ phoneNumber, error: result.error });
    }
    return result;
  });

  await Promise.all(promises);

  return {
    success: errors.length === 0,
    results,
    errors,
    totalSent: results.length,
    totalFailed: errors.length
  };
}

/**
 * Format phone number to E.164 format
 * @param {string} phoneNumber - Phone number in any format
 * @returns {string|null} - Formatted phone number or null if invalid
 */
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return null;

  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // If it doesn't start with +, assume US number and add +1
  if (!cleaned.startsWith('+')) {
    // Remove leading 1 if present
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      cleaned = cleaned.substring(1);
    }
    cleaned = '+1' + cleaned;
  }

  // Validate length (E.164: + followed by 1-15 digits)
  if (cleaned.length < 11 || cleaned.length > 16) {
    return null;
  }

  return cleaned;
}

module.exports = {
  sendSMS,
  sendBulkSMS,
  formatPhoneNumber,
  initializeTwilio
};
