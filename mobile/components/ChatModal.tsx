import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useChat, Message } from '../contexts/ChatContext';

interface ChatModalProps {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  participantName: string;
  participantCompany?: string;
}

export function ChatModal({
  visible,
  onClose,
  conversationId,
  participantName,
  participantCompany,
}: ChatModalProps) {
  console.log('💬 ChatModal rendered - visible:', visible, 'conversationId:', conversationId);
  
  const { getMessages, sendMessage, markAsRead, getConversation, currentUserName, messages: contextMessages } = useChat();
  const [messageText, setMessageText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  // Get messages from context - this will update automatically when new messages are sent
  const messages = conversationId ? (contextMessages[conversationId] || []) : [];
  
  // Get the conversation to determine user role
  const conversation = getConversation(conversationId);
  const userRole = conversation?.userRole || 'contractor';
  
  console.log('🔍 ChatModal - conversationId:', conversationId);
  console.log('🔍 ChatModal - conversation:', conversation);
  console.log('🔍 ChatModal - userRole:', userRole);

  // Mark as read when conversation opens
  useEffect(() => {
    if (visible && conversationId) {
      markAsRead(conversationId);
    }
  }, [visible, conversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollViewRef.current && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim()) return;

    const conversation = getConversation(conversationId);
    if (!conversation) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Clear input immediately for better UX
    const messageToSend = messageText.trim();
    setMessageText('');

    // Send message - always as yourself (Build Profit Solutions)
    await sendMessage(
      conversationId,
      messageToSend,
      conversation.participantId,
      conversation.participantName,
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

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <LinearGradient
        colors={['#0A1A3A', '#0F7158']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1 }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          {/* Header */}
          <View
            style={{
              paddingTop: 60,
              paddingBottom: 16,
              paddingHorizontal: 20,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(67, 206, 162, 0.2)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <MaterialIcons name="arrow-back" size={24} color="#43cea2" />
              </TouchableOpacity>

              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={{ color: '#e9f1ff', fontSize: 18, fontWeight: '700' }}>
                  {participantName}
                </Text>
                {participantCompany && (
                  <Text style={{ color: '#a7bed9', fontSize: 14, marginTop: 2 }}>
                    {participantCompany}
                  </Text>
                )}
              </View>

            </View>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 16 }}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {messages.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 }}>
                <MaterialIcons name="chat-bubble-outline" size={64} color="rgba(255, 255, 255, 0.2)" />
                <Text style={{ color: '#a7bed9', fontSize: 16, marginTop: 16, textAlign: 'center' }}>
                  No messages yet.{'\n'}Start the conversation!
                </Text>
              </View>
            ) : (
              messages.map((message, index) => {
                // Standard chat logic: Your messages = GREEN on RIGHT, Their messages = GRAY on LEFT
                const isMe = message.senderName === currentUserName;
                const showDate =
                  index === 0 ||
                  new Date(message.timestamp).toDateString() !==
                    new Date(messages[index - 1].timestamp).toDateString();

                return (
                  <View key={message.id}>
                    {/* Date separator */}
                    {showDate && (
                      <View style={{ alignItems: 'center', marginVertical: 16 }}>
                        <View
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 12,
                          }}
                        >
                          <Text style={{ color: '#a7bed9', fontSize: 12 }}>
                            {new Date(message.timestamp).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Message bubble */}
                    <View
                      style={{
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        maxWidth: '75%',
                        marginBottom: 12,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: isMe ? '#43cea2' : 'rgba(255, 255, 255, 0.1)',
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          borderRadius: 16,
                          borderBottomRightRadius: isMe ? 4 : 16,
                          borderBottomLeftRadius: isMe ? 16 : 4,
                        }}
                      >
                        <Text style={{ color: isMe ? '#0d2745' : '#e9f1ff', fontSize: 16 }}>
                          {message.content}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: '#6B7280',
                          fontSize: 11,
                          marginTop: 4,
                          textAlign: isMe ? 'right' : 'left',
                        }}
                      >
                        {formatTime(message.timestamp)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Input */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(10, 26, 58, 0.95)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 24,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(67, 206, 162, 0.3)',
                }}
              >
                <TextInput
                  value={messageText}
                  onChangeText={setMessageText}
                  placeholder="Type a message..."
                  placeholderTextColor="#6B7280"
                  style={{ color: '#e9f1ff', fontSize: 16 }}
                  multiline
                  maxLength={500}
                />
              </View>

              <TouchableOpacity
                onPress={handleSend}
                disabled={!messageText.trim()}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: messageText.trim() ? '#43cea2' : 'rgba(107, 114, 128, 0.3)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <MaterialIcons name="send" size={24} color={messageText.trim() ? '#0d2745' : '#6B7280'} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Modal>
  );
}

