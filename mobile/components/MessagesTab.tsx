// Expo/React Native — Upgraded Messages tab for Build Profit Solutions

import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';

// ---------------- Theme ----------------
const Colors = {
  bg: "#0d2745",
  card: "#173659",
  text: "#e9f1ff",
  sub: "#a7bed9",
  line: "#1f3c66",
  green: "#38d39f",
  yellow: "#ffd166",
  blue: "#6aa9ff",
  red: "#ff6b6b",
  chip: "#104170",
};

// ---------------- Types ----------------
type MsgType = "update" | "request" | "info";
type MsgStatus = "open" | "resolved";
type LinkedEntity =
  | { type: "milestone"; id: string; title: string }
  | { type: "budget"; id: string; title: string }
  | null;

interface Attachment {
  id: string;
  kind: "photo" | "file";
  uri?: string;
  name?: string;
}

interface Reply {
  id: string;
  author: string;
  body: string;
  createdAt: string; // ISO
}

interface Message {
  id: string;
  author: string;
  avatarEmoji?: string; // simple visual without images
  type: MsgType;
  body: string;
  createdAt: string; // ISO
  status: MsgStatus;
  pinned?: boolean;
  mentions?: string[]; // ["@Mike", "@Electricians"]
  attachments?: Attachment[];
  linked?: LinkedEntity;
  replies?: Reply[];
}

