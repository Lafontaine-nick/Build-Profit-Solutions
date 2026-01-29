/**
 * Simple Leads Page - Complete Redesign
 * Clean, modern, and functional leads management
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  Animated,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Lead, LeadStage } from '../types';
import LeadsAnalytics from './LeadsAnalytics';

interface SimpleLeadsPageProps {
  leads: Lead[];
  onStageChange: (lead: Lead, newStage: LeadStage) => void;
  onLeadPress: (lead: Lead) => void;
  onAddNote?: (leadId: string, note: string) => void;
  onSetReminder?: (leadId: string, reminderDate: Date, reminderNote?: string) => void;
}

const STAGES: { key: LeadStage; label: string; color: string; icon: string }[] = [
  { key: 'new', label: 'New', color: '#3B82F6', icon: 'fiber-new' },
  { key: 'verified', label: 'Verified', color: '#10B981', icon: 'verified' },
  { key: 'qualified', label: 'Qualified', color: '#F59E0B', icon: 'star' },
  { key: 'proposal', label: 'Proposal', color: '#8B5CF6', icon: 'description' },
];

// Helper functions
const calculateLeadValue = (lead: Lead): number => {
  const budget = lead.project.budgetMax || lead.project.budgetMin || 0;
  return budget;
};

const getPriorityLevel = (lead: Lead): { level: string; color: string; icon: string } => {
  const score = lead.aiScore || 0;
  const value = calculateLeadValue(lead);
  
  if (score >= 80 && value >= 100000) return { level: 'Hot', color: '#EF4444', icon: 'local-fire-department' };
  if (score >= 70 && value >= 50000) return { level: 'High', color: '#F59E0B', icon: 'star' };
  if (score >= 50) return { level: 'Medium', color: '#3B82F6', icon: 'trending-up' };
  return { level: 'Low', color: '#6B7280', icon: 'snowflake' };
};

const getLeadTemperature = (lead: Lead): { temp: string; color: string; icon: string } => {
  const daysSinceCreated = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceCreated <= 1) return { temp: 'Hot', color: '#EF4444', icon: '🔥' };
  if (daysSinceCreated <= 3) return { temp: 'Warm', color: '#F59E0B', icon: '☀️' };
  return { temp: 'Cold', color: '#3B82F6', icon: '❄️' };
};

// Swipeable Lead Card Component
interface SwipeableLeadCardProps {
  lead: Lead;
  stage: any;
  priority: { level: string; color: string; icon: string };
  temperature: { temp: string; color: string; icon: string };
  leadValue: number;
  score: number;
  onPress: () => void;
  onCall: () => void;
  onEmail: () => void;
  onAdvance: () => void;
  onSnooze: () => void;
  onAddNote?: (note: string) => void;
  onSetReminder?: (reminderDate: Date, reminderNote?: string) => void;
}

const SwipeableLeadCard = ({
  lead,
  stage,
  priority,
  temperature,
  leadValue,
  score,
  onPress,
  onCall,
  onEmail,
  onAdvance,
  onSnooze,
  onAddNote,
  onSetReminder,
}: SwipeableLeadCardProps) => {
  const translateX = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(1)).current;
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [reminderNote, setReminderNote] = useState('');

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.oldState === State.ACTIVE) {
      const { translationX: tx } = nativeEvent;
      
      // Swipe right - advance stage
      if (tx > 100) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onAdvance();
        animateSwipeOut('right');
      }
      // Swipe left - snooze
      else if (tx < -100) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSnooze();
        animateSwipeOut('left');
      }
      // Return to center
      else {
        animateReturn();
      }
    }
  };

  const animateSwipeOut = (direction: 'left' | 'right') => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: direction === 'right' ? 400 : -400,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateReturn = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  };

  return (
    <>
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetX={[-10, 10]}
    >
      <Animated.View
        style={[
          styles.swipeableCard,
          {
            transform: [{ translateX }, { scale }],
          },
        ]}
      >
        {/* Swipe Action Backgrounds */}
        <View style={styles.swipeActions}>
          <View style={[styles.leftSwipeAction, { backgroundColor: '#1B365D' }]}>
            <MaterialIcons name="snooze" size={24} color="#fff" />
            <Text style={styles.swipeActionText}>Snooze</Text>
          </View>
          <View style={[styles.rightSwipeAction, { backgroundColor: '#1B365D' }]}>
            <MaterialIcons name="arrow-forward" size={24} color="#fff" />
            <Text style={styles.swipeActionText}>Advance</Text>
          </View>
        </View>

        <Pressable onPress={onPress} style={styles.leadCard}>
          {/* Header with Priority & Temperature */}
          <View style={styles.cardHeader}>
            <View style={styles.leadInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.leadName}>{lead.contact.name || 'New Lead'}</Text>
                <View style={styles.temperatureBadge}>
                  <Text style={styles.temperatureIcon}>{temperature.icon}</Text>
                </View>
              </View>
              {lead.contact.company && (
                <Text style={styles.companyName}>{lead.contact.company}</Text>
              )}
            </View>
            
            <View style={styles.cardBadges}>
              <View style={[styles.priorityBadge, { backgroundColor: priority.color }]}>
                <MaterialIcons name={priority.icon as any} size={12} color="#fff" />
                <Text style={styles.priorityText}>{priority.level}</Text>
              </View>
              <View style={[styles.stageBadge, { backgroundColor: stage?.color || '#666' }]}>
                <Text style={styles.stageBadgeText}>{stage?.label || 'New'}</Text>
              </View>
              <View style={[styles.scoreBadge, { backgroundColor: score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444' }]}>
                <Text style={styles.scoreText}>{score}</Text>
              </View>
            </View>
          </View>

          {/* Project Details with Value */}
          <View style={styles.projectDetails}>
            <Text style={styles.projectType}>
              {lead.project.type.charAt(0).toUpperCase() + lead.project.type.slice(1)}
            </Text>
            <View style={styles.valueContainer}>
              <Text style={styles.leadValue}>
                ${(leadValue / 1000).toFixed(0)}K
              </Text>
              <Text style={styles.budget}>
                ${lead.project.budgetMin?.toLocaleString() || '0'} - ${lead.project.budgetMax?.toLocaleString() || '0'}
              </Text>
            </View>
          </View>

          <View style={styles.locationDetails}>
            <Text style={styles.location}>
              {lead.location?.city}, {lead.location?.state}
            </Text>
            <Text style={styles.timeline}>
              {lead.project.timeline === 'urgent' ? '🔥 Urgent' :
               lead.project.timeline === 'soon' ? '⏰ Soon' :
               lead.project.timeline === 'flex' ? '📅 Flexible' : ''}
            </Text>
          </View>

          {/* Enhanced Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, !lead.contact.phone && styles.disabledButton]}
              onPress={onCall}
              disabled={!lead.contact.phone}
            >
              <MaterialIcons name="phone" size={14} color={lead.contact.phone ? "#10B981" : "#666"} />
              <Text style={[styles.actionText, !lead.contact.phone && styles.disabledText]}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, !lead.contact.email && styles.disabledButton]}
              onPress={onEmail}
              disabled={!lead.contact.email}
            >
              <MaterialIcons name="email" size={14} color={lead.contact.email ? "#3B82F6" : "#666"} />
              <Text style={[styles.actionText, !lead.contact.email && styles.disabledText]}>Email</Text>
            </TouchableOpacity>

            {onAddNote && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowNoteModal(true);
                }}
              >
                <MaterialIcons name="note-add" size={14} color="#FFA500" />
                <Text style={styles.actionText}>Note</Text>
              </TouchableOpacity>
            )}

            {onSetReminder && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowReminderModal(true);
                }}
              >
                <MaterialIcons name="alarm" size={14} color="#EC4899" />
                <Text style={styles.actionText}>Remind</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Swipe Hint */}
          <View style={styles.swipeHint}>
            <Text style={styles.hintText}>← Swipe to snooze or advance →</Text>
          </View>
        </Pressable>
      </Animated.View>
    </PanGestureHandler>

    {/* Note Modal */}
    <Modal
      visible={showNoteModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowNoteModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Quick Note</Text>
            <TouchableOpacity onPress={() => setShowNoteModal(false)}>
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.noteInput}
            placeholder="Type your note here..."
            placeholderTextColor="#9CA3AF"
            multiline
            value={noteText}
            onChangeText={setNoteText}
            autoFocus
          />
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => {
              if (noteText.trim() && onAddNote) {
                onAddNote(noteText);
                setNoteText('');
                setShowNoteModal(false);
              } else {
                Alert.alert('Empty Note', 'Please enter some text for the note.');
              }
            }}
          >
            <MaterialIcons name="save" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Save Note</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

    {/* Reminder Modal */}
    <Modal
      visible={showReminderModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowReminderModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Follow-up Reminder</Text>
            <TouchableOpacity onPress={() => setShowReminderModal(false)}>
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.reminderLabel}>Choose when to follow up:</Text>
          
          <View style={styles.reminderOptions}>
            <TouchableOpacity
              style={styles.reminderOption}
              onPress={() => {
                if (onSetReminder) {
                  const date = new Date();
                  date.setHours(date.getHours() + 2);
                  onSetReminder(date, reminderNote || undefined);
                  setReminderNote('');
                  setShowReminderModal(false);
                }
              }}
            >
              <MaterialIcons name="schedule" size={24} color="#3B82F6" />
              <Text style={styles.reminderOptionText}>In 2 Hours</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reminderOption}
              onPress={() => {
                if (onSetReminder) {
                  const date = new Date();
                  date.setDate(date.getDate() + 1);
                  onSetReminder(date, reminderNote || undefined);
                  setReminderNote('');
                  setShowReminderModal(false);
                }
              }}
            >
              <MaterialIcons name="today" size={24} color="#10B981" />
              <Text style={styles.reminderOptionText}>Tomorrow</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reminderOption}
              onPress={() => {
                if (onSetReminder) {
                  const date = new Date();
                  date.setDate(date.getDate() + 3);
                  onSetReminder(date, reminderNote || undefined);
                  setReminderNote('');
                  setShowReminderModal(false);
                }
              }}
            >
              <MaterialIcons name="event" size={24} color="#F59E0B" />
              <Text style={styles.reminderOptionText}>In 3 Days</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reminderOption}
              onPress={() => {
                if (onSetReminder) {
                  const date = new Date();
                  date.setDate(date.getDate() + 7);
                  onSetReminder(date, reminderNote || undefined);
                  setReminderNote('');
                  setShowReminderModal(false);
                }
              }}
            >
              <MaterialIcons name="date-range" size={24} color="#8B5CF6" />
              <Text style={styles.reminderOptionText}>In 1 Week</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.reminderNoteInput}
            placeholder="Optional reminder note..."
            placeholderTextColor="#9CA3AF"
            value={reminderNote}
            onChangeText={setReminderNote}
          />
        </View>
      </View>
    </Modal>
  </>
  );
};

