/**
 * Lead Detail Modal Component
 * Comprehensive view of lead information with all details and actions
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Dimensions,
  Share,
  Clipboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Lead, LeadStage } from '../types';
import { buildBidPayloadFromLead } from '../leadToEstimateBid';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProjectList } from '../../../contexts/ProjectListContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { KEYBOARD_SCROLL_DEFAULTS } from '@/constants/keyboardScrollProps';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import { SubWebFormOptionalChrome } from '@/components/SubWebFormOptionalChrome';

interface LeadDetailModalProps {
  visible: boolean;
  lead: Lead | null;
  onClose: () => void;
  onAddNote?: (leadId: string, note: string) => void;
  onAddTask?: (leadId: string, task: string) => void;
  onToggleTask?: (leadId: string, taskId: string, completed: boolean) => void;
  onDeleteTask?: (leadId: string, taskId: string) => void;
  onSetReminder?: (leadId: string, reminderDate: Date, reminderNote: string) => void;
  onStageChange?: (leadIdOrLead: string | Lead, newStage: string) => void; // Supports both (leadId: string) and (lead: Lead) for flexibility
  onDelete?: (leadId: string) => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Module-level variable to lock header position
let leadDetailHeaderTop: number | null = null;

export default function LeadDetailModal({
  visible,
  lead,
  onClose,
  onAddNote,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onSetReminder,
  onStageChange,
  onDelete,
}: LeadDetailModalProps) {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  const [engagement, setEngagement] = useState(lead?.engagement);
  const [bidTotal, setBidTotal] = useState<number | null>(null);
  const [hasActiveBid, setHasActiveBid] = useState(false);
  const { activeProjects, estimates } = useProjectList();
  
  // Load and update engagement data when modal opens
  useEffect(() => {
    if (visible && lead) {
      const loadEngagement = async () => {
        const { getLeadEngagement, trackLeadView } = await import('../../../services/engagementTracking');
        await trackLeadView(lead.id);
        const engagementData = await getLeadEngagement(lead.id);
        if (engagementData) {
          setEngagement(engagementData);
        }
      };
      loadEngagement();
    }
  }, [visible, lead?.id]);

  // Load and calculate bid total for this lead
  useEffect(() => {
    if (!visible || !lead) {
      setBidTotal(null);
      setHasActiveBid(false);
      return;
    }

    const loadAndCalculateBidTotal = async () => {
      try {
        const BID_STORAGE_KEY = 'bps.currentBid.v2';
        const savedBid = await AsyncStorage.getItem(BID_STORAGE_KEY);
        
        if (!savedBid) {
          setBidTotal(null);
          setHasActiveBid(false);
          return;
        }

        const bid = JSON.parse(savedBid);
        
        // Debug logging
        console.log('🔍 ===== CHECKING BID FOR LEAD =====');
        console.log('🔍 Lead Info:', {
          leadId: lead.id,
          leadName: lead.contact?.name,
          leadTitle: lead.title
        });
        console.log('🔍 Bid Info:', {
          bidId: bid.id,
          bidTitle: bid.title,
          bidLeadId: bid.leadId,
          bidLeadSource: bid.leadSource,
          customerName: bid.customerName || bid.clientName,
          grandTotal: bid.grandTotal,
          calculatedTotal: bid.calculatedTotal,
          total: bid.total
        });
        
        // Check if this bid is associated with the current lead
        // Also check if bid.id contains the lead.id (since bid ID format is `bid-${leadId}-${timestamp}`)
        // Also check by customer/contact name as a fallback
        const nameMatch = (bid.customerName || bid.clientName)?.toLowerCase() === lead.contact?.name?.toLowerCase();
        const leadIdMatch = bid.leadId === lead.id && bid.leadSource === 'qualified_lead';
        const bidIdMatch = bid.id && bid.id.startsWith(`bid-${lead.id}-`);
        const isBidForThisLead = leadIdMatch || bidIdMatch || (nameMatch && bid.leadSource === 'qualified_lead');
        
        console.log('🔍 Bid Match Details:', {
          leadIdMatch: leadIdMatch,
          bidIdMatch: bidIdMatch,
          nameMatch: nameMatch,
          nameMatchValue: (bid.customerName || bid.clientName)?.toLowerCase(),
          leadNameValue: lead.contact?.name?.toLowerCase(),
          isBidForThisLead: isBidForThisLead
        });
        console.log('🔍 ===== END BID CHECK =====');
        
        if (isBidForThisLead) {
          setHasActiveBid(true);
          console.log('✅ Found active bid for lead:', lead.id);
          
          // If bid has stored calculated total, use it first (persists even when modal closes)
          if (bid.calculatedTotal && bid.calculatedTotal > 0) {
            setBidTotal(bid.calculatedTotal);
            // Still calculate in background to update if needed, but don't block on it
          }
          
          // Load materials and rental carts
          const materialsCartStr = await AsyncStorage.getItem('bps.materialsCart');
          const rentalCartStr = await AsyncStorage.getItem('bps.rentalCart');
          
          const materialsCart = materialsCartStr ? JSON.parse(materialsCartStr) : [];
          const rentalCart = rentalCartStr ? JSON.parse(rentalCartStr) : [];
          
          // Calculate materials total
          // First try from materialsCart, then fall back to bid.materialLineItems if cart is empty
          let materials = materialsCart.reduce((sum: number, r: any) => sum + (r.total || 0), 0);
          console.log('💰 Materials from cart:', materials, 'cart length:', materialsCart.length);
          if (materials === 0 && bid.materialLineItems && bid.materialLineItems.length > 0) {
            // Fall back to materialLineItems if cart is empty
            console.log('💰 Falling back to materialLineItems, count:', bid.materialLineItems.length);
            materials = bid.materialLineItems.reduce((sum: number, item: any) => {
              const itemValue = Number(item.materials) || Number(item.total) || 0;
              console.log('💰 Material line item:', { materials: item.materials, total: item.total, calculated: itemValue });
              return sum + itemValue;
            }, 0);
            console.log('💰 Materials from line items:', materials);
          }
          
          // Calculate labor from line items
          const labor = bid.laborLineItems?.reduce((sum: number, item: any) => {
            const itemTotal = Number(item.total) || 0;
            if (itemTotal > 0) {
              console.log('💰 Labor line item:', { description: item.description, total: item.total, calculated: itemTotal });
            }
            return sum + itemTotal;
          }, 0) || 0;
          console.log('💰 Total labor:', labor, 'from', bid.laborLineItems?.length || 0, 'items');
          
          const permitCosts = (bid.planCost || 0) + (bid.permitCost || 0);
          const equipmentRental = Number(bid.equipment) || 0;
          const otherDirectCost = Number(bid.otherDirectCost) || 0;
          
          // Markup base (matches Estimate Generator)
          const subtotal = materials + labor + permitCosts + equipmentRental + otherDirectCost;
          
          // Calculate contingency (if included in total)
          const contingency = Math.round((subtotal * (bid.contingencyPct || 0)) / 100);
          
          // Calculate profit
          const profit = (subtotal * (bid.markupPct || 0)) / 100;
          
          // Calculate total - NOTE: The bid builder shows total = subtotal + profit
          // but some displays might include contingency. Using same formula as bid builder.
          const total = Math.round(subtotal + profit);
          
          // Store the calculated total back in the bid object for persistence
          if (total > 0) {
            bid.calculatedTotal = total;
            // Save updated bid with total (non-blocking)
            AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(bid)).catch(err => 
              console.warn('Could not save calculated total:', err)
            );
          }
          
          // Check if bid has a stored grandTotal from the bid builder (most accurate)
          // This would be set when the bid is auto-saved with calculated totals
          const storedGrandTotal = bid.grandTotal || bid.total || bid.bidPrice;
          
          // Use stored total if available and current calculation is 0, otherwise use calculated
          // Priority: grandTotal > calculatedTotal > calculated total
          let finalTotal = 0;
          if (storedGrandTotal && storedGrandTotal > 0) {
            finalTotal = storedGrandTotal;
          } else if (total > 0) {
            finalTotal = total;
          } else if (bid.calculatedTotal && bid.calculatedTotal > 0) {
            finalTotal = bid.calculatedTotal;
          }
          
          // Always log for debugging
          console.log('💰 Quote Amount Calculation:', {
            leadId: lead.id,
            leadName: lead.contact?.name,
            calculated: total,
            storedGrandTotal: storedGrandTotal,
            storedCalculatedTotal: bid.calculatedTotal,
            final: finalTotal,
            fromMaterials: materials,
            fromLabor: labor,
            fromOverhead: overhead,
            materialsCartLength: materialsCart.length,
            rentalCartLength: rentalCart.length,
            laborLineItemsLength: bid.laborLineItems?.length || 0,
            markupPct: bid.markupPct
          });
          
          // Always set bidTotal when there's an active bid, even if it's $0
          // This shows $0 instead of falling back to budget range
          setBidTotal(finalTotal);
        } else {
          setHasActiveBid(false);
          setBidTotal(null);
        }
      } catch (error) {
        console.error('Error loading bid total:', error);
        setBidTotal(null);
        setHasActiveBid(false);
      }
    };

    loadAndCalculateBidTotal();

    // Set up polling to check for updates every 500ms (half a second) for responsive live updates
    const intervalId = setInterval(loadAndCalculateBidTotal, 500);

    return () => {
      clearInterval(intervalId);
    };
  }, [visible, lead?.id]);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showTaskInput, setShowTaskInput] = useState(false);
  const [taskText, setTaskText] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'communication'>('overview');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [localTasks, setLocalTasks] = useState(lead?.tasks || []);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  // Refs for keyboard handling
  const scrollViewRef = useRef<ScrollView>(null);
  const noteInputRef = useRef<TextInput>(null);

  // Update local tasks when lead tasks change
  useEffect(() => {
    if (lead?.tasks) {
      console.log('📊 Updating local tasks from lead prop');
      setLocalTasks(lead.tasks);
    }
  }, [lead?.tasks]);

  // Debug: Log when lead or tasks change
  useEffect(() => {
    if (lead) {
      console.log('📊 LeadDetailModal received lead:', {
        id: lead.id,
        name: lead.contact.name,
        taskCount: lead.tasks?.length || 0,
        localTaskCount: localTasks.length,
        tasks: lead.tasks?.map(t => ({ text: t.text, completed: t.completed, id: t.id }))
      });
    }
  }, [lead, localTasks]);

  if (!lead) return null;

  const isWeb = Platform.OS === 'web';
  const headerRule = darkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0,0,0,0.06)';
  const webColumn860 = isWeb
    ? ({ width: '100%' as const, maxWidth: 860, alignSelf: 'center' as const })
    : undefined;
  const leadDetailSubtitle = lead.isOwnRequest
    ? 'Your request'
    : lead.contact?.name || 'New Lead';

  const leadValue = Math.round((lead.project.budgetMin + lead.project.budgetMax) / 2);
  const timeAgo = getTimeAgo(lead.createdAt);
  const temperature = getTemperature(lead);

  const handleCall = async () => {
    if (lead.contact.phone) {
      Linking.openURL(`tel:${lead.contact.phone}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Track engagement
      const { trackLeadResponse } = await import('../../../services/engagementTracking');
      await trackLeadResponse(lead.id, 'call', lead.createdAt);
      
      // Automatically mark as "contacted" if still in "new" stage
      if (lead.stage === 'new' && onStageChange) {
        console.log(`📞 Call clicked - updating lead ${lead.id} from 'new' to 'contacted'`);
        onStageChange(lead as Lead, 'contacted');
      }
    } else {
      Alert.alert('No Phone', 'This lead does not have a phone number');
    }
  };

  const handleEmail = async () => {
    if (lead.contact.email) {
      Linking.openURL(`mailto:${lead.contact.email}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Track engagement
      const { trackLeadResponse } = await import('../../../services/engagementTracking');
      await trackLeadResponse(lead.id, 'email', lead.createdAt);
      
      // Automatically mark as "contacted" if not already contacted or beyond
      // Only update if in 'new' stage (to avoid overwriting later stages)
      if (lead.stage === 'new' && onStageChange) {
        console.log(`📧 Email clicked - updating lead ${lead.id} from 'new' to 'contacted'`);
        try {
          onStageChange(lead as Lead, 'contacted');
          console.log(`✅ Stage change callback called for lead ${lead.id}`);
        } catch (error) {
          console.error('❌ Error updating stage after email:', error);
        }
      } else if (lead.stage !== 'new') {
        console.log(`📧 Email clicked - lead ${lead.id} is already in '${lead.stage}' stage, not updating`);
      } else if (!onStageChange) {
        console.warn('⚠️ Email clicked but onStageChange callback not available');
      }
    } else {
      Alert.alert('No Email', 'This lead does not have an email address');
    }
  };

  const handleText = async () => {
    if (lead.contact.phone) {
      Linking.openURL(`sms:${lead.contact.phone}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Track engagement (text tracking not supported, only call/email)
      // const { trackLeadResponse } = await import('../../../services/engagementTracking');
      // await trackLeadResponse(lead.id, 'text', lead.createdAt);
      
      // Automatically mark as "contacted" if still in "new" stage
      if (lead.stage === 'new' && onStageChange) {
        console.log(`💬 Text clicked - updating lead ${lead.id} from 'new' to 'contacted'`);
        onStageChange(lead as Lead, 'contacted');
      }
    } else {
      Alert.alert('No Phone', 'This lead does not have a phone number for texting');
    }
  };

  const handleAddNote = () => {
    if (noteText.trim() && onAddNote) {
      onAddNote(lead.id, noteText.trim());
      setNoteText('');
      setShowNoteInput(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (!noteText.trim()) {
      Alert.alert('Empty Note', 'Please enter a note before saving.');
    }
  };

  const handleAddTask = () => {
    if (taskText.trim() && onAddTask) {
      onAddTask(lead.id, taskText.trim());
      setTaskText('');
      setShowTaskInput(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (!taskText.trim()) {
      Alert.alert('Empty Task', 'Please enter a task before saving.');
    }
  };

  const handleDeleteTask = (taskId: string) => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Update local state
            setLocalTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
            // Call callback if provided
            if (onDeleteTask) {
              onDeleteTask(lead.id, taskId);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleSetReminder = () => {
    if (onSetReminder) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      onSetReminder(lead.id, tomorrow, 'Follow up on this lead');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleQualify = () => {
    if (onStageChange && lead.stage === 'contacted') {
      console.log(`✅ Qualifying lead ${lead.id} from contacted to qualified`);
      // onStageChange can accept either (leadId: string) or (lead: Lead)
      // Pass the lead object directly for better type safety
      onStageChange(lead as Lead, 'qualified');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      console.warn(`⚠️ Cannot qualify lead: onStageChange=${!!onStageChange}, currentStage=${lead.stage}`);
    }
  };

  const handleLostBid = async () => {
    if (!lead || !onStageChange) return;
    
    Alert.alert(
      'Mark as Lost',
      'Are you sure you want to mark this bid as lost? This will update the lead stage and analytics.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Lost',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log(`❌ Marking lead ${lead.id} as lost`);
              
              // Track that bid was lost
              const { trackBidLost } = await import('../../../services/engagementTracking');
              await trackBidLost(lead.id);
              
              // Update lead stage to 'lost'
              onStageChange(lead as Lead, 'lost');
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              
              Alert.alert(
                'Bid Marked as Lost',
                'The lead has been updated. This helps improve your win rate calculations.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Error marking bid as lost:', error);
              Alert.alert('Error', 'Failed to mark bid as lost. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSendProposal = async () => {
    if (!lead) return;
    
    // If lead is won, navigate to the project instead
    if (lead.stage === 'won') {
      // Find the project that matches this lead
      const allProjects = [...activeProjects, ...estimates];
      // Look for project with matching leadId in estimateData
      const matchingProject = allProjects.find(p => {
        const estimateData = (p as any).estimateData;
        return estimateData && estimateData.leadId === lead.id;
      });
      
      if (matchingProject) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onClose();
        router.push(`/project-detail/${matchingProject.id}`);
        return;
      } else {
        Alert.alert(
          'Project Not Found',
          'The project for this lead could not be found. Please check the Projects tab.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    
    // If lead is not qualified, still allow opening bid builder but show a message
    if (lead.stage !== 'qualified') {
      Alert.alert(
        'Open Bid Builder?',
        'This lead is not yet qualified. Would you like to open the Bid Builder anyway to start working on a quote?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Bid Builder', 
            onPress: () => handleSendProposalInternal()
          }
        ]
      );
      return;
    }
    
    await handleSendProposalInternal();
  };

  const handleSendProposalInternal = async () => {
    if (!lead) return;
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Track that bid builder has been started for this lead
      const { trackBidStarted, getLeadEngagement } = await import('../../../services/engagementTracking');
      await trackBidStarted(lead.id);
      
      // Reload engagement data immediately to update quote status
      const updatedEngagement = await getLeadEngagement(lead.id);
      if (updatedEngagement) {
        setEngagement(updatedEngagement);
      }
      
      const bidData = buildBidPayloadFromLead(lead);
      
      // Clear materials and rentals from AsyncStorage before saving new bid
      await AsyncStorage.setItem('bps.materialsCart', JSON.stringify([]));
      await AsyncStorage.setItem('bps.rentalCart', JSON.stringify([]));
      console.log(`🧹 Cleared materials and rentals for new proposal`);
      
      // Save bid data to AsyncStorage (estimate generator will load this)
      await AsyncStorage.setItem('bps.currentBid.v2', JSON.stringify(bidData));
      console.log(`📝 Saved proposal data for lead ${lead.id} to estimate generator`);
      
      // Close the modal
      onClose();
      
      // Navigate to estimate generator tab
      router.push('/(tabs)/estimate-generator');
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error preparing proposal:', error);
      Alert.alert('Error', 'Failed to open proposal builder. Please try again.');
    }
  };

  const getNextStageLabel = () => {
    const nextStage = getNextStage(lead.stage);
    if (nextStage === lead.stage) return 'Final Stage';
    // Labels based on CURRENT stage (what action button should say)
    // When in 'new' stage, button says 'Contact' (moves to 'contacted')
    // When in 'contacted' stage, button says 'Qualify' (moves to 'qualified')
    const stageLabels: { [key: string]: string } = {
      'new': 'Contact',
      'contacted': 'Qualify',
      'qualified': 'Send Proposal',
      'proposal': 'Mark Won',
      'won': 'Final Stage'
    };
    // Return label for the current stage (the action you're taking from this stage)
    return stageLabels[lead.stage] || 'Advance';
  };

  const handleDelete = () => {
    const title = 'Delete Lead';
    const message = 'This lead will be permanently removed.';

    const executeDelete = () => {
      if (onDelete) {
        onDelete(lead.id);
        onClose();
      }
    };

    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function'
    ) {
      const ok = window.confirm(`${title}\n\n${message}`);
      if (ok) executeDelete();
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: executeDelete,
      },
    ]);
  };

  const handleShare = async () => {
    try {
      const shareContent = {
        message: `Lead: ${lead.contact.name || 'New Lead'}\nCompany: ${lead.contact.company || 'N/A'}\nProject: ${lead.trade}\nBudget: $${lead.project.budgetMin.toLocaleString()} - $${lead.project.budgetMax.toLocaleString()}\nTimeline: ${lead.project.timeline}\nLocation: ${lead.location.city}, ${lead.location.state}`,
        title: 'Lead Information',
      };
      await Share.share(shareContent);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error sharing lead:', error);
    }
  };

  const handleCopyContact = async () => {
    const contactInfo = `Name: ${lead.contact.name || 'N/A'}\nCompany: ${lead.contact.company || 'N/A'}\nPhone: ${lead.contact.phone || 'N/A'}\nEmail: ${lead.contact.email || 'N/A'}`;
    await Clipboard.setString(contactInfo);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', 'Contact information copied to clipboard');
  };

  const handleCopyProject = async () => {
    const projectInfo = `Project: ${lead.trade}\nBudget: $${lead.project.budgetMin.toLocaleString()} - $${lead.project.budgetMax.toLocaleString()}\nTimeline: ${lead.project.timeline}\nLocation: ${lead.location.city}, ${lead.location.state}\nDescription: ${lead.description || 'N/A'}`;
    await Clipboard.setString(projectInfo);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', 'Project information copied to clipboard');
  };

  // Lock header position on first render
  if (leadDetailHeaderTop === null && visible) {
    leadDetailHeaderTop = Math.max(insets.top, 0);
  }
  const headerTop = leadDetailHeaderTop !== null ? leadDetailHeaderTop : Math.max(insets.top || 0, 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View 
        style={[styles.container, { backgroundColor: darkMode ? '#000000' : Colors.bg }]}
      >
        <SafeAreaView edges={[]} style={styles.container}>
          <StatusBar barStyle="light-content" translucent={false} />
          
          <KeyboardAvoidingView 
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.content}
              showsVerticalScrollIndicator={false}
              {...KEYBOARD_SCROLL_DEFAULTS}
              contentContainerStyle={
                isWeb
                  ? {
                      paddingTop: Math.max(insets.top, 8),
                      paddingBottom: insets.bottom + 100,
                      paddingHorizontal: 32,
                      flexGrow: 1,
                      width: '100%',
                      maxWidth: 1040,
                      alignSelf: 'center',
                    }
                  : [
                      styles.scrollContent,
                      {
                        paddingTop: Math.max(insets.top, 0) + 20,
                        paddingHorizontal: 20,
                        paddingBottom: insets.bottom + 100,
                      },
                    ]
              }
            >
              {/* Header — Find Subcontractors layout (web row / native centered) */}
              {isWeb ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 24,
                    paddingTop: 24,
                    paddingBottom: 18,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: headerRule,
                  }}
                >
                  <View style={{ width: 52, alignItems: 'flex-start', marginRight: 4 }}>
                    <LinearGradient
                      colors={BRAND_FRAME_GRADIENT_COLORS}
                      start={{ x: 0.05, y: 0.15 }}
                      end={{ x: 0.95, y: 0.85 }}
                      style={styles.backButtonBorder}
                    >
                      <GradientRingBackInner
                        darkMode={darkMode}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          onClose();
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: 19,
                          backgroundColor: darkMode ? '#000000' : Colors.bg,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <MaterialIcons name="arrow-back" size={24} color={darkMode ? '#FFFFFF' : Colors.text} />
                      </GradientRingBackInner>
                    </LinearGradient>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        color: darkMode ? '#FFFFFF' : Colors.text,
                        fontSize: 26,
                        fontWeight: '800',
                        letterSpacing: -0.4,
                      }}
                    >
                      Lead Details
                    </Text>
                    <Text
                      style={{
                        color: darkMode ? 'rgba(226, 232, 240, 0.72)' : Colors.sub,
                        fontSize: 14,
                        marginTop: 4,
                        fontWeight: '500',
                      }}
                    >
                      {leadDetailSubtitle}
                    </Text>
                  </View>
                </View>
              ) : (
                <View
                  style={{
                    paddingHorizontal: 22,
                    paddingTop: 0,
                    paddingBottom: 14,
                    marginBottom: 12,
                    marginHorizontal: -20,
                    backgroundColor: darkMode ? '#000000' : Colors.bg,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(0,0,0,0.06)',
                  }}
                >
                  <View
                    style={[
                      { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                      webColumn860,
                    ]}
                  >
                    <View style={{ width: 52, alignItems: 'flex-start' }}>
                      <LinearGradient
                        colors={BRAND_FRAME_GRADIENT_COLORS}
                        start={{ x: 0.05, y: 0.15 }}
                        end={{ x: 0.95, y: 0.85 }}
                        style={styles.backButtonBorder}
                      >
                        <GradientRingBackInner
                          darkMode={darkMode}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onClose();
                          }}
                          style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: 19,
                            backgroundColor: darkMode ? '#000000' : Colors.bg,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <MaterialIcons
                            name="arrow-back"
                            size={24}
                            color={darkMode ? '#FFFFFF' : Colors.text}
                          />
                        </GradientRingBackInner>
                      </LinearGradient>
                    </View>

                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
                      <Text
                        style={{
                          color: darkMode ? '#FFFFFF' : '#000000',
                          fontSize: 23,
                          fontWeight: '700',
                          letterSpacing: -0.3,
                          textAlign: 'center',
                        }}
                      >
                        Lead Details
                      </Text>
                      <Text
                        style={{
                          color: darkMode ? 'rgba(226, 232, 240, 0.72)' : Colors.sub,
                          fontSize: 13,
                          marginTop: 5,
                          lineHeight: 18,
                          fontWeight: '500',
                          textAlign: 'center',
                        }}
                      >
                        {leadDetailSubtitle}
                      </Text>
                    </View>

                    <View style={{ width: 52 }} />
                  </View>
                </View>
              )}
              
              {/* Tab Navigation — same pill bar as project detail (Duplex Build) */}
              <View style={[styles.wideContainer, isWeb && styles.wideContainerWeb]}>
                {darkMode ? (
                  <View style={[styles.segmentContainer, styles.segmentTrackDark]}>
                    <View style={[styles.segmentInner, isWeb && styles.segmentInnerWeb]}>
                      <SegmentTab
                        label="Overview"
                        icon="grid-outline"
                        isActive={activeTab === 'overview'}
                        darkMode={darkMode}
                        Colors={Colors}
                        onPress={() => {
                          setActiveTab('overview');
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      />
                      <SegmentTab
                        label="Analytics"
                        icon="bar-chart-outline"
                        isActive={activeTab === 'analytics'}
                        darkMode={darkMode}
                        Colors={Colors}
                        onPress={() => {
                          setActiveTab('analytics');
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      />
                      <SegmentTab
                        label="Communication"
                        icon="chatbubble-outline"
                        isActive={activeTab === 'communication'}
                        darkMode={darkMode}
                        Colors={Colors}
                        onPress={() => {
                          setActiveTab('communication');
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      />
                    </View>
                  </View>
                ) : (
                  <BlurView
                    intensity={28}
                    tint="light"
                    style={[styles.segmentContainer, { backgroundColor: Colors.surface2 }]}
                  >
                    <View style={[styles.segmentInner, isWeb && styles.segmentInnerWeb]}>
                      <SegmentTab
                        label="Overview"
                        icon="grid-outline"
                        isActive={activeTab === 'overview'}
                        darkMode={darkMode}
                        Colors={Colors}
                        onPress={() => {
                          setActiveTab('overview');
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      />
                      <SegmentTab
                        label="Analytics"
                        icon="bar-chart-outline"
                        isActive={activeTab === 'analytics'}
                        darkMode={darkMode}
                        Colors={Colors}
                        onPress={() => {
                          setActiveTab('analytics');
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      />
                      <SegmentTab
                        label="Communication"
                        icon="chatbubble-outline"
                        isActive={activeTab === 'communication'}
                        darkMode={darkMode}
                        Colors={Colors}
                        onPress={() => {
                          setActiveTab('communication');
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      />
                    </View>
                  </BlurView>
                )}
              </View>
          {/* Tab Content */}
          {activeTab === 'overview' && (
            <>
              {/* Wrapped in Gradient Border - Hero through Tasks */}
              <View style={[styles.wideContainer, isWeb && styles.wideContainerWeb]}>
                <SubWebFormOptionalChrome isWeb={isWeb} darkMode={darkMode} Colors={Colors} columnStyle={webColumn860}>
                    {/* Hero Section - Redesigned */}
                    <View style={[styles.section, styles.sectionInGradient]}>
                      <View style={styles.heroSection}>
                        <View style={styles.heroTitleRow}>
                          <View style={styles.heroTitleContainer}>
                            <Text style={[styles.heroTitle, !darkMode && { color: Colors.text }]}>
                              {lead.contact.name || 'New Lead'}
                            </Text>
                            <View
                              style={[
                                styles.heroTradeChip,
                                !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line },
                              ]}
                            >
                              <Text
                                style={[styles.heroTradeChipText, !darkMode && { color: Colors.text }]}
                              >
                                {lead.trade}
                              </Text>
                            </View>
                          </View>
                          <View style={[styles.heroTimelinePill, { backgroundColor: temperature.color }]}>
                            <Text style={styles.heroTimelineText}>{lead.project.timeline}</Text>
                          </View>
                        </View>
                        
                        <View style={styles.heroBudgetRow}>
                          <Text style={[styles.heroBudget, !darkMode && { color: Colors.text }]}>
                            ${lead.project.budgetMin.toLocaleString()} – ${lead.project.budgetMax.toLocaleString()}
                          </Text>
                          <Text style={[styles.heroMeta, !darkMode && { color: Colors.sub, opacity: 1 }]}>
                            Avg: ${leadValue.toLocaleString()} · {lead.location.city}, {lead.location.state}
                          </Text>
                        </View>
                      </View>
                      
                      {/* Lead Health Indicator */}
                      <View style={styles.leadHealthIndicator}>
                        <Text style={[styles.leadHealthLabel, !darkMode && { color: Colors.sub }]}>Lead Health: </Text>
                        <Text style={[styles.leadHealthValue, { color: getLeadHealthColor(lead) }]}>
                          {getLeadHealthStatus(lead)}
                        </Text>
                      </View>
                    </View>

                    {/* Key Stats Row - Compressed iOS Style */}
                    <View style={[styles.section, styles.sectionInGradient, { marginTop: 24 }]}>
                      <View style={styles.compressedStatsRow}>
                        <View style={styles.compressedMetadataContainer}>
                          {lead.project.timeline === 'Urgent' && (
                            <>
                              <Text style={[styles.compressedMetadataLine, { color: getTimelineColor(lead.project.timeline) }]}>
                                {lead.project.timeline}
                              </Text>
                              <Text style={styles.compressedMetadataSeparator}> • </Text>
                            </>
                          )}
                          <Text style={[styles.compressedMetadataLine, !darkMode && { color: Colors.sub }]}>
                            AI Estimate
                          </Text>
                          <Text style={[styles.compressedMetadataSeparator, !darkMode && { color: Colors.sub }]}> • </Text>
                          <Text style={[styles.compressedMetadataLine, !darkMode && { color: Colors.sub }]}>
                            ${Math.round(lead.project.budgetMin / 1000)}K–${Math.round(lead.project.budgetMax / 1000)}K
                          </Text>
                        </View>
                      </View>
                      
                      {/* More Details - Collapsible */}
                      <TouchableOpacity 
                        style={styles.moreDetailsButton}
                        onPress={() => {
                          setShowMoreDetails(!showMoreDetails);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <Text style={[styles.moreDetailsText, !darkMode && { color: Colors.sub }]}>
                          {showMoreDetails ? 'Hide project details' : 'Show project details'}
                        </Text>
                        <MaterialIcons 
                          name={showMoreDetails ? 'expand-less' : 'expand-more'} 
                          size={20} 
                          color="#F3F4F6" 
                        />
                      </TouchableOpacity>
                      
                      {showMoreDetails && (
                        <View style={styles.moreDetailsContent}>
                          {/* System Metadata - Low Value */}
                          {(lead.projectId || lead.location.zip || lead.isOwnRequest || lead.matchedContractors !== undefined) && (
                            <>
                              <Text style={[styles.systemMetadataLabel, !darkMode && { color: Colors.sub, opacity: 1 }]}>System Details</Text>
                              {lead.projectId && (
                                <View style={styles.moreDetailRow}>
                                  <Text style={[styles.moreDetailLabel, !darkMode && { color: Colors.sub }]}>Project ID</Text>
                                  <Text style={[styles.moreDetailValue, !darkMode && { color: Colors.text }]}>{lead.projectId}</Text>
                                </View>
                              )}
                              <View style={styles.moreDetailRow}>
                                <Text style={[styles.moreDetailLabel, !darkMode && { color: Colors.sub, opacity: 1 }]}>Created</Text>
                                <Text style={[styles.moreDetailValue, !darkMode && { color: Colors.sub }]}>
                                  {new Date(lead.createdAt).toLocaleDateString()}
                                </Text>
                              </View>
                              {lead.location.zip && (
                                <View style={styles.moreDetailRow}>
                                  <Text style={[styles.moreDetailLabel, !darkMode && { color: Colors.sub, opacity: 1 }]}>Zip Code</Text>
                                  <Text style={[styles.moreDetailValue, !darkMode && { color: Colors.sub }]}>
                                    {lead.location.zip}
                                  </Text>
                                </View>
                              )}
                              {lead.isOwnRequest && (
                                <View style={styles.moreDetailRow}>
                                  <Text style={[styles.moreDetailLabel, !darkMode && { color: Colors.sub }]}>Own Request</Text>
                                  <Text style={[styles.moreDetailValue, !darkMode && { color: Colors.text }]}>Yes</Text>
                                </View>
                              )}
                              {lead.matchedContractors !== undefined && (
                                <View style={styles.moreDetailRow}>
                                  <Text style={[styles.moreDetailLabel, !darkMode && { color: Colors.sub }]}>Matched Contractors</Text>
                                  <Text style={[styles.moreDetailValue, !darkMode && { color: Colors.text }]}>
                                    {lead.matchedContractors}
                                  </Text>
                                </View>
                              )}
                            </>
                          )}
                        </View>
                      )}
                    </View>

                    {/* Project Description - Bullet Style */}
                    {lead.description && (() => {
                      const parsed = parseDescription(lead.description);
                      const bulletItems: string[] = [];
                      
                      if (parsed.scope && parsed.scope.length > 0) {
                        bulletItems.push(...parsed.scope);
                      }
                      if (parsed.propertyType && parsed.propertyType.length > 0) {
                        bulletItems.push(...parsed.propertyType);
                      }
                      if (parsed.availability) {
                        bulletItems.push(`Availability: ${parsed.availability}`);
                      }
                      
                      // If no structured data, use description as fallback
                      if (bulletItems.length === 0 && lead.description) {
                        // Split description into lines for bullet format
                        const lines = lead.description.split(/[\.\n]/).filter(line => line.trim().length > 0);
                        bulletItems.push(...lines.slice(0, 4)); // Limit to 4 lines
                      }
                      
                      return bulletItems.length > 0 ? (
                        <View style={[styles.section, styles.sectionInGradient, { marginTop: 24 }]}>
                          <Text style={[styles.sectionTitle, !darkMode && { color: Colors.text }]}>Project Description</Text>
                          <View style={styles.bulletDescription}>
                            {bulletItems.map((item, idx) => (
                              <View key={idx} style={styles.bulletItem}>
                                <Text style={styles.bulletDot}>•</Text>
                                <Text style={[styles.bulletText, !darkMode && { color: Colors.sub }]}>
                                  {item.trim()}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null;
                    })()}

                    {/* Tasks Section - Enhanced */}
                    <View style={[styles.section, styles.sectionInGradient, { marginTop: 24 }]}>
                      <Text style={[styles.sectionTitle, !darkMode && { color: Colors.text }]}>Tasks</Text>
                      
                      {/* Task List - Show existing tasks prominently */}
                      {localTasks && localTasks.length > 0 && (
                        <View style={styles.taskList}>
                          {localTasks.map((task) => (
                            <View key={task.id} style={styles.taskItem}>
                              <TouchableOpacity 
                                style={[
                                  styles.taskCheckbox,
                                  task.completed && styles.taskCheckboxCompleted
                                ]}
                                onPress={() => {
                                  const newCompleted = !task.completed;
                                  setLocalTasks(prevTasks => 
                                    prevTasks.map(t => 
                                      t.id === task.id ? { ...t, completed: newCompleted } : t
                                    )
                                  );
                                  if (onToggleTask) {
                                    onToggleTask(lead.id, task.id, newCompleted);
                                  }
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                }}
                                activeOpacity={0.7}
                              >
                                <MaterialIcons 
                                  name={task.completed ? "check-box" : "check-box-outline-blank"} 
                                  size={24} 
                                  color={task.completed ? "#34C759" : "#F3F4F6"} 
                                />
                              </TouchableOpacity>
                              <Text style={[
                                styles.taskText,
                                !darkMode && { color: Colors.text },
                                task.completed && styles.taskTextCompleted,
                                task.completed && !darkMode && { color: Colors.sub },
                              ]}>
                                {task.text}
                              </Text>
                              <TouchableOpacity
                                style={styles.taskDeleteButton}
                                onPress={() => handleDeleteTask(task.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <MaterialIcons 
                                  name="delete-outline" 
                                  size={18} 
                                  color="#EF4444" 
                                />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}
                      
                      {/* Add Task */}
                      {!showTaskInput ? (
                        <View>
                          <TouchableOpacity 
                            style={styles.addTaskButton}
                            onPress={() => setShowTaskInput(true)}
                          >
                            <MaterialIcons name="add-task" size={20} color="#43cea2" />
                            <Text style={[styles.addTaskText, !darkMode && { color: Colors.text }]}>Add Task</Text>
                          </TouchableOpacity>
                          <Text style={[styles.addTaskHint, !darkMode && { color: Colors.sub }]}>
                            Follow-ups increase close rates by 27%
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.taskInputContainer}>
                          <Text style={styles.taskInputLabel}>New task:</Text>
                          <View style={styles.taskInputRow}>
                            <TextInput 
                              style={styles.taskInput} 
                              placeholder="Enter task description..."
                              placeholderTextColor="#F3F4F6"
                              value={taskText}
                              onChangeText={setTaskText}
                              multiline
                              numberOfLines={2}
                              textAlignVertical="top"
                            />
                            <View style={styles.taskInputActions}>
                              <TouchableOpacity 
                                style={styles.taskActionButton}
                                onPress={() => {
                                  setShowTaskInput(false);
                                  setTaskText('');
                                }}
                              >
                                <MaterialIcons name="close" size={16} color="#F3F4F6" />
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={styles.taskActionButton}
                                onPress={handleAddTask}
                              >
                                <MaterialIcons name="check" size={16} color="#34C759" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                </SubWebFormOptionalChrome>
              </View>
                    
                    {/* AI Insight Card */}
                    {lead.project.timeline === 'Soon' && (
                      <View style={[styles.wideContainer, isWeb && styles.wideContainerWeb]}>
                        <View style={styles.section}>
                          <View style={styles.aiInsightCard}>
                            <MaterialIcons name="lightbulb" size={18} color="#19E180" />
                            <View style={styles.aiInsightContent}>
                              <Text style={styles.aiInsightText}>
                                Leads with 'Soon' timelines convert 32% faster when contacted within 24 hours.
                              </Text>
                              <Text style={styles.aiInsightCTA}>Call now</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    )}


            </>
          )}

          {activeTab === 'analytics' && (
            <>
              {/* Lead Analytics - Wrapped in Gradient Border */}
              <View style={[styles.wideContainer, isWeb && styles.wideContainerWeb]}>
                <SubWebFormOptionalChrome isWeb={isWeb} darkMode={darkMode} Colors={Colors} columnStyle={webColumn860}>
                    <View style={[styles.section, styles.sectionInGradient]}>
                      <View style={styles.analyticsSectionHeader}>
                        <Text style={[styles.analyticsSectionTitle, !darkMode && { color: Colors.text }]}>
                          Lead Analytics
                        </Text>
                        <Text style={[styles.analyticsSectionSubtitle, !darkMode && { color: Colors.sub }]}>
                          Project budget and market information
                        </Text>
                      </View>
                      
                      <View style={styles.analyticsGrid}>
                        <View style={[styles.analyticsCard, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                          <MaterialIcons name="attach-money" size={24} color="#43cea2" />
                          <Text style={[styles.analyticsLabel, !darkMode && { color: Colors.sub }]}>Project Budget</Text>
                          <Text style={[styles.analyticsValue, !darkMode && { color: Colors.text }]}>${leadValue.toLocaleString()}</Text>
                          <Text style={[styles.analyticsSubtext, !darkMode && { color: Colors.sub }]}>
                            Range: ${lead.project.budgetMin.toLocaleString()}
                          </Text>
                        </View>
                        
                        <View style={[styles.analyticsCard, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                          <MaterialIcons name="location-on" size={24} color="#8B5CF6" />
                          <Text style={[styles.analyticsLabel, !darkMode && { color: Colors.sub }]}>Market Area</Text>
                          <Text style={[styles.analyticsValue, !darkMode && { color: Colors.text }]}>{lead.location.city}</Text>
                          <Text style={[styles.analyticsSubtext, !darkMode && { color: Colors.sub }]}>{lead.location.state}</Text>
                        </View>
                      </View>
                    </View>
                </SubWebFormOptionalChrome>
              </View>

              {/* Engagement Metrics */}
              <View style={[styles.wideContainer, isWeb && styles.wideContainerWeb]}>
                <SubWebFormOptionalChrome isWeb={isWeb} darkMode={darkMode} Colors={Colors} columnStyle={webColumn860}>
                    <View style={[styles.section, styles.sectionInGradient]}>
                      <View style={styles.analyticsSectionHeader}>
                        <Text style={[styles.analyticsSectionTitle, !darkMode && { color: Colors.text }]}>
                          Engagement Metrics
                        </Text>
                        <Text style={[styles.analyticsSectionSubtitle, !darkMode && { color: Colors.sub }]}>
                          Your interaction and response tracking
                        </Text>
                      </View>
                      
                      <View style={styles.engagementGrid}>
                        <View style={[styles.engagementCard, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                          <View style={styles.engagementIcon}>
                            <MaterialIcons name="visibility" size={20} color="#43cea2" />
                          </View>
                          <View style={styles.engagementValueRow}>
                            <Text style={[styles.engagementValue, !darkMode && { color: Colors.text }]}>
                              {engagement?.viewCount || lead.engagement?.viewCount || 0}
                            </Text>
                            <MaterialIcons name="trending-up" size={14} color="#22C55E" style={styles.trendIcon} />
                          </View>
                          <Text style={[styles.engagementLabel, !darkMode && { color: Colors.sub }]}>Views</Text>
                        </View>
                        
                        <View style={[styles.engagementCard, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                          <View style={styles.engagementIcon}>
                            <MaterialIcons name="reply" size={20} color="#3B82F6" />
                          </View>
                          <View style={styles.engagementValueRow}>
                            <Text style={[styles.engagementValue, !darkMode && { color: Colors.text }]}>
                              {engagement?.responseCount || lead.engagement?.responseCount || 0}
                            </Text>
                            {(engagement?.responseCount || lead.engagement?.responseCount || 0) > 0 ? (
                              <MaterialIcons name="trending-up" size={14} color="#22C55E" style={styles.trendIcon} />
                            ) : (
                              <MaterialIcons name="trending-down" size={14} color="#F3F4F6" style={styles.trendIcon} />
                            )}
                          </View>
                          <Text style={[styles.engagementLabel, !darkMode && { color: Colors.sub }]}>Your Responses</Text>
                        </View>
                        
                        <View style={[styles.engagementCard, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                          <View style={styles.engagementIcon}>
                            <MaterialIcons name="access-time" size={20} color="#F59E0B" />
                          </View>
                          <Text style={[styles.engagementValue, !darkMode && { color: Colors.text }]}>
                            {engagement?.averageResponseTime 
                              ? `${Math.round(engagement.averageResponseTime / 60 * 10) / 10}h` 
                              : engagement?.averageResponseTime 
                              ? `${engagement.averageResponseTime}m`
                              : lead.engagement?.averageResponseTime 
                              ? `${lead.engagement.averageResponseTime}m`
                              : 'N/A'}
                          </Text>
                          <Text style={[styles.engagementLabel, !darkMode && { color: Colors.sub }]}>Avg Response</Text>
                        </View>
                        
                        <View style={[styles.engagementCard, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                          <View style={styles.engagementIcon}>
                            <MaterialIcons name="history" size={20} color="#8B5CF6" />
                          </View>
                          <Text style={[styles.engagementValue, !darkMode && { color: Colors.text }]}>
                            {engagement?.yourLastResponseAt 
                              ? new Date(engagement.yourLastResponseAt).toLocaleDateString()
                              : 'Never'}
                          </Text>
                          <Text style={[styles.engagementLabel, !darkMode && { color: Colors.sub }]}>Last Response</Text>
                        </View>
                        
                      </View>
                    </View>
                </SubWebFormOptionalChrome>
              </View>

              {/* Quote Tracking */}
              <View style={[styles.wideContainer, isWeb && styles.wideContainerWeb]}>
                <SubWebFormOptionalChrome isWeb={isWeb} darkMode={darkMode} Colors={Colors} columnStyle={webColumn860}>
                    <View style={[styles.section, styles.sectionInGradient]}>
                      <View style={styles.analyticsSectionHeader}>
                        <Text style={[styles.analyticsSectionTitle, !darkMode && { color: Colors.text }]}>
                          Quote Tracking
                        </Text>
                        <Text style={[styles.analyticsSectionSubtitle, !darkMode && { color: Colors.sub }]}>
                          Bid status and win probability
                        </Text>
                      </View>
                      
                      <View style={styles.quoteTracking}>
                        <View style={[styles.quoteCard, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                          <MaterialIcons name="description" size={24} color="#43cea2" />
                          <Text style={[styles.quoteLabel, !darkMode && { color: Colors.sub }]}>Lead Status</Text>
                          <Text style={[styles.quoteValue, !darkMode && { color: Colors.text }]}>
                            {(() => {
                              // Show the current lead stage as the quote status
                              const stageLabels: { [key: string]: string } = {
                                'new': 'New',
                                'contacted': 'Contacted',
                                'qualified': 'Qualified',
                                'proposal': 'Proposal Sent',
                                'won': 'Won',
                                'lost': 'Lost',
                              };
                              return stageLabels[lead.stage] || lead.stage.charAt(0).toUpperCase() + lead.stage.slice(1);
                            })()}
                          </Text>
                        </View>
                        
                        <View style={[styles.quoteCard, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                          <MaterialIcons name="trending-up" size={24} color="#34C759" />
                          <Text style={[styles.quoteLabel, !darkMode && { color: Colors.sub }]}>Win Probability</Text>
                          <Text style={[styles.quoteValue, !darkMode && { color: Colors.text }]}>
                            {lead.aiScore || 0}%
                          </Text>
                        </View>
                        
                        <TouchableOpacity 
                          style={[styles.quoteCard, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}
                          onPress={handleSendProposal}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="attach-money" size={24} color="#8B5CF6" />
                          <Text style={[styles.quoteLabel, !darkMode && { color: Colors.sub }]}>Quote Amount</Text>
                          <Text style={[styles.quoteValue, !darkMode && { color: Colors.text }]}>
                            {(() => {
                              // If lead is won, show the project bid amount
                              if (lead.stage === 'won') {
                                const allProjects = [...activeProjects, ...estimates];
                                const matchingProject = allProjects.find(p => {
                                  const estimateData = (p as any).estimateData;
                                  return estimateData && estimateData.leadId === lead.id;
                                });
                                if (matchingProject && matchingProject.bidPrice) {
                                  return `$${matchingProject.bidPrice.toLocaleString()}`;
                                }
                                // Fallback to bidTotal if project not found
                                if (bidTotal !== null) {
                                  return `$${bidTotal.toLocaleString()}`;
                                }
                              }
                              
                              // For other stages, show bid total or budget range
                              if (hasActiveBid || bidTotal !== null) {
                                // Show bid total (even if $0) when there's an active bid
                                return `$${(bidTotal || 0).toLocaleString()}`;
                              } else {
                                // Only show budget range when no bid has been started
                                return `$${lead.project.budgetMin.toLocaleString()} - $${lead.project.budgetMax.toLocaleString()}`;
                              }
                            })()}
                          </Text>
                          {lead.stage !== 'won' && (hasActiveBid || bidTotal !== null) && (
                            <Text style={[styles.quoteLabel, { fontSize: 10, marginTop: 4, color: '#43cea2' }]}>
                              {bidTotal !== null && bidTotal > 0 ? 'Live from Bid Builder' : 'In Progress - Building Bid'}
                            </Text>
                          )}
                          <Text style={[styles.quoteLabel, { fontSize: 9, marginTop: 4, color: '#60a5fa', fontStyle: 'italic' }]}>
                            {lead.stage === 'won' ? 'Tap to open Project' : 'Tap to open Bid Builder'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                </SubWebFormOptionalChrome>
              </View>

              {/* Market Intelligence */}
              <View style={[styles.wideContainer, isWeb && styles.wideContainerWeb]}>
                <View style={styles.section}>
                <View style={styles.analyticsSectionHeader}>
                  <Text style={[styles.analyticsSectionTitle, !darkMode && { color: Colors.text }]}>
                    Market Intelligence
                  </Text>
                  <Text style={[styles.analyticsSectionSubtitle, !darkMode && { color: Colors.sub }]}>
                    Competitive analysis and insights
                  </Text>
                </View>
                <View style={[styles.intelligenceCard, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                  <View style={styles.intelligenceHeader}>
                    <MaterialIcons name="insights" size={20} color="#43cea2" />
                    <Text style={styles.intelligenceTitle}>Competitive Analysis</Text>
                  </View>
                  <Text style={[styles.intelligenceText, !darkMode && { color: Colors.sub }]}>
                    This lead shows {temperature.label.toLowerCase()} potential with a {lead.aiScore || 0}% conversion probability. 
                    Recommended response time: {getRecommendedResponseTime(lead)}.
                    {lead.matchedContractors && lead.matchedContractors > 0 ? ` ${lead.matchedContractors} contractors are available for this project.` : ''}
                  </Text>
                  <Text style={styles.benchmarkNote}>
                    Benchmarked against similar jobs in your market
                  </Text>
                </View>
              </View>
              </View>
            </>
          )}

          {/* Communication Tab Content */}
          {activeTab === 'communication' && (
            <>
              {/* Communication Log */}
              <View style={[styles.wideContainer, isWeb && styles.wideContainerWeb]}>
                <SubWebFormOptionalChrome isWeb={isWeb} darkMode={darkMode} Colors={Colors} columnStyle={webColumn860}>
                    <View style={[styles.section, styles.sectionInGradient]}>
                      <View style={styles.analyticsSectionHeader}>
                        <Text style={[styles.analyticsSectionTitle, !darkMode && { color: Colors.text }]}>
                          Communication Log
                        </Text>
                        <Text style={[styles.analyticsSectionSubtitle, !darkMode && { color: Colors.sub }]}>
                          Contact history and interaction timeline
                        </Text>
                      </View>
                      
                      {/* Quick Actions */}
                      <View style={styles.communicationActions}>
                        <TouchableOpacity 
                          style={[styles.commActionButton, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}
                          onPress={handleCall}
                        >
                          <MaterialIcons name="phone" size={20} color="#34C759" />
                          <Text style={[styles.commActionText, !darkMode && { color: Colors.text }]}>Call</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.commActionButton, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}
                          onPress={handleEmail}
                        >
                          <MaterialIcons name="email" size={20} color="#3B82F6" />
                          <Text style={[styles.commActionText, !darkMode && { color: Colors.text }]}>Email</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.commActionButton, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}
                          onPress={handleText}
                        >
                          <MaterialIcons name="message" size={20} color="#8B5CF6" />
                          <Text style={[styles.commActionText, !darkMode && { color: Colors.text }]}>Text</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Communication History */}
                      <View style={styles.communicationHistory}>
                        {(() => {
                          // Group communication items by timestamp
                          const commItems: Array<{ type: string; icon: string; iconColor: string; title: string; subtitle: string; date: Date }> = [];
                          
                          // Initial Contact
                          commItems.push({
                            type: 'initial',
                            icon: 'phone',
                            iconColor: '#34C759',
                            title: 'Initial Contact',
                            subtitle: `Lead received from ${lead.source.replace('_', ' ')}`,
                            date: new Date(lead.createdAt)
                          });
                          
                          // Stage Change
                          if (lead.stage !== 'new') {
                            commItems.push({
                              type: 'stage',
                              icon: 'check-circle',
                              iconColor: '#43cea2',
                              title: 'Lead Contacted',
                              subtitle: `Moved to ${lead.stage} stage`,
                              date: new Date(lead.createdAt)
                            });
                          }
                          
                          // Notes
                          if (lead.notes && lead.notes.length > 0) {
                            const latestNote = lead.notes[lead.notes.length - 1];
                            commItems.push({
                              type: 'note',
                              icon: 'note',
                              iconColor: '#F59E0B',
                              title: 'Notes Added',
                              subtitle: `${lead.notes.length} note${lead.notes.length > 1 ? 's' : ''} recorded`,
                              date: latestNote.createdAt ? new Date(latestNote.createdAt) : new Date()
                            });
                          }
                          
                          // Group by timestamp
                          const grouped: { [key: string]: typeof commItems } = {};
                          commItems.forEach(item => {
                            const group = getTimestampGroup(item.date);
                            if (!grouped[group]) grouped[group] = [];
                            grouped[group].push(item);
                          });
                          
                          // Render grouped items
                          const groups = ['Today', 'Yesterday', 'Earlier'];
                          return groups.map(group => {
                            if (!grouped[group] || grouped[group].length === 0) return null;
                            return (
                              <View key={group}>
                                <Text style={[styles.commGroupHeader, !darkMode && { color: Colors.sub }]}>{group}</Text>
                                {grouped[group].map((item, idx) => (
                                  <View
                                    key={`${item.type}-${idx}`}
                                    style={[styles.commLogItem, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}
                                  >
                                    <View style={styles.commLogIcon}>
                                      <MaterialIcons name={item.icon as any} size={16} color={item.iconColor} />
                                    </View>
                                    <View style={styles.commLogContent}>
                                      <Text style={[styles.commLogTitle, !darkMode && { color: Colors.text }]}>{item.title}</Text>
                                      <Text style={[styles.commLogSubtitle, !darkMode && { color: Colors.sub }]}>{item.subtitle}</Text>
                                      <Text style={[styles.commLogDate, !darkMode && { color: Colors.sub }]}>
                                        {group === 'Today' ? getTimeAgo(item.date.toISOString()) : item.date.toLocaleDateString()}
                                      </Text>
                                    </View>
                                  </View>
                                ))}
                                {group !== 'Earlier' && <View style={styles.commDivider} />}
                              </View>
                            );
                          });
                        })()}
                      </View>
                      
                      {/* Response Time Comparison */}
                      {engagement?.averageResponseTime && (
                        <View style={styles.responseTimeNote}>
                          <Text style={styles.responseTimeNoteText}>
                            Avg response time vs market: +22% faster
                          </Text>
                        </View>
                      )}
                    </View>
                </SubWebFormOptionalChrome>
              </View>

              {/* Notes */}
              <View style={[styles.wideContainer, isWeb && styles.wideContainerWeb]}>
                <SubWebFormOptionalChrome isWeb={isWeb} darkMode={darkMode} Colors={Colors} columnStyle={webColumn860}>
                    <View style={[styles.section, styles.sectionInGradient]}>
                      <View style={styles.analyticsSectionHeader}>
                        <Text style={[styles.analyticsSectionTitle, !darkMode && { color: Colors.text }]}>
                          Notes
                        </Text>
                        <Text style={[styles.analyticsSectionSubtitle, !darkMode && { color: Colors.sub }]}>
                          Your notes and observations
                        </Text>
                      </View>
                      
                      {/* Existing Notes */}
                      {lead.notes && lead.notes.length > 0 && (
                        <View style={styles.notesList}>
                          {lead.notes.map((note, index) => (
                            <View
                              key={index}
                              style={[styles.noteCard, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}
                            >
                              <Text style={[styles.noteText, !darkMode && { color: Colors.text }]}>{note.text}</Text>
                              <Text style={[styles.noteDate, !darkMode && { color: Colors.sub }]}>
                                {new Date(note.createdAt).toLocaleDateString()}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Add Note */}
                {!showNoteInput ? (
                  <TouchableOpacity 
                    style={[styles.addNoteButton, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}
                    onPress={() => setShowNoteInput(true)}
                  >
                    <MaterialIcons name="add" size={20} color="#43cea2" />
                    <Text style={[styles.addNoteText, !darkMode && { color: Colors.text }]}>Add a note</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.noteInputContainer, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                    <Text style={[styles.noteInputLabel, !darkMode && { color: Colors.sub }]}>Your note:</Text>
                    <View style={styles.noteInputRow}>
                      <TextInput 
                        style={[styles.noteInput, !darkMode && { color: Colors.text }]} 
                        placeholder="Enter your note here..."
                        placeholderTextColor={darkMode ? "#E5E7EB" : "#64748B"}
                        value={noteText}
                        onChangeText={setNoteText}
                        multiline
                        numberOfLines={3}
                        maxLength={500}
                        textAlignVertical="top"
                      />
                      <View style={styles.noteInputActions}>
                        <TouchableOpacity 
                          style={styles.noteActionButton}
                          onPress={() => {
                            setShowNoteInput(false);
                            setNoteText('');
                          }}
                        >
                          <MaterialIcons name="close" size={16} color="#F3F4F6" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.noteActionButton, styles.saveButton]}
                          onPress={handleAddNote}
                        >
                          <MaterialIcons name="check" size={16} color="#34C759" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={[styles.characterCount, !darkMode && { color: Colors.sub }]}>
                      {noteText.length}/500 characters
                    </Text>
                  </View>
                )}
                    </View>
                </SubWebFormOptionalChrome>
              </View>

              {/* Recommended Next Actions - No Border */}
              <View style={[styles.wideContainer, isWeb && styles.wideContainerWeb]}>
                <View style={styles.section}>
                  <View style={styles.analyticsSectionHeader}>
                    <Text style={[styles.analyticsSectionTitle, !darkMode && { color: Colors.text }]}>
                      Recommended Next Actions
                    </Text>
                    <Text style={[styles.analyticsSectionSubtitle, !darkMode && { color: Colors.sub }]}>
                      AI-suggested steps to move forward
                    </Text>
                  </View>
                  
                  <View style={styles.nextActions}>
                    {lead.stage === 'new' && (
                      <View style={styles.actionItem}>
                        <MaterialIcons name="phone" size={20} color="#34C759" />
                        <Text style={[styles.actionText, !darkMode && { color: Colors.text }]}>Call within 2 hours for best conversion</Text>
                      </View>
                    )}
                    
                    {lead.stage === 'contacted' && (
                      <View style={styles.actionItem}>
                        <MaterialIcons name="send" size={20} color="#3B82F6" />
                        <Text style={[styles.actionText, !darkMode && { color: Colors.text }]}>Send detailed quote within 24 hours</Text>
                      </View>
                    )}
                    
                    {lead.stage === 'quoted' && (
                      <View style={styles.actionItem}>
                        <MaterialIcons name="schedule" size={20} color="#F59E0B" />
                        <Text style={[styles.actionText, !darkMode && { color: Colors.text }]}>Follow up in 3-5 days if no response</Text>
                      </View>
                    )}
                    
                    {lead.stage === 'proposal' && (
                      <View style={styles.actionItem}>
                        <MaterialIcons name="meeting-room" size={20} color="#8B5CF6" />
                        <Text style={[styles.actionText, !darkMode && { color: Colors.text }]}>Schedule site visit or meeting</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </>
          )}


          {/* Action Buttons — compact row matching Find Subcontractors */}
          {activeTab === 'overview' && (
            <View style={[styles.wideContainer, isWeb && styles.wideContainerWeb]}>
              <View
                style={[
                  styles.actionsFooterWrap,
                  darkMode && styles.actionsFooterWrapDark,
                  !darkMode && { borderColor: Colors.line, backgroundColor: Colors.surface2 },
                ]}
              >
                <Text
                  style={[styles.actionsFooterLabel, !darkMode && { color: Colors.sub }]}
                  accessibilityRole="header"
                >
                  Contact
                </Text>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.actionPrimaryOuter, !lead.contact.phone && styles.disabledCard]}
                  onPress={handleCall}
                  disabled={!lead.contact.phone}
                >
                  <LinearGradient
                    colors={['#22c55e', '#22d3ee']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionPrimaryGradient}
                  >
                    <MaterialIcons
                      name="phone"
                      size={18}
                      color={lead.contact.phone ? '#020617' : '#94a3b8'}
                    />
                    <Text
                      style={[
                        styles.actionPrimaryText,
                        !lead.contact.phone && styles.disabledText,
                      ]}
                    >
                      Call Lead
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.actionSecondaryRow}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.actionSecondary,
                      !darkMode && { borderColor: Colors.line, backgroundColor: Colors.surface },
                      !lead.contact.email && styles.disabledCard,
                    ]}
                    onPress={handleEmail}
                    disabled={!lead.contact.email}
                  >
                    <MaterialIcons
                      name="email"
                      size={17}
                      color={
                        lead.contact.email
                          ? darkMode
                            ? 'rgba(226, 232, 240, 0.95)'
                            : Colors.text
                          : '#94a3b8'
                      }
                    />
                    <Text
                      style={[
                        styles.actionSecondaryText,
                        !darkMode && { color: Colors.text },
                        !lead.contact.email && styles.disabledText,
                      ]}
                    >
                      Email
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.actionSecondary,
                      !darkMode && { borderColor: Colors.line, backgroundColor: Colors.surface },
                    ]}
                    onPress={handleText}
                  >
                    <MaterialIcons
                      name="message"
                      size={17}
                      color={darkMode ? 'rgba(226, 232, 240, 0.95)' : Colors.text}
                    />
                    <Text style={[styles.actionSecondaryText, !darkMode && { color: Colors.text }]}>
                      Text
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.actionDestructiveContainer, darkMode && styles.actionDestructiveContainerDark]}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.actionDestructive,
                      !darkMode && { borderColor: 'rgba(239, 68, 68, 0.35)', backgroundColor: 'rgba(239, 68, 68, 0.06)' },
                    ]}
                    onPress={handleDelete}
                  >
                    <MaterialIcons name="delete-outline" size={18} color="#f87171" />
                    <View style={styles.actionDestructiveTextCol}>
                      <Text style={styles.actionDestructiveText}>Delete lead</Text>
                      <Text style={styles.actionDestructiveSubtext}>This cannot be undone</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// SegmentTab Component - Matching Leads Header Style
type SegmentTabProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  onPress: () => void;
  darkMode: boolean;
  Colors: ReturnType<typeof getColors>;
};

const SegmentTab: React.FC<SegmentTabProps> = ({ label, icon, isActive, onPress, darkMode, Colors }) => {
  if (isActive) {
    return (
      <LinearGradient
        colors={["#22c55e", "#22d3ee"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.segmentTab, styles.segmentTabActive]}
      >
        <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
          <View style={styles.segmentTabInner}>
            <Ionicons name={icon} size={16} color={darkMode ? '#050B13' : '#071018'} />
            <Text 
              style={[styles.segmentLabel, styles.segmentLabelActive]}
              numberOfLines={1}
              ellipsizeMode="tail"
              adjustsFontSizeToFit={true}
              minimumFontScale={0.85}
            >
              {label}
            </Text>
          </View>
        </Pressable>
      </LinearGradient>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.segmentTab, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.segmentTabInner}>
        <Ionicons name={icon} size={16} color={darkMode ? '#FFFFFF' : Colors.text} />
        <Text 
          style={[
            styles.segmentLabel,
            darkMode && styles.segmentLabelInactiveDark,
            !darkMode && { color: Colors.text },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
          adjustsFontSizeToFit={true}
          minimumFontScale={0.85}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
};

// Helper functions
function getTimeAgo(createdAt: string): string {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

function getTimestampGroup(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (itemDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (itemDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    return 'Earlier';
  }
}

function getTemperature(lead: Lead) {
  const urgency = lead.project.timeline;
  // Return the actual timeline label instead of temperature labels
  if (urgency === 'Urgent') {
    return { icon: '🔥', label: 'Urgent', color: '#EF4444' };
  } else if (urgency === 'Soon') {
    return { icon: '☀️', label: 'Soon', color: '#F59E0B' };
  } else if (urgency === 'Normal') {
    return { icon: '❄️', label: 'Normal', color: '#6B7280' };
  } else {
    return { icon: '❄️', label: 'Flexible', color: '#6B7280' };
  }
}



function getStageColor(stage: string): string {
  const colors: { [key: string]: string } = {
    'new': '#6B7280',        // Gray
    'contacted': '#3B82F6',  // Blue
    'qualified': '#8B5CF6',  // Purple
    'proposal': '#F59E0B',   // Amber
    'won': '#10B981',        // Green
  };
  return colors[stage] || '#6B7280';
}

function getNextStage(currentStage: string): string {
  const stages: LeadStage[] = ['new', 'contacted', 'qualified', 'proposal', 'won'];
  const currentIndex = stages.indexOf(currentStage as LeadStage);
  return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : currentStage;
}

function getRecommendedResponseTime(lead: Lead): string {
  const urgency = lead.project.timeline;
  const score = lead.aiScore || 0;
  
  if (urgency === 'Urgent' && score >= 80) {
    return '< 1 hour';
  } else if (urgency === 'Soon' || score >= 70) {
    return '< 4 hours';
  } else {
    return '< 24 hours';
  }
}

function getNotificationTimeline(lead: Lead): string {
  const urgency = lead.project.timeline;
  const createdDate = new Date(lead.createdAt);
  const now = new Date();
  
  if (urgency === 'Urgent') {
    return 'immediately';
  } else if (urgency === 'Soon') {
    return 'within 24 hours';
  } else {
    // Calculate days from creation
    const daysSinceCreated = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceCreated < 3) {
      return 'within 3 days';
    } else if (daysSinceCreated < 7) {
      return 'within 1 week';
    } else {
      return 'ASAP';
    }
  }
}

function getTimelineColor(timeline: string): string {
  switch (timeline) {
    case 'Urgent':
      return '#EF4444';
    case 'Soon':
      return '#F59E0B';
    case 'Normal':
      return '#34C759';
    default:
      return '#FFFFFF';
  }
}

function getLeadHealthStatus(lead: Lead): string {
  const urgency = lead.project.timeline;
  const score = lead.aiScore || 0;
  const age = new Date().getTime() - new Date(lead.createdAt).getTime();
  const hoursOld = age / (1000 * 60 * 60);
  
  // Strong: High score + urgent/soon + fresh
  if (score >= 75 && (urgency === 'Urgent' || urgency === 'Soon') && hoursOld < 24) {
    return 'Strong';
  }
  // Good: Medium-high score + reasonable timeline
  if (score >= 60 && hoursOld < 72) {
    return 'Good';
  }
  // Fair: Lower score or older lead
  if (score >= 40 || hoursOld < 168) {
    return 'Fair';
  }
  // Weak: Low score and old
  return 'Weak';
}

function getLeadHealthColor(lead: Lead): string {
  const status = getLeadHealthStatus(lead);
  switch (status) {
    case 'Strong':
      return '#22C55E';
    case 'Good':
      return '#3B82F6';
    case 'Fair':
      return '#F59E0B';
    case 'Weak':
      return '#F3F4F6';
    default:
      return '#F3F4F6';
  }
}


function getLeadAge(lead: Lead): string {
  const createdDate = new Date(lead.createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return '1 day';
  } else if (diffDays < 7) {
    return `${diffDays} days`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''}`;
  } else {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''}`;
  }
}

// Helper function to parse description into structured content
function parseDescription(description: string | undefined): {
  scope?: string[];
  propertyType?: string[];
  availability?: string;
} {
  if (!description) return {};
  
  const result: {
    scope?: string[];
    propertyType?: string[];
    availability?: string;
  } = {};
  
  // Extract scope (Services: ...)
  const scopeMatch = description.match(/Services?:\s*([^.]+)/i);
  if (scopeMatch) {
    result.scope = scopeMatch[1].split(',').map(s => s.trim()).filter(Boolean);
  }
  
  // Extract property type (Residential, Commercial)
  const propertyMatch = description.match(/(Residential|Commercial)/gi);
  if (propertyMatch) {
    result.propertyType = [...new Set(propertyMatch.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))];
  }
  
  // Extract availability (Available: ...)
  const availabilityMatch = description.match(/Available:\s*([^.]+)/i);
  if (availabilityMatch) {
    result.availability = availabilityMatch[1].trim();
  }
  
  return result;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: 'transparent',
    paddingBottom: 4, // Reduced from 12
    paddingHorizontal: 20,
    marginTop: 12, // Match dashboard and projects header spacing
    marginBottom: 12, // Reduced from 18
    paddingLeft: 0, // Remove left padding to allow back arrow to go further left
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButtonWrapper: {
    marginRight: 8,
    marginLeft: -8, // Move back arrow further to the left
  },
  backButtonBorder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrapper: {
    flex: 1,
    position: 'relative',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 0, // No padding - wideContainer handles width
  },
  wideContainer: {
    marginHorizontal: -20, // Extend beyond ScrollView padding (matches dashboard, projects, landing)
    paddingHorizontal: 8, // Add padding back inside (matches dashboard, projects, landing)
  },
  wideContainerWeb: {
    marginHorizontal: 0,
    paddingHorizontal: 0,
  },
  section: {
    marginTop: 20,
    marginBottom: 4,
  },
  sectionInGradient: {
    marginTop: 0, // Remove top margin for sections inside gradient
    marginBottom: 0, // Remove bottom margin for sections inside gradient
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8, // Added more vertical spacing above section headers
    marginBottom: 12,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  // Analytics section headers - matching Lead Sources and My Leads style
  analyticsSectionHeader: {
    marginBottom: 12,
  },
  analyticsSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 4,
  },
  analyticsSectionSubtitle: {
    fontSize: 13,
    color: '#F3F4F6',
  },
  // Hero Section Styles
  heroSection: {
    marginBottom: 8,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heroTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroTitle: {
    fontSize: 26, // Reduced from 28 (~7% reduction)
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroTradeChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  heroTradeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  heroTimelinePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  heroTimelineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroBudgetRow: {
    gap: 4,
  },
  heroBudget: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroMeta: {
    fontSize: 14,
    fontWeight: '400',
    color: '#F3F4F6',
    opacity: 1,
  },
  leadHealthIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  leadHealthLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#F3F4F6',
  },
  leadHealthValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Compressed Stats Row - iOS Style
  compressedStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  compressedMetadataContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  compressedMetadataLine: {
    fontSize: 13,
    fontWeight: '500',
    color: '#F3F4F6',
  },
  compressedMetadataSeparator: {
    fontSize: 13,
    fontWeight: '500',
    color: '#F3F4F6',
    opacity: 0.5,
  },
  // Key Stats Row Styles (kept for compatibility)
  keyStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  keyStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  keyStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#F3F4F6',
    opacity: 0.65,
    marginBottom: 6,
  },
  keyStatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  keyStatValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  keyStatValueText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  moreDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  moreDetailsText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#F3F4F6',
  },
  moreDetailsContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 16, // Reduced spacing inside cards
  },
  // Project Reality Group (High Value)
  projectRealityGroup: {
    marginBottom: 12,
  },
  projectRealityLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F3F4F6',
    opacity: 0.7,
    marginBottom: 6,
  },
  projectRealityChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  projectRealityChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  projectRealityChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  projectRealityValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  // System Metadata
  systemMetadataDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 8,
    marginBottom: 12,
  },
  systemMetadataLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F3F4F6',
    opacity: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  moreDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8, // Reduced spacing inside cards
  },
  moreDetailLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#F3F4F6',
    opacity: 0.65,
  },
  moreDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Bullet Description Styles
  bulletDescription: {
    gap: 8, // Reduced spacing inside cards
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    fontSize: 14,
    color: '#43cea2',
    fontWeight: '700',
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#E5E7EB',
    lineHeight: 20,
  },
  // Structured Description Styles (kept for compatibility)
  structuredDescription: {
    gap: 16,
  },
  structuredRow: {
    gap: 8,
  },
  structuredLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F3F4F6',
    opacity: 0.65,
    marginBottom: 4,
  },
  structuredValueContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  structuredValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  // AI Insight Card
  aiInsightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(25, 225, 128, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(25, 225, 128, 0.3)',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  aiInsightContent: {
    flex: 1,
    gap: 6,
  },
  aiInsightText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#E5F7FF',
    lineHeight: 18,
  },
  aiInsightCTA: {
    fontSize: 12,
    fontWeight: '600',
    color: '#19E180',
    marginTop: 2,
  },
  // Overview footer actions — Find Subcontractors density + gradient primary
  actionsFooterWrap: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.14)',
    gap: 10,
  },
  actionsFooterWrapDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  actionsFooterLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    color: 'rgba(148, 163, 184, 0.9)',
    marginBottom: 2,
  },
  actionPrimaryOuter: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  actionPrimaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 18,
    minHeight: 44,
    gap: 8,
  },
  actionPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.15,
    color: '#020617',
  },
  actionSecondaryRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  actionSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 42,
    gap: 6,
  },
  actionSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.12,
    color: 'rgba(226, 232, 240, 0.95)',
  },
  actionDestructiveContainer: {
    marginTop: 2,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.18)',
  },
  actionDestructiveContainerDark: {
    borderTopColor: 'rgba(148, 163, 184, 0.12)',
  },
  actionDestructive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    backgroundColor: 'rgba(248, 113, 113, 0.06)',
  },
  actionDestructiveTextCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  actionDestructiveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fca5a5',
  },
  actionDestructiveSubtext: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(248, 250, 252, 0.55)',
    marginTop: 2,
  },
  disabledText: {
    color: '#F3F4F6',
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  leadInfo: {
    flex: 1,
    marginRight: 16,
  },
  contactName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  companyName: {
    fontSize: 16,
    color: '#F3F4F6',
    marginBottom: 8,
  },
  trade: {
    fontSize: 14,
    fontWeight: '500',
    color: '#43cea2',
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  temperatureBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  temperatureText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  projectOverview: {
    flexDirection: 'row',
    gap: 16,
  },
  budgetInfo: {
    flex: 1,
    backgroundColor: '#1B365D',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.15)',
  },
  budgetLabel: {
    fontSize: 12,
    color: '#F3F4F6',
    marginBottom: 4,
  },
  budgetValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  averageValue: {
    fontSize: 12,
    color: '#43cea2',
  },
  timelineInfo: {
    flex: 1,
    backgroundColor: '#1B365D',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.15)',
  },
  timelineLabel: {
    fontSize: 12,
    color: '#F3F4F6',
    marginBottom: 4,
  },
  timelineValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 4,
  },
  createdDate: {
    fontSize: 12,
    color: '#F3F4F6',
  },
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  contactCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1B365D',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.15)',
  },
  contactLabel: {
    fontSize: 12,
    color: '#F3F4F6',
    marginTop: 8,
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1B365D',
    padding: 10,
    borderRadius: 20, // Reduced from 24 to 20
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.15)',
  },
  detailLabel: {
    fontSize: 11,
    color: '#F3F4F6',
    opacity: 0.65, // Lower opacity for labels
    marginBottom: 4,
    textAlign: 'center',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  additionalInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#1B365D',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.15)',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#E0E7FF',
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: '#E5E7EB',
    lineHeight: 20,
    backgroundColor: '#1B365D',
    padding: 12,
    borderRadius: 12, // Reduced from 10
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.15)',
  },
  qualityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  qualityCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1B365D',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.15)',
  },
  qualityLabel: {
    fontSize: 12,
    color: '#F3F4F6',
    marginTop: 8,
  },
  noteCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  notesList: {
    marginBottom: 16,
  },
  noteText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  noteDate: {
    fontSize: 12,
    color: '#F3F4F6',
  },
  addNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderStyle: 'dashed',
    gap: 8,
    marginBottom: 12,
  },
  addNoteText: {
    fontSize: 14,
    color: '#43cea2',
    fontWeight: '500',
  },
  noteInputContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 12,
    marginBottom: 12,
  },
  noteInputLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  noteInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  characterCount: {
    fontSize: 11,
    color: '#F3F4F6',
    textAlign: 'right',
    marginTop: 4,
  },
  noteInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 8,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 80,
  },
  noteInputActions: {
    flexDirection: 'row',
    gap: 8,
  },
  noteActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#1B365D',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.15)',
    gap: 6,
  },
  disabledCard: {
    opacity: 0.5,
  },
  actionLabel: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  stageBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  stageBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#F3F4F6',
    marginTop: 2,
    opacity: 0.7, // Dimmed subtitle
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(67, 206, 162, 0.1)',
  },
  shareOptions: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  shareOptionText: {
    color: '#43cea2',
    fontSize: 14,
    fontWeight: '500',
  },
  // Segment tabs — match project-detail / Duplex Build pill bar
  segmentContainer: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#19E180',
    marginBottom: 18,
  },
  segmentTrackDark: {
    backgroundColor: '#000000',
  },
  segmentInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    gap: 4,
    backgroundColor: 'transparent',
  },
  segmentInnerWeb: {
    width: '100%',
    gap: 0,
  },
  segmentTab: {
    flex: 1,
    minWidth: 0,
    borderRadius: 999,
    marginHorizontal: Platform.OS === 'web' ? 0 : 1,
  },
  segmentTabActive: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 6,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  segmentLabelInactiveDark: {
    color: '#FFFFFF',
  },
  segmentLabelActive: {
    color: '#050B13',
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  analyticsCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  analyticsLabel: {
    fontSize: 12,
    color: '#F3F4F6',
    marginTop: 8,
    textAlign: 'center',
  },
  analyticsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
  },
  intelligenceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  intelligenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  intelligenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#43cea2',
  },
  intelligenceText: {
    fontSize: 14,
    color: '#E0E7FF',
    lineHeight: 20,
    marginBottom: 8,
  },
  benchmarkNote: {
    fontSize: 11,
    color: '#F3F4F6',
    fontStyle: 'italic',
    marginTop: 8,
    opacity: 0.7,
  },
  historyTimeline: {
    gap: 16,
  },
  historyItem: {
    flexDirection: 'row',
    gap: 12,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(67, 206, 162, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyContent: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 12,
    color: '#F3F4F6',
    marginBottom: 2,
  },
  historyDescription: {
    fontSize: 12,
    color: '#CCC',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#F59E0B',
  },
  notificationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  notificationText: {
    fontSize: 11,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  // Communication Tab Styles
  communicationActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  commActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 8,
  },
  commActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  communicationHistory: {
    gap: 12,
  },
  commGroupHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F3F4F6',
    marginTop: 8,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  commDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 12,
  },
  commLogItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 12,
    marginBottom: 8,
  },
  commLogIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(67, 206, 162, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commLogContent: {
    flex: 1,
  },
  commLogTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  commLogSubtitle: {
    fontSize: 12,
    color: '#F3F4F6',
    marginBottom: 4,
  },
  commLogDate: {
    fontSize: 11,
    color: '#FFFFFF',
  },
  responseTimeNote: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(67, 206, 162, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.2)',
  },
  responseTimeNoteText: {
    fontSize: 12,
    color: '#43cea2',
    fontWeight: '500',
    textAlign: 'center',
  },
  nextActions: {
    gap: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 12,
  },
  actionText: {
    fontSize: 14,
    color: '#E0E7FF',
    fontWeight: '500',
    flex: 1,
  },
  // Task Management Styles
  addTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderStyle: 'dashed',
    gap: 8,
    marginTop: 8,
  },
  addTaskText: {
    fontSize: 14,
    color: '#43cea2',
    fontWeight: '500',
  },
  addTaskHint: {
    fontSize: 11,
    color: '#F3F4F6',
    opacity: 0.6,
    marginTop: 6,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  taskInputContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12, // Reduced from 8
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 12,
    marginTop: 8,
  },
  taskInputLabel: {
    fontSize: 12,
    color: '#F3F4F6',
    marginBottom: 8,
  },
  taskInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  taskInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    padding: 8,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  taskInputActions: {
    flexDirection: 'row',
    gap: 4,
  },
  taskActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskList: {
    gap: 8,
    marginBottom: 16,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10, // Reduced from 12 to reduce spacing inside cards
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12, // Reduced from 8 to match new design
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 12,
    marginBottom: 8,
    // Flattened - reduced shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  taskCheckbox: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
    minHeight: 40,
  },
  taskCheckboxCompleted: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: 6,
  },
  taskText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  taskTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#F3F4F6',
  },
  taskDeleteButton: {
    padding: 8,
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Quote Tracking Styles
  quoteTracking: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  quoteCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  quoteLabel: {
    fontSize: 11,
    color: '#F3F4F6',
    marginTop: 6,
    textAlign: 'center',
  },
  quoteValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 2,
    textAlign: 'center',
  },
  quoteActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quoteActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#173659',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f4676',
    gap: 8,
  },
  quoteActionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  // Engagement Metrics Styles
  engagementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  engagementCard: {
    flex: 1,
    minWidth: '45%',
    maxWidth: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  engagementValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendIcon: {
    marginLeft: 2,
  },
  engagementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  engagementValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  engagementLabel: {
    fontSize: 12,
    color: '#F3F4F6',
    fontWeight: '500',
  },
  // Progress Bar Styles
  analyticsSubtext: {
    fontSize: 11,
    color: '#F3F4F6',
    marginTop: 4,
  },
  progressBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
});
