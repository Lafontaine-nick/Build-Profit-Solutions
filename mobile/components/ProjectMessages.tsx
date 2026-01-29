import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';

// Types
export type Message = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'file' | 'system';
  attachments?: {
    id: string;
    name: string;
    type: string;
    size: number;
    url?: string;
  }[];
  reactions?: {
    emoji: string;
    users: string[];
  }[];
  isRead: boolean;
  replyTo?: string;
  edited?: boolean;
};

export type ChatChannel = {
  id: string;
  name: string;
  type: 'general' | 'team' | 'client' | 'subcontractor';
  description?: string;
  members: string[];
  lastMessage?: Message;
  unreadCount: number;
  isActive: boolean;
};

export type MessagesData = {
  projectId: string;
  channels: ChatChannel[];
  messages: Record<string, Message[]>;
  currentChannel: string;
};

// Mock data
const mockMessagesData: MessagesData = {
  projectId: 'proj_demo',
  currentChannel: 'general',
  channels: [
    {
      id: 'general',
      name: 'General Discussion',
      type: 'general',
      description: 'Main project communication',
      members: ['user1', 'user2', 'user3', 'user4', 'user5'],
      unreadCount: 3,
      isActive: true,
      lastMessage: {
        id: 'msg1',
        senderId: 'user2',
        senderName: 'Carlos Rodriguez',
        content:
          'Foundation work is progressing well. Should be done by Friday.',
        timestamp: '2025-02-10T14:30:00Z',
        type: 'text',
        isRead: false,
      },
    },
    {
      id: 'team',
      name: 'Team Updates',
      type: 'team',
      description: 'Internal team coordination',
      members: ['user1', 'user2', 'user3'],
      unreadCount: 1,
      isActive: true,
      lastMessage: {
        id: 'msg2',
        senderId: 'user1',
        senderName: 'Mike Johnson',
        content: 'Safety meeting tomorrow at 7 AM. Please confirm attendance.',
        timestamp: '2025-02-10T16:45:00Z',
        type: 'text',
        isRead: false,
      },
    },
    {
      id: 'client',
      name: 'Client Communication',
      type: 'client',
      description: 'Updates for project owner',
      members: ['user1', 'client1'],
      unreadCount: 0,
      isActive: true,
      lastMessage: {
        id: 'msg3',
        senderId: 'client1',
        senderName: 'Sarah Chen',
        content: 'Thanks for the progress photos! The framing looks great.',
        timestamp: '2025-02-09T10:15:00Z',
        type: 'text',
        isRead: true,
      },
    },
  ],
  messages: {
    general: [
      {
        id: 'msg1',
        senderId: 'user2',
        senderName: 'Carlos Rodriguez',
        content:
          'Foundation work is progressing well. Should be done by Friday.',
        timestamp: '2025-02-10T14:30:00Z',
        type: 'text',
        isRead: false,
      },
      {
        id: 'msg4',
        senderId: 'user3',
        senderName: 'James Wilson',
        content:
          'Electrical rough-in scheduled for next week. Need to coordinate with plumbing.',
        timestamp: '2025-02-10T11:20:00Z',
        type: 'text',
        isRead: true,
      },
      {
        id: 'msg5',
        senderId: 'user4',
        senderName: 'David Chen',
        content: 'Custom cabinets are ready for installation. Photos attached.',
        timestamp: '2025-02-09T15:45:00Z',
        type: 'image',
        attachments: [
          {
            id: 'att1',
            name: 'cabinet-photo.jpg',
            type: 'image/jpeg',
            size: 2048000,
          },
        ],
        isRead: true,
      },
    ],
    team: [
      {
        id: 'msg2',
        senderId: 'user1',
        senderName: 'Mike Johnson',
        content: 'Safety meeting tomorrow at 7 AM. Please confirm attendance.',
        timestamp: '2025-02-10T16:45:00Z',
        type: 'text',
        isRead: false,
      },
    ],
    client: [
      {
        id: 'msg3',
        senderId: 'client1',
        senderName: 'Sarah Chen',
        content: 'Thanks for the progress photos! The framing looks great.',
        timestamp: '2025-02-09T10:15:00Z',
        type: 'text',
        isRead: true,
      },
    ],
  },
};

