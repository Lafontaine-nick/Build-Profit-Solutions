const { Expo } = require('expo-server-sdk');

// Create a new Expo SDK client
const expo = new Expo();

const pushNotificationService = {
  // Send notification to a single contractor
  sendLeadNotification: async (contractorPushToken, leadData) => {
    try {
      // Check that the push token is valid
      if (!Expo.isExpoPushToken(contractorPushToken)) {
        console.error(`Push token ${contractorPushToken} is not a valid Expo push token`);
        return { success: false, error: 'Invalid push token' };
      }

      // Construct the notification message
      const message = {
        to: contractorPushToken,
        sound: 'default',
        title: '🎯 New Lead Match!',
        body: `${leadData.trade} job in ${leadData.location.city} - $${leadData.budgetMin.toLocaleString()}-$${leadData.budgetMax.toLocaleString()}`,
        data: {
          type: 'NEW_LEAD',
          leadId: leadData.id,
          trade: leadData.trade,
          source: leadData.source,
          screen: 'leads', // Navigate to leads screen
        },
        badge: 1,
        priority: 'high',
        channelId: 'leads', // Android notification channel
      };

      // Send the notification
      const ticketChunk = await expo.sendPushNotificationsAsync([message]);
      console.log(`✅ Sent push notification for lead ${leadData.id}`);
      
      return { success: true, ticket: ticketChunk[0] };

    } catch (error) {
      console.error('Error sending push notification:', error);
      return { success: false, error: error.message };
    }
  },

  // Send notifications to multiple contractors
  sendBulkLeadNotifications: async (contractors, leadData) => {
    try {
      const messages = [];

      for (const contractor of contractors) {
        if (!contractor.expoPushToken) {
          console.log(`⚠️ Contractor ${contractor.id} has no push token, skipping notification`);
          continue;
        }

        if (!Expo.isExpoPushToken(contractor.expoPushToken)) {
          console.error(`Push token for ${contractor.id} is not valid`);
          continue;
        }

        messages.push({
          to: contractor.expoPushToken,
          sound: 'default',
          title: '🎯 New Lead Match!',
          body: `${leadData.trade} job in ${leadData.location.city} - $${leadData.budgetMin.toLocaleString()}-$${leadData.budgetMax.toLocaleString()}`,
          data: {
            type: 'NEW_LEAD',
            leadId: leadData.id,
            trade: leadData.trade,
            source: leadData.source,
            distance: contractor.distance || 'nearby',
            screen: 'leads',
          },
          badge: 1,
          priority: 'high',
          channelId: 'leads',
        });
      }

      if (messages.length === 0) {
        console.log('⚠️ No valid push tokens found, skipping notifications');
        return { success: true, sent: 0 };
      }

      // Send notifications in chunks of 100 (Expo limitation)
      const chunks = expo.chunkPushNotifications(messages);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('Error sending notification chunk:', error);
        }
      }

      console.log(`✅ Sent ${messages.length} push notifications for lead ${leadData.id}`);
      
      return { success: true, sent: messages.length, tickets };

    } catch (error) {
      console.error('Error sending bulk push notifications:', error);
      return { success: false, error: error.message };
    }
  },

  // Send custom notification
  sendCustomNotification: async (contractorPushToken, title, body, data = {}) => {
    try {
      if (!Expo.isExpoPushToken(contractorPushToken)) {
        console.error(`Push token ${contractorPushToken} is not a valid Expo push token`);
        return { success: false, error: 'Invalid push token' };
      }

      const message = {
        to: contractorPushToken,
        sound: 'default',
        title,
        body,
        data,
        badge: 1,
        priority: 'high',
      };

      const ticketChunk = await expo.sendPushNotificationsAsync([message]);
      console.log(`✅ Sent custom notification to contractor`);
      
      return { success: true, ticket: ticketChunk[0] };

    } catch (error) {
      console.error('Error sending custom notification:', error);
      return { success: false, error: error.message };
    }
  },

  // Verify receipt status of sent notifications
  checkReceiptStatus: async (receiptIds) => {
    try {
      const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
      const receipts = [];

      for (const chunk of receiptIdChunks) {
        try {
          const receiptChunk = await expo.getPushNotificationReceiptsAsync(chunk);
          receipts.push(receiptChunk);
        } catch (error) {
          console.error('Error getting receipt chunk:', error);
        }
      }

      return receipts;
    } catch (error) {
      console.error('Error checking receipt status:', error);
      return [];
    }
  },
};

module.exports = { pushNotificationService };




