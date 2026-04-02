import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { leadService, Lead } from '../services/leadService';

interface LeadDetailsProps {
  leadId: string;
  onClose: () => void;
}

interface LeadDetail {
  id: string;
  lead: Lead;
  jobScope: {
    title: string;
    description: string;
    requirements: string[];
    propertyType: string;
    squareFootage: number;
    rooms: string[];
    specialFeatures: string[];
  };
  aiNotes: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
    insights: string[];
    recommendations: string[];
    riskFactors: string[];
    urgency: 'high' | 'medium' | 'low';
  };
  contact: {
    name: string;
    email: string;
    phone: string;
    address: string;
    preferredContact: 'phone' | 'email' | 'text';
    availability: string;
  };
  timeline: {
    urgency: 'asap' | 'within_week' | 'within_month' | 'planning_ahead';
    description: string;
    startDate: string;
    completionDate: string;
  };
  budget: {
    min: number;
    max: number;
    currency: string;
    flexibility: 'fixed' | 'flexible' | 'negotiable';
  };
  status: 'new' | 'contacted' | 'qualified' | 'proposal-sent' | 'won' | 'lost';
  messages: Message[];
  files: File[];
}

interface Message {
  id: string;
  sender: 'contractor' | 'lead';
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'file';
}

interface File {
  id: string;
  name: string;
  type: 'image' | 'document' | 'sketch';
  url: string;
  uploadedAt: string;
}

