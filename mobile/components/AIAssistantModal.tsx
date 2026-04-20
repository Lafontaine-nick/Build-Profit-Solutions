import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Animated } from "react-native";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  Keyboard,
  Dimensions,
  RefreshControl,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import { Audio } from "expo-av";
// Use legacy API for readAsStringAsync (deprecated in v19+ but still works)
import * as FileSystemLegacy from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import SubcontractorSearchModal from "./SubcontractorSearchModal";
import { useAIManagerMode } from "@/state/useAIManagerMode";
import { Switch, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import { KEYBOARD_SCROLL_DEFAULTS } from "@/constants/keyboardScrollProps";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { syncClerkTokenToAsyncStorage } from "@/utils/authTokenHelper";
import { formatIsoDateMMDDYYYY } from "@/utils/formatIsoDateMMDDYYYY";
import { usePMEventReactions, pmEventTracker } from "@/hooks/usePMEventReactions";
import { 
  resolveProjectContext, 
  requiresProjectContext,
  detectProjectIntent,
  SCENARIO_SELECTION_ID_PATTERN,
  type UIState,
  type RecentProject,
  formatClarificationMessage,
  type ProjectIntent
} from "@/lib/ai/projectContextResolver";
import { useProjectList } from "@/contexts/ProjectListContext";
import { computeProfitForecast } from "@/src/lib/profitForecast";
import { getLastOpenedProjectId, setLastOpenedProjectId } from "@/lib/ai/userProjectSettings";
import ProjectSelectionChips from "@/lib/ai/projectSelectionChips";
import PaymentSelectionChips from "@/lib/ai/paymentSelectionChips";
import AnalysisTypeChips from "@/lib/ai/analysisTypeChips";
import SelectionCards from "@/lib/ai/SelectionCards";

function resolveAIBaseUrl(): string {
  const envBase = process.env.EXPO_PUBLIC_AI_API_URL;
  if (envBase && typeof envBase === "string") {
    console.log('🤖 Using AI API URL from env:', envBase);
    return envBase;
  }

  // PRIORITY 1: For iOS Simulator, ALWAYS use localhost (simulator shares network with Mac)
  // Check both isDevice being false/undefined and Platform.OS being ios
  if (Platform.OS === "ios" && Constants.isDevice === false) {
    console.log('📱 iOS Simulator detected - using localhost:3001');
    return "http://localhost:3001";
  }

  if (Platform.OS === "web") {
    console.log('🌐 Web platform detected - using localhost:3001');
    return "http://localhost:3001";
  }

  // PRIORITY 2: For Android Emulator, use special IP
  if (Platform.OS === "android" && Constants.isDevice === false) {
    console.log('🤖 Android Emulator detected - using 10.0.2.2:3001');
    return "http://10.0.2.2:3001";
  }

  // PRIORITY 3: Use configured API base URL first (stable for physical devices)
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 
                     process.env.EXPO_PUBLIC_DEV_API_BASE_URL ||
                     (Constants.expoConfig?.extra?.devApiBaseUrl);
  
  if (apiBaseUrl) {
    // Extract base URL without /api suffix if present
    const base = apiBaseUrl.replace(/\/api\/?$/, '');
    // Guard against stale hardcoded LAN IPs from older app config/runtime cache.
    // If this matches a known legacy IP, skip it and fall through to hostUri detection.
    if (base.includes("192.168.1.115")) {
      console.warn("⚠️ Ignoring stale configured API base URL:", base);
    } else {
    console.log('📱 Using API base URL from config:', base);
    return base;
    }
  }

  // PRIORITY 4: For physical devices, try to detect network IP from Expo
  // Expo often provides hostUri like "192.168.x.x:8081"
  const expoConfig: any = (Constants as any).expoConfig || (Constants as any).manifest;
  const hostUri: string | undefined =
    expoConfig?.hostUri ||
    expoConfig?.debuggerHost ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const maybeIp = typeof hostUri === "string" ? hostUri.split(":")[0] : undefined;
    if (maybeIp && /^\d{1,3}(\.\d{1,3}){3}$/.test(maybeIp)) {
      const url = `http://${maybeIp}:3001`;
      console.log('📱 Physical device detected - using network IP:', url);
      return url;
    }
  }

  // Final fallback: avoid stale hardcoded LAN IPs.
  // On physical devices, require explicit env config when hostUri cannot be resolved.
  const localhostFallback = "http://localhost:3001";
  console.warn('⚠️ Could not resolve LAN IP from Expo hostUri.');
  console.warn('💡 Set EXPO_PUBLIC_AI_API_URL (or EXPO_PUBLIC_API_BASE_URL) to your Mac IP, e.g. http://192.168.x.x:3001');
  console.warn('⚠️ Falling back to localhost (works for simulator/web, not physical devices):', localhostFallback);
  return localhostFallback;
}

const PRODUCTION_AI_API = 'https://build-profit-solutions-backend.onrender.com/api/ai-assistant';

/** ISO timestamp so backend can show “data as of …” in financial/trust footers */
function stampAiContextSnapshot(ctxStr: string | null | undefined): string | null {
  if (ctxStr == null || ctxStr === '') return ctxStr ?? null;
  try {
    const o = JSON.parse(ctxStr);
    o.snapshotAt = new Date().toISOString();
    return JSON.stringify(o);
  } catch {
    return ctxStr;
  }
}

/** Estimated cost baseline = materials + labor + overhead (incl. plans & permits). Matches BudgetTab/project-detail. */
function getEstimatedCostBaseline(project: any, estimateData: any): number {
  const ed = estimateData;
  const fromEst = Number(ed?.estimatedCost ?? ed?.subtotal ?? ed?.totalCost ?? ed?.baseCost ?? 0);
  if (fromEst > 0) return fromEst;
  const fromParts =
    Number(ed?.materials ?? project?.materials ?? 0) +
    Number(ed?.labor ?? project?.labor ?? 0) +
    Number(ed?.equipment ?? 0) +
    Number(ed?.equipmentMaintenance ?? 0) +
    Number(ed?.facilities ?? 0) +
    Number(ed?.insuranceOverhead ?? 0) +
    Number(ed?.otherOverhead ?? 0) +
    Number(ed?.planCost ?? 0) +
    Number(ed?.permitCost ?? 0) +
    Number(ed?.otherDirectCost ?? 0);
  if (fromParts > 0) return fromParts;
  return Number(project?.estimatedCost ?? 0);
}

/** Bid margin % from estimate (what we had in our bid). Used for bid vs current vs projected. Prefer stored marginPercent/margin (matches Estimate Generator and Projects). */
function getBidMarginPct(estimateData: any, bidPrice: number): number | null {
  if (!estimateData || !bidPrice || bidPrice <= 0) return null;
  const ed = estimateData;
  // Prefer explicit margin from estimate (Estimate Generator stores marginPercent; Projects use marginPercent ?? margin)
  const storedMargin = ed?.marginPercent ?? ed?.margin ?? ed?.marginPct;
  if (typeof storedMargin === 'number' && Number.isFinite(storedMargin)) {
    const pct = storedMargin > 1 ? storedMargin : storedMargin * 100;
    if (pct >= 0 && pct <= 100) return Math.round(pct * 10) / 10;
  }
  const subtotal = Number(ed?.subtotal ?? ed?.estimatedCost ?? 0) || 0;
  const profit = Number(ed?.profit ?? 0) || 0;
  if (subtotal > 0 && profit >= 0) {
    const total = subtotal + profit;
    if (total > 0) return Math.round((profit / total) * 1000) / 10;
  }
  const markupPct = Number(ed?.markupPct ?? ed?.markup ?? 0) || 0;
  if (markupPct > 0) return Math.round((markupPct / (100 + markupPct)) * 1000) / 10;
  return null;
}

/** Current margin % = (bidPrice - totalSpent) / bidPrice * 100 */
function getCurrentMarginPct(bidPrice: number, totalSpent: number): number | null {
  if (!bidPrice || bidPrice <= 0) return null;
  const spent = Number(totalSpent) || 0;
  return Math.round(((bidPrice - spent) / bidPrice) * 1000) / 10;
}

// Helper function to try multiple URLs with fallback
async function fetchWithFallback(urls: string[], options: RequestInit, timeout = 10000): Promise<Response> {
  const errors: Error[] = [];
  
  for (const url of urls) {
    let timeoutId: NodeJS.Timeout | null = null;
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => {
        console.warn(`⏱️ Request to ${url} timed out after ${timeout}ms`);
        controller.abort();
      }, timeout);
      
      console.log(`🔄 Attempting connection to: ${url} (timeout: ${timeout}ms)`);
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      if (timeoutId) clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      
      if (response.ok) {
        console.log(`✅ Successfully connected to: ${url} (${elapsed}ms)`);
        return response;
      }
      
      // If response is not ok, try to get the server's error message
      let errMsg = `HTTP ${response.status} from ${url}`;
      try {
        const clone = response.clone();
        const body = await clone.json().catch(() => ({}));
        if (body?.message) errMsg = body.message;
      } catch (_) {}
      console.warn(`⚠️ ${errMsg}`);
      errors.push(new Error(errMsg));
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      const errorMsg = error.message || error.toString();
      console.warn(`⚠️ Failed to connect to ${url} after ${elapsed}ms:`, errorMsg);
      errors.push(error);
      // Continue to next URL
    }
  }
  
  // If all URLs failed, provide detailed error
  const lastError = errors[errors.length - 1];
  const allErrors = errors.map((e, i) => `  ${i + 1}. ${urls[i]}: ${e.message}`).join('\n');
  console.warn(`❌ All connection attempts failed:\n${allErrors}`);
  throw lastError || new Error('All connection attempts failed');
}

// ─── Streaming helpers (additive — existing POST path is the fallback) ────
// Streaming is OPT-IN via EXPO_PUBLIC_AI_STREAMING. When true, conversational
// messages will try the SSE /stream endpoint for instant token-by-token UX.
// Action messages (log / add / create / mark / scan / etc.) ALWAYS go through
// the non-streaming POST because /stream does not execute tool calls.
const STREAMING_ENABLED = String(
  process.env.EXPO_PUBLIC_AI_STREAMING ?? 'true'
).toLowerCase() === 'true';

/**
 * Returns true only if the message looks like pure conversational Q&A.
 * Any command-like intent falls back to the POST path so tool execution,
 * selection cards, and action callbacks continue to work unchanged.
 */
function isStreamSafeMessage(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const msg = raw.trim().toLowerCase();
  if (msg.length === 0 || msg.length > 400) return false;
  const actionIntent = /\b(log|add|create|make|mark|record|scan|upload|invoice|send|approve|assign|schedule|book|pay|collect|generate|populate|build an?\s*estimate|run a scenario|what if|scenario|change order|purchase order|po\b)\b/;
  if (actionIntent.test(msg)) return false;
  return true;
}

type StreamEvent =
  | { type: 'token'; content: string }
  | { type: 'done'; suggestedFollowUps?: any; sessionId?: string }
  | { type: 'error'; message?: string };

/**
 * POST to an SSE endpoint and emit parsed events as they arrive.
 * Uses XMLHttpRequest so it works across React Native platforms without
 * depending on streaming fetch implementation details.
 */
function streamSSE(opts: {
  url: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
  onEvent: (ev: StreamEvent) => void;
}): Promise<void> {
  const { url, headers, body, timeoutMs, onEvent } = opts;
  return new Promise((resolve, reject) => {
    let processedIndex = 0;
    let bufferConsumedToChar = 0;
    let done = false;
    let gotAnyToken = false;
    const xhr = new XMLHttpRequest();

    const handleBuffer = () => {
      try {
        const text = xhr.responseText || '';
        if (text.length <= bufferConsumedToChar) return;
        const chunk = text.slice(bufferConsumedToChar);
        bufferConsumedToChar = text.length;
        processedIndex += chunk.length;
        // Split SSE events by blank lines
        const events = (chunk).split(/\n\n/);
        for (const ev of events) {
          const line = ev.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed && parsed.type === 'token' && typeof parsed.content === 'string') {
              gotAnyToken = true;
              onEvent(parsed);
            } else if (parsed && parsed.type === 'done') {
              done = true;
              onEvent(parsed);
            } else if (parsed && parsed.type === 'error') {
              onEvent(parsed);
            }
          } catch {
            // ignore malformed fragments — a partial JSON chunk will be re-joined next tick
          }
        }
      } catch (err) {
        reject(err);
      }
    };

    xhr.open('POST', url, true);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.timeout = timeoutMs;

    xhr.onreadystatechange = () => {
      if (xhr.readyState >= 3) handleBuffer();
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          handleBuffer();
          if (!gotAnyToken && !done) return reject(new Error('Stream produced no tokens'));
          resolve();
        } else {
          reject(new Error(`Stream HTTP ${xhr.status}`));
        }
      }
    };
    xhr.ontimeout = () => reject(new Error('Stream request timed out'));
    xhr.onerror = () => reject(new Error('Stream request failed'));

    try {
      xhr.send(body);
    } catch (err) {
      reject(err as Error);
    }
  });
}

function computeAssistantDomain(screen?: string, status?: string): 'estimate' | 'project' | 'general' {
  const s = (screen || '').toLowerCase();
  const st = (status || '').toLowerCase();

  if (s.includes('estimate') || st === 'estimate' || st === 'draft' || st === 'submitted' || st === 'bid_submitted') {
    return 'estimate';
  }
  if (s.includes('project')) {
    return 'project';
  }
  return 'general';
}

/** Client-side Today Brief — fallback when API hasn't returned; ensures insight-first UI always shows */
function buildTodayBriefFromContext(parsedContext: any, userFirstName?: string | null) {
  const allProjects = Array.isArray(parsedContext?.allProjects) ? parsedContext.allProjects : [];
  const now = new Date();
  const normalize = (v: any) => {
    if (v == null) return 0;
    if (typeof v === 'string') {
      const n = Number(v.replace(/[$,\s]/g, ''));
      return Number.isFinite(n) ? n : 0;
    }
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  };
  const safeDate = (d: any) => {
    const dt = new Date(d || 0);
    return Number.isFinite(dt.getTime()) ? dt : null;
  };

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const namePart = userFirstName && String(userFirstName).trim() ? ` ${String(userFirstName).trim()}` : '';
  const reply = `${greeting}${namePart}\n\nHere's what needs attention today.`;

  const insights: string[] = [];
  const recommendedActions: { label: string; prompt: string }[] = [];
  const projectNames = new Set<string>();

  let totalMissingReceipts = 0;
  allProjects.forEach((p: any) => {
    const expenses = p?.expenses || p?.projectData?.expenses || [];
    totalMissingReceipts += expenses.filter((e: any) => !e?.receiptUri || !String(e.receiptUri).trim()).length;
  });
  if (totalMissingReceipts > 0) {
    insights.push(`${totalMissingReceipts} expense${totalMissingReceipts > 1 ? 's' : ''} missing receipts`);
    recommendedActions.push({ label: 'Upload missing receipts', prompt: 'Which projects have missing receipts? I want to upload them.' });
  }

  const withMargin = allProjects
    .map((p: any) => {
      const title = p?.title || p?.name || 'Project';
      const revenue = normalize(p?.bidPrice ?? p?.contractValue ?? p?.total ?? 0);
      const spent = normalize(p?.actualCost ?? p?.totalSpent ?? p?.estimatedCost ?? 0);
      const margin = revenue > 0 ? ((revenue - spent) / revenue) * 100 : 0;
      return { title, margin, revenue };
    })
    .filter((x: { margin: number; revenue: number }) => x.margin > 0 && x.revenue > 0);

  let biggestRisk: { title: string; message: string; detail: string; prompt: string; cta?: string } | null = null;
  if (withMargin.length >= 1) {
    const byMargin = [...withMargin].sort((a, b) => a.margin - b.margin);
    const lowest = byMargin[0];
    const highest = byMargin[byMargin.length - 1];
    if (lowest.margin < 25) {
      insights.push(`${lowest.title} margin is trending lower`);
      projectNames.add(lowest.title);
      recommendedActions.push({ label: `Review ${lowest.title} costs`, prompt: `Review labor costs and expenses on ${lowest.title}` });
      biggestRisk = {
        title: lowest.title,
        message: `${lowest.title} margin dropped to ${Math.round(lowest.margin)}%`,
        detail: 'Labor costs may be higher than estimated.',
        prompt: `Review labor costs and expenses on ${lowest.title}`,
        cta: 'Review Project',
      };
    }
    if (highest.margin > 20 && highest.title !== lowest.title) {
      insights.push(`${highest.title} is your most profitable project`);
      projectNames.add(highest.title);
    }
  }

  const quickActions = [
    { label: 'Compare Projects', prompt: 'Compare all my projects for profitability and risk' },
    { label: 'What Needs Attention', prompt: 'What should I focus on today?' },
    { label: 'Forecast Profit', prompt: 'Forecast profit across my projects' },
    { label: 'Check Budget Risks', prompt: 'Identify budget risks across my projects' },
    { label: 'Missing Receipts', prompt: 'Which projects have expenses missing receipts?' },
    { label: 'Upcoming Payments', prompt: 'What payments are coming up?' },
  ];

  const isActive = (s: string) => ['won', 'active', 'in_progress', 'in-progress'].includes((s || '').toLowerCase());
  const isCompleted = (s: string) => (s || '').toLowerCase() === 'completed';
  const getStatus = (p: any) => (p?.status ?? p?.projectData?.status ?? '').toString().toLowerCase().replace(/\s+/g, '_');
  const activeProjects = allProjects.filter((p: any) => isActive(getStatus(p))).map((p: any) => p?.title || p?.name || '').filter(Boolean);
  const completedProjects = allProjects.filter((p: any) => isCompleted(getStatus(p))).map((p: any) => p?.title || p?.name || '').filter(Boolean);

  const suggestedFollowUps: { label: string; prompt: string }[] = [];
  const names = [...projectNames].slice(0, 2);
  names.forEach((name) => {
    suggestedFollowUps.push({ label: `Review ${name}`, prompt: `Give me a full health check on ${name} — budget, margin, risks, and what I should do next` });
  });
  if (activeProjects.length >= 2) {
    const a = activeProjects[0];
    const b = activeProjects[1];
    suggestedFollowUps.push({ label: `Compare ${a} vs ${b}`, prompt: `Compare ${a} and ${b} — which active project is performing better and why?` });
  }
  if (completedProjects.length >= 2 && activeProjects.length < 2) {
    const a = completedProjects[0];
    const b = completedProjects[1];
    suggestedFollowUps.push({ label: `Compare ${a} vs ${b}`, prompt: `Compare ${a} and ${b} — which completed project was more profitable and why?` });
  }
  suggestedFollowUps.push({ label: 'Where am I losing money?', prompt: 'Where am I losing money across my active projects? Show me the biggest profit leaks.' });
  suggestedFollowUps.push({ label: 'Show projects over budget', prompt: 'Which active projects are over budget and by how much?' });

  const seenPrompts = new Set<string>();
  const dedupedSuggested = suggestedFollowUps.filter((s) => {
    const key = (s.prompt || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenPrompts.has(key)) return false;
    seenPrompts.add(key);
    return true;
  });

  return {
    reply,
    insights: insights.slice(0, 5),
    recommendedActions: recommendedActions.slice(0, 3),
    quickActions,
    suggestedFollowUps: dedupedSuggested.slice(0, 5),
    biggestRisk,
  };
}

const Colors = {
  bg: "#000000",
  card: "#000000",
  cardDark: "#000000",
  text: "#F9FAFB",
  sub: "#8DA0B8",
  line: "rgba(148, 163, 184, 0.1)",
  primary: "#22c55e",
  yellow: "#ffd166",
  blue: "#60a5fa",
  green: "#22c55e",
  orange: "#fbbf24",
  red: "#ef4444",
  purple: "#a78bfa",
};

const CARD_GRADIENT: [string, string] = [
  "rgba(16, 242, 151, 0.07)",
  "rgba(16, 242, 151, 0)",
];

const ASSISTANT_BORDER_GRADIENT: [string, string] = [
  "rgba(45, 255, 196, 0.45)",
  "rgba(56, 189, 248, 0.35)",
];

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
  pdfUri?: string;
  attachment?: {
    type: 'pdf';
    uri: string;
    name: string;
  };
  analysisCard?: any;
  selectionType?: 'payment' | 'expense_type' | 'po' | 'scenario';
};

type Props = {
  visible: boolean;
  onClose: () => void;
  // optional extra context from the current screen
  context?: string;
  // callback for AI actions (e.g., add material, update budget)
  // Returns a promise that may resolve with additional data (e.g., PDF URI for show_contract)
  onAction?: (action: { type: string; [key: string]: any }) => Promise<any> | void;
  // Optional ZIP code for contractor search
  defaultZip?: string;
  // Optional initial question to send automatically
  initialQuestion?: string;
  // Optional selected project hint (used by Projects screen)
  selectedProjectId?: string | null;
  // Optional callback when project is selected from chips
  onSelectedProjectIdChange?: (projectId: string) => void;
  // Optional callback when backend sends projectUpdate payload
  onProjectUpdated?: (projectId: string, updates: any) => void;
  /** When in Command Center, pass project chips directly (bypasses context parsing) */
  projectOptionsOverride?: Array<{ id: string; title: string; status?: string }>;
  /** When false, disables send until timeline/project data is loaded (avoids stale progress in compare) */
  isContextReady?: boolean;
};

const QUICK_ACTIONS = [
  "Add Material",
  "Add Labor",
  "Set Payment Schedule",
  "Show Bid Summary",
  "Check Profit",
  "Find Subcontractors",
];

const AI_REQUEST_TIMEOUT_MS = 45000;

const SUMMARY_REFRESH_KEYWORDS = [
  "health check",
  "project health",
  "budget breakdown",
  "missing costs",
  "forecast",
  "summary",
];

const HEALTH_REFRESH_KEYWORDS = [
  "health check",
  "project health",
];

const isSummaryLikeMessage = (m: Message) => {
  if (!m || m.role !== "assistant") return false;
  if (m.analysisCard) return true;
  const lc = (m.content || "").toLowerCase();
  return SUMMARY_REFRESH_KEYWORDS.some((kw) => lc.includes(kw));
};

const isHealthRefreshMessage = (m: Message) => {
  if (!m || m.role !== "assistant") return false;
  const lc = (m.content || "").toLowerCase();
  return HEALTH_REFRESH_KEYWORDS.some((kw) => lc.includes(kw));
};