export default function ProjectMessages({
  data = mockMessagesData,
  onUpdate,
}: {
  data?: MessagesData;
  onUpdate?: (data: MessagesData) => void;
}) {
  const { darkMode } = useTheme();
  const [channels, setChannels] = useState<ChatChannel[]>(data.channels);
  const [messages, setMessages] = useState<Record<string, Message[]>>(
    data.messages
  );
  const [currentChannel, setCurrentChannel] = useState<string>(
    data.currentChannel
  );
  const [newMessage, setNewMessage] = useState('');
  const [showChannels, setShowChannels] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const theme = darkMode
    ? {
        background: '#0b1c38',
        card: '#1B365D',
        text: '#f1f5f9',
        subtext: '#cbd5e1',
        border: 'rgba(255, 255, 255, 0.1)',
        accent: '#43cea2',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
      }
    : {
        background: '#f5f7fa',
        card: '#ffffff',
        text: '#1e293b',
        subtext: '#64748b',
        border: 'rgba(0, 0, 0, 0.1)',
        accent: '#1976d2',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
      };

  const currentMessages = messages[currentChannel] || [];
  const currentChannelData = channels.find(c => c.id === currentChannel);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const message: Message = {
      id: `msg${Date.now()}`,
      senderId: 'current-user',
      senderName: 'You',
      content: newMessage.trim(),
      timestamp: new Date().toISOString(),
      type: 'text',
      isRead: true,
    };

    const updatedMessages = {
      ...messages,
      [currentChannel]: [message, ...(messages[currentChannel] || [])],
    };

    setMessages(updatedMessages);
    setNewMessage('');

    // Update channel's last message
    const updatedChannels = channels.map(channel =>
      channel.id === currentChannel
        ? { ...channel, lastMessage: message, unreadCount: 0 }
        : channel
    );

    setChannels(updatedChannels);
    onUpdate?.({
      ...data,
      channels: updatedChannels,
      messages: updatedMessages,
    });

    // Scroll to top
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };

  const addReaction = (messageId: string, emoji: string) => {
    const channelMessages = messages[currentChannel] || [];
    const updatedChannelMessages = channelMessages.map(msg => {
      if (msg.id === messageId) {
        const existingReactions = msg.reactions || [];
        const existingReaction = existingReactions.find(r => r.emoji === emoji);

        if (existingReaction) {
          // Toggle reaction
          const updatedReactions = existingReactions.map(r =>
            r.emoji === emoji
              ? {
                  ...r,
                  users: r.users.includes('current-user')
                    ? r.users.filter(u => u !== 'current-user')
                    : [...r.users, 'current-user'],
                }
              : r
          );
          return { ...msg, reactions: updatedReactions };
        } else {
          // Add new reaction
          return {
            ...msg,
            reactions: [
              ...existingReactions,
              { emoji, users: ['current-user'] },
            ],
          };
        }
      }
      return msg;
    });

    setMessages({
      ...messages,
      [currentChannel]: updatedChannelMessages,
    });
  };

  const switchChannel = (channelId: string) => {
    setCurrentChannel(channelId);
    setShowChannels(false);

    // Mark messages as read
    const updatedChannels = channels.map(channel =>
      channel.id === channelId ? { ...channel, unreadCount: 0 } : channel
    );
    setChannels(updatedChannels);
  };

  const renderMessage = (message: Message) => {
    const isOwnMessage = message.senderId === 'current-user';
    const hasReactions = message.reactions && message.reactions.length > 0;

    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        {!isOwnMessage && (
          <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
            <Text style={styles.avatarText}>
              {message.senderName
                .split(' ')
                .map(n => n[0])
                .join('')}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isOwnMessage ? theme.accent : theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          {!isOwnMessage && (
            <Text style={[styles.senderName, { color: theme.accent }]}>
              {message.senderName}
            </Text>
          )}

          <Text
            style={[
              styles.messageText,
              { color: isOwnMessage ? '#fff' : theme.text },
            ]}
          >
            {message.content}
          </Text>

          {message.attachments && message.attachments.length > 0 && (
            <View style={styles.attachments}>
              {message.attachments.map(attachment => (
                <Pressable
                  key={attachment.id}
                  style={[
                    styles.attachment,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() =>
                    Alert.alert('File', `Opening ${attachment.name}`)
                  }
                >
                  <MaterialIcons
                    name={
                      attachment.type.startsWith('image/')
                        ? 'image'
                        : 'attach-file'
                    }
                    size={20}
                    color={theme.accent}
                  />
                  <Text
                    style={[styles.attachmentName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {attachment.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.timestamp,
                {
                  color: isOwnMessage ? 'rgba(255,255,255,0.7)' : theme.subtext,
                },
              ]}
            >
              {formatTime(message.timestamp)}
              {message.edited && ' (edited)'}
            </Text>

            {isOwnMessage && (
              <View
                style={[styles.readStatus, { backgroundColor: theme.success }]}
              />
            )}
          </View>

          {hasReactions && (
            <View style={styles.reactions}>
              {message.reactions!.map((reaction, index) => (
                <Pressable
                  key={index}
                  style={[
                    styles.reaction,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => addReaction(message.id, reaction.emoji)}
                >
                  <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                  <Text style={[styles.reactionCount, { color: theme.text }]}>
                    {reaction.users.length}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {!isOwnMessage && (
          <View style={styles.reactionButtons}>
            <Pressable
              style={styles.reactionButton}
              onPress={() => addReaction(message.id, '👍')}
            >
              <Text style={styles.reactionButtonText}>👍</Text>
            </Pressable>
            <Pressable
              style={styles.reactionButton}
              onPress={() => addReaction(message.id, '❤️')}
            >
              <Text style={styles.reactionButtonText}>❤️</Text>
            </Pressable>
            <Pressable
              style={styles.reactionButton}
              onPress={() => addReaction(message.id, '😂')}
            >
              <Text style={styles.reactionButtonText}>😂</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const renderChannelList = () => (
    <View
      style={[
        styles.channelList,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.channelListHeader}>
        <Text style={[styles.channelListTitle, { color: theme.text }]}>
          Channels
        </Text>
        <Pressable onPress={() => setShowChannels(false)}>
          <MaterialIcons name='close' size={24} color={theme.text} />
        </Pressable>
      </View>

      {channels.map(channel => (
        <Pressable
          key={channel.id}
          style={[
            styles.channelItem,
            {
              backgroundColor:
                currentChannel === channel.id ? theme.accent : 'transparent',
              borderColor: theme.border,
            },
          ]}
          onPress={() => switchChannel(channel.id)}
        >
          <View style={styles.channelInfo}>
            <Text
              style={[
                styles.channelName,
                { color: currentChannel === channel.id ? '#fff' : theme.text },
              ]}
            >
              {channel.name}
            </Text>
            <Text
              style={[
                styles.channelDescription,
                {
                  color:
                    currentChannel === channel.id
                      ? 'rgba(255,255,255,0.8)'
                      : theme.subtext,
                },
              ]}
            >
              {channel.description}
            </Text>
            {channel.lastMessage && (
              <Text
                style={[
                  styles.lastMessage,
                  {
                    color:
                      currentChannel === channel.id
                        ? 'rgba(255,255,255,0.7)'
                        : theme.subtext,
                  },
                ]}
                numberOfLines={1}
              >
                {channel.lastMessage.senderName}: {channel.lastMessage.content}
              </Text>
            )}
          </View>

          {channel.unreadCount > 0 && (
            <View
              style={[styles.unreadBadge, { backgroundColor: theme.error }]}
            >
              <Text style={styles.unreadCount}>{channel.unreadCount}</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Pressable
          style={styles.channelSelector}
          onPress={() => setShowChannels(!showChannels)}
        >
          <Text style={[styles.currentChannelName, { color: theme.text }]}>
            {currentChannelData?.name || 'Select Channel'}
          </Text>
          <MaterialIcons name='arrow-drop-down' size={24} color={theme.text} />
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable style={styles.headerButton}>
            <MaterialIcons name='search' size={24} color={theme.text} />
          </Pressable>
          <Pressable style={styles.headerButton}>
            <MaterialIcons name='more-vert' size={24} color={theme.text} />
          </Pressable>
        </View>
      </View>

      {/* Channel List Overlay */}
      {showChannels && renderChannelList()}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {currentMessages.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name='chat' size={48} color={theme.subtext} />
            <Text style={[styles.emptyStateText, { color: theme.subtext }]}>
              No messages yet. Start the conversation!
            </Text>
          </View>
        ) : (
          currentMessages.map(renderMessage)
        )}
      </ScrollView>

      {/* Message Input */}
      <View
        style={[
          styles.inputContainer,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Pressable
          style={[
            styles.attachButton,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
          onPress={() => setShowFilePicker(true)}
        >
          <MaterialIcons name='attach-file' size={24} color={theme.text} />
        </Pressable>

        <TextInput
          style={[
            styles.messageInput,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder='Type a message...'
          placeholderTextColor={theme.subtext}
          multiline
          maxLength={1000}
        />

        <Pressable
          style={[
            styles.sendButton,
            {
              backgroundColor: newMessage.trim() ? theme.accent : theme.subtext,
            },
          ]}
          onPress={sendMessage}
          disabled={!newMessage.trim()}
        >
          <MaterialIcons name='send' size={24} color='#fff' />
        </Pressable>
      </View>

      {/* File Picker Modal */}
      {showFilePicker && (
        <View
          style={[
            styles.filePickerOverlay,
            { backgroundColor: 'rgba(0,0,0,0.5)' },
          ]}
        >
          <View
            style={[
              styles.filePicker,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.filePickerTitle, { color: theme.text }]}>
              Attach File
            </Text>

            <Pressable
              style={[styles.fileOption, { borderColor: theme.border }]}
              onPress={() => {
                Alert.alert('Camera', 'Camera functionality would open here');
                setShowFilePicker(false);
              }}
            >
              <MaterialIcons name='camera-alt' size={24} color={theme.accent} />
              <Text style={[styles.fileOptionText, { color: theme.text }]}>
                Take Photo
              </Text>
            </Pressable>

            <Pressable
              style={[styles.fileOption, { borderColor: theme.border }]}
              onPress={() => {
                Alert.alert('Gallery', 'Photo gallery would open here');
                setShowFilePicker(false);
              }}
            >
              <MaterialIcons
                name='photo-library'
                size={24}
                color={theme.accent}
              />
              <Text style={[styles.fileOptionText, { color: theme.text }]}>
                Choose from Gallery
              </Text>
            </Pressable>

            <Pressable
              style={[styles.fileOption, { borderColor: theme.border }]}
              onPress={() => {
                Alert.alert('Files', 'File picker would open here');
                setShowFilePicker(false);
              }}
            >
              <MaterialIcons name='folder' size={24} color={theme.accent} />
              <Text style={[styles.fileOptionText, { color: theme.text }]}>
                Choose File
              </Text>
            </Pressable>

            <Pressable
              style={[styles.cancelButton, { borderColor: theme.border }]}
              onPress={() => setShowFilePicker(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  channelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currentChannelName: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },

  // Channel List
  channelList: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    borderBottomWidth: 1,
    maxHeight: 300,
  },
  channelListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  channelListTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  channelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  channelDescription: {
    fontSize: 12,
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 12,
  },
  unreadBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Messages
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 16,
    marginTop: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  ownMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  attachments: {
    marginTop: 8,
    gap: 8,
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  attachmentName: {
    flex: 1,
    fontSize: 14,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
  },
  readStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 4,
  },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  reactionButtons: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
  },
  reactionButton: {
    padding: 4,
  },
  reactionButtonText: {
    fontSize: 16,
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    gap: 8,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // File Picker
  filePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  filePicker: {
    width: '80%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  filePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  fileOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  fileOptionText: {
    fontSize: 16,
  },
  cancelButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
