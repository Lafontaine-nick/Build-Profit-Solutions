import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { EstimateJobDurationFooter } from '@/components/estimate/EstimateJobDurationFooter';

/** Lifted surface inside charcoal flow cards — lighter than #202022 for readable calendars */
const CALENDAR_SURFACE_DARK = '#2e2e30';
/** Light mint used for selected dates and the open date field. */
const CALENDAR_MINT = '#8eecc9';
const CALENDAR_MINT_BORDER = 'rgba(45, 204, 154, 0.55)';
const CALENDAR_MINT_WASH = 'rgba(45, 204, 154, 0.16)';

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
    /** Matches a `legend` item key so the legend lists only categories in the visible month */
    legendKey?: string;
  }>;
  /** Color key shown under the grid; items without events in the visible month are hidden */
  legend?: ReadonlyArray<{ key: string; label: string; color: string }>;
  /** Optional note rendered below the grid (e.g. job duration on end-date picker) */
  footer?: React.ReactNode;
  /** When true and activePicker is "end", shows job duration from rangeStartDate/rangeEndDate */
  showJobDurationFooter?: boolean;
  /** Drops the calendar's own surface and border when it sits inside a bordered group */
  embedded?: boolean;
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
  legend,
  footer,
  showJobDurationFooter = false,
  embedded = false,
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

  const monthLegend = useMemo(() => {
    if (!legend?.length) return [];
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const keysThisMonth = new Set(
      events
        .filter((e) => e.legendKey && e.date.startsWith(monthPrefix))
        .map((e) => e.legendKey as string)
    );
    return legend.filter((item) => keysThisMonth.has(item.key));
  }, [legend, events, year, month]);

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
            ]}
          >
            <Text style={dayNumberStyle}>{day}</Text>
            {hasEvents && (
              <View style={styles.dayEvents}>
                {isMarked && (
                  <View
                    style={[
                      styles.dayEventDot,
                      { backgroundColor: markedConfig.dotColor || markedConfig.selectedColor || CALENDAR_MINT },
                    ]}
                  />
                )}
                {dayEvents.slice(0, Math.max(0, isMarked ? 2 : 3)).map((event, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.dayEventDot,
                      { backgroundColor: event.color || event.type || CALENDAR_MINT },
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
    <View style={[styles.container, embedded && styles.containerEmbedded]}>
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

      {monthLegend.length > 0 ? (
        <View style={styles.legendRow}>
          {monthLegend.map((item) => (
            <View key={item.key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {footer ? (
        <View style={styles.footer}>
          {footer}
        </View>
      ) : showJobDurationFooter && activePicker === 'end' ? (
        <View style={styles.footer}>
          <EstimateJobDurationFooter
            startDate={rangeStartDate}
            endDate={rangeEndDate}
            labelColor={darkMode ? '#d7e1f0' : Colors.sub}
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
    width: '100%',
    alignSelf: 'stretch',
  },
  containerEmbedded: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 0,
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
    borderColor: CALENDAR_MINT_BORDER,
    backgroundColor: darkMode ? CALENDAR_MINT_WASH : 'rgba(45, 204, 154, 0.08)',
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: CALENDAR_MINT,
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
    paddingHorizontal: 1,
  },
  dayInner: {
    width: '100%',
    maxWidth: 44,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 2,
  },
  dayInnerSelected: {
    backgroundColor: CALENDAR_MINT_WASH,
    borderWidth: 2,
    borderColor: CALENDAR_MINT_BORDER,
  },
  dayInnerRangeEndpoint: {
    backgroundColor: darkMode ? CALENDAR_MINT_WASH : 'rgba(45, 204, 154, 0.08)',
    borderWidth: 2,
    borderColor: CALENDAR_MINT_BORDER,
  },
  dayCellInRange: {
    backgroundColor: darkMode ? 'rgba(45, 204, 154, 0.08)' : 'rgba(45, 204, 154, 0.1)',
  },
  dayCellRangeStart: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  dayCellRangeEnd: {
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: darkMode ? 'rgba(248, 250, 252, 0.96)' : Colors.text,
  },
  dayTextToday: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2dcc9a',
  },
  dayTextSelected: {
    fontSize: 15,
    fontWeight: '800',
    color: CALENDAR_MINT,
  },
  dayTextRangeEndpoint: {
    fontSize: 15,
    fontWeight: '700',
    color: CALENDAR_MINT,
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
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 14,
    rowGap: 6,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: darkMode ? 'rgba(255, 255, 255, 0.86)' : Colors.sub,
  },
  footer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
  },
});

export default GreyCalendar;
