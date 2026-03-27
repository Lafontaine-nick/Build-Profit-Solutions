import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  SafeAreaView,
  Animated,
  Dimensions,
  Modal,
  Platform,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useProjectList } from "@/contexts/ProjectListContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAIManagerMode } from "@/hooks/useAIManagerMode";
import AIAssistantModal from "@/components/AIAssistantModal";
import ProfileAnalytics from "@/components/ProfileAnalytics";
import GreyCalendar from "@/components/GreyCalendar";
import * as Haptics from "expo-haptics";
import { apiService } from "@/services/api";
import type { AiDashboardResponse } from "@/types/aiDashboard";
import { clerkAuthService } from "@/services/clerkAuth";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CalendarEvent } from "@/components/ProjectCalendar";
import { ScreenLayout, getTabScrollContentBottomInset } from "@/constants/ScreenLayout";
import { TabScreenHeader } from "@/components/ui/TabScreenHeader";
import {
  formatMoneyUSD,
  formatMoneyCompact,
  formatDateShort,
  formatTimeShort,
} from "@/utils/formatters";

// Exclude deposit from progress — paid before work starts; Week 1+ represents actual work
const isDepositMilestone = (m: any): boolean => {
  const t = (m?.title || m?.name || m?.description || "").toLowerCase();
  return t.includes("deposit") || m?.type === "deposit" || m?.weekNumber === 0;
};

// Helper to calculate progress from milestone items (same logic as TimelineTabV2 and projects.tsx)
const computeOverallPctFromItems = (items: any[]): number => {
  if (!items || !Array.isArray(items) || items.length === 0) return 0;
  const workItems = items.filter((m) => !isDepositMilestone(m));
  if (!workItems.length) return 0;
  const sum = workItems.reduce((acc, m) => {
    const pct = Math.min(100, Math.max(0, m.progressPct || (m.status === 'completed' ? 100 : m.status === 'in_progress' ? 50 : 0)));
    return acc + pct;
  }, 0);
  return Math.round(sum / workItems.length);
};

const toFiniteNumber = (value: any): number => {
  if (value == null) return 0;
  const num = typeof value === 'string' ? Number(value.replace(/[$,\s]/g, '')) : Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
};

const progressFromItems = (items: any[]): number => {
  if (!items || !Array.isArray(items) || items.length === 0) return 0;
  const workItems = items.filter((m) => !isDepositMilestone(m));
  if (!workItems.length) return 0;
  const total = workItems.reduce((sum, item) => {
    if (item.status === 'completed') return sum + 100;
    if (item.status === 'in_progress') return sum + 50;
    return sum;
  }, 0);
  return Math.round(total / workItems.length);
};

const deriveUnifiedProgressPct = (project: any, projectId: string, timelineProgressMap: Record<string, number>): number => {
  // Timeline is source of truth (deposit excluded) — try pid, then title
  if (timelineProgressMap[projectId] !== undefined) {
    return timelineProgressMap[projectId];
  }
  const titleLower = String(project?.title || project?.name || '').trim().toLowerCase();
  const titleSlug = titleLower.replace(/\s+/g, '-');
  if (titleLower && timelineProgressMap[titleLower] !== undefined) return timelineProgressMap[titleLower];
  if (titleSlug && timelineProgressMap[titleSlug] !== undefined) return timelineProgressMap[titleSlug];

  // Fallback to direct progress fields
  const directProgress = Math.max(
    toFiniteNumber(project?.overallProgressPct),
    toFiniteNumber(project?.progress)
  );

  // Fallback to calculating from project's milestone/weeklyPayment arrays
  const milestonesCandidates = [
    project?.milestones,
    project?.projectData?.milestones,
    project?.estimateData?.milestones,
    project?.estimateData?.paymentMilestones,
  ];
  const weeklyCandidates = [
    project?.weeklyPayments,
    project?.projectData?.weeklyPayments,
    project?.estimateData?.weeklyPayments,
  ];

  const derivedFromMilestones = Math.max(...milestonesCandidates.map((items) => progressFromItems(items)));
  const derivedFromWeekly = Math.max(...weeklyCandidates.map((items) => progressFromItems(items)));

  // Use the strongest available signal so weekly and milestone schedules are treated equally.
  return Math.max(directProgress, derivedFromMilestones, derivedFromWeekly, 0);
};

const { width } = Dimensions.get("window");

type TabKey = "overview" | "analytics" | "calendar" | "insights";