const AIAssistantModal: React.FC<Props> = ({
  visible,
  onClose,
  context,
  onAction,
  defaultZip = '89011',
  initialQuestion,
  selectedProjectId,
  onSelectedProjectIdChange,
  onProjectUpdated,
  projectOptionsOverride,
  isContextReady = true,
}) => {
  const { theme, darkMode } = useTheme();
  const ThemeColors = useMemo(() => getColors(theme), [theme]);
  /** Light-mode-only style overrides. In dark mode, always returns `undefined` so base `StyleSheet` values apply unchanged. */
  const light = useCallback(
    (style: ViewStyle | TextStyle | undefined): ViewStyle | TextStyle | undefined => {
      if (darkMode || style == null) return undefined;
      return style;
    },
    [darkMode],
  );
  const { getToken } = useAuth();
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showContractorModal, setShowContractorModal] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [chatSuggestions, setChatSuggestions] = useState<Array<{label: string; prompt: string}>>([]);
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);
  const { enabled: aiManagerEnabled, loading: aiModeLoading, toggleEnabled } = useAIManagerMode();
  const insets = useSafeAreaInsets();
  const dotAnim1 = useRef(new Animated.Value(0.4)).current;
  const dotAnim2 = useRef(new Animated.Value(0.4)).current;
  const dotAnim3 = useRef(new Animated.Value(0.4)).current;
  const sendButtonScale = useRef(new Animated.Value(1)).current;
  const { activeProjects, estimates, updateProject, getProjectById } = useProjectList();
  const [pendingProjectSelection, setPendingProjectSelection] = useState<{
    query: string;
    options: Array<{ id: string; title: string; status?: string }>;
  } | null>(null);
  const [pendingAnalysisType, setPendingAnalysisType] = useState<{
    query: string;
    projectId: string;
  } | null>(null);
  const [pendingPaymentSelection, setPendingPaymentSelection] = useState<{
    options: Array<{ id: string; title: string; status?: string; amount?: number; dueDate?: string }>;
    projectId?: string;
    projectName?: string;
  } | null>(null);
  const [pendingExpenseTypeSelection, setPendingExpenseTypeSelection] = useState<{
    options: Array<{ id: string; title: string; subtitle?: string }>;
  } | null>(null);
  const [pendingPOSelection, setPendingPOSelection] = useState<{
    options: Array<{ id: string; title: string; subtitle?: string }>;
    projectId?: string;
    projectName?: string;
  } | null>(null);
  const [pendingScenarioSelection, setPendingScenarioSelection] = useState<{
    options: Array<{ id: string; title: string; subtitle?: string }>;
  } | null>(null);
  const [lastOpenedProjectId, setLastOpenedProjectIdState] = useState<string | null>(null);
  const [recentSummary, setRecentSummary] = useState<{ content: string; timestamp?: Date } | null>(null);
  const [recentSummaryExpanded, setRecentSummaryExpanded] = useState(false);
  const [todayBriefData, setTodayBriefData] = useState<{
    reply: string;
    insights: string[];
    recommendedActions: { label: string; prompt: string }[];
    quickActions: { label: string; prompt: string }[];
    suggestedFollowUps: { label: string; prompt: string }[];
    biggestRisk?: { title: string; message: string; detail: string; prompt: string } | null;
  } | null>(null);
  const [teamMembersData, setTeamMembersData] = useState<any[] | null>(null);
  const autoRefreshInFlightRef = useRef(false);
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastAutoRefreshSnapshotRef = useRef<string>("");
  const hasAutoExpandedProjectsRef = useRef(false);
  const portfolioScopeOverrideRef = useRef(false);
  const wasVisibleRef = useRef(false);
  /** When user picks a project from chips, we inject this so sendMessage uses it (resume original intent) */
  const pendingResolvedProjectIdRef = useRef<string | null>(null);
  /** When user picks a payment from chips, we inject project ID and name so sendMessage bypasses project resolver and sends to backend */
  const pendingPaymentProjectIdRef = useRef<string | null>(null);
  const pendingPaymentProjectNameRef = useRef<string | null>(null);
  /** When user picks a PO from chips, we inject project ID and PO number for backend */
  const pendingPOProjectIdRef = useRef<string | null>(null);
  const pendingPOProjectNameRef = useRef<string | null>(null);
  /** Context overrides for selection-card resume flows (expense, PO, scenario) */
  const pendingExpenseTypeResumeRef = useRef<{ type: string } | null>(null);
  const pendingPOResumeRef = useRef<{ poNumber: string } | null>(null);
  const pendingScenarioResumeRef = useRef<{ scenario: string } | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Minimum list content height when keyboard is closed (short threads still scroll).
  // When keyboard is open, do NOT set minHeight — KeyboardAvoidingView already shrinks the list; a large minHeight + extra paddingBottom created huge dead scroll space.
  const minContentHeight = useMemo(() => {
    const screenHeight = Dimensions.get('window').height;
    const headerHeight = 120;
    const inputBarReserve = 120;
    return screenHeight - headerHeight - inputBarReserve + 50;
  }, []);
  /** Bottom padding for FlatList content: input bar + safe inset only. Keyboard inset is handled by KeyboardAvoidingView — do not add keyboardHeight here. */
  const listPaddingBottomKeyboardOpen = useMemo(() => {
    return Math.max(96, 72 + Math.max(insets.bottom, 8));
  }, [insets.bottom]);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingDurationRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  
  // Load last opened project ID on mount
  useEffect(() => {
    getLastOpenedProjectId().then(setLastOpenedProjectIdState);
  }, []);

  // Clear portfolio override when parent clears selection (header will use normal logic)
  useEffect(() => {
    if (!selectedProjectId) {
      portfolioScopeOverrideRef.current = false;
    }
  }, [selectedProjectId]);

  // On Projects screen: auto-expand AI Insights when available (portfolio-focused)
  useEffect(() => {
    if (!visible) {
      hasAutoExpandedProjectsRef.current = false;
      return;
    }
    if (!recentSummary) return;
    try {
      const p = context ? JSON.parse(context) : {};
      if (p?.screen === 'Projects' && !hasAutoExpandedProjectsRef.current) {
        setRecentSummaryExpanded(true);
        hasAutoExpandedProjectsRef.current = true;
      }
    } catch (_e) { /* ignore */ }
  }, [visible, recentSummary, context]);

  // Track keyboard height for proper scrolling
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Scroll to bottom when keyboard opens (only if user isn't manually scrolling)
        setTimeout(() => {
          if (flatListRef.current && messages.length > 0 && !isUserScrollingRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, Platform.OS === 'ios' ? 250 : 100);
      }
    );
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [messages.length]);
  
  // Timer effect - ensure timer runs when recording starts
  useEffect(() => {
    if (isRecording && !recordingDurationRef.current) {
      // Start timer if recording but timer not running
      recordingDurationRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const newDuration = prev + 1;
          return newDuration;
        });
      }, 1000);
      console.log('⏱️ Timer started');
    } else if (!isRecording && recordingDurationRef.current) {
      // Stop timer when recording stops
      clearInterval(recordingDurationRef.current);
      recordingDurationRef.current = null;
      console.log('⏱️ Timer stopped');
    }
    
    // Cleanup on unmount
    return () => {
      if (recordingDurationRef.current) {
        clearInterval(recordingDurationRef.current);
        recordingDurationRef.current = null;
      }
    };
  }, [isRecording]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recording) {
        // Check if recording is still active before trying to stop/unload
        recording.getStatusAsync().then(status => {
          if (status.isLoaded && status.isRecording) {
            recording.stopAndUnloadAsync().catch(console.error);
          }
        }).catch(() => {
          // If we can't get status, try to stop anyway (might already be stopped)
          try {
            recording.stopAndUnloadAsync().catch(() => {
              // Ignore errors if already unloaded
            });
          } catch (e) {
            // Ignore - recording might already be cleaned up
          }
        });
      }
    };
  }, [recording]);

  // Auto-send initial question if provided
  const initialQuestionSentRef = useRef(false);
  const sendMessageRef = useRef<((messageOverride?: string) => Promise<void>) | null>(null);

  // Global AI Assistant: fetch greeting with portfolio insights when opening with empty conversation
  const greetingShownRef = useRef(false);
  const [briefRefreshing, setBriefRefreshing] = useState(false);

  const refreshTodayBrief = useCallback(async () => {
    if (!context) return;
    let parsed: { screen?: string } = {};
    try {
      parsed = JSON.parse(context);
    } catch (_e) {
      setBriefRefreshing(false);
      return;
    }
    if ((parsed.screen || '').toLowerCase() !== 'ai assistant tab') {
      setBriefRefreshing(false);
      return;
    }
    setBriefRefreshing(true);
    try {
      const AI_API_BASE = resolveAIBaseUrl();
      const url = `${AI_API_BASE}/api/ai-assistant/greeting`;
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const userFirstName = (user as any)?.firstName ?? (user as any)?.first_name ?? null;
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ context, userFirstName: userFirstName || undefined }),
      });
      const data = await res.json();
      if (data.reply) {
        setTodayBriefData({
          reply: data.reply,
          insights: data.insights || [],
          recommendedActions: data.recommendedActions || [],
          quickActions: data.quickActions || [],
          suggestedFollowUps: data.suggestedFollowUps || [],
          biggestRisk: data.biggestRisk || null,
        });
      }
    } catch (_e) {
      // Keep existing brief on error
    } finally {
      setBriefRefreshing(false);
    }
  }, [context, getToken, user]);

  useEffect(() => {
    if (!visible || messages.length > 0 || loading || initialQuestion) return;
    let parsed: { screen?: string } = {};
    try {
      parsed = context ? JSON.parse(context) : {};
    } catch (_e) {
      return;
    }
    if ((parsed.screen || '').toLowerCase() !== 'ai assistant tab') return;
    if (greetingShownRef.current) return;
    greetingShownRef.current = true;

    refreshTodayBrief().catch(() => {
      greetingShownRef.current = false;
    });
  }, [visible, messages.length, loading, initialQuestion, context, refreshTodayBrief]);

  // Reset greeting ref and today brief when modal closes so it shows again on next open
  useEffect(() => {
    if (!visible) {
      greetingShownRef.current = false;
      setTodayBriefData(null);
      setPendingPaymentSelection(null);
    }
  }, [visible]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [messages.length]);

  // Scroll to bottom when keyboard opens (only if user isn't manually scrolling)
  useEffect(() => {
    if (keyboardHeight > 0 && flatListRef.current && messages.length > 0 && !isUserScrollingRef.current) {
      // Wait for keyboard animation to complete before scrolling
      const timeout = Platform.OS === 'ios' ? 350 : 150;
      setTimeout(() => {
        if (!isUserScrollingRef.current && flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, timeout);
    }
  }, [keyboardHeight, messages.length]);

  // On close: return to home state on next open, but preserve the latest summary as preview.
  useEffect(() => {
    const wasVisible = wasVisibleRef.current;
    if (wasVisible && !visible) {
      const latestSummary = [...messages].reverse().find(isSummaryLikeMessage);
      if (latestSummary) {
        setRecentSummary({
          content: latestSummary.content,
          timestamp: latestSummary.timestamp,
        });
      }
      setRecentSummaryExpanded(false);
      if (messages.length > 0) {
        setMessages([]);
      }
    }
    wasVisibleRef.current = visible;
  }, [visible, messages]);

  // Animate typing dots
  useEffect(() => {
    if (isTyping) {
      const animateDot = (animValue: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(animValue, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0.4,
              duration: 600,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const anim1 = animateDot(dotAnim1, 0);
      const anim2 = animateDot(dotAnim2, 200);
      const anim3 = animateDot(dotAnim3, 400);

      anim1.start();
      anim2.start();
      anim3.start();

      return () => {
        anim1.stop();
        anim2.stop();
        anim3.stop();
      };
    } else {
      dotAnim1.setValue(0.4);
      dotAnim2.setValue(0.4);
      dotAnim3.setValue(0.4);
    }
  }, [isTyping]);

  // Parse ZIP from context if available
  let zipCode = defaultZip;
  try {
    if (context) {
      const parsed = JSON.parse(context);
      if (parsed.location) {
        // Try to extract ZIP from location string
        const zipMatch = parsed.location.match(/\b\d{5}\b/);
        if (zipMatch) zipCode = zipMatch[0];
      }
      // Check if bid has zip
      if (parsed.bidData?.zip) zipCode = parsed.bidData.zip;
    }
  } catch (e) {
    // Use default
  }

  // Parse context to get project info
  let projectInfo = null;
  let parsedContext: any = null;
  try {
    if (context) {
      parsedContext = JSON.parse(context);
      const bidTotal = parsedContext.bidTotal || parsedContext.total || 0;
      const estimateData = parsedContext.estimateData || parsedContext.bidData || null;
      const fromEstimate = getBidMarginPct(estimateData, bidTotal);
      const fromContext = typeof parsedContext.margin === 'number' && Number.isFinite(parsedContext.margin) && parsedContext.margin >= 0 && parsedContext.margin <= 100 ? parsedContext.margin : undefined;
      // Prefer Overview's projected margin when in Project Detail — matches Financial Health (e.g. 75%)
      const fromOverview = typeof parsedContext.projectedMarginPct === 'number' && Number.isFinite(parsedContext.projectedMarginPct) ? parsedContext.projectedMarginPct : undefined;
      const bidMarginPct = fromOverview ?? fromEstimate ?? fromContext ?? parsedContext.bidMarginPct;
      // When job has live actuals or linked project, show Project context — not Estimate phase
      const hasLiveProject = parsedContext.hasLiveProjectContext === true ||
        (typeof parsedContext.actualCost === 'number' && parsedContext.actualCost > 0);
      const isEstimateScreen = parsedContext.screen === 'Estimate Generator';
      const estimateNameRaw = String(
        parsedContext.estimateName ??
          parsedContext.bidTitle ??
          (parsedContext.bidData?.title != null ? parsedContext.bidData.title : '')
      ).trim();
      const estimateNameMissing = isEstimateScreen && !estimateNameRaw;
      const phaseLabel = isEstimateScreen
        ? (parsedContext.stepTitle || 'Estimate')
        : hasLiveProject
          ? (parsedContext.phase || 'Project')
          : (parsedContext.stepTitle || 'Estimate phase');
      const spendToDatePct = typeof parsedContext.spendToDateMarginPct === 'number' && Number.isFinite(parsedContext.spendToDateMarginPct)
        ? parsedContext.spendToDateMarginPct
        : undefined;
      projectInfo = {
        title: isEstimateScreen
          ? (estimateNameRaw || 'Untitled estimate')
          : (parsedContext.bidTitle || parsedContext.projectName || "Current Project"),
        estimateNameMissing: isEstimateScreen ? estimateNameMissing : false,
        phase: phaseLabel,
        total: bidTotal,
        overhead: parsedContext.overheadPct || 12,
        markup: parsedContext.markupPct || parsedContext.bidData?.markupPct || 18,
        bidMarginPct: bidMarginPct != null ? Math.round(Number(bidMarginPct) * 10) / 10 : undefined,
        spendToDateMarginPct: spendToDatePct != null ? Math.round(Number(spendToDatePct) * 10) / 10 : undefined,
        hasLiveProjectContext: hasLiveProject,
      };
    }
  } catch (e) {
    // Context parsing failed, use defaults
  }

  // Missing Costs is for Estimates AI only — not shown in Projects AI
  const isEstimateContext = parsedContext?.screen === 'Estimate Generator';
  const estimateAssistantBrief = parsedContext?.estimateAssistantBrief || null;
  /** Short label for copilot header — long strings beside titles caused layout squeeze (vertical glyphs). */
  const estimateCopilotConfidenceLabel = useMemo(() => {
    const raw = String(estimateAssistantBrief?.confidence || "").trim();
    if (!raw) return "";
    const tier = raw.match(/\b(high|medium|low)\b/i);
    if (tier) {
      const w = tier[1];
      return `${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()} confidence`;
    }
    return raw.length > 42 ? `${raw.slice(0, 39)}…` : raw;
  }, [estimateAssistantBrief?.confidence]);
  const estimateCopilotPrimaryLabel = useMemo(() => {
    const raw = String(estimateAssistantBrief?.bestNextAction?.label || "").trim();
    if (!raw) return "Fix This";
    if (raw.length <= 24) return raw;
    const shortened = raw
      .replace(/^review\s+/i, "Review ")
      .replace(/^fix\s+/i, "Fix ")
      .replace(/^add\s+/i, "Add ")
      .replace(/^set\s+/i, "Set ")
      .replace(/^complete\s+/i, "Complete ")
      .trim();
    return shortened.length <= 24 ? shortened : `${shortened.slice(0, 21)}...`;
  }, [estimateAssistantBrief?.bestNextAction?.label]);
  /** Portfolio/receipt chips are irrelevant on Estimate; backend also filters, this hides any stale payloads. */
  const displayChatSuggestions = useMemo(() => {
    if (!isEstimateContext) return chatSuggestions;
    const skip = new Set(["show all missing receipts", "portfolio overview"]);
    return chatSuggestions.filter((s) => !skip.has((s.label || "").trim().toLowerCase()));
  }, [isEstimateContext, chatSuggestions]);
  const isProjectsScreenContext = parsedContext?.screen === 'Projects';
  const isGlobalAssistantContext = parsedContext?.screen === 'AI Assistant Tab';
  /** Dark mode: reply body, footer suggestions, timestamps — all contexts including Estimate */
  const darkModeChatMutedWhite = useMemo(
    () => (darkMode ? ({ color: "#FFFFFF" } as TextStyle) : undefined),
    [darkMode],
  );
  const selectedProjectHintId = portfolioScopeOverrideRef.current
    ? null
    : (selectedProjectId ||
        parsedContext?.selectedProjectId ||
        parsedContext?.resolvedProjectId ||
        null);

  const projectSelectionOptions = useMemo(() => {
    const source = Array.isArray(parsedContext?.allProjects) && parsedContext.allProjects.length
      ? parsedContext.allProjects
      : [...activeProjects, ...estimates];
    const normalized = source
      .map((p: any) => ({
        id: String(p?.id || ''),
        title: String(p?.title || p?.name || 'Untitled Project'),
        status: String(p?.status || ''),
        lastOpened: p?.lastOpened || p?.updatedAt || p?.createdAt || '',
      }))
      .filter((p: any) => p.id && p.title);
    const sorted = normalized.sort((a: any, b: any) =>
      (b.lastOpened ? new Date(b.lastOpened).getTime() : 0) - (a.lastOpened ? new Date(a.lastOpened).getTime() : 0)
    );
    const seen = new Set<string>();
    return sorted.filter((p: any) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [parsedContext?.allProjects, activeProjects, estimates]);

  /** Command Center: fallback — parse projects from context string when prop/useProjectList are empty */
  const projectOptionsFromContext = useMemo(() => {
    if (!context || !isGlobalAssistantContext) return [];
    try {
      const parsed = JSON.parse(context);
      const arr = Array.isArray(parsed?.allProjects) ? parsed.allProjects : [];
      return arr
        .map((p: any) => ({
          id: String(p?.id || ''),
          title: String(p?.title || p?.name || 'Untitled Project'),
          status: String(p?.status || ''),
        }))
        .filter((p: any) => p.id);
    } catch (_e) {
      return [];
    }
  }, [context, isGlobalAssistantContext]);

  /** Command Center: show all current projects — use context.allProjects first (from Assistant screen), then activeProjects+estimates */
  const projectSelectionOptionsForCommandCenter = useMemo(() => {
    const fromContext = Array.isArray(parsedContext?.allProjects) ? parsedContext.allProjects : [];
    const fromList = [...activeProjects, ...estimates];
    const source = fromContext.length > 0 ? fromContext : fromList;
    const normalized = source
      .map((p: any) => ({
        id: String(p?.id || ''),
        title: String(p?.title || p?.name || 'Untitled Project'),
        status: String(p?.status || ''),
        lastOpened: p?.lastOpened || p?.updatedAt || p?.createdAt || '',
      }))
      .filter((p: any) => p.id);
    // Dedupe by id
    const byId = new Map<string, { id: string; title: string; status: string; lastOpened: string }>();
    normalized.forEach((p: any) => {
      if (!byId.has(p.id)) byId.set(p.id, p);
    });
    return Array.from(byId.values()).sort((a, b) =>
      (b.lastOpened ? new Date(b.lastOpened).getTime() : 0) - (a.lastOpened ? new Date(a.lastOpened).getTime() : 0)
    );
  }, [parsedContext?.allProjects, activeProjects, estimates]);

  // Client-side Today Brief fallback — ensures insight-first UI always shows in Global AI (even when API fails)
  const todayBriefFromContext = useMemo(() => {
    if (!context) return null;
    let parsed: any = null;
    try {
      parsed = JSON.parse(context);
    } catch (_e) {
      return null;
    }
    if ((parsed?.screen || '').toLowerCase() !== 'ai assistant tab') return null;
    const userFirstName = (user as any)?.firstName ?? (user as any)?.first_name ?? null;
    return buildTodayBriefFromContext(parsed, userFirstName);
  }, [context, user]);

  const displayBrief = todayBriefData || todayBriefFromContext;

  // Flow-specific chips: detect from last assistant message
  const compactChipFlow = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    const content = (lastAssistant?.content || '').toLowerCase();
    if (content.includes('change order') && (content.includes('amount') || content.includes('vendor') || content.includes('what is the change order'))) return 'change_order';
    if (content.includes('payment') || content.includes('collected') || content.includes('which payment')) return 'payments';
    if (content.includes('daily log') || content.includes('job log') || content.includes('accomplish') || content.includes('what did you')) return 'daily_log';
    if (content.includes('health check') || content.includes('budget breakdown') || (content.includes('forecast') && content.includes('profit'))) return 'budget_check';
    if (content.includes('team') || content.includes('assign') || content.includes('project manager') || content.includes('team member')) return 'team';
    if (content.includes('purchase order') || content.includes('create a po') || (content.includes('po') && content.includes('create'))) return 'create_po';
    if (content.includes('expense') && (content.includes('materials') || content.includes('labor') || content.includes('vendor') || content.includes('amount') || content.includes('category'))) return 'log_expense';
    return null;
  }, [messages]);

  const estimateQuickActionChips = useMemo(() => {
    if (!isEstimateContext) return [];
    if (Array.isArray(estimateAssistantBrief?.chips) && estimateAssistantBrief.chips.length > 0) {
      return estimateAssistantBrief.chips.slice(0, 6);
    }
    return [
      { label: 'Missing Costs', prompt: 'Scan this estimate for missing costs and gaps.' },
      { label: 'Markup & Margin', prompt: 'Explain my bid margin and markup in plain terms for this estimate.' },
      { label: 'Line Items', prompt: 'Summarize my materials and labor line items and any risks.' },
      { label: 'Add to Bid', prompt: 'Help me add a line item to this estimate.' },
      { label: 'Health Check', prompt: 'Give me a quick health check on this bid before I send it.' },
    ];
  }, [estimateAssistantBrief, isEstimateContext]);

  // Build enhanced context with allProjects if not present
  const enhancedContext = useMemo(() => {
    try {
      const baseContext = parsedContext || {};
      
      // Ensure allProjects is included with budget and expense data
      if (!baseContext.allProjects) {
        const allProjects: RecentProject[] = [...activeProjects, ...estimates].map(p => {
          const ed = p.estimateData || p.projectData?.estimateData || null;
          const rawExpensesA = Array.isArray(p.expenses) ? p.expenses : [];
          const rawExpensesB = Array.isArray(p.projectData?.expenses) ? p.projectData.expenses : [];
          const expenses = [...rawExpensesA, ...rawExpensesB].filter((expense: any, index: number, arr: any[]) => {
            const key = expense?.id || `${expense?.date || ''}-${expense?.vendor || ''}-${expense?.amount || 0}-${expense?.category || ''}`;
            return index === arr.findIndex((e: any) => (e?.id || `${e?.date || ''}-${e?.vendor || ''}-${e?.amount || 0}-${e?.category || ''}`) === key);
          });
          const computedActualCost = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
          return {
          id: p.id,
          title: p.title || p.name || 'Untitled Project',
          status: p.status || 'unknown',
          lastOpened: (p as any).lastOpened || (p as any).updatedAt || (p as any).createdAt,
          isActive: ['active', 'won', 'in_progress', 'submitted'].includes(
            ((p.status || '') as string).toLowerCase()
          ),
            // Include budget and expense data for AI to use — estimatedCost = materials + labor + overhead (incl. plans & permits)
            bidPrice: p.bidPrice || ed?.totalBid || 0,
            estimatedCost: getEstimatedCostBaseline(p, ed),
            actualCost: p.actualCost || p.totalSpent || computedActualCost || (p.projectData?.actualCost || p.projectData?.spent || 0),
            totalSpent: p.totalSpent || p.actualCost || computedActualCost || (p.projectData?.spent || p.projectData?.actualCost || 0),
            expenses,
            expensesCount: expenses.length,
            // Include buckets (budget breakdown) for AI to calculate material budget
            buckets: p.buckets || p.projectData?.buckets || [],
            changeOrders: p.projectData?.changeOrders || p.changeOrders || [],
            purchaseOrders: p.projectData?.purchaseOrders || p.purchaseOrders || [],
            // Include estimateData for AI to calculate material budget from line items
            estimateData: ed,
            // Include key estimate fields directly for AI access
            materialTotal: ed?.materialTotal || 0,
            laborTotal: ed?.laborTotal || 0,
            overheadTotal: ed?.overheadTotal || 0,
            markupPct: ed?.markupPct || ed?.markup || 0,
            profit: ed?.profit || 0,
            marginPct: ed?.marginPct || 0,
            bidMarginPct: getBidMarginPct(ed, p.bidPrice || ed?.totalBid || 0),
            currentMarginPct: getCurrentMarginPct(p.bidPrice || ed?.totalBid || 0, p.totalSpent || p.actualCost || computedActualCost || (p.projectData?.spent || p.projectData?.actualCost || 0)),
          };
        });
        
        // When from Project Detail, inject Overview's projected margin/profit, spend-to-date margin, and actual cost into current project so backend uses correct numbers
        if (baseContext.projectId) {
          const idx = allProjects.findIndex((p: any) => String(p?.id) === String(baseContext.projectId));
          if (idx >= 0) {
            const inject: Record<string, any> = {};
            if (typeof baseContext.projectedMarginPct === 'number' && Number.isFinite(baseContext.projectedMarginPct)) inject.projectedMarginPct = baseContext.projectedMarginPct;
            if (typeof baseContext.projectedProfit === 'number' && Number.isFinite(baseContext.projectedProfit)) inject.projectedProfit = baseContext.projectedProfit;
            if (typeof baseContext.spendToDateMarginPct === 'number' && Number.isFinite(baseContext.spendToDateMarginPct)) inject.spendToDateMarginPct = baseContext.spendToDateMarginPct;
            if (typeof baseContext.actualCost === 'number' && Number.isFinite(baseContext.actualCost)) inject.actualCost = baseContext.actualCost;
            if (typeof baseContext.totalSpent === 'number' && Number.isFinite(baseContext.totalSpent)) inject.totalSpent = baseContext.totalSpent;
            if (typeof baseContext.contractValue === 'number' && Number.isFinite(baseContext.contractValue)) inject.contractValue = baseContext.contractValue;
            if (Object.keys(inject).length > 0) allProjects[idx] = { ...allProjects[idx], ...inject };
          }
        }
        baseContext.allProjects = allProjects;
      } else {
        // Update existing allProjects with latest budget/expense data
        const existingProjects = baseContext.allProjects || [];
        const updatedProjects = existingProjects.map((existing: any) => {
          const fullProject = [...activeProjects, ...estimates].find(p => p.id === existing.id);
          if (fullProject) {
            const ed = fullProject.estimateData || fullProject.projectData?.estimateData || null;
            const rawExpensesA = Array.isArray(fullProject.expenses) ? fullProject.expenses : [];
            const rawExpensesB = Array.isArray(fullProject.projectData?.expenses) ? fullProject.projectData.expenses : [];
            const rawExpensesC = Array.isArray(existing.expenses) ? existing.expenses : [];
            const expenses = [...rawExpensesA, ...rawExpensesB, ...rawExpensesC].filter((expense: any, index: number, arr: any[]) => {
              const key = expense?.id || `${expense?.date || ''}-${expense?.vendor || ''}-${expense?.amount || 0}-${expense?.category || ''}`;
              return index === arr.findIndex((e: any) => (e?.id || `${e?.date || ''}-${e?.vendor || ''}-${e?.amount || 0}-${e?.category || ''}`) === key);
            });
            const computedActualCost = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
            return {
              ...existing,
              bidPrice: fullProject.bidPrice || ed?.totalBid || existing.bidPrice || 0,
              estimatedCost: getEstimatedCostBaseline(fullProject, ed) || existing.estimatedCost || 0,
              actualCost: fullProject.actualCost || fullProject.totalSpent || computedActualCost || (fullProject.projectData?.actualCost || fullProject.projectData?.spent || existing.actualCost || 0),
              totalSpent: fullProject.totalSpent || fullProject.actualCost || computedActualCost || (fullProject.projectData?.spent || fullProject.projectData?.actualCost || existing.totalSpent || 0),
              expenses,
              expensesCount: expenses.length || existing.expensesCount || 0,
              buckets: fullProject.buckets || fullProject.projectData?.buckets || existing.buckets || [],
              changeOrders: fullProject.projectData?.changeOrders || fullProject.changeOrders || existing.changeOrders || [],
              purchaseOrders: fullProject.projectData?.purchaseOrders || fullProject.purchaseOrders || existing.purchaseOrders || [],
              estimateData: ed || existing.estimateData || null,
              materialTotal: ed?.materialTotal || existing.materialTotal || 0,
              laborTotal: ed?.laborTotal || existing.laborTotal || 0,
              overheadTotal: ed?.overheadTotal || existing.overheadTotal || 0,
              markupPct: ed?.markupPct || ed?.markup || existing.markupPct || 0,
              profit: ed?.profit || existing.profit || 0,
              marginPct: ed?.marginPct || existing.marginPct || 0,
              bidMarginPct: getBidMarginPct(ed, fullProject.bidPrice || ed?.totalBid || existing.bidPrice || 0),
              currentMarginPct: getCurrentMarginPct(fullProject.bidPrice || ed?.totalBid || existing.bidPrice || 0, fullProject.totalSpent || fullProject.actualCost || computedActualCost || (fullProject.projectData?.spent || fullProject.projectData?.actualCost || existing.totalSpent || 0)),
              // Preserve progress from context (timeline-based from Assistant) — do not overwrite with fullProject
              progress: existing.progress ?? fullProject.progress ?? fullProject.overallProgressPct ?? 0,
            };
          }
          return existing;
        });
        // When from Project Detail, inject Overview's projected margin/profit, spend-to-date margin, and actual cost into current project
        if (baseContext.projectId) {
          const idx = updatedProjects.findIndex((p: any) => String(p?.id) === String(baseContext.projectId));
          if (idx >= 0) {
            const inject: Record<string, any> = {};
            if (typeof baseContext.projectedMarginPct === 'number' && Number.isFinite(baseContext.projectedMarginPct)) inject.projectedMarginPct = baseContext.projectedMarginPct;
            if (typeof baseContext.projectedProfit === 'number' && Number.isFinite(baseContext.projectedProfit)) inject.projectedProfit = baseContext.projectedProfit;
            if (typeof baseContext.spendToDateMarginPct === 'number' && Number.isFinite(baseContext.spendToDateMarginPct)) inject.spendToDateMarginPct = baseContext.spendToDateMarginPct;
            if (typeof baseContext.actualCost === 'number' && Number.isFinite(baseContext.actualCost)) inject.actualCost = baseContext.actualCost;
            if (typeof baseContext.totalSpent === 'number' && Number.isFinite(baseContext.totalSpent)) inject.totalSpent = baseContext.totalSpent;
            if (typeof baseContext.contractValue === 'number' && Number.isFinite(baseContext.contractValue)) inject.contractValue = baseContext.contractValue;
            if (Object.keys(inject).length > 0) updatedProjects[idx] = { ...updatedProjects[idx], ...inject };
          }
        }
        baseContext.allProjects = updatedProjects;
      }
      
      // Add activeProjectId if available
      if (baseContext.projectId && !baseContext.activeProjectId) {
        baseContext.activeProjectId = baseContext.projectId;
      }

      // Add selectedProjectId hint for Projects list screen (soft hint only)
      if (selectedProjectHintId) {
        baseContext.selectedProjectId = selectedProjectHintId;
      }
      
      // Add lastOpenedProjectId if available
      if (lastOpenedProjectId) {
        baseContext.lastOpenedProjectId = lastOpenedProjectId;
      }
      if (isProjectsScreenContext) {
        console.log('🧩 AIAssistantModal context assembly (Projects)', {
          selectedProjectId: baseContext.selectedProjectId || null,
          lastOpenedProjectId: baseContext.lastOpenedProjectId || null,
          allProjectsCount: Array.isArray(baseContext.allProjects) ? baseContext.allProjects.length : 0,
        });
      }

      // Add deterministic routing hint so backend can choose the right toolset (project vs estimate)
      // This prevents estimate-page commands from accidentally using project expense tools and vice versa.
      if (!baseContext.assistantDomain) {
        baseContext.assistantDomain = computeAssistantDomain(baseContext.screen, baseContext.status);
      }

      // Include team member data: merge global team (bps.team.members) + project crew (add_team_member adds here)
      const globalTeam = (teamMembersData || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        status: m.status,
        phone: m.phone || null,
        email: m.email || null,
        tasksOpen: m.tasksOpen || 0,
        tasksTotal: m.tasksTotal || 0,
        skills: m.skills || [],
      }));
      const projectCrew = (baseContext.crewMembers || []) as string[];
      const crewPhones = (baseContext.crewMemberPhones || {}) as Record<string, string>;
      const existingNames = new Set(globalTeam.map((m: any) => (m.name || '').toLowerCase()));
      const crewAsMembers = projectCrew
        .filter((name: string) => name && !existingNames.has(name.trim().toLowerCase()))
        .map((name: string) => {
          existingNames.add(name.trim().toLowerCase());
          return {
            id: `crew-${name}-${Date.now()}`,
            name: name.trim(),
            role: 'Crew Member',
            status: 'active',
            phone: crewPhones[name] || crewPhones[name.trim()] || null,
            email: null,
            tasksOpen: 0,
            tasksTotal: 0,
            skills: [],
          };
        });
      const mergedTeam = [...globalTeam, ...crewAsMembers];
      if (mergedTeam.length > 0) {
        baseContext.teamMembers = mergedTeam;
        baseContext.teamStats = {
          total: mergedTeam.length,
          active: mergedTeam.filter((m: any) => (m.status || '').toLowerCase() === 'active').length,
          offDuty: mergedTeam.filter((m: any) => (m.status || '').toLowerCase() === 'off_duty').length,
        };
      }
      
      return JSON.stringify(baseContext);
    } catch (e) {
      console.error('Error enhancing context:', e);
      return context || '{}';
    }
  }, [context, activeProjects, estimates, lastOpenedProjectId, updateProject, teamMembersData, selectedProjectHintId, isProjectsScreenContext]);

  // Load team data when modal opens, project changes, or team changes (e.g. after deletions)
  useEffect(() => {
    if (!visible) return;
    
    const loadTeamData = async () => {
      try {
        const teamStorageKey = 'bps.team.members';
        const teamData = await AsyncStorage.getItem(teamStorageKey);
        if (teamData) {
          const teamMembers = JSON.parse(teamData);
          setTeamMembersData(teamMembers);
        } else {
          setTeamMembersData(null);
        }
      } catch (e) {
        console.warn('Failed to load team data:', e);
        setTeamMembersData(null);
      }
    };
    
    loadTeamData();
  }, [visible, parsedContext?.projectId, parsedContext?.activeProjectId, JSON.stringify(parsedContext?.crewMembers || [])]);

  // Auto-refresh existing summary cards in place when project budgets/expenses/schedule change while chat is open.
  // Uses a lightweight polling loop + snapshot guard to avoid waiting on navigation/focus cycles.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const findLatestSummary = (list: Message[]) =>
      [...list].reverse().find((m) => {
        return isHealthRefreshMessage(m);
      });

    const dedupeExpenses = (items: any[]) =>
      items.filter((expense: any, index: number, arr: any[]) => {
        const key = expense?.id || `${expense?.date || ""}-${expense?.vendor || ""}-${expense?.amount || 0}-${expense?.category || ""}`;
        return index === arr.findIndex((e: any) => (e?.id || `${e?.date || ""}-${e?.vendor || ""}-${e?.amount || 0}-${e?.category || ""}`) === key);
      });

    const normalizeScheduleStatus = (item: any) => {
      const status = String(item?.status || "").toLowerCase();
      const progress = Number(item?.progressPct ?? item?.progress ?? 0);
      if (
        status.includes("complete") ||
        status.includes("paid") ||
        status.includes("collected") ||
        status.includes("received") ||
        item?.isComplete === true ||
        item?.completed === true ||
        item?.isPaid === true ||
        item?.paid === true ||
        item?.collected === true ||
        progress >= 100
      ) {
        return "completed";
      }
      if (status.includes("progress") || progress > 0) return "in_progress";
      return status || "pending";
    };

    const scheduleScore = (item: any) => {
      const status = normalizeScheduleStatus(item);
      const progress = Number(item?.progressPct ?? item?.progress ?? 0);
      const completionBoost = status === "completed" ? 1000 : status === "in_progress" ? 500 : 0;
      const dateBoost = item?.completedAt ? 10 : 0;
      return completionBoost + progress + dateBoost;
    };

    const dedupeSchedule = (items: any[]) => {
      const map = new Map<string, any>();
      items.forEach((item: any, index: number) => {
        const key =
          item?.id ||
          `${item?.title || item?.name || ""}-${item?.plannedDate || item?.dueDate || item?.date || ""}-${index}`;
        const normalized = {
          ...item,
          status: normalizeScheduleStatus(item),
          progressPct:
            Number(item?.progressPct ?? item?.progress ?? 0) ||
            (normalizeScheduleStatus(item) === "completed" ? 100 : 0),
        };
        const existing = map.get(key);
        if (!existing || scheduleScore(normalized) >= scheduleScore(existing)) {
          map.set(key, normalized);
        }
      });
      return Array.from(map.values());
    };

    const computeSnapshot = (ctxObj: any) => {
      const expenses = Array.isArray(ctxObj?.expenses) ? ctxObj.expenses : [];
      const totalSpent = expenses.reduce((sum: number, e: any) => sum + Number(e?.amount || 0), 0);
      const laborSpent = expenses
        .filter((e: any) => String(e?.category || "").toLowerCase().includes("labor"))
        .reduce((sum: number, e: any) => sum + Number(e?.amount || 0), 0);
      const materialSpent = expenses
        .filter((e: any) => !String(e?.category || "").toLowerCase().includes("labor"))
        .reduce((sum: number, e: any) => sum + Number(e?.amount || 0), 0);
      const milestoneCount = Array.isArray(ctxObj?.milestones) ? ctxObj.milestones.length : 0;
      return JSON.stringify({
        projectId: ctxObj?.resolvedProjectId || ctxObj?.projectId || ctxObj?.activeProjectId || "",
        totalSpent,
        laborSpent,
        materialSpent,
        expensesCount: expenses.length,
        milestoneCount,
      });
    };

    const runRefresh = async () => {
      if (cancelled || loading || isTyping || autoRefreshInFlightRef.current) return;
      if (messages.length === 0) return;

      const latestSummary = findLatestSummary(messages);
      if (!latestSummary) return;

      let ctxObj: any = {};
      try {
        ctxObj = enhancedContext ? JSON.parse(enhancedContext) : {};
      } catch {
        ctxObj = {};
      }

      // Pull freshest project snapshot directly from context/provider to avoid stale UI snapshots.
      const targetProjectId = ctxObj?.resolvedProjectId || ctxObj?.projectId || ctxObj?.activeProjectId || lastOpenedProjectId;
      if (targetProjectId) {
        const liveProject: any = getProjectById(targetProjectId);
        let storageProject: any = null;
        let timelineItems: any[] = [];
        try {
          const storageRaw = await AsyncStorage.getItem(`bps.project.${targetProjectId}`);
          if (storageRaw) storageProject = JSON.parse(storageRaw);
          const timelineRaw = await AsyncStorage.getItem(`bps.timeline.v2.${targetProjectId}`);
          if (timelineRaw) timelineItems = JSON.parse(timelineRaw);
        } catch (e) {
          console.warn("Auto-refresh: failed reading project from AsyncStorage:", e);
        }
        const mergedSchedule = dedupeSchedule([
          ...(Array.isArray(ctxObj?.milestones) ? ctxObj.milestones : []),
          ...(Array.isArray(ctxObj?.weeklyPayments) ? ctxObj.weeklyPayments : []),
          ...(Array.isArray(ctxObj?.paymentMilestones) ? ctxObj.paymentMilestones : []),
          ...(Array.isArray(storageProject?.milestones) ? storageProject.milestones : []),
          ...(Array.isArray(storageProject?.weeklyPayments) ? storageProject.weeklyPayments : []),
          ...(Array.isArray(storageProject?.paymentMilestones) ? storageProject.paymentMilestones : []),
          ...(Array.isArray(storageProject?.estimateData?.weeklyPayments) ? storageProject.estimateData.weeklyPayments : []),
          ...(Array.isArray(storageProject?.estimateData?.paymentMilestones) ? storageProject.estimateData.paymentMilestones : []),
          ...(Array.isArray(liveProject?.milestones) ? liveProject.milestones : []),
          ...(Array.isArray(liveProject?.timelineItems) ? liveProject.timelineItems : []),
          ...(Array.isArray(liveProject?.weeklyPayments) ? liveProject.weeklyPayments : []),
          ...(Array.isArray(liveProject?.paymentMilestones) ? liveProject.paymentMilestones : []),
          ...(Array.isArray(liveProject?.projectData?.milestones) ? liveProject.projectData.milestones : []),
          ...(Array.isArray(liveProject?.projectData?.timelineItems) ? liveProject.projectData.timelineItems : []),
          ...(Array.isArray(liveProject?.projectData?.weeklyPayments) ? liveProject.projectData.weeklyPayments : []),
          ...(Array.isArray(liveProject?.projectData?.paymentMilestones) ? liveProject.projectData.paymentMilestones : []),
          ...(Array.isArray(liveProject?.estimateData?.weeklyPayments) ? liveProject.estimateData.weeklyPayments : []),
          ...(Array.isArray(liveProject?.estimateData?.paymentMilestones) ? liveProject.estimateData.paymentMilestones : []),
          ...(Array.isArray(timelineItems) ? timelineItems : []),
        ]);
        if (liveProject) {
          const liveEstimate =
            storageProject?.estimateData ||
            liveProject?.estimateData ||
            liveProject?.projectData?.estimateData ||
            ctxObj?.estimateData ||
            null;
          const mergedExpenses = dedupeExpenses([
            ...(Array.isArray(ctxObj?.expenses) ? ctxObj.expenses : []),
            ...(Array.isArray(storageProject?.expenses) ? storageProject.expenses : []),
            ...(Array.isArray(liveProject?.expenses) ? liveProject.expenses : []),
            ...(Array.isArray(liveProject?.projectData?.expenses) ? liveProject.projectData.expenses : []),
          ]);

          ctxObj = {
            ...ctxObj,
            projectId: targetProjectId,
            resolvedProjectId: targetProjectId,
            estimateData: liveEstimate,
            paymentSchedule: liveEstimate?.paymentSchedule ?? liveProject?.paymentSchedule ?? (liveProject?.projectData as any)?.paymentSchedule ?? ctxObj?.paymentSchedule,
            expenses: mergedExpenses,
            expensesCount: mergedExpenses.length,
            actualCost: mergedExpenses.reduce((sum: number, e: any) => sum + Number(e?.amount || 0), 0),
            totalSpent: mergedExpenses.reduce((sum: number, e: any) => sum + Number(e?.amount || 0), 0),
            laborTotal: Number(liveEstimate?.laborTotal || ctxObj?.laborTotal || 0),
            materialTotal: Number(liveEstimate?.materialTotal || ctxObj?.materialTotal || 0),
            milestones: mergedSchedule,
            weeklyPayments: mergedSchedule,
            paymentMilestones: mergedSchedule,
          };
        } else if (storageProject) {
          const mergedExpenses = dedupeExpenses([
            ...(Array.isArray(ctxObj?.expenses) ? ctxObj.expenses : []),
            ...(Array.isArray(storageProject?.expenses) ? storageProject.expenses : []),
          ]);
          ctxObj = {
            ...ctxObj,
            projectId: targetProjectId,
            resolvedProjectId: targetProjectId,
            estimateData: storageProject?.estimateData || ctxObj?.estimateData || null,
            paymentSchedule: (storageProject?.estimateData || ctxObj?.estimateData)?.paymentSchedule ?? storageProject?.paymentSchedule ?? ctxObj?.paymentSchedule,
            expenses: mergedExpenses,
            expensesCount: mergedExpenses.length,
            actualCost: mergedExpenses.reduce((sum: number, e: any) => sum + Number(e?.amount || 0), 0),
            totalSpent: mergedExpenses.reduce((sum: number, e: any) => sum + Number(e?.amount || 0), 0),
            milestones: mergedSchedule,
            weeklyPayments: mergedSchedule,
            paymentMilestones: mergedSchedule,
          };
        }
      }

      const snapshot = computeSnapshot(ctxObj);
      if (snapshot === lastAutoRefreshSnapshotRef.current) return;
      lastAutoRefreshSnapshotRef.current = snapshot;

      autoRefreshInFlightRef.current = true;
      try {
        const AI_API_BASE = resolveAIBaseUrl();
        const API_URL = `${AI_API_BASE}/api/ai-assistant`;
        const token = await getToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const response = await fetch(API_URL, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message:
              "Refresh this project health check using the SAME detailed format as before (not compressed). Keep section headers and bullet structure. Use this exact style: Budget Overview, Material Budget, Labor Budget, Margin Summary, Key Insights. Update only the numbers and keep the narrative format consistent.",
            context: stampAiContextSnapshot(JSON.stringify(ctxObj)) ?? JSON.stringify(ctxObj),
            history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
            user_settings: { ai_project_manager_mode: aiManagerEnabled },
          }),
        });

        const data = await response.json();
        if (!data?.error && data?.reply) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === latestSummary.id
                ? {
                    ...m,
                    content: data.reply,
                    timestamp: new Date(),
                  }
                : m
            )
          );
        }
      } catch (e) {
        console.warn("Auto-refresh summary failed:", e);
      } finally {
        autoRefreshInFlightRef.current = false;
      }
    };

    // Run once immediately, then poll lightly while chat stays open.
    runRefresh();
    autoRefreshIntervalRef.current = setInterval(runRefresh, 1800);

    return () => {
      cancelled = true;
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
    };
  }, [visible, loading, isTyping, messages, enhancedContext, aiManagerEnabled, getToken, getProjectById, lastOpenedProjectId]);

  // Handler for project selection from chips
  const handleProjectSelection = async (projectId: string) => {
    if (!pendingProjectSelection) return;
    
    // Store as last opened
    await setLastOpenedProjectId(projectId);
    setLastOpenedProjectIdState(projectId);
    
    // Get the selected project name
    const selectedProject = [...activeProjects, ...estimates].find(p => p.id === projectId);
    const projectName = selectedProject?.title || selectedProject?.name || 'the project';
    
    const query = pendingProjectSelection.query;
    setPendingProjectSelection(null);
    // Resume original intent: inject resolved project so sendMessage uses it (avoids re-asking "which project?")
    pendingResolvedProjectIdRef.current = projectId;
    
    // Check if we need to ask about analysis type
    const intent = detectProjectIntent(query);
    // CRITICAL: Detect expense logging requests - must catch "log expense", "log an expense", "can you log", etc.
    const expenseLoggingPattern = /\b(log|record|add|need to log|can you log)\s+(an?\s+)?expense/i;
    const isExpenseLikeQuery = expenseLoggingPattern.test(query) ||
                              /\b(expense|expenses|material|materials|labor|labour|spent|bought|purchased)\b/i.test(query);
    // CRITICAL: Detect change order requests - must catch "create change order", "create a change order", etc.
    const changeOrderPattern = /\b(create|add|make|i need|i want|give me|start)\s+(me\s+)?(a\s+)?(change\s+order|changeorder)\b/i;
    const isChangeOrderQuery = changeOrderPattern.test(query) ||
                              /\bchange\s+order\b/i.test(query) ||
                              /\bscope\s+change\b/i.test(query) ||
                              /\bclient\s+wants\s+to\s+add\b/i.test(query) ||
                              /\bextra\s+work\b/i.test(query);
    // Skip analysis-type chip for "making enough" / margin questions — backend returns deterministic margin answer
    const isMakingEnoughOrMarginQuery = /\bmaking\s+enough\b/i.test(query) && (/\bmoney\b|\bjob\b|\bproject\b/i.test(query) || /\b(am\s+i|are\s+we)\s+making\s+enough/i.test(query)) ||
      /\b(what is my|what'?s my)\s+(profit\s+)?margin\b/i.test(query);
    // Skip for scenario requests (worst case, what if, profit scenarios, green-card ids) — backend runs scenario analysis
    const isScenarioQuery = /\b(worst\s*[- ]?case|best\s*[- ]?case|what\s*if|run\s+scenario|scenario\s+analysis)\b/i.test(query) ||
      /\b(typical\s*friction|bad\s*remodel|smooth\s*job)\b/i.test(query) ||
      /\bshow\s+me\s+(the\s+)?(worst|best)\s+case\b/i.test(query) ||
      /\b(what is my profit scenarios?|what are my profit scenarios?|(show me\s+)(the\s+)?profit scenarios?|profit scenarios?)\b/i.test(query) ||
      SCENARIO_SELECTION_ID_PATTERN.test(query.trim());
    if (!isExpenseLikeQuery && !isChangeOrderQuery && !isMakingEnoughOrMarginQuery && !isScenarioQuery && !isEstimateContext && intent.analysisType === 'unspecified' && (intent.type === 'project_analysis' || intent.type === 'project_health')) {
      setPendingAnalysisType({
        query,
        projectId,
      });
      // Show a message asking about analysis type
      const analysisTypeMsg: Message = {
        id: Date.now().toString() + '-analysis-type',
        role: 'assistant',
        content: `Got it! I'll analyze ${projectName}. Do you want a quick health check or full breakdown?`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, analysisTypeMsg]);
      return;
    }
    
    // Send the query with resolved project — pass query explicitly so we don't rely on setState
    setInput(query);
    setTimeout(() => {
      sendMessage(query);
    }, 100);
  };

  // Handler for projects-screen persistent project targeting chips
  const handleProjectsScreenProjectSelection = async (projectId: string) => {
    try {
      portfolioScopeOverrideRef.current = false;
      await setLastOpenedProjectId(projectId);
      setLastOpenedProjectIdState(projectId);
      onSelectedProjectIdChange?.(projectId);
      console.log('🎯 Projects AI selectedProjectId updated', { projectId });
    } catch (e) {
      console.warn('⚠️ Failed to persist selectedProjectId for Projects AI:', e);
    }
  };

  // Handler for analysis type selection from chips
  const handleAnalysisTypeSelection = async (type: 'quick' | 'full') => {
    if (!pendingAnalysisType) return;
    
    const query = pendingAnalysisType.query;
    const projectId = pendingAnalysisType.projectId;
    setPendingAnalysisType(null);
    
    // Modify the query to include the analysis type
    let modifiedQuery = query;
    if (type === 'quick') {
      modifiedQuery = `${query} (quick health check)`;
    } else {
      modifiedQuery = `${query} (full breakdown)`;
    }
    
    // Send the modified query — pass explicitly so we don't rely on setState
    setInput(modifiedQuery);
    setTimeout(() => {
      sendMessage(modifiedQuery);
    }, 100);
  };

  // Handler for payment selection from chips (mark payment as completed flow)
  const handlePaymentSelection = async (paymentId: string, paymentTitle: string) => {
    if (!pendingPaymentSelection) return;
    const projectId = pendingPaymentSelection.projectId;
    const projectName = pendingPaymentSelection.projectName;
    setPendingPaymentSelection(null);
    if (projectId) {
      pendingPaymentProjectIdRef.current = projectId;
      pendingPaymentProjectNameRef.current = projectName || null;
      await setLastOpenedProjectId(projectId);
      setLastOpenedProjectIdState(projectId);
    }
    setInput(paymentTitle);
    setTimeout(() => {
      sendMessage(paymentTitle);
    }, 100);
  };

  // Handler for expense type selection from chips
  const handleExpenseTypeSelection = async (id: string) => {
    if (!pendingExpenseTypeSelection) return;
    setPendingExpenseTypeSelection(null);
    pendingExpenseTypeResumeRef.current = { type: id };
    const msg = id === 'labor' ? 'labor' : id === 'materials' ? 'materials' : id;
    setInput(msg);
    setTimeout(() => {
      sendMessage(msg);
    }, 100);
  };

  // Handler for PO selection from chips
  const handlePOSelection = async (id: string, option: { title: string }) => {
    if (!pendingPOSelection) return;
    const projectId = pendingPOSelection.projectId;
    const projectName = pendingPOSelection.projectName;
    setPendingPOSelection(null);
    if (projectId) {
      pendingPOProjectIdRef.current = projectId;
      pendingPOProjectNameRef.current = projectName || null;
      await setLastOpenedProjectId(projectId);
      setLastOpenedProjectIdState(projectId);
    }
    pendingPOResumeRef.current = { poNumber: option.title || id };
    const poIdentifier = option.title || id;
    setInput(poIdentifier);
    setTimeout(() => {
      sendMessage(poIdentifier);
    }, 100);
  };

  // Handler for scenario selection from chips
  const handleScenarioSelection = async (id: string) => {
    if (!pendingScenarioSelection) return;
    setPendingScenarioSelection(null);
    pendingScenarioResumeRef.current = { scenario: id };
    setInput(id);
    setTimeout(() => {
      sendMessage(id);
    }, 100);
  };

  // Hash-based caching for health summaries
  const computeProjectHash = (projectData: any): string => {
    // Create a hash from key project metrics that affect health
    const hashData = {
      projectId: projectData?.projectId || projectData?.id,
      bidTotal: projectData?.bidTotal || projectData?.total || 0,
      estimatedCost: projectData?.estimatedCost || 0,
      actualCost: projectData?.actualCost || projectData?.spent || 0,
      margin: projectData?.margin || 0,
      markup: projectData?.markup || 0,
      progress: projectData?.progress || projectData?.overallProgressPct || 0,
      status: projectData?.status,
      bucketCount: projectData?.bucketCount || projectData?.buckets?.length || 0,
      milestoneCount: projectData?.milestoneCount || projectData?.milestones?.length || 0,
      expenseCount: projectData?.expenseCount || projectData?.expenses?.length || 0,
      changeOrderCount: projectData?.changeOrderCount || projectData?.changeOrders?.length || 0,
    };
    // Simple hash function (for production, consider using crypto)
    return JSON.stringify(hashData);
  };

  const getCachedHealthSummary = async (projectHash: string): Promise<string | null> => {
    try {
      const cacheKey = `ai_pm_health_${projectHash}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const { summary, timestamp } = JSON.parse(cached);
        const TTL = 6 * 60 * 60 * 1000; // 6 hours
        if (Date.now() - timestamp < TTL) {
          return summary;
        }
        // Cache expired, remove it
        await AsyncStorage.removeItem(cacheKey);
      }
      return null;
    } catch (e) {
      console.warn('Error reading health summary cache:', e);
      return null;
    }
  };

  const setCachedHealthSummary = async (projectHash: string, summary: string) => {
    try {
      const cacheKey = `ai_pm_health_${projectHash}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        summary,
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.warn('Error caching health summary:', e);
    }
  };

  // Helper function to generate user-friendly action descriptions
  const getActionDescription = (action: any): string | null => {
    if (!action || !action.type) return null;

    switch (action.type) {
      case 'rename_estimate':
        return `Rename this estimate to "${action.title || action.estimateName || 'Untitled Bid'}"?`;

      case 'set_markup_percentage':
        return `Set markup to ${action.markupPct}%?`;

      case 'apply_estimate_pricing_fields': {
        const lines: string[] = [];
        const label = (k: string, v: unknown) =>
          `- ${k}: $${Number(v || 0).toLocaleString()}`;
        if (action.planCost != null) lines.push(label('Plans', action.planCost));
        if (action.permitCost != null) lines.push(label('Permits', action.permitCost));
        if (action.otherDirectCost != null) lines.push(label('Other direct costs', action.otherDirectCost));
        if (action.equipment != null) lines.push(label('Equipment rental', action.equipment));
        if (action.insuranceOverhead != null) lines.push(label('Insurance overhead', action.insuranceOverhead));
        if (action.equipmentMaintenance != null) lines.push(label('Equipment maintenance', action.equipmentMaintenance));
        if (action.facilities != null) lines.push(label('Facilities', action.facilities));
        if (action.otherOverhead != null) lines.push(label('Other overhead', action.otherOverhead));
        const body = lines.length > 0 ? `\n\n${lines.join('\n')}` : '';
        return `Update Step 5 pricing (direct costs vs overhead)?${body}`;
      }

      case 'replace_payment_schedule': {
        const scheduleLabel =
          action.paymentSchedule === 'weekly'
            ? 'weekly'
            : action.paymentSchedule === 'hybrid'
              ? 'hybrid'
              : 'milestone-based';
        const money = (value: unknown) =>
          `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const pct = (value: unknown) =>
          value == null || Number.isNaN(Number(value)) ? '' : ` (${Number(value).toLocaleString()}%)`;
        const dateText = (value: unknown) => {
          const raw = String(value || '').trim();
          if (!raw) return '';
          const dt = new Date(`${raw}T00:00:00`);
          return Number.isNaN(dt.getTime()) ? ` on ${raw}` : ` on ${dt.toLocaleDateString()}`;
        };

        if (action.paymentSchedule === 'weekly' && Array.isArray(action.weeklyPayments) && action.weeklyPayments.length > 0) {
          const deposit =
            action.weeklyPayments.find((payment: any) =>
              Number(payment?.weekNumber) === 0 ||
              /\bdeposit\b/i.test(String(payment?.name || payment?.description || ''))
            ) || null;
          const recurring = action.weeklyPayments.filter((payment: any) => payment !== deposit);
          const previewLines: string[] = [];
          previewLines.push(`- Weekly schedule: ${recurring.length} week${recurring.length === 1 ? '' : 's'}`);
          if (deposit) {
            previewLines.push(`- Deposit: ${money(deposit.amount)}${pct(deposit.percentage)}${dateText(deposit.scheduledDate || deposit.dueDate)}`);
          }
          recurring.slice(0, 4).forEach((payment: any, index: number) => {
            previewLines.push(
              `- ${payment?.name || `Week ${index + 1} progress payment`}: ${money(payment?.amount)}${pct(payment?.percentage)}${dateText(payment?.scheduledDate || payment?.dueDate)}`
            );
          });
          if (recurring.length > 4) {
            previewLines.push(`- plus ${recurring.length - 4} more weekly payment${recurring.length - 4 === 1 ? '' : 's'}`);
          }
          return `Replace the current payment schedule with a ${scheduleLabel} schedule${action.safer ? ' with earlier cash protection' : ''}?\n\n${previewLines.join('\n')}`;
        }

        if (action.paymentSchedule === 'milestone-based' && Array.isArray(action.paymentMilestones) && action.paymentMilestones.length > 0) {
          const previewLines = action.paymentMilestones.slice(0, 4).map((milestone: any) =>
            `- ${milestone?.name || 'Milestone'}: ${money(milestone?.paymentAmount ?? milestone?.amount)}${pct(milestone?.percentage)}`
          );
          if (action.paymentMilestones.length > 4) {
            previewLines.push(`- plus ${action.paymentMilestones.length - 4} more milestone payment${action.paymentMilestones.length - 4 === 1 ? '' : 's'}`);
          }
          return `Replace the current payment schedule with a ${scheduleLabel} schedule${action.safer ? ' with earlier cash protection' : ''}?\n\n${previewLines.join('\n')}`;
        }

        return `Replace the current payment schedule with a ${scheduleLabel} schedule${action.safer ? ' with earlier cash protection' : ''}?`;
      }

      case 'rebalance_payment_schedule':
        return 'Rebalance the current payment schedule so it totals 100%?';

      case 'add_starter_materials':
        return `Add editable starter material placeholders${action.projectType ? ` for this ${String(action.projectType).replace(/_/g, ' ')}` : ''}?`;

      case 'add_starter_labor':
        return `Add editable starter labor placeholders${action.projectType ? ` for this ${String(action.projectType).replace(/_/g, ' ')}` : ''}?`;

      case 'add_common_scope_package':
        return `Add a ${action.tier || 'standard'} starter scope package with editable materials and labor placeholders?`;

      case 'create_estimate_variant':
        return `Apply the ${String(action.variantType || 'standard').replace(/_/g, ' ')} version to the current estimate?`;

      case 'add_estimate_line_items': {
        const items = Array.isArray(action.items) ? action.items : [];
        if (items.length === 0) return 'Add these estimate items to this bid?';
        const lines = items
          .slice(0, 6)
          .map((item: any) => `- ${item.name || 'Line item'} — $${Number(item.amount || item.unitCost || 0).toLocaleString()}`);
        const moreLine = items.length > 6 ? `\n- plus ${items.length - 6} more item${items.length - 6 === 1 ? '' : 's'}` : '';
        return `Add these ${items.every((item: any) => item.kind === 'labor') ? 'labor' : items.every((item: any) => item.kind !== 'labor') ? 'material' : 'estimate'} items to ${action.projectName || 'this bid'}?\n\n${lines.join('\n')}${moreLine}`;
      }

      case 'update_estimate_item':
        if (action.newDescription && action.newAmount) {
          return `Add new ${action.itemDescription || 'item'}: "${action.newDescription}" for $${action.newAmount.toLocaleString()}?`;
        } else if (action.itemDescription && action.newAmount) {
          return `Update "${action.itemDescription}" to $${action.newAmount.toLocaleString()}?`;
        }
        return `Update estimate item: ${action.itemDescription || 'item'}`;
      
      case 'add_change_order':
        return `Create change order: "${action.title}" for $${action.amount.toLocaleString()}?`;
      
      case 'create_change_order': {
        const co = action.changeOrder || {};
        const coAmount = co.clientPrice || co.cost || co.amount || action.amount || 0;
        const coDesc = co.description || action.description || 'Change Order';
        const coVendor = co.vendor || action.vendor || '';
        return `Approve Change Order?\n\nDo you want to approve this change order for $${Number(coAmount).toLocaleString()}?\n\n"${coDesc}"${coVendor ? ` from ${coVendor}` : ''}\n\nApproved change orders will be added to your budget.`;
      }
      
      case 'add_material':
        return `Record material purchase: $${action.amount.toLocaleString()} from ${action.vendor}?`;
      
      case 'add_labor_expense':
        return `Record labor expense: $${action.amount.toLocaleString()}?`;
      
      case 'add_purchase_order':
        return `Create purchase order: $${action.amount.toLocaleString()} to ${action.vendor}?`;
      
      case 'assign_pm':
        return `Assign ${action.pmName || 'this person'} as project manager for ${action.projectName || 'this project'}?`;
      
      case 'add_team_member': {
        const tm = action.teamMember || {};
        const phonePart = tm.phone ? ` — ${tm.phone}` : '';
        return `Add ${tm.name || 'this person'} (${tm.role || 'Crew Member'})${phonePart} to the team for ${action.projectName || 'this project'}?`;
      }
      
      case 'update_team_member_status':
        return `Update ${action.memberName || 'this team member'} to ${action.status === 'active' ? 'active' : 'off duty'}?`;
      
      case 'update_customer_info':
        const fields = [];
        if (action.customerName) fields.push(`Name: ${action.customerName}`);
        if (action.email) fields.push(`Email: ${action.email}`);
        if (action.phone) fields.push(`Phone: ${action.phone}`);
        if (action.address || action.city || action.state || action.zip) {
          const addrStr = String(action.address || '').trim();
          const zipStr = String(action.zip || '').trim();
          const cityStr = String(action.city || '').trim();
          const stateStr = String(action.state || '').trim();
          const addressParts = addrStr ? [addrStr] : [];
          for (const seg of [cityStr, stateStr]) {
            if (seg && !addrStr.includes(seg)) addressParts.push(seg);
          }
          if (zipStr) {
            const zre = new RegExp(`\\b${zipStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
            if (!zre.test(addressParts.join(', '))) addressParts.push(zipStr);
          }
          if (addressParts.length) fields.push(`Address: ${addressParts.join(', ')}`);
        }
        if (action.company) fields.push(`Company: ${action.company}`);
        if (action.notes) fields.push(`Notes: ${action.notes}`);
        return `Save this to Step 1 (Customer information)${fields.length > 0 ? `?\n\n- ${fields.join('\n- ')}` : '?'}`;

      case 'update_project_info': {
        const fields: string[] = [];
        if (action.title) fields.push(`Title: ${action.title}`);
        if (action.projectType) {
          fields.push(`Type: ${String(action.projectType).replace(/_/g, ' ')}`);
        }
        if (action.scopeDescription) {
          const desc =
            action.scopeDescription.length > 120
              ? `${action.scopeDescription.substring(0, 117)}...`
              : action.scopeDescription;
          fields.push(`Description: ${desc}`);
        }
        if (action.sqft != null) fields.push(`Sq ft: ${action.sqft}`);
        if (action.startDate) fields.push(`Start: ${formatIsoDateMMDDYYYY(action.startDate)}`);
        if (action.endDate) fields.push(`End: ${formatIsoDateMMDDYYYY(action.endDate)}`);
        return `Save this to Step 2 (Project information)${fields.length > 0 ? `?\n\n- ${fields.join('\n- ')}` : '?'}`;
      }
      
      case 'update_project_details':
        const projectFields = [];
        if (action.budgetRange) {
          const budgetLabels: { [key: string]: string } = {
            'under-10k': 'Under $10k',
            '10k-25k': '$10k - $25k',
            '25k-50k': '$25k - $50k',
            '50k-100k': '$50k - $100k',
            'over-100k': 'Over $100k',
            'flexible': 'Flexible'
          };
          projectFields.push(`Budget: ${budgetLabels[action.budgetRange] || action.budgetRange}`);
        }
        if (action.scopeDescription) {
          const desc = action.scopeDescription.length > 50 
            ? action.scopeDescription.substring(0, 50) + '...' 
            : action.scopeDescription;
          projectFields.push(`Scope: ${desc}`);
        }
        if (action.startDate) {
          const date = new Date(action.startDate + 'T00:00:00');
          projectFields.push(`Start: ${date.toLocaleDateString()}`);
        }
        if (action.endDate) {
          const date = new Date(action.endDate + 'T00:00:00');
          projectFields.push(`End: ${date.toLocaleDateString()}`);
        }
        return projectFields.length > 0 
          ? `Update project details: ${projectFields.join(', ')}?`
          : `Update project details?`;
      
      case 'search_material_prices':
        return `Search prices for ${action.material}${action.comparison ? ` (compare stores)` : ''}?`;
      
      case 'search_contractors':
        return `Search for ${action.trade} contractors${action.location ? ` in ${action.location}` : ''}?`;
      
      case 'update_overhead_markup':
        const parts = [];
        if (action.insuranceOverhead !== undefined) parts.push(`Insurance: $${action.insuranceOverhead}`);
        if (action.equipment !== undefined) parts.push(`Equipment rental: $${action.equipment}`);
        if (action.equipmentMaintenance !== undefined) parts.push(`Equipment maintenance: $${action.equipmentMaintenance}`);
        if (action.facilities !== undefined) parts.push(`Facilities: $${action.facilities}`);
        if (action.otherOverhead !== undefined) parts.push(`Other: $${action.otherOverhead}`);
        if (action.markupPct !== undefined) parts.push(`Markup: ${action.markupPct}%`);
        return parts.length > 0 ? `Update overhead & markup: ${parts.join(', ')}?` : `Update overhead & markup?`;
      
      case 'add_payment_milestone':
        if (action.milestone) {
          const milestone = action.milestone;
          const details = [];
          if (milestone.percentage) details.push(`${milestone.percentage}%`);
          if (milestone.amount) details.push(`$${milestone.amount}`);
          if (milestone.scheduledDate) details.push(`on ${new Date(milestone.scheduledDate + 'T00:00:00').toLocaleDateString()}`);
          return `Add payment milestone "${milestone.name}"${details.length > 0 ? ` (${details.join(', ')})` : ''}?`;
        }

      case 'create_calendar_event': {
        const ev = action.event || {};
        const t = ev.type || 'event';
        const d = ev.date || '?';
        const tm = ev.time ? ` at ${ev.time}` : '';
        return `Add to **Project Calendar**?\n\n**${ev.title || 'Event'}** (${t}) — ${d}${tm}\nProject: **${action.projectName || 'Project'}**`;
      }
        return `Add payment milestone?`;
      
      case 'add_weekly_payment':
        if (action.payment) {
          const payment = action.payment;
          const details = [];
          if (payment.weekNumber) details.push(`Week ${payment.weekNumber}`);
          if (payment.amount) details.push(`$${payment.amount}`);
          return `Add weekly payment${details.length > 0 ? `: ${details.join(' - ')}` : ''}?`;
        }
        return `Add weekly payment?`;
      
      case 'set_payment_schedule_type':
        const scheduleType = action.paymentSchedule === 'milestone-based' ? 'Milestone-Based' : 'Weekly';
        return `Set payment schedule to ${scheduleType}?`;
      
      case 'set_work_schedule':
        const workSchedule = action.workSchedule === 'weekdays' ? 'Weekdays Only' : 'Flexible';
        return `Set work schedule to ${workSchedule}?`;
      
      case 'set_project_timeline':
        const timelineParts = [];
        if (action.startDate) timelineParts.push(`Start: ${new Date(action.startDate + 'T00:00:00').toLocaleDateString()}`);
        if (action.durationDays) timelineParts.push(`Duration: ${action.durationDays} days`);
        return timelineParts.length > 0 ? `Set project timeline: ${timelineParts.join(', ')}?` : `Set project timeline?`;

      case 'share_contract':
        if (action.shareMethod === 'email' && action.email) {
          return `Share contract for ${action.projectName} via email to ${action.email}?`;
        } else if ((action.shareMethod === 'text' || action.shareMethod === 'sms') && action.phoneNumber) {
          return `Share contract for ${action.projectName} via text to ${action.phoneNumber}?`;
        }
        return `Share contract for ${action.projectName}?`;

      case 'show_contract':
        return null; // No confirmation needed, just show it
      
      case 'log_daily_progress':
        return `Add daily log entry for ${action.projectName || 'project'}?`;
      
      case 'forecast_total_cost':
        return null; // Informational - no confirmation needed
      
      case 'find_alternative_materials':
        return null; // Informational - no confirmation needed
      
      case 'generate_project_proposal':
        return `Generate proposal for ${action.projectName || 'project'}?`;
      
      case 'export_estimate_pdf':
        return `Export estimate PDF for ${action.projectName || 'project'}?`;
      
      case 'safety_checklist':
        return null; // Informational - no confirmation needed
      
      case 'recommend_next_steps':
        return null; // Informational - no confirmation needed
      
      case 'generate_client_update':
        return null; // Informational - no confirmation needed
      
      case 'translate_update':
        return null; // Informational - no confirmation needed
      
      case 'profitability_forecast_pro':
        return null; // Informational - no confirmation needed
      
      case 'ai_project_manager_mode':
        return `Configure AI PM mode: ${action.enabled ? 'Enable' : 'Disable'} for ${action.projectName || 'all projects'}?`;
      
      default:
        return `Execute: ${action.type}?`;
    }
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow microphone access to use voice recording.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setRecordingDuration(0); // Reset duration
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true); // This will trigger the useEffect to start the timer
      
      console.log('🎤 Recording started');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    
    try {
      setIsRecording(false);
      if (recordingDurationRef.current) {
        clearInterval(recordingDurationRef.current);
        recordingDurationRef.current = null;
      }
      
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      
      const uri = recording.getURI();
      setRecording(null);
      
      if (!uri) {
        Alert.alert('Error', 'Recording failed. Please try again.');
        return;
      }
      
      // Convert audio to text
      await transcribeAudio(uri);
      
      // Clean up the audio file - temp files are auto-cleaned by OS
      // No need to manually delete, expo-av handles cleanup
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('Failed to stop recording:', err);
      Alert.alert('Error', 'Failed to process recording. Please try again.');
      setRecording(null);
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioUri: string) => {
    try {
      setLoading(true);
      console.log('🎤 Starting transcription for:', audioUri);
      
      // Read the audio file as base64 using legacy API (required for expo-file-system v19+)
      // The legacy API maintains backward compatibility with readAsStringAsync
      const base64Audio = await FileSystemLegacy.readAsStringAsync(audioUri, {
        encoding: 'base64',
      });
      
      console.log('🎤 Audio file read, size:', base64Audio.length, 'characters');
      
      // Get auth token
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      // Send to backend for transcription
      const AI_API_BASE = resolveAIBaseUrl();
      const API_URL = `${AI_API_BASE}/api/ai-assistant/transcribe`;
      
      console.log('🎤 Sending transcription request to:', API_URL);
      
      const response = await fetch(API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          audio: base64Audio,
          format: Platform.OS === 'ios' ? 'm4a' : 'mp4', // iOS uses m4a, Android uses mp4
        }),
      });
      
      console.log('🎤 Transcription response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('🎤 Transcription failed:', response.status, errorData);
        throw new Error(`Transcription failed: ${response.status} - ${errorData.message || errorData.error || 'Unknown error'}`);
      }
      
      const data = await response.json();
      console.log('🎤 Transcription response:', data);
      
      const transcribedText = data.text || data.transcription || '';
      
      if (transcribedText.trim()) {
        console.log('✅ Transcription successful:', transcribedText);
        // Set the transcribed text in the input field
        setInput(transcribedText);
        // Optionally auto-send
        // sendMessage();
      } else {
        console.warn('⚠️ Transcription returned empty text');
        Alert.alert('No Speech Detected', 'Could not detect any speech in the recording. Please try again.');
      }
    } catch (err: any) {
      console.error('❌ Transcription error:', err);
      console.error('❌ Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
      
      // Show more helpful error message
      const errorMessage = err.message || 'Unknown error occurred';
      Alert.alert(
        'Transcription Unavailable',
        `Voice transcription failed: ${errorMessage}. Please type your message instead.`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── Receipt photo → parsed expense (additive, non-invasive) ─────────────
  const captureAndParseReceipt = async (source: 'camera' | 'library') => {
    try {
      // Permissions
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera permission needed', 'Enable camera access in Settings to scan receipts.');
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Photos permission needed', 'Enable photo access in Settings to upload receipts.');
          return;
        }
      }

      const pickerResult = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.6,
            base64: true,
            exif: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.6,
            base64: true,
            exif: false,
          });

      if (pickerResult.canceled || !pickerResult.assets?.length) return;

      const asset = pickerResult.assets[0];
      let base64 = asset.base64 || '';
      if (!base64 && asset.uri) {
        try {
          base64 = await FileSystemLegacy.readAsStringAsync(asset.uri, { encoding: 'base64' });
        } catch (_readErr) {
          base64 = '';
        }
      }
      if (!base64) {
        Alert.alert('Could not read image', 'Please try again with a different photo.');
        return;
      }

      // Determine mime — picker usually returns jpg from camera; fall back safely
      const mimeType = asset.mimeType || (asset.uri?.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');

      // Give the user quick feedback — insert a placeholder "scanning…" bubble
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const scanningMsg = {
        id: `${Date.now()}-receipt-scan`,
        role: 'assistant' as const,
        content: 'Scanning your receipt…',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, scanningMsg]);

      // Build project hint so the model knows which project is active
      let projectHint: any = null;
      try {
        const ctx = typeof context === 'string' ? JSON.parse(context) : (context || {});
        projectHint = {
          projectName: ctx?.currentProject || ctx?.projectName || null,
          projectId: ctx?.projectId || null,
        };
      } catch (_e) { /* ignore */ }

      const token = await getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const AI_API_BASE = resolveAIBaseUrl();
      const API_URL = `${AI_API_BASE}/api/ai-assistant/parse-receipt`;

      const res = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ image: base64, mimeType, projectHint }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.message || `Receipt parse failed (${res.status})`);
      }
      const payload = await res.json();
      const data = payload?.data || {};

      if (!data.success) {
        setMessages((prev) => prev.map((m) => m.id === scanningMsg.id
          ? { ...m, content: `I couldn't read that as a receipt. ${data.reason ? `Reason: ${data.reason}. ` : ''}Try a clearer, well-lit photo of the full receipt.` }
          : m
        ));
        return;
      }

      // Build a short, contractor-friendly summary and then hand the numbers
      // straight to the existing assistant so the standard expense-logging
      // flow confirms + commits. We do NOT auto-commit — the user confirms.
      const amountStr = typeof data.amount === 'number' ? `$${Number(data.amount).toLocaleString()}` : 'an unknown amount';
      const vendorStr = data.vendor || 'Unknown vendor';
      const dateStr = data.date || 'today';
      const categoryStr = data.category || 'Materials/Equipment';
      const topItems = Array.isArray(data.lineItems) && data.lineItems.length > 0
        ? data.lineItems.slice(0, 3).map((li: any) => `• ${li.name || 'Item'}${li.total ? ` — $${Number(li.total).toLocaleString()}` : ''}`).join('\n')
        : '';

      const summary = `📷 Receipt parsed (confidence ${Math.round((data.confidence || 0) * 100)}%):\n\n` +
        `• Vendor: ${vendorStr}\n` +
        `• Total: ${amountStr}\n` +
        `• Date: ${dateStr}\n` +
        `• Category: ${categoryStr}` +
        (topItems ? `\n\nTop items:\n${topItems}` : '') +
        `\n\nWant me to log this as an expense?`;

      setMessages((prev) => prev.map((m) => m.id === scanningMsg.id ? { ...m, content: summary } : m));

      // Pre-fill the input with a ready-to-send expense command. The user can
      // tap send (or edit first) — this keeps the existing add_material_expense
      // / add_labor_expense flow in charge of the actual write.
      const isLabor = String(categoryStr).toLowerCase() === 'labor';
      const commandText = isLabor
        ? `Log a labor expense${data.amount ? ` of $${data.amount}` : ''}${vendorStr && vendorStr !== 'Unknown vendor' ? ` for ${vendorStr}` : ''}${data.date ? ` on ${data.date}` : ''} — from receipt scan.`
        : `Log a ${categoryStr.toLowerCase()} expense${data.amount ? ` of $${data.amount}` : ''}${vendorStr && vendorStr !== 'Unknown vendor' ? ` from ${vendorStr}` : ''}${data.date ? ` on ${data.date}` : ''} — from receipt scan.`;
      setInput(commandText);
    } catch (err: any) {
      console.error('❌ Receipt scan error:', err);
      Alert.alert('Receipt scan failed', err?.message || 'Please try again with a clearer photo.');
    } finally {
      setLoading(false);
    }
  };

  const promptReceiptSource = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Scan Receipt',
      'Snap a receipt photo or pick one from your library. I\'ll parse vendor, amount, date and category and prep an expense for you to confirm.',
      [
        { text: 'Take Photo', onPress: () => captureAndParseReceipt('camera') },
        { text: 'Choose from Library', onPress: () => captureAndParseReceipt('library') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const sendMessage = async (messageOverride?: string) => {
    const messageToSend = messageOverride || input.trim();
    if (!messageToSend || loading) return;
    let urlsToTry: string[] = [];

    // Haptic feedback on send
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Light-up animation
    Animated.sequence([
      Animated.timing(sendButtonScale, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(sendButtonScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Dismiss keyboard
    Keyboard.dismiss();

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setLoading(true);
    setIsTyping(true);

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      // Portfolio-scope detection: compare/risks/profitability across all projects — never use single-project context
      // Include Command Center (AI Assistant Tab) so "Compare Projects" button works without asking "Which project?"
      const isPortfolioScopeMessage =
        (isProjectsScreenContext || isGlobalAssistantContext) &&
        /\b(compare\s+(all\s+)?(my\s+)?(active\s+)?projects?|compare\s+my\s+projects|all\s+(of\s+)?my\s+projects|all\s+active\s+projects|which\s+project\s+is\s+most\s+profitable|identify\s+budget\s+risks|across\s+my\s+projects|across\s+all\s+projects|across\s+my\s+active\s+projects|health\s+check\s+across\s+all|forecast\s+(profit|across)|budget\s+risks|missing\s+receipts|upcoming\s+(deadlines|payments)|payments?\s+or\s+deadlines|deadlines?\s+or\s+payments|what\s+payments?\s+or\s+deadlines|(?:payments?|deadlines?|events?)\s+(?:are\s+)?coming\s+up|what'?s\s+on\s+(?:my\s+)?(?:the\s+)?calendar|calendar\s+events?|on\s+my\s+schedule|where am I losing money|losing money across|profit leak|biggest profit leak|show me the biggest profit leak|(yes\s+)?completed\s+projects?|completed\s+jobs?|review\s+(my\s+)?completed|compare\s+(my\s+)?completed|(which\s+)?(active\s+)?projects?\s+(are\s+)?over\s+budget|show\s+projects?\s+over\s+budget|over\s+budget(\s+and\s+by\s+how\s+much)?|identify\s+budget\s+risks|budget\s+risks)\b/i.test(
          messageToSend
        );

      // Smart URL detection:
      // - Web: use localhost
      // - All mobile (simulator/device): use Mac's LAN IP (most reliable)
      // - You can override with EXPO_PUBLIC_AI_API_URL env variable
      const AI_API_BASE = resolveAIBaseUrl();
      const primaryUrl = `${AI_API_BASE}/api/ai-assistant`;
      
      // Build fallback URLs: only use localhost for simulators/web, not physical devices
      urlsToTry = [primaryUrl];
      const isSimulator = Platform.OS === "ios" && Constants.isDevice === false;
      const isWeb = Platform.OS === "web";
      const isAndroidEmulator = Platform.OS === "android" && Constants.isDevice === false;
      
      // Only add localhost fallback for simulators/web, not physical devices
      if (!primaryUrl.includes('localhost') && !primaryUrl.includes('127.0.0.1') && (isSimulator || isWeb || isAndroidEmulator)) {
        urlsToTry.push('http://localhost:3001/api/ai-assistant');
        console.log('🔄 Will fallback to localhost if primary URL fails (simulator/web detected)');
      }
      // When using local backend, add production as last resort so AI works even if backend is down
      if (primaryUrl.includes('localhost') || primaryUrl.includes('192.168.') || primaryUrl.includes('10.0.2.2')) {
        urlsToTry.push(PRODUCTION_AI_API);
        console.log('🔄 Will fallback to production API if local backend unreachable');
      }

      console.log('🤖 AI Assistant connecting to:', primaryUrl, `(Platform: ${Platform.OS}, isDevice: ${Constants.isDevice})`);

      // Use project context resolver for queries that need project context
      let finalContext = enhancedContext;
      let resolvedProjectId: string | null = null;
      const intent = detectProjectIntent(newMessage.content);
      const messageLower = newMessage.content.toLowerCase();
      
      // Check if this is a follow-up after chip selection (project ID might be in pendingAnalysisType)
      if (pendingAnalysisType && !intent.needsProject) {
        // This is the analysis type selection, use the pending project ID
        resolvedProjectId = pendingAnalysisType.projectId;
      }
      // Resume from project chips: user picked a project — use it and proceed with original query
      if (pendingResolvedProjectIdRef.current) {
        resolvedProjectId = pendingResolvedProjectIdRef.current;
        pendingResolvedProjectIdRef.current = null;
      }
      // Resume from payment chips: user picked a payment — use project ID so we don't re-ask "which project?"
      // Also set flag so we skip analysis-type flow (don't show "quick health check or full breakdown?")
      let isPaymentSelectionResume = false;
      if (pendingPaymentProjectIdRef.current) {
        resolvedProjectId = pendingPaymentProjectIdRef.current;
        pendingPaymentProjectIdRef.current = null;
        isPaymentSelectionResume = true;
      }
      // Resume from PO chips: user picked a PO — use project ID
      if (pendingPOProjectIdRef.current) {
        resolvedProjectId = pendingPOProjectIdRef.current;
        pendingPOProjectIdRef.current = null;
      }
      
      // Skip project resolver for portfolio/compare-all messages — send directly to backend
      if (!isPortfolioScopeMessage && (intent.needsProject || resolvedProjectId)) {
        try {
          const recentProjects: RecentProject[] = [...activeProjects, ...estimates].map(p => {
            const status = ((p.status || '') as string).toLowerCase();
            return {
              id: p.id,
              title: p.title || p.name || 'Untitled Project',
              status: p.status || 'unknown',
              lastOpened: (p as any).lastOpened || (p as any).updatedAt || (p as any).createdAt,
              isActive: ['active', 'won', 'in_progress', 'in-progress', 'submitted', 'bid_submitted'].includes(status),
            };
          });

          // Projects screen behavior: use selected project as strong hint unless user explicitly names another project
          const normalizedMessage = messageLower.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
          const explicitlyMentionedProject = recentProjects.find((p) => {
            const title = (p.title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
            if (!title) return false;
            return normalizedMessage === title ||
              normalizedMessage.startsWith(`${title} `) ||
              normalizedMessage.endsWith(` ${title}`) ||
              normalizedMessage.includes(` ${title} `);
          });
          if (
            !resolvedProjectId &&
            isProjectsScreenContext &&
            selectedProjectHintId &&
            !explicitlyMentionedProject &&
            intent.needsProject &&
            !isPortfolioScopeMessage
          ) {
            resolvedProjectId = selectedProjectHintId;
            console.log('🧭 Using selectedProjectId as active hint on Projects screen', { selectedProjectHintId });
          }

          const uiState: UIState = {
            activeProjectId: parsedContext?.projectId || parsedContext?.activeProjectId,
            selectedProjectId: selectedProjectHintId || parsedContext?.projectId,
            currentScreen: parsedContext?.screen || 'AI Assistant',
            lastOpenedProjectId: lastOpenedProjectId,
          };
          
          // If we already have a resolved project ID from chip selection, use it
          if (!resolvedProjectId) {
            const projectContext = resolveProjectContext(newMessage.content, uiState, recentProjects);
            
            if (projectContext.needsClarification && projectContext.clarificationType === 'project_selection') {
              const opts = projectContext.options || [];
              const optsCount = opts.length;
              const clarificationContent = optsCount >= 2 && optsCount <= 4
                ? `I'm in All Projects right now — which active project should I use? (${opts.map((o) => o.title).join(', ')})`
                : optsCount > 0
                  ? 'Which active project do you want me to check?'
                  : 'Which project do you want me to check?';
              // Show project selection chips
              setPendingProjectSelection({
                query: newMessage.content,
                options: opts,
              });
              // Add a clarification message to the chat
              const clarificationMsg: Message = {
                id: Date.now().toString() + '-clarification',
                role: 'assistant',
                content: clarificationContent,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, clarificationMsg]);
              setLoading(false);
              setIsTyping(false);
              return; // Don't send to AI, wait for user to select project
            } else if (projectContext.projectId) {
              resolvedProjectId = projectContext.projectId;
            }
          }
          
          if (resolvedProjectId) {
            // Store as last opened
            await setLastOpenedProjectId(resolvedProjectId);
            setLastOpenedProjectIdState(resolvedProjectId);
            onSelectedProjectIdChange?.(resolvedProjectId);
            
            // Check if we need to ask about analysis type (only if not already selected)
            // CRITICAL: Detect expense logging requests - must catch "log expense", "log an expense", "can you log", etc.
            const expensePattern = /\b(log|record|add|need to log|can you log)\s+(an?\s+)?expense/i;
            const isExpenseLikeIntent = expensePattern.test(newMessage.content) ||
                                      /\b(expense|expenses|material|materials|labor|labour|spent|bought|purchased)\b/i.test(newMessage.content);
            // CRITICAL: Detect change order requests - must catch "create change order", "create a change order", etc.
            const changeOrderPattern = /\b(create|add|make|i need|i want|give me|start)\s+(me\s+)?(a\s+)?(change\s+order|changeorder)\b/i;
            const isChangeOrderIntent = changeOrderPattern.test(newMessage.content) ||
                                      /\bchange\s+order\b/i.test(newMessage.content) ||
                                      /\bscope\s+change\b/i.test(newMessage.content) ||
                                      /\bclient\s+wants\s+to\s+add\b/i.test(newMessage.content) ||
                                      /\bextra\s+work\b/i.test(newMessage.content);
            // CRITICAL: Assign PM, add team member, update status - these are actions, NOT health check requests
            const isAssignPMIntent = /\b(assign|appoint|set|name|pick|choose|select)\s+(a\s+)?(project\s+manager|pm)\b/i.test(newMessage.content) ||
                                    /\b(project\s+manager|pm)\s+for\s+(me|this)/i.test(newMessage.content) ||
                                    /\b(name|pick|choose)\s+(a\s+)?(project\s+manager|pm)\s+for\s+me/i.test(newMessage.content);
            const isTeamActionIntent = /\b(add|update)\s+(team\s+member|a\s+team\s+member)/i.test(newMessage.content) ||
                                      /\b(turn|make|set|change)\s+.+\s+(active|off\s*duty)/i.test(newMessage.content) ||
                                      /\bteam\s+member.*(off\s*duty|active)/i.test(newMessage.content);
            // CRITICAL: "Am I making enough money?" and margin questions → send to backend for deterministic margin answer; do NOT show "quick health check or full breakdown?"
            const isMakingEnoughOrMargin = /\bmaking\s+enough\b/i.test(newMessage.content) && (/\bmoney\b|\bjob\b|\bproject\b/i.test(newMessage.content) || /\b(am\s+i|are\s+we)\s+making\s+enough/i.test(newMessage.content)) ||
              /\b(what is my|what'?s my|what is the)\s+(profit\s+)?margin\b/i.test(newMessage.content) ||
              /\bam i making\s+enough\b/i.test(newMessage.content);
            // CRITICAL: Scenario requests (worst case, what if, profit scenarios, etc.) → send to backend for scenario analysis; do NOT show "quick health check or full breakdown?"
            const isScenarioRequest = /\b(worst\s*[- ]?case|best\s*[- ]?case|what\s*if|run\s+scenario|scenario\s+analysis)\b/i.test(newMessage.content) ||
              /\b(typical\s*friction|bad\s*remodel|smooth\s*job)\b/i.test(newMessage.content) ||
              /\b(worst|best)\s+case\s+scenario\b/i.test(newMessage.content) ||
              /\bshow\s+me\s+(the\s+)?(worst|best)\s+case\b/i.test(newMessage.content) ||
              /\b(what is my profit scenarios?|what are my profit scenarios?|(show me\s+)(the\s+)?profit scenarios?|profit scenarios?)\b/i.test(newMessage.content) ||
              SCENARIO_SELECTION_ID_PATTERN.test(newMessage.content.trim());
            // CRITICAL: Skip analysis-type flow when resuming from payment card tap — bind to mark_payment_completed, not health check
            // CRITICAL: On Estimate Generator, messages often say "project title / Step 2" — those match project_analysis but are bid workflow, not PM health checks
            if (!isPaymentSelectionResume && !isPortfolioScopeMessage && !pendingAnalysisType && !isExpenseLikeIntent && !isChangeOrderIntent && !isAssignPMIntent && !isTeamActionIntent && !isMakingEnoughOrMargin && !isScenarioRequest && !isEstimateContext && intent.analysisType === 'unspecified' && (intent.type === 'project_analysis' || intent.type === 'project_health')) {
              setPendingAnalysisType({
                query: newMessage.content,
                projectId: resolvedProjectId,
              });
              // Add a message asking about analysis type (single-project only; never for "compare all projects")
              const analysisTypeMsg: Message = {
                id: Date.now().toString() + '-analysis-type',
                role: 'assistant',
                content: 'Do you want a quick health check or full breakdown?',
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, analysisTypeMsg]);
              setLoading(false);
              setIsTyping(false);
              return; // Don't send to AI, wait for user to select analysis type
            }
            
            // Enhance context with resolved project ID
            const contextObj = JSON.parse(finalContext);
            contextObj.resolvedProjectId = resolvedProjectId;
            if (intent.analysisType !== 'unspecified') {
              contextObj.requestedAnalysisType = intent.analysisType;
            }
            // CRITICAL: When resuming from payment card tap, hint backend to bind to mark_payment_completed (not health check)
            if (isPaymentSelectionResume) {
              contextObj.paymentSelectionResume = true;
              contextObj.selectedPaymentName = newMessage.content;
              if (pendingPaymentProjectNameRef.current) {
                contextObj.paymentSelectionProjectName = pendingPaymentProjectNameRef.current;
                pendingPaymentProjectNameRef.current = null;
              }
            }
            // Resume from expense type card tap
            if (pendingExpenseTypeResumeRef.current) {
              contextObj.expenseTypeSelectionResume = true;
              contextObj.selectedExpenseType = pendingExpenseTypeResumeRef.current.type;
              pendingExpenseTypeResumeRef.current = null;
            }
            // Resume from PO card tap
            if (pendingPOResumeRef.current) {
              contextObj.poSelectionResume = true;
              contextObj.selectedPONumber = pendingPOResumeRef.current.poNumber;
              pendingPOResumeRef.current = null;
            }
            // Resume from scenario card tap
            if (pendingScenarioResumeRef.current) {
              contextObj.scenarioSelectionResume = true;
              contextObj.selectedScenario = pendingScenarioResumeRef.current.scenario;
              pendingScenarioResumeRef.current = null;
            }
            finalContext = JSON.stringify(contextObj);
          }
        } catch (e) {
          console.error('Error resolving project context:', e);
          // Continue with original context if resolver fails
        }
      }

      // Always inject selection-card resume context when user tapped a card (expense/PO/scenario)
      // This ensures backend receives hints even when we skipped project resolver (e.g. expense from project detail)
      if (pendingExpenseTypeResumeRef.current || pendingPOResumeRef.current || pendingScenarioResumeRef.current) {
        try {
          const ctx = JSON.parse(finalContext || '{}');
          if (pendingExpenseTypeResumeRef.current) {
            ctx.expenseTypeSelectionResume = true;
            ctx.selectedExpenseType = pendingExpenseTypeResumeRef.current.type;
            pendingExpenseTypeResumeRef.current = null;
          }
          if (pendingPOResumeRef.current) {
            ctx.poSelectionResume = true;
            ctx.selectedPONumber = pendingPOResumeRef.current.poNumber;
            pendingPOResumeRef.current = null;
          }
          if (pendingScenarioResumeRef.current) {
            ctx.scenarioSelectionResume = true;
            ctx.selectedScenario = pendingScenarioResumeRef.current.scenario;
            pendingScenarioResumeRef.current = null;
          }
          finalContext = JSON.stringify(ctx);
        } catch (_e) {
          // Ignore
        }
      }

      // Hydrate with freshest persisted project data before every request
      // so first health-check after reopening reflects latest labor/material/schedule changes.
      try {
        const ctxObj: any = JSON.parse(finalContext || "{}");
        const targetProjectId =
          resolvedProjectId || ctxObj?.resolvedProjectId || ctxObj?.projectId || ctxObj?.activeProjectId || ctxObj?.lastOpenedProjectId || null;
        if (targetProjectId) {
          const storageRaw = await AsyncStorage.getItem(`bps.project.${targetProjectId}`);
          const timelineRaw = await AsyncStorage.getItem(`bps.timeline.v2.${targetProjectId}`);
          const timelineItems = timelineRaw ? JSON.parse(timelineRaw) : [];
          if (storageRaw) {
            const storageProject = JSON.parse(storageRaw);
            const dedupeByKey = (items: any[]) =>
              items.filter((expense: any, index: number, arr: any[]) => {
                const key =
                  expense?.id ||
                  `${expense?.date || ""}-${expense?.vendor || ""}-${expense?.amount || 0}-${expense?.category || ""}`;
                return (
                  index ===
                  arr.findIndex(
                    (e: any) =>
                      (e?.id ||
                        `${e?.date || ""}-${e?.vendor || ""}-${e?.amount || 0}-${e?.category || ""}`) === key
                  )
                );
              });

            const normalizeScheduleStatus = (item: any) => {
              const status = String(item?.status || "").toLowerCase();
              const progress = Number(item?.progressPct ?? item?.progress ?? 0);
              if (
                status.includes("complete") ||
                status.includes("paid") ||
                status.includes("collected") ||
                status.includes("received") ||
                item?.isComplete === true ||
                item?.completed === true ||
                item?.isPaid === true ||
                item?.paid === true ||
                item?.collected === true ||
                progress >= 100
              ) {
                return "completed";
              }
              if (status.includes("progress") || progress > 0) return "in_progress";
              return status || "pending";
            };

            const scoreSchedule = (item: any) => {
              const status = normalizeScheduleStatus(item);
              const progress = Number(item?.progressPct ?? item?.progress ?? 0);
              const completionBoost = status === "completed" ? 1000 : status === "in_progress" ? 500 : 0;
              const dateBoost = item?.completedAt ? 10 : 0;
              return completionBoost + progress + dateBoost;
            };

            const dedupeSchedule = (items: any[]) => {
              const map = new Map<string, any>();
              items.forEach((item: any, index: number) => {
                const key =
                  item?.id ||
                  `${item?.title || item?.name || ""}-${item?.plannedDate || item?.dueDate || item?.date || ""}-${index}`;
                const normalized = {
                  ...item,
                  status: normalizeScheduleStatus(item),
                  progressPct:
                    Number(item?.progressPct ?? item?.progress ?? 0) ||
                    (normalizeScheduleStatus(item) === "completed" ? 100 : 0),
                };
                const existing = map.get(key);
                if (!existing || scoreSchedule(normalized) >= scoreSchedule(existing)) {
                  map.set(key, normalized);
                }
              });
              return Array.from(map.values());
            };

            const mergedExpenses = dedupeByKey([
              ...(Array.isArray(ctxObj?.expenses) ? ctxObj.expenses : []),
              ...(Array.isArray(storageProject?.expenses) ? storageProject.expenses : []),
            ]);
            const mergedMilestones = dedupeSchedule([
              ...(Array.isArray(ctxObj?.milestones) ? ctxObj.milestones : []),
              ...(Array.isArray(storageProject?.milestones) ? storageProject.milestones : []),
              ...(Array.isArray(ctxObj?.weeklyPayments) ? ctxObj.weeklyPayments : []),
              ...(Array.isArray(ctxObj?.paymentMilestones) ? ctxObj.paymentMilestones : []),
              ...(Array.isArray(storageProject?.weeklyPayments) ? storageProject.weeklyPayments : []),
              ...(Array.isArray(storageProject?.paymentMilestones) ? storageProject.paymentMilestones : []),
              ...(Array.isArray(storageProject?.estimateData?.weeklyPayments) ? storageProject.estimateData.weeklyPayments : []),
              ...(Array.isArray(storageProject?.estimateData?.paymentMilestones) ? storageProject.estimateData.paymentMilestones : []),
              ...(Array.isArray(timelineItems) ? timelineItems : []),
            ]);
            const mergedEstimateData = storageProject?.estimateData || ctxObj?.estimateData || null;
            const mergedTotalSpent = mergedExpenses.reduce((sum: number, e: any) => sum + Number(e?.amount || 0), 0);

            const contractVal = storageProject?.budgeted || storageProject?.bidPrice || ctxObj?.contractValue || ctxObj?.bidPrice || ctxObj?.bidTotal || 0;
            const spendToDatePct = contractVal > 0 && mergedTotalSpent >= 0
              ? Math.round(((contractVal - mergedTotalSpent) / contractVal) * 1000) / 10
              : (ctxObj?.spendToDateMarginPct ?? null);
            const progressPct = Number(storageProject?.overallProgressPct ?? storageProject?.progress ?? ctxObj?.progress ?? 0) || 0;
            const committedPOs = Array.isArray(storageProject?.purchaseOrders)
              ? storageProject.purchaseOrders.filter((po: any) => (po?.status || '').toLowerCase() === 'pending').reduce((s: number, po: any) => s + Number(po?.amount || 0), 0)
              : 0;
            const estCostBaseline = getEstimatedCostBaseline({ ...storageProject, ...ctxObj }, mergedEstimateData) || contractVal;
            const pf = contractVal > 0 ? computeProfitForecast({
              contractValue: contractVal,
              adjustedBudget: estCostBaseline || contractVal,
              estimatedCostBaseline: estCostBaseline,
              actualExpenses: mergedTotalSpent,
              committedPOs,
              progressPct,
              isCompleted: progressPct >= 100,
            }) : null;
            const hydratedContext = {
              ...ctxObj,
              projectId: targetProjectId,
              resolvedProjectId: targetProjectId,
              estimateData: mergedEstimateData,
              paymentSchedule: mergedEstimateData?.paymentSchedule ?? storageProject?.paymentSchedule ?? ctxObj?.paymentSchedule,
              expenses: mergedExpenses,
              expensesCount: mergedExpenses.length,
              milestones: mergedMilestones,
              weeklyPayments: mergedMilestones,
              paymentMilestones: mergedMilestones,
              actualCost: mergedTotalSpent,
              totalSpent: mergedTotalSpent,
              contractValue: contractVal > 0 ? contractVal : (ctxObj?.contractValue || ctxObj?.bidTotal || 0),
              spendToDateMarginPct: typeof spendToDatePct === 'number' ? spendToDatePct : (pf?.spendToDateMarginPct ?? ctxObj?.spendToDateMarginPct),
              projectedMarginPct: pf?.projectedMarginPct ?? ctxObj?.projectedMarginPct,
              projectedProfit: pf?.projectedProfit ?? ctxObj?.projectedProfit,
              hasLiveProjectContext: mergedTotalSpent > 0 || ctxObj?.hasLiveProjectContext === true,
              bidPrice: storageProject?.bidPrice || ctxObj?.bidPrice || 0,
              estimatedCost: getEstimatedCostBaseline(
                { ...storageProject, ...ctxObj },
                mergedEstimateData
              ) || storageProject?.estimatedCost || ctxObj?.estimatedCost || 0,
              laborTotal: Number(
                mergedEstimateData?.laborTotal || storageProject?.laborTotal || ctxObj?.laborTotal || 0
              ),
              materialTotal: Number(
                mergedEstimateData?.materialTotal || storageProject?.materialTotal || ctxObj?.materialTotal || 0
              ),
              bidMarginPct: getBidMarginPct(mergedEstimateData, storageProject?.bidPrice || ctxObj?.bidPrice || 0),
              currentMarginPct: getCurrentMarginPct(storageProject?.bidPrice || ctxObj?.bidPrice || 0, mergedTotalSpent),
            };
            finalContext = JSON.stringify(hydratedContext);
          }
        }
      } catch (e) {
        console.warn("Failed to hydrate fresh context from AsyncStorage:", e);
      }

      // Get auth token from Clerk
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        // Sync Clerk token to AsyncStorage for BackendAPI compatibility
        try {
          await syncClerkTokenToAsyncStorage(token);
        } catch (e) {
          console.warn('Could not sync Clerk token to AsyncStorage:', e);
        }
      }
      
      // For portfolio-scope messages, strip single-project context so AI uses allProjects
      let contextToSend = finalContext;
      if (isPortfolioScopeMessage && contextToSend) {
        try {
          const ctx = JSON.parse(contextToSend);
          delete ctx.selectedProjectId;
          delete ctx.resolvedProjectId;
          delete ctx.projectId;
          delete ctx.activeProjectId;
          contextToSend = JSON.stringify(ctx);
        } catch (_e) { /* keep original */ }
      }

      // Enrich context with timeline + Project Calendar events at send time (matches device AsyncStorage)
      if (contextToSend) {
        try {
          const ctx = JSON.parse(contextToSend);
          const allProjects = Array.isArray(ctx?.allProjects) ? ctx.allProjects : [];
          if (allProjects.length > 0) {
            let updated = false;
            for (const p of allProjects) {
              const pid = String(p?.id ?? '').trim();
              if (!pid) continue;
              const hasMilestones = Array.isArray(p?.milestones) && p.milestones.length > 0;
              if (!hasMilestones) {
                const raw = await AsyncStorage.getItem(`bps.timeline.v2.${pid}`);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    p.milestones = parsed;
                    updated = true;
                  }
                }
              }
              try {
                const calRaw = await AsyncStorage.getItem(`calendar_events_${pid}`);
                if (calRaw) {
                  const calParsed = JSON.parse(calRaw);
                  if (Array.isArray(calParsed)) {
                    p.calendarEvents = calParsed;
                    updated = true;
                  }
                }
              } catch (_calErr) { /* ignore */ }
            }
            if (updated) contextToSend = JSON.stringify(ctx);
          }
        } catch (_e) { /* keep context as-is on any error */ }
      }

      if (contextToSend) {
        contextToSend = stampAiContextSnapshot(contextToSend) ?? contextToSend;
      }

      // ── Streaming fast-path (opt-in, auto-fallback) ────────────────────
      // Only used for conversational Q&A. Action messages and any streaming
      // error fall through to the existing POST path so tool calls, selection
      // cards, and action handlers continue to work exactly as before.
      if (STREAMING_ENABLED && isStreamSafeMessage(newMessage.content)) {
        const streamPlaceholderId = `${Date.now()}-stream`;
        const streamPlaceholder: Message = {
          id: streamPlaceholderId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, streamPlaceholder]);
        setIsTyping(false);

        const streamBody = JSON.stringify({
          message: newMessage.content,
          context: contextToSend,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          user_settings: { ai_project_manager_mode: aiManagerEnabled },
          sessionId,
        });

        let streamedReply = '';
        let streamFollowUps: any = null;
        let streamOk = false;
        const streamUrl = (urlsToTry[0] || `${resolveAIBaseUrl()}/api/ai-assistant`).replace(/\/$/, '') + '/stream';

        try {
          await streamSSE({
            url: streamUrl,
            headers,
            body: streamBody,
            timeoutMs: AI_REQUEST_TIMEOUT_MS,
            onEvent: (ev) => {
              if (ev.type === 'token') {
                streamedReply += ev.content;
                setMessages((prev) => prev.map((m) => m.id === streamPlaceholderId ? { ...m, content: streamedReply } : m));
              } else if (ev.type === 'done') {
                streamFollowUps = ev.suggestedFollowUps || null;
                streamOk = true;
              } else if (ev.type === 'error') {
                // Will be turned into a thrown error in the outer catch via resolve.
                streamOk = false;
              }
            },
          });

          if (streamOk && streamedReply.trim().length > 0) {
            // NOTE: /stream does not execute tool calls or selection cards, so
            // we only surface the streamed text. Action flows (expenses, POs,
            // scenarios) are routed to the POST path by isStreamSafeMessage().
            void streamFollowUps;
            setLoading(false);
            // Haptic + scroll to mirror the regular path's UX.
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 80);
            return;
          }

          // Fell through — remove placeholder and fall back to POST path.
          setMessages((prev) => prev.filter((m) => m.id !== streamPlaceholderId));
          setIsTyping(true);
        } catch (streamErr) {
          console.warn('⚠️ Streaming failed, falling back to POST:', streamErr);
          setMessages((prev) => prev.filter((m) => m.id !== streamPlaceholderId));
          setIsTyping(true);
          // fall through to normal POST below
        }
      }

      const response = await fetchWithFallback(
        urlsToTry,
        {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: newMessage.content,
          context: contextToSend,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          user_settings: {
            ai_project_manager_mode: aiManagerEnabled,
          },
          sessionId,
        }),
        },
        AI_REQUEST_TIMEOUT_MS
      );

      const data = await response.json();

      // Check for error response
      if (data.error) {
        let errorMessage = data.message || "Sorry, I couldn't generate a response.";
        
        // Provide helpful message for rate limit errors
        if (data.details && data.details.includes("Rate limit")) {
          errorMessage = "I've hit the API rate limit. Please wait about 20 seconds and try again. To avoid this, you can add a payment method to your OpenAI account for higher limits.";
        } else if (data.details) {
          errorMessage = `${data.message}\n\nDetails: ${data.details}`;
        }
        
        const errorMessageObj: Message = {
          id: Date.now().toString() + "-error",
          role: "assistant",
          content: errorMessage,
          timestamp: new Date(),
        };
        setIsTyping(false);
        setMessages((prev) => [...prev, errorMessageObj]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        
        // Smooth scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
        return;
      }

      // Check if the response mentions a contract PDF or if there's a show_contract action
      const hasContractAction = data.actions?.some((a: any) => a.type === 'show_contract');
      
      const hasPaymentSelectionOptions = Array.isArray(data.paymentSelectionOptions) && data.paymentSelectionOptions.length > 0;
      const hasExpenseTypeSelectionOptions = Array.isArray(data.expenseTypeSelectionOptions) && data.expenseTypeSelectionOptions.length > 0;
      const hasPOSelectionOptions = Array.isArray(data.poSelectionOptions) && data.poSelectionOptions.length > 0;
      const hasScenarioSelectionOptions = Array.isArray(data.scenarioSelectionOptions) && data.scenarioSelectionOptions.length > 0;
      const hasSelectionCards = hasPaymentSelectionOptions || hasExpenseTypeSelectionOptions || hasPOSelectionOptions || hasScenarioSelectionOptions;
      const selectionType = hasPaymentSelectionOptions ? 'payment' : hasExpenseTypeSelectionOptions ? 'expense_type' : hasPOSelectionOptions ? 'po' : hasScenarioSelectionOptions ? 'scenario' : null;
      const assistantMessage: Message = {
        id: hasSelectionCards ? Date.now().toString() + "-ai-selection-clarification" : Date.now().toString() + "-ai",
        role: "assistant",
        content: data.reply ?? "Sorry, I couldn't generate a response.",
        timestamp: new Date(),
        // Attach server-computed analysis card if present
        ...(data.analysisCard ? { analysisCard: data.analysisCard } : {}),
        ...(selectionType ? { selectionType } : {}),
      };
      if (hasPaymentSelectionOptions) {
        setPendingPaymentSelection({
          options: data.paymentSelectionOptions,
          projectId: data.paymentSelectionProjectId,
          projectName: data.paymentSelectionProjectName,
        });
      } else {
        setPendingPaymentSelection(null);
      }
      if (hasExpenseTypeSelectionOptions) {
        setPendingExpenseTypeSelection({ options: data.expenseTypeSelectionOptions });
      } else {
        setPendingExpenseTypeSelection(null);
      }
      if (hasPOSelectionOptions) {
        setPendingPOSelection({
          options: data.poSelectionOptions,
          projectId: data.poSelectionProjectId,
          projectName: data.poSelectionProjectName,
        });
      } else {
        setPendingPOSelection(null);
      }
      if (hasScenarioSelectionOptions) {
        setPendingScenarioSelection({ options: data.scenarioSelectionOptions });
      } else {
        setPendingScenarioSelection(null);
      }
      
      // Debug: Log if analysisCard was received
      if (data.analysisCard) {
        console.log('📊 Frontend: Received analysisCard from backend:', {
          hasMaterial: data.analysisCard.budgetAndCosting?.materialBudget > 0,
          hasLabor: data.analysisCard.budgetAndCosting?.laborBudget > 0,
          materialBudget: data.analysisCard.budgetAndCosting?.materialBudget,
          laborBudget: data.analysisCard.budgetAndCosting?.laborBudget,
          laborSpent: data.analysisCard.budgetAndCosting?.laborSpent,
        });
      } else {
        console.log('⚠️ Frontend: No analysisCard in response');
      }

      // Sync project data if expense was added (check for projectUpdate in tool results)
      console.log('🔍 AIAssistantModal: Checking for projectUpdate', {
        hasProjectUpdate: !!data.projectUpdate,
        projectUpdate: data.projectUpdate,
        reply: data.reply?.substring(0, 100)
      });
      
      if (data.projectUpdate || (data.reply && data.reply.includes('added') && data.reply.includes('$'))) {
        try {
          // Check if response contains project update data from function calls
          // The AI assistant returns projectUpdate in the function result
          if (data.projectUpdate) {
            const { projectId, totalSpent, actualCost, remaining, expenses, expensesCount, purchaseOrders, committedPOs } = data.projectUpdate;
            
            console.log('📥 AIAssistantModal: Received projectUpdate', {
              projectId,
              expensesCount: expenses?.length || 0,
              purchaseOrdersCount: purchaseOrders?.length || 0,
              committedPOs,
              totalSpent,
              expenseIds: expenses?.map((e: any) => e.id) || [],
              poIds: purchaseOrders?.map((po: any) => po.id) || []
            });
            
            // Get current project to merge updates
            const currentProject = getProjectById(projectId);
            console.log('🔍 AIAssistantModal: Current project lookup', {
              projectId,
              found: !!currentProject,
              currentExpensesCount: currentProject?.projectData?.expenses?.length || currentProject?.expenses?.length || 0,
              currentPOsCount: currentProject?.projectData?.purchaseOrders?.length || 0
            });
            
            if (currentProject) {
              // Merge expenses array - combine existing with new expenses
              const existingExpenses = currentProject.projectData?.expenses || currentProject.expenses || [];
              const newExpenses = expenses || [];
              
              // Create a map to avoid duplicates (by ID)
              const expenseMap = new Map();
              existingExpenses.forEach((e: any) => {
                if (e.id) expenseMap.set(e.id, e);
              });
              newExpenses.forEach((e: any) => {
                if (e.id) expenseMap.set(e.id, e);
              });
              const mergedExpenses = Array.from(expenseMap.values());
              
              // Merge purchase orders array - combine existing with new purchase orders
              const existingPOs = currentProject.projectData?.purchaseOrders || [];
              const incomingPOs = purchaseOrders || [];
              
              console.log('📦 AIAssistantModal: Merging purchase orders', {
                existingPOsCount: existingPOs.length,
                incomingPOsCount: incomingPOs.length,
                existingPOIds: existingPOs.map((po: any) => ({ id: po.id, poNumber: po.poNumber })),
                incomingPOIds: incomingPOs.map((po: any) => ({ id: po.id, poNumber: po.poNumber }))
              });
              
              // Create a map to avoid duplicates (by ID or poNumber)
              const poMap = new Map();
              existingPOs.forEach((po: any) => {
                if (po.id) poMap.set(po.id, po);
                else if (po.poNumber) poMap.set(po.poNumber, po);
              });
              
              // Find which POs are actually new (not in existing)
              const newPOs: any[] = [];
              incomingPOs.forEach((po: any) => {
                const existsById = po.id && poMap.has(po.id);
                const existsByNumber = po.poNumber && poMap.has(po.poNumber);
                
                if (!existsById && !existsByNumber) {
                  newPOs.push(po);
                  console.log('📦 Found NEW purchase order:', { id: po.id, poNumber: po.poNumber, amount: po.amount });
                } else {
                  console.log('📦 Purchase order already exists:', { id: po.id, poNumber: po.poNumber, existsById, existsByNumber });
                }
                
                // Add to map (update if exists)
                if (po.id) poMap.set(po.id, po);
                else if (po.poNumber) poMap.set(po.poNumber, po);
              });
              
              const mergedPOs = Array.from(poMap.values());
              
              console.log('📦 AIAssistantModal: After merge', {
                mergedPOsCount: mergedPOs.length,
                newPOsCount: newPOs.length,
                newPOs: newPOs.map((po: any) => ({ id: po.id, poNumber: po.poNumber, amount: po.amount }))
              });
              
              // Calculate committed POs from merged list
              const calculatedCommittedPOs = mergedPOs
                .filter((po: any) => po.status === 'Pending')
                .reduce((sum: number, po: any) => sum + (Number(po.amount) || 0), 0);
              
              // Update project with new expense and PO data - this syncs to all pages
              updateProject(projectId, {
                actualCost: actualCost || totalSpent || 0,
                totalSpent: totalSpent || 0,
                expenses: mergedExpenses, // Update at project level
                projectData: {
                  ...currentProject.projectData,
                  actualCost: actualCost || totalSpent || 0,
                  spent: totalSpent || 0,
                  expenses: mergedExpenses, // Update in projectData too
                  purchaseOrders: mergedPOs, // Update purchase orders
                  committedPOs: committedPOs !== undefined ? committedPOs : calculatedCommittedPOs, // Update committed POs
                },
              });
              if (parsedContext?.screen === 'Projects' && onProjectUpdated) {
                onProjectUpdated(projectId, {
                  actualCost: actualCost || totalSpent || 0,
                  expenses: mergedExpenses,
                  projectData: {
                    ...currentProject.projectData,
                    actualCost: actualCost || totalSpent || 0,
                    spent: totalSpent || 0,
                    expenses: mergedExpenses,
                    purchaseOrders: mergedPOs,
                    committedPOs: committedPOs !== undefined ? committedPOs : calculatedCommittedPOs,
                  },
                });
              }
              
              console.log('✅ Synced project data after update:', {
                projectId,
                totalSpent,
                expensesCount,
                mergedExpensesCount: mergedExpenses.length,
                purchaseOrdersCount: mergedPOs.length,
                committedPOs: committedPOs !== undefined ? committedPOs : calculatedCommittedPOs,
              });
              
              // Trigger refresh callback if provided (for project detail page)
              // This will trigger ProjectDataContext to reload from ProjectListContext
              if (onAction) {
                onAction({ 
                  type: 'project_updated', 
                  projectId,
                  expenses: mergedExpenses,
                  purchaseOrders: mergedPOs,
                  committedPOs: committedPOs !== undefined ? committedPOs : calculatedCommittedPOs,
                  totalSpent: actualCost || totalSpent || 0
                });
              }
              
              // CRITICAL: Always call addPurchaseOrder for ALL incoming POs from projectUpdate
              // This ensures immediate local state update in ProjectDataContext, just like materials/labor expenses
              // We check incomingPOs (from backend) not mergedPOs (already merged into ProjectListContext)
              // This way, even if the PO was just merged into ProjectListContext, we still trigger the action
              if (incomingPOs && incomingPOs.length > 0 && onAction) {
                console.log('📦 AIAssistantModal: Calling addPurchaseOrder for ALL incoming POs from projectUpdate', {
                  incomingPOsCount: incomingPOs.length,
                  incomingPOs: incomingPOs.map((po: any) => ({ 
                    id: po.id,
                    poNumber: po.poNumber, 
                    amount: po.amount, 
                    vendor: po.vendor,
                    status: po.status,
                    category: po.category
                  })),
                  hasOnAction: !!onAction,
                  projectId
                });
                // Call the action handler for each incoming PO to ensure local state is updated immediately
                // The action handler will handle duplicates correctly
                incomingPOs.forEach((incomingPO: any) => {
                  console.log('📦 AIAssistantModal: Sending add_purchase_order action for PO:', {
                    poNumber: incomingPO.poNumber,
                    amount: incomingPO.amount,
                    vendor: incomingPO.vendor,
                    category: incomingPO.category
                  });
                  onAction({
                    type: 'add_purchase_order',
                    projectId: projectId,
                    amount: incomingPO.amount,
                    vendor: incomingPO.vendor,
                    category: incomingPO.category || 'Materials/Equipment',
                    description: incomingPO.description || `${incomingPO.category || 'Material'} from ${incomingPO.vendor}`,
                    poNumber: incomingPO.poNumber,
                    expectedDelivery: incomingPO.expectedDelivery || null,
                  });
                });
                console.log('✅ AIAssistantModal: Sent all add_purchase_order actions for incoming POs');
              } else {
                console.warn('⚠️ AIAssistantModal: Not calling addPurchaseOrder - incomingPOs:', incomingPOs?.length || 0, 'hasOnAction:', !!onAction);
                
                // FALLBACK: If we have purchase orders in projectUpdate but no incomingPOs,
                // trigger the project_updated action to sync
                if (mergedPOs.length > 0 && onAction) {
                  console.log('📦 FALLBACK: Triggering project_updated action to sync purchase orders', {
                    mergedPOsCount: mergedPOs.length
                  });
                  onAction({
                    type: 'project_updated',
                    projectId,
                    purchaseOrders: mergedPOs,
                    committedPOs: committedPOs !== undefined ? committedPOs : calculatedCommittedPOs,
                    totalSpent: actualCost || totalSpent || 0
                  });
                }
              }
              
              // Also trigger a small delay to allow ProjectDataContext to sync
              // The project detail page should reload ProjectDataContext when it receives the update
              setTimeout(() => {
                // Force a re-render by triggering the onAction again if needed
                console.log('🔄 Triggering project data refresh for Materials & Equipment page');
              }, 100);
            } else if (parsedContext?.screen === 'Projects' && onProjectUpdated) {
              onProjectUpdated(projectId, data.projectUpdate);
            }
          }
        } catch (error) {
          console.error('Error syncing project data:', error);
        }
      }

      // Cache health check responses
      const isHealthCheck = newMessage.content.toLowerCase().includes('health check') || 
                           newMessage.content.toLowerCase().includes('project health');
      if (isHealthCheck && assistantMessage.content && context) {
        try {
          const parsed = JSON.parse(context);
          const projectHash = computeProjectHash(parsed);
          setCachedHealthSummary(projectHash, assistantMessage.content);
        } catch (e) {
          // Ignore caching errors
        }
      }

      setIsTyping(false);
      setMessages((prev) => [...prev, assistantMessage]);

      // Update smart suggestions from response
      if (data.suggestedFollowUps && Array.isArray(data.suggestedFollowUps) && data.suggestedFollowUps.length > 0) {
        setChatSuggestions(data.suggestedFollowUps);
      } else {
        setChatSuggestions([]);
      }
      
      // Smooth scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      // Handle AI actions if any - but first show confirmation
      if (data.actions && Array.isArray(data.actions) && onAction) {
        console.log('🔍 AIAssistantModal: Received actions from backend:', {
          actionsCount: data.actions.length,
          actions: data.actions.map((a: any) => ({ type: a.type, projectId: a.projectId, amount: a.amount, vendor: a.vendor }))
        });
        
        // Deduplicate actions by creating a unique key for each action
        const seenActions = new Set<string>();
        const uniqueActions: any[] = [];
        
        data.actions.forEach((action: any) => {
          // Create a unique key based on action type and key parameters
          const actionKey =
            action.type === 'update_customer_info'
              ? `${action.type}-${action.customerName || ''}-${action.phone || ''}-${action.address || ''}-${action.zip || ''}`
              : action.type === 'update_project_info'
                ? `${action.type}-${action.title || ''}-${action.projectType || ''}-${action.scopeDescription || ''}-${action.sqft ?? ''}`
                : `${action.type}-${action.projectName || action.projectId || ''}-${action.itemDescription || action.newDescription || ''}-${action.newAmount || action.amount || ''}`;
          if (!seenActions.has(actionKey)) {
            seenActions.add(actionKey);
            uniqueActions.push(action);
            console.log('✅ AIAssistantModal: Added unique action:', { type: action.type, key: actionKey });
          } else {
            console.log('⚠️ AIAssistantModal: Skipped duplicate action:', { type: action.type, key: actionKey });
          }
        });
        
        console.log('📋 AIAssistantModal: Processing unique actions:', {
          uniqueCount: uniqueActions.length,
          uniqueActions: uniqueActions.map((a: any) => ({ type: a.type, projectId: a.projectId }))
        });

        const confirmOrder: Record<string, number> = {
          update_customer_info: 0,
          update_project_info: 1,
          add_estimate_line_items: 2,
          apply_estimate_pricing_fields: 2,
          set_markup_percentage: 3,
          replace_payment_schedule: 4,
          rebalance_payment_schedule: 5,
          add_starter_materials: 6,
          add_starter_labor: 7,
          add_common_scope_package: 8,
          create_estimate_variant: 9,
          create_change_order: 10,
        };
        uniqueActions.sort(
          (a: any, b: any) => (confirmOrder[a.type] ?? 50) - (confirmOrder[b.type] ?? 50)
        );

        const runConfirmedAction = async (action: any) => {
          if (action.type === 'create_calendar_event' && action.projectId && action.event) {
            try {
              const key = `calendar_events_${action.projectId}`;
              const existing = await AsyncStorage.getItem(key);
              const arr = existing ? JSON.parse(existing) : [];
              const validTypes = ['inspection', 'delivery', 'work', 'payment', 'deadline', 'other'] as const;
              const rawType = action.event.type;
              const evtType = rawType && validTypes.includes(rawType as any) ? rawType : 'work';
              const t = action.event.time && String(action.event.time).trim();
              const now = new Date().toISOString();
              const newEvent = {
                id: `event-${Date.now()}`,
                title: String(action.event.title || 'Event').slice(0, 200),
                date: String(action.event.date),
                type: evtType,
                time: t ? String(t) : undefined,
                notes: action.event.notes ? String(action.event.notes) : undefined,
                completed: false,
                createdAt: now,
                updatedAt: now,
              };
              await AsyncStorage.setItem(key, JSON.stringify([...arr, newEvent]));
              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now().toString() + '-cal-saved',
                  role: 'assistant',
                  content: `✅ Saved **${newEvent.title}** to **Project Calendar** (${action.projectName || 'project'}). Open the project → **Calendar** tab to edit or add more.`,
                  timestamp: new Date(),
                },
              ]);
              if (onAction) {
                await onAction({ type: 'calendar_event_created', projectId: action.projectId, projectName: action.projectName, event: newEvent });
              }
            } catch (e) {
              console.warn('Calendar save failed', e);
              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now().toString() + '-cal-err',
                  role: 'assistant',
                  content: 'Could not save the calendar event. Try again from **Project → Calendar**.',
                  timestamp: new Date(),
                },
              ]);
            }
            return;
          }
          if (onAction) {
            console.log('📤 AIAssistantModal: Calling onAction handler...');
            const result = await onAction(action);
            console.log('📥 AIAssistantModal: onAction handler returned:', result);
            // Avoid a second nearly-identical bubble: the main reply already previews line items ("would become");
            // after Confirm, applying state is enough without repeating the same bullets.
            const skipEchoDuplicate =
              action.type === 'add_estimate_line_items' && Boolean(result?.message);
            if (result?.message && !skipEchoDuplicate) {
              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now().toString() + '-action-result',
                  role: 'assistant',
                  content: result.message,
                  timestamp: new Date(),
                },
              ]);
            }
            if (Array.isArray(result?.suggestedFollowUps)) {
              const nextSuggestions = result.undoable
                ? [
                    { label: 'Undo last AI change', prompt: 'Undo last AI change' },
                    ...result.suggestedFollowUps,
                  ]
                : result.suggestedFollowUps;
              const deduped = nextSuggestions.filter((item: any, index: number, arr: any[]) =>
                index === arr.findIndex((other: any) => other?.label === item?.label && other?.prompt === item?.prompt)
              );
              setChatSuggestions(deduped.slice(0, 5));
            }
            if (action.type === 'show_contract' && result?.pdfUri) {
              setMessages((prev) => {
                const updated = [...prev];
                const lastMessage = updated[updated.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                  lastMessage.pdfUri = result.pdfUri;
                  lastMessage.attachment = {
                    type: 'pdf',
                    uri: result.pdfUri,
                    name: `${result.projectName || 'Contract'} - Estimate.pdf`,
                  };
                }
                return updated;
              });
            }
          }
        };

        const showSequentialConfirm = (index: number) => {
          if (index >= uniqueActions.length) return;
          const action = uniqueActions[index];
          const actionDescription = getActionDescription(action);
          console.log('🔍 AIAssistantModal: Action description:', {
            type: action.type,
            hasDescription: !!actionDescription,
            description: actionDescription,
          });

          if (!actionDescription) {
            (async () => {
              await runConfirmedAction(action);
              showSequentialConfirm(index + 1);
            })();
            return;
          }

          const isChangeOrder = action.type === 'create_change_order';
          const isEstimateEdit = ['add_estimate_line_items', 'apply_estimate_pricing_fields', 'update_customer_info', 'update_project_info', 'set_markup_percentage', 'replace_payment_schedule', 'rebalance_payment_schedule', 'add_starter_materials', 'add_starter_labor', 'add_common_scope_package', 'create_estimate_variant'].includes(action.type);
          const alertTitle = isChangeOrder ? 'Approve Change Order?' : isEstimateEdit ? 'Confirm Estimate Update' : 'Confirm AI Action';
          const confirmText = isChangeOrder ? 'Approve' : 'Confirm';
          const cancelText = isChangeOrder ? 'Not Now' : 'Cancel';
          const delayMs = index === 0 ? 450 : 0;

          setTimeout(() => {
            Alert.alert(
              alertTitle,
              actionDescription,
              [
                {
                  text: cancelText,
                  style: 'cancel',
                  onPress: () => {
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: Date.now().toString() + '-cancelled',
                        role: 'assistant',
                        content: isChangeOrder ? 'Change order not approved.' : 'Action cancelled.',
                      },
                    ]);
                  },
                },
                {
                  text: confirmText,
                  style: 'default',
                  onPress: async () => {
                    console.log('✅ AIAssistantModal: User confirmed action:', {
                      type: action.type,
                      action: action,
                    });
                    await runConfirmedAction(action);
                    showSequentialConfirm(index + 1);
                  },
                },
              ]
            );
          }, delayMs);
        };

        showSequentialConfirm(0);
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      console.warn("AI request failed", error);
      let errorMessage = "I ran into a connection issue talking to the AI.";
      
      // Provide more specific error messages
      if (error?.name === 'AbortError' || error?.message?.includes("aborted") || error?.message?.includes("timeout")) {
        errorMessage = "The request timed out. This usually means:\n\n1. Network connection to the backend is unstable\n2. The AI provider response is slow\n3. Backend is down\n\nCheck backend health at: http://localhost:3001/health";
      } else if (error?.message?.includes("Network request failed") || error?.message?.includes("Failed to fetch")) {
        const triedProduction = urlsToTry.some((u) => u.includes('render.com'));
        errorMessage = triedProduction
          ? `Couldn't reach the AI (tried local and production). Check your internet connection, or start the local backend:\n\ncd backend && npm start`
          : `I can't connect to the AI backend at ${resolveAIBaseUrl()}.\n\n1. Start backend: cd backend && npm start\n2. Same network (physical devices)\n3. Check: http://localhost:3001/health`;
      } else if (error?.message?.includes("Can't reach OpenAI") || error?.message?.includes("internet connection") || error?.message?.includes("api.openai.com")) {
        errorMessage = error.message;
      } else if (error?.message) {
        errorMessage = `Connection error: ${error.message}\n\nIf this persists, check:\n1. Backend is running: cd backend && npm start\n2. Backend health: http://localhost:3001/health`;
      }
      
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "-error",
          role: "assistant",
          content: errorMessage,
        },
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  };

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  useEffect(() => {
    if (!visible) {
      initialQuestionSentRef.current = false;
      return;
    }
    if (!initialQuestion || messages.length > 0 || loading || initialQuestionSentRef.current) return;
    const trimmed = initialQuestion.trim();
    if (!trimmed) return;

    initialQuestionSentRef.current = true;
    const timer = setTimeout(() => {
      sendMessageRef.current?.(trimmed);
    }, 500);
    return () => clearTimeout(timer);
  }, [visible, initialQuestion, messages.length, loading]);

  const handleQuickAction = async (labelOrPrompt: string) => {
    if (labelOrPrompt === "Find Subcontractors") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowContractorModal(true);
      return;
    }

    if (isEstimateContext && /^undo last ai change$/i.test(labelOrPrompt.trim())) {
      if (onAction) {
        const result = await onAction({ type: 'undo_last_estimate_ai_action' });
        if (result?.message) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString() + '-undo-result',
              role: 'assistant',
              content: result.message,
              timestamp: new Date(),
            },
          ]);
        }
        if (Array.isArray(result?.suggestedFollowUps)) {
          setChatSuggestions(result.suggestedFollowUps.slice(0, 5));
        }
      }
      return;
    }

    // Block compare/portfolio actions until timeline data is loaded (avoids stale progress)
    const isCompareOrPortfolio = /\b(compare|all my projects|profitability|risk|forecast|budget risks|missing receipts|deadlines|portfolio)\b/i.test(labelOrPrompt);
    if (isCompareOrPortfolio && !isContextReady) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return; // Chips are disabled visually; user sees "Syncing project data…" placeholder
    }

    // Determine the actual message to send
    let messageToSend = labelOrPrompt;

    // If it's not already a full prompt, use suggestion mapping.
    const looksLikeSentencePrompt = /^(i\s+need|please|create|add|mark|show|scan|forecast|can\s+you|compare|what|which|identify|review)\b/i.test(labelOrPrompt.trim());
    if (!labelOrPrompt.includes("?") && !labelOrPrompt.includes(".") && !looksLikeSentencePrompt) {
      const suggestions: { [key: string]: string } = {
        "Add Material": "Can you add material to this estimate?",
        "Add Labor": "Can you add labor to this estimate?",
        "Set Payment Schedule": "Can you set up a payment schedule for this project?",
        "Show Bid Summary": "Can you show me a summary of this bid?",
        "Check Profit": "Can you calculate the projected profit for this project?",
        "Check project health": "Give me a project health check.",
        "Scan for missing costs": "Scan this estimate for missing costs.",
        "Forecast final profit": "Forecast the final cost and profit for this project.",
        "Create me a change order": "Create me a change order",
      };
      messageToSend = suggestions[labelOrPrompt] || `Can you ${labelOrPrompt.toLowerCase()} for this project?`;
    }

    // ROOT CAUSE FIX: Missing Costs uses dedicated endpoint — bypasses router/CO flow entirely
    const isMissingCostsAction = /scan.*missing\s*cost|missing\s*cost/i.test(messageToSend);
    if (isMissingCostsAction && !loading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const userMsg: Message = { id: Date.now().toString(), role: "user", content: messageToSend.trim(), timestamp: new Date() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      setIsTyping(true);
      try {
        const AI_API_BASE = resolveAIBaseUrl();
        const url = `${AI_API_BASE}/api/ai-assistant/scan-missing-costs`;
        const token = await getToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const ctx =
          stampAiContextSnapshot(
            typeof enhancedContext === "string" ? enhancedContext : JSON.stringify(enhancedContext || {})
          ) ?? (typeof enhancedContext === "string" ? enhancedContext : JSON.stringify(enhancedContext || {}));
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ context: ctx }),
        });
        const data = await res.json();
        const reply = data.reply || data.message || "Scan completed.";
        const aiMsg: Message = { id: Date.now().toString(), role: "assistant", content: reply, timestamp: new Date() };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (err: any) {
        const errMsg: Message = {
          id: Date.now().toString() + "-err",
          role: "assistant",
          content: err?.message || "Could not run missing cost scan. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
        setIsTyping(false);
      }
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      return;
    }

    // All other actions: use sendMessage
    if (messageToSend.trim() && !loading) {
      sendMessage(messageToSend.trim());
    }
  };

  const handleSubcontractorSelect = async (subcontractor: any) => {
    // When a subcontractor is selected, optionally trigger AI to add them
    // Or just show a helpful message
    const message: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: `I found ${subcontractor.name} (${subcontractor.trade}). Would you like me to add them to your estimate? You can also ask me to add them with a specific rate or hours.`,
    };
    setMessages((prev) => [...prev, message]);
    setShowContractorModal(false);
    
    // Auto-scroll to show the message
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    // Optionally prefill input with a suggestion
    setInput(`Add ${subcontractor.name} for ${subcontractor.trade} at $${subcontractor.rate || 'rate'}/hour`);
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const renderInlineMarkdown = (text: string, keyPrefix: string, baseStyle: any) => {
    const parts = text.split(/(\*\*[^*]+\*\*|_[^_\n]+_)/g).filter(Boolean);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Text key={`${keyPrefix}-bold-${index}`} style={[baseStyle, styles.messageBold, light({ color: ThemeColors.text })]}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      if (part.startsWith('_') && part.endsWith('_')) {
        return (
          <Text key={`${keyPrefix}-italic-${index}`} style={[baseStyle, styles.messageItalic, light({ color: ThemeColors.sub }), darkModeChatMutedWhite]}>
            {part.slice(1, -1)}
          </Text>
        );
      }
      return (
        <Text key={`${keyPrefix}-text-${index}`} style={baseStyle}>
          {part}
        </Text>
      );
    });
  };

  const stripLineMarkdownWrappers = (line: string) => {
    let cleaned = line.replace(/\r/g, '').trim();
    if (/^_.*_$/.test(cleaned)) cleaned = cleaned.replace(/^_+/, '').replace(/_+$/, '').trim();
    return cleaned;
  };

  const looksLikeSectionHeader = (line: string) => {
    if (!line) return false;
    if (line.length > 42) return false;
    if (/[.?!]/.test(line)) return false;
    if (/^(here'?s|your|i'll|i can|no |payments? are|numbers reflect)/i.test(line)) return false;
    if (!/^[A-Za-z0-9&/()' -]+$/.test(line)) return false;
    const lettersOnly = line.replace(/[^A-Za-z]/g, '');
    if (!lettersOnly) return false;
    return lettersOnly === lettersOnly.toUpperCase();
  };

  const looksLikeSectionBanner = (line: string) => {
    if (!line.endsWith(':')) return false;
    if (line.length > 72) return false;
    return !/^here'?s\s/i.test(line);
  };

  const splitMetricText = (text: string) => {
    const match = text.match(/^([^:]{2,40}):\s+(.+)$/);
    if (!match) return null;
    return { label: match[1].trim(), value: match[2].trim() };
  };

  const renderMetricInline = (
    label: string,
    value: string,
    keyPrefix: string,
    valueStyle: any,
  ) => (
    <>
      <Text style={[styles.messageMetricLabel, light({ color: ThemeColors.text })]}>{label}: </Text>
      {renderInlineMarkdown(value, `${keyPrefix}-value`, [valueStyle, light({ color: ThemeColors.sub }), darkModeChatMutedWhite])}
    </>
  );

  const isMetadataLine = (line: string, rawLine: string) => {
    if (!line) return false;
    if (/^_.*_$/.test(rawLine.trim())) return true;
    return /^(?:types:|payment milestones are managed|payments are managed in|numbers reflect your project data|add events in|updated\b|created from\b|completed jobs are excluded\b|pull to refresh\b)/i.test(line);
  };

  // Structured renderer for all AI text cards: headings, bullets, callouts, and muted metadata.
  const renderFormattedText = (text: string) => {
    const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
    const lines = normalized.split('\n');
    const elements: any[] = [];
    const metadataBuffer: string[] = [];

    const flushMetadata = (keyBase: string) => {
      if (!metadataBuffer.length) return;
      const grouped = [...metadataBuffer];
      metadataBuffer.length = 0;
      elements.push(
        <View key={`${keyBase}-meta`} style={[styles.messageMetaBlock, light({ borderTopColor: ThemeColors.line })]}>
          {grouped.map((metaLine, index) => (
            <Text key={`${keyBase}-meta-${index}`} style={[styles.messageMetaText, light({ color: ThemeColors.sub }), darkModeChatMutedWhite]}>
              {renderInlineMarkdown(metaLine, `${keyBase}-meta-inline-${index}`, [styles.messageMetaText, light({ color: ThemeColors.sub }), darkModeChatMutedWhite])}
            </Text>
          ))}
        </View>
      );
    };

    lines.forEach((rawLine, index) => {
      const trimmedLine = rawLine.trim();
      const cleanedLine = stripLineMarkdownWrappers(rawLine);

      const disclaimerMatch = cleanedLine.match(/\[DISCLAIMER\](.+?)\[\/DISCLAIMER\]/);
      if (disclaimerMatch) {
        flushMetadata(`line-${index}`);
        elements.push(
          <View key={`disclaimer-wrap-${index}`} style={[styles.messageMetaBlock, light({ borderTopColor: ThemeColors.line })]}>
            <Text key={`disclaimer-${index}`} style={[styles.messageMetaText, light({ color: ThemeColors.sub }), darkModeChatMutedWhite]}>
              {disclaimerMatch[1].trim()}
            </Text>
          </View>
        );
        return;
      }

      if (!trimmedLine) {
        flushMetadata(`line-${index}`);
        if (elements.length > 0) {
          elements.push(<View key={`spacer-${index}`} style={styles.messageSpacer} />);
        }
        return;
      }

      if (isMetadataLine(cleanedLine, rawLine)) {
        metadataBuffer.push(cleanedLine);
        return;
      }

      flushMetadata(`line-${index}`);

      if (/^#{2,3}\s+/.test(trimmedLine)) {
        elements.push(
          <Text key={`heading-${index}`} style={[styles.messageHeading, light({ color: ThemeColors.text })]}>
            {trimmedLine.replace(/^#{2,3}\s*/, '')}
          </Text>
        );
        return;
      }

      if (looksLikeSectionBanner(cleanedLine)) {
        elements.push(
          <View key={`banner-${index}`} style={[styles.messageSectionBanner, light({ backgroundColor: "rgba(22,163,74,0.08)", borderColor: ThemeColors.line })]}>
            <Text style={[styles.messageSectionBannerText, light({ color: ThemeColors.text })]}>
              {cleanedLine.replace(/:$/, '')}
            </Text>
          </View>
        );
        return;
      }

      if (looksLikeSectionHeader(cleanedLine)) {
        const humanized = cleanedLine
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase());
        elements.push(
          <View key={`section-${index}`} style={styles.messageSectionHeaderWrap}>
            <Text style={[styles.messageSectionHeader, light({ color: ThemeColors.text })]}>{humanized}</Text>
          </View>
        );
        return;
      }

      const warningMatch = cleanedLine.match(/^(⚠️|➡️)\s*(.+)$/);
      if (warningMatch) {
        elements.push(
          <View key={`callout-${index}`} style={[styles.messageCallout, light({ backgroundColor: "rgba(0,0,0,0.04)", borderColor: ThemeColors.line })]}>
            <Text style={[styles.messageCalloutIcon, light({ color: "#16a34a" })]}>{warningMatch[1]}</Text>
            <Text style={[styles.messageCalloutText, light({ color: ThemeColors.text })]}>
              {renderInlineMarkdown(warningMatch[2], `callout-${index}`, [styles.messageCalloutText, light({ color: ThemeColors.text })])}
            </Text>
          </View>
        );
        return;
      }

      const bulletMatch = cleanedLine.match(/^(?:[-*•])\s+(.+)$/);
      if (bulletMatch) {
        const metric = splitMetricText(bulletMatch[1]);
        elements.push(
          <View key={`bullet-${index}`} style={[styles.messageBulletRow, metric && styles.messageMetricRow]}>
            <Text style={[styles.messageBullet, light({ color: "#16a34a" })]}>•</Text>
            <Text style={[styles.messageListItem, light({ color: ThemeColors.text })]}>
              {metric
                ? renderMetricInline(metric.label, metric.value, `bullet-${index}`, [styles.messageMetricValue, light({ color: ThemeColors.sub }), darkModeChatMutedWhite])
                : renderInlineMarkdown(bulletMatch[1], `bullet-${index}`, [styles.messageListItem, light({ color: ThemeColors.text })])}
            </Text>
          </View>
        );
        return;
      }

      const numberMatch = cleanedLine.match(/^(\d+)\.\s+(.+)$/);
      if (numberMatch) {
        const metric = splitMetricText(numberMatch[2]);
        elements.push(
          <View key={`number-${index}`} style={[styles.messageNumberRow, metric && styles.messageMetricRow]}>
            <Text style={[styles.messageNumberIndex, light({ color: ThemeColors.sub }), darkModeChatMutedWhite]}>{numberMatch[1]}.</Text>
            <Text style={[styles.messageListItem, light({ color: ThemeColors.text })]}>
              {metric
                ? renderMetricInline(metric.label, metric.value, `number-${index}`, [styles.messageMetricValue, light({ color: ThemeColors.sub }), darkModeChatMutedWhite])
                : renderInlineMarkdown(numberMatch[2], `number-${index}`, [styles.messageListItem, light({ color: ThemeColors.text })])}
            </Text>
          </View>
        );
        return;
      }

      elements.push(
        <Text key={`line-${index}`} style={[styles.messageText, light({ color: ThemeColors.text })]}>
          {renderInlineMarkdown(cleanedLine, `line-${index}`, [styles.messageText, light({ color: ThemeColors.text })])}
        </Text>
      );
    });

    flushMetadata('final');

    return <View style={styles.formattedContent}>{elements}</View>;
  };

  const formatTimestamp = (timestamp?: Date) => {
    if (!timestamp) return "";
    const now = new Date();
    const msgTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - msgTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return msgTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    
    // Check if this message needs chips (match by selectionType for new flows, id for legacy payment)
    const msgSelectionType = (item as any).selectionType;
    const showProjectChips = !isUser && item.id.includes('clarification') && !item.id.includes('payment') && !item.id.includes('selection') && pendingProjectSelection;
    const showAnalysisChips = !isUser && item.id.includes('analysis-type') && pendingAnalysisType;
    const showPaymentChips = !isUser && pendingPaymentSelection && (msgSelectionType === 'payment' || item.id.includes('payment-clarification'));
    const showExpenseTypeChips = !isUser && pendingExpenseTypeSelection && msgSelectionType === 'expense_type';
    const showPOChips = !isUser && pendingPOSelection && msgSelectionType === 'po';
    const showScenarioChips = !isUser && pendingScenarioSelection && msgSelectionType === 'scenario';
    
    return (
      <View
        style={[
          styles.messageRow,
          { justifyContent: isUser ? "flex-end" : "flex-start" },
        ]}
      >
        {isUser ? (
          <View style={styles.userMessageContainer}>
            <View
              style={[
                styles.messageBubble,
                styles.userBubble,
              ]}
            >
              <Text style={styles.messageText} numberOfLines={undefined}>
                {item.content}
              </Text>
            </View>
            {item.timestamp && (
              <Text style={[styles.messageTimestamp, darkModeChatMutedWhite]}>{formatTimestamp(item.timestamp)}</Text>
            )}
            {(item.pdfUri || item.attachment) && (
              <TouchableOpacity
                style={styles.pdfAttachment}
                onPress={async () => {
                  const uri = item.pdfUri || item.attachment?.uri;
                  if (uri) {
                    try {
                      const canOpen = await Linking.canOpenURL(uri);
                      if (canOpen) {
                        await Linking.openURL(uri);
                      } else {
                        Alert.alert("Error", "Unable to open PDF file.");
                      }
                    } catch (error) {
                      Alert.alert("Error", "Failed to open PDF.");
                    }
                  }
                }}
              >
                <MaterialIcons name="picture-as-pdf" size={20} color="#0d2745" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.pdfAttachmentText, { color: "#0d2745" }]}>
                    {item.attachment?.name || "Contract PDF"}
                  </Text>
                  <Text style={styles.pdfAttachmentSubtext}>Tap to view</Text>
                </View>
                <MaterialIcons name="open-in-new" size={18} color="#0d2745" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.assistantBubbleWrapper}>
            <LinearGradient
              colors={ASSISTANT_BORDER_GRADIENT}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.assistantBubbleBorder}
            >
              <View
                style={[
                  styles.messageBubble,
                  styles.assistantBubble,
                  light({ backgroundColor: ThemeColors.surface2, borderColor: ThemeColors.line, borderWidth: 1 }),
                ]}
              >
                <View style={styles.assistantLabelRow}>
                  <Ionicons name="sparkles" size={12} color={darkMode ? Colors.green : "#16a34a"} />
                  <Text style={[styles.assistantLabelText, light({ color: "#16a34a" })]}>AI Assistant</Text>
                </View>
                {/* Text-first rendering (keeps classic chat format) */}
                {renderFormattedText(item.content)}
                {/* Note: Chips are shown outside message bubbles in the main list area */}
                {(item.pdfUri || item.attachment) && (
                  <View style={styles.pdfAttachmentWrapper}>
                    <LinearGradient
                      colors={ASSISTANT_BORDER_GRADIENT}
                      start={{ x: 0.05, y: 0.15 }}
                      end={{ x: 0.95, y: 0.85 }}
                      style={styles.pdfAttachmentBorder}
                    >
                      <TouchableOpacity
                        style={[styles.pdfAttachment, light({ backgroundColor: ThemeColors.surface2, borderColor: ThemeColors.line, borderWidth: 1 })]}
                        onPress={async () => {
                          const uri = item.pdfUri || item.attachment?.uri;
                          if (uri) {
                            try {
                              const canOpen = await Linking.canOpenURL(uri);
                              if (canOpen) {
                                await Linking.openURL(uri);
                              } else {
                                Alert.alert("Error", "Unable to open PDF file.");
                              }
                            } catch (error) {
                              Alert.alert("Error", "Failed to open PDF.");
                            }
                          }
                        }}
                      >
                        <MaterialIcons name="picture-as-pdf" size={20} color="#38d39f" />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={[styles.pdfAttachmentText, { color: "#38d39f" }]}>
                            {item.attachment?.name || "Contract PDF"}
                          </Text>
                          <Text style={styles.pdfAttachmentSubtext}>Tap to view</Text>
                        </View>
                        <MaterialIcons name="open-in-new" size={18} color="#38d39f" />
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
                )}
              </View>
            </LinearGradient>
            {item.timestamp && (
              <Text style={[styles.messageTimestamp, styles.assistantTimestamp, darkModeChatMutedWhite]}>
                {formatTimestamp(item.timestamp)}
              </Text>
            )}
            {showProjectChips && pendingProjectSelection && (
              <View style={{ marginTop: 8, marginLeft: 4 }}>
                <ProjectSelectionChips
                  options={pendingProjectSelection.options}
                  darkMode={darkMode}
                  onSelect={handleProjectSelection}
                />
              </View>
            )}
            {showAnalysisChips && pendingAnalysisType && (
              <View style={{ marginTop: 8, marginLeft: 4 }}>
                <AnalysisTypeChips
                  darkMode={darkMode}
                  onSelect={handleAnalysisTypeSelection}
                />
              </View>
            )}
            {showPaymentChips && pendingPaymentSelection && (
              <View style={{ marginTop: 8, marginLeft: 4 }}>
                <PaymentSelectionChips
                  options={pendingPaymentSelection.options}
                  darkMode={darkMode}
                  clarificationLabel={pendingPaymentSelection.projectName
                    ? `Which payment should I mark as completed for ${pendingPaymentSelection.projectName}?`
                    : undefined}
                  onSelect={handlePaymentSelection}
                />
              </View>
            )}
            {showExpenseTypeChips && pendingExpenseTypeSelection && (
              <View style={{ marginTop: 8, marginLeft: 4 }}>
                <SelectionCards
                  options={pendingExpenseTypeSelection.options}
                  label="What type of expense are you logging?"
                  darkMode={darkMode}
                  onSelect={handleExpenseTypeSelection}
                />
              </View>
            )}
            {showPOChips && pendingPOSelection && (
              <View style={{ marginTop: 8, marginLeft: 4 }}>
                <SelectionCards
                  options={pendingPOSelection.options}
                  label={pendingPOSelection.projectName
                    ? `Which purchase order should I mark as received for ${pendingPOSelection.projectName}?`
                    : 'Which purchase order should I mark as received?'}
                  darkMode={darkMode}
                  onSelect={handlePOSelection}
                />
              </View>
            )}
            {showScenarioChips && pendingScenarioSelection && (
              <View style={{ marginTop: 8, marginLeft: 4 }}>
                <SelectionCards
                  options={pendingScenarioSelection.options}
                  label="Which scenario would you like to run?"
                  darkMode={darkMode}
                  onSelect={handleScenarioSelection}
                />
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (!isTyping) return null;
    return (
      <View style={styles.typingIndicatorContainer}>
        <View style={styles.assistantBubbleWrapper}>
          <LinearGradient
            colors={["rgba(45, 255, 196, 0.52)", "rgba(0, 166, 255, 0.5)"]}
            start={{ x: 0.05, y: 0.15 }}
            end={{ x: 0.95, y: 0.85 }}
            style={styles.assistantBubbleBorder}
          >
            <View
              style={[
                styles.messageBubble,
                styles.assistantBubble,
                styles.typingBubble,
                light({ backgroundColor: ThemeColors.surface2, borderColor: ThemeColors.line, borderWidth: 1 }),
              ]}
            >
              <View style={styles.assistantLabelRow}>
                <Ionicons name="sparkles" size={12} color={darkMode ? Colors.green : "#16a34a"} />
                <Text style={[styles.assistantLabelText, light({ color: "#16a34a" })]}>AI Assistant</Text>
              </View>
              <View style={styles.typingDots}>
                <Animated.View style={[styles.typingDot, { opacity: dotAnim1 }]} />
                <Animated.View style={[styles.typingDot, { marginLeft: 4, opacity: dotAnim2 }]} />
                <Animated.View style={[styles.typingDot, { marginLeft: 4, opacity: dotAnim3 }]} />
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
    );
  };

  const keyboardOpen = keyboardHeight > 0;

  return (
    <Modal visible={visible} animationType={Platform.OS === "ios" ? "slide" : "fade"} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: darkMode ? Colors.bg : ThemeColors.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        enabled={true}
      >
        <View style={[styles.gradient, light({ backgroundColor: ThemeColors.bg })]}>
          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            {/* Header — full title strip when idle; back-only when keyboard is open */}
            <View
              style={[
                styles.header,
                keyboardOpen && styles.headerKeyboardCompact,
                light({ backgroundColor: ThemeColors.bg }),
              ]}
            >
              <View style={styles.backButtonWrapper}>
                <LinearGradient
                  colors={["rgba(45, 255, 196, 0.52)", "rgba(0, 166, 255, 0.5)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.backButtonBorder}
                >
                  <TouchableOpacity
                    onPress={() => {
                      console.log('🔙 Back button pressed in AIAssistantModal');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      onClose();
                    }}
                    style={[styles.backButton, light({ backgroundColor: ThemeColors.bg })]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : "#000000"} />
                  </TouchableOpacity>
                </LinearGradient>
              </View>
              {!keyboardOpen && (
                <>
                  <View style={styles.headerContent}>
                    <View style={styles.headerTitleRow}>
                      <View style={styles.headerTitleCenter}>
                        <Ionicons name="sparkles-sharp" size={18} color={Colors.green} />
                        <Text style={[styles.headerTitle, light({ color: ThemeColors.text })]}>
                          AI Assistant
                        </Text>
                      </View>
                    </View>
                    {(projectInfo || isProjectsScreenContext || isGlobalAssistantContext) && (
                      <View style={styles.headerContextStack}>
                        <Text style={[styles.headerSubtitle, light({ color: ThemeColors.sub })]}>
                          {isGlobalAssistantContext
                            ? 'Command Center • All Projects'
                            : isProjectsScreenContext
                              ? selectedProjectHintId
                                ? (() => {
                                    const sel = projectSelectionOptions.find((p: any) => p.id === selectedProjectHintId);
                                    return sel ? `${sel.title} • ${sel.status || 'Project'}` : 'Portfolio View • All Projects';
                                  })()
                                : 'Portfolio View • All Projects'
                              : isEstimateContext
                                ? `Estimate • ${parsedContext?.stepTitle || 'Bid'}`
                                : `${projectInfo!.title} • ${projectInfo!.phase}`}
                        </Text>
                        {projectInfo && !isProjectsScreenContext && !isGlobalAssistantContext && (
                          <Text style={[styles.headerMeta, light({ color: ThemeColors.sub })]}>
                            Total ${projectInfo.total.toLocaleString()} • Overhead {projectInfo.overhead}% • Markup{' '}
                            {projectInfo.markup}%
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  <View style={styles.headerSpacer} />
                </>
              )}
              {keyboardOpen && <View style={{ flex: 1 }} />}
            </View>

            {/* Messages - Everything scrolls together */}
            <View style={{ flex: 1, minHeight: 0 }}>
            <FlatList
              ref={flatListRef}
              style={styles.messageList}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
                contentContainerStyle={[
                  styles.messagesContainer,
                  {
                    paddingBottom: keyboardHeight > 0 ? listPaddingBottomKeyboardOpen : 200,
                    ...(keyboardHeight > 0 ? {} : { minHeight: minContentHeight }),
                  },
                ]}
                showsVerticalScrollIndicator={true}
              scrollEnabled={true}
                nestedScrollEnabled={false}
              {...KEYBOARD_SCROLL_DEFAULTS}
                removeClippedSubviews={false}
                bounces={Platform.OS === 'ios'}
                alwaysBounceVertical={false}
                scrollEventThrottle={16}
              ListFooterComponent={() => (
                <>
                  {renderTypingIndicator()}
                  {!isTyping && displayChatSuggestions.length > 0 && messages.length > 0 && (
                    <View style={styles.footerSuggestionsWrap}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.footerSuggestionsContent}>
                        {displayChatSuggestions.map((s, i) => (
                          <TouchableOpacity
                            key={`suggestion-${i}`}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setChatSuggestions([]);
                              handleQuickAction(s.prompt);
                            }}
                            style={styles.footerSuggestionChip}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                          >
                            <Text style={[styles.footerSuggestionChipText, darkModeChatMutedWhite]}>{s.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}
                refreshControl={
                  isGlobalAssistantContext && displayBrief ? (
                    <RefreshControl
                      refreshing={briefRefreshing}
                      onRefresh={refreshTodayBrief}
                      tintColor={darkMode ? Colors.green : undefined}
                    />
                  ) : undefined
                }
                onScrollBeginDrag={() => {
                  isUserScrollingRef.current = true;
                }}
                onScrollEndDrag={() => {
                  setTimeout(() => {
                    isUserScrollingRef.current = false;
                  }, 1000);
                }}
                onMomentumScrollEnd={() => {
                  setTimeout(() => {
                    isUserScrollingRef.current = false;
                  }, 500);
                }}
              onContentSizeChange={() => {
                // Only auto-scroll if user is not manually scrolling
                if (flatListRef.current && !isUserScrollingRef.current) {
                  setTimeout(() => {
                    if (!isUserScrollingRef.current && flatListRef.current) {
                      flatListRef.current.scrollToEnd({ animated: true });
                    }
                  }, 100);
                }
              }}
              ListHeaderComponent={
                <>
                  {/* Global AI: Today Brief card — hero, insight-first */}
                  {isGlobalAssistantContext && displayBrief && (
                    <>
                      <View
                        style={[styles.todayBriefCard, light({ backgroundColor: ThemeColors.surface2, borderColor: ThemeColors.line })]}
                        accessibilityLabel="Today Brief"
                        accessibilityRole="summary"
                      >
                        <LinearGradient
                          colors={["rgba(0, 100, 90, 0.16)", "rgba(0, 70, 65, 0.08)"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.todayBriefGradient}
                        >
                          <Text style={[styles.todayBriefCardTitle, light({ color: ThemeColors.sub })]}>
                            Today Brief
                          </Text>
                          <Text style={[styles.todayBriefGreeting, light({ color: ThemeColors.text })]}>
                            {displayBrief.reply.split('\n\n')[0]}
                          </Text>
                          <Text style={[styles.todayBriefSubGreeting, light({ color: ThemeColors.sub })]}>
                            Here's what needs attention today.
                          </Text>
                          {displayBrief.insights.length > 0 ? (
                            <View style={styles.todayBriefInsights}>
                              {displayBrief.insights.map((insight, i) => (
                                <View key={i} style={styles.todayBriefInsightRow}>
                                  <View style={styles.todayBriefInsightDot} />
                                  <Text style={[styles.todayBriefInsightItem, light({ color: ThemeColors.text })]}>
                                    {insight}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <Text style={[styles.todayBriefInsightItem, styles.todayBriefEmptyInsight, light({ color: ThemeColors.sub })]}>
                              Your portfolio looks quiet — no urgent items.
                            </Text>
                          )}
                        </LinearGradient>
                      </View>

                      {/* Biggest Risk card — or All clear when no risks */}
                      {displayBrief.biggestRisk ? (
                        <View style={[styles.biggestRiskCard, light({ backgroundColor: ThemeColors.surface2, borderColor: ThemeColors.line })]}>
                          <View style={styles.biggestRiskHeader}>
                            <Ionicons name="warning-outline" size={19} color="rgba(251, 146, 60, 0.95)" />
                            <Text style={[styles.biggestRiskTitle, light({ color: ThemeColors.text })]}>
                              Biggest Risk
                            </Text>
                          </View>
                          <Text style={[styles.biggestRiskMessage, light({ color: ThemeColors.text })]}>
                            {displayBrief.biggestRisk.message}
                          </Text>
                          <Text style={[styles.biggestRiskDetail, light({ color: ThemeColors.sub })]}>
                            {displayBrief.biggestRisk.detail}
                          </Text>
                          <TouchableOpacity
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              handleQuickAction(displayBrief.biggestRisk!.prompt);
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityLabel={(displayBrief.biggestRisk as { cta?: string })?.cta || "Review Project"}
                            accessibilityRole="button"
                            style={[styles.biggestRiskButton, light({ borderColor: ThemeColors.line })]}
                          >
                            <Text style={[styles.biggestRiskButtonText, light({ color: ThemeColors.text })]}>
                              {(displayBrief.biggestRisk as { cta?: string })?.cta || "Review Project"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View
                          style={[styles.allClearCard, light({ backgroundColor: ThemeColors.surface2, borderColor: ThemeColors.line })]}
                          accessibilityLabel="All clear. No critical risks across your projects."
                          accessibilityRole="summary"
                        >
                          <Ionicons name="checkmark-circle" size={20} color="rgba(34, 197, 94, 0.8)" />
                          <View>
                            <Text style={[styles.allClearTitle, light({ color: ThemeColors.text })]}>
                              All clear
                            </Text>
                            <Text style={[styles.allClearSubtitle, light({ color: ThemeColors.sub })]}>
                              No critical risks across your projects.
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Quick actions */}
                      <Text
                        style={[
                          styles.todayBriefSectionLabel,
                          styles.commandCenterSectionRail,
                          { marginTop: 22, marginBottom: 10, marginHorizontal: 0 },
                          light({ color: ThemeColors.sub }),
                        ]}
                      >
                        Quick actions
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.todayBriefChipsScroll, { marginLeft: 0 }]} contentContainerStyle={styles.todayBriefChipsContent}>
                        {(displayBrief.quickActions || []).slice(0, 6).map((qa, i) => {
                          const isCompareChip = /\b(compare|profitability|risk|forecast|budget|receipts|deadlines|portfolio)\b/i.test(qa.prompt || qa.label || '');
                          const chipDisabled = isCompareChip && !isContextReady;
                          return (
                          <TouchableOpacity
                            key={i}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              handleQuickAction(qa.prompt);
                            }}
                            disabled={chipDisabled}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel={qa.label}
                            accessibilityRole="button"
                            style={[styles.todayBriefQuickChip, chipDisabled && { opacity: 0.5 }, light({ borderColor: "#16a34a", backgroundColor: "rgba(22,163,74,0.08)" })]}
                          >
                            <Text style={[styles.todayBriefQuickChipText, light({ color: "#16a34a" })]}>
                              {qa.label}
                            </Text>
                          </TouchableOpacity>
                          );
                        })}
                      </ScrollView>

                      {/* Suggested questions */}
                      <Text
                        style={[
                          styles.todayBriefSectionLabel,
                          styles.commandCenterSectionRail,
                          { marginTop: 18, marginBottom: 10, marginHorizontal: 0 },
                          light({ color: ThemeColors.sub }),
                        ]}
                      >
                        Suggested questions
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.todayBriefChipsScroll, { marginLeft: 0 }]} contentContainerStyle={styles.todayBriefChipsContent}>
                        {(displayBrief.suggestedFollowUps || []).slice(0, 6).map((sf, i) => (
                          <TouchableOpacity
                            key={i}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              handleQuickAction(sf.prompt);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel={sf.label}
                            accessibilityRole="button"
                            style={[styles.todayBriefFollowChip, light({ borderColor: ThemeColors.line, backgroundColor: ThemeColors.surface })]}
                          >
                            <Text style={[styles.todayBriefFollowChipText, light({ color: ThemeColors.text })]}>
                              {sf.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </>
                  )}
                  {/* AI Project Manager Mode card - hidden on Projects, Global Assistant, and Estimate Generator (field-PM framing) */}
                  {!isProjectsScreenContext && !isGlobalAssistantContext && !isEstimateContext && (
                  <View style={styles.managerCardContainer}>
                    <LinearGradient
                      colors={["rgba(45, 255, 196, 0.52)", "rgba(0, 166, 255, 0.5)"]}
                      start={{ x: 0.05, y: 0.15 }}
                      end={{ x: 0.95, y: 0.85 }}
                      style={styles.managerCardBorder}
                    >
                      <View style={[styles.managerCard, light({ backgroundColor: ThemeColors.surface2, borderColor: ThemeColors.line, borderWidth: 1 })]}>
                    <View style={styles.managerHeaderRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={[styles.managerEyebrow, light({ color: ThemeColors.sub })]}>
                          Project automation
                        </Text>
                        <Text style={[styles.managerTitle, light({ color: ThemeColors.text })]}>
                          AI Project Manager Mode
                        </Text>
                        <Text style={[styles.managerSubtitle, light({ color: ThemeColors.sub })]}>
                          AI monitors cost, schedule, and margin so you can act faster.
                        </Text>
                      </View>

                      {aiModeLoading ? (
                        <ActivityIndicator color={Colors.green} />
                      ) : (
                        <View
                          style={[
                            styles.managerToggleWrapper,
                            light(
                              !aiManagerEnabled
                                ? {
                                    backgroundColor: ThemeColors.surface2,
                                    borderColor: ThemeColors.line,
                                  }
                                : undefined,
                            ),
                          ]}
                        >
                          <Switch
                            value={aiManagerEnabled}
                            onValueChange={toggleEnabled}
                            thumbColor={
                              aiManagerEnabled
                                ? Colors.green
                                : darkMode
                                  ? "#f4f4f5"
                                  : ThemeColors.sub
                            }
                            trackColor={{
                              false: darkMode ? "rgba(148,163,184,0.6)" : ThemeColors.surface2,
                              true: darkMode ? "rgba(34,197,94,0.4)" : ThemeColors.line,
                            }}
                            style={{ transform: [{ scale: 0.9 }] }}
                          />
                        </View>
                      )}
                    </View>

                    {aiManagerEnabled && (
                      <>
                        <View style={styles.managerChipRow}>
                          <View style={[styles.managerChip, light({ backgroundColor: "rgba(34,197,94,0.18)" })]}>
                            <Text style={[styles.managerChipText, light({ color: Colors.green })]}>
                              Costs
                            </Text>
                          </View>
                          <View style={[styles.managerChip, light({ backgroundColor: "rgba(34,197,94,0.18)" })]}>
                            <Text style={[styles.managerChipText, light({ color: Colors.green })]}>
                              Schedule
                            </Text>
                          </View>
                          <View style={[styles.managerChip, light({ backgroundColor: "rgba(34,197,94,0.18)" })]}>
                            <Text style={[styles.managerChipText, light({ color: Colors.green })]}>
                              Margin
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.managerMicrocopy, light({ color: ThemeColors.sub })]}>
                          Checks run when you open AI or update this project.
                        </Text>
                      </>
                    )}
                      </View>
                    </LinearGradient>
                  </View>
                  )}

                  {/* Current Project Strip - hidden on Projects screen and Global AI (project chips handle selection) */}
                  {projectInfo && !isProjectsScreenContext && !isGlobalAssistantContext && (
                    <View style={styles.projectStripContainer}>
                      <LinearGradient
                        colors={["rgba(45, 255, 196, 0.52)", "rgba(0, 166, 255, 0.5)"]}
                        start={{ x: 0.05, y: 0.15 }}
                        end={{ x: 0.95, y: 0.85 }}
                        style={styles.projectStripBorder}
                      >
                        <View style={[styles.projectStrip, light({ backgroundColor: ThemeColors.surface2, borderColor: ThemeColors.line, borderWidth: 1 })]}>
                      <View>
                        <Text style={[styles.projectEyebrow, light({ color: ThemeColors.sub })]}>
                          {isEstimateContext ? 'Current bid' : 'Current project'}
                        </Text>
                        <Text style={[styles.projectTitle, light({ color: ThemeColors.text })]}>
                          {projectInfo.title}
                        </Text>
                        {isEstimateContext && projectInfo.estimateNameMissing && (
                          <Text
                            style={[
                              styles.projectSubtitle,
                              light({ color: ThemeColors.sub }),
                              { fontSize: 12, marginTop: 4, lineHeight: 16 },
                            ]}
                          >
                            Fill in the bid title field to name this estimate.
                          </Text>
                        )}
                        <Text style={[styles.projectSubtitle, light({ color: ThemeColors.sub })]}>
                          {projectInfo.phase} • ${(projectInfo.total || 0).toLocaleString()}
                        </Text>
                      </View>

                      <View style={styles.projectRight}>
                        <View style={[styles.marginBadge, light({ backgroundColor: "rgba(34,197,94,0.18)" })]}>
                          <Text style={[styles.marginBadgeLabel, light({ color: Colors.green })]}>
                            {projectInfo.hasLiveProjectContext ? 'Spend-to-date' : 'Bid margin'}
                          </Text>
                          <Text style={[styles.marginBadgeValue, light({ color: Colors.green })]}>
                            {projectInfo.hasLiveProjectContext && projectInfo.spendToDateMarginPct != null
                              ? `${Number(projectInfo.spendToDateMarginPct).toFixed(1)}%`
                              : projectInfo.bidMarginPct != null ? `${Number(projectInfo.bidMarginPct).toFixed(1)}%` : projectInfo.markup ? `${projectInfo.markup}%` : "—"}
                          </Text>
                        </View>

                        {aiManagerEnabled && (
                          <View style={styles.aiWatchingRow}>
                            <Ionicons name="sparkles-outline" size={13} color={Colors.green} />
                            <Text style={[styles.aiWatchingText, light({ color: Colors.green })]}>
                              AI watching
                            </Text>
                          </View>
                        )}
                      </View>
                        </View>
                      </LinearGradient>
                    </View>
                  )}

                  {/* Estimate: AI Copilot — same shell + gradient typography as Today Brief */}
                  {isEstimateContext && estimateAssistantBrief && (
                    <View style={styles.estimateCopilotOuter}>
                      <View
                        style={[styles.todayBriefCard, styles.estimateCopilotCard, light({ backgroundColor: ThemeColors.surface2, borderColor: ThemeColors.line })]}
                        accessibilityLabel="AI Copilot"
                        accessibilityRole="summary"
                      >
                        <LinearGradient
                          colors={['rgba(0, 100, 90, 0.16)', 'rgba(0, 70, 65, 0.08)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.todayBriefGradient}
                        >
                          <Text style={[styles.todayBriefCardTitle, light({ color: ThemeColors.sub })]}>
                            AI Copilot
                          </Text>
                          <Text
                            style={[styles.todayBriefGreeting, light({ color: ThemeColors.text })]}
                            numberOfLines={2}
                          >
                            {estimateAssistantBrief.bestNextAction?.label || 'Best next action'}
                          </Text>
                          {!!estimateCopilotConfidenceLabel && (
                            <Text
                              style={[styles.todayBriefSubGreeting, light({ color: ThemeColors.sub })]}
                              numberOfLines={2}
                            >
                              {estimateCopilotConfidenceLabel}
                            </Text>
                          )}
                          <View style={styles.todayBriefInsights}>
                            <View style={styles.todayBriefInsightRow}>
                              <View style={styles.todayBriefInsightDot} />
                              <Text
                                style={[styles.todayBriefInsightItem, light({ color: ThemeColors.text })]}
                                numberOfLines={5}
                              >
                                {estimateAssistantBrief.bestNextAction?.reason || estimateAssistantBrief.summary}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.estimateCopilotActionsRow}>
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                handleQuickAction(estimateAssistantBrief.bestNextAction?.prompt || '');
                              }}
                              style={[styles.estimateCopilotPrimaryOnBrief, light({ backgroundColor: '#16a34a' })]}
                            >
                              <Text style={styles.estimateCopilotPrimaryOnBriefText} numberOfLines={1}>
                                {estimateCopilotPrimaryLabel}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              activeOpacity={0.88}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                handleQuickAction('Review this bid before I send it.');
                              }}
                              style={[styles.estimateCopilotSecondaryOnBrief, light({ borderColor: ThemeColors.line })]}
                            >
                              <Text style={[styles.estimateCopilotSecondaryOnBriefText, light({ color: ThemeColors.text })]}>Run My Bid</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              activeOpacity={0.88}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                handleQuickAction('Give this estimate a client-facing wording and send-readiness review.');
                              }}
                              style={[styles.estimateCopilotSecondaryOnBrief, light({ borderColor: ThemeColors.line })]}
                            >
                              <Text style={[styles.estimateCopilotSecondaryOnBriefText, light({ color: ThemeColors.text })]}>Client Ready</Text>
                            </TouchableOpacity>
                          </View>
                        </LinearGradient>
                      </View>
                    </View>
                  )}
                </>
              }
              ListEmptyComponent={
                isGlobalAssistantContext && displayBrief ? (
                  <View style={{ height: 24 }} />
                ) : isEstimateContext ? (
                  <View style={styles.estimateFooterHelperWrap}>
                    <Text style={[styles.estimateFooterHelperText, light({ color: ThemeColors.sub })]}>
                      AI Copilot is above. Ask for budget, standard, or premium pricing in chat if you want scenario comparisons.
                    </Text>
                  </View>
                ) : (
                <View style={[styles.greetingWrapper, light({ backgroundColor: ThemeColors.bg }), isProjectsScreenContext && { marginBottom: 8 }]}>
                  <View style={[styles.greetingIconCircleWrapper, isProjectsScreenContext && { marginBottom: 8 }]}>
                    <LinearGradient
                      colors={["rgba(45, 255, 196, 0.52)", "rgba(0, 166, 255, 0.5)"]}
                      start={{ x: 0.05, y: 0.15 }}
                      end={{ x: 0.95, y: 0.85 }}
                      style={styles.greetingIconCircleBorder}
                    >
                      <View style={[styles.greetingIconCircle, light({ backgroundColor: ThemeColors.surface2, borderColor: ThemeColors.line, borderWidth: 1 })]}>
                        <Ionicons name="sparkles-outline" size={26} color={Colors.green} />
                      </View>
                    </LinearGradient>
                  </View>

                  <Text style={[styles.greetingTitle, light({ color: ThemeColors.text })]}>
                    {(isProjectsScreenContext || isGlobalAssistantContext)
                      ? "Your AI command center"
                      : isEstimateContext
                        ? "Your AI estimate assistant"
                        : "Your AI project manager"}
                  </Text>

                  <Text style={[styles.greetingSubtitle, light({ color: ThemeColors.sub })]}>
                    {(isProjectsScreenContext || isGlobalAssistantContext) ? (
                      <>
                        Compare projects, spot risks, review budgets, and act on schedule or payment issues.
                        {'\n\n'}
                        Ask anything or use a quick action below.
                      </>
                    ) : isEstimateContext ? (
                      <>
                        Ask about line items, markup, scope, and pricing for this bid. Use the chips below or type your own question.
                      </>
                    ) : (
                      <>Ask about <Text style={[styles.greetingHighlight, light({ color: ThemeColors.text })]}>{projectInfo?.title || "Current Project"}</Text> to review health, update costs, manage schedules, and protect profit.</>
                    )}
                  </Text>

                  {recentSummary && (
                    <View style={styles.recentSummaryContainer}>
                      <LinearGradient
                        colors={["rgba(45, 255, 196, 0.52)", "rgba(0, 166, 255, 0.5)"]}
                        start={{ x: 0.05, y: 0.15 }}
                        end={{ x: 0.95, y: 0.85 }}
                        style={styles.recentSummaryBorder}
                      >
                        <View style={[styles.recentSummaryInner, light({ backgroundColor: ThemeColors.surface2, borderColor: ThemeColors.line, borderWidth: 1 })]}>
                          <TouchableOpacity
                            style={styles.recentSummaryHeaderRow}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setRecentSummaryExpanded((v) => !v);
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.recentSummaryTitle, light({ color: ThemeColors.text })]}>
                                AI Insights
                              </Text>
                              <Text style={[styles.recentSummaryMeta, light({ color: ThemeColors.sub }), darkModeChatMutedWhite]}>
                                {recentSummary.timestamp ? formatTimestamp(recentSummary.timestamp) : "Just now"}
                              </Text>
                            </View>
                            <Ionicons
                              name={recentSummaryExpanded ? "chevron-up" : "chevron-down"}
                              size={18}
                              color={darkMode ? '#FFFFFF' : ThemeColors.sub}
                            />
                          </TouchableOpacity>

                          {!recentSummaryExpanded ? (
                            <Text style={[styles.recentSummaryPreview, light({ color: ThemeColors.sub }), darkModeChatMutedWhite]}>
                              {(recentSummary.content || "").replace(/\s+/g, " ").trim().slice(0, 150)}
                              {(recentSummary.content || "").length > 150 ? "..." : ""}
                            </Text>
                          ) : (
                            <View style={styles.recentSummaryBody}>
                              {renderFormattedText(recentSummary.content)}
                              <View style={styles.recentSummaryActionsRow}>
                                <TouchableOpacity
                                  style={styles.recentSummaryAction}
                                  onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    handleQuickAction("Give me a project health check.");
                                  }}
                                >
                                  <Text style={styles.recentSummaryActionText}>Refresh</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      </LinearGradient>
                    </View>
                  )}

                  {/* Primary AI actions — hidden on Projects; hidden on Estimate (chips + rail cover this) */}
                  {!isProjectsScreenContext && !isEstimateContext && (
                  <View style={styles.primaryActions}>
                    <View style={styles.primaryButtonWrapper}>
                      <LinearGradient
                        colors={["rgba(45, 255, 196, 0.52)", "rgba(0, 166, 255, 0.5)"]}
                        start={{ x: 0.05, y: 0.15 }}
                        end={{ x: 0.95, y: 0.85 }}
                        style={styles.primaryButtonBorder}
                      >
                        <TouchableOpacity
                          style={[styles.primaryButtonInner, light({ backgroundColor: ThemeColors.surface2, borderColor: ThemeColors.line, borderWidth: 1 })]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleQuickAction("Give me a project health check.");
                          }}
                        >
                          <Ionicons name="sparkles-outline" size={16} color={Colors.green} />
                          <Text style={[styles.primaryButtonText, light({ color: ThemeColors.text })]}>
                            Check project health
                          </Text>
                        </TouchableOpacity>
                      </LinearGradient>
                    </View>
                  </View>
                  )}
                </View>
                )
              }
            />
            </View>

            {/* Input bar - Fixed at bottom */}
            <View style={[styles.inputContainer, { 
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              paddingBottom: Math.max(insets.bottom, 10) + 6,
              paddingTop: 10,
              backgroundColor: darkMode ? Colors.bg : ThemeColors.bg,
            }, light({ borderTopColor: ThemeColors.line, shadowOpacity: 0.05 })]}>
              {/* Global AI & Projects: Smart Quick Actions */}
              {!keyboardOpen && (isGlobalAssistantContext || isProjectsScreenContext) && (
                <View style={styles.bottomRailSection}>
                  {/* Projects screen only: project chips. Command Center: no Select Project row. */}
                  {isProjectsScreenContext && projectSelectionOptions.length > 0 && (
                    <ProjectSelectionChips
                      options={projectSelectionOptions}
                      darkMode={darkMode}
                      compact
                      onSelect={handleProjectsScreenProjectSelection}
                    />
                  )}
                  {isProjectsScreenContext && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.bottomRailScroll}
                      contentContainerStyle={styles.bottomRailContent}
                    >
                      {[
                        { label: 'Compare Projects', basePrompt: 'Compare all my projects for profitability and risk', portfolioScope: true },
                        { label: 'What Needs Attention', basePrompt: 'What should I focus on today?', portfolioScope: true },
                        { label: 'Forecast Profit', basePrompt: 'Forecast profit across my projects', portfolioScope: true },
                        { label: 'Budget Risks', basePrompt: 'Identify budget risks across my projects', portfolioScope: true },
                        { label: 'Missing Receipts', basePrompt: 'Which projects have expenses missing receipts?', portfolioScope: true },
                        { label: 'Upcoming Payments', basePrompt: 'What payments are coming up?', portfolioScope: true },
                        { label: 'Add Expense', basePrompt: 'Add an expense', portfolioScope: false },
                        { label: 'Create PO', basePrompt: 'Create a purchase order', portfolioScope: false },
                        { label: 'Daily Log', basePrompt: 'Add a daily log for today', portfolioScope: false },
                        { label: 'Change Order', basePrompt: 'Create a change order', portfolioScope: false },
                      ].map((chip) => {
                        const isCompareChip = (chip as any).portfolioScope;
                        const chipDisabled = isCompareChip && !isContextReady;
                        return (
                        <TouchableOpacity
                          key={chip.label}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          disabled={chipDisabled}
                          onPress={() => {
                            const selected = projectSelectionOptions.find((p: any) => p.id === selectedProjectHintId);
                            const message = (chip as any).portfolioScope || !selected
                              ? (chip as any).basePrompt
                              : `${(chip as any).basePrompt} for ${selected.title}`;
                            if ((chip as any).portfolioScope) {
                              portfolioScopeOverrideRef.current = true;
                              onSelectedProjectIdChange?.(null as any);
                            }
                            handleQuickAction(message);
                          }}
                          style={[styles.bottomRailChip, chipDisabled && { opacity: 0.5 }, light({ borderColor: ThemeColors.line, backgroundColor: ThemeColors.surface })]}
                        >
                          <Text style={[styles.bottomRailChipText, light({ color: "#16a34a" })]}>{chip.label}</Text>
                        </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              )}
              {/* ── QUICK ACTION CHIPS ── (Projects screen has its own row above, skip default & flow chips when empty) */}
              {keyboardOpen
                ? null
                : messages.length <= 1 && !isProjectsScreenContext && !isGlobalAssistantContext ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  scrollEnabled={true}
                  directionalLockEnabled={true}
                  nestedScrollEnabled={false}
                  style={styles.bottomRailSection}
                  contentContainerStyle={styles.bottomRailContent}
                >
                  {(() => {
                    // Determine if we're in Team context
                    let isTeamContext = false;
                    try {
                      if (context) {
                        const parsed = JSON.parse(context);
                        isTeamContext = parsed.screen === 'Team';
                      }
                    } catch (e) {
                      // Ignore parsing errors
                    }

                    // Team-specific quick actions
                    if (isTeamContext) {
                      return [
                        { label: 'Assign PM', prompt: 'Assign a project manager to this project' },
                        { label: 'Add Team Member', prompt: 'Add a new team member to this project' },
                        { label: 'Notify Team', prompt: 'Send a notification to the team' },
                        { label: 'Team Status', prompt: 'Show me the current team status and availability' },
                        { label: 'Team Tasks', prompt: 'What tasks are assigned to team members?' },
                        { label: 'Update Status', prompt: 'Update a team member\'s status' },
                      ].map((chip) => (
                        <TouchableOpacity
                          key={chip.label}
                          onPress={() => {
                            handleQuickAction(chip.prompt);
                          }}
                          style={[styles.bottomRailChip, light({ borderColor: ThemeColors.line, backgroundColor: ThemeColors.surface })]}
                        >
                          <Text style={[styles.bottomRailChipText, light({ color: "#16a34a" })]}>{chip.label}</Text>
                        </TouchableOpacity>
                      ));
                    }

                    // Estimate Generator — bid-building context (not field project management)
                    if (isEstimateContext) {
                      return estimateQuickActionChips.map((chip: { label: string; prompt: string }) => (
                        <TouchableOpacity
                          key={chip.label}
                          onPress={() => {
                            handleQuickAction(chip.prompt);
                          }}
                          style={[styles.bottomRailChip, light({ borderColor: ThemeColors.line, backgroundColor: ThemeColors.surface })]}
                        >
                          <Text style={[styles.bottomRailChipText, light({ color: "#16a34a" })]}>{chip.label}</Text>
                        </TouchableOpacity>
                      ));
                    }

                    // Default project quick actions
                    return [
                      { label: 'Log Expense', prompt: 'Can you log an expense for this project?' },
                      { label: 'Change Order', prompt: 'Create me a change order' },
                      { label: 'Create PO', prompt: 'Create a purchase order' },
                      { label: 'Payments', prompt: 'Mark a payment as collected' },
                      { label: 'Daily Log', prompt: 'Add a daily job log for today' },
                      { label: 'Budget Check', prompt: 'Give me a project health check.' },
                      { label: 'Team', prompt: 'can you help me with team management' },
                      { label: 'What If', prompt: 'Run a scenario analysis for this project.' },
                      { label: 'Forecast Profit', prompt: 'Forecast the final cost and profit for this project.' },
                    ].map((chip) => (
                    <TouchableOpacity
                      key={chip.label}
                      onPress={() => {
                        handleQuickAction(chip.prompt);
                      }}
                      style={[styles.bottomRailChip, light({ borderColor: ThemeColors.line, backgroundColor: ThemeColors.surface })]}
                    >
                      <Text style={[styles.bottomRailChipText, light({ color: "#16a34a" })]}>{chip.label}</Text>
                    </TouchableOpacity>
                  ));
                  })()}
                </ScrollView>
              ) : (isGlobalAssistantContext || (isProjectsScreenContext && messages.length <= 1)) ? null : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  scrollEnabled={true}
                  directionalLockEnabled={true}
                  nestedScrollEnabled={false}
                  style={styles.bottomRailSection}
                  contentContainerStyle={styles.bottomRailContent}
                >
                  {(() => {
                    if (isEstimateContext) {
                      return estimateQuickActionChips.map((chip: { label: string; prompt: string }, index: number) => ({
                        ...chip,
                        primary: index === 0,
                      }));
                    }
                    // Flow-specific chips for projects
                    const flowChips: Array<{ label: string; prompt: string; primary?: boolean }> = (() => {
                      switch (compactChipFlow) {
                        case 'change_order':
                          return [
                            { label: 'Add Line Item', prompt: 'Add a line item to this change order', primary: true },
                            { label: 'Cancel', prompt: 'Cancel this change order' },
                          ];
                        case 'payments':
                          return [
                            { label: 'Mark Payment', prompt: 'Mark a payment as collected', primary: true },
                            { label: 'Log Expense', prompt: 'Can you log an expense for this project?' },
                            { label: 'Create PO', prompt: 'Create a purchase order' },
                          ];
                        case 'daily_log':
                          return [
                            { label: 'Daily Log', prompt: 'Add a daily job log for today', primary: true },
                            { label: 'Log Expense', prompt: 'Can you log an expense for this project?' },
                          ];
                        case 'budget_check':
                          return [
                            { label: 'Forecast Profit', prompt: 'Forecast the final cost and profit for this project.', primary: true },
                            { label: 'What If', prompt: 'Run a scenario analysis for this project.' },
                            { label: 'Log Expense', prompt: 'Can you log an expense for this project?' },
                          ];
                        case 'team':
                          return [
                            { label: 'Assign PM', prompt: 'Assign a project manager to this project' },
                            { label: 'Add Team Member', prompt: 'Add a new team member to this project' },
                            { label: 'Team Status', prompt: 'Show me the current team status and availability' },
                            { label: 'Update Status', prompt: 'Update a team member\'s status' },
                          ];
                        case 'create_po':
                          return [
                            { label: 'Create PO', prompt: 'Create a purchase order', primary: true },
                            { label: 'Log Expense', prompt: 'Can you log an expense for this project?' },
                            { label: 'Change Order', prompt: 'Create me a change order' },
                          ];
                        case 'log_expense':
                        default:
                          return [
                            { label: 'Log Expense', prompt: 'Can you log an expense for this project?', primary: true },
                            { label: 'Create PO', prompt: 'Create a purchase order' },
                            { label: 'Change Order', prompt: 'Create me a change order' },
                            { label: 'Mark Payment', prompt: 'Mark a payment as collected' },
                          ];
                      }
                    })();
                    return flowChips;
                  })().map((chip: { label: string; prompt: string; primary?: boolean }) => (
                    <TouchableOpacity
                      key={chip.label}
                      onPress={() => {
                        handleQuickAction(chip.prompt);
                      }}
                      style={[
                        styles.bottomRailChip,
                        chip.primary && styles.compactInsightChipPrimary,
                        light({ borderColor: ThemeColors.line }),
                      ]}
                    >
                      <Text
                        style={[
                          styles.bottomRailChipText,
                          chip.primary && styles.compactInsightChipTextPrimary,
                          light({ color: ThemeColors.text }),
                        ]}
                      >
                        {chip.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <View style={styles.inputRow}>
              <View style={styles.inputInnerWrapper}>
                <LinearGradient
                  colors={["rgba(45, 255, 196, 0.52)", "rgba(0, 166, 255, 0.5)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.inputInnerBorder}
                >
                  <View style={[styles.inputInner, light({ backgroundColor: ThemeColors.surface2, borderColor: ThemeColors.line, borderWidth: 1 })]}>
                    <Ionicons
                      name="chatbox-ellipses-outline"
                      size={18}
                      color={darkMode ? '#FFFFFF' : Colors.sub}
                      style={styles.inputLeadIcon}
                    />
                    {isRecording ? (
                      <View style={styles.recordingRow}>
                        <View style={styles.recordingInner}>
                          <View style={[
                            styles.recordingDot,
                            { opacity: recordingDuration % 2 === 0 ? 1 : 0.5 }
                          ]} />
                          <Text style={[styles.recordingText, light({ color: "#ef4444" })]}>
                            Recording... {recordingDuration}s
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <TextInput
                        style={[styles.input, light({ color: ThemeColors.text })]}
                        placeholder={!isContextReady ? "Syncing project data…" : (isGlobalAssistantContext || isProjectsScreenContext ? "Compare projects, check budgets, or ask anything…" : isEstimateContext ? "Ask about this estimate, line items, or margins…" : "Ask anything about this project…")}
                        placeholderTextColor={darkMode ? 'rgba(226, 232, 240, 0.42)' : '#6B7280'}
                        value={input}
                        onChangeText={setInput}
                        multiline
                        maxLength={500}
                        textAlignVertical="center"
                          onFocus={() => {
                            // Scroll to bottom when input is focused (only if user isn't manually scrolling)
                            const timeout = Platform.OS === 'ios' ? 350 : 150;
                            setTimeout(() => {
                              if (flatListRef.current && messages.length > 0 && !isUserScrollingRef.current) {
                                flatListRef.current.scrollToEnd({ animated: true });
                              }
                            }, timeout);
                          }}
                      />
                    )}
                    {/* Receipt scan button (camera → vision parse) */}
                    <TouchableOpacity
                      onPress={promptReceiptSource}
                      disabled={loading || isRecording}
                      style={styles.receiptButton}
                      accessibilityLabel="Scan a receipt"
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="camera-outline"
                        size={20}
                        color={Colors.green}
                      />
                    </TouchableOpacity>
                    {/* Microphone button */}
                    <TouchableOpacity
                      onPress={isRecording ? stopRecording : startRecording}
                      disabled={loading}
                      style={styles.micButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isRecording ? "stop-circle" : "mic"}
                        size={20}
                        color={isRecording ? "#ef4444" : Colors.green}
                      />
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>
              <Animated.View style={[styles.sendButtonWrapper, { transform: [{ scale: sendButtonScale }] }]}>
                <LinearGradient
                  colors={["rgba(45, 255, 196, 0.52)", "rgba(0, 166, 255, 0.5)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.sendButtonBorder}
                >
                  <TouchableOpacity
                    style={[styles.sendButtonInner, light({ backgroundColor: ThemeColors.surface2, borderColor: ThemeColors.line, borderWidth: 1 })]}
                    onPress={() => sendMessage()}
                    disabled={!input.trim() || loading || !isContextReady}
                    activeOpacity={0.7}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={darkMode ? "#FFFFFF" : "#000000"} />
                    ) : (
                      <Ionicons name="send" size={18} color={darkMode ? "#FFFFFF" : "#000000"} />
                    )}
                  </TouchableOpacity>
                </LinearGradient>
              </Animated.View>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>

      {/* Subcontractor Search Modal */}
      <SubcontractorSearchModal
        visible={showContractorModal}
        onClose={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowContractorModal(false);
        }}
        onSelect={handleSubcontractorSelect}
        defaultZip={zipCode}
      />
    </Modal>
  );
};

export default AIAssistantModal;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradient: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    zIndex: 10,
    backgroundColor: Colors.bg,
  },
  headerKeyboardCompact: {
    paddingTop: 6,
    paddingBottom: 6,
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
    paddingTop: 2,
    minWidth: 0,
  },
  headerContextStack: {
    width: "100%",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: 8,
  },
  headerTitleCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginLeft: 8,
    letterSpacing: 0.2,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  headerSubtitle: {
    color: "rgba(203, 213, 225, 0.96)",
    fontSize: 13,
    marginTop: 6,
    fontWeight: "600",
    letterSpacing: 0.12,
    textAlign: "center",
    lineHeight: 18,
  },
  headerMeta: {
    color: "rgba(148, 163, 184, 0.9)",
    fontSize: 11,
    marginTop: 0,
    letterSpacing: 0.2,
    textAlign: "center",
    lineHeight: 15,
    fontWeight: "500",
  },
  backButtonWrapper: {
    marginRight: 12,
    marginTop: 4,
    zIndex: 10,
    elevation: 10, // Android
  },
  backButtonBorder: {
    borderRadius: 22,
    padding: 1,
    overflow: "hidden",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 21,
    backgroundColor: '#05070A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    flex: 1,
    minHeight: 0,
  },
  messagesContainer: {
    paddingBottom: 180,
    paddingTop: 14,
    paddingHorizontal: 18,
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 6,
    paddingHorizontal: 0,
    width: "100%",
    alignSelf: "stretch",
  },
  messageBubble: {
    maxWidth: "100%",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    marginVertical: 2,
    flexShrink: 1,
  },
  userBubble: {
    backgroundColor: Colors.green,
    borderBottomRightRadius: 4,
  },
  /** ~90% of chat column — small side margins like Project AI (not edge-to-edge, not a skinny column) */
  assistantBubbleWrapper: {
    alignSelf: "flex-start",
    width: "90%",
    maxWidth: "90%",
    minWidth: 0,
    marginVertical: 4,
  },
  assistantBubbleBorder: {
    width: "100%",
    alignSelf: "stretch",
    borderRadius: 20,
    padding: 1,
    overflow: "hidden",
    borderBottomLeftRadius: 6,
  },
  assistantBubble: {
    width: "100%",
    backgroundColor: "#040608",
    borderBottomLeftRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexShrink: 1,
  },
  assistantLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  assistantLabelText: {
    color: "#8CF5CB",
    fontSize: 10,
    marginLeft: 5,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  messageText: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 23,
    flexWrap: "wrap",
    letterSpacing: 0.1,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  formattedContent: {
    gap: 0,
    width: "100%",
    alignSelf: "stretch",
  },
  userMessageContainer: {
    alignItems: "flex-end",
    maxWidth: "82%",
  },
  messageTimestamp: {
    fontSize: 11,
    color: Colors.sub,
    marginTop: 4,
    marginHorizontal: 4,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  assistantTimestamp: {
    marginLeft: 0,
  },
  typingIndicatorContainer: {
    marginVertical: 6,
    paddingHorizontal: 0,
  },
  typingBubble: {
    minHeight: 50,
  },
  typingDots: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.green,
    opacity: 0.6,
  },
  messageHeading: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 8,
    marginBottom: 12,
    letterSpacing: 0.12,
  },
  messageBold: {
    color: Colors.text,
    fontWeight: "800",
  },
  messageItalic: {
    color: "#C7D4E8",
    fontStyle: "italic",
  },
  messageListItem: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 23,
    flex: 1,
    letterSpacing: 0.1,
  },
  messageBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  messageBullet: {
    color: "#89F4CE",
    fontSize: 16,
    lineHeight: 22,
    width: 16,
    marginTop: 1,
    fontWeight: "700",
  },
  messageNumberRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  messageNumberIndex: {
    width: 24,
    color: Colors.sub,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
  },
  messageMetaBlock: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(141, 160, 184, 0.14)",
  },
  messageMetaText: {
    color: Colors.sub,
    fontSize: 11.5,
    lineHeight: 17,
    opacity: 1,
    marginBottom: 3,
  },
  messageCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 2,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(141, 160, 184, 0.12)",
  },
  messageCalloutIcon: {
    color: "#A7F3D0",
    fontSize: 14,
    lineHeight: 20,
    marginRight: 8,
  },
  messageCalloutText: {
    flex: 1,
    color: "#D9E4F1",
    fontSize: 14,
    lineHeight: 21,
  },
  messageSectionHeaderWrap: {
    marginTop: 6,
    marginBottom: 6,
  },
  /** Fallback for legacy ALL-CAPS one-line labels; prefer `**Bold label**` in reply text for body-sized type. */
  messageSectionHeader: {
    color: "#E2E8F0",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.15,
    textTransform: "none",
  },
  messageSectionBanner: {
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(141, 160, 184, 0.12)",
  },
  messageSectionBannerText: {
    color: "#EAF2FF",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
  messageMetricRow: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(141, 160, 184, 0.08)",
  },
  messageMetricLabel: {
    color: "#F8FAFC",
    fontWeight: "800",
  },
  messageMetricValue: {
    color: "#D7E3F4",
  },
  messageSpacer: {
    height: 8,
  },
  pdfAttachmentWrapper: {
    marginTop: 12,
  },
  pdfAttachmentBorder: {
    borderRadius: 8,
    padding: 1,
    overflow: "hidden",
  },
  pdfAttachment: {
    padding: 10,
    backgroundColor: "#000000",
    borderRadius: 7,
    flexDirection: "row",
    alignItems: "center",
  },
  pdfAttachmentText: {
    fontWeight: "700",
    fontSize: 13,
  },
  pdfAttachmentSubtext: {
    color: Colors.sub,
    fontSize: 11,
    marginTop: 2,
  },
  quickActionsContainer: {
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  quickActionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.04)",
    marginHorizontal: 4,
  },
  quickActionText: {
    color: "#E5E7EB",
    fontSize: 12,
  },
  compactInsightChip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(45, 255, 196, 0.22)",
    backgroundColor: "rgba(45, 255, 196, 0.07)",
  },
  compactInsightChipPrimary: {
    borderColor: "rgba(45, 255, 196, 0.45)",
    backgroundColor: "rgba(45, 255, 196, 0.14)",
  },
  compactInsightChipText: {
    color: "rgba(45, 255, 196, 0.9)",
    fontSize: 12,
    fontWeight: "600",
  },
  compactInsightChipTextPrimary: {
    color: "#A7F3D0",
    fontWeight: "700",
  },
  inputContainer: {
    flexDirection: "column",
    alignItems: "flex-end",
    paddingHorizontal: 18,
    backgroundColor: "rgba(0,0,0,0.96)",
    gap: 10,
    width: "100%",
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.055)",
  },
  inputRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  inputInnerWrapper: {
    flex: 1,
  },
  inputInnerBorder: {
    flex: 1,
    borderRadius: 24,
    padding: 1,
    overflow: "hidden",
  },
  inputInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 23,
    backgroundColor: "#05070A",
    minHeight: 52,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  inputLeadIcon: {
    marginLeft: 16,
    marginRight: 10,
    opacity: 0.88,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    paddingRight: 10,
    paddingVertical: 0,
    maxHeight: 100,
    lineHeight: 21,
  },
  recordingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  recordingInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  recordingText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  micButton: {
    padding: 10,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptButton: {
    padding: 10,
    marginRight: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonWrapper: {
    marginLeft: 0,
  },
  sendButtonBorder: {
    borderRadius: 26,
    padding: 1,
    overflow: "hidden",
    width: 52,
    height: 52,
  },
  sendButtonInner: {
    width: "100%",
    height: "100%",
    backgroundColor: "#05070A",
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  greetingWrapper: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 26,
    paddingHorizontal: 10,
    backgroundColor: Colors.bg,
  },
  greetingIconCircleWrapper: {
    marginBottom: 14,
  },
  greetingIconCircleBorder: {
    borderRadius: 32,
    padding: 1,
    overflow: "hidden",
  },
  greetingIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 31,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  greetingTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 10,
    letterSpacing: -0.2,
    maxWidth: 340,
  },
  greetingSubtitle: {
    color: "rgba(186, 198, 215, 0.96)",
    fontSize: 14,
    lineHeight: 23,
    textAlign: "center",
    marginTop: 2,
    maxWidth: 340,
  },
  greetingHighlight: {
    fontWeight: "700",
    color: Colors.text,
  },
  todayBriefCard: {
    marginHorizontal: 0,
    marginTop: 12,
    marginBottom: 20,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: "rgba(16, 242, 151, 0.11)",
    shadowColor: "rgba(0, 100, 90, 0.16)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 7,
  },
  estimateCopilotOuter: {
    alignSelf: "stretch",
    marginTop: 2,
  },
  estimateCopilotCard: {
    marginTop: 6,
    marginBottom: 16,
  },
  estimateFooterHelperWrap: {
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  estimateFooterHelperText: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(186, 198, 215, 0.94)",
  },
  todayBriefGradient: {
    padding: 22,
    borderRadius: 21,
  },
  todayBriefCardTitle: {
    color: "rgba(148, 163, 184, 0.92)",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.05,
    marginBottom: 10,
  },
  todayBriefGreeting: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  todayBriefSubGreeting: {
    color: "rgba(186, 198, 215, 0.94)",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  todayBriefInsights: {
    marginBottom: 8,
    gap: 10,
  },
  todayBriefInsightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  todayBriefInsightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    backgroundColor: "rgba(132, 255, 210, 0.95)",
  },
  todayBriefInsightItem: {
    color: Colors.text,
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  todayBriefEmptyInsight: {
    fontStyle: "italic",
    color: "rgba(148, 163, 184, 0.88)",
  },
  todayBriefSectionLabel: {
    color: Colors.sub,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 6,
  },
  commandCenterSectionRail: {
    color: "rgba(226, 232, 240, 0.74)",
    letterSpacing: 1.1,
  },
  todayBriefActionChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(45, 255, 196, 0.3)",
    marginBottom: 6,
  },
  todayBriefActionText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  /** No maxHeight — a tight cap clips chip labels (descenders) on iOS/Android. */
  todayBriefChipsScroll: {
    marginBottom: 6,
    flexGrow: 0,
  },
  todayBriefChipsContent: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingVertical: 4,
    paddingRight: 4,
  },
  todayBriefQuickChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingBottom: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(45, 255, 196, 0.36)",
    backgroundColor: "rgba(45, 255, 196, 0.06)",
  },
  todayBriefQuickChipText: {
    color: "#2DFFC4",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
  },
  todayBriefFollowChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.045)",
  },
  todayBriefFollowChipText: {
    color: "rgba(241, 245, 249, 0.96)",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
  },
  allClearCard: {
    marginHorizontal: 0,
    marginTop: 8,
    marginBottom: 10,
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(34, 197, 94, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.16)",
  },
  allClearTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  allClearSubtitle: {
    color: Colors.sub,
    fontSize: 12,
    marginTop: 2,
  },
  biggestRiskCard: {
    marginHorizontal: 0,
    marginTop: 8,
    marginBottom: 10,
    borderRadius: 20,
    padding: 18,
    backgroundColor: "rgba(251, 146, 60, 0.055)",
    borderWidth: 1,
    borderColor: "rgba(251, 146, 60, 0.22)",
  },
  biggestRiskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  biggestRiskTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.25,
  },
  biggestRiskMessage: {
    color: "rgba(248, 250, 252, 0.98)",
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  biggestRiskDetail: {
    color: "rgba(186, 198, 215, 0.92)",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  biggestRiskButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(251, 146, 60, 0.38)",
    backgroundColor: "rgba(251, 146, 60, 0.07)",
  },
  biggestRiskButtonText: {
    color: "#FB923C",
    fontSize: 13,
    fontWeight: "600",
  },
  recentSummaryContainer: {
    width: "100%",
    marginTop: 12,
    marginBottom: 2,
  },
  recentSummaryBorder: {
    borderRadius: 14,
    padding: 1,
    overflow: "hidden",
  },
  recentSummaryInner: {
    backgroundColor: Colors.card,
    borderRadius: 13,
    padding: 12,
  },
  recentSummaryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recentSummaryTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  recentSummaryMeta: {
    color: Colors.sub,
    fontSize: 12,
    marginTop: 2,
  },
  recentSummaryPreview: {
    color: Colors.sub,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  recentSummaryBody: {
    marginTop: 8,
  },
  recentSummaryActionsRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  recentSummaryAction: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(45, 255, 196, 0.35)",
    backgroundColor: "rgba(45, 255, 196, 0.08)",
  },
  recentSummaryActionText: {
    color: "#A7F3D0",
    fontSize: 12,
    fontWeight: "700",
  },
  primaryActions: {
    marginTop: 20,
    width: "100%",
    gap: 12,
  },
  primaryButtonWrapper: {
    width: "100%",
  },
  primaryButtonBorder: {
    borderRadius: 22,
    padding: 1,
    overflow: "hidden",
  },
  primaryButton: {
    borderRadius: 17,
    backgroundColor: "#000000",
    overflow: "hidden",
  },
  primaryButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: "#05070A",
    borderRadius: 21,
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  projectStripContainer: {
    marginTop: 8,
    marginBottom: 20,
  },
  projectStripBorder: {
    borderRadius: 22,
    padding: 1,
    overflow: "hidden",
  },
  projectStrip: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 21,
    backgroundColor: "#05070A",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  projectEyebrow: {
    color: "rgba(148, 163, 184, 0.9)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 5,
    fontWeight: "700",
  },
  projectTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  projectSubtitle: {
    marginTop: 4,
    color: "rgba(165, 180, 198, 0.95)",
    fontSize: 13,
    lineHeight: 18,
  },
  projectRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  marginBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(22,163,74,0.2)",
    borderWidth: 1,
    borderColor: "rgba(134, 239, 172, 0.16)",
  },
  marginBadgeLabel: {
    color: "rgba(209,250,229,0.8)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  marginBadgeValue: {
    color: "#BBF7D0",
    fontSize: 15,
    fontWeight: "800",
  },
  aiWatchingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  aiWatchingText: {
    color: "#BBF7D0",
    fontSize: 11,
    fontWeight: "600",
  },
  footerSuggestionsWrap: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
  },
  footerSuggestionsContent: {
    gap: 10,
    paddingRight: 4,
  },
  footerSuggestionChip: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.048)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
  },
  footerSuggestionChipText: {
    fontSize: 12,
    color: "rgba(214, 237, 226, 0.96)",
    fontWeight: "600",
  },
  bottomRailSection: {
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  bottomRailScroll: {
    marginTop: 6,
    maxHeight: 44,
  },
  bottomRailContent: {
    gap: 10,
    alignItems: 'center',
    flexDirection: 'row',
    paddingBottom: 4,
    paddingRight: 2,
  },
  bottomRailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.042)",
    borderWidth: 1,
    borderColor: "rgba(45, 255, 196, 0.22)",
  },
  bottomRailChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(190, 239, 216, 0.98)',
    letterSpacing: 0.06,
  },
  managerCardContainer: {
    marginTop: 16,
    marginBottom: 14,
  },
  managerCardBorder: {
    borderRadius: 24,
    padding: 1,
    overflow: "hidden",
  },
  managerCard: {
    paddingHorizontal: 20,
    paddingTop: 17,
    paddingBottom: 16,
    borderRadius: 23,
    backgroundColor: "#05070A",
  },
  managerHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  managerToggleWrapper: {
    padding: 4,
    marginTop: 2,
    marginLeft: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "transparent",
  },
  managerEyebrow: {
    color: "rgba(148, 163, 184, 0.9)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    fontWeight: "700",
  },
  managerTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  managerSubtitle: {
    color: "rgba(186, 198, 215, 0.94)",
    fontSize: 14,
    lineHeight: 21,
  },
  managerChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    columnGap: 8,
    rowGap: 8,
  },
  managerChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(21,128,61,0.2)",
    borderWidth: 1,
    borderColor: "rgba(134, 239, 172, 0.12)",
  },
  managerChipText: {
    color: "#BBF7D0",
    fontSize: 12,
    fontWeight: "700",
  },
  managerMicrocopy: {
    color: "rgba(160, 174, 192, 0.82)",
    fontSize: 11.5,
    marginTop: 12,
    paddingHorizontal: 2,
    lineHeight: 17,
  },
  estimateCopilotActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    rowGap: 10,
    columnGap: 10,
    marginTop: 16,
    alignItems: "center",
    width: "100%",
  },
  estimateCopilotPrimaryOnBrief: {
    alignSelf: "flex-start",
    backgroundColor: "#22c55e",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  estimateCopilotPrimaryOnBriefText: {
    color: "#04110b",
    fontSize: 13,
    fontWeight: "700",
  },
  estimateCopilotSecondaryOnBrief: {
    alignSelf: "flex-start",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(45, 255, 196, 0.28)",
    backgroundColor: "rgba(0, 0, 0, 0.14)",
    minHeight: 44,
    justifyContent: "center",
  },
  estimateCopilotSecondaryOnBriefText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
});
