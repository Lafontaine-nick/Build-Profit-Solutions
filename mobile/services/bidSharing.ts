import { Alert, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

export interface BidData {
  id: string;
  projectName: string;
  totalCost: number;
  breakdown: {
    materials: number;
    labor: number;
    equipment: number;
  };
  markup: number;
  bidPrice: number;
  timeline: string;
  clientName: string;
  clientEmail: string;
  projectAddress: string;
  description: string;
  createdAt: string;
  expiresAt: string;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected';
}

export interface BidLinkData {
  bidId: string;
  shareUrl: string;
  qrCode: string;
  shortCode: string;
  views: number;
  lastViewed?: string;
  expiresAt: string;
}

class BidSharing {
  private static generateBidId(): string {
    return `bid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generateShortCode(): string {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  static async createBidLink(bidData: BidData): Promise<BidLinkData> {
    try {
      const bidId = this.generateBidId();
      const shortCode = this.generateShortCode();

      // In a real app, this would be your backend URL
      const baseUrl = 'https://buildprofitsolutions.com/bid';
      const shareUrl = `${baseUrl}/${bidId}?code=${shortCode}`;

      // Generate QR code data
      const qrCode = shareUrl;

      // Set expiration (30 days from now)
      const expiresAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      const bidLinkData: BidLinkData = {
        bidId,
        shareUrl,
        qrCode,
        shortCode,
        views: 0,
        expiresAt,
      };

      // In a real app, you'd save this to your backend
      if (__DEV__) {
        console.log('Bid link created:', bidLinkData);
      }

      return bidLinkData;
    } catch (error) {
      console.error('Error creating bid link:', error);
      throw error;
    }
  }

  static async shareBidLink(
    bidLinkData: BidLinkData,
    bidData: BidData
  ): Promise<void> {
    try {
      const shareText = this.generateShareText(bidLinkData, bidData);

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();

      if (isAvailable) {
        await Sharing.shareAsync(shareText, {
          mimeType: 'text/plain',
          dialogTitle: 'Share Bid Link',
        });
      } else {
        // Fallback: copy to clipboard
        await Clipboard.setStringAsync(shareText);
        Alert.alert(
          'Bid Link Copied!',
          'The bid link has been copied to your clipboard. You can now paste it in any messaging app.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error sharing bid link:', error);
      Alert.alert('Error', 'Failed to share bid link. Please try again.');
    }
  }

  private static generateShareText(
    bidLinkData: BidLinkData,
    bidData: BidData
  ): string {
    const totalCost = bidData.totalCost.toLocaleString();
    const bidPrice = bidData.bidPrice.toLocaleString();

    return `🏗️ Construction Bid: ${bidData.projectName}

💰 Total Bid: $${bidPrice}
📅 Timeline: ${bidData.timeline}
📍 Location: ${bidData.projectAddress}

📋 View detailed breakdown and accept online:
${bidLinkData.shareUrl}

🔗 Short Code: ${bidLinkData.shortCode}

📱 Scan QR code or click link to view bid
⏰ Link expires: ${new Date(bidLinkData.expiresAt).toLocaleDateString()}

Built with Build Profit Solutions`;
  }

  static async copyBidLink(bidLinkData: BidLinkData): Promise<void> {
    try {
      await Clipboard.setStringAsync(bidLinkData.shareUrl);
      Alert.alert('Link Copied!', 'Bid link has been copied to clipboard.', [
        { text: 'OK' },
      ]);
    } catch (error) {
      console.error('Error copying bid link:', error);
      Alert.alert('Error', 'Failed to copy bid link.');
    }
  }

  static async generateQRCode(bidLinkData: BidLinkData): Promise<string> {
    // In a real app, you'd use a QR code library
    // For now, return the URL as the QR code data
    return bidLinkData.shareUrl;
  }

  static getBidStatusColor(status: string): string {
    switch (status) {
      case 'draft':
        return '#FFA726';
      case 'sent':
        return '#42A5F5';
      case 'viewed':
        return '#66BB6A';
      case 'accepted':
        return '#4CAF50';
      case 'rejected':
        return '#EF5350';
      default:
        return '#9E9E9E';
    }
  }

  static getBidStatusText(status: string): string {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'sent':
        return 'Sent';
      case 'viewed':
        return 'Viewed';
      case 'accepted':
        return 'Accepted';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Unknown';
    }
  }

  static formatCurrency(amount: number): string {
    return `$${amount.toLocaleString()}`;
  }

  static formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  static isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  }

  static getDaysUntilExpiry(expiresAt: string): number {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }
}

export default BidSharing;