// ---------------- Demo Data ----------------
const DEMO: Message[] = [
  {
    id: "m1",
    author: "John Smith",
    avatarEmoji: "📊",
    type: "update",
    body: "Foundation work completed ahead of schedule. Ready for framing.",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: "resolved",
    attachments: [
      { id: "a1", kind: "photo", uri: "https://picsum.photos/seed/fnd/120/80" },
      { id: "a2", kind: "photo", uri: "https://picsum.photos/seed/fnd2/120/80" },
    ],
    linked: { type: "milestone", id: "ms2", title: "Foundation Complete" },
  },
  {
    id: "m2",
    author: "Mike Johnson",
    avatarEmoji: "⚠️",
    type: "request",
    body: "Need approval for additional concrete order. Budget impact: $2,400",
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    status: "open",
    mentions: ["@PM", "@ConcreteCrew"],
    linked: { type: "budget", id: "b12", title: "Concrete - Slab" },
    replies: [
      {
        id: "r1",
        author: "John Smith",
        body: "Please attach supplier quote.",
        createdAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: "m3",
    author: "Sarah Wilson",
    avatarEmoji: "ℹ️",
    type: "info",
    body: "Electrical inspection scheduled for next Tuesday at 2 PM.",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: "open",
    pinned: true,
    linked: { type: "milestone", id: "ms4", title: "Electrical & Plumbing" },
  },
  {
    id: "m4",
    author: "Tom Brown",
    avatarEmoji: "📊",
    type: "update",
    body: "Plumbing rough-in completed. Photos uploaded to project folder.",
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    status: "resolved",
  },
];

// ---------------- Helpers ----------------
const typeMeta: Record<
  MsgType,
  { label: string; bg: string; icon: string }
> = {
  update: { label: "UPDATE", bg: Colors.green, icon: "✅" },
  request: { label: "REQUEST", bg: Colors.yellow, icon: "⚠️" },
  info: { label: "INFO", bg: Colors.blue, icon: "ℹ️" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

// ---------------- Chips ----------------
const Chip = ({
  text,
  bg = Colors.chip,
  onPress,
  active = false,
}: {
  text: string;
  bg?: string;
  active?: boolean;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.chip,
      { backgroundColor: bg, borderColor: active ? Colors.green : Colors.line },
    ]}
  >
    <Text style={[styles.chipText, active && { color: Colors.text }]}>
      {text}
    </Text>
  </TouchableOpacity>
);

// ---------------- Message Card ----------------
const AttachmentPreview = ({ a }: { a: Attachment }) => {
  if (a.kind === "photo" && a.uri) {
    return <Image source={{ uri: a.uri }} style={styles.attachmentImg} />;
  }
  return (
    <View style={styles.attachmentFile}>
      <Text style={{ color: Colors.text, fontWeight: "700" }}>📎 {a.name ?? "File"}</Text>
    </View>
  );
};

const LinkedChip = ({ linked, onNavigate }: { linked: LinkedEntity; onNavigate?: (entity: LinkedEntity) => void }) => {
  if (!linked) return null;
  const label =
    linked.type === "milestone" ? `📅 Milestone: ${linked.title}` : `💰 Budget: ${linked.title}`;
  return (
    <Chip 
      text={`🔗 ${label}`} 
      onPress={() => {
        if (onNavigate) {
          onNavigate(linked);
        } else {
          Alert.alert("Navigate", `Open ${linked.type}: ${linked.title}`);
        }
      }} 
    />
  );
};

function MessageCard({
  msg,
  expanded,
  onToggleExpand,
  onApprove,
  onDeny,
  onPinToggle,
  onNavigate,
}: {
  msg: Message;
  expanded?: boolean;
  onToggleExpand: () => void;
  onApprove: () => void;
  onDeny: () => void;
  onPinToggle: () => void;
  onNavigate?: (entity: LinkedEntity) => void;
}) {
  const meta = typeMeta[msg.type];
  const [replyText, setReplyText] = useState("");

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onToggleExpand} style={styles.card}>
      {/* Header */}
      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <View style={styles.avatar}><Text style={{ fontSize: 16 }}>{msg.avatarEmoji ?? "🧑"}</Text></View>
          <View>
            <View style={styles.row}>
              <Text style={styles.author}>{msg.author}</Text>
              <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                <Text style={styles.badgeText}>{meta.label}</Text>
              </View>
              {msg.pinned && (
                <View style={[styles.badge, { backgroundColor: Colors.chip }]}>
                  <Text style={styles.badgeText}>📌 PINNED</Text>
                </View>
              )}
            </View>
            <Text style={styles.time}>{timeAgo(msg.createdAt)}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={onPinToggle}>
          <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: "600" }}>{msg.pinned ? "Unpin" : "Pin"}</Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      <Text style={styles.body}>
        {msg.body}
        {" "}
        {msg.mentions?.map((m, i) => (
          <Text key={i} style={styles.mention}>{m} </Text>
        ))}
      </Text>

      {/* Attachments */}
      {!!msg.attachments?.length && (
        <View style={styles.attachWrap}>
          {msg.attachments.map(a => <AttachmentPreview key={a.id} a={a} />)}
        </View>
      )}

      {/* Linked entity */}
      <View style={{ marginTop: 6 }}>
        <LinkedChip linked={msg.linked ?? null} onNavigate={onNavigate} />
      </View>

      {/* Inline actions for requests */}
      {msg.type === "request" && msg.status === "open" && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={onApprove}>
            <Text style={styles.btnDark}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnDeny]} onPress={onDeny}>
            <Text style={styles.btnDark}>Deny</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={onToggleExpand}>
            <Text style={styles.btnText}>Comment</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Thread / Replies */}
      {expanded && (
        <View style={styles.threadBox}>
          {msg.replies?.map(r => (
            <View key={r.id} style={styles.replyRow}>
              <Text style={styles.replyAuthor}>{r.author}</Text>
              <Text style={styles.replyTime}> • {timeAgo(r.createdAt)}</Text>
              <Text style={styles.replyBody}>{r.body}</Text>
            </View>
          ))}
          <View style={styles.replyComposer}>
            <TextInput
              placeholder="Reply…"
              placeholderTextColor={Colors.sub}
              style={styles.replyInput}
              value={replyText}
              onChangeText={setReplyText}
              onSubmitEditing={(e) => {
                if (e.nativeEvent.text.trim()) {
                  Alert.alert("Reply Sent", `"${e.nativeEvent.text}" added to thread`);
                  setReplyText("");
                }
              }}
            />
            <TouchableOpacity onPress={() => {
              if (replyText.trim()) {
                Alert.alert("Reply Sent", `"${replyText}" added to thread`);
                setReplyText("");
              }
            }}>
              <Text style={{ color: Colors.green, fontWeight: "800" }}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ---------------- Screen ----------------
const MESSAGES_STORAGE_KEY = "bps.messages";

interface MessagesTabProps {
  project?: any;
  theme?: 'dark' | 'light';
  onNavigateToTab?: (tab: string) => void;
  onClose?: () => void;
}

export default function MessagesTab({ onNavigateToTab, onClose }: MessagesTabProps = {}) {
  const { theme } = useTheme();
  const themeColors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === "#000000";

  const [messages, setMessages] = useState<Message[]>(DEMO);
  const [filter, setFilter] = useState<"all" | "updates" | "requests" | "info" | "me" | "pinned">("all");
  const [composer, setComposer] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Load messages from storage
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const saved = await AsyncStorage.getItem(MESSAGES_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          console.log(`💬 Loaded ${parsed.length} messages`);
          setMessages(parsed);
        } else {
          console.log(`💬 No saved messages, using demo data`);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadMessages();
  }, []);

  // Save messages whenever they change
  useEffect(() => {
    if (!isLoaded) return;
    
    const saveMessages = async () => {
      try {
        await AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
        console.log(`💾 Saved ${messages.length} messages`);
      } catch (error) {
        console.error('Failed to save messages:', error);
      }
    };
    saveMessages();
  }, [messages, isLoaded]);

  const filtered = useMemo(() => {
    let arr = [...messages];
    if (filter === "updates") arr = arr.filter(m => m.type === "update");
    if (filter === "requests") arr = arr.filter(m => m.type === "request");
    if (filter === "info") arr = arr.filter(m => m.type === "info");
    if (filter === "pinned") arr = arr.filter(m => m.pinned);
    if (filter === "me") {
      // example: treat "@PM" as me for demo
      arr = arr.filter(m => m.mentions?.includes("@PM"));
    }
    // pin pinned messages to top when not using the "pinned" filter
    if (filter !== "pinned") arr = arr.sort((a,b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    return arr;
  }, [messages, filter]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const togglePin = (id: string) =>
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, pinned: !m.pinned } : m)));

  const approve = (id: string) => {
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, status: "resolved" } : m)));
    Alert.alert("Approved", "Logged approval in activity.");
  };
  const deny = (id: string) => {
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, status: "resolved" } : m)));
    Alert.alert("Denied", "Request marked as denied.");
  };

  const sendMessage = () => {
    if (!composer.trim()) return;
    const newMsg: Message = {
      id: `m${Date.now()}`,
      author: "You",
      avatarEmoji: "🧑",
      type: "update",
      body: composer.trim(),
      createdAt: new Date().toISOString(),
      status: "open",
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    setMessages([newMsg, ...messages]);
    setComposer("");
    setAttachments([]);
    Alert.alert("Sent!", "Message posted to project thread");
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    });

    if (!result.canceled && result.assets) {
      const newAttachments: Attachment[] = result.assets.map((asset, idx) => ({
        id: `att-${Date.now()}-${idx}`,
        kind: "photo",
        uri: asset.uri,
        name: asset.fileName || `Photo ${idx + 1}`,
      }));
      setAttachments(prev => [...prev, ...newAttachments].slice(0, 5));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow camera access');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newAttachment: Attachment = {
        id: `att-${Date.now()}`,
        kind: "photo",
        uri: result.assets[0].uri,
        name: `Photo ${new Date().toLocaleTimeString()}`,
      };
      setAttachments(prev => [...prev, newAttachment].slice(0, 5));
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const showAttachmentOptions = () => {
    Alert.alert(
      "Add Attachment",
      "Choose attachment source",
      [
        { text: "📸 Take Photo", onPress: takePhoto },
        { text: "🖼️ Photo Library", onPress: pickImage },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const handleNavigate = (entity: LinkedEntity) => {
    if (!entity || !onNavigateToTab) {
      Alert.alert("Navigate", `Open ${entity?.type}: ${entity?.title}`);
      return;
    }

    if (entity.type === "milestone") {
      onNavigateToTab("Timeline");
      Alert.alert("Navigating", `Opening Timeline to view: ${entity.title}`);
    } else if (entity.type === "budget") {
      onNavigateToTab("Budget");
      Alert.alert("Navigating", `Opening Budget to view: ${entity.title}`);
    }
  };

  const stats = useMemo(() => {
    const open = messages.filter(m => m.status === "open").length;
    const requests = messages.filter(m => m.type === "request" && m.status === "open").length;
    const pinned = messages.filter(m => m.pinned).length;
    return { open, requests, pinned };
  }, [messages]);

  return (
    <View style={[styles.container, !darkMode && { backgroundColor: themeColors.bg }]}>
      {/* Header with Back Arrow */}
      <View style={styles.headerContainer}>
        <View style={styles.backBtnWrapper}>
          <LinearGradient
            colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
            start={{ x: 0.05, y: 0.15 }}
            end={{ x: 0.95, y: 0.85 }}
            style={styles.backBtnBorder}
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (onClose) onClose();
              }}
              style={styles.backBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            Messages
          </Text>
          <Text style={styles.headerSubtitle}>
            View and manage your project messages
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
      >
        <View style={styles.screen}>
          {/* Messages Stats Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name='chat' size={22} color='#43cea2' />
              <Text style={[styles.h1, { marginLeft: 12 }]}>Messages</Text>
            </View>
          <View style={styles.statsContent}>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: Colors.blue }]}>{stats.open}</Text>
                <Text style={styles.statLabel}>Open</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: Colors.yellow }]}>{stats.requests}</Text>
                <Text style={styles.statLabel}>Requests</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: Colors.green }]}>{stats.pinned}</Text>
                <Text style={styles.statLabel}>Pinned</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Filters Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name='filter-list' size={22} color='#43cea2' />
            <Text style={[styles.sectionTitle, { marginLeft: 12 }]}>Filters</Text>
          </View>
          <View style={styles.filterContent}>
            <View style={styles.filterRow}>
              {(["all", "requests", "updates", "info", "me", "pinned"] as const).map(f => (
                <Chip
                  key={f}
                  text={f === "all" ? "All" : f === "me" ? "Mentions" : f.charAt(0).toUpperCase() + f.slice(1)}
                  active={filter === f}
                  onPress={() => setFilter(f)}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Messages List Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name='message' size={22} color='#43cea2' />
            <Text style={[styles.sectionTitle, { marginLeft: 12 }]}>All Messages</Text>
          </View>
          <View style={{ paddingBottom: 140 }}>
            {filtered.length === 0 ? (
              <View style={{ alignItems: "center", padding: 40 }}>
                <Text style={{ color: Colors.sub, fontSize: 16 }}>No messages found</Text>
              </View>
            ) : (
              filtered.map((item) => (
                <MessageCard
                  key={item.id}
                  msg={item}
                  expanded={expandedId === item.id}
                  onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onApprove={() => approve(item.id)}
                  onDeny={() => deny(item.id)}
                  onPinToggle={() => togglePin(item.id)}
                  onNavigate={handleNavigate}
                />
              ))
            )}
          </View>
        </View>
        </View>

      {/* Composer */}
      <View style={styles.composerContainer}>
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <View style={styles.attachmentPreviewRow}>
            {attachments.map(att => (
              <View key={att.id} style={styles.attachmentPreview}>
                <Image source={{ uri: att.uri }} style={styles.attachmentPreviewImg} />
                <TouchableOpacity
                  style={styles.removeAttachment}
                  onPress={() => removeAttachment(att.id)}
                >
                  <Text style={styles.removeAttachmentText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        
        <View style={styles.composer}>
          <TouchableOpacity onPress={showAttachmentOptions} style={styles.attachBtn}>
            <Text style={styles.attachBtnText}>📎</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.composerInput}
            value={composer}
            onChangeText={setComposer}
            placeholder="Send update, request, or info..."
            placeholderTextColor={Colors.sub}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={sendMessage}
            style={[styles.sendBtn, { opacity: composer.trim() || attachments.length > 0 ? 1 : 0.4 }]}
            disabled={!composer.trim() && attachments.length === 0}
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
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
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E2E8F0',
    marginTop: 2,
  },
  screen: { flex: 1, backgroundColor: "transparent", paddingTop: 0 },
  sectionCard: {
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.2)',
    backgroundColor: 'rgba(67, 206, 162, 0.08)',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  h1: { color: Colors.text, fontSize: 18, fontWeight: "700" },
  statsContent: {
    padding: 0,
  },
  // Stats
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 0 },
  statBox: { flex: 1, backgroundColor: Colors.card, borderRadius: 14, padding: 12, alignItems: "center" },
  statVal: { fontSize: 24, fontWeight: "900" },
  statLabel: { color: Colors.sub, fontSize: 12, marginTop: 4 },
  filterContent: {
    padding: 0,
  },
  // Filters
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 0 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: { color: Colors.sub, fontSize: 13, fontWeight: "600" },

  // Message Card
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  author: { color: Colors.text, fontSize: 16, fontWeight: "700" },
  time: { color: Colors.sub, fontSize: 12 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { color: "#0d1b2a", fontSize: 10, fontWeight: "900" },
  body: { color: Colors.text, fontSize: 15, lineHeight: 22, marginBottom: 10 },
  mention: { color: Colors.blue, fontWeight: "700" },

  // Attachments
  attachWrap: { flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  attachmentImg: { width: 80, height: 60, borderRadius: 10 },
  attachmentFile: {
    backgroundColor: Colors.chip,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.line,
  },

  // Actions
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  btnApprove: { backgroundColor: Colors.green },
  btnDeny: { backgroundColor: Colors.red },
  btnOutline: { borderWidth: 1, borderColor: Colors.line },
  btnDark: { color: "#0d1b2a", fontWeight: "800", fontSize: 14 },
  btnText: { color: Colors.text, fontWeight: "700", fontSize: 14 },

  // Thread
  threadBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  replyRow: { marginBottom: 10, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: Colors.line },
  replyAuthor: { color: Colors.text, fontSize: 13, fontWeight: "700" },
  replyTime: { color: Colors.sub, fontSize: 11 },
  replyBody: { color: Colors.sub, fontSize: 13, marginTop: 4 },
  replyComposer: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8 },
  replyInput: {
    flex: 1,
    backgroundColor: Colors.bg,
    color: Colors.text,
    padding: 10,
    borderRadius: 10,
    fontSize: 14,
  },

  // Composer
  composerContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
  },
  composer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  attachBtnText: { fontSize: 20 },
  composerInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    maxHeight: 80,
  },
  sendBtn: {
    backgroundColor: Colors.green,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: "center",
  },
  sendBtnText: { color: "#0d1b2a", fontWeight: "800", fontSize: 15 },
  
  // Attachment Previews
  attachmentPreviewRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  attachmentPreview: {
    position: "relative",
  },
  attachmentPreviewImg: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  removeAttachment: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.red,
    alignItems: "center",
    justifyContent: "center",
  },
  removeAttachmentText: {
    color: "white",
    fontSize: 12,
    fontWeight: "900",
  },
});
