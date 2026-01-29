import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || 'http://192.168.0.201:3001/api';

type TradeType = 'Framing' | 'HVAC' | 'Plumbing' | 'Electrical' | 'Stucco' | 'Drywall' | 'Painting' | 'Flooring' | 'Roofing' | 'Other';
const TRADES: TradeType[] = ['Framing', 'HVAC', 'Plumbing', 'Electrical', 'Stucco', 'Drywall', 'Painting', 'Flooring', 'Roofing', 'Other'];

interface Contractor {
  id: string;
  name: string;
  trade: string;
  rating: number;
  completedJobs: number;
  distance?: string;
}

interface BidInvitationButtonProps {
  projectTitle: string;
  projectLocation: string;
  projectValue: number;
  onlyShowForLargeProjects?: boolean; // Only show button for projects > $75k
}

export default function BidInvitationButton({ projectTitle, projectLocation, projectValue }: BidInvitationButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<TradeType | ''>('');
  const [selectedContractors, setSelectedContractors] = useState<string[]>([]);
  const [availableContractors, setAvailableContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [bidDeadline, setBidDeadline] = useState(projectValue >= 100000 ? '14' : '7'); // Longer deadline for larger projects
  const [requireInsurance, setRequireInsurance] = useState(true);
  const [requireBond, setRequireBond] = useState(projectValue >= 100000); // Auto-require bond for $100k+ projects

  // Get appropriate subtitle based on project value
  const getButtonSubtitle = () => {
    if (projectValue >= 500000) return 'Major project • Premium contractors only';
    if (projectValue >= 100000) return 'Send direct bid invitations • Bonding required';
    return 'Send direct bid invitations to trusted partners';
  };

  // Mock contractors - filtered for LARGE COMMERCIAL projects
  // In production, fetch contractors with: experience > 10 years, completedJobs > 50, rating > 4.5
  const mockContractors: Contractor[] = [
    { id: 'contractor-demo', name: 'Premier Framing Corp', trade: 'Framing', rating: 4.8, completedJobs: 340, distance: '15.3' },
    { id: 'contractor-004', name: 'Elite Commercial Framers', trade: 'Framing', rating: 4.9, completedJobs: 520, distance: '8.2' },
    { id: 'contractor-002', name: 'Metro HVAC Systems', trade: 'HVAC', rating: 4.7, completedJobs: 280, distance: '22.1' },
    { id: 'contractor-003', name: 'Premier Electrical Solutions', trade: 'Electrical', rating: 4.9, completedJobs: 410, distance: '12.5' },
  ];

  const handleTradeSelect = (trade: TradeType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTrade(trade);
    // Filter contractors by trade
    const filtered = mockContractors.filter(c => c.trade === trade);
    setAvailableContractors(filtered);
  };

  const toggleContractor = (contractorId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedContractors(prev =>
      prev.includes(contractorId)
        ? prev.filter(id => id !== contractorId)
        : [...prev, contractorId]
    );
  };

  const handleSendInvitations = async () => {
    if (!selectedTrade) {
      Alert.alert('Select Trade', 'Please select a trade type.');
      return;
    }

    if (selectedContractors.length === 0) {
      Alert.alert('Select Contractors', 'Please select at least one contractor.');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const [city, state] = projectLocation.split(', ');

      const response = await fetch(`${API_BASE_URL}/bid-invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          title: `${selectedTrade} for ${String(projectTitle || 'Project')}`,
          trade: selectedTrade,
          projectId: `PRJ-${Date.now()}`,
          contact: {
            name: 'Demo GC',
            email: 'gc@example.com',
            phone: '555-123-4567',
            company: 'Demo Construction',
          },
          location: { city, state },
          project: {
            type: 'other',
            budgetMin: Math.floor(projectValue * 0.15),
            budgetMax: Math.floor(projectValue * 0.25),
            timeline: 'Normal',
          },
          description: `Direct invitation for ${selectedTrade} work on ${String(projectTitle || 'Project')}`,
          createdBy: 'contractor-demo',
          contractorIds: selectedContractors,
          message: message || 'We would love to work with you on this project.',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send invitations');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        '🎉 Invitations Sent!',
        `Sent ${selectedContractors.length} bid invitation${selectedContractors.length > 1 ? 's' : ''} for ${String(selectedTrade || 'work')}!\n\nContractors will see this in their "Invites" tab.`,
        [{ text: 'OK', onPress: () => {
          setShowModal(false);
          setSelectedTrade('');
          setSelectedContractors([]);
          setMessage('');
        }}]
      );

    } catch (error) {
      console.error('Error sending invitations:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to send invitations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Trigger Button - Prominent Full-Width */}
      <TouchableOpacity
        style={styles.inviteButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setShowModal(true);
        }}
      >
        <View style={styles.inviteButtonContent}>
          <View style={styles.inviteButtonLeft}>
            <MaterialIcons name="campaign" size={24} color="#F59E0B" />
            <View>
              <Text style={styles.inviteButtonTitle}>Invite Premium Contractors</Text>
              <Text style={styles.inviteButtonSubtitle}>{getButtonSubtitle()}</Text>
            </View>
          </View>
          <MaterialIcons name="arrow-forward" size={24} color="#F59E0B" />
        </View>
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={showModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <LinearGradient
          colors={['#0A1A3A', '#0F7158']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.modalContainer}
        >
          {/* Back Arrow */}
          <TouchableOpacity
            onPress={() => setShowModal(false)}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Send Bid Invitations</Text>
            <Text style={styles.headerSubtitle}>{String(projectTitle || 'Project')}</Text>
            <View style={styles.premiumBadge}>
              <MaterialIcons name="verified" size={16} color="#F59E0B" />
              <Text style={styles.premiumText}>Premium Contractors • Commercial Grade</Text>
            </View>
          </View>

            {/* Trade Selection */}
            <View style={styles.section}>
              <Text style={styles.label}>Select Trade *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {TRADES.map((trade) => (
                  <TouchableOpacity
                    key={trade}
                    style={[styles.tradeChip, selectedTrade === trade && styles.tradeChipActive]}
                    onPress={() => handleTradeSelect(trade)}
                  >
                    <Text style={[styles.tradeChipText, selectedTrade === trade && styles.tradeChipTextActive]}>
                      {trade}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Contractor Selection */}
            {selectedTrade && (
              <View style={styles.section}>
                <Text style={styles.label}>
                  Select Contractors * ({selectedContractors.length} selected)
                </Text>
                {availableContractors.length > 0 ? (
                  availableContractors.map((contractor) => (
                    <TouchableOpacity
                      key={contractor.id}
                      style={[
                        styles.contractorCard,
                        selectedContractors.includes(contractor.id) && styles.contractorCardSelected,
                      ]}
                      onPress={() => toggleContractor(contractor.id)}
                    >
                      <View style={styles.contractorInfo}>
                        <View style={styles.contractorNameRow}>
                          <Text style={styles.contractorName}>{contractor.name}</Text>
                          <View style={styles.verifiedBadge}>
                            <MaterialIcons name="verified" size={12} color="#10B981" />
                            <Text style={styles.verifiedText}>Licensed</Text>
                          </View>
                        </View>
                        <View style={styles.contractorMeta}>
                          <MaterialIcons name="star" size={14} color="#F59E0B" />
                          <Text style={styles.contractorMetaText}>{contractor.rating} rating</Text>
                          <Text style={styles.contractorMetaText}> • </Text>
                          <Text style={styles.contractorMetaText}>{contractor.completedJobs}+ projects</Text>
                          <Text style={styles.contractorMetaText}> • </Text>
                          <Text style={styles.contractorMetaText}>{contractor.distance} mi</Text>
                        </View>
                      </View>
                      {selectedContractors.includes(contractor.id) && (
                        <MaterialIcons name="check-circle" size={24} color="#10B981" />
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No contractors found for {String(selectedTrade || 'this trade')}</Text>
                )}
              </View>
            )}

          {/* Bid Requirements (Commercial-specific) */}
          <View style={styles.section}>
            <Text style={styles.label}>Bid Deadline</Text>
            <View style={styles.deadlineContainer}>
              {['3', '7', '14', '30'].map((days) => (
                <TouchableOpacity
                  key={days}
                  style={[styles.deadlineChip, bidDeadline === days && styles.deadlineChipActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setBidDeadline(days);
                  }}
                >
                  <Text style={[styles.deadlineText, bidDeadline === days && styles.deadlineTextActive]}>
                    {days} days
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Insurance & Bonding Requirements */}
          <View style={styles.section}>
            <Text style={styles.label}>Requirements</Text>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setRequireInsurance(!requireInsurance);
              }}
            >
              <MaterialIcons 
                name={requireInsurance ? "check-box" : "check-box-outline-blank"} 
                size={24} 
                color={requireInsurance ? "#10B981" : "#6B7280"} 
              />
              <Text style={styles.checkboxText}>Proof of Insurance Required</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setRequireBond(!requireBond);
              }}
            >
              <MaterialIcons 
                name={requireBond ? "check-box" : "check-box-outline-blank"} 
                size={24} 
                color={requireBond ? "#10B981" : "#6B7280"} 
              />
              <Text style={styles.checkboxText}>Performance Bond Required</Text>
              {projectValue > 100000 && (
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedText}>Recommended</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Personal Message */}
          <View style={styles.section}>
            <Text style={styles.label}>Invitation Message (Optional)</Text>
            <TextInput
              style={styles.textArea}
              placeholder="e.g., We're looking for a premium contractor for this flagship project..."
              placeholderTextColor="#6B7280"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

            {/* Send Button */}
            <TouchableOpacity
              style={[styles.sendButton, loading && styles.sendButtonDisabled]}
              onPress={handleSendInvitations}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#0d2745" />
              ) : (
                <>
                  <MaterialIcons name="send" size={20} color="#0d2745" />
                  <Text style={styles.sendButtonText}>Send Invitations</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </LinearGradient>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  inviteButton: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  inviteButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  inviteButtonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: 2,
  },
  inviteButtonSubtitle: {
    fontSize: 12,
    color: '#D97706',
  },
  modalContainer: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(67, 206, 162, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  scrollContent: {
    paddingTop: 120,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e9f1ff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 6,
  },
  premiumText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e9f1ff',
    marginBottom: 12,
  },
  tradeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
  },
  tradeChipActive: {
    backgroundColor: '#3B82F6',
  },
  tradeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D1D5DB',
  },
  tradeChipTextActive: {
    color: '#fff',
  },
  contractorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  contractorCardSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  contractorInfo: {
    flex: 1,
  },
  contractorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  contractorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e9f1ff',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10B981',
  },
  contractorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contractorMetaText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  deadlineContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  deadlineChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
  },
  deadlineChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  deadlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D1D5DB',
  },
  deadlineTextActive: {
    color: '#fff',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  checkboxText: {
    fontSize: 15,
    color: '#e9f1ff',
    flex: 1,
  },
  recommendedBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recommendedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F59E0B',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
  },
  textArea: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#e9f1ff',
    minHeight: 100,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38d39f',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0d2745',
  },
});

