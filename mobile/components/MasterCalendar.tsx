import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';
import * as Haptics from 'expo-haptics';
import { useProjectList } from '../contexts/ProjectListContext';
import type { CalendarEvent } from './ProjectCalendar';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const EVENT_TYPE_COLORS: Record<string, string> = {
  inspection: '#ef4444',
  delivery: '#3b82f6',
  work: '#22c55e',
  meeting: '#f59e0b',
  other: '#8b5cf6',
};

const EVENT_TYPE_ICONS: Record<string, string> = {
  inspection: 'clipboard-check',
  delivery: 'truck',
  work: 'hammer',
  meeting: 'people',
  other: 'calendar',
};

type MasterCalendarEvent = CalendarEvent & {
  projectId: string;
  projectName: string;
};

export default function MasterCalendar() {
  const { darkMode } = useTheme();
  const Colors = getColors(darkMode);
  const { projects } = useProjectList();
  const COLORS = darkMode
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
        bg: '#ffffff',
        surface: '#f8fafc',
        surface2: '#f1f5f9',
        text: '#0f172a',
        subtext: '#64748b',
        border: '#e2e8f0',
        green: '#22c55e',
        blue: '#22d3ee',
        red: '#ef4444',
        amber: '#f59e0b',
        purple: '#8b5cf6',
      };

  const [currentDate, setCurrentDate] = useState(new Date());
  const [allEvents, setAllEvents] = useState<MasterCalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<MasterCalendarEvent | null>(null);
  const [loading, setLoading] = useState(false);

  // Load calendar events from all projects
  const loadAllEvents = useCallback(async () => {
    try {
      setLoading(true);
      const events: MasterCalendarEvent[] = [];

      // Load events from each project
      for (const project of projects) {
        if (!project.id) continue;
        try {
          const key = `calendar_events_${project.id}`;
          const saved = await AsyncStorage.getItem(key);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              const projectEvents = parsed.map((e: CalendarEvent) => ({
                ...e,
                projectId: project.id,
                projectName: project.title || 'Untitled Project',
              }));
              events.push(...projectEvents);
            }
          }
        } catch (error) {
          console.error(`Error loading events for project ${project.id}:`, error);
        }
      }

      // Sort by date
      events.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        if (a.time && b.time) return a.time.localeCompare(b.time);
        return a.time ? -1 : b.time ? 1 : 0;
      });

      setAllEvents(events);
    } catch (error) {
      console.error('❌ Error loading all calendar events:', error);
      setAllEvents([]);
    } finally {
      setLoading(false);
    }
  }, [projects]);

  // Load events on mount and when projects change
  useEffect(() => {
    loadAllEvents();
  }, [loadAllEvents]);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days: Array<{ date: number; fullDate: Date; isCurrentMonth: boolean }> = [];
    
    // Previous month's trailing days
    const prevMonth = new Date(year, month - 1, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: prevMonthDays - i,
        fullDate: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }

    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: i,
        fullDate: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month's leading days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: i,
        fullDate: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month, daysInMonth, startingDayOfWeek]);

  // Get events for a specific date
  const getEventsForDate = (date: Date): MasterCalendarEvent[] => {
    const dateStr = date.toISOString().split('T')[0];
    return allEvents.filter((e) => e.date === dateStr && !e.completed);
  };

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Handle date selection
  const handleDatePress = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const events = getEventsForDate(date);
    if (events.length > 0) {
      setSelectedDate(dateStr);
      setSelectedEvent(events[0]);
      setShowEventModal(true);
    } else {
      setSelectedDate(dateStr);
      setShowEventModal(false);
    }
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  // Get upcoming events (next 14 days)
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextTwoWeeks = new Date(today);
    nextTwoWeeks.setDate(nextTwoWeeks.getDate() + 14);

    return allEvents
      .filter((e) => {
        if (e.completed) return false;
        const eventDate = new Date(e.date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today && eventDate <= nextTwoWeeks;
      })
      .slice(0, 10);
  }, [allEvents]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  const isToday = (date: Date) => {
    const dateCopy = new Date(date);
    dateCopy.setHours(0, 0, 0, 0);
    return dateCopy.getTime() === today.getTime();
  };

  return (
    <View style={[styles.container, { backgroundColor: COLORS.bg }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header with month navigation */}
        <View style={styles.header}>
          <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
            <Ionicons name="chevron-back" size={22} color="rgba(255, 255, 255, 0.7)" />
          </TouchableOpacity>
          <View style={styles.monthYearContainer}>
            <Text style={styles.monthYearText}>
              {MONTHS[month]} {year}
            </Text>
            <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
              <LinearGradient
                colors={['#22c55e', '#22d3ee']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.todayButtonGradient}
              >
                <Text style={styles.todayButtonText}>Today</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={22} color="rgba(255, 255, 255, 0.7)" />
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarContainer}>
          {/* Day headers */}
          <View style={styles.dayHeaders}>
            {DAYS.map((day) => (
              <Text key={day} style={styles.dayHeader}>
                {day}
              </Text>
            ))}
          </View>

          {/* Calendar days */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((day, index) => {
              const dayEvents = getEventsForDate(day.fullDate);
              const isSelected = selectedDate === day.fullDate.toISOString().split('T')[0];
              const isTodayDate = isToday(day.fullDate);

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayCell,
                    !day.isCurrentMonth && styles.dayCellOtherMonth,
                  ]}
                  onPress={() => handleDatePress(day.fullDate)}
                >
                  {isTodayDate ? (
                    <>
                      <Text style={styles.dayTextToday}>
                        {day.date}
                      </Text>
                      {dayEvents.length > 0 && (
                        <View style={styles.dayEvents}>
                          {dayEvents.slice(0, 3).map((event, eventIndex) => (
                            <View
                              key={event.id}
                              style={[
                                styles.dayEventDot,
                                { backgroundColor: EVENT_TYPE_COLORS[event.type] || EVENT_TYPE_COLORS.other },
                              ]}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <Text style={styles.dayEventMore}>
                              +{dayEvents.length - 3}
                            </Text>
                          )}
                        </View>
                      )}
                    </>
                  ) : isSelected ? (
                    <>
                      <View style={styles.dayCellSelected}>
                        <Text style={styles.dayTextHighlighted}>
                          {day.date}
                        </Text>
                      </View>
                      {dayEvents.length > 0 && (
                        <View style={styles.dayEvents}>
                          {dayEvents.slice(0, 3).map((event, eventIndex) => (
                            <View
                              key={event.id}
                              style={[
                                styles.dayEventDot,
                                { backgroundColor: '#ffffff' },
                              ]}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <Text style={styles.dayEventMore}>
                              +{dayEvents.length - 3}
                            </Text>
                          )}
                        </View>
                      )}
                    </>
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.dayText,
                          !day.isCurrentMonth && styles.dayTextOtherMonth,
                        ]}
                      >
                        {day.date}
                      </Text>
                      {dayEvents.length > 0 && (
                        <View style={styles.dayEvents}>
                          {dayEvents.slice(0, 3).map((event, eventIndex) => (
                            <View
                              key={event.id}
                              style={[
                                styles.dayEventDot,
                                { backgroundColor: EVENT_TYPE_COLORS[event.type] || EVENT_TYPE_COLORS.other },
                              ]}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <Text style={styles.dayEventMore}>
                              +{dayEvents.length - 3}
                            </Text>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <View style={styles.upcomingSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time-outline" size={20} color={COLORS.green} />
              <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Upcoming (Next 14 Days)</Text>
            </View>
            {upcomingEvents.map((event) => (
              <TouchableOpacity
                key={`${event.projectId}-${event.id}`}
                style={[styles.eventCard, { backgroundColor: COLORS.surface2, borderColor: COLORS.border }]}
                onPress={() => {
                  setSelectedEvent(event);
                  setShowEventModal(true);
                }}
              >
                <View style={[styles.eventTypeIndicator, { backgroundColor: EVENT_TYPE_COLORS[event.type] || EVENT_TYPE_COLORS.other }]} />
                <View style={styles.eventContent}>
                  <View style={styles.eventHeader}>
                    <Text style={[styles.eventTitle, { color: COLORS.text }]}>{event.title}</Text>
                    <MaterialIcons
                      name={EVENT_TYPE_ICONS[event.type] as any}
                      size={16}
                      color={EVENT_TYPE_COLORS[event.type] || EVENT_TYPE_COLORS.other}
                    />
                  </View>
                  <View style={styles.eventDetails}>
                    <Ionicons name="folder-outline" size={14} color={COLORS.subtext} />
                    <Text style={[styles.eventDetailText, { color: COLORS.subtext }]}>
                      {event.projectName}
                    </Text>
                  </View>
                  <View style={styles.eventDetails}>
                    <Ionicons name="calendar-outline" size={14} color={COLORS.subtext} />
                    <Text style={[styles.eventDetailText, { color: COLORS.subtext }]}>
                      {new Date(event.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                      {event.time && ` at ${event.time}`}
                    </Text>
                  </View>
                  {event.subcontractor && (
                    <View style={styles.eventDetails}>
                      <Ionicons name="person-outline" size={14} color={COLORS.subtext} />
                      <Text style={[styles.eventDetailText, { color: COLORS.subtext }]}>
                        {event.subcontractor}
                      </Text>
                    </View>
                  )}
                  {event.notes && (
                    <Text style={[styles.eventNotes, { color: COLORS.subtext }]} numberOfLines={2}>
                      {event.notes}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty state */}
        {allEvents.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={COLORS.subtext} />
            <Text style={[styles.emptyStateText, { color: COLORS.text }]}>No events scheduled</Text>
            <Text style={[styles.emptyStateSubtext, { color: COLORS.subtext }]}>
              Calendar events from all projects will appear here
            </Text>
          </View>
        )}

        {loading && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: COLORS.subtext }]}>Loading calendar...</Text>
          </View>
        )}
      </ScrollView>

      {/* Event Detail Modal */}
      <Modal
        visible={showEventModal && selectedEvent !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowEventModal(false);
          setSelectedEvent(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: COLORS.text }]}>Event Details</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowEventModal(false);
                  setSelectedEvent(null);
                }}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {selectedEvent && (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.eventDetailSection}>
                  <Text style={[styles.eventDetailLabel, { color: COLORS.subtext }]}>Title</Text>
                  <Text style={[styles.eventDetailValue, { color: COLORS.text }]}>{selectedEvent.title}</Text>
                </View>

                <View style={styles.eventDetailSection}>
                  <Text style={[styles.eventDetailLabel, { color: COLORS.subtext }]}>Project</Text>
                  <Text style={[styles.eventDetailValue, { color: COLORS.text }]}>{selectedEvent.projectName}</Text>
                </View>

                <View style={styles.eventDetailSection}>
                  <Text style={[styles.eventDetailLabel, { color: COLORS.subtext }]}>Date</Text>
                  <Text style={[styles.eventDetailValue, { color: COLORS.text }]}>
                    {new Date(selectedEvent.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                    {selectedEvent.time && ` at ${selectedEvent.time}`}
                  </Text>
                </View>

                <View style={styles.eventDetailSection}>
                  <Text style={[styles.eventDetailLabel, { color: COLORS.subtext }]}>Type</Text>
                  <View style={styles.eventTypeBadge}>
                    <MaterialIcons
                      name={EVENT_TYPE_ICONS[selectedEvent.type] as any}
                      size={16}
                      color={EVENT_TYPE_COLORS[selectedEvent.type] || EVENT_TYPE_COLORS.other}
                    />
                    <Text style={[styles.eventTypeText, { color: EVENT_TYPE_COLORS[selectedEvent.type] || EVENT_TYPE_COLORS.other }]}>
                      {selectedEvent.type.charAt(0).toUpperCase() + selectedEvent.type.slice(1)}
                    </Text>
                  </View>
                </View>

                {selectedEvent.subcontractor && (
                  <View style={styles.eventDetailSection}>
                    <Text style={[styles.eventDetailLabel, { color: COLORS.subtext }]}>Subcontractor</Text>
                    <Text style={[styles.eventDetailValue, { color: COLORS.text }]}>{selectedEvent.subcontractor}</Text>
                  </View>
                )}

                {selectedEvent.notes && (
                  <View style={styles.eventDetailSection}>
                    <Text style={[styles.eventDetailLabel, { color: COLORS.subtext }]}>Notes</Text>
                    <Text style={[styles.eventDetailValue, { color: COLORS.text }]}>{selectedEvent.notes}</Text>
                  </View>
                )}
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: COLORS.green }]}
                onPress={() => {
                  setShowEventModal(false);
                  setSelectedEvent(null);
                }}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  monthYearContainer: {
    flex: 1,
    alignItems: 'center',
  },
  monthYearText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
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
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#2a2a2a', // iOS-style grey background
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: '#ffffff',
    letterSpacing: 0.5,
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
    marginVertical: 3,
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
    fontSize: 15,
    fontWeight: '500',
    color: '#ffffff',
  },
  dayTextOtherMonth: {
    opacity: 0.3,
  },
  dayTextToday: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2DFFC4', // Bright teal/cyan (green-to-blue)
  },
  dayTextHighlighted: {
    fontSize: 15,
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
  dayEventMore: {
    fontSize: 8,
    marginLeft: 2,
    color: '#ffffff',
  },
  upcomingSection: {
    paddingHorizontal: 20,
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
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
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
    padding: 20,
  },
  eventDetailSection: {
    marginBottom: 20,
  },
  eventDetailLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  eventDetailValue: {
    fontSize: 16,
  },
  eventTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  eventTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
