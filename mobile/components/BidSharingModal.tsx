import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import BidSharing, { BidData, BidLinkData } from '../services/bidSharing';

interface BidSharingModalProps {
  visible: boolean;
  onClose: () => void;
  bidData: BidData | null;
  bidLinkData: BidLinkData | null;
  onGenerateLink: () => void;
  onShareLink: () => void;
  onCopyLink: () => void;
}

export default function BidSharingModal({
  visible,
  onClose,
  bidData,
  bidLinkData,
  onGenerateLink,
  onShareLink,
  onCopyLink,
}: BidSharingModalProps) {
  if (!bidData) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType='slide'
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📤 Share Bid with Client</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name='close' size={24} color='#fff' />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Bid Summary */}
            <View style={styles.bidSummary}>
              <Text style={styles.bidTitle}>{bidData.projectName}</Text>
              <Text style={styles.bidAmount}>
                ${bidData.bidPrice.toLocaleString()}
              </Text>
              <Text style={styles.bidDetails}>
                Timeline: {bidData.timeline} • Client: {bidData.clientName}
              </Text>
            </View>

            {/* Bid Link Actions */}
            {!bidLinkData ? (
              <View style={styles.generateSection}>
                <Text style={styles.sectionTitle}>Generate Bid Link</Text>
                <Text style={styles.sectionDescription}>
                  Create a professional bid link that your client can view and
                  accept online.
                </Text>
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={onGenerateLink}
                >
                  <MaterialIcons name='link' size={20} color='#fff' />
                  <Text style={styles.generateButtonText}>
                    Generate Bid Link
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.linkSection}>
                <Text style={styles.sectionTitle}>Bid Link Ready!</Text>

                {/* Link Details */}
                <View style={styles.linkDetails}>
                  <Text style={styles.linkLabel}>Share URL:</Text>
                  <Text style={styles.linkUrl}>{bidLinkData.shareUrl}</Text>

                  <Text style={styles.linkLabel}>Short Code:</Text>
                  <Text style={styles.shortCode}>{bidLinkData.shortCode}</Text>

                  <Text style={styles.linkLabel}>Expires:</Text>
                  <Text style={styles.expiryDate}>
                    {BidSharing.formatDate(bidLinkData.expiresAt)}
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={onShareLink}
                  >
                    <MaterialIcons name='share' size={20} color='#fff' />
                    <Text style={styles.buttonText}>Share Link</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={onCopyLink}
                  >
                    <MaterialIcons name='content-copy' size={20} color='#fff' />
                    <Text style={styles.buttonText}>Copy Link</Text>
                  </TouchableOpacity>
                </View>

                {/* QR Code Placeholder */}
                <View style={styles.qrSection}>
                  <Text style={styles.qrTitle}>QR Code</Text>
                  <View style={styles.qrPlaceholder}>
                    <MaterialIcons name='qr-code' size={60} color='#43cea2' />
                    <Text style={styles.qrText}>Scan to view bid</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Features */}
            <View style={styles.featuresSection}>
              <Text style={styles.featuresTitle}>What your client gets:</Text>
              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <MaterialIcons
                    name='check-circle'
                    size={16}
                    color='#4caf50'
                  />
                  <Text style={styles.featureText}>
                    Professional bid presentation
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons
                    name='check-circle'
                    size={16}
                    color='#4caf50'
                  />
                  <Text style={styles.featureText}>
                    Detailed cost breakdown
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons
                    name='check-circle'
                    size={16}
                    color='#4caf50'
                  />
                  <Text style={styles.featureText}>One-click acceptance</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons
                    name='check-circle'
                    size={16}
                    color='#4caf50'
                  />
                  <Text style={styles.featureText}>Secure payment options</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#142850',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  bidSummary: {
    backgroundColor: '#1B365D',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  bidTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  bidAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#43cea2',
    marginBottom: 4,
  },
  bidDetails: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
  },
  generateSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 16,
    lineHeight: 20,
  },
  generateButton: {
    backgroundColor: '#43cea2',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  linkSection: {
    marginBottom: 20,
  },
  linkDetails: {
    backgroundColor: '#1B365D',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  linkLabel: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 4,
  },
  linkUrl: {
    fontSize: 14,
    color: '#43cea2',
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  shortCode: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 12,
  },
  expiryDate: {
    fontSize: 14,
    color: '#aaa',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#43cea2',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButton: {
    flex: 1,
    backgroundColor: '#1976d2',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  qrPlaceholder: {
    backgroundColor: '#1B365D',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  qrText: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 8,
  },
  featuresSection: {
    marginTop: 20,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  featureList: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    color: '#aaa',
    marginLeft: 8,
  },
});