const LeadDetails: React.FC<LeadDetailsProps> = ({ leadId, onClose }) => {
  const { darkMode } = useTheme();
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'scope' | 'ai' | 'chat' | 'files'
  >('overview');

  // Define colors based on theme
  const backgroundColor = darkMode ? '#14213D' : '#E0E0E0';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#B0B0B0' : '#666666';
  const borderColor = darkMode ? '#2A3F5F' : '#CCCCCC';
  const cardColor = darkMode ? '#1B2A4A' : '#F5F5F5';
  const accentColor = '#1B365D';

  useEffect(() => {
    loadLeadDetails();
  }, [leadId]);

  const loadLeadDetails = async () => {
    try {
      setLoading(true);
      // Mock data for demonstration
      const mockLeadDetail: LeadDetail = {
        id: leadId,
        lead: {
          id: leadId,
          name: 'John Smith',
          email: 'john.smith@email.com',
          phone: '(555) 123-4567',
          projectType: 'residential',
          budget: { min: 15000, max: 25000 },
          requirements:
            'Complete kitchen renovation with new cabinets and countertops',
          leadGrade: 'A',
          aiScore: 92,
          status: 'contacted',
          createdAt: new Date().toISOString(),
        },
        jobScope: {
          title: 'Kitchen Remodel',
          description:
            'Complete kitchen renovation including new cabinets, countertops, appliances, and flooring. The client wants a modern, open-concept design with high-end finishes.',
          requirements: [
            'New custom cabinets (white shaker style)',
            'Quartz countertops with waterfall edge',
            'Stainless steel appliances (refrigerator, range, dishwasher)',
            'Hardwood flooring throughout kitchen',
            'New lighting fixtures and electrical work',
            'Plumbing updates for new sink and dishwasher',
            'Backsplash installation (subway tile)',
            'Paint walls and trim',
          ],
          propertyType: 'Single-family home',
          squareFootage: 1800,
          rooms: ['Kitchen', 'Dining area', 'Pantry'],
          specialFeatures: [
            'Island with seating',
            'Walk-in pantry',
            'Wine fridge space',
          ],
        },
        aiNotes: {
          score: 92,
          grade: 'A',
          insights: [
            'High-value project with premium budget',
            'Client has financing approved',
            'Clear project requirements and timeline',
            'Property is well-maintained',
            'Client is responsive and engaged',
          ],
          recommendations: [
            'Send detailed proposal within 24 hours',
            'Include 3D renderings if possible',
            'Highlight premium materials and finishes',
            'Offer financing options',
            'Schedule site visit within 48 hours',
          ],
          riskFactors: [
            'Premium budget may attract competition',
            'Client expects high-end quality',
            'Timeline is somewhat aggressive',
          ],
          urgency: 'high',
        },
        contact: {
          name: 'John Smith',
          email: 'john.smith@email.com',
          phone: '(555) 123-4567',
          address: '123 Main St, Henderson, NV 89002',
          preferredContact: 'phone',
          availability: 'Weekdays 9AM-5PM, Weekends by appointment',
        },
        timeline: {
          urgency: 'asap',
          description: 'Within 2 weeks',
          startDate: '2024-02-15',
          completionDate: '2024-04-15',
        },
        budget: {
          min: 15000,
          max: 25000,
          currency: 'USD',
          flexibility: 'flexible',
        },
        status: 'contacted',
        messages: [
          {
            id: '1',
            sender: 'lead',
            content:
              "Hi, I'm looking for a contractor to remodel my kitchen. I have a budget of $15-25K and need it done within 2 months.",
            timestamp: '2024-01-15T10:00:00Z',
            type: 'text',
          },
          {
            id: '2',
            sender: 'contractor',
            content:
              "Hi John! Thanks for reaching out. I'd love to help with your kitchen remodel. Can I schedule a site visit this week?",
            timestamp: '2024-01-15T10:30:00Z',
            type: 'text',
          },
          {
            id: '3',
            sender: 'lead',
            content:
              "That would be great! I'm available Tuesday or Thursday afternoon. What time works for you?",
            timestamp: '2024-01-15T11:00:00Z',
            type: 'text',
          },
        ],
        files: [
          {
            id: '1',
            name: 'kitchen-layout.jpg',
            type: 'image',
            url: 'https://example.com/kitchen-layout.jpg',
            uploadedAt: '2024-01-15T09:00:00Z',
          },
          {
            id: '2',
            name: 'inspiration-photos.pdf',
            type: 'document',
            url: 'https://example.com/inspiration-photos.pdf',
            uploadedAt: '2024-01-15T09:30:00Z',
          },
        ],
      };
      setLeadDetail(mockLeadDetail);
    } catch (error) {
      console.error('Error loading lead details:', error);
      Alert.alert('Error', 'Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: LeadDetail['status']) => {
    if (!leadDetail) return;

    setLoading(true);
    try {
      // Mock API call to update status
      await new Promise(resolve => setTimeout(resolve, 1000));

      setLeadDetail({ ...leadDetail, status: newStatus });
      Alert.alert('Status Updated', `Lead status changed to ${newStatus}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !leadDetail) return;

    setLoading(true);
    try {
      const message: Message = {
        id: Date.now().toString(),
        sender: 'contractor',
        content: newMessage,
        timestamp: new Date().toISOString(),
        type: 'text',
      };

      setLeadDetail({
        ...leadDetail,
        messages: [...leadDetail.messages, message],
      });

      setNewMessage('');
      Alert.alert('Message Sent', 'Message has been sent to the lead');
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return '#4CAF50';
      case 'B':
        return '#8BC34A';
      case 'C':
        return '#FFC107';
      case 'D':
        return '#FF9800';
      case 'E':
        return '#F44336';
      case 'F':
        return '#D32F2F';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return '#2196F3';
      case 'contacted':
        return '#FF9800';
      case 'qualified':
        return '#9C27B0';
      case 'proposal-sent':
        return '#673AB7';
      case 'won':
        return '#4CAF50';
      case 'lost':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return '#F44336';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#4CAF50';
      default:
        return '#9E9E9E';
    }
  };

  const formatBudget = (budget: {
    min: number;
    max: number;
    currency: string;
  }) => {
    const formatAmount = (amount: number) => {
      if (amount >= 1000) {
        return `$${(amount / 1000).toFixed(0)}K`;
      }
      return `$${amount.toLocaleString()}`;
    };
    return `${formatAmount(budget.min)}–${formatAmount(budget.max)}`;
  };

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent}>
      {leadDetail && (
        <>
          {/* Lead Header */}
          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <View style={styles.leadHeader}>
              <View style={styles.leadInfo}>
                <Text style={[styles.leadName, { color: textColor }]}>
                  {leadDetail.contact.name}
                </Text>
                <Text
                  style={[styles.leadProject, { color: textSecondaryColor }]}
                >
                  {leadDetail.jobScope.title} -{' '}
                  {leadDetail.contact.address.split(',')[1]?.trim()}
                </Text>
              </View>
              <View style={styles.leadScores}>
                <View
                  style={[
                    styles.gradeBadge,
                    {
                      backgroundColor: getGradeColor(leadDetail.aiNotes.grade),
                    },
                  ]}
                >
                  <Text style={styles.gradeText}>
                    {leadDetail.aiNotes.grade}
                  </Text>
                </View>
                <Text
                  style={[styles.aiScoreText, { color: textSecondaryColor }]}
                >
                  {leadDetail.aiNotes.score} AI
                </Text>
              </View>
            </View>
          </View>

          {/* Status Management */}
          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Lead Status
            </Text>
            <View style={styles.statusButtons}>
              {[
                'new',
                'contacted',
                'qualified',
                'proposal-sent',
                'won',
                'lost',
              ].map(status => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusButton,
                    { backgroundColor: cardColor, borderColor },
                    leadDetail.status === status && {
                      backgroundColor: getStatusColor(status),
                    },
                  ]}
                  onPress={() => handleStatusChange(status as any)}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      {
                        color:
                          leadDetail.status === status ? 'white' : textColor,
                      },
                    ]}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Contact Information */}
          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Contact Information
            </Text>
            <View style={styles.contactInfo}>
              <View style={styles.contactRow}>
                <MaterialIcons
                  name='person'
                  size={16}
                  color={textSecondaryColor}
                />
                <Text style={[styles.contactText, { color: textColor }]}>
                  {leadDetail.contact.name}
                </Text>
              </View>
              <View style={styles.contactRow}>
                <MaterialIcons
                  name='email'
                  size={16}
                  color={textSecondaryColor}
                />
                <Text style={[styles.contactText, { color: textColor }]}>
                  {leadDetail.contact.email}
                </Text>
              </View>
              <View style={styles.contactRow}>
                <MaterialIcons
                  name='phone'
                  size={16}
                  color={textSecondaryColor}
                />
                <Text style={[styles.contactText, { color: textColor }]}>
                  {leadDetail.contact.phone}
                </Text>
              </View>
              <View style={styles.contactRow}>
                <MaterialIcons
                  name='location-on'
                  size={16}
                  color={textSecondaryColor}
                />
                <Text style={[styles.contactText, { color: textColor }]}>
                  {leadDetail.contact.address}
                </Text>
              </View>
              <View style={styles.contactRow}>
                <MaterialIcons
                  name='schedule'
                  size={16}
                  color={textSecondaryColor}
                />
                <Text style={[styles.contactText, { color: textColor }]}>
                  {leadDetail.contact.availability}
                </Text>
              </View>
            </View>
          </View>

          {/* Project Summary */}
          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Project Summary
            </Text>
            <View style={styles.projectSummary}>
              <View style={styles.summaryRow}>
                <Text
                  style={[styles.summaryLabel, { color: textSecondaryColor }]}
                >
                  Budget:
                </Text>
                <Text style={[styles.summaryValue, { color: textColor }]}>
                  {formatBudget(leadDetail.budget)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text
                  style={[styles.summaryLabel, { color: textSecondaryColor }]}
                >
                  Timeline:
                </Text>
                <Text style={[styles.summaryValue, { color: textColor }]}>
                  {leadDetail.timeline.description}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text
                  style={[styles.summaryLabel, { color: textSecondaryColor }]}
                >
                  Property Type:
                </Text>
                <Text style={[styles.summaryValue, { color: textColor }]}>
                  {leadDetail.jobScope.propertyType}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text
                  style={[styles.summaryLabel, { color: textSecondaryColor }]}
                >
                  Square Footage:
                </Text>
                <Text style={[styles.summaryValue, { color: textColor }]}>
                  {leadDetail.jobScope.squareFootage} sq ft
                </Text>
              </View>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderScopeTab = () => (
    <ScrollView style={styles.tabContent}>
      {leadDetail && (
        <>
          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Job Description
            </Text>
            <Text style={[styles.descriptionText, { color: textColor }]}>
              {leadDetail.jobScope.description}
            </Text>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Requirements
            </Text>
            {leadDetail.jobScope.requirements.map((requirement, index) => (
              <View key={index} style={styles.requirementItem}>
                <MaterialIcons name='check-circle' size={16} color='#4CAF50' />
                <Text style={[styles.requirementText, { color: textColor }]}>
                  {requirement}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Rooms
            </Text>
            <View style={styles.roomsList}>
              {leadDetail.jobScope.rooms.map((room, index) => (
                <View
                  key={index}
                  style={[
                    styles.roomChip,
                    { backgroundColor: backgroundColor },
                  ]}
                >
                  <Text style={[styles.roomText, { color: textColor }]}>
                    {room}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Special Features
            </Text>
            <View style={styles.featuresList}>
              {leadDetail.jobScope.specialFeatures.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <MaterialIcons name='star' size={16} color='#FFC107' />
                  <Text style={[styles.featureText, { color: textColor }]}>
                    {feature}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderAITab = () => (
    <ScrollView style={styles.tabContent}>
      {leadDetail && (
        <>
          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              AI Analysis
            </Text>
            <View style={styles.aiScore}>
              <View
                style={[
                  styles.scoreCircle,
                  { backgroundColor: getGradeColor(leadDetail.aiNotes.grade) },
                ]}
              >
                <Text style={styles.scoreText}>{leadDetail.aiNotes.score}</Text>
              </View>
              <View style={styles.scoreInfo}>
                <Text style={[styles.gradeText, { color: textColor }]}>
                  Grade: {leadDetail.aiNotes.grade}
                </Text>
                <Text
                  style={[
                    styles.urgencyText,
                    { color: getUrgencyColor(leadDetail.aiNotes.urgency) },
                  ]}
                >
                  Urgency: {leadDetail.aiNotes.urgency.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Key Insights
            </Text>
            {leadDetail.aiNotes.insights.map((insight, index) => (
              <View key={index} style={styles.insightItem}>
                <MaterialIcons name='lightbulb' size={16} color='#FFC107' />
                <Text style={[styles.insightText, { color: textColor }]}>
                  {insight}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Recommendations
            </Text>
            {leadDetail.aiNotes.recommendations.map((recommendation, index) => (
              <View key={index} style={styles.recommendationItem}>
                <MaterialIcons name='trending-up' size={16} color='#4CAF50' />
                <Text style={[styles.recommendationText, { color: textColor }]}>
                  {recommendation}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Risk Factors
            </Text>
            {leadDetail.aiNotes.riskFactors.map((risk, index) => (
              <View key={index} style={styles.riskItem}>
                <MaterialIcons name='warning' size={16} color='#F44336' />
                <Text style={[styles.riskText, { color: textColor }]}>
                  {risk}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderChatTab = () => (
    <View style={styles.tabContent}>
      {leadDetail && (
        <>
          <ScrollView style={styles.chatMessages}>
            {leadDetail.messages.map(message => (
              <View
                key={message.id}
                style={[
                  styles.messageContainer,
                  message.sender === 'contractor'
                    ? styles.contractorMessage
                    : styles.leadMessage,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    {
                      backgroundColor:
                        message.sender === 'contractor'
                          ? accentColor
                          : cardColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      {
                        color:
                          message.sender === 'contractor' ? 'white' : textColor,
                      },
                    ]}
                  >
                    {message.content}
                  </Text>
                  <Text
                    style={[
                      styles.messageTime,
                      {
                        color:
                          message.sender === 'contractor'
                            ? 'rgba(255,255,255,0.7)'
                            : textSecondaryColor,
                      },
                    ]}
                  >
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View
            style={[
              styles.chatInput,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <TextInput
              style={[
                styles.messageInput,
                { backgroundColor: backgroundColor, color: textColor },
              ]}
              placeholder='Type a message...'
              placeholderTextColor={textSecondaryColor}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: accentColor }]}
              onPress={handleSendMessage}
              disabled={loading || !newMessage.trim()}
            >
              <MaterialIcons name='send' size={20} color='white' />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  const renderFilesTab = () => (
    <ScrollView style={styles.tabContent}>
      {leadDetail && (
        <>
          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Project Files
            </Text>
            {leadDetail.files.map(file => (
              <TouchableOpacity
                key={file.id}
                style={[
                  styles.fileItem,
                  { backgroundColor: backgroundColor, borderColor },
                ]}
                onPress={() => Alert.alert('File', `Opening ${file.name}`)}
              >
                <MaterialIcons
                  name={
                    file.type === 'image'
                      ? 'image'
                      : file.type === 'document'
                        ? 'description'
                        : 'brush'
                  }
                  size={24}
                  color={textSecondaryColor}
                />
                <View style={styles.fileInfo}>
                  <Text style={[styles.fileName, { color: textColor }]}>
                    {file.name}
                  </Text>
                  <Text
                    style={[styles.fileDate, { color: textSecondaryColor }]}
                  >
                    {new Date(file.uploadedAt).toLocaleDateString()}
                  </Text>
                </View>
                <MaterialIcons name='download' size={20} color={accentColor} />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: textColor }]}>
            Loading lead details...
          </Text>
        </View>
      </View>
    );
  }

  if (!leadDetail) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: textColor }]}>
            Lead not found
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View
        style={[styles.header, { backgroundColor: cardColor, borderColor }]}
      >
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <MaterialIcons name='close' size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>
          Lead Details
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: accentColor }]}
            onPress={() => setShowChat(true)}
          >
            <MaterialIcons name='chat' size={20} color='white' />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Navigation */}
      <View
        style={[styles.tabBar, { backgroundColor: cardColor, borderColor }]}
      >
        {[
          { key: 'overview', label: 'Overview', icon: 'dashboard' },
          { key: 'scope', label: 'Scope', icon: 'work' },
          { key: 'ai', label: 'AI Notes', icon: 'psychology' },
          { key: 'chat', label: 'Chat', icon: 'chat' },
          { key: 'files', label: 'Files', icon: 'folder' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabButton,
              { backgroundColor: backgroundColor, borderColor },
              activeTab === tab.key && { backgroundColor: accentColor },
            ]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <MaterialIcons
              name={tab.icon as any}
              size={16}
              color={activeTab === tab.key ? 'white' : textColor}
            />
            <Text
              style={[
                styles.tabButtonText,
                { color: activeTab === tab.key ? 'white' : textColor },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'scope' && renderScopeTab()}
      {activeTab === 'ai' && renderAITab()}
      {activeTab === 'chat' && renderChatTab()}
      {activeTab === 'files' && renderFilesTab()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  section: {
    padding: 22,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.3)",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leadInfo: {
    flex: 1,
  },
  leadName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  leadProject: {
    fontSize: 14,
  },
  leadScores: {
    alignItems: 'center',
  },
  gradeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  gradeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  aiScoreText: {
    fontSize: 12,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  contactInfo: {
    gap: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactText: {
    fontSize: 14,
  },
  projectSummary: {
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  requirementText: {
    fontSize: 14,
    flex: 1,
  },
  roomsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roomChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roomText: {
    fontSize: 12,
    fontWeight: '600',
  },
  featuresList: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
  },
  aiScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  scoreInfo: {
    flex: 1,
  },
  urgencyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  insightText: {
    fontSize: 14,
    flex: 1,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  recommendationText: {
    fontSize: 14,
    flex: 1,
  },
  riskItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  riskText: {
    fontSize: 14,
    flex: 1,
  },
  chatMessages: {
    flex: 1,
    padding: 20,
  },
  messageContainer: {
    marginBottom: 12,
  },
  contractorMessage: {
    alignItems: 'flex-end',
  },
  leadMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
  },
  messageText: {
    fontSize: 14,
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 12,
  },
  chatInput: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 40,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  fileDate: {
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
  },
});

export default LeadDetails;