const sanitizePositiveNumber = (value: any): number => {
  if (value == null) return 0;
  const num =
    typeof value === "string"
      ? Number(value.replace(/[$,\s]/g, ""))
      : Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

const getProjectRevenue = (project: any): number => {
  if (!project) return 0;

  // CRITICAL: Use the SAME logic as projects.tsx to ensure consistency
  // Original budget MUST come from estimate/contract fields ONLY
  // NEVER use projectData.budgeted or project.budgeted - these may already include change orders!
  const originalBudgetCandidates: any[] = [
    project?.estimateData?.grandTotal,      // PRIMARY: estimate's grandTotal
    project?.estimateData?.bidPrice,        // Secondary: estimate's bidPrice
    project?.estimateData?.total,           // Tertiary: estimate's total
    project?.bidPrice,                      // Fallback: project's bidPrice
    project?.projectData?.bidPrice,         // Fallback: projectData bidPrice
    project?.projectData?.totalBidPrice,    // Fallback: projectData totalBidPrice
    project?.total,                         // Fallback: project total
    project?.totalRevenue,                  // Fallback: totalRevenue
    project?.contractValue,                 // Fallback: contractValue
  ];

  let originalBudget = 0;
  for (const candidate of originalBudgetCandidates) {
    const sanitized = sanitizePositiveNumber(candidate);
    if (sanitized > 0) {
      originalBudget = sanitized;
      break;
    }
  }

  // If no original estimate value exists, return 0
  if (originalBudget <= 0) {
    // Only warn for projects that should have a budget (not draft/estimate)
    const status = (project?.status || '').toString().toLowerCase();
    if (__DEV__ && status !== 'estimate' && status !== 'draft') {
      const projectName = project?.title || project?.name || 'Unknown';
      console.warn(`⚠️ [Dashboard] No original budget found for ${projectName}. Estimate fields missing.`);
    }
    return 0;
  }

  // Collect change orders from all possible locations and compute approved total
  const changeOrderSources: any[] = [
    project?.projectData?.changeOrders,
    project?.changeOrders,
    (project as any)?.rawProject?.projectData?.changeOrders,
    (project as any)?.rawProject?.changeOrders,
  ];

  const collected: any[] = [];
  for (const source of changeOrderSources) {
    if (Array.isArray(source) && source.length > 0) {
      collected.push(...source);
    }
  }

  // Deduplicate by id when available, otherwise by title+amount signature
  const seen = new Set<string>();
  const uniqueChangeOrders = collected.filter((co: any) => {
    const key = co?.id != null
      ? `id:${String(co.id)}`
      : `sig:${String(co?.title || '')}:${String(co?.amount ?? co?.clientPrice ?? co?.cost ?? 0)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let approvedChangeOrdersTotal = uniqueChangeOrders.reduce(
    (sum, co) => {
      const amount = Number(co.amount ?? co.clientPrice ?? co.cost ?? 0);
      const isApproved =
        (typeof co.approved === 'boolean' && co.approved) ||
        (typeof co.status === 'string' && co.status.toLowerCase() === 'approved');
      return isApproved ? sum + amount : sum;
    },
    0
  );

  // Legacy fallback: some records persist only aggregate CO total
  if (approvedChangeOrdersTotal <= 0) {
    approvedChangeOrdersTotal = sanitizePositiveNumber(
      project?.projectData?.changeOrderTotal ??
      (project as any)?.changeOrderTotal ??
      (project as any)?.rawProject?.projectData?.changeOrderTotal
    );
  }

  // Core rule: adjusted budget = original budget + approved COs
  return originalBudget + approvedChangeOrdersTotal;
};

// Status theme matching projects page
const statusTheme: Record<string, { bg: string; border: string; color: string }> = {
  Active: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Completed: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Submitted: { bg: 'rgba(148, 163, 184, 0.24)', border: 'rgba(148, 163, 184, 0.4)', color: '#e2e8f0' },
  Won: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Draft: { bg: 'rgba(148, 163, 184, 0.2)', border: 'rgba(148, 163, 184, 0.35)', color: '#cbd5e1' },
};

const computePipelineTotals = (projects: any[]) => {
  let totalBidValue = 0;
  let activeProjectsValue = 0;
  let completedProfit = 0;

  projects.forEach((project: any) => {
    const status = (project?.status || "").toString().toLowerCase();
    const revenue = getProjectRevenue(project);

    // Total Bids includes: active projects (won, in_progress, active) AND submitted bids (bid_submitted, submitted) AND completed projects
    const validStatuses = [
      "won",
      "in_progress",
      "in-progress",
      "active",
      "bid_submitted",
      "submitted",
      "completed",
    ];
    
    // Total Bids includes: active projects (won, in_progress, active) AND submitted bids (bid_submitted, submitted) AND completed projects
    if (validStatuses.includes(status)) {
      totalBidValue += revenue;
    }

    // Active Projects includes: only active projects (won, in_progress, active) - NOT submitted, NOT completed
    const activeStatuses = ["active", "won", "in_progress", "in-progress"];
    if (activeStatuses.includes(status)) {
      activeProjectsValue += revenue;
    }

    if (status === "completed" && revenue > 0) {
      // Try to get actual cost first (most accurate)
      const actualCost = 
        project.actualCost ||
        project.projectData?.actualCost ||
        project.projectData?.spent ||
        project.projectData?.totalSpent ||
        project.totalSpent ||
        0;
      
      if (actualCost > 0) {
        // Use actual cost if available (revenue - actual cost = profit)
        completedProfit += revenue - actualCost;
      } else {
        // Fall back to margin-based calculation if no actual cost
        const margin = project.margin || 0;
        const marginRatio = Math.abs(margin) > 1 ? margin / 100 : margin;
        completedProfit += revenue * marginRatio;
      }
    }
  });

  return { 
    totalBidValue: totalBidValue, 
    activeProjectsValue: activeProjectsValue, 
    completedProfit: completedProfit 
  };
};

// Master Calendar View - aggregates events from all projects
const PAYMENT_KEYWORDS = ['payment', 'deposit', 'milestone', 'weekly pay', 'draw'];
const INSPECTION_KEYWORDS = ['inspection', 'inspect'];
const PHASE_KEYWORDS = ['concrete', 'framing', 'drywall', 'electrical', 'plumbing', 'roof', 'foundation', 'demo', 'paint', 'phase', 'install', 'installation', 'start'];
const DELIVERY_KEYWORDS = ['delivery', 'deliver', 'pickup', 'pick up', 'purchase order', 'po ', 'lumber', 'cabinet', 'tile'];
const DEADLINE_KEYWORDS = ['deadline', 'due', 'permit', 'completion', 'complete by', 'final', 'project completion', 'framing completion'];
const NOISE_KEYWORDS = ['daily log', 'receipt', 'checklist', 'internal reminder', 'small task', 'note only', 'todo'];

const CALENDAR_CATEGORY_COLORS = {
  payment: '#22c55e', // green
  inspection: '#f59e0b', // yellow
  phase: '#3b82f6', // blue
  delivery: '#8b5cf6', // purple
  deadline: '#ef4444', // red
} as const;

const EVENT_TYPE_COLORS: Record<CalendarEvent["type"], string> = {
  inspection: "#f59e0b",
  delivery: "#8b5cf6",
  work: "#3b82f6",
  payment: "#22c55e",
  deadline: "#ef4444",
  other: "#f97316",
};
const ACCENT_GREEN = "#19E180";
const EVENT_TYPE_FORM_ICONS: Record<CalendarEvent["type"], string> = {
  inspection: "check-circle",
  delivery: "package",
  work: "tool",
  payment: "credit-card",
  deadline: "clock",
  other: "file-text",
};

/** Fade a hex color for completed project events (opacity 0.45) */
const fadeHexColor = (hex: string, opacity = 0.45): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

type MasterCalendarViewProps = {
  activeProjects: any[];
  estimates: any[];
};

type MasterCalendarEvent = CalendarEvent & {
  projectId: string;
  projectName: string;
  isCompletedProject?: boolean;
  isUserCreated?: boolean;
};

const MasterCalendarView: React.FC<MasterCalendarViewProps> = ({ activeProjects, estimates }) => {
  const { theme, darkMode } = useTheme();
  const Colors = React.useMemo(() => getColors(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [allEvents, setAllEvents] = React.useState<MasterCalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [showDateEventsModal, setShowDateEventsModal] = React.useState(false);
  const [showEventModal, setShowEventModal] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<MasterCalendarEvent | null>(null);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const [eventTitle, setEventTitle] = React.useState("");
  const [eventDate, setEventDate] = React.useState("");
  const [eventTime, setEventTime] = React.useState("");
  const [eventType, setEventType] = React.useState<CalendarEvent["type"]>("work");
  const [eventNotes, setEventNotes] = React.useState("");
  const [eventSubcontractor, setEventSubcontractor] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const includesAny = (value: string, keywords: readonly string[]) =>
    keywords.some((k) => value.includes(k));

  const toISODate = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === 'string') return value.split('T')[0];
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  };

  const categoryToType = (category: 'payment' | 'inspection' | 'phase' | 'delivery' | 'deadline'): CalendarEvent['type'] => {
    switch (category) {
      case 'payment': return 'payment';
      case 'inspection': return 'inspection';
      case 'phase': return 'work';
      case 'delivery': return 'delivery';
      case 'deadline': return 'deadline';
    }
  };

  // Load and aggregate events from active projects only
  React.useEffect(() => {
    const loadAllEvents = async () => {
      setLoading(true);
      const nowIso = new Date().toISOString();
      const result: Array<CalendarEvent & { projectId: string; projectName: string; isCompletedProject?: boolean }> = [];
      const seen = new Set<string>();

      const pushUnique = (event: CalendarEvent & { projectId: string; projectName: string; isCompletedProject?: boolean }) => {
        // Validate event has required fields
        if (!event.projectId || !event.date) {
          return;
        }
        
        const key = `${event.projectId}|${event.calendarCategory || 'other'}|${event.date}|${event.title}`;
        if (seen.has(key)) return;
        seen.add(key);
        result.push(event);
      };

      // Master calendar should only reflect ACTIVE projects
      const allProjects = [...activeProjects];
      
      // Create a Set of valid project IDs and names for quick lookup (normalize to strings)
      const validProjectIds = new Set<string>();
      const validProjectNames = new Set<string>();
      allProjects.forEach(p => {
        if (p?.id) {
          const id = String(p.id);
          const name = (p.title || p.name || '').toLowerCase().trim();
          validProjectIds.add(id);
          if (name) {
            validProjectNames.add(name);
          }
        }
      });
      
      // Only process projects that are in the valid list
      const projectsToProcess = allProjects.filter(p => {
        if (!p?.id) return false;
        const id = String(p.id);
        return validProjectIds.has(id);
      });

      for (const project of projectsToProcess) {
        const projectId = String(project.id);
        const projectName = project.title || project.name || 'Untitled Project';
        const projectData = project.projectData || project;
        const isCompletedProject = (project.status || '').toString().toLowerCase() === 'completed';

        // Double-check project is still valid before loading any data
        if (!validProjectIds.has(projectId)) {
          continue;
        }

        try {
          const key = `calendar_events_${projectId}`;
          const saved = await AsyncStorage.getItem(key);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              parsed.forEach((event: CalendarEvent) => {
                // CRITICAL: Only process events that belong to this project
                // If event has a projectId, it must match the current projectId
                const eventProjectId = String(event.projectId || '').trim();
                if (eventProjectId && eventProjectId !== projectId) {
                  return;
                }
                
                const text = `${event.title || ''} ${event.notes || ''}`.toLowerCase();
                if (includesAny(text, NOISE_KEYWORDS)) return;
                
                let category: CalendarEvent['calendarCategory'] | null = null;
                if (event.type === 'payment' || includesAny(text, PAYMENT_KEYWORDS)) category = 'payment';
                else if (event.type === 'inspection' || includesAny(text, INSPECTION_KEYWORDS)) category = 'inspection';
                else if (event.type === 'delivery' || includesAny(text, DELIVERY_KEYWORDS)) category = 'delivery';
                else if (event.type === 'deadline' || includesAny(text, DEADLINE_KEYWORDS)) category = 'deadline';
                else if (event.type === 'work' || includesAny(text, PHASE_KEYWORDS)) category = 'phase';
                
                if (!category) return;
                // Ensure projectId and projectName are set correctly (always use current project)
                pushUnique({ 
                  ...event, 
                  calendarCategory: category, 
                  projectId: projectId, // ALWAYS use current project ID
                  projectName: projectName, // ALWAYS use current project name
                  isCompletedProject,
                  isUserCreated: true, // From calendar_events - editable
                });
              });
            }
          }
        } catch (error) {
          console.error(`Error loading calendar events for project ${projectId}:`, error);
        }

        // 2. Payments from milestones (only if project still exists)
        if (!validProjectIds.has(projectId)) {
          continue; // Skip payments for deleted projects
        }

        const paymentMilestones: any[] = [];
        if (projectData?.milestones?.length) paymentMilestones.push(...projectData.milestones);
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
        if (projectData?.estimateData?.paymentMilestones?.length) {
          paymentMilestones.push(...projectData.estimateData.paymentMilestones);
        }
        if (projectData?.estimateData?.weeklyPayments?.length) {
          projectData.estimateData.weeklyPayments.forEach((w: any, i: number) => {
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
          const isCollected = m.status === 'completed' || m.status === 'paid' || m.collected || m.isPaid;
          pushUnique({
            id: `payment-${projectId}-${m.id || `${date}-${amount}`}`,
            title: `${m.name || m.title || 'Payment'}${amount > 0 ? `: $${amount.toLocaleString()}` : ''}`,
            date,
            type: 'payment',
            calendarCategory: 'payment',
            notes: isCollected ? 'Payment collected' : 'Payment due',
            completed: Boolean(isCollected),
            createdAt: nowIso,
            updatedAt: nowIso,
            projectId,
            projectName,
            isCompletedProject,
          });
        });

        // 3. Timeline milestones
        try {
          const timelineKey = `bps.timeline.v2.${projectId}`;
          const saved = await AsyncStorage.getItem(timelineKey);
          if (saved) {
            const timelineItems = JSON.parse(saved);
            if (Array.isArray(timelineItems)) {
              timelineItems.forEach((item: any) => {
                const date = toISODate(item.scheduledDate || item.dueDate || item.date || item.plannedDate);
                if (!date) return;
                const text = `${item.title || item.name || ''} ${item.description || ''}`.toLowerCase();
                if (includesAny(text, NOISE_KEYWORDS)) return;

                let category: CalendarEvent['calendarCategory'] | null = null;
                const amount = Number(item.amount || item.paymentAmount || 0);
                if (amount > 0 || includesAny(text, PAYMENT_KEYWORDS)) category = 'payment';
                else if (includesAny(text, INSPECTION_KEYWORDS)) category = 'inspection';
                else if (includesAny(text, DELIVERY_KEYWORDS)) category = 'delivery';
                else if (includesAny(text, DEADLINE_KEYWORDS)) category = 'deadline';
                else if (includesAny(text, PHASE_KEYWORDS)) category = 'phase';
                if (!category) return;

                pushUnique({
                  id: `timeline-${projectId}-${item.id || `${date}-${item.title || item.name || 'milestone'}`}`,
                  title: category === 'payment'
                    ? `${item.title || item.name || 'Payment'}${amount > 0 ? `: $${amount.toLocaleString()}` : ''}`
                    : (item.title || item.name || 'Milestone'),
                  date,
                  type: categoryToType(category),
                  calendarCategory: category,
                  notes: item.description,
                  completed: item.status === 'completed' || Number(item.progressPct || 0) >= 100,
                  createdAt: item.createdAt || nowIso,
                  updatedAt: item.updatedAt || nowIso,
                  projectId,
                  projectName,
                  isCompletedProject,
                });
              });
            }
          }
        } catch (error) {
          console.error(`Error loading timeline for project ${projectId}:`, error);
        }

        // 4. Deliveries from POs
        if (projectData?.purchaseOrders?.length) {
          projectData.purchaseOrders.forEach((po: any) => {
            const date = toISODate(po.expectedDelivery);
            if (!date) return;
            pushUnique({
              id: `po-${projectId}-${po.id || `${po.poNumber || 'po'}-${date}`}`,
              title: `Delivery: ${po.vendor || 'Vendor'}${po.category ? ` - ${po.category}` : ''}`,
              date,
              type: 'delivery',
              calendarCategory: 'delivery',
              notes: po.description || po.notes || (po.poNumber ? `PO ${po.poNumber}` : undefined),
              completed: po.status === 'Received',
              createdAt: po.orderDate || nowIso,
              updatedAt: nowIso,
              projectId,
              projectName,
              isCompletedProject,
            });
          });
        }

        // 5. Project end date deadline
        const projectEndDate = toISODate(projectData?.endISO || projectData?.endDate || project.endDate);
        if (projectEndDate) {
          pushUnique({
            id: `project-deadline-${projectId}`,
            title: 'Project completion deadline',
            date: projectEndDate,
            type: 'deadline',
            calendarCategory: 'deadline',
            notes: `${projectName} target completion`,
            completed: false,
            createdAt: nowIso,
            updatedAt: nowIso,
            projectId,
            projectName,
            isCompletedProject,
          });
        }
      }

      // Aggressively filter out events from deleted projects
      // Only keep events where the projectId matches a valid project
      const validEvents = result.filter(event => {
        const eventProjectId = String(event.projectId || '').trim();
        const eventProjectName = (event.projectName || '').trim();
        
        // Check by ID (most reliable)
        const isValidById = eventProjectId && validProjectIds.has(eventProjectId);
        
        if (!isValidById) {
          return false;
        }
        
        return true;
      });
      
      const sortedEvents = validEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setAllEvents(sortedEvents);
      setLoading(false);
    };

    loadAllEvents();
  }, [activeProjects, estimates, refreshTrigger]);

  // Format events for GreyCalendar — use faded colors for completed project events
  const calendarEvents = React.useMemo(() => {
    const baseColor = (cat: string) => CALENDAR_CATEGORY_COLORS[cat as keyof typeof CALENDAR_CATEGORY_COLORS] || '#8b5cf6';
    return allEvents.map(event => {
      const hex = event.calendarCategory ? baseColor(event.calendarCategory) : '#8b5cf6';
      const color = event.isCompletedProject ? fadeHexColor(hex) : hex;
      return { date: event.date, type: color, color };
    });
  }, [allEvents]);

  // Get events for a specific date
  const getEventsForDate = React.useCallback((dateStr: string): MasterCalendarEvent[] => {
    return allEvents.filter(event => event.date === dateStr);
  }, [allEvents]);

  // Upcoming events (next 7 days) — same as ProjectCalendar
  const upcomingEvents = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return allEvents
      .filter((e) => {
        if (e.completed) return false;
        const eventDate = new Date(e.date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today && eventDate <= nextWeek;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        if (a.time && b.time) return a.time.localeCompare(b.time);
        return a.time ? -1 : b.time ? 1 : 0;
      })
      .slice(0, 5);
  }, [allEvents]);

  const resetForm = React.useCallback(() => {
    setEventTitle("");
    setEventTime("");
    setEventType("work");
    setEventNotes("");
    setEventSubcontractor("");
    setEditingEvent(null);
    setSelectedProjectId(null);
  }, []);

  const toISODateForForm = (value: string): string => {
    const parts = value.split("-");
    if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 2) {
      const [month, day, yy] = parts;
      const year = `20${yy}`;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    return value;
  };

  const handleSaveEvent = React.useCallback(async () => {
    const projectId = editingEvent?.projectId || selectedProjectId;
    if (!eventTitle.trim() || !eventDate || !projectId) {
      Alert.alert("Required Fields", editingEvent ? "Please enter a title and date" : "Please select a project and enter a title and date");
      return;
    }
    let dateToSave = eventDate;
    if (eventDate.includes("-") && eventDate.split("-")[0].length === 2) {
      dateToSave = toISODateForForm(eventDate);
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
      completed: editingEvent?.completed || false,
      completedAt: editingEvent?.completedAt,
      inspectionResult: editingEvent?.inspectionResult,
      createdAt: editingEvent?.createdAt || now,
      updatedAt: now,
    };
    try {
      const key = `calendar_events_${projectId}`;
      const saved = await AsyncStorage.getItem(key);
      const existing: CalendarEvent[] = saved ? JSON.parse(saved) : [];
      const updated = editingEvent
        ? existing.map((e) => (e.id === editingEvent.id ? newEvent : e))
        : [...existing, newEvent];
      await AsyncStorage.setItem(key, JSON.stringify(updated));
      setShowEventModal(false);
      setSelectedDate(null);
      resetForm();
      setEditingEvent(null);
      if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRefreshTrigger((t) => t + 1);
    } catch (e) {
      Alert.alert("Error", "Failed to save event");
    }
  }, [editingEvent, selectedProjectId, eventTitle, eventDate, eventTime, eventType, eventNotes, eventSubcontractor, activeProjects, resetForm]);

  const handleDeleteEvent = React.useCallback(async () => {
    const projectId = editingEvent?.projectId;
    if (!editingEvent || !projectId) return;
    Alert.alert("Delete Event", "Are you sure you want to delete this event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const key = `calendar_events_${projectId}`;
            const saved = await AsyncStorage.getItem(key);
            const existing: CalendarEvent[] = saved ? JSON.parse(saved) : [];
            const updated = existing.filter((e) => e.id !== editingEvent.id);
            await AsyncStorage.setItem(key, JSON.stringify(updated));
            setShowEventModal(false);
            setSelectedDate(null);
            resetForm();
            setEditingEvent(null);
            setRefreshTrigger((t) => t + 1);
          } catch (e) {
            Alert.alert("Error", "Failed to delete event");
          }
        },
      },
    ]);
  }, [editingEvent, activeProjects, resetForm]);

  // Get event color and icon helpers
  const getEventColor = React.useCallback((event: CalendarEvent & { projectId: string; projectName: string }) => {
    if (event.calendarCategory) {
      return CALENDAR_CATEGORY_COLORS[event.calendarCategory];
    }
    // Fallback to type-based colors
    const typeColors: Record<string, string> = {
      inspection: '#f59e0b', // yellow
      work: '#3b82f6', // blue
      delivery: '#8b5cf6', // purple
      payment: '#22c55e', // green
      deadline: '#ef4444', // red
      other: '#f97316', // orange
    };
    return typeColors[event.type] || '#8b5cf6';
  }, []);

  const getEventIcon = React.useCallback((event: CalendarEvent & { projectId: string; projectName: string }) => {
    if (event.calendarCategory) {
      const categoryIcons: Record<string, string> = {
        payment: 'attach-money',
        inspection: 'fact-check',
        phase: 'construction',
        delivery: 'local-shipping',
        deadline: 'event-busy',
      };
      return categoryIcons[event.calendarCategory] || 'calendar';
    }
    const typeIcons: Record<string, string> = {
      inspection: 'clipboard-check',
      delivery: 'truck',
      work: 'hammer',
      payment: 'attach-money',
      deadline: 'event-busy',
      other: 'alert-circle',
    };
    return typeIcons[event.type] || 'calendar';
  }, []);

  // Removed markedDates - only current date should be highlighted, not selected dates

  const COLORS = darkMode
    ? {
        bg: '#000000',
        surface: '#0f172a',
        surface2: '#1e293b',
        text: '#FFFFFF',
        subtext: '#FFFFFF',
        border: '#334155',
        green: '#22c55e',
      }
    : {
        bg: '#ffffff',
        surface: '#f8fafc',
        surface2: '#f1f5f9',
        text: '#0f172a',
        subtext: '#64748b',
        border: '#e2e8f0',
        green: '#22c55e',
      };

  return (
    <>
      <View style={{ marginTop: 8, marginBottom: 24 }}>
        <GreyCalendar
          onDayPress={({ dateString }) => {
            setSelectedDate(dateString);
            setEventDate(dateString);
            const eventsOnDate = getEventsForDate(dateString);
            if (eventsOnDate.length > 0) {
              setShowDateEventsModal(true);
            } else {
              resetForm();
              const first = activeProjects.find(
                (p) => p?.id && (p.status || "").toString().toLowerCase() !== "completed"
              );
              if (first) setSelectedProjectId(String(first.id));
              setShowEventModal(true);
            }
            if (Platform.OS === "ios") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          }}
          events={calendarEvents}
        />
      </View>

      {/* Upcoming (Next 7 Days) */}
      {upcomingEvents.length > 0 && (
        <View style={{ paddingHorizontal: 0, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Ionicons name="time-outline" size={20} color={COLORS.green} />
            <Text style={{ fontSize: 18, fontWeight: '600', color: COLORS.text }}>Upcoming (Next 7 Days)</Text>
          </View>
          {upcomingEvents.map((event) => (
            <View
              key={event.id}
              style={{
                flexDirection: 'column',
                borderRadius: 12,
                marginBottom: 12,
                borderWidth: 1,
                overflow: 'hidden',
                backgroundColor: darkMode ? '#3d3d3d' : '#e5e5e5',
                borderColor: darkMode ? '#4f4f4f' : '#d0d0d0',
              }}
            >
              <Pressable
                style={{ flexDirection: 'row', flex: 1, padding: 12 }}
                onPress={() => {
                  if ((event as MasterCalendarEvent).isUserCreated) {
                    setEditingEvent(event as MasterCalendarEvent);
                    setEventTitle(event.title);
                    setEventDate(event.date);
                    setEventTime(event.time || "");
                    setEventType(event.type);
                    setEventNotes(event.notes || "");
                    setEventSubcontractor(event.subcontractor || "");
                    setSelectedProjectId(event.projectId);
                    setShowEventModal(true);
                  } else {
                    setSelectedDate(event.date);
                    setShowDateEventsModal(true);
                  }
                  if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <View style={{
                  width: 4,
                  borderRadius: 2,
                  marginRight: 12,
                  backgroundColor: getEventColor(event),
                }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', flex: 1, color: COLORS.text }}>{event.title}</Text>
                    <MaterialIcons name={getEventIcon(event) as any} size={16} color={darkMode ? '#FFFFFF' : getEventColor(event)} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Ionicons name="calendar-outline" size={14} color={COLORS.subtext} />
                    <Text style={{ fontSize: 13, color: COLORS.subtext }}>
                      {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {event.time && ` at ${event.time}`}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Ionicons name="folder-outline" size={14} color={COLORS.subtext} />
                    <Text style={{ fontSize: 13, color: COLORS.subtext }}>
                      {event.projectName || 'Project'}
                      {(event as MasterCalendarEvent).isCompletedProject && (
                        <Text style={{ opacity: darkMode ? 1 : 0.7 }}> (Completed)</Text>
                      )}
                    </Text>
                  </View>
                  {event.notes && (
                    <Text style={{ fontSize: 12, marginTop: 6, color: COLORS.subtext }} numberOfLines={2}>
                      {event.notes}
                    </Text>
                  )}
                  {event.calendarCategory && (
                    <View style={{ marginTop: 4 }}>
                      <View style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                        alignSelf: 'flex-start',
                        backgroundColor: `${getEventColor(event)}20`,
                      }}>
                        <Text style={{
                          fontSize: 11,
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          color: darkMode ? '#FFFFFF' : getEventColor(event),
                        }}>
                          {event.calendarCategory.charAt(0).toUpperCase() + event.calendarCategory.slice(1)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Date Events Modal */}
      <Modal
        visible={showDateEventsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowDateEventsModal(false);
          setSelectedDate(null);
        }}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
          overflow: 'hidden',
        }}>
          <View style={{
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '90%',
            paddingBottom: Platform.OS === 'ios' ? 34 : 20,
            backgroundColor: COLORS.surface,
            overflow: 'hidden',
            elevation: 0,
            shadowColor: 'transparent',
            shadowOpacity: 0,
            shadowRadius: 0,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255, 255, 255, 0.1)',
            }}>
              <Text style={{
                fontSize: 20,
                fontWeight: '700',
                color: COLORS.text,
              }}>
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
              <Pressable
                onPress={() => {
                  setShowDateEventsModal(false);
                  setSelectedDate(null);
                }}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </Pressable>
            </View>

            <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
              {selectedDate && (() => {
                const eventsOnDate = getEventsForDate(selectedDate);
                if (eventsOnDate.length === 0) {
                  return (
                    <View style={{ alignItems: "center", paddingVertical: 48 }}>
                      <Ionicons name="calendar-outline" size={48} color={COLORS.subtext} />
                      <Text style={{ fontSize: 18, fontWeight: "600", marginTop: 16, color: COLORS.text }}>
                        No events on this date
                      </Text>
                      <Pressable
                        style={{
                          marginTop: 20,
                          paddingHorizontal: 24,
                          paddingVertical: 12,
                          borderRadius: 12,
                          backgroundColor: ACCENT_GREEN,
                        }}
                        onPress={() => {
                          setShowDateEventsModal(false);
                          resetForm();
                          setEventDate(selectedDate || "");
                          const first = activeProjects.find(
                            (p) => p?.id && (p.status || "").toString().toLowerCase() !== "completed"
                          );
                          if (first) setSelectedProjectId(String(first.id));
                          setShowEventModal(true);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Add Event</Text>
                      </Pressable>
                    </View>
                  );
                }
                return (
                  <>
                    {eventsOnDate.map((event) => (
                      <Pressable
                        key={event.id}
                        onPress={() => {
                          if ((event as MasterCalendarEvent).isUserCreated) {
                            setShowDateEventsModal(false);
                            setEditingEvent(event as MasterCalendarEvent);
                            setEventTitle(event.title);
                            setEventDate(event.date);
                            setEventTime(event.time || "");
                            setEventType(event.type);
                            setEventNotes(event.notes || "");
                            setEventSubcontractor(event.subcontractor || "");
                            setSelectedProjectId(event.projectId);
                            setShowEventModal(true);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }
                        }}
                        style={{
                          flexDirection: 'row',
                          borderRadius: 12,
                          padding: 12,
                          marginBottom: 12,
                          borderWidth: 1,
                          backgroundColor: COLORS.surface2,
                          borderColor: COLORS.border,
                        }}
                      >
                        <View style={{
                          width: 4,
                          borderRadius: 2,
                          marginRight: 12,
                          backgroundColor: getEventColor(event),
                        }} />
                        <View style={{ flex: 1 }}>
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 4,
                          }}>
                            <Text style={{
                              fontSize: 16,
                              fontWeight: '600',
                              flex: 1,
                              color: COLORS.text,
                            }}>{event.title}</Text>
                            <MaterialIcons
                              name={getEventIcon(event) as any}
                              size={16}
                              color={darkMode ? '#FFFFFF' : getEventColor(event)}
                            />
                          </View>
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 4,
                          }}>
                            <Ionicons name="folder-outline" size={14} color={COLORS.subtext} />
                            <Text style={{ fontSize: 13, color: COLORS.subtext }}>
                              {event.projectName || 'Project'}
                              {(event as any).isCompletedProject && (
                                <Text style={{ opacity: darkMode ? 1 : 0.7 }}> (Completed)</Text>
                              )}
                            </Text>
                          </View>
                          {event.time && (
                            <View style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              marginTop: 4,
                            }}>
                              <Ionicons name="time-outline" size={14} color={COLORS.subtext} />
                              <Text style={{ fontSize: 13, color: COLORS.subtext }}>
                                {event.time}
                              </Text>
                            </View>
                          )}
                          {event.notes && (
                            <Text style={{
                              fontSize: 12,
                              marginTop: 6,
                              color: COLORS.subtext,
                            }} numberOfLines={2}>
                              {event.notes}
                            </Text>
                          )}
                          {event.calendarCategory && (
                            <View style={{ marginTop: 4 }}>
                              <View style={{
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6,
                                alignSelf: 'flex-start',
                                backgroundColor: `${getEventColor(event)}20`,
                              }}>
                                <Text style={{
                                  fontSize: 11,
                                  fontWeight: '600',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.5,
                                  color: darkMode ? '#FFFFFF' : getEventColor(event),
                                }}>
                                  {event.calendarCategory.charAt(0).toUpperCase() + event.calendarCategory.slice(1)}
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                        {event.completed && (
                          <View style={{ padding: 8, marginLeft: 8 }}>
                            <Ionicons name="checkmark-circle" size={24} color={COLORS.green} />
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </>
                );
              })()}
            </ScrollView>

            <View style={{
              flexDirection: "row",
              gap: 12,
              padding: 20,
              borderTopWidth: 1,
              borderTopColor: "rgba(255, 255, 255, 0.1)",
            }}>
              <Pressable
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: COLORS.border,
                }}
                onPress={() => {
                  setShowDateEventsModal(false);
                  setSelectedDate(null);
                }}
              >
                <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "700" }}>Close</Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: ACCENT_GREEN,
                }}
                onPress={() => {
                  setShowDateEventsModal(false);
                  resetForm();
                  setEventDate(selectedDate || "");
                  const first = activeProjects.find(
                    (p) => p?.id && (p.status || "").toString().toLowerCase() !== "completed"
                  );
                  if (first) setSelectedProjectId(String(first.id));
                  setShowEventModal(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Add Event</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Event Modal - Full page (New/Edit) - same as ProjectCalendar */}
      <Modal
        visible={showEventModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => {
          setShowEventModal(false);
          setSelectedDate(null);
          resetForm();
          setEditingEvent(null);
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: darkMode ? "#0A0A0A" : "#F2F2F7" }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? -80 : 0}
        >
          <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }}>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
            }}>
              <TouchableOpacity
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowEventModal(false);
                  setSelectedDate(null);
                  resetForm();
                  setEditingEvent(null);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                }}
              >
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: "600", color: COLORS.text }}>
                {editingEvent ? "Edit Event" : "New Event"}
              </Text>
              <View style={{ width: 32, height: 32 }} />
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {/* Project picker - only for new events */}
              {!editingEvent && (
                <View style={{ marginBottom: 32 }}>
                  <Text style={{
                    fontSize: 13,
                    fontWeight: "600",
                    letterSpacing: 0.3,
                    marginBottom: 8,
                    marginLeft: 4,
                    opacity: 0.9,
                    color: COLORS.subtext,
                  }}>PROJECT</Text>
                  <View style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    backgroundColor: darkMode ? "#1C1C1E" : "#FFFFFF",
                  }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ padding: 12 }}>
                      {activeProjects
                        .filter((p) => p?.id && (p.status || "").toString().toLowerCase() !== "completed")
                        .map((p) => {
                        const pid = String(p.id);
                        const name = p.title || p.name || "Untitled Project";
                        const isSelected = selectedProjectId === pid;
                        return (
                          <TouchableOpacity
                            key={pid}
                            activeOpacity={0.7}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setSelectedProjectId(pid);
                            }}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                              paddingHorizontal: 14,
                              paddingVertical: 10,
                              borderRadius: 10,
                              borderWidth: 1.5,
                              marginRight: 8,
                              backgroundColor: isSelected ? ACCENT_GREEN : "transparent",
                              borderColor: isSelected ? ACCENT_GREEN : (darkMode ? "rgba(255,255,255,0.2)" : "rgba(60,60,67,0.2)"),
                            }}
                          >
                            <Ionicons name="folder-outline" size={18} color={isSelected ? "#fff" : COLORS.text} />
                            <Text style={{
                              fontSize: 15,
                              fontWeight: "600",
                              color: isSelected ? "#fff" : COLORS.text,
                            }} numberOfLines={1}>{name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              )}

              {/* Event Details */}
              <View style={{ marginBottom: 32 }}>
                <Text style={{
                  fontSize: 13,
                  fontWeight: "600",
                  letterSpacing: 0.3,
                  marginBottom: 8,
                  marginLeft: 4,
                  opacity: 0.9,
                  color: COLORS.subtext,
                }}>EVENT DETAILS</Text>
                <View style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  backgroundColor: darkMode ? "#1C1C1E" : "#FFFFFF",
                }}>
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    minHeight: 44,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: darkMode ? "rgba(255,255,255,0.06)" : "rgba(60,60,67,0.12)",
                  }}>
                    <Text style={{ fontSize: 17, fontWeight: "400", width: 110, color: COLORS.text }}>Title</Text>
                    <TextInput
                      style={{ flex: 1, fontSize: 17, paddingVertical: 12, paddingHorizontal: 0, color: COLORS.text }}
                      value={eventTitle}
                      onChangeText={setEventTitle}
                      placeholder="e.g., Framing Inspection"
                      placeholderTextColor={darkMode ? "#E5E7EB" : "#C7C7CC"}
                    />
                  </View>
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    minHeight: 44,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: darkMode ? "rgba(255,255,255,0.06)" : "rgba(60,60,67,0.12)",
                  }}>
                    <Text style={{ fontSize: 17, fontWeight: "400", width: 110, color: COLORS.text }}>Date</Text>
                    <TextInput
                      style={{ flex: 1, fontSize: 17, paddingVertical: 12, paddingHorizontal: 0, color: COLORS.text }}
                      value={eventDate ? (() => {
                        const [year, month, day] = eventDate.split("-");
                        if (year && month && day && year.length === 4) {
                          return `${month}-${day}-${year.slice(-2)}`;
                        }
                        return eventDate;
                      })() : ""}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^\d-]/g, "");
                        let formatted = cleaned;
                        if (cleaned.length > 2 && !cleaned.includes("-")) formatted = cleaned.slice(0, 2) + "-" + cleaned.slice(2);
                        if (formatted.length > 5 && formatted.split("-").length === 2) formatted = formatted.slice(0, 5) + "-" + formatted.slice(5, 7);
                        if (formatted.length > 8) formatted = formatted.slice(0, 8);
                        setEventDate(formatted);
                      }}
                      placeholder="MM-DD-YY"
                      placeholderTextColor={darkMode ? "#E5E7EB" : "#C7C7CC"}
                    />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, minHeight: 44 }}>
                    <Text style={{ fontSize: 17, fontWeight: "400", width: 110, color: COLORS.text }}>Time</Text>
                    <TextInput
                      style={{ flex: 1, fontSize: 17, paddingVertical: 12, paddingHorizontal: 0, color: COLORS.text }}
                      value={eventTime}
                      onChangeText={setEventTime}
                      placeholder="09:00"
                      placeholderTextColor={darkMode ? "#E5E7EB" : "#C7C7CC"}
                    />
                  </View>
                </View>
              </View>

              {/* Type */}
              <View style={{ marginBottom: 32 }}>
                <Text style={{
                  fontSize: 13,
                  fontWeight: "600",
                  letterSpacing: 0.3,
                  marginBottom: 8,
                  marginLeft: 4,
                  opacity: 0.9,
                  color: COLORS.subtext,
                }}>TYPE</Text>
                <View style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  backgroundColor: darkMode ? "#1C1C1E" : "#FFFFFF",
                  padding: 12,
                }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    {(["inspection", "work", "delivery", "payment", "deadline", "other"] as const).map((type) => (
                      <TouchableOpacity
                        key={type}
                        activeOpacity={0.7}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setEventType(type);
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 10,
                          borderWidth: 1.5,
                          backgroundColor: eventType === type ? EVENT_TYPE_COLORS[type] : "transparent",
                          borderColor: eventType === type ? EVENT_TYPE_COLORS[type] : (darkMode ? "rgba(255,255,255,0.2)" : "rgba(60,60,67,0.2)"),
                        }}
                      >
                        <Feather
                          name={EVENT_TYPE_FORM_ICONS[type] as any}
                          size={18}
                          color={eventType === type ? "#fff" : COLORS.text}
                          strokeWidth={2}
                        />
                        <Text style={{ fontSize: 15, fontWeight: "600", color: eventType === type ? "#fff" : COLORS.text }}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Additional Info */}
              <View style={{ marginBottom: 32 }}>
                <Text style={{
                  fontSize: 13,
                  fontWeight: "600",
                  letterSpacing: 0.3,
                  marginBottom: 8,
                  marginLeft: 4,
                  opacity: 0.9,
                  color: COLORS.subtext,
                }}>ADDITIONAL INFO</Text>
                <View style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  backgroundColor: darkMode ? "#1C1C1E" : "#FFFFFF",
                }}>
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    minHeight: 44,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: darkMode ? "rgba(255,255,255,0.06)" : "rgba(60,60,67,0.12)",
                  }}>
                    <Text style={{ fontSize: 17, fontWeight: "400", width: 110, color: COLORS.text }}>Subcontractor</Text>
                    <TextInput
                      style={{ flex: 1, fontSize: 17, paddingVertical: 12, paddingHorizontal: 0, color: COLORS.text }}
                      value={eventSubcontractor}
                      onChangeText={setEventSubcontractor}
                      placeholder="e.g., ABC Electric"
                      placeholderTextColor={darkMode ? "#E5E7EB" : "#C7C7CC"}
                    />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, minHeight: 100 }}>
                    <Text style={{ fontSize: 17, fontWeight: "400", width: 110, paddingTop: 12, color: COLORS.text }}>Notes</Text>
                    <TextInput
                      style={{ flex: 1, fontSize: 17, paddingVertical: 12, paddingHorizontal: 0, minHeight: 80, color: COLORS.text }}
                      value={eventNotes}
                      onChangeText={setEventNotes}
                      placeholder="Additional details..."
                      placeholderTextColor={darkMode ? "#E5E7EB" : "#C7C7CC"}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View style={{ marginTop: 16, gap: 12 }}>
                {editingEvent && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleDeleteEvent}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      paddingVertical: 14,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: darkMode ? "rgba(255,59,48,0.5)" : "rgba(255,59,48,0.3)",
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    <Text style={{ fontSize: 17, fontWeight: "600", color: "#ef4444" }}>Delete Event</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSaveEvent}
                  style={{
                    paddingVertical: 16,
                    borderRadius: 12,
                    alignItems: "center",
                    backgroundColor: darkMode ? ACCENT_GREEN : COLORS.green,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 17, fontWeight: "600" }}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const DashboardScreen: React.FC = () => {
  useRequireAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => getStyles(Colors, getTabScrollContentBottomInset(insets.bottom)),
    [Colors, insets.bottom]
  );
  const { dashboardMetrics, activeProjects, estimates } = useProjectList();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiPmMode, setAiPmMode] = useState<boolean>(true);
  const [aiData, setAiData] = useState<AiDashboardResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [timelineProgress, setTimelineProgress] = useState<Record<string, number>>({});
  
  // Debounce refs for project changes
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastProjectsHashRef = useRef<string>('');

  const user = {
    name: "Nick Lafontaine",
    initials: "NL",
  };

  // Load timeline progress from AsyncStorage (same as projects page — pre-scan, title fallback)
  const loadTimelineProgress = useCallback(async () => {
    const all = [...activeProjects, ...estimates];
    const progressMap: Record<string, number> = {};
    const normalizeKey = (v: string) =>
      String(v || '').trim().toLowerCase().replace(/\s+/g, '-');

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const timelineKeys = allKeys.filter(
        (k) => k.startsWith('bps.timeline.v2.') || k.startsWith('timeline_')
      );

      // Pre-scan ALL timeline keys → suffix→progress (deposit excluded)
      const suffixToProgress: Record<string, number> = {};
      for (const k of timelineKeys) {
        const suffix = k.startsWith('bps.timeline.v2.')
          ? k.replace('bps.timeline.v2.', '')
          : k.startsWith('timeline_')
            ? k.replace('timeline_', '')
            : '';
        if (!suffix) continue;
        try {
          const raw = await AsyncStorage.getItem(k);
          if (raw) {
            const milestones = JSON.parse(raw);
            if (Array.isArray(milestones)?.length) {
              const pct = computeOverallPctFromItems(milestones);
              const suffixLower = suffix.toLowerCase();
              const suffixNorm = normalizeKey(suffix);
              suffixToProgress[suffixLower] = pct;
              suffixToProgress[suffixNorm] = pct;
              suffixToProgress[suffix] = pct;
            }
          }
        } catch {
          /* ignore */
        }
      }

      // Resolve progress for each project (pid, title, slug)
      for (const project of all) {
        const pid = String(project?.id ?? '');
        if (!pid) continue;
        const titleRaw = String(project?.title ?? project?.name ?? '').trim().toLowerCase();
        const titleSlug = normalizeKey(titleRaw);
        const titleCompact = titleRaw.replace(/\s+/g, '');
        const candidates = [pid, titleRaw, titleSlug, titleCompact, pid.toLowerCase()].filter(Boolean);
        let foundProgress: number | undefined;
        for (const c of candidates) {
          foundProgress = suffixToProgress[c] ?? suffixToProgress[normalizeKey(c)];
          if (foundProgress !== undefined) break;
        }
        if (foundProgress !== undefined) {
          progressMap[pid] = foundProgress;
          if (titleRaw) progressMap[titleRaw] = foundProgress;
          if (titleSlug) progressMap[titleSlug] = foundProgress;
        }
      }
    } catch {
      // Keep UI responsive if storage read fails
    }

    setTimelineProgress(progressMap);
  }, [activeProjects, estimates]);

  useEffect(() => {
    loadTimelineProgress();
  }, [loadTimelineProgress]);

  // Reload timeline progress when dashboard is focused (to catch updates from other screens)
  useFocusEffect(
    useCallback(() => {
      loadTimelineProgress();
    }, [loadTimelineProgress])
  );

  // Compute projects hash for change detection
  const computeProjectsHash = useCallback(() => {
    const validStatuses = ['bid_submitted', 'submitted', 'won', 'in_progress', 'active', 'completed'];
    const allProjects = [...activeProjects, ...estimates]
      .filter(p => {
        if (!p || !p.id) return false;
        const status = (p.status || '').toString().toLowerCase();
        return validStatuses.includes(status);
      })
      .map(p => ({
        id: String(p.id),
        status: p.status,
        bidPrice: p.bidPrice || 0,
        estimatedCost: p.estimatedCost || 0,
        actualCost: p.actualCost || 0,
        margin: p.margin || 0,
        updatedAt: p.updatedAt,
      }));
    
    // Simple hash: sort by id and stringify
    const sorted = allProjects.sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify(sorted);
  }, [activeProjects, estimates]);

  // Fetch AI insights function (reusable for manual refresh)
  const fetchAiData = useCallback(async (forceRefresh = false) => {
    if (!aiPmMode && !forceRefresh) {
      setAiData(null);
      setAiError(null);
      return;
    }

    try {
      setAiLoading(true);
      setAiError(null);

      // Get userId from Clerk auth
      const authState = clerkAuthService.getAuthState();
      const userId = authState.user?.id || authState.user?.email || 'unknown';

      // Get all projects from context to send to AI
      const validStatuses = ['bid_submitted', 'submitted', 'won', 'in_progress', 'active', 'completed'];
      const allProjects = [...activeProjects, ...estimates]
        .filter(p => {
          if (!p || !p.id) return false;
          const status = (p.status || '').toString().toLowerCase();
          return validStatuses.includes(status);
        })
        .map((p) => {
          const bidPrice = Number(p.bidPrice || 0);
          const estimatedCost = Number(p.estimatedCost || 0);

          // Compute actualCost from expenses if not directly available
          const expensesList: any[] = p.projectData?.expenses || p.expenses || [];
          const expensesTotal = expensesList.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
          const actualCost = Number(p.actualCost || p.projectData?.totalSpent || p.totalSpent || expensesTotal || 0);

          // Compute margin % from financials (don't trust a stored 0 when we can calculate it)
          const computedMarginPct = bidPrice > 0 && estimatedCost > 0
            ? ((bidPrice - estimatedCost) / bidPrice) * 100
            : Number(p.margin || 0);

          return {
            id: String(p.id),
            userId: userId,
            name: p.title,
            title: p.title,
            status: p.status,
            bidPrice,
            estimatedCost,
            actualCost,
            margin: computedMarginPct,
            markup: p.markup || 0,
            location: p.location || '',
            city: p.city,
            state: p.state,
            projectType: p.projectType,
            startDate: p.startDate,
            endDate: p.endDate,
            progress: p.progress || 0,
            overallProgressPct: p.overallProgressPct || p.progress || 0,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            lineItems: p.estimateData?.materialLineItems || p.projectData?.buckets || [],
            receipts: p.projectData?.receipts || [],
            hasReceiptsAttached: Boolean(p.projectData?.receipts?.length),
            hasPermitFees: Boolean(p.estimateData?.hasPermitFees || p.projectData?.hasPermitFees),
            permitFeesIncluded: Boolean(p.estimateData?.permitFeesIncluded || p.projectData?.permitFeesIncluded),
            // Extra fields for PM intelligence engine
            expenses: expensesList,
            expensesCount: expensesList.length,
            committedPOs: Number(p.projectData?.committedPOs || 0),
          };
        });

      const response = await apiService.post<AiDashboardResponse>(
        "/api/ai/dashboard-insights",
        { userId, projects: allProjects, forceRefresh },
        {
          // This endpoint supports optional auth and can use userId from body.
          // Force-empty Authorization to avoid stale/expired token failures.
          headers: { Authorization: '' },
        }
      );

      if (__DEV__) {
        console.log('📊 AI Dashboard Response:', {
          insightsCount: response.data?.insights?.length || 0,
          nextStepsCount: response.data?.nextSteps?.length || 0,
          projectsSent: allProjects.length,
          firstInsight: response.data?.insights?.[0],
        });
      }

      // Convert project IDs to strings for consistent comparison
      // Reuse validStatuses from above (line 226)
      const currentProjects = [...activeProjects, ...estimates].filter(p => {
        const status = (p.status || '').toString().toLowerCase();
        return validStatuses.includes(status);
      });
      const currentProjectIds = new Set(
        currentProjects.map(p => String(p.id))
      );
      const currentProjectNames = new Set(
        currentProjects.map(p => String(p.title || p.name || '').toLowerCase().trim())
      );
      
      // Filter out insights for deleted/invalid projects, keep everything else
      const filteredData = {
        ...response.data,
        insights: (response.data.insights || []).filter((insight: any) => {
          // If the insight is tied to a specific project, only keep it if that project still exists
          if (insight.projectId) {
            return currentProjectIds.has(String(insight.projectId));
          }
          // General insights (no projectId) are always kept
          return true;
        }),
        nextSteps: (response.data.nextSteps || []).filter((step: any) => {
          // If the next step is tied to a specific project, only keep it if that project still exists
          if (step.projectId) {
            return currentProjectIds.has(String(step.projectId));
          }
          // General next steps (no projectId) are always kept
          return true;
        }),
      };
      
      if (__DEV__) {
        console.log('📊 After filtering:', {
          originalInsights: response.data?.insights?.length || 0,
          filteredInsights: filteredData.insights.length,
          originalNextSteps: response.data?.nextSteps?.length || 0,
          filteredNextSteps: filteredData.nextSteps.length,
        });
      }
      
      setAiData(filteredData);
    } catch (err: any) {
      // Check for route not found first
      const isRouteNotFound = 
        err.message?.includes("Route") && err.message?.includes("not found") ||
        err.message?.includes("Endpoint not found") ||
        err.status === 404 ||
        err.isNotFound;

      if (isRouteNotFound) {
        if (__DEV__) {
          console.log("ℹ️  AI dashboard endpoint not available, skipping AI insights");
        }
        setAiData(null);
        setAiError(null);
        return;
      }

      // Check for network errors
      const isNetworkError = 
        err.message?.includes("Network request failed") || 
        err.message?.includes("Failed to fetch") ||
        err.message?.includes("NetworkError") ||
        err.message?.includes("Cannot connect to backend") ||
        err.isNetworkError ||
        (err.name === "TypeError" && err.message?.includes("Network"));

      if (isNetworkError) {
        if (__DEV__) {
          console.warn("⚠️  Cannot connect to backend for AI insights:", err.message);
        }
        setAiData(null);
        setAiError(null);
        return;
      }

      // For other errors, log appropriately
      if (__DEV__) {
        console.warn("⚠️  AI dashboard fetch error:", err.message || err);
      }

      let errorMessage = "Could not load AI insights";
      if (err.message) {
        if (err.message.includes("OpenAI API key") || err.message.includes("AI service unavailable")) {
          errorMessage = "AI service not configured. Please set up OpenAI API key.";
        } else if (err.message.includes("status: 500")) {
          errorMessage = "Server error. Please try again later.";
        } else if (
          err.message.includes("status: 401") ||
          err.message.includes("status: 403") ||
          err.message.toLowerCase().includes("invalid or expired token")
        ) {
          errorMessage = "Authentication error. Please sign in again.";
        } else {
          setAiError(null);
          return;
        }
      }
      setAiError(errorMessage);
    } finally {
      setAiLoading(false);
    }
  }, [aiPmMode, activeProjects, estimates]);

  // Debounced effect: only fetch when projects actually change (after 10 second debounce)
  useEffect(() => {
    if (!aiPmMode) {
      setAiData(null);
      setAiError(null);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      return;
    }

    // Compute current projects hash
    const currentHash = computeProjectsHash();
    
    // If hash hasn't changed, don't refetch
    if (currentHash === lastProjectsHashRef.current && aiData !== null) {
      return;
    }

    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce: wait 10 seconds after last project change before fetching
    debounceTimerRef.current = setTimeout(() => {
      lastProjectsHashRef.current = currentHash;
      fetchAiData(false);
    }, 10000); // 10 seconds debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [aiPmMode, activeProjects, estimates, computeProjectsHash, fetchAiData, aiData]);

  // Initial fetch when AI PM mode is toggled ON (no debounce)
  useEffect(() => {
    if (aiPmMode && !aiData && !aiLoading) {
      const currentHash = computeProjectsHash();
      lastProjectsHashRef.current = currentHash;
      fetchAiData(false);
    }
  }, [aiPmMode]); // Only depend on aiPmMode for initial fetch

  // Periodic refresh: every 5 minutes, but only refresh rule-based checks
  // (AI layer is cached, so we don't need to call OpenAI every 5 min)
  useEffect(() => {
    if (!aiPmMode) return;

    const interval = setInterval(() => {
      // Only refresh if we have data (don't spam on initial load)
      if (aiData) {
        fetchAiData(false); // This will use cache if hash hasn't changed
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [aiPmMode, aiData, fetchAiData]);

  // Manual refresh function (bypasses cache)
  const handleManualRefresh = useCallback(() => {
    fetchAiData(true); // Force refresh
  }, [fetchAiData]);

  // Filter AI insights to exclude deleted projects only
  const filteredInsights = useMemo(() => {
    if (!aiData?.insights) return [];
    
    // Get current valid project IDs
    const validStatuses = ['bid_submitted', 'submitted', 'won', 'in_progress', 'active', 'completed'];
    const currentProjects = [...activeProjects, ...estimates].filter(p => {
      const status = (p.status || '').toString().toLowerCase();
      return validStatuses.includes(status);
    });
    const currentProjectIds = new Set(
      currentProjects.map(p => String(p.id))
    );
    
    // Simple filter: if insight has a projectId, only keep if that project exists
    // General insights (no projectId) are always kept
    return aiData.insights.filter((insight) => {
      if (insight.projectId) {
        return currentProjectIds.has(String(insight.projectId));
      }
      // General insights always shown
      return true;
    });
  }, [aiData?.insights, activeProjects, estimates]);

  const filteredNextSteps = useMemo(() => {
    if (!aiData?.nextSteps) return [];
    // Only include projects with valid statuses (active, submitted, in-progress)
    const validStatuses = ['bid_submitted', 'submitted', 'won', 'in_progress', 'active', 'completed'];
    const currentProjects = [...activeProjects, ...estimates].filter(p => {
      const status = (p.status || '').toString().toLowerCase();
      return validStatuses.includes(status);
    });
    const currentProjectIds = new Set(
      currentProjects.map(p => String(p.id))
    );
    
    return aiData.nextSteps.filter((step) => {
      if (!step.projectId) {
        // For next steps without projectId, check if label mentions a deleted project
        const stepText = String(step.label || '').toLowerCase();
        if (stepText.includes('josh')) {
          return false; // Filter out next steps mentioning "josh remodel"
        }
        return true; // Keep general next steps
      }
      // Convert step.projectId to string for comparison
      const stepProjectId = String(step.projectId);
      if (currentProjectIds.has(stepProjectId)) {
        return true; // Project ID matches, keep it
      }
      
      // Fallback: Check if step mentions a deleted project by name
      const stepText = String(step.label || '').toLowerCase();
      if (stepText.includes('josh')) {
        return false; // Filter out next steps mentioning "josh remodel"
      }
      
      return false; // Project doesn't exist, filter it out
    });
  }, [aiData?.nextSteps, activeProjects, estimates]);

  // Transform projects data - only show submitted and above (hide draft/estimate)
  const projects = useMemo(() => {
    return [...activeProjects, ...estimates]
      .filter((p) => {
        const status = (p.status || 'draft').toString().toLowerCase();
        // Only show projects that are submitted or beyond (hide draft/estimate)
        return status !== 'draft' && 
               status !== 'estimate' && 
               (status === 'bid_submitted' || 
                status === 'submitted' || 
                status === 'won' || 
                status === 'in_progress' || 
                status === 'active' || 
                status === 'completed');
      })
      .map((p) => {
        const status = p.status || "draft";
        let displayStatus = "Draft";
        if (status === "estimate") displayStatus = "Draft";
        else if (status === "bid_submitted") displayStatus = "Submitted";
        else if (status === "won") displayStatus = "Active";
        else if (status === "in_progress") displayStatus = "Active";
        else if (status === "completed") displayStatus = "Completed";
        else displayStatus = status.charAt(0).toUpperCase() + status.slice(1);

        const revenue = getProjectRevenue(p);
        const margin = p.margin || 0;
        const marginRatio = Math.abs(margin) > 1 ? margin / 100 : margin;

        const pid = String(p?.id ?? '');
        const progressPct = deriveUnifiedProgressPct(p, pid, timelineProgress);
        const rawProgress = progressPct / 100; // Convert to 0-1
        const finalProgress = status === 'completed' ? 1.0 : rawProgress;

        return {
          id: p.id,
          name: p.title || "Untitled Project",
          status: displayStatus,
          location: p.location || "Unknown, Unknown",
          progress: finalProgress,
          amount: revenue,
          margin: marginRatio * 100,
          marginDisplay: `${(marginRatio * 100).toFixed(1)}% margin`,
          dateLabel: p.endDate
            ? status === "completed"
              ? `Completed ${formatDateShort(p.endDate)}`
              : `Due ${formatDateShort(p.endDate)}`
            : "No due date",
          rawProject: p,
        };
      });
  }, [activeProjects, estimates, timelineProgress]);

  // Calculate metrics
  // NOTE: This recalculates whenever activeProjects or estimates change
  const metrics = useMemo(() => {
    // Deduplicate projects by ID to avoid double-counting
    const allProjectsMap = new Map<string, any>();
    [...activeProjects, ...estimates].forEach((p) => {
      if (p?.id) {
        const id = String(p.id);
        // If project exists in both arrays, prefer the one from activeProjects (more up-to-date)
        if (!allProjectsMap.has(id) || activeProjects.some(ap => String(ap.id) === id)) {
          allProjectsMap.set(id, p);
        }
      }
    });
    const deduplicatedProjects = Array.from(allProjectsMap.values());
    
    const pipelineTotals = computePipelineTotals(deduplicatedProjects);
    // Always use computed value - don't fallback to dashboardMetrics which may be stale
    // If totalBidValue is 0, it means there are no valid projects, so 0 is correct
    const totalBids = pipelineTotals.totalBidValue;
    // activeProjectsValue should only include active projects (not submitted), so don't fallback to totalBids
    const activeProjectsValue = pipelineTotals.activeProjectsValue;
    
    const avgMargin =
      projects.length > 0
        ? projects.reduce((sum, p) => sum + (p.margin || 0), 0) / projects.length
        : 0;

    const result = {
      totalBids: formatMoneyUSD(totalBids),
      activeProjects: formatMoneyUSD(activeProjectsValue),
      avgMargin: `${avgMargin.toFixed(1)}%`,
      completedProfit: formatMoneyUSD(pipelineTotals.completedProfit),
      rawCompletedProfit: pipelineTotals.completedProfit,
      // Include raw values for debugging
      _rawTotalBids: totalBids,
      _rawActiveProjects: activeProjectsValue,
    };
    
    return result;
  }, [activeProjects, estimates, projects]);

  const handleProjectPress = useCallback(
    (project: any) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push("/(tabs)/projects");
    },
    [router]
  );

  const handleTabPress = useCallback(
    (tab: TabKey) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveTab(tab);
    },
    []
  );

  // Active projects = currently in progress (won, in_progress) — excludes completed
  const activeCount = useMemo(() => {
    return projects.filter((p) => p.status === "Active").length;
  }, [projects]);

  // Completed projects count
  const completedCount = useMemo(() => {
    return projects.filter((p) => p.status === "Completed").length;
  }, [projects]);

  // Total projects (active + completed) for avg value when mixing
  const activeWonCount = activeCount + completedCount;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />

      {/* Background */}
      <View style={StyleSheet.absoluteFill} />

        <ScrollView
        contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {/* HEADER */}
          <TabScreenHeader
            style={styles.headerRow}
            title={t('dashboard.title')}
            subtitle={`${t('dashboard.welcome')}, ${user.name}`}
            titleColor={Colors.text}
            subtitleColor={darkMode ? "#FFFFFF" : "#475569"}
            belowTitle={(() => {
              const aiStatusText = aiPmMode
                ? "AI PM Active"
                : "AI monitoring paused · Manual mode";
              const isDark = darkMode;
              const aiStatusColor = aiPmMode
                ? (isDark ? "#6ee7b7" : "#16a34a")
                : (isDark ? "#FFFFFF" : "#94A3B8");
              const dotColor = aiPmMode
                ? "#22c55e"
                : (isDark ? "#FFFFFF" : "#94A3B8");
              const ruleBasedTime = aiData?.ruleBasedUpdatedAt
                ? formatTimeShort(aiData.ruleBasedUpdatedAt)
                : null;
              const aiTime = aiData?.aiUpdatedAt
                ? formatTimeShort(aiData.aiUpdatedAt)
                : null;

              return (
                <View style={styles.aiStatusRow}>
                  <View
                    style={[
                      styles.aiDot,
                      { backgroundColor: dotColor },
                    ]}
                  />
                  <Text style={[styles.aiStatusText, { color: aiStatusColor }]}>
                    {aiStatusText}
                  </Text>
                  {aiPmMode && aiData && (
                    <View style={styles.aiTimestampContainer}>
                      {ruleBasedTime && (
                        <Text style={styles.aiTimestampText}>
                          Data: {ruleBasedTime}
                        </Text>
                      )}
                      {aiTime && (
                        <Text style={styles.aiTimestampText}>
                          AI: {aiTime}
                        </Text>
                      )}
                      {!aiLoading && (
                        <Pressable
                          onPress={handleManualRefresh}
                          style={styles.refreshButton}
                        >
                          <Ionicons name="refresh" size={14} color={aiStatusColor} />
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })()}
            right={
              <LinearGradient
                colors={["#22c55e", "#22d3ee"]}
                style={styles.profileOuter}
              >
                <Pressable
                  style={styles.profileInner}
                  onPress={() => router.push("/profile")}
                >
                  <Text style={styles.profileInitials}>{user.initials}</Text>
                </Pressable>
              </LinearGradient>
            }
          />

        {/* SEGMENTED CONTROL */}
        <View style={styles.wideContainer}>
          <BlurView intensity={35} tint={darkMode ? "dark" : "light"} style={styles.segmentContainer}>
            <View style={styles.segmentInner}>
            <SegmentTab
              label={t('dashboard.overview')}
              icon="grid-outline"
              isActive={activeTab === "overview"}
              onPress={() => handleTabPress("overview")}
            />
            <SegmentTab
              label={t('dashboard.analytics')}
              icon="bar-chart-outline"
              isActive={activeTab === "analytics"}
              onPress={() => handleTabPress("analytics")}
            />
            <SegmentTab
              label="Calendar"
              icon="calendar"
              isActive={activeTab === "calendar"}
              onPress={() => handleTabPress("calendar")}
            />
            <SegmentTab
              label={t('dashboard.insights')}
              icon="bulb-outline"
              isActive={activeTab === "insights"}
              onPress={() => handleTabPress("insights")}
            />
          </View>
        </BlurView>
        </View>

        {/* CONTENT */}
        {activeTab === "overview" && (
          <OverviewSection
            metrics={metrics}
            projects={projects}
            onProjectPress={handleProjectPress}
            onViewAllPress={() => router.push("/(tabs)/projects")}
            onCreateEstimate={() => router.push("/(tabs)/estimate-generator")}
            aiPmMode={aiPmMode}
            aiData={aiData}
            aiLoading={aiLoading}
            aiError={aiError}
            filteredInsights={filteredInsights}
            filteredNextSteps={filteredNextSteps}
          />
        )}
        {activeTab === "analytics" && (
          <AnalyticsSection
            metrics={metrics}
            dashboardMetrics={dashboardMetrics}
            activeCount={activeCount}
            activeWonCount={activeWonCount}
            completedCount={completedCount}
            activeProjects={activeProjects}
            estimates={estimates}
          />
        )}
        {activeTab === "calendar" && (
          <MasterCalendarView
            activeProjects={activeProjects}
            estimates={estimates}
          />
        )}
        {activeTab === "insights" && (
          <InsightsSection
            projects={projects}
            filteredNextSteps={filteredNextSteps}
            aiPmMode={aiPmMode}
            aiLoading={aiLoading}
            aiError={aiError}
            aiData={aiData}
          />
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* FLOATING AI PROJECT MANAGER MODE BADGE */}
      <Pressable
        style={styles.aiFloatingWrapper}
        onPress={() => setAiPmMode((prev) => !prev)}
      >
        <LinearGradient
          colors={aiPmMode ? ["#22c55e", "#22d3ee"] : ["#4b5563", "#020617"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiFloating}
        >
          <Ionicons
            name="sparkles"
            size={18}
            color={aiPmMode ? "#020617" : "#e5e7eb"}
          />
          <Text style={styles.aiFloatingText}>
            {aiPmMode ? t('dashboard.aiPmModeOn') : t('dashboard.aiPmModeOff')}
          </Text>
        </LinearGradient>
      </Pressable>

      {/* AI Assistant Modal */}
      <AIAssistantModal
        visible={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        context={JSON.stringify({
          screen: "Dashboard",
          aiScope: "portfolio",
          allProjects: [...activeProjects, ...estimates].map((p) => {
            const st = ((p as any).status || '').toLowerCase();
            const isActive = ['won', 'active', 'in_progress', 'in-progress'].includes(st);
            const isCompleted = st === 'completed';
            return {
              id: p.id,
              title: p.title,
              customerName: (p as any).client || p.title,
              status: (p as any).status,
              isActive,
              isCompleted,
              bidPrice: p.bidPrice || 0,
              estimatedCost: p.estimatedCost || 0,
              totalBudget: p.estimatedCost || p.bidPrice || 0,
            };
          }),
        })}
      />
    </SafeAreaView>
  );
};

type SegmentProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  onPress: () => void;
};

const SegmentTab: React.FC<SegmentProps> = ({ label, icon, isActive, onPress }) => {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  
  if (isActive) {
    return (
      <LinearGradient
        colors={["#22c55e", "#22d3ee"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.segmentTab, styles.segmentTabActive]}
      >
        <Pressable onPress={onPress}>
          <View style={styles.segmentTabInner}>
            <Ionicons name={icon} size={16} color="#050B13" />
            <Text style={[styles.segmentLabel, styles.segmentLabelActive]}>
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
      style={styles.segmentTab}
    >
      <View style={styles.segmentTabInner}>
        <Ionicons name={icon} size={16} color={darkMode ? "#FFFFFF" : Colors.sub} />
        <Text style={styles.segmentLabel}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
};

/* ----------------- ENHANCED METRIC CARD ----------------- */

const EnhancedMetricCard = ({
  gradient,
  label,
  value,
  timeframe,
  trend,
  trendDirection,
  context,
}: {
  gradient?: boolean;
  label: string;
  value: string;
  timeframe: string;
  trend: string;
  trendDirection: "up" | "down";
  context: string;
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  };

  const CardWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    gradient ? (
      <LinearGradient
        colors={["#22c55e", "#22d3ee"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.metricGradientCard}
      >
        {children}
      </LinearGradient>
    ) : label === "Active Projects" ? (
      <View style={styles.metricCardSecondary}>{children}</View>
    ) : (
      <LinearGradient
        colors={["#1AD0B2", "#0088FF", "#003E66"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.metricGradientCard}
      >
        {children}
      </LinearGradient>
    );

  return (
    <Animated.View
      style={[
        styles.metricOuter,
        { transform: [{ scale }] },
      ]}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{ flex: 1 }}
      >
        <CardWrapper>
          <View style={styles.metricTopRow}>
            <View style={styles.metricIconCircle}>
              <Ionicons
                name={trendDirection === "up" ? "trending-up" : "trending-down"}
                size={16}
                color={gradient || label === "Avg Margin" ? "#020617" : "#22d3ee"}
                  />
                </View>
          </View>
          <Text style={[styles.metricValue, (gradient || label === "Avg Margin") && { color: "#020617" }]}>
            {value}
          </Text>
          <Text style={[styles.metricLabel, (gradient || label === "Avg Margin") && { color: "#020617aa" }]}>
            {label}
          </Text>

          <View style={styles.metricBottomRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{timeframe}</Text>
                  </View>
            <View style={styles.trendRow}>
              <MaterialIcons
                name={trendDirection === "up" ? "north-east" : "south-east"}
                size={14}
                color={trendDirection === "up" ? "#16a34a" : "#f97316"}
              />
              <Text
                style={[
                  styles.trendText,
                  trendDirection === "up"
                    ? { color: "#16a34a" }
                    : { color: "#f97316" },
                ]}
              >
                {trend}
              </Text>
                </View>
              </View>

          <Text
            style={[
              styles.metricContext,
              (gradient || label === "Avg Margin") && { color: "#020617bb" },
            ]}
          >
            {context}
                  </Text>
        </CardWrapper>
      </Pressable>
    </Animated.View>
  );
};

/* ----------------- NEXT STEP ITEM ----------------- */

const NextStepItem = ({ label, chip }: { label: string; chip: string }) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  
  return (
    <View style={styles.nextStepRow}>
      <View style={styles.nextStepBullet} />
      <Text style={styles.nextStepLabel}>{label}</Text>
      <View style={styles.nextStepChip}>
        <Text style={styles.nextStepChipText}>{chip}</Text>
      </View>
    </View>
  );
};

/* ----------------- AI INSIGHT ITEM ----------------- */

const InsightItem = ({
  type,
  title,
  body,
}: {
  type: "alert" | "opportunity" | "info";
  title: string;
  body: string;
}) => {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const [showTooltip, setShowTooltip] = useState(false);
  
  const iconMap: Record<typeof type, keyof typeof Ionicons.glyphMap> = {
    alert: "warning",
    opportunity: "star",
    info: "information-circle",
  };
  const colorMap: Record<typeof type, string> = {
    alert: "#f97316",
    opportunity: "#22c55e",
    info: "#22d3ee",
  };

  // Transform body text to use less certain language
  const transformedBody = useMemo(() => {
    // Replace "This could indicate potential issues..." with less certain language
    if (body.toLowerCase().includes("could indicate") && body.toLowerCase().includes("potential issues")) {
      return body.replace(
        /This could indicate potential issues[^.]*/gi,
        "Once the project begins, this may indicate potential issues if costs aren't tracked."
      );
    }
    // Also catch variations like "This could indicate..." or "could indicate potential..."
    if (body.toLowerCase().includes("could indicate")) {
      return body.replace(
        /(This\s+)?could indicate[^.]*potential issues[^.]*/gi,
        "Once the project begins, this may indicate potential issues if costs aren't tracked."
      );
    }
    return body;
  }, [body]);

  return (
    <View style={styles.insightRow}>
      <View style={[styles.insightIconCircle, { borderColor: colorMap[type] }]}>
        <Ionicons name={iconMap[type]} size={16} color={colorMap[type]} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.insightTitle}>{title}</Text>
          <Pressable
            onPress={() => setShowTooltip(!showTooltip)}
            style={{ padding: 4 }}
          >
            <Ionicons 
              name="information-circle-outline" 
              size={14} 
              color={darkMode ? "#FFFFFF" : "#6b7280"} 
            />
          </Pressable>
        </View>
        {showTooltip && (
          <View style={{
            backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            borderRadius: 8,
            padding: 8,
            marginTop: 4,
            marginBottom: 4,
          }}>
            <Text style={{
              color: darkMode ? '#FFFFFF' : '#374151',
              fontSize: 11,
              lineHeight: 16,
            }}>
              Insights improve as real costs are added.
            </Text>
          </View>
        )}
        <Text style={styles.insightBody}>{transformedBody}</Text>
      </View>
    </View>
  );
};

/* ----------------- OVERVIEW ----------------- */

interface OverviewSectionProps {
  metrics: {
    totalBids: string;
    activeProjects: string;
    avgMargin: string;
    completedProfit: string;
    rawCompletedProfit: number;
  };
  projects: any[];
  onProjectPress: (project: any) => void;
  onViewAllPress: () => void;
  onCreateEstimate: () => void;
  aiPmMode: boolean;
  aiData: AiDashboardResponse | null;
  aiLoading: boolean;
  aiError: string | null;
  filteredInsights: any[];
  filteredNextSteps: any[];
}

const OverviewSection: React.FC<OverviewSectionProps> = ({
  metrics,
  projects,
  onProjectPress,
  onViewAllPress,
  onCreateEstimate,
  aiPmMode,
  aiData,
  aiLoading,
  aiError,
  filteredInsights,
  filteredNextSteps,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  /** Collapsed by default — long lists expand on demand; preview still shows first N */
  const [aiInsightsExpanded, setAiInsightsExpanded] = useState(false);
  const insightCount = filteredInsights.length;
  const INSIGHT_PREVIEW_COUNT = 3;
  const showPreviewPanel =
    aiPmMode && !aiLoading && !aiError && insightCount > 0 && !aiInsightsExpanded;
  const insightsHiddenCount = Math.max(0, insightCount - INSIGHT_PREVIEW_COUNT);

  const aiInsightsCollapsedHint = useMemo(() => {
    if (aiLoading) return "Analyzing your projects…";
    if (aiError) return aiError;
    if (!aiPmMode) return "Turn on AI PM Mode to see insights.";
    if (insightCount === 0) return "No major issues detected. Tap to expand.";
    return `${insightCount} insight${insightCount === 1 ? "" : "s"} · Tap to expand`;
  }, [aiLoading, aiError, aiPmMode, insightCount]);

  const toggleAiInsights = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAiInsightsExpanded((prev) => !prev);
  }, []);

  return (
    <>
      {/* KEY METRICS */}
      <View style={[styles.sectionHeaderRow, styles.overviewKeyMetricsAiInsights]}>
        <View>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <Text style={styles.sectionSubtitle}>This month at a glance</Text>
                    </View>
        <Text style={styles.linkText}>Swipe ➜</Text>
                  </View>

        <View
          style={[
            styles.metricsRow,
            styles.wideContainer,
            styles.overviewKeyMetricsAiInsights,
            styles.overviewKeyMetricsBottomSpacing,
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 24 }}
          >
          <EnhancedMetricCard
            gradient
            label="Total Bids"
            value={metrics.totalBids}
            timeframe="This Month"
            trend="+12.5%"
            trendDirection="up"
            context="12% under expected at this phase"
          />
          <EnhancedMetricCard
            label="Projects"
            value={metrics.activeProjects}
            timeframe="In Progress"
            trend="+4.1%"
            trendDirection="up"
            context="3 jobs flagged for review"
          />
          <EnhancedMetricCard
            label="Avg Margin"
            value={metrics.avgMargin}
            timeframe="This Month"
            trend="-1.2%"
            trendDirection="down"
            context="Slightly below your 35% target"
          />
        </ScrollView>
                  </View>

      {/* AI INSIGHTS PANEL */}
      <Pressable
        onPress={toggleAiInsights}
        style={({ pressed }) => [
          styles.sectionHeaderRow,
          styles.aiInsightsHeaderTopSpacing,
          { alignItems: "center" },
          pressed && { opacity: 0.88 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          aiInsightsExpanded
            ? "Collapse AI insights section"
            : "Expand AI insights section"
        }
        accessibilityState={{ expanded: aiInsightsExpanded }}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.sectionTitle}>AI Insights for Today</Text>
          <Text style={styles.sectionSubtitle}>What your AI project manager sees</Text>
        </View>
        <Ionicons
          name={aiInsightsExpanded ? "chevron-up" : "chevron-down"}
          size={22}
          color={Colors.sub}
        />
      </Pressable>

      {!aiInsightsExpanded && !showPreviewPanel && (
        <View
          style={[
            styles.wideContainer,
            styles.aiInsightsSectionBottomSpacing,
          ]}
        >
          <Text style={styles.aiInsightsCollapsedHint}>{aiInsightsCollapsedHint}</Text>
        </View>
      )}

      {showPreviewPanel && (
        <View
          style={[
            styles.wideContainer,
            styles.aiInsightsSectionBottomSpacing,
          ]}
        >
          <LinearGradient
            colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
            start={{ x: 0.05, y: 0.15 }}
            end={{ x: 0.95, y: 0.85 }}
            style={styles.aiPanelBorder}
          >
            <View style={styles.aiPanelInner}>
              {filteredInsights.slice(0, INSIGHT_PREVIEW_COUNT).map((insight) => (
                <InsightItem
                  key={insight.id}
                  type={insight.type}
                  title={insight.title}
                  body={insight.body}
                />
              ))}
              {insightsHiddenCount > 0 && (
                <Pressable
                  onPress={toggleAiInsights}
                  style={({ pressed }) => [
                    styles.aiInsightsShowMoreRow,
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${insightsHiddenCount} more insights`}
                >
                  <Text style={styles.aiInsightsShowMoreText}>
                    +{insightsHiddenCount} more insight{insightsHiddenCount === 1 ? "" : "s"} — tap to show all
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#22c55e" />
                </Pressable>
              )}
            </View>
          </LinearGradient>
        </View>
      )}

      {aiInsightsExpanded && (
      <View
        style={[
          styles.wideContainer,
          styles.aiInsightsSectionBottomSpacing,
          !aiPmMode && { opacity: 0.4 },
        ]}
      >
        <LinearGradient
          colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={styles.aiPanelBorder}
        >
          <View style={styles.aiPanelInner}>
            {aiError && (
              <Text style={styles.aiPanelPausedText}>{aiError}</Text>
            )}

            {!aiError && !aiPmMode && (
              <View style={styles.aiEmptyState}>
                <Ionicons name="sparkles-outline" size={32} color={Colors.sub} style={{ marginBottom: 12 }} />
                <Text style={styles.aiEmptyStateTitle}>
                  Turn on AI PM Mode
                </Text>
                <Text style={styles.aiPanelPausedText}>
                  Get your daily brief with smart insights and next steps
                </Text>
              </View>
            )}

            {!aiError && aiPmMode && aiLoading && (
              <Text style={styles.aiPanelPausedText}>Analyzing your projects…</Text>
            )}

            {!aiError && aiPmMode && !aiLoading && (aiData?.insights ?? []).length === 0 && (
              <Text style={styles.aiPanelPausedText}>
                No major issues detected. All projects look on track.
              </Text>
            )}

            {aiPmMode &&
              !aiLoading &&
              !aiError &&
              filteredInsights.map((insight) => (
                <InsightItem
                  key={insight.id}
                  type={insight.type}
                  title={insight.title}
                  body={insight.body}
                />
              ))}
          </View>
        </LinearGradient>
      </View>
      )}

      {/* ALL PROJECTS */}
      {(() => {
        const totalProjects = projects.length;
        const activeProjectsCount = projects.filter(
          (p: any) => p.status === "Active"
        ).length;

        const ProjectSummaryCard = ({
          project,
        }: {
          project: any;
        }) => (
          <Pressable
            style={styles.projectSummaryWrapper}
            onPress={() => onProjectPress(project)}
          >
              <View
                style={[
                  styles.projectSummaryBorder,
                  Colors.bg !== '#000000' && { borderWidth: 1, borderColor: Colors.line },
                ]}
              >
                <View style={styles.projectSummaryCard}>
                <View style={styles.projectSummaryRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text 
                      style={styles.projectSummaryName}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {project.name}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <Text style={styles.projectSummaryAmount}>
                        {formatMoneyUSD(project.amount)}
                      </Text>
                      {aiPmMode && (
                        <View style={styles.aiTagChip}>
                          <Ionicons
                            name="sparkles-outline"
                            size={10}
                            color="#22C55E"
                          />
                          <Text
                            style={[
                              styles.aiTagText,
                              { color: "#22C55E" },
                            ]}
                          >
                            AI
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusPillBase,
                      {
                        backgroundColor: (statusTheme[project.status] ?? statusTheme.Draft).bg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillTextBase,
                        { color: (statusTheme[project.status] ?? statusTheme.Draft).color },
                      ]}
                    >
                      {project.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.projectSummaryProgress}>
                  <View style={styles.progressBarTrack}>
                    <LinearGradient
                      colors={['#22c55e', '#14b8a6', '#0ea5e9']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(Math.max(project.progress * 100, 0), 100)}%`,
                          opacity: Colors.bg === '#000000' ? 1 : 0.9, // Slightly reduced opacity in light mode
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressPercent}>
                    {Math.round(project.progress * 100)}%
                  </Text>
                </View>
                </View>
              </View>
          </Pressable>
        );

  return (
          <View style={styles.allProjectsContainer}>
            <LinearGradient
              colors={["#2DFFC4", "#00A6FF"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={{
                borderRadius: 20,
                padding: 1,
                marginBottom: 16,
              }}
            >
              <View style={{
                backgroundColor: Colors.bg === '#000000' ? Colors.card : Colors.cardDark,
                borderRadius: 18,
                padding: 12,
              }}>
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text style={styles.cardTitle}>{t('dashboard.allProjects')}</Text>
                    <Text style={styles.cardSubtitle}>
                      {totalProjects} {t('dashboard.total')} · {activeProjectsCount} {t('dashboard.active')}
                    </Text>
                  </View>
                  <Pressable onPress={onViewAllPress}>
                    <Text style={styles.linkText}>{t('dashboard.viewAll')}</Text>
                  </Pressable>
                </View>

                {projects.length === 0 ? (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyStateIconCircle}>
                      <Ionicons name="document-text-outline" size={32} color="#22c55e" />
                    </View>
                    <Text style={styles.emptyStateText}>No projects yet</Text>
                    <Text style={styles.emptyStateSubtext}>
                      Create your first estimate to get started
                    </Text>
                    <Pressable
                      onPress={onCreateEstimate}
                      style={styles.emptyStateCTA}
                    >
                      <LinearGradient
                        colors={["#22c55e", "#22d3ee"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.emptyStateCTAGradient}
                      >
                        <Ionicons name="add" size={18} color="#020617" />
                        <Text style={styles.emptyStateCTAText}>Create First Estimate</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                ) : projects.length >= 4 ? (
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    style={styles.allProjectsListScroll}
                    contentContainerStyle={styles.allProjectsListScrollContent}
                    keyboardShouldPersistTaps="handled"
                  >
                    {projects.map((project) => (
                      <ProjectSummaryCard key={project.id} project={project} />
                    ))}
                  </ScrollView>
                ) : (
                  <View style={{ marginTop: 12 }}>
                    {projects.map((project) => (
                      <ProjectSummaryCard key={project.id} project={project} />
                    ))}
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>
        );
      })()}

    </>
  );
};

/* ----------------- ANALYTICS ----------------- */

interface AnalyticsSectionProps {
  metrics: {
    totalBids: string;
    activeProjects: string;
    avgMargin: string;
    completedProfit: string;
    rawCompletedProfit: number;
  };
  dashboardMetrics: any;
  activeCount: number;
  activeWonCount: number;
  completedCount: number;
  activeProjects: any[];
  estimates: any[];
}

const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({
  metrics,
  dashboardMetrics,
  activeCount,
  activeWonCount,
  completedCount,
  activeProjects,
  estimates,
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  // Simple avg project value for the snapshot card
  const avgProjectValue = useMemo(() => {
    const rawTotal = metrics.totalBids; // e.g. "$44K"

    const numeric = parseFloat(rawTotal.replace(/[^\d.]/g, "")); // 44
    if (!numeric || !activeWonCount) return "$0";

    // If the string contains "K", treat it as thousands
    const isThousands = /K/i.test(rawTotal);
    const totalValue = isThousands ? numeric * 1000 : numeric; // 44,000

    return formatMoneyCompact(totalValue / activeWonCount);
  }, [metrics.totalBids, activeWonCount]);

  return (
    <>
      {/* Top snapshot card (4 mini metrics) */}
      <View style={[styles.analyticsSection, styles.wideContainer]}>
        <LinearGradient
          colors={["#2DFFC4", "#00A6FF"]}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={{
            borderRadius: 20,
            padding: 1,
            marginBottom: 16,
          }}
        >
          <View style={{
            backgroundColor: Colors.bg === '#000000' ? Colors.card : Colors.cardDark,
            borderRadius: 18,
            padding: 16,
          }}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>Performance Snapshot</Text>
                <Text style={styles.cardSubtitle}>Key metrics at a glance</Text>
              </View>
            </View>

            <View style={styles.analyticsGrid}>
              <AnalyticsMetric label="Total Bids" value={metrics.totalBids} />
              <AnalyticsMetric
                label="Active Projects"
                value={activeCount.toString()}
              />
              <AnalyticsMetric
                label="Avg Project Value"
                value={avgProjectValue}
              />
              <AnalyticsMetric
                label="Avg Margin"
                value={metrics.avgMargin}
                extra="+0.0%"
              />
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Deeper charts / profit analytics */}
      <View style={[styles.analyticsSection, styles.wideContainer]}>
        <ProfileAnalytics
          activeWonCount={activeCount}
          completedCount={completedCount}
          projectTypeStats={dashboardMetrics?.projectTypeStats}
          overviewProfit={metrics.rawCompletedProfit ?? 0}
          completedProjects={[...activeProjects, ...estimates].filter(
            (p) => (p.status || "").toString().toLowerCase() === "completed"
          )}
        />
      </View>
    </>
  );
};

const AnalyticsMetric = ({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: string;
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  
  // Get icon and color for each metric type
  const isDark = Colors.bg === '#000000';
  const getMetricConfig = (label: string) => {
    const baseConfigs: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; darkBg: string; lightBg: string }> = {
      "Total Bids": { icon: "cash-outline", color: "#3b82f6", darkBg: Colors.surface2, lightBg: "#E2E8F0" },
      "Active Projects": { icon: "folder-outline", color: "#22c55e", darkBg: Colors.surface2, lightBg: "#E2E8F0" },
      "Avg Project Value": { icon: "trending-up-outline", color: "#22d3ee", darkBg: Colors.surface2, lightBg: "#E2E8F0" },
      "Avg Margin": { icon: "pie-chart-outline", color: "#a78bfa", darkBg: Colors.surface2, lightBg: "#E2E8F0" },
    };
    const config = baseConfigs[label] || { icon: "stats-chart-outline", color: "#FFFFFF", darkBg: Colors.surface2, lightBg: "#E2E8F0" };
    return {
      icon: config.icon,
      color: config.color,
      bgColor: isDark ? config.darkBg : config.lightBg,
    };
  };

  const config = getMetricConfig(label);

  return (
    <View
      style={[
        styles.analyticsMetricInner,
        !isDark && { borderWidth: 1, borderColor: Colors.line },
      ]}
    >
      <View style={[styles.analyticsMetricIconContainer, { backgroundColor: config.bgColor }]}>
        <Ionicons name={config.icon} size={19} color={config.color} />
      </View>
      <View style={styles.analyticsMetricContent}>
        <Text style={styles.analyticsLabel}>{label}</Text>
        <Text style={styles.analyticsValue}>{value}</Text>
        {extra ? (
          <View style={styles.analyticsExtraContainer}>
            <Text style={styles.analyticsExtra}>{extra}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

/* ----------------- INSIGHTS ----------------- */

interface InsightsSectionProps {
  projects: any[];
  filteredNextSteps: any[];
  aiPmMode: boolean;
  aiLoading: boolean;
  aiError: string | null;
  aiData: AiDashboardResponse | null;
}

const InsightsSection: React.FC<InsightsSectionProps> = ({
  projects,
  filteredNextSteps,
  aiPmMode,
  aiLoading,
  aiError,
  aiData,
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  
  const urgentProjects = useMemo(() => {
    return projects.filter(
      (p) =>
        (p.status === "Active" || p.status === "In Progress") &&
        p.progress < 0.3 &&
        p.dateLabel.includes("Due")
    );
  }, [projects]);

  const avgMargin =
    projects.length > 0
      ? projects.reduce((sum, p) => sum + (p.margin || 0), 0) / projects.length
      : 0;

  return (
    <>
      <View style={styles.wideContainer}>
        <LinearGradient
          colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={styles.nextStepsBorder}
        >
          <View style={styles.nextStepsInner}>
            <Text style={styles.insightsCardTitle}>AI Insights</Text>
            <Text style={styles.insightsBodyText}>
              {avgMargin > 80 && (
                <>
                  Your average margin is trending above {avgMargin.toFixed(1)}%. Consider raising
                  your minimum markup on new bids.
                  {"\n\n"}
                </>
              )}
              {urgentProjects.length > 0 && (
                <>
                  {urgentProjects.length} project{urgentProjects.length > 1 ? "s are" : " is"} under-utilizing your labor team. Shift crew from completed jobs to in-progress
                  work to finish sooner.
                </>
              )}
              {urgentProjects.length === 0 && avgMargin <= 80 && (
                <>
                  Smart suggestions about your bids, margins, and project risks will appear here
                  as you add more projects.
                </>
              )}
            </Text>
          </View>
        </LinearGradient>
      </View>

      {/* NEXT STEPS */}
      <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
        <View>
          <Text style={styles.sectionTitle}>Next Steps for You</Text>
          <Text style={styles.sectionSubtitle}>Quick actions to stay ahead</Text>
        </View>
      </View>

      <View style={styles.wideContainer}>
        <LinearGradient
          colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={styles.nextStepsBorder}
        >
          <View style={styles.nextStepsInner}>
            {aiPmMode && aiLoading && (
              <Text style={styles.aiPanelPausedText}>Building your next steps…</Text>
            )}

            {aiPmMode &&
              !aiLoading &&
              !aiError &&
              (filteredNextSteps.length >= 4 ? (
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  style={styles.nextStepsListScroll}
                  contentContainerStyle={styles.nextStepsListScrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredNextSteps.map((step, index) => (
                    <NextStepItem
                      key={step.id ? `${step.id}-${index}` : `step-${index}`}
                      label={step.label}
                      chip={step.chip}
                    />
                  ))}
                </ScrollView>
              ) : (
                filteredNextSteps.map((step, index) => (
                  <NextStepItem
                    key={step.id ? `${step.id}-${index}` : `step-${index}`}
                    label={step.label}
                    chip={step.chip}
                  />
                ))
              ))}

            {!aiPmMode && (
              <View style={styles.aiEmptyState}>
                <Ionicons name="checkmark-circle-outline" size={32} color={Colors.sub} style={{ marginBottom: 12 }} />
                <Text style={styles.aiEmptyStateTitle}>
                  Turn on AI PM Mode
                </Text>
                <Text style={styles.aiPanelPausedText}>
                  Get personalized next steps based on your projects
                </Text>
              </View>
            )}

            {aiPmMode && !aiLoading && (aiData?.nextSteps ?? []).length === 0 && (
              <Text style={styles.aiPanelPausedText}>
                No immediate actions needed. Keep up the great work!
              </Text>
            )}
          </View>
        </LinearGradient>
      </View>
    </>
  );
};

/* ----------------- STYLES ----------------- */

const getStyles = (Colors: any, scrollBottomInset: number = 120) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    paddingTop: ScreenLayout.screen.paddingTop,
    paddingHorizontal: ScreenLayout.edge.horizontal,
    paddingBottom: scrollBottomInset,
  },
  glossOverlay: {
    position: "absolute",
    top: -120,
    left: -60,
    right: -60,
    height: 260,
    backgroundColor: "rgba(15,23,42,0.6)",
  },

  // HEADER (TabScreenHeader handles vertical spacing; wide bleed for segments)
  headerRow: {
    marginHorizontal: -ScreenLayout.edge.horizontal,
    paddingHorizontal: 8,
  },
  titleGlow: {
    position: "absolute",
    left: -16,
    top: -8,
    width: 180,
    height: 56,
    opacity: 0.22,
    borderRadius: 999,
  },
  aiStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  aiDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#22c55e",
    marginRight: 6,
  },
  aiStatusText: {
    fontSize: 12,
    color: "#6ee7b7", // Will be overridden inline, but keep as fallback
  },
  aiTimestampContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    gap: 8,
  },
  aiTimestampText: {
    fontSize: 10,
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.sub,
    opacity: 1,
  },
  refreshButton: {
    padding: 4,
    marginLeft: 4,
  },
  aiEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  aiEmptyStateTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 8,
  },
  profileOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 2,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#22c55e",
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
  },
  profileInner: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: Colors.card,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitials: {
    color: Colors.text,
    fontWeight: "700",
    fontSize: 16,
  },

  // SEGMENTED CONTROL
  slideHintContainer: {
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  slideHintText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#22c55e",
    textAlign: "center",
    textTransform: "lowercase",
  },
  segmentContainer: {
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1, // Match projects page border width
    borderColor: "#19E180", // Green border for both dark and light mode
    marginBottom: 18,
  },
  segmentScrollView: {
    flexGrow: 0,
  },
  segmentInner: {
    flexDirection: "row",
    padding: 4,
    backgroundColor: Colors.bg === '#000000' ? "transparent" : Colors.surface2,
    minWidth: "100%",
  },
  segmentTab: {
    flex: 1,
    borderRadius: 999,
    marginHorizontal: 1,
  },
  segmentTabActive: {
    backgroundColor: Colors.bg === '#000000' ? "transparent" : "#FFFFFF",
    shadowColor: Colors.bg === '#000000' ? "#22c55e" : "#000",
    shadowOpacity: Colors.bg === '#000000' ? 0.4 : 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  segmentTabInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 6,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
  },
  segmentLabelActive: {
    color: Colors.bg === '#000000' ? "#050B13" : "#071018",
  },

  // GENERIC CARD
  card: {
    borderRadius: ScreenLayout.card.radius,
    padding: ScreenLayout.card.padding,
    backgroundColor: Colors.card,
    borderWidth: Colors.bg === '#000000' ? 1 : 0,
    borderColor: Colors.line,
    marginBottom: ScreenLayout.card.marginBottom,
    shadowColor: Colors.bg === '#000000' ? "#000" : "#0F172A",
    shadowOpacity: Colors.bg === '#000000' ? 0.4 : 0.05,
    shadowRadius: Colors.bg === '#000000' ? 18 : 10,
    shadowOffset: { width: 0, height: Colors.bg === '#000000' ? 10 : 4 },
    elevation: Colors.bg === '#000000' ? 0 : 2,
  },
  allProjectsCard: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  allProjectsContainer: {
    marginBottom: 16,
    marginHorizontal: -20,
    paddingHorizontal: 4,
    paddingTop: 16,
  },
  /** Cap height when 4+ projects so the list scrolls inside the card */
  allProjectsListScroll: {
    marginTop: 12,
    maxHeight: 340,
  },
  allProjectsListScrollContent: {
    paddingBottom: 8,
  },
  /** Insights tab: Next Steps list when 4+ items */
  nextStepsListScroll: {
    maxHeight: 340,
  },
  nextStepsListScrollContent: {
    paddingBottom: 8,
  },
  analyticsCardWide: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingVertical: 18,
    borderWidth: 0,
  },
  analyticsSection: {
    marginBottom: 16,
  },
  performanceSnapshotCard: {
    backgroundColor: "transparent", // gradient handles the fill
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: Colors.bg === '#000000' ? 1 : 0,
    borderColor: Colors.bg === '#000000' ? "#102131" : Colors.line,
    marginBottom: 16,
    shadowColor: Colors.bg === '#000000' ? "transparent" : "#0F172A",
    shadowOpacity: Colors.bg === '#000000' ? 0 : 0.05,
    shadowRadius: Colors.bg === '#000000' ? 0 : 10,
    shadowOffset: { width: 0, height: Colors.bg === '#000000' ? 0 : 4 },
    elevation: Colors.bg === '#000000' ? 0 : 2,
  },
  analyticsGradient: {
    width: "100%",
    borderRadius: 22,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 22, // Slightly larger
    fontWeight: Colors.bg === '#000000' ? "700" : "800", // Heavier in light mode
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.bg === '#000000' ? "#FFFFFF" : "#475569", // slate-600 for better contrast
  },
  /** Insights tab — AI Insights card title + body (larger, easier to read) */
  insightsCardTitle: {
    fontSize: 24,
    fontWeight: Colors.bg === '#000000' ? "700" : "800",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
    letterSpacing: -0.3,
  },
  insightsBodyText: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 23,
    color: Colors.bg === '#000000' ? "#F3F4F6" : "#475569",
  },
  insightsSectionTitle: {
    fontSize: 20,
    fontWeight: Colors.bg === '#000000' ? "700" : "800",
    color: Colors.bg === '#000000' ? "#e5e7eb" : "#0F172A",
    letterSpacing: -0.2,
  },
  insightsSectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    color: Colors.bg === '#000000' ? "#FFFFFF" : "#64748b",
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#15E08A",
  },

  // METRICS
  metricRow: {
    flexDirection: "row",
    gap: 12,
    paddingRight: 20,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  metricCard: {
    width: 200,
    borderRadius: 26,
    padding: 16,
    justifyContent: "space-between",
    minHeight: 140,
  },
  metricCardSecondary: {
    width: 200,
    borderRadius: 26,
    padding: 16,
    backgroundColor: "#0A2641",
    justifyContent: "space-between",
    minHeight: 140,
  },
  metricIconPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E5F7FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricIconPillSecondary: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E5F7FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  metricValueSecondary: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  metricLabel: {
    marginTop: 2,
    fontSize: 14,
    color: "#E6F5FF",
  },
  metricLabelSecondary: {
    marginTop: 2,
    fontSize: 14,
    color: "#E6F5FF",
  },
  metricFooterRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(4, 16, 30, 0.75)",
  },
  metricChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  metricDeltaText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E5FFF3",
  },
  metricChipSecondary: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#062033",
  },
  metricChipTextSecondary: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E5F7FF",
  },

  // PROJECTS
  projectCard: {
    marginTop: 8,
    borderRadius: 20, // Slightly smaller
    backgroundColor: Colors.bg === '#000000' ? "transparent" : Colors.surface2, // Match Projects page card grey in light mode
    overflow: "hidden",
    borderWidth: Colors.bg === '#000000' ? 1 : 0,
    borderColor: Colors.bg === '#000000' ? "#102131" : Colors.line,
    shadowColor: Colors.bg === '#000000' ? "#000" : "#0F172A",
    shadowOpacity: Colors.bg === '#000000' ? 0.4 : 0.05,
    shadowRadius: Colors.bg === '#000000' ? 18 : 10,
    shadowOffset: { width: 0, height: Colors.bg === '#000000' ? 10 : 4 },
    elevation: Colors.bg === '#000000' ? 0 : 2,
  },
  projectCardGradient: {
    width: "100%",
    borderRadius: 24,
    padding: 16,
  },
  projectTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  projectName: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
  },
  projectLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  projectLocationText: {
    fontSize: 13,
    color: Colors.bg === '#000000' ? "#FFFFFF" : "#475569",
  },
  statusPillBase: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillTextBase: {
    fontSize: 13,
    fontWeight: '700',
  },
  projectMiddleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 10,
  },
  projectAmount: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
  },
  projectMetaText: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.bg === '#000000' ? "#FFFFFF" : "#475569",
  },
  projectMetaLabel: {
    fontSize: 12,
    color: Colors.bg === '#000000' ? "#FFFFFF" : "#475569",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 8,
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.bg === '#000000' ? "#1B2938" : "#CBD5E1", // Darker track in light mode
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    borderRadius: 999,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.bg === '#000000' ? "#E5F7FF" : Colors.text,
  },
  progressLabel: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.bg === '#000000' ? "#FFFFFF" : "#475569",
  },
  aiTagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.2)",
    borderWidth: 1,
    borderColor: "rgba(187,247,208,0.3)",
  },
  aiTagText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#BBF7D0",
    letterSpacing: 0.3,
  },

  // PROJECT SUMMARY CARDS
  projectSummaryWrapper: {
    marginTop: 8,
  },
  projectSummaryBorder: {
    borderRadius: 20,
    padding: 1,
  },
  projectSummaryCard: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.bg === '#000000' ? Colors.surface2 : Colors.surface2,
    borderWidth: Colors.bg === '#000000' ? 1 : 0,
    borderColor: Colors.line,
  },
  projectSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  projectSummaryName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
    flexShrink: 1,
  },
  projectSummaryAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.bg === '#000000' ? "#FFFFFF" : "#475569",
    marginTop: 4,
  },
  projectSummaryProgress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  // ANALYTICS
  analyticsGrid: {
    flexDirection: "column",
    marginTop: 16,
    gap: 10,
  },
  analyticsMetricBorder: {
    width: "48%",
    borderRadius: 16,
    padding: 1,
    marginBottom: 2,
  },
  analyticsMetricInner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface2, // Match All Projects cards in both modes
    borderRadius: 12,
    padding: 14,
    borderWidth: 1, // Match project card border in light mode without resizing
    borderColor: Colors.line,
  },
  analyticsMetricCard: {
    width: "48%",
    backgroundColor: "transparent",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: Colors.bg === '#000000' ? 1 : 0,
    borderColor: Colors.line,
    shadowColor: Colors.bg === '#000000' ? "transparent" : "#0F172A",
    shadowOpacity: Colors.bg === '#000000' ? 0 : 0.05,
    shadowRadius: Colors.bg === '#000000' ? 0 : 10,
    shadowOffset: { width: 0, height: Colors.bg === '#000000' ? 0 : 4 },
    elevation: Colors.bg === '#000000' ? 0 : 2,
  },
  analyticsMetricGradient: {
    width: "100%",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  analyticsMetricIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  analyticsMetricContent: {
    flex: 1,
    minWidth: 0,
  },
  analyticsLabel: {
    fontSize: 11, // Slightly larger
    color: Colors.bg === '#000000' ? "#FFFFFF" : "#334155",
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
    lineHeight: 12,
  },
  analyticsValue: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
    letterSpacing: -0.4,
    lineHeight: 24,
    marginBottom: 2,
  },
  analyticsExtraContainer: {
    marginTop: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    alignSelf: "flex-start",
  },
  analyticsExtra: {
    fontSize: 10,
    color: "#4ade80",
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  // EMPTY STATE
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    marginTop: 16,
  },
  emptyStateIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.sub,
    marginTop: 6,
    textAlign: "center",
    maxWidth: 240,
  },
  emptyStateCTA: {
    marginTop: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  emptyStateCTAGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyStateCTAText: {
    color: "#020617",
    fontSize: 15,
    fontWeight: "700",
  },

  // ENHANCED METRIC CARDS
  metricOuter: {
    width: width * 0.72,
    marginRight: 14,
  },
  metricGradientCard: {
    flex: 1,
    borderRadius: 24,
    padding: 16,
    minHeight: 140,
    justifyContent: "space-between",
  },
  metricTopRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  metricIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  metricBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.7)",
  },
  chipText: {
    fontSize: 11,
    color: "#e5e7eb",
    fontWeight: "600",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: "600",
  },
  metricContext: {
    fontSize: 12,
    color: "#F3F4F6",
    marginTop: 10,
  },

  // WIDE CONTAINER (matches allProjectsContainer)
  wideContainer: {
    marginHorizontal: -20,
    paddingHorizontal: 4,
  },
  /** Extra left/right inset + vertical gap between Key Metrics strip and AI Insights (Overview tab) */
  overviewKeyMetricsAiInsights: {
    paddingHorizontal: 12,
  },
  overviewKeyMetricsBottomSpacing: {
    marginBottom: 24,
  },
  aiInsightsHeaderTopSpacing: {
    marginTop: 4,
  },

  // SECTION HEADERS
  sectionHeaderRow: {
    marginTop: 8,
    marginBottom: 10,
    marginHorizontal: -20,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: Colors.bg === '#000000' ? "700" : "800", // Heavier in light mode
    color: Colors.bg === '#000000' ? "#e5e7eb" : "#0F172A",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.bg === '#000000' ? "#FFFFFF" : "#475569", // slate-600 for better contrast
    marginTop: 2,
  },
  aiInsightsCollapsedHint: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.bg === '#000000' ? "#FFFFFF" : "#64748b",
    paddingHorizontal: 4,
  },
  aiInsightsShowMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  aiInsightsShowMoreText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.bg === '#000000' ? "#22c55e" : Colors.primary,
  },
  /** Space below AI Insights (hint, preview, or expanded card) before All Projects */
  aiInsightsSectionBottomSpacing: {
    marginBottom: 22,
  },

  // AI INSIGHTS PANEL
  aiPanelBorder: {
    borderRadius: 20,
    padding: 1,
  },
  aiPanelInner: {
    backgroundColor: Colors.bg === '#000000' ? Colors.card : Colors.surface, // Use surfaceSoft in light mode
    borderRadius: 18,
    padding: 16,
  },
  aiPanel: {
    backgroundColor: Colors.bg === '#000000' ? Colors.card : Colors.surface, // Use surfaceSoft in light mode
    borderRadius: 20,
    padding: 16,
    borderWidth: Colors.bg === '#000000' ? 1 : 0,
    borderColor: Colors.line,
    marginBottom: 16,
    shadowColor: Colors.bg === '#000000' ? "transparent" : "#0F172A",
    shadowOpacity: Colors.bg === '#000000' ? 0 : 0.05,
    shadowRadius: Colors.bg === '#000000' ? 0 : 10,
    shadowOffset: { width: 0, height: Colors.bg === '#000000' ? 0 : 4 },
    elevation: Colors.bg === '#000000' ? 0 : 2,
  },
  aiPanelWide: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  aiPanelPausedText: {
    fontSize: 12,
    color: Colors.bg === '#000000' ? Colors.sub : "#475569",
    marginBottom: 10,
  },
  insightRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  insightIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
  },
  insightBody: {
    fontSize: 12,
    color: Colors.bg === '#000000' ? "#FFFFFF" : "#475569",
    marginTop: 2,
  },

  // NEXT STEPS
  nextStepsBorder: {
    borderRadius: 20,
    padding: 1,
    marginBottom: 16,
  },
  nextStepsInner: {
    backgroundColor: Colors.bg === '#000000' ? Colors.card : Colors.surface, // Use surfaceSoft in light mode
    borderRadius: 18,
    padding: 18,
  },
  nextStepsCard: {
    marginTop: 4,
    borderRadius: 20,
    backgroundColor: Colors.bg === '#000000' ? Colors.card : Colors.surface, // Use surfaceSoft in light mode
    borderWidth: Colors.bg === '#000000' ? 1 : 0,
    borderColor: Colors.line,
    padding: 14,
    marginBottom: 16,
    shadowColor: Colors.bg === '#000000' ? "transparent" : "#0F172A",
    shadowOpacity: Colors.bg === '#000000' ? 0 : 0.05,
    shadowRadius: Colors.bg === '#000000' ? 0 : 10,
    shadowOffset: { width: 0, height: Colors.bg === '#000000' ? 0 : 4 },
    elevation: Colors.bg === '#000000' ? 0 : 2,
  },
  nextStepsCardWide: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  nextStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
    paddingVertical: 2,
  },
  nextStepBullet: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#22c55e",
    marginRight: 10,
    marginTop: 6,
  },
  nextStepLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.bg === '#000000' ? "#f1f5f9" : Colors.text,
  },
  nextStepChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.22)",
    marginLeft: 8,
    marginTop: 2,
    flexShrink: 0,
  },
  nextStepChipText: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.bg === '#000000' ? "#86efac" : "#166534",
    fontWeight: "600",
  },

  // FLOATING AI BADGE
  aiFloatingWrapper: {
    position: "absolute",
    right: 20,
    bottom: 100, // Raised above tab bar with more spacing
    zIndex: 10,
  },
  aiFloating: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: "#22c55e",
    shadowOpacity: 0.8,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8, // Android shadow
  },
  aiFloatingText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#020617",
  },
});
export default DashboardScreen;

