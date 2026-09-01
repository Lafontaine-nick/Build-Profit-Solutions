import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';
import { formatMoneyUSD } from '../utils/formatters';
import {
  splitEventNotesForDisplay,
  extractUsdAmountKeyFromTitle,
} from '../utils/calendarEventDisplay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import GreyCalendar from './GreyCalendar';
import {
  CalendarUpcomingFooter,
  UPCOMING_CALENDAR_WINDOW_DAYS,
} from './CalendarUpcomingFooter';
import { isDesktopWebLayoutWidth, DASHBOARD_WEB_MAX_CONTENT_WIDTH } from '@/constants/ScreenLayout';
import { businessWorkspaceService } from '@/services/businessWorkspaceService';
import { mergeArrayResource } from '@/utils/workspaceResourceMerge';
import { useWorkspaceProjectPermissions } from '@/hooks/useWorkspaceProjectPermissions';

export type CalendarEvent = {
  id: string;
  title: string;
  date: string; // ISO date string (YYYY-MM-DD)
  projectId?: string;
  projectName?: string;
  time?: string; // HH:MM format
  type: 'inspection' | 'delivery' | 'work' | 'payment' | 'deadline' | 'other';
  notes?: string;
  subcontractor?: string;
  attachments?: string[];
  reminderMinutes?: number; // Minutes before event to remind
  completed?: boolean;
  completedAt?: string;
  inspectionResult?: 'passed' | 'failed'; // For inspection events
  deliveryReceived?: boolean; // For delivery events — true when marked as received
  linkedMilestoneId?: string; // Link to timeline milestone
  isUserCreated?: boolean;
  isCompletedProject?: boolean;
  calendarCategory?:
    | 'payment'
    | 'inspection'
    | 'phase'
    | 'delivery'
    | 'purchase_order'
    | 'deadline'
    | 'other';
  createdAt: string;
  updatedAt: string;
};

type ProjectCalendarProps = {
  projectId: string;
  projectName?: string;
  milestones?: any[]; // For linking events to milestones
  onEventComplete?: (event: CalendarEvent) => void; // Callback when event is marked complete
  projectData?: any; // Full project data for syncing payments, POs, etc.
  /**
   * Project detail: flush under AI PM row (no extra top inset). Render without parent `wideContainer`
   * so width matches dashboard calendar (`ScreenLayout.edge.horizontal` via scroll padding).
   */
  embedded?: boolean;
};

const EVENT_TYPE_COLORS: Record<CalendarEvent['type'], string> = {
  inspection: '#f59e0b', // yellow
  delivery: '#8b5cf6', // purple
  work: '#3b82f6', // blue
  payment: '#22c55e', // green
  deadline: '#ef4444', // red
  other: '#f97316', // orange (for important notes)
};
/** Vibrant green for selected states - matches calendar tab, Today button, Add Event button */
const ACCENT_GREEN = '#19E180';

const EVENT_TYPE_ICONS: Record<CalendarEvent['type'], string> = {
  inspection: 'clipboard-check',
  delivery: 'truck',
  work: 'hammer',
  payment: 'attach-money',
  deadline: 'event-busy',
  other: 'alert-circle',
};

/** Sleek Feather icons for the New Event type chips */
const EVENT_TYPE_FORM_ICONS: Record<CalendarEvent['type'], keyof typeof Feather.glyphMap> = {
  inspection: 'check-circle',
  delivery: 'package',
  work: 'tool',
  payment: 'credit-card',
  deadline: 'clock',
  other: 'file-text',
};

const CALENDAR_CATEGORY_COLORS = {
  payment: '#22c55e',
  inspection: '#f59e0b',
  phase: '#3b82f6',
  delivery: '#8b5cf6',
  purchase_order: '#2dd4bf',
  deadline: '#ef4444',
  other: '#f97316',
} as const;

const CALENDAR_CATEGORY_ICONS = {
  payment: 'attach-money',
  inspection: 'fact-check',
  phase: 'construction',
  delivery: 'local-shipping',
  purchase_order: 'receipt',
  deadline: 'event-busy',
  other: 'description',
} as const;

