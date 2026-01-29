import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  content: string;
  timestamp: string;
  read: boolean;
  type: 'text' | 'image' | 'file';
}

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantCompany?: string;
  participantPhone?: string;
  participantEmail?: string;
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  userRole: 'contractor' | 'subcontractor'; // Who is the current user in this conversation?
}

interface ChatContextType {
  conversations: Conversation[];
  messages: { [conversationId: string]: Message[] };
  sendMessage: (conversationId: string, content: string, recipientId: string, recipientName: string, senderName: string) => Promise<void>;
  createConversation: (participantId: string, participantName: string, participantCompany?: string, participantPhone?: string, participantEmail?: string, userRole?: 'contractor' | 'subcontractor') => Promise<string>;
  getConversation: (conversationId: string) => Conversation | undefined;
  getMessages: (conversationId: string) => Message[];
  markAsRead: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  loadConversations: () => Promise<void>;
  currentUserName: string;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const CONVERSATIONS_KEY = '@chat_conversations';
const MESSAGES_KEY = '@chat_messages';

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<{ [conversationId: string]: Message[] }>({});
  const [currentUserId] = useState('contractor-demo'); // Replace with actual user ID from auth
  const [currentUserName] = useState('Build Profit Solutions'); // Replace with actual user name from profile/auth

  // Load conversations from storage
  const loadConversations = async () => {
    try {
      const stored = await AsyncStorage.getItem(CONVERSATIONS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // Migration: Add userRole to old conversations that don't have it
        const migrated = parsed.map((conv: any) => {
          if (!conv.userRole) {
            console.log('🔄 Migrating conversation:', conv.id, '- adding userRole: contractor');
            return { ...conv, userRole: 'contractor' };
          }
          return conv;
        });
        
        // Save migrated data if changed
        if (JSON.stringify(parsed) !== JSON.stringify(migrated)) {
          await saveConversations(migrated);
          console.log('✅ Migrated', migrated.length, 'conversations');
        }
        
        setConversations(migrated);
      }

      const storedMessages = await AsyncStorage.getItem(MESSAGES_KEY);
      if (storedMessages) {
        const parsed = JSON.parse(storedMessages);
        setMessages(parsed);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  // Save conversations to storage
  const saveConversations = async (convos: Conversation[]) => {
    try {
      await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(convos));
    } catch (error) {
      console.error('Error saving conversations:', error);
    }
  };

  // Save messages to storage
  const saveMessages = async (msgs: { [conversationId: string]: Message[] }) => {
    try {
      await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(msgs));
    } catch (error) {
      console.error('Error saving messages:', error);
    }
  };

  // Create a new conversation
  const createConversation = async (
    participantId: string,
    participantName: string,
    participantCompany?: string,
    participantPhone?: string,
    participantEmail?: string,
    userRole: 'contractor' | 'subcontractor' = 'contractor' // Default to contractor
  ): Promise<string> => {
    console.log('💬 ChatContext: createConversation called');
    console.log('📋 Participant:', participantName, participantId);
    console.log('👤 User Role:', userRole);
    
    // Check if conversation already exists
    const existing = conversations.find(c => c.participantId === participantId);
    if (existing) {
      console.log('✅ Found existing conversation:', existing.id);
      return existing.id;
    }

    const newConversation: Conversation = {
      id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      participantId,
      participantName,
      participantCompany,
      participantPhone,
      participantEmail,
      unreadCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userRole, // Store the user's role in this conversation
    };

    console.log('✅ Created new conversation:', newConversation.id);

    const updated = [newConversation, ...conversations];
    setConversations(updated);
    await saveConversations(updated);

    return newConversation.id;
  };

  // Send a message
  const sendMessage = async (
    conversationId: string,
    content: string,
    recipientId: string,
    recipientName: string,
    senderName: string
  ) => {
    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      senderId: currentUserId,
      senderName: senderName || currentUserName, // Use provided sender name or default to current user
      recipientId,
      recipientName,
      content,
      timestamp: new Date().toISOString(),
      read: false,
      type: 'text',
    };

    // Add message to messages
    const conversationMessages = messages[conversationId] || [];
    const updatedMessages = {
      ...messages,
      [conversationId]: [...conversationMessages, newMessage],
    };
    setMessages(updatedMessages);
    await saveMessages(updatedMessages);

    // Update conversation with last message
    const updatedConversations = conversations.map(conv => {
      if (conv.id === conversationId) {
        return {
          ...conv,
          lastMessage: newMessage,
          updatedAt: new Date().toISOString(),
        };
      }
      return conv;
    });
    setConversations(updatedConversations);
    await saveConversations(updatedConversations);

    console.log('📤 Message sent:', newMessage);
  };

  // Get conversation by ID
  const getConversation = (conversationId: string) => {
    return conversations.find(c => c.id === conversationId);
  };

  // Get messages for a conversation
  const getMessages = (conversationId: string) => {
    return messages[conversationId] || [];
  };

  // Mark conversation as read
  const markAsRead = async (conversationId: string) => {
    const updatedConversations = conversations.map(conv => {
      if (conv.id === conversationId) {
        return { ...conv, unreadCount: 0 };
      }
      return conv;
    });
    setConversations(updatedConversations);
    await saveConversations(updatedConversations);

    // Mark all messages as read
    const conversationMessages = messages[conversationId] || [];
    const updatedMessages = {
      ...messages,
      [conversationId]: conversationMessages.map(msg => ({ ...msg, read: true })),
    };
    setMessages(updatedMessages);
    await saveMessages(updatedMessages);
  };

  // Delete conversation
  const deleteConversation = async (conversationId: string) => {
    const updatedConversations = conversations.filter(c => c.id !== conversationId);
    setConversations(updatedConversations);
    await saveConversations(updatedConversations);

    // Delete messages
    const updatedMessages = { ...messages };
    delete updatedMessages[conversationId];
    setMessages(updatedMessages);
    await saveMessages(updatedMessages);
  };

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        messages,
        sendMessage,
        createConversation,
        getConversation,
        getMessages,
        markAsRead,
        deleteConversation,
        loadConversations,
        currentUserName,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

