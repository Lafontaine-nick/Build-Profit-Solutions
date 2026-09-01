import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import {
  ESTIMATE_FLOW_CHIP_GREEN,
  ESTIMATE_FLOW_CHIP_GREEN_BG,
  ESTIMATE_FLOW_GREEN,
} from '@/utils/estimateFlowCardStyle';
import { EstimateJobDurationFooter } from '@/components/estimate/EstimateJobDurationFooter';

/** Lifted surface inside charcoal flow cards — lighter than #202022 for readable calendars */
const CALENDAR_SURFACE_DARK = '#2e2e30';

interface GreyCalendarProps {
  onDayPress: (day: { dateString: string }) => void;
  markedDates?: {
    [key: string]: {
      selected?: boolean;
      selectedColor?: string;
      selectedTextColor?: string;
      marked?: boolean;
      dotColor?: string;
    };
  };
  initialDate?: string;
  /** Highlighted day (YYYY-MM-DD); stronger ring + label connection in parent */
  selectedDateString?: string | null;
  /** Project schedule range — highlights start/end and days in between */
  rangeStartDate?: string | null;
  rangeEndDate?: string | null;
  /** Which schedule field is open — styles that endpoint as primary selection */
  activePicker?: 'start' | 'end' | null;
  events?: Array<{
    date: string;
    type?: string;
    color?: string;
  }>;
  /** Optional note rendered below the grid (e.g. job duration on end-date picker) */
  footer?: React.ReactNode;
  /** When true and activePicker is "end", shows job duration from rangeStartDate/rangeEndDate */
  showJobDurationFooter?: boolean;
}