/** Human-readable badge label for calendar categories */
function formatCalendarCategoryLabel(
  cat: NonNullable<CalendarEvent['calendarCategory']> | undefined
): string | null {
  if (!cat) return null;
  if (cat === 'purchase_order') return 'Purchase order';
  if (cat === 'phase') return 'Crew';
  if (cat === 'other') return 'Other';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

const toLocalISODate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function parseISODateAsLocalDay(iso: string): Date {
  const dayPart = (iso || '').split('T')[0];
  const parts = dayPart.split('-').map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return new Date(NaN);
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

const CALENDAR_LEGEND_ITEMS = [
  { key: 'payment', label: 'Payments', color: CALENDAR_CATEGORY_COLORS.payment },
  { key: 'inspection', label: 'Inspections', color: CALENDAR_CATEGORY_COLORS.inspection },
  { key: 'phase', label: 'Crew', color: CALENDAR_CATEGORY_COLORS.phase },
  { key: 'delivery', label: 'Deliveries', color: CALENDAR_CATEGORY_COLORS.delivery },
  { key: 'purchase_order', label: 'PO', color: CALENDAR_CATEGORY_COLORS.purchase_order },
  { key: 'deadline', label: 'Deadlines', color: CALENDAR_CATEGORY_COLORS.deadline },
  { key: 'other', label: 'Other', color: CALENDAR_CATEGORY_COLORS.other },
] as const;

const PAYMENT_KEYWORDS = ['payment', 'deposit', 'milestone', 'weekly pay', 'draw'];
const INSPECTION_KEYWORDS = ['inspection', 'inspect'];
const PHASE_KEYWORDS = ['concrete', 'framing', 'drywall', 'electrical', 'plumbing', 'roof', 'foundation', 'demo', 'paint', 'phase', 'install', 'installation', 'start'];
/** PO-specific phrases (checked before generic delivery keywords) */
const PO_KEYWORDS = ['purchase order', 'po ', 'p.o.', 'p.o ', ' po ', 'po#', 'po #', 'p.o#'];
const DELIVERY_KEYWORDS = ['delivery', 'deliver', 'pickup', 'pick up', 'lumber', 'cabinet', 'tile', 'material'];
const DEADLINE_KEYWORDS = ['deadline', 'due', 'permit', 'completion', 'complete by', 'final', 'project completion', 'framing completion'];
const NOISE_KEYWORDS = ['daily log', 'receipt', 'checklist', 'internal reminder', 'small task', 'note only', 'todo'];

export default function ProjectCalendar({
  projectId,
  projectName = 'Project',
  milestones = [],
  onEventComplete,
  projectData,
  embedded = false,
}: ProjectCalendarProps) {
  const { theme, darkMode } = useTheme();
  const { canEditCalendar } = useWorkspaceProjectPermissions();
  const TC = useMemo(() => getColors(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { width: layoutWidth } = useWindowDimensions();
  /** Desktop web: cap calendar modals + New/Edit Event to same column as dashboard / date sheet */
  const calendarDesktopWeb =
    Platform.OS === 'web' && isDesktopWebLayoutWidth(layoutWidth);
  const COLORS = useMemo(
    () =>
      darkMode
        ? {
            bg: '#000000',
            surface: '#0f172a',
            surface2: '#1e293b',
            text: '#f1f5f9',
            subtext: '#94a3b8',
            border: '#334155',
            green: '#22c55e',
            blue: '#22d3ee',
            red: '#ef4444',
            amber: '#f59e0b',
            purple: '#8b5cf6',
          }
        : {
            bg: TC.bg,
            surface: TC.surface,
            surface2: TC.surface2,
            text: TC.text,
            subtext: TC.sub,
            border: TC.line,
            green: '#22c55e',
            blue: '#22d3ee',
            red: '#ef4444',
            amber: '#f59e0b',
            purple: '#8b5cf6',
          },
    [darkMode, TC],
  );

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [deliveryReceivedIds, setDeliveryReceivedIds] = useState<Set<string>>(new Set());
  const [timelineMilestones, setTimelineMilestones] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => toLocalISODate());
  const [showEventModal, setShowEventModal] = useState(false);
  const [showDateEventsModal, setShowDateEventsModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventType, setEventType] = useState<CalendarEvent['type']>('work');
  const [eventNotes, setEventNotes] = useState('');
  const [eventSubcontractor, setEventSubcontractor] = useState('');
  const [eventReminderMinutes, setEventReminderMinutes] = useState<number | undefined>(undefined);

  // Load events from AsyncStorage
  const loadEvents = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const key = `calendar_events_${projectId}`;
      const saved = await AsyncStorage.getItem(key);
      const parsed = saved ? JSON.parse(saved) : [];
      const localEvents = Array.isArray(parsed) ? parsed : [];
      const sharedResult = await businessWorkspaceService.getProjectResources(projectId).catch(() => null);
      const sharedResource = sharedResult?.success ? sharedResult.data?.resources?.calendarEvents : undefined;
      const sharedEvents = Array.isArray(sharedResource?.payload)
        ? (sharedResource.payload as CalendarEvent[])
        : [];
      const mergedEvents = await mergeArrayResource(
        projectId,
        'calendarEvents',
        localEvents,
        sharedEvents,
        sharedResource?.updatedAt,
        ['id']
      );
      if (sharedEvents.length > 0) {
        await AsyncStorage.setItem(key, JSON.stringify(mergedEvents));
      }
      setEvents(mergedEvents);
    } catch (error) {
      console.error('❌ Error loading calendar events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Save events to AsyncStorage
  const saveEvents = useCallback(async (newEvents: CalendarEvent[]) => {
    if (!projectId) return;
    try {
      const key = `calendar_events_${projectId}`;
      await AsyncStorage.setItem(key, JSON.stringify(newEvents));
      businessWorkspaceService
        .pushProjectResource(projectId, 'calendarEvents', newEvents)
        .catch((error) => console.warn('Business workspace calendar sync failed:', error));
      setEvents(newEvents);
    } catch (error) {
      console.error('❌ Error saving calendar events:', error);
      Alert.alert('Error', 'Failed to save calendar event');
    }
  }, [projectId]);

  // Load events on mount
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Load delivery received ids (for synced timeline/PO events user marked as received)
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(`delivery_received_${projectId}`);
        const arr = raw ? JSON.parse(raw) : [];
        setDeliveryReceivedIds(new Set(Array.isArray(arr) ? arr : []));
      } catch {
        setDeliveryReceivedIds(new Set());
      }
    })();
  }, [projectId]);


  // Load timeline milestones
  const loadTimelineMilestones = useCallback(async () => {
    try {
      const timelineKey = `bps.timeline.v2.${projectId}`;
      const saved = await AsyncStorage.getItem(timelineKey);
      if (saved) {
        const timelineItems = JSON.parse(saved);
        setTimelineMilestones(Array.isArray(timelineItems) ? timelineItems : []);
      } else {
        setTimelineMilestones([]);
      }
    } catch (error) {
      console.error('Error loading timeline milestones:', error);
      setTimelineMilestones([]);
    }
  }, [projectId]);

  useEffect(() => {
    loadTimelineMilestones();
  }, [loadTimelineMilestones]);

  // Refresh data when calendar tab is focused
  useFocusEffect(
    useCallback(() => {
      loadEvents();
      loadTimelineMilestones();
    }, [loadEvents, loadTimelineMilestones])
  );

  const includesAny = (value: string, keywords: readonly string[]) =>
    keywords.some((k) => value.includes(k));

  const toISODate = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === 'string') return value.split('T')[0];
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  };

  const categoryToType = (
    category: NonNullable<CalendarEvent['calendarCategory']>
  ): CalendarEvent['type'] => {
    switch (category) {
      case 'payment':
        return 'other';
      case 'inspection':
        return 'inspection';
      case 'phase':
        return 'work';
      case 'delivery':
      case 'purchase_order':
        return 'delivery';
      case 'deadline':
        return 'other';
      case 'other':
        return 'other';
    }
  };

  const inferUserEventCategory = useCallback((event: CalendarEvent): CalendarEvent['calendarCategory'] => {
    const text = `${event.title || ''} ${event.notes || ''}`.toLowerCase();
    if (includesAny(text, PAYMENT_KEYWORDS) || event.type === 'payment') return 'payment';
    if (includesAny(text, INSPECTION_KEYWORDS) || event.type === 'inspection') return 'inspection';
    if (includesAny(text, PO_KEYWORDS)) return 'purchase_order';
    if (event.type === 'delivery' || includesAny(text, DELIVERY_KEYWORDS)) return 'delivery';
    if (includesAny(text, DEADLINE_KEYWORDS) || event.type === 'deadline') return 'deadline';
    if (includesAny(text, PHASE_KEYWORDS) || event.type === 'work') return 'phase';
    return 'other';
  }, []);

  // Calendar: payments, inspections, crew, deliveries, POs, deadlines, and uncategorized "other".
  const syncedEvents = useMemo(() => {
    const nowIso = new Date().toISOString();
    const result: CalendarEvent[] = [];
    const seen = new Set<string>();

    const pushUnique = (event: CalendarEvent) => {
      const key = `${event.calendarCategory || 'other'}|${event.date}|${event.title}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push(event);
    };

    // User-entered events — include every saved event (noise still skipped)
    events.forEach((event) => {
      const text = `${event.title || ''} ${event.notes || ''}`.toLowerCase();
      if (includesAny(text, NOISE_KEYWORDS)) return;
      const category = inferUserEventCategory(event);
      pushUnique({ ...event, calendarCategory: category });
    });

    // Timeline milestones first — source of truth for completion (inspection, phase, payment/deposit, etc.)
    timelineMilestones.forEach((item: any) => {
      const date = toISODate(item.scheduledDate || item.dueDate || item.date || item.plannedDate);
      if (!date) return;
      const text = `${item.title || item.name || ''} ${item.description || ''}`.toLowerCase();
      if (includesAny(text, NOISE_KEYWORDS)) return;

      let category: CalendarEvent['calendarCategory'];
      const amount = Number(item.amount || item.paymentAmount || 0);
      if (amount > 0 || includesAny(text, PAYMENT_KEYWORDS)) category = 'payment';
      else if (includesAny(text, INSPECTION_KEYWORDS)) category = 'inspection';
      else if (includesAny(text, PO_KEYWORDS)) category = 'purchase_order';
      else if (includesAny(text, DELIVERY_KEYWORDS)) category = 'delivery';
      else if (includesAny(text, DEADLINE_KEYWORDS)) category = 'deadline';
      else if (includesAny(text, PHASE_KEYWORDS)) category = 'phase';
      else category = 'other';

      pushUnique({
        id: `timeline-${item.id || `${date}-${item.title || item.name || 'milestone'}`}`,
        title:
          category === 'payment'
            ? `${item.title || item.name || 'Payment'}${amount > 0 ? `: ${formatMoneyUSD(amount)}` : ''}`
            : (item.title || item.name || 'Milestone'),
        date,
        type: categoryToType(category),
        calendarCategory: category,
        notes: item.description,
        completed: item.status === 'completed' || Number(item.progressPct || 0) >= 100,
        createdAt: item.createdAt || nowIso,
        updatedAt: item.updatedAt || nowIso,
      });
    });

    // Set of date|amount for payments already added by timeline (avoid duplicate deposit from estimate with different title)
    const timelinePaymentKeys = new Set<string>();
    result.forEach((e) => {
      if (e.calendarCategory !== 'payment') return;
      const amount = extractUsdAmountKeyFromTitle(e.title);
      timelinePaymentKeys.add(`${e.date}|${amount}`);
    });

    // Payments from estimate/project data (only if not already added by timeline)
    const paymentMilestones: any[] = [];
    if (projectData?.milestones?.length) paymentMilestones.push(...projectData.milestones);
    if (milestones?.length) paymentMilestones.push(...milestones);
    if (projectData?.weeklyPayments?.length) {
      projectData.weeklyPayments.forEach((w: any, i: number) => {
        paymentMilestones.push({
          id: w.id || `week-${i}`,
          name: w.description || `Week ${w.weekNumber || i + 1} Payment`,
          amount: w.amount || 0,
          scheduledDate: w.scheduledDate,
          dueDate: w.scheduledDate,
          status: w.status || 'pending',
        });
      });
    }
    if ((projectData as any)?.estimateData?.paymentMilestones?.length) {
      paymentMilestones.push(...(projectData as any).estimateData.paymentMilestones);
    }
    if ((projectData as any)?.estimateData?.weeklyPayments?.length) {
      (projectData as any).estimateData.weeklyPayments.forEach((w: any, i: number) => {
        paymentMilestones.push({
          id: w.id || `week-${i}`,
          name: w.description || `Week ${w.weekNumber || i + 1} Payment`,
          amount: w.amount || 0,
          scheduledDate: w.scheduledDate,
          dueDate: w.scheduledDate,
          status: w.status || 'pending',
        });
      });
    }
    paymentMilestones.forEach((m: any) => {
      const date = toISODate(m.scheduledDate || m.dueDate || m.dateISO || m.date || m.plannedDate);
      if (!date) return;
      const amount = Number(m.paymentAmount || m.amount || 0);
      const amountStr = String(amount);
      if (timelinePaymentKeys.has(`${date}|${amountStr}`)) return; // timeline already has this payment — keep its completion state
      // Only treat as completed when status is explicitly completed/paid (timeline is source of truth when present; this is fallback for estimate-only payments)
      const isCollected = m.status === 'completed' || m.status === 'paid';
      pushUnique({
        id: `payment-${m.id || `${date}-${amount}`}`,
        title: `${m.name || m.title || 'Payment'}${amount > 0 ? `: ${formatMoneyUSD(amount)}` : ''}`,
        date,
        type: 'other',
        calendarCategory: 'payment',
        notes: isCollected ? 'Payment collected' : 'Payment due',
        completed: Boolean(isCollected),
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    });

    // Deliveries from POs
    if (projectData?.purchaseOrders?.length) {
      projectData.purchaseOrders.forEach((po: any) => {
        const date = toISODate(po.expectedDelivery);
        if (!date) return;
        const isReceived = po.status === 'Received';
        pushUnique({
          id: `po-${po.id || `${po.poNumber || 'po'}-${date}`}`,
          title: `PO: ${po.vendor || 'Vendor'}${po.category ? ` - ${po.category}` : ''}`,
          date,
          type: 'delivery',
          calendarCategory: 'purchase_order',
          notes: po.description || po.notes || (po.poNumber ? `PO ${po.poNumber}` : undefined),
          completed: isReceived,
          deliveryReceived: isReceived,
          createdAt: po.orderDate || nowIso,
          updatedAt: nowIso,
        });
      });
    }

    // Project end date deadline
    const projectEndDate = toISODate(projectData?.endISO || projectData?.endDate);
    if (projectEndDate) {
      pushUnique({
        id: `project-deadline-${projectId}`,
        title: 'Project completion deadline',
        date: projectEndDate,
        type: 'other',
        calendarCategory: 'deadline',
        notes: projectName ? `${projectName} target completion` : 'Project target completion',
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    // Payment completion: timeline is the ONLY source of truth. Never show completed unless explicitly confirmed.
    const timelinePaymentInfo: Array<{ date: string; amount: string; completed: boolean }> = [];
    const addPaymentInfo = (item: any) => {
      const date = toISODate(item.scheduledDate || item.dueDate || item.date || item.plannedDate);
      if (!date) return;
      const amount = Number(item.amount || item.paymentAmount || 0);
      const text = `${(item.title || item.name || '')} ${(item.description || '')}`.toLowerCase();
      if (amount > 0 || includesAny(text, PAYMENT_KEYWORDS)) {
        const completed = item.status === 'completed' || Number(item.progressPct || 0) >= 100;
        timelinePaymentInfo.push({ date, amount: String(amount), completed });
      }
    };
    timelineMilestones.forEach(addPaymentInfo);
    // When timeline storage is empty, use projectData for matching keys but NEVER trust projectData for completion.
    // projectData/estimate can have status "completed" from backend while the real timeline (user's view) shows Pending.
    if (timelinePaymentInfo.length === 0) {
      const fallbackPayments: any[] = [];
      if (projectData?.milestones?.length) fallbackPayments.push(...projectData.milestones);
      if ((projectData as any)?.estimateData?.paymentMilestones?.length) {
        fallbackPayments.push(...(projectData as any).estimateData.paymentMilestones);
      }
      if ((projectData as any)?.estimateData?.weeklyPayments?.length) {
        (projectData as any).estimateData.weeklyPayments.forEach((w: any, i: number) => {
          fallbackPayments.push({
            title: w.description || `Week ${w.weekNumber ?? i + 1} Payment`,
            amount: w.amount || 0,
            scheduledDate: w.scheduledDate,
            dueDate: w.scheduledDate,
          });
        });
      }
      fallbackPayments.forEach((item: any) => {
        const date = toISODate(item.scheduledDate || item.dueDate || item.date || item.plannedDate);
        if (!date) return;
        const amount = Number(item.amount || item.paymentAmount || 0);
        const text = `${(item.title || item.name || '')} ${(item.description || '')}`.toLowerCase();
        if (amount > 0 || includesAny(text, PAYMENT_KEYWORDS)) {
          timelinePaymentInfo.push({ date, amount: String(amount), completed: false });
        }
      });
    }
    result.forEach((e) => {
      if (e.calendarCategory !== 'payment') return;
      const amountStr = extractUsdAmountKeyFromTitle(e.title);
      const eventDate = new Date(e.date + 'T12:00:00').getTime();
      const match = timelinePaymentInfo.find((t) => {
        const amtMatch = String(t.amount).replace(/[$,]/g, '') === amountStr || Number(t.amount) === Number(amountStr);
        if (!amtMatch) return false;
        const tDate = new Date(t.date + 'T12:00:00').getTime();
        const dayMs = 24 * 60 * 60 * 1000;
        return Math.abs(eventDate - tDate) <= dayMs;
      });
      e.completed = match ? match.completed : false;
    });

    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events, milestones, projectData, projectId, projectName, timelineMilestones, inferUserEventCategory]);

  // Get events for a specific date
  const getEventsForDate = useCallback((dateStr: string): CalendarEvent[] => {
    return syncedEvents.filter(event => event.date === dateStr);
  }, [syncedEvents]);

  // Handle date selection
  const handleDatePress = (dateString: string) => {
    setSelectedDate(dateString);
    setEventDate(dateString);
    
    // Check if there are events on this date
    const eventsOnDate = getEventsForDate(dateString);
    
    if (eventsOnDate.length > 0) {
      // Show events modal if there are events
      setShowDateEventsModal(true);
    } else if (canEditCalendar) {
      // Show new event modal if no events
      setShowEventModal(true);
      setEditingEvent(null);
      resetForm();
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Handle event press
  const handleEventPress = (event: CalendarEvent) => {
    if (!canEditCalendar) {
      setSelectedDate(event.date);
      setShowDateEventsModal(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    setEditingEvent(event);
    setEventTitle(event.title);
    setEventDate(event.date);
    setEventTime(event.time || '');
    setEventType(event.type);
    setEventNotes(event.notes || '');
    setEventSubcontractor(event.subcontractor || '');
    setEventReminderMinutes(event.reminderMinutes);
    setShowEventModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Reset form
  const resetForm = () => {
    setEventTitle('');
    setEventTime('');
    setEventType('work');
    setEventNotes('');
    setEventSubcontractor('');
    setEventReminderMinutes(undefined);
  };

  // Save event
  const handleSaveEvent = async () => {
    if (!eventTitle.trim() || !eventDate) {
      Alert.alert('Required Fields', 'Please enter a title and date');
      return;
    }

    // Ensure date is in YYYY-MM-DD format
    let dateToSave = eventDate;
    const parts = eventDate.split('-');
    if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 2) {
      // Convert MM-DD-YY to YYYY-MM-DD
      const [month, day, yy] = parts;
      const year = `20${yy}`;
      dateToSave = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const now = new Date().toISOString();
    const newEvent: CalendarEvent = {
      id: editingEvent?.id || `event-${Date.now()}`,
      title: eventTitle.trim(),
      date: dateToSave,
      time: eventTime || undefined,
      type: eventType,
      notes: eventNotes || undefined,
      subcontractor: eventSubcontractor || undefined,
      reminderMinutes: eventReminderMinutes || undefined,
      linkedMilestoneId: undefined,
      completed: editingEvent?.completed || false,
      completedAt: editingEvent?.completedAt,
      deliveryReceived: editingEvent?.deliveryReceived,
      inspectionResult: editingEvent?.inspectionResult,
      createdAt: editingEvent?.createdAt || now,
      updatedAt: now,
    };

    const updatedEvents = editingEvent
      ? events.map((e) => (e.id === editingEvent.id ? newEvent : e))
      : [...events, newEvent];

    await saveEvents(updatedEvents);
    setShowEventModal(false);
    setSelectedDate(dateToSave);
    resetForm();
    setEditingEvent(null);

    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // Delete event
  const handleDeleteEvent = () => {
    if (!editingEvent) return;

    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${editingEvent.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedEvents = events.filter((e) => e.id !== editingEvent.id);
            await saveEvents(updatedEvents);
            setShowEventModal(false);
            setSelectedDate(toLocalISODate());
            resetForm();
            setEditingEvent(null);
            if (Platform.OS === 'ios') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
          },
        },
      ]
    );
  };

  // Mark inspection as passed or failed
  const handleMarkInspectionResult = async (event: CalendarEvent, result: 'passed' | 'failed') => {
    Haptics.impactAsync(result === 'passed' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Heavy);
    const updatedEvent: CalendarEvent = {
      ...event,
      completed: true,
      completedAt: new Date().toISOString(),
      inspectionResult: result,
      updatedAt: new Date().toISOString(),
    };
    const existing = events.find((e) => e.id === event.id);
    const updatedEvents = existing
      ? events.map((e) => (e.id === event.id ? updatedEvent : e))
      : [...events, updatedEvent];
    await saveEvents(updatedEvents);
    if (onEventComplete) onEventComplete(updatedEvent);
    Haptics.notificationAsync(result === 'passed' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
  };

  const isInspectionEvent = (e: CalendarEvent) =>
    e.type === 'inspection' || e.calendarCategory === 'inspection';

  const isDeliveryEvent = (e: CalendarEvent) =>
    e.type === 'delivery' ||
    e.calendarCategory === 'delivery' ||
    e.calendarCategory === 'purchase_order';

  const isPaymentEvent = (e: CalendarEvent) =>
    e.calendarCategory === 'payment' || (e.type === 'other' && /\$[\d,.]+/.test(e.title || ''));

  // Payment completion: only true when timeline (bps.timeline.v2) explicitly says completed. Never trust event.completed.
  const paymentCompletedKeys = useMemo(() => {
    const completed = new Set<string>();
    const add = (date: string, amount: string, isCompleted: boolean) => {
      if (isCompleted) completed.add(`${date}|${amount}`);
    };
    timelineMilestones.forEach((item: any) => {
      const date = (item.scheduledDate || item.dueDate || item.date || item.plannedDate)?.toString().split('T')[0];
      if (!date) return;
      const amount = String(Number(item.amount || item.paymentAmount || 0));
      const text = `${(item.title || item.name || '')} ${(item.description || '')}`.toLowerCase();
      if (Number(amount) > 0 || includesAny(text, PAYMENT_KEYWORDS)) {
        add(date, amount, item.status === 'completed' || Number(item.progressPct || 0) >= 100);
      }
    });
    return completed;
  }, [timelineMilestones]);

  const isPaymentCompleted = useCallback((e: CalendarEvent) => {
    if (!isPaymentEvent(e)) return false;
    const amountStr = extractUsdAmountKeyFromTitle(e.title);
    const key = `${e.date}|${amountStr}`;
    const dayMs = 24 * 60 * 60 * 1000;
    for (const k of paymentCompletedKeys) {
      const [d, a] = k.split('|');
      if (a !== amountStr) continue;
      const t = new Date(d + 'T12:00:00').getTime();
      const ev = new Date(e.date + 'T12:00:00').getTime();
      if (Math.abs(t - ev) <= dayMs) return true;
    }
    return false;
  }, [paymentCompletedKeys]);

  // True when a delivery event is considered "received" (show Received badge, hide Received button)
  const isDeliveryReceived = (e: CalendarEvent) =>
    !!e.deliveryReceived ||
    (e.id.startsWith('po-') && !!e.completed) ||
    deliveryReceivedIds.has(e.id);

  // Mark delivery as received (delivery events use this instead of generic complete)
  const handleMarkDeliveryReceived = async (event: CalendarEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const existing = events.find((e) => e.id === event.id);
    if (existing) {
      const updatedEvent: CalendarEvent = {
        ...event,
        completed: true,
        deliveryReceived: true,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updatedEvents = events.map((e) => (e.id === event.id ? updatedEvent : e));
      await saveEvents(updatedEvents);
    } else {
      // Synced event (timeline or PO) — persist in delivery received ids
      const next = new Set(deliveryReceivedIds).add(event.id);
      setDeliveryReceivedIds(next);
      try {
        await AsyncStorage.setItem(`delivery_received_${projectId}`, JSON.stringify([...next]));
      } catch (err) {
        console.error('Failed to save delivery received:', err);
      }
    }
    if (onEventComplete) onEventComplete({ ...event, completed: true, deliveryReceived: true });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Mark event as complete
  const handleCompleteEvent = async (event: CalendarEvent) => {
    const updatedEvent: CalendarEvent = {
      ...event,
      completed: true,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedEvents = events.map((e) => (e.id === event.id ? updatedEvent : e));
    await saveEvents(updatedEvents);

    // Callback to create daily log
    if (onEventComplete) {
      onEventComplete(updatedEvent);
    }

    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const userCreatedIds = useMemo(() => new Set(events.map((e) => e.id)), [events]);

  // Upcoming (next 5 days) — shown in calendar footer
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + UPCOMING_CALENDAR_WINDOW_DAYS);

    return syncedEvents
      .filter((e) => {
        const done = isDeliveryEvent(e)
          ? isDeliveryReceived(e)
          : isPaymentEvent(e)
            ? isPaymentCompleted(e)
            : e.completed;
        if (done) return false;
        const eventDate = parseISODateAsLocalDay(e.date);
        if (Number.isNaN(eventDate.getTime())) return false;
        return eventDate >= today && eventDate <= windowEnd;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        if (a.time && b.time) return a.time.localeCompare(b.time);
        return a.time ? -1 : b.time ? 1 : 0;
      })
      .slice(0, 30);
  }, [syncedEvents, deliveryReceivedIds, isPaymentCompleted]);

  // Removed markedDates - only current date should be highlighted, not selected dates

  // Format events for GreyCalendar - using synced events
  const calendarEvents = useMemo(() => {
    return syncedEvents.map((event) => {
      const cat = event.calendarCategory;
      const catColor =
        cat && cat in CALENDAR_CATEGORY_COLORS
          ? CALENDAR_CATEGORY_COLORS[cat as keyof typeof CALENDAR_CATEGORY_COLORS]
          : null;
      const color = catColor ?? EVENT_TYPE_COLORS[event.type] ?? EVENT_TYPE_COLORS.other;
      return { date: event.date, type: color, color };
    });
  }, [syncedEvents]);

  const getEventColor = (event: CalendarEvent) =>
    event.calendarCategory && event.calendarCategory in CALENDAR_CATEGORY_COLORS
      ? CALENDAR_CATEGORY_COLORS[event.calendarCategory]
      : (EVENT_TYPE_COLORS[event.type] || EVENT_TYPE_COLORS.other);

  const getEventIcon = (event: CalendarEvent) =>
    event.calendarCategory && event.calendarCategory in CALENDAR_CATEGORY_ICONS
      ? CALENDAR_CATEGORY_ICONS[event.calendarCategory]
      : EVENT_TYPE_ICONS[event.type];

  const renderCalendarScrollBody = () => (
    <>
        {/* Calendar */}
        <View style={[styles.calendarContainer, embedded && styles.calendarContainerEmbedded]}>
          <GreyCalendar
            selectedDateString={selectedDate}
            onDayPress={({ dateString }) => {
              handleDatePress(dateString);
            }}
            initialDate={selectedDate || eventDate || toLocalISODate()}
            events={calendarEvents}
            footer={
              <CalendarUpcomingFooter
                events={upcomingEvents}
                darkMode={darkMode}
                textColor={COLORS.text}
                subColor={darkMode ? 'rgba(255,255,255,0.86)' : COLORS.subtext}
                getEventColor={getEventColor}
                onEventPress={(event) => {
                  const full = upcomingEvents.find((e) => e.id === event.id);
                  if (!full) return;
                  handleEventPress(full);
                  if (Platform.OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
              />
            }
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ marginTop: 10, gap: 10, paddingRight: 8 }}
          >
            {CALENDAR_LEGEND_ITEMS.map((item) => (
              <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: item.color,
                  }}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: darkMode ? 'rgba(255,255,255,0.86)' : COLORS.subtext,
                  }}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: COLORS.bg }]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={embedded ? { paddingBottom: 24 } : undefined}
      >
        {renderCalendarScrollBody()}
      </ScrollView>

      {/* Date Events Modal - Shows all events for selected date */}
      <Modal
        visible={showDateEventsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowDateEventsModal(false);
        }}
      >
        <View
          style={[
            styles.modalOverlay,
            calendarDesktopWeb && { alignItems: 'center' as const },
          ]}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: darkMode ? '#1a1a1a' : COLORS.surface,
                paddingBottom: Math.max(insets.bottom, 20),
              },
              calendarDesktopWeb && {
                width: '100%',
                maxWidth: DASHBOARD_WEB_MAX_CONTENT_WIDTH,
              },
            ]}
          >
            {/* iOS-style drag indicator */}
            <View style={styles.dragIndicatorWrapper}>
              <View style={[styles.dragIndicator, { backgroundColor: darkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)' }]} />
            </View>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: COLORS.text }]}>
                {selectedDate ? (() => {
                  const [year, month, day] = selectedDate.split('-').map(Number);
                  const date = new Date(year, month - 1, day);
                  return date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  });
                })() : 'Events'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowDateEventsModal(false);
                }}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {selectedDate && (() => {
                const eventsOnDate = getEventsForDate(selectedDate);
                if (eventsOnDate.length === 0) {
                  return (
                    <View style={styles.emptyState}>
                      <Ionicons name="calendar-outline" size={48} color={COLORS.subtext} />
                      <Text style={[styles.emptyStateText, { color: COLORS.text }]}>No events on this date</Text>
                    </View>
                  );
                }
                return (
                  <>
                    {eventsOnDate.map((event) => {
                      const isInspection = isInspectionEvent(event);
                      const hasInspectionResult = !!event.inspectionResult;
                      const pay = isPaymentEvent(event);
                      const payDone = pay && isPaymentCompleted(event);
                      const { primary: notePrimary, showAiAttribution } = splitEventNotesForDisplay(event.notes);
                      const hidePayMeta =
                        pay && /^(payment collected|payment due)\.?$/i.test((notePrimary || '').trim());
                      const notesPrimary = hidePayMeta ? '' : notePrimary;
                      const categoryTint = pay
                        ? darkMode
                          ? 'rgba(34, 197, 94, 0.12)'
                          : 'rgba(34, 197, 94, 0.1)'
                        : `${getEventColor(event)}20`;
                      return (
                        <View
                          key={event.id}
                          style={[
                            styles.eventCardModal,
                            {
                              backgroundColor: darkMode ? '#1e293b' : COLORS.surface2,
                              borderColor: COLORS.border,
                            },
                          ]}
                        >
                          <TouchableOpacity
                            style={styles.eventCardTouchable}
                            onPress={() => {
                              if (!canEditCalendar) return;
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setShowDateEventsModal(false);
                              handleEventPress(event);
                            }}
                            activeOpacity={canEditCalendar ? 0.7 : 1}
                          >
                            <View style={[styles.eventTypeIndicator, { backgroundColor: getEventColor(event) }]} />
                            <View style={styles.eventContent}>
                              <View style={styles.eventHeader}>
                                <Text style={[styles.eventTitle, { color: COLORS.text }]} numberOfLines={2}>
                                  {event.title}
                                </Text>
                                <MaterialIcons
                                  name={getEventIcon(event) as any}
                                  size={18}
                                  color={getEventColor(event)}
                                />
                              </View>
                              <View style={styles.eventDetails}>
                                <Ionicons name="folder-outline" size={14} color={COLORS.subtext} />
                                <Text
                                  style={[styles.eventDetailText, { color: COLORS.subtext }]}
                                  numberOfLines={1}
                                >
                                  {projectName}
                                </Text>
                              </View>
                              {event.subcontractor ? (
                                <View style={styles.eventDetails}>
                                  <Ionicons name="person-outline" size={14} color={COLORS.subtext} />
                                  <Text
                                    style={[styles.eventDetailText, { color: COLORS.subtext }]}
                                    numberOfLines={1}
                                  >
                                    {event.subcontractor}
                                  </Text>
                                </View>
                              ) : null}
                              {event.time ? (
                                <View style={styles.eventDetails}>
                                  <Ionicons name="time-outline" size={14} color={COLORS.subtext} />
                                  <Text style={[styles.eventDetailText, { color: COLORS.subtext }]}>
                                    {event.time}
                                  </Text>
                                </View>
                              ) : null}
                              <View style={styles.modalBadgeRow}>
                                {event.calendarCategory ? (
                                  <View
                                    style={[styles.categoryBadge, { backgroundColor: categoryTint, marginTop: 0 }]}
                                  >
                                    <Text style={[styles.categoryBadgeText, { color: getEventColor(event) }]}>
                                      {formatCalendarCategoryLabel(event.calendarCategory)}
                                    </Text>
                                  </View>
                                ) : null}
                                {pay ? (
                                  <View
                                    style={[
                                      styles.modalStatusChip,
                                      {
                                        backgroundColor: payDone
                                          ? 'rgba(34, 197, 94, 0.14)'
                                          : 'rgba(245, 158, 11, 0.14)',
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.modalStatusChipText,
                                        { color: payDone ? COLORS.green : '#f59e0b' },
                                      ]}
                                    >
                                      {payDone ? 'Paid' : 'Due'}
                                    </Text>
                                  </View>
                                ) : null}
                                {hasInspectionResult ? (
                                  <View
                                    style={[
                                      styles.modalStatusChip,
                                      {
                                        backgroundColor:
                                          event.inspectionResult === 'passed'
                                            ? 'rgba(34, 197, 94, 0.14)'
                                            : 'rgba(239, 68, 68, 0.14)',
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.modalStatusChipText,
                                        {
                                          color:
                                            event.inspectionResult === 'passed' ? COLORS.green : COLORS.red,
                                        },
                                      ]}
                                    >
                                      {event.inspectionResult === 'passed' ? 'Passed' : 'Failed'}
                                    </Text>
                                  </View>
                                ) : null}
                                {isDeliveryEvent(event) && isDeliveryReceived(event) ? (
                                  <View
                                    style={[styles.modalStatusChip, { backgroundColor: 'rgba(34, 197, 94, 0.14)' }]}
                                  >
                                    <Text style={[styles.modalStatusChipText, { color: COLORS.green }]}>
                                      Received
                                    </Text>
                                  </View>
                                ) : null}
                                {event.completed &&
                                !hasInspectionResult &&
                                !isDeliveryEvent(event) &&
                                !pay ? (
                                  <View
                                    style={[styles.modalStatusChip, { backgroundColor: 'rgba(34, 197, 94, 0.14)' }]}
                                  >
                                    <Text style={[styles.modalStatusChipText, { color: COLORS.green }]}>
                                      Completed
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              {notesPrimary ? (
                                <Text
                                  style={[styles.eventNotes, { color: COLORS.subtext }]}
                                  numberOfLines={3}
                                >
                                  {notesPrimary}
                                </Text>
                              ) : null}
                              {showAiAttribution ? (
                                <Text
                                  style={[
                                    styles.modalAiCaption,
                                    { color: darkMode ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.45)' },
                                  ]}
                                >
                                  From AI Assistant
                                </Text>
                              ) : null}
                            </View>
                            {event.completed && !hasInspectionResult && !isDeliveryEvent(event) && !pay ? (
                              <View style={styles.completedBadge}>
                                <Ionicons name="checkmark-circle" size={24} color={COLORS.green} />
                              </View>
                            ) : null}
                            {pay && payDone ? (
                              <View style={styles.completedBadge}>
                                <Ionicons name="checkmark-circle" size={24} color={COLORS.green} />
                              </View>
                            ) : null}
                            {isDeliveryEvent(event) && isDeliveryReceived(event) ? (
                              <View style={styles.completedBadge}>
                                <Ionicons name="checkmark-circle" size={24} color={COLORS.green} />
                              </View>
                            ) : null}
                          </TouchableOpacity>
                          {isInspection && !hasInspectionResult && canEditCalendar && (
                            <View style={styles.inspectionActions}>
                              <TouchableOpacity
                                style={[styles.inspectionButton, styles.inspectionButtonPassed]}
                                onPress={() => handleMarkInspectionResult(event, 'passed')}
                                activeOpacity={0.8}
                              >
                                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                                <Text style={styles.inspectionButtonText}>Passed</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.inspectionButton, styles.inspectionButtonFailed]}
                                onPress={() => handleMarkInspectionResult(event, 'failed')}
                                activeOpacity={0.8}
                              >
                                <Ionicons name="close-circle" size={18} color="#fff" />
                                <Text style={styles.inspectionButtonText}>Failed</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                          {isDeliveryEvent(event) && !isDeliveryReceived(event) && canEditCalendar && (
                            <View style={styles.inspectionActions}>
                              <TouchableOpacity
                                style={[styles.inspectionButton, styles.inspectionButtonPassed]}
                                onPress={() => handleMarkDeliveryReceived(event)}
                                activeOpacity={0.8}
                              >
                                <Ionicons name="cube-outline" size={18} color="#fff" />
                                <Text style={styles.inspectionButtonText}>Received</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </>
                );
              })()}
            </ScrollView>

            <View style={styles.modalActions}>
              {canEditCalendar ? (
                <TouchableOpacity
                  style={[styles.addEventButton, { backgroundColor: COLORS.green }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowDateEventsModal(false);
                    setShowEventModal(true);
                    setEditingEvent(null);
                    resetForm();
                  }}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.addEventButtonText}>New Event</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.closeButton,
                  { backgroundColor: COLORS.border },
                  !canEditCalendar && { flex: 1 },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowDateEventsModal(false);
                }}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Event Modal - Full page */}
      <Modal
        visible={showEventModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => {
          setShowEventModal(false);
          resetForm();
          setEditingEvent(null);
        }}
      >
        <KeyboardAvoidingView
          style={[
            styles.eventModalFullPage,
            { backgroundColor: darkMode ? '#0A0A0A' : '#F2F2F7' },
            calendarDesktopWeb && { alignItems: 'center' as const },
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? -80 : 0}
        >
          <View
            style={[
              styles.eventModalContent,
              { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) },
              calendarDesktopWeb && {
                width: '100%',
                maxWidth: DASHBOARD_WEB_MAX_CONTENT_WIDTH,
              },
            ]}
          >
            {/* iOS-style navigation bar */}
            <View style={[styles.eventFormNavBar, { borderBottomColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
              <TouchableOpacity
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowEventModal(false);
                  resetForm();
                  setEditingEvent(null);
                }}
                style={[styles.eventFormNavButton, { backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
              >
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={[styles.eventFormNavTitle, { color: COLORS.text }]}>
                {editingEvent ? 'Edit Event' : 'New Event'}
              </Text>
              <View style={styles.eventFormNavSpacer} />
            </View>

            <ScrollView
              style={[styles.modalScroll, styles.modalScrollWithKeyboard]}
              contentContainerStyle={styles.eventFormScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              automaticallyAdjustContentInsets={false}
              contentInsetAdjustmentBehavior="never"
            >
              {/* Event Details — iOS grouped inset style */}
              <View style={styles.eventFormSection}>
                <Text style={[styles.eventFormSectionTitle, { color: COLORS.subtext }]}>EVENT DETAILS</Text>
                <View style={[styles.eventFormGroup, { backgroundColor: darkMode ? '#1C1C1E' : '#FFFFFF' }]}>
                  <View style={[styles.eventFormRow, styles.eventFormRowBorder, { borderColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(60,60,67,0.12)' }]}>
                    <Text style={[styles.eventFormLabel, { color: COLORS.text }]}>Title</Text>
                    <TextInput
                      style={[styles.eventFormInput, { color: COLORS.text }]}
                      value={eventTitle}
                      onChangeText={setEventTitle}
                      placeholder="e.g., Framing Inspection"
                      placeholderTextColor={darkMode ? '#8E8E93' : '#C7C7CC'}
                    />
                  </View>
                  <View style={[styles.eventFormRow, styles.eventFormRowBorder, { borderColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(60,60,67,0.12)' }]}>
                    <Text style={[styles.eventFormLabel, { color: COLORS.text }]}>Date</Text>
                    <TextInput
                      style={[styles.eventFormInput, { color: COLORS.text }]}
                      value={eventDate ? (() => {
                        const [year, month, day] = eventDate.split('-');
                        if (year && month && day && year.length === 4) {
                          const yy = year.slice(-2);
                          return `${month}-${day}-${yy}`;
                        }
                        return eventDate;
                      })() : ''}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^\d-]/g, '');
                        let formatted = cleaned;
                        if (cleaned.length > 2 && !cleaned.includes('-')) {
                          formatted = cleaned.slice(0, 2) + '-' + cleaned.slice(2);
                        }
                        if (formatted.length > 5 && formatted.split('-').length === 2) {
                          formatted = formatted.slice(0, 5) + '-' + formatted.slice(5, 7);
                        }
                        if (formatted.length > 8) formatted = formatted.slice(0, 8);
                        setEventDate(formatted);
                      }}
                      placeholder="MM-DD-YY"
                      placeholderTextColor={darkMode ? '#8E8E93' : '#C7C7CC'}
                    />
                  </View>
                  <View style={styles.eventFormRow}>
                    <Text style={[styles.eventFormLabel, { color: COLORS.text }]}>Time</Text>
                    <TextInput
                      style={[styles.eventFormInput, { color: COLORS.text }]}
                      value={eventTime}
                      onChangeText={setEventTime}
                      placeholder="09:00"
                      placeholderTextColor={darkMode ? '#8E8E93' : '#C7C7CC'}
                    />
                  </View>
                </View>
              </View>

              {/* Type Section — keep type colors */}
              <View style={styles.eventFormSection}>
                <Text style={[styles.eventFormSectionTitle, { color: COLORS.subtext }]}>TYPE</Text>
                <View style={[styles.eventFormGroup, { backgroundColor: darkMode ? '#1C1C1E' : '#FFFFFF' }]}>
                  <View style={styles.eventFormTypeGrid}>
                    {(['inspection', 'work', 'delivery', 'payment', 'deadline', 'other'] as const).map((type) => (
                      <TouchableOpacity
                        key={type}
                        activeOpacity={0.7}
                        style={[
                          styles.eventFormTypeChip,
                          eventType === type
                            ? { backgroundColor: EVENT_TYPE_COLORS[type], borderColor: EVENT_TYPE_COLORS[type] }
                            : { backgroundColor: 'transparent', borderColor: darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(60,60,67,0.2)' },
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setEventType(type);
                        }}
                      >
                        <Feather
                          name={EVENT_TYPE_FORM_ICONS[type]}
                          size={18}
                          color={eventType === type ? '#fff' : COLORS.text}
                          strokeWidth={2}
                        />
                        <Text
                          style={[
                            styles.eventFormTypeChipText,
                            { color: eventType === type ? '#fff' : COLORS.text },
                          ]}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Additional Info */}
              <View style={styles.eventFormSection}>
                <Text style={[styles.eventFormSectionTitle, { color: COLORS.subtext }]}>ADDITIONAL INFO</Text>
                <View style={[styles.eventFormGroup, { backgroundColor: darkMode ? '#1C1C1E' : '#FFFFFF' }]}>
                  <View style={[styles.eventFormRow, styles.eventFormRowBorder, { borderColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(60,60,67,0.12)' }]}>
                    <Text style={[styles.eventFormLabel, { color: COLORS.text }]}>Subcontractor</Text>
                    <TextInput
                      style={[styles.eventFormInput, { color: COLORS.text }]}
                      value={eventSubcontractor}
                      onChangeText={setEventSubcontractor}
                      placeholder="e.g., ABC Electric"
                      placeholderTextColor={darkMode ? '#8E8E93' : '#C7C7CC'}
                    />
                  </View>
                  <View style={[styles.eventFormRow, styles.eventFormNotesRow]}>
                    <Text style={[styles.eventFormLabel, styles.eventFormLabelNotes, { color: COLORS.text }]}>Notes</Text>
                    <TextInput
                      style={[styles.eventFormInput, styles.eventFormTextArea, { color: COLORS.text }]}
                      value={eventNotes}
                      onChangeText={setEventNotes}
                      placeholder="Additional details..."
                      placeholderTextColor={darkMode ? '#8E8E93' : '#C7C7CC'}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      scrollEnabled={false}
                    />
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.eventFormActions}>
                {editingEvent && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[styles.eventFormDeleteButton, { borderColor: darkMode ? 'rgba(255,59,48,0.5)' : 'rgba(255,59,48,0.3)' }]}
                    onPress={handleDeleteEvent}
                  >
                    <Ionicons name="trash-outline" size={20} color={COLORS.red} />
                    <Text style={[styles.eventFormDeleteText, { color: COLORS.red }]}>Delete Event</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.eventFormSaveButton, { backgroundColor: darkMode ? ACCENT_GREEN : COLORS.green }]}
                  onPress={handleSaveEvent}
                >
                  <Text style={styles.eventFormSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  navButton: {
    padding: 8,
  },
  monthYearContainer: {
    flex: 1,
    alignItems: 'center',
  },
  monthYearText: {
    fontSize: 20,
    fontWeight: '700',
  },
  todayButton: {
    marginTop: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  todayButtonGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  calendarContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  calendarContainerEmbedded: {
    marginTop: 0,
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: '#ffffff',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: 2,
  },
  dayCellOtherMonth: {
    opacity: 0.3,
  },
  dayCellGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  dayTextOtherMonth: {
    opacity: 0.3,
  },
  dayTextToday: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2DFFC4', // Bright teal/cyan (green-to-blue)
  },
  dayTextHighlighted: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  dayEvents: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 2,
    gap: 2,
  },
  dayEventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dayEventDotCompleted: {
    opacity: 0.5,
  },
  dayEventMore: {
    fontSize: 8,
    marginLeft: 2,
    color: '#ffffff',
  },
  upcomingSection: {
    paddingHorizontal: 0,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  eventCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  eventCardWrapper: {
    flexDirection: 'column',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  eventCardModal: {
    flexDirection: 'column',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  eventCardTouchable: {
    flexDirection: 'row',
    flex: 1,
    padding: 12,
  },
  eventHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inspectionResultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inspectionResultText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inspectionActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
  inspectionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  inspectionButtonPassed: {
    backgroundColor: '#22c55e',
  },
  inspectionButtonFailed: {
    backgroundColor: '#ef4444',
  },
  inspectionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  eventTypeIndicator: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  eventDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  eventDetailText: {
    fontSize: 13,
  },
  eventNotes: {
    fontSize: 12,
    marginTop: 6,
  },
  completeButton: {
    padding: 8,
    marginLeft: 8,
  },
  receivedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 8,
  },
  receivedButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  receivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  receivedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  completedBadge: {
    padding: 8,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dragIndicatorWrapper: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalContentWithKeyboard: {
    flex: 1,
    minHeight: 0,
  },
  eventModalFullPage: {
    flex: 1,
  },
  eventModalContent: {
    flex: 1,
    minHeight: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalScroll: {
    flexGrow: 1,
  },
  modalScrollWithKeyboard: {
    flex: 1,
    minHeight: 0,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 24,
  },
  eventFormNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  eventFormNavButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventFormNavTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  eventFormNavSpacer: {
    width: 32,
    height: 32,
  },
  eventFormScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 100,
  },
  eventFormSection: {
    marginBottom: 32,
  },
  eventFormSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 8,
    marginLeft: 4,
    opacity: 0.9,
  },
  eventFormGroup: {
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 0,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  eventFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 44,
  },
  eventFormRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  eventFormRowButton: {
    justifyContent: 'space-between',
  },
  eventFormRowValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventFormLabel: {
    fontSize: 17,
    fontWeight: '400',
    width: 110,
  },
  eventFormLabelNotes: {
    alignSelf: 'flex-start',
    paddingTop: 12,
  },
  eventFormNotesRow: {
    alignItems: 'flex-start',
    minHeight: 100,
  },
  eventFormInput: {
    flex: 1,
    fontSize: 17,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  eventFormTextArea: {
    minHeight: 80,
    paddingTop: 12,
    paddingBottom: 12,
  },
  eventFormValueText: {
    fontSize: 17,
  },
  eventFormTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 10,
  },
  eventFormTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  eventFormTypeChipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  eventFormActions: {
    marginTop: 16,
    gap: 12,
  },
  eventFormDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  eventFormDeleteText: {
    fontSize: 17,
    fontWeight: '600',
  },
  eventFormSaveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  eventFormSaveText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  milestonePicker: {
    marginTop: 8,
  },
  milestoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  milestoneButtonText: {
    fontSize: 16,
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    flex: 1,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  milestonePickerModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  milestonePickerList: {
    padding: 20,
  },
  milestonePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  milestonePickerItemContent: {
    flex: 1,
  },
  milestonePickerItemText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  milestonePickerItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  milestoneStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  milestoneStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  milestoneDateText: {
    fontSize: 12,
  },
  closeButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  addEventButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  addEventButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  modalStatusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  modalStatusChipText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  modalAiCaption: {
    fontSize: 10,
    marginTop: 6,
    fontWeight: '500',
  },
});
