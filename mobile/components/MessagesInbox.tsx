import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  FlatList,
  StyleSheet,
  Modal,
  Alert,
  Animated,
  RefreshControl,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GradientRingBackInner from './GradientRingBackInner';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import { useChat, Conversation } from '../contexts/ChatContext';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';

import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from '@/constants/brandFrameGradient';

interface MessagesInboxProps {
  visible: boolean;
  onClose: () => void;
  filterRole?: 'contractor' | 'subcontractor'; // Optional: filter by user role
}

// Helper function to format time ago
const getTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
};

export function MessagesInbox({ visible, onClose, filterRole }: MessagesInboxProps) {
  const { conversations: allConversations, deleteConversation, getMessages, sendMessage, markAsRead, getConversation, currentUserName, messages: contextMessages } = useChat();
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  const lightText = !darkMode ? { color: Colors.text } : undefined;
  const lightSub = !darkMode ? { color: Colors.sub } : undefined;
  const gradientColors = useMemo(
    () => ['#0b1c38', '#1B365D', '#43cea2'],
    []
  );
  const conversationBackground = 'rgba(24, 28, 36, 0.96)';
  /** Brighter teal frame so cards read clearly on dark (was very faint gray). */
  const conversationBorder = 'rgba(45, 255, 196, 0.42)';
  const unreadBorder = '#0a0f14';
  const unreadBackground = '#14B8A6';

  /** Light mode only — conversation list on pale bg */
  const lightConversationSurface = Colors.card;
  const lightConversationBorder = 'rgba(13, 148, 136, 0.28)';
  
  // Sample conversations for preview (remove when real data is available)
  const sampleConversations = useMemo((): Conversation[] => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    return [
      {
        id: 'sample-1',
        participantId: 'sub-1',
        participantName: 'Mike Rodriguez',
        participantCompany: 'Rodriguez Electrical',
        participantPhone: '+1-555-0123',
        participantEmail: 'mike@rodriguezelectrical.com',
        unreadCount: 3,
        createdAt: threeDaysAgo,
        updatedAt: twoHoursAgo,
        userRole: 'subcontractor' as const,
        lastMessage: {
          id: 'msg-1',
          conversationId: 'sample-1',
          senderId: 'sub-1',
          senderName: 'Mike Rodriguez',
          recipientId: 'contractor-demo',
          recipientName: 'Build Profit Solutions',
          content: 'Thanks for the quote! I\'m interested in discussing the timeline. Can we schedule a call this week?',
          timestamp: twoHoursAgo,
          type: 'text' as const,
        },
      },
      {
        id: 'sample-2',
        participantId: 'sub-2',
        participantName: 'Sarah Chen',
        participantCompany: 'Chen Plumbing Services',
        participantPhone: '+1-555-0456',
        participantEmail: 'sarah@chenplumbing.com',
        unreadCount: 1,
        createdAt: oneDayAgo,
        updatedAt: fiveMinutesAgo,
        userRole: 'subcontractor' as const,
        lastMessage: {
          id: 'msg-2',
          conversationId: 'sample-2',
          senderId: 'contractor-demo',
          senderName: 'Build Profit Solutions',
          recipientId: 'sub-2',
          recipientName: 'Sarah Chen',
          content: 'Perfect! I\'ll send over the detailed specs by end of day.',
          timestamp: fiveMinutesAgo,
          type: 'text' as const,
        },
      },
      {
        id: 'sample-3',
        participantId: 'sub-3',
        participantName: 'James Wilson',
        participantCompany: 'Wilson Construction',
        participantPhone: '+1-555-0789',
        participantEmail: 'james@wilsonconstruction.com',
        unreadCount: 1,
        createdAt: threeDaysAgo,
        updatedAt: oneDayAgo,
        userRole: 'subcontractor' as const,
        lastMessage: {
          id: 'msg-3',
          conversationId: 'sample-3',
          senderId: 'sub-3',
          senderName: 'James Wilson',
          recipientId: 'contractor-demo',
          recipientName: 'Build Profit Solutions',
          content: 'I saw your campaign for the commercial renovation project. We specialize in that type of work.',
          timestamp: oneDayAgo,
          type: 'text' as const,
        },
      },
    ];
  }, []);
  
  // Filter conversations by role if specified
  // TEMPORARY: Always show sample conversations for preview
  const conversations = useMemo(() => {
    return sampleConversations.filter(conv => 
      filterRole ? conv.userRole === filterRole : true
    );
  }, [sampleConversations, filterRole]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const [refreshing, setRefreshing] = useState(false);
  const sendButtonScale = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();

  // Get selected conversation
  const selectedConversation = conversations.find(c => c.id === selectedConversationId);
  
  // Get messages for selected conversation
  const chatMessages = selectedConversationId ? (contextMessages[selectedConversationId] || []) : [];

  // Mark as read when conversation is selected
  useEffect(() => {
    if (selectedConversationId) {
      markAsRead(selectedConversationId);
    }
  }, [selectedConversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollViewRef.current && chatMessages.length > 0 && selectedConversationId) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatMessages, selectedConversationId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  };

  const handleConversationPress = (conversationId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedConversationId(conversationId);
  };

  const handleBackFromChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedConversationId(null);
    setMessageText('');
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const messageToSend = messageText.trim();
    setMessageText('');

    await sendMessage(
      selectedConversation.id,
      messageToSend,
      selectedConversation.participantId,
      selectedConversation.participantName,
      currentUserName
    );
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const handleDeleteConversation = (conversationId: string, participantName: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete your conversation with ${participantName}? This cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteConversation(conversationId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
      { cancelable: true }
    );
  };

  const renderRightActions = (conversationId: string, participantName: string) => {
    return (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteConversation(conversationId, participantName)}
      >
        <MaterialIcons name="delete" size={28} color="#FFFFFF" />
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: darkMode ? '#000000' : Colors.bg }}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.container, !darkMode && { backgroundColor: Colors.bg }]}>
          {/* Header with Back Arrow */}
          <View
            style={[
              styles.headerContainer,
              { paddingTop: Math.max(insets.top, 16) + 12 },
              !darkMode && { borderBottomColor: Colors.line },
            ]}
          >
            <View style={styles.backBtnWrapper}>
              <LinearGradient
                colors={[...BRAND_FRAME_GRADIENT_COLORS]}
                start={BRAND_FRAME_GRADIENT_START}
                end={BRAND_FRAME_GRADIENT_END}
                style={styles.backBtnBorder}
              >
                <GradientRingBackInner
                  darkMode={darkMode}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (selectedConversationId) {
                      handleBackFromChat();
                    } else {
                      onClose();
                    }
                  }}
                  style={[
                    styles.backBtn,
                    !darkMode && { backgroundColor: Colors.bg },
                  ]}
                >
                  <MaterialIcons
                    name="arrow-back"
                    size={24}
                    color={darkMode ? "#FFFFFF" : "#000000"}
                  />
                </GradientRingBackInner>
              </LinearGradient>
            </View>
            <View style={[styles.headerContent, selectedConversation && styles.headerContentChat]}>
              {selectedConversation ? (
                <>
                  <Text style={[styles.headerTitle, styles.headerTitleChat, lightText]}>
                    {selectedConversation.participantName}
                  </Text>
                  {selectedConversation.participantCompany && (
                    <Text style={[styles.headerSubtitle, styles.headerSubtitleChat, lightSub]}>
                      {selectedConversation.participantCompany}
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={[styles.headerTitle, lightText]}>Messages</Text>
                  <Text style={[styles.headerSubtitle, lightSub]}>
                    Contractor conversations and campaign responses
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Conditional Render: Chat View or Conversations List */}
          {selectedConversation ? (
            <>
              {/* Chat Messages */}
              <ScrollView
                ref={scrollViewRef}
                style={styles.chatScroll}
                contentContainerStyle={styles.chatScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                {chatMessages.length === 0 ? (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 }}>
                    <MaterialIcons
                      name="chat-bubble-outline"
                      size={64}
                      color={darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.sub}
                    />
                    <Text
                      style={[
                        { fontSize: 16, marginTop: 16, textAlign: 'center' },
                        darkMode ? { color: '#a7bed9' } : lightSub,
                      ]}
                    >
                      No messages yet.{'\n'}Start the conversation!
                    </Text>
                  </View>
                ) : (
                  chatMessages.map((message, index) => {
                    const isMe = message.senderName === currentUserName;
                    const showDate =
                      index === 0 ||
                      new Date(message.timestamp).toDateString() !==
                        new Date(chatMessages[index - 1].timestamp).toDateString();

                    return (
                      <View key={message.id}>
                        {showDate && (
                          <View style={styles.dateSeparatorWrap}>
                            <View style={styles.dateSeparatorPill}>
                              <Text style={[styles.dateSeparatorText, lightSub]}>
                                {new Date(message.timestamp).toLocaleDateString('en-US', {
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </Text>
                            </View>
                          </View>
                        )}
                        <View
                          style={[
                            styles.messageBlock,
                            isMe ? styles.messageBlockMe : styles.messageBlockThem,
                          ]}
                        >
                          <View
                            style={[
                              styles.messageBubble,
                              isMe ? styles.messageBubbleMe : styles.messageBubbleThem,
                              darkMode && !isMe && styles.messageBubbleThemDark,
                            ]}
                          >
                            <Text
                              style={[
                                styles.messageBubbleText,
                                isMe
                                  ? styles.messageBubbleTextMe
                                  : darkMode
                                    ? styles.messageBubbleTextThemDark
                                    : { color: Colors.text },
                              ]}
                            >
                              {message.content}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.messageTime,
                              isMe ? styles.messageTimeMe : styles.messageTimeThem,
                              !darkMode && { color: Colors.sub },
                            ]}
                          >
                            {formatTime(message.timestamp)}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              {/* Chat Input */}
              <View
                style={[
                  styles.chatInputBar,
                  {
                    paddingBottom: Math.max(insets.bottom, 14),
                    backgroundColor: darkMode ? '#000000' : Colors.bg,
                  },
                  !darkMode && { borderTopColor: Colors.line },
                ]}
              >
                <View style={styles.chatInputRow}>
                  <View style={styles.chatInputFlex}>
                    <LinearGradient
                      colors={[...BRAND_FRAME_GRADIENT_COLORS]}
                      start={BRAND_FRAME_GRADIENT_START}
                      end={BRAND_FRAME_GRADIENT_END}
                      style={styles.chatInputGradient}
                    >
                      <View
                        style={[
                          styles.chatInputInner,
                          { backgroundColor: darkMode ? '#0a0d12' : Colors.surface2 },
                        ]}
                      >
                        <TextInput
                          value={messageText}
                          onChangeText={setMessageText}
                          placeholder="Type a message..."
                          placeholderTextColor={darkMode ? 'rgba(148, 163, 184, 0.85)' : Colors.sub}
                          style={[
                            styles.chatTextInput,
                            { color: darkMode ? '#e9f1ff' : Colors.text },
                          ]}
                          multiline
                          maxLength={500}
                          textAlignVertical="center"
                        />
                      </View>
                    </LinearGradient>
                  </View>

                  <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
                    {/*
                      Never put opacity on the fill — gradient bleeds through if the fill is translucent.
                      Dark: black + white icon. Light: white fill + dark icon (see chatSendInnerLight).
                    */}
                    <View style={styles.chatSendWrap}>
                      <LinearGradient
                        pointerEvents="none"
                        colors={[...BRAND_FRAME_GRADIENT_COLORS]}
                        start={BRAND_FRAME_GRADIENT_START}
                        end={BRAND_FRAME_GRADIENT_END}
                        style={styles.chatSendGradientBg}
                      />
                      <Pressable
                        onPress={handleSendMessage}
                        disabled={!messageText.trim()}
                        android_ripple={
                          messageText.trim()
                            ? {
                                color: darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.12)',
                                foreground: true,
                              }
                            : undefined
                        }
                        style={[
                          styles.chatSendInnerBlack,
                          !darkMode && styles.chatSendInnerLight,
                          Platform.OS === 'android' && styles.chatSendInnerBlackAndroid,
                        ]}
                      >
                        <Ionicons
                          name="send"
                          size={17}
                          color={darkMode ? '#FFFFFF' : Colors.text}
                        />
                      </Pressable>
                    </View>
                  </Animated.View>
                </View>
              </View>
            </>
          ) : (
            <>
              {/* Conversations List */}
              {conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIconContainer,
                !darkMode && { backgroundColor: Colors.iconBg },
              ]}
            >
              <MaterialIcons
                name="message"
                size={58}
                color={darkMode ? '#a7bed9' : Colors.sub}
                style={{ opacity: darkMode ? 0.7 : 1 }}
              />
            </View>
            <Text style={[styles.emptyTitle, lightText]}>No Conversations Yet</Text>
            <Text style={[styles.emptySubtitle, lightSub]}>
              When contractors respond to your campaigns, send you a message, or when you message people, conversations will appear here.
            </Text>
            <Text style={[styles.emptyTip, lightSub]}>
              💡 Tip: Active campaigns receive faster responses
            </Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#43cea2"
              />
            }
            renderItem={({ item }) => {
              const hasUnread = item.unreadCount > 0;

              return (
                <Swipeable
                  renderRightActions={() => renderRightActions(item.id, item.participantName)}
                  overshootRight={false}
                  friction={2}
                >
                  <TouchableOpacity
                    style={[
                      styles.conversationCard,
                      darkMode
                        ? {
                            backgroundColor: conversationBackground,
                            borderColor: conversationBorder,
                          }
                        : {
                            backgroundColor: lightConversationSurface,
                            borderColor: lightConversationBorder,
                          },
                      hasUnread && darkMode && styles.conversationCardUnread,
                      hasUnread && !darkMode && styles.conversationCardUnreadLight,
                    ]}
                    onPress={() => handleConversationPress(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.avatarContainer}>
                      <View
                        style={[
                          styles.avatar,
                          !darkMode && {
                            backgroundColor: Colors.iconBg,
                            borderColor: 'rgba(13, 148, 136, 0.35)',
                          },
                        ]}
                      >
                        <MaterialIcons
                          name="person"
                          size={26}
                          color={darkMode ? 'rgba(94, 234, 212, 0.75)' : Colors.sub}
                        />
                      </View>
                      {hasUnread && (
                        <View
                          style={[
                            styles.unreadDot,
                            { borderColor: unreadBorder, backgroundColor: unreadBackground },
                          ]}
                        />
                      )}
                    </View>

                    <View style={styles.conversationInfo}>
                      <View style={styles.conversationHeader}>
                        <Text style={[styles.participantName, lightText]} numberOfLines={1}>
                          {item.participantName}
                        </Text>
                        <View style={styles.timestampContainer}>
                          <Text style={[styles.timestamp, lightSub]}>
                            {getTimeAgo(item.updatedAt)}
                          </Text>
                          {hasUnread && (
                            <View style={styles.unreadIndicator} />
                          )}
                        </View>
                      </View>

                      {item.participantCompany && (
                        <Text style={[styles.companyName, lightSub]} numberOfLines={1}>
                          {item.participantCompany}
                        </Text>
                      )}

                      <View style={styles.conversationFooter}>
                        <Text style={[styles.lastMessage, lightSub]} numberOfLines={1}>
                          {item.lastMessage?.content || 'No messages yet'}
                        </Text>
                        {hasUnread && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <MaterialIcons
                      name="chevron-right"
                      size={24}
                      color={darkMode ? '#a7bed9' : Colors.sub}
                    />
                  </TouchableOpacity>
                </Swipeable>
              );
            }}
          />
        )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtnWrapper: {
    marginRight: 12,
  },
  backBtnBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: 'hidden',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 19,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  headerContentChat: {
    paddingTop: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerTitleChat: {
    fontSize: 18,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E2E8F0',
    marginTop: 2,
  },
  headerSubtitleChat: {
    fontSize: 13,
    color: 'rgba(203, 213, 225, 0.82)',
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#e9f1ff',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#a7bed9',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyTip: {
    fontSize: 13,
    color: '#8DA0B8',
    textAlign: 'center',
    marginTop: 8,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.42)',
  },
  conversationCardUnread: {
    backgroundColor: 'rgba(20, 184, 166, 0.09)',
    borderColor: 'rgba(45, 255, 196, 0.58)',
  },
  conversationCardUnreadLight: {
    backgroundColor: 'rgba(16, 185, 129, 0.07)',
    borderColor: 'rgba(13, 148, 136, 0.42)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#43cea2',
    borderWidth: 2,
    borderColor: '#0b1c38',
  },
  conversationInfo: {
    flex: 1,
    marginRight: 8,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e9f1ff',
    flex: 1,
    marginRight: 8,
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timestamp: {
    fontSize: 11,
    color: 'rgba(186, 199, 216, 0.9)',
  },
  unreadIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#43cea2',
  },
  companyName: {
    fontSize: 13,
    color: 'rgba(186, 199, 216, 0.88)',
    marginBottom: 5,
  },
  conversationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  lastMessage: {
    fontSize: 13,
    color: 'rgba(203, 213, 225, 0.78)',
    flex: 1,
    marginRight: 10,
    lineHeight: 18,
  },
  unreadBadge: {
    backgroundColor: '#14B8A6',
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  unreadCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#042f2e',
  },
  chatScroll: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  chatScrollContent: {
    paddingBottom: 28,
    paddingTop: 8,
  },
  dateSeparatorWrap: {
    alignItems: 'center',
    marginVertical: 20,
  },
  dateSeparatorPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dateSeparatorText: {
    color: 'rgba(186, 199, 216, 0.92)',
    fontSize: 12,
    fontWeight: '600',
  },
  messageBlock: {
    maxWidth: '78%',
    marginBottom: 16,
  },
  messageBlockMe: {
    alignSelf: 'flex-end',
  },
  messageBlockThem: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 18,
  },
  messageBubbleMe: {
    backgroundColor: '#0f766e',
    borderBottomRightRadius: 5,
    borderBottomLeftRadius: 18,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  messageBubbleThem: {
    backgroundColor: 'rgba(148, 163, 184, 0.14)',
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 18,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  messageBubbleThemDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  messageBubbleText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageBubbleTextMe: {
    color: '#ecfdf5',
  },
  messageBubbleTextThemDark: {
    color: '#e9f1ff',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 5,
  },
  messageTimeMe: {
    textAlign: 'right',
    color: 'rgba(148, 163, 184, 0.88)',
  },
  messageTimeThem: {
    textAlign: 'left',
    color: 'rgba(148, 163, 184, 0.88)',
  },
  chatInputBar: {
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  chatInputFlex: {
    flex: 1,
  },
  chatInputGradient: {
    borderRadius: 22,
    padding: 1,
    overflow: 'hidden',
  },
  chatInputInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 21,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
  },
  chatTextInput: {
    flex: 1,
    fontSize: 15,
    paddingRight: 8,
    paddingVertical: 0,
    maxHeight: 100,
    lineHeight: 20,
  },
  chatSendWrap: {
    width: 46,
    height: 46,
    position: 'relative',
  },
  chatSendGradientBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 23,
    zIndex: 0,
  },
  /** Inset 1px so gradient only shows as ring; solid black must stay full opacity (no parent opacity). */
  chatSendInnerBlack: {
    position: 'absolute',
    left: 1,
    top: 1,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    overflow: 'hidden',
  },
  chatSendInnerLight: {
    backgroundColor: '#FFFFFF',
  },
  chatSendInnerBlackAndroid: {
    elevation: 6,
  },
  deleteButton: {
    backgroundColor: '#FF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    height: '100%',
    borderRadius: 16,
    marginBottom: 12,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
});