const GreyCalendar: React.FC<GreyCalendarProps> = ({
  onDayPress,
  markedDates = {},
  initialDate,
  selectedDateString = null,
  rangeStartDate = null,
  rangeEndDate = null,
  activePicker = null,
  events = [],
  footer,
  showJobDurationFooter = false,
}) => {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors, darkMode), [Colors, darkMode]);

  const [currentDate, setCurrentDate] = useState(() => {
    if (initialDate) {
      return new Date(initialDate + 'T00:00:00');
    }
    return new Date();
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(new Date(year, month + (direction === 'next' ? 1 : -1), 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const parseDateKey = (dateKey: string) =>
    new Date(`${dateKey}T00:00:00`).getTime();

  const rangeBounds = useMemo(() => {
    const startTs = rangeStartDate ? parseDateKey(rangeStartDate) : null;
    const endTs = rangeEndDate ? parseDateKey(rangeEndDate) : null;
    if (startTs == null || endTs == null) {
      return { min: null as number | null, max: null as number | null };
    }
    return {
      min: Math.min(startTs, endTs),
      max: Math.max(startTs, endTs),
    };
  }, [rangeStartDate, rangeEndDate]);

  const handleDayPress = (day: number) => {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onDayPress({ dateString });
  };

  const renderDays = () => {
    const days = [];
    
    // Empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const markedConfig = markedDates[dateString] || {};
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayDate = new Date(year, month, day);
      dayDate.setHours(0, 0, 0, 0);
      const dayTimestamp = dayDate.getTime();
      const isToday = dayTimestamp === today.getTime();
      const isRangeStart = Boolean(rangeStartDate && dateString === rangeStartDate);
      const isRangeEnd = Boolean(rangeEndDate && dateString === rangeEndDate);
      const isActiveEndpoint =
        activePicker === 'start' ? isRangeStart : activePicker === 'end' ? isRangeEnd : false;
      const isOtherEndpoint =
        activePicker === 'start' ? isRangeEnd : activePicker === 'end' ? isRangeStart : false;
      const isInRange =
        rangeBounds.min != null &&
        rangeBounds.max != null &&
        dayTimestamp > rangeBounds.min &&
        dayTimestamp < rangeBounds.max;
      const isSelected = selectedDateString
        ? dateString === selectedDateString
        : isActiveEndpoint || Boolean(markedConfig.selected);
      const isMarked = Boolean(markedConfig.marked || (markedConfig.selected && !isSelected));

      // Get events for this date
      const dayEvents = events.filter(e => e.date === dateString);
      const hasEvents = dayEvents.length > 0 || isMarked;

      const dayNumberStyle = isSelected
        ? styles.dayTextSelected
        : isOtherEndpoint
          ? styles.dayTextRangeEndpoint
        : isToday
          ? styles.dayTextToday
          : styles.dayText;

      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.dayCell,
            isInRange && styles.dayCellInRange,
            isRangeStart && isInRange && styles.dayCellRangeStart,
            isRangeEnd && isInRange && styles.dayCellRangeEnd,
          ]}
          onPress={() => handleDayPress(day)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.dayInner,
              isSelected && styles.dayInnerSelected,
              !isSelected && isOtherEndpoint && styles.dayInnerRangeEndpoint,
              isToday && !isSelected && !isOtherEndpoint && styles.dayInnerTodayHint,
            ]}
          >
            <Text style={dayNumberStyle}>{day}</Text>
            {hasEvents && (
              <View style={styles.dayEvents}>
                {isMarked && (
                  <View
                    style={[
                      styles.dayEventDot,
                      { backgroundColor: markedConfig.dotColor || markedConfig.selectedColor || ESTIMATE_FLOW_CHIP_GREEN },
                    ]}
                  />
                )}
                {dayEvents.slice(0, Math.max(0, isMarked ? 2 : 3)).map((event, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.dayEventDot,
                      { backgroundColor: event.color || event.type || ESTIMATE_FLOW_GREEN },
                    ]}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <Text style={styles.dayEventMore}>+{dayEvents.length - 3}</Text>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    return days;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigateMonth('prev')} 
          style={styles.arrowButton}
          activeOpacity={0.6}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={darkMode ? 'rgba(255, 255, 255, 0.88)' : '#334155'}
          />
        </TouchableOpacity>
        <View style={styles.monthYearContainer}>
          <Text style={styles.monthYear}>
            {monthNames[month]} {year}
          </Text>
          <TouchableOpacity onPress={goToToday} style={styles.todayButton} activeOpacity={0.85}>
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          onPress={() => navigateMonth('next')} 
          style={styles.arrowButton}
          activeOpacity={0.6}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={darkMode ? 'rgba(255, 255, 255, 0.88)' : '#334155'}
          />
        </TouchableOpacity>
      </View>

      {/* Day names */}
      <View style={styles.dayNamesRow}>
        {dayNames.map((dayName) => (
          <View key={dayName} style={styles.dayNameCell}>
            <Text style={styles.dayNameText}>{dayName}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.calendarGrid}>
        {renderDays()}
      </View>

      {footer ? (
        <View style={styles.footer}>
          {footer}
        </View>
      ) : showJobDurationFooter && activePicker === 'end' ? (
        <View style={styles.footer}>
          <EstimateJobDurationFooter
            startDate={rangeStartDate}
            endDate={rangeEndDate}
            labelColor={darkMode ? 'rgba(186, 204, 224, 0.82)' : Colors.sub}
            textColor={darkMode ? '#ffffff' : Colors.text}
            darkMode={darkMode}
          />
        </View>
      ) : null}
    </View>
  );
};

const getStyles = (Colors: any, darkMode: boolean) => StyleSheet.create({
  container: {
    backgroundColor: darkMode ? CALENDAR_SURFACE_DARK : Colors.surface2,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.2)' : Colors.line,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.12)' : Colors.surface,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.22)' : Colors.line,
  },
  monthYearContainer: {
    flex: 1,
    alignItems: 'center',
  },
  monthYear: {
    fontSize: 17,
    fontWeight: '700',
    color: darkMode ? '#ffffff' : Colors.text,
    letterSpacing: 0.2,
  },
  todayButton: {
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: ESTIMATE_FLOW_CHIP_GREEN,
    backgroundColor: darkMode ? ESTIMATE_FLOW_CHIP_GREEN_BG : 'rgba(52, 211, 153, 0.08)',
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: ESTIMATE_FLOW_CHIP_GREEN,
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
  },
  dayNameCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  dayNameText: {
    fontSize: 11,
    fontWeight: '700',
    color: darkMode ? 'rgba(241, 245, 249, 0.88)' : Colors.sub,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 0.92,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayInner: {
    minWidth: 36,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 2,
  },
  dayInnerSelected: {
    backgroundColor: ESTIMATE_FLOW_CHIP_GREEN_BG,
    borderWidth: 2,
    borderColor: ESTIMATE_FLOW_CHIP_GREEN,
  },
  dayInnerRangeEndpoint: {
    backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.14)' : 'rgba(34, 197, 94, 0.08)',
    borderWidth: 2,
    borderColor: ESTIMATE_FLOW_GREEN,
  },
  dayCellInRange: {
    backgroundColor: darkMode ? 'rgba(52, 211, 153, 0.08)' : 'rgba(52, 211, 153, 0.1)',
  },
  dayCellRangeStart: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  dayCellRangeEnd: {
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  dayInnerTodayHint: {
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(52, 211, 153, 0.45)' : 'rgba(52, 211, 153, 0.4)',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: darkMode ? 'rgba(248, 250, 252, 0.96)' : Colors.text,
  },
  dayTextToday: {
    fontSize: 14,
    fontWeight: '700',
    color: ESTIMATE_FLOW_CHIP_GREEN,
  },
  dayTextSelected: {
    fontSize: 15,
    fontWeight: '800',
    color: ESTIMATE_FLOW_CHIP_GREEN,
  },
  dayTextRangeEndpoint: {
    fontSize: 15,
    fontWeight: '700',
    color: ESTIMATE_FLOW_GREEN,
  },
  dayEvents: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 2,
    gap: 2,
  },
  dayEventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dayEventMore: {
    fontSize: 8,
    marginLeft: 2,
    color: darkMode ? '#ffffff' : Colors.sub,
  },
  footer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
  },
});

export default GreyCalendar;