export default function SimpleLeadsPage({ 
  leads, 
  onStageChange, 
  onLeadPress,
  onAddNote,
  onSetReminder,
}: SimpleLeadsPageProps) {
  const [selectedStage, setSelectedStage] = useState<LeadStage | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'value' | 'score' | 'name'>('date');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Filter and sort leads
  const filteredAndSortedLeads = React.useMemo(() => {
    // Filter
    const filtered = leads.filter(lead => {
      const matchesStage = selectedStage === 'all' || lead.stage === selectedStage;
      const matchesSearch = searchQuery === '' || 
        lead.contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.contact.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.location?.city?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesStage && matchesSearch;
    });

    // Sort
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'value':
          return calculateLeadValue(b) - calculateLeadValue(a);
        case 'score':
          return (b.aiScore || 0) - (a.aiScore || 0);
        case 'name':
          return (a.contact.name || '').localeCompare(b.contact.name || '');
        default:
          return 0;
      }
    });
  }, [leads, selectedStage, searchQuery, sortBy]);

  const handleCall = (phone: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert('No Phone', 'This lead does not have a phone number');
    }
  };

  const handleEmail = (email: string) => {
    if (email) {
      Linking.openURL(`mailto:${email}`);
    } else {
      Alert.alert('No Email', 'This lead does not have an email address');
    }
  };

  const handleStageChange = (lead: Lead) => {
    const currentIndex = STAGES.findIndex(stage => stage.key === lead.stage);
    const nextStage = STAGES[currentIndex + 1];
    
    if (nextStage) {
      onStageChange(lead, nextStage.key);
    }
  };

  const renderLeadCard = ({ item: lead }: { item: Lead }) => {
    const stage = STAGES.find(s => s.key === lead.stage);
    const score = lead.aiScore ?? 0;
    const priority = getPriorityLevel(lead);
    const temperature = getLeadTemperature(lead);
    const leadValue = calculateLeadValue(lead);
    
    return (
      <SwipeableLeadCard
        lead={lead}
        stage={stage}
        priority={priority}
        temperature={temperature}
        leadValue={leadValue}
        score={score}
        onPress={() => onLeadPress(lead)}
        onCall={() => handleCall(lead.contact.phone)}
        onEmail={() => handleEmail(lead.contact.email)}
        onAdvance={() => handleStageChange(lead)}
        onSnooze={() => {
          Alert.alert('Snooze Lead', 'Lead has been snoozed for 24 hours');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
        onAddNote={onAddNote ? (note) => onAddNote(lead.id, note) : undefined}
        onSetReminder={onSetReminder ? (date, note) => onSetReminder(lead.id, date, note) : undefined}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Leads</Text>
          <Text style={styles.subtitle}>{filteredAndSortedLeads.length} leads found</Text>
        </View>
        <TouchableOpacity 
          style={styles.sortButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowSortMenu(!showSortMenu);
          }}
        >
          <MaterialIcons name="sort" size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      {/* Analytics Bar */}
      <View style={styles.analyticsContainer}>
        <LeadsAnalytics leads={leads} />
      </View>

      {/* Sort Menu */}
      {showSortMenu && (
        <View style={styles.sortMenu}>
          {[
            { key: 'date', label: 'Date (Newest)', icon: 'access-time' },
            { key: 'value', label: 'Lead Value (Highest)', icon: 'attach-money' },
            { key: 'score', label: 'AI Score (Highest)', icon: 'star' },
            { key: 'name', label: 'Name (A-Z)', icon: 'sort-by-alpha' },
          ].map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.sortOption,
                sortBy === option.key && styles.activeSortOption,
              ]}
              onPress={() => {
                setSortBy(option.key as any);
                setShowSortMenu(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <MaterialIcons
                name={option.icon as any}
                size={20}
                color={sortBy === option.key ? '#3B82F6' : '#9CA3AF'}
              />
              <Text
                style={[
                  styles.sortOptionText,
                  sortBy === option.key && styles.activeSortOptionText,
                ]}
              >
                {option.label}
              </Text>
              {sortBy === option.key && (
                <MaterialIcons name="check" size={20} color="#3B82F6" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search leads..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialIcons name="close" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Stage Filter */}
      <View style={styles.stageFilter}>
        <TouchableOpacity
          style={[styles.stageTab, selectedStage === 'all' && styles.activeStageTab]}
          onPress={() => setSelectedStage('all')}
        >
          <Text style={[styles.stageTabText, selectedStage === 'all' && styles.activeStageTabText]}>
            All
          </Text>
        </TouchableOpacity>
        
        {STAGES.map((stage) => (
          <TouchableOpacity
            key={stage.key}
            style={[styles.stageTab, selectedStage === stage.key && styles.activeStageTab]}
            onPress={() => setSelectedStage(stage.key)}
          >
            <MaterialIcons 
              name={stage.icon as any} 
              size={16} 
              color={selectedStage === stage.key ? '#fff' : stage.color} 
            />
            <Text style={[styles.stageTabText, selectedStage === stage.key && styles.activeStageTabText]}>
              {stage.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Leads List */}
      <FlatList
        data={filteredAndSortedLeads}
        renderItem={renderLeadCard}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="person-search" size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No leads found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Try adjusting your search' : 'Add your first lead to get started'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  analyticsContainer: {
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  sortButton: {
    padding: 8,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sortMenu: {
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 8,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  activeSortOption: {
    backgroundColor: '#334155',
  },
  sortOptionText: {
    flex: 1,
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  activeSortOptionText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#fff',
  },
  stageFilter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  stageTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    gap: 4,
  },
  activeStageTab: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  stageTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  activeStageTabText: {
    color: '#fff',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  leadCard: {
    backgroundColor: '#1B365D',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  leadInfo: {
    flex: 1,
  },
  leadName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  companyName: {
    fontSize: 14,
    color: '#94A3B8',
  },
  cardBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  stageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stageBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  projectDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  projectType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  budget: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  locationDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  location: {
    fontSize: 13,
    color: '#94A3B8',
  },
  timeline: {
    fontSize: 13,
    color: '#F59E0B',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#334155',
    gap: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  // Enhanced Card Styles
  swipeableCard: {
    marginBottom: 12,
    position: 'relative',
  },
  swipeActions: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 0,
  },
  leftSwipeAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1B365D',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  rightSwipeAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1B365D',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  temperatureBadge: {
    marginLeft: 8,
  },
  temperatureIcon: {
    fontSize: 16,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 2,
  },
  priorityText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leadValue: {
    fontSize: 18,
    color: '#10B981',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#1F2937',
  },
  disabledText: {
    color: '#6B7280',
  },
  swipeHint: {
    marginTop: 8,
    alignItems: 'center',
  },
  hintText: {
    color: '#6B7280',
    fontSize: 10,
    fontStyle: 'italic',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
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
  noteInput: {
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#475569',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reminderLabel: {
    fontSize: 16,
    color: '#E2E8F0',
    marginBottom: 16,
    fontWeight: '500',
  },
  reminderOptions: {
    gap: 12,
    marginBottom: 16,
  },
  reminderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#475569',
  },
  reminderOptionText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  reminderNoteInput: {
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#475569',
  },
});
