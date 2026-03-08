const express = require('express');
const router = express.Router();
const { sendSMS, sendBulkSMS, formatPhoneNumber } = require('../services/twilioService');

/**
 * POST /api/team/message
 * Send SMS to a single team member
 */
router.post('/message', async (req, res) => {
  try {
    const { phoneNumber, message, teamMemberName } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    // Format phone number to E.164
    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!formattedPhone) {
      return res.status(400).json({
        success: false,
        error: `Invalid phone number format: ${phoneNumber}. Expected format: +1234567890 or (123) 456-7890`
      });
    }

    // Send SMS
    const result = await sendSMS(formattedPhone, message);

    if (result.success) {
      console.log(`✅ SMS sent to ${teamMemberName || formattedPhone}: ${message.substring(0, 50)}...`);
      return res.json({
        success: true,
        message: `Message sent successfully to ${teamMemberName || formattedPhone}`,
        messageSid: result.messageSid,
        status: result.status
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send SMS'
      });
    }
  } catch (error) {
    console.error('Error sending team message:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/team/notify
 * Send SMS to multiple team members (bulk notification)
 */
router.post('/notify', async (req, res) => {
  try {
    const { phoneNumbers, message } = req.body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Phone numbers array is required and must not be empty'
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    // Format all phone numbers
    const formattedPhones = phoneNumbers
      .map(phone => formatPhoneNumber(phone))
      .filter(phone => phone !== null); // Remove invalid numbers

    if (formattedPhones.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid phone numbers provided'
      });
    }

    // Send bulk SMS
    const result = await sendBulkSMS(formattedPhones, message);

    if (result.success) {
      console.log(`✅ Bulk SMS sent to ${result.totalSent} team members: ${message.substring(0, 50)}...`);
      return res.json({
        success: true,
        message: `Messages sent successfully to ${result.totalSent} team member(s)`,
        totalSent: result.totalSent,
        totalFailed: result.totalFailed,
        results: result.results,
        errors: result.errors
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to send some or all messages',
        totalSent: result.totalSent,
        totalFailed: result.totalFailed,
        results: result.results,
        errors: result.errors
      });
    }
  } catch (error) {
    console.error('Error sending team notification:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

module.exports = router;
