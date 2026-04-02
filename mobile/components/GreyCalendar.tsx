import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';

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
  events?: Array<{
    date: string;
    type?: string;
    color?: string;
  }>;
}

const GreyCalendar: React.FC<GreyCalendarProps> = ({
  onDayPress,
  markedDates = {},
  initialDate,
  selectedDateString = null,
  events = [],
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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayDate = new Date(year, month, day);
      dayDate.setHours(0, 0, 0, 0);
      const isToday = dayDate.getTime() === today.getTime();
      const isSelected = Boolean(selectedDateString && dateString === selectedDateString);

      // Get events for this date
      const dayEvents = events.filter(e => e.date === dateString);
      const hasEvents = dayEvents.length > 0;

      const dayNumberStyle = isSelected
        ? styles.dayTextSelected
        : isToday
          ? styles.dayTextToday
          : styles.dayText;

      days.push(
        <TouchableOpacity
          key={day}
          style={styles.dayCell}
          onPress={() => handleDayPress(day)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.dayInner,
              isSelected && styles.dayInnerSelected,
              isToday && !isSelected && styles.dayInnerTodayHint,
            ]}
          >
            <Text style={dayNumberStyle}>{day}</Text>
            {hasEvents && (
              <View style={styles.dayEvents}>
                {dayEvents.slice(0, 3).map((event, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.dayEventDot,
                      { backgroundColor: event.color || event.type || '#22c55e' },
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
            size={22}
            color={darkMode ? "rgba(255, 255, 255, 0.7)" : "#334155"}
          />
        </TouchableOpacity>
        <View style={styles.monthYearContainer}>
          <Text style={styles.monthYear}>
            {monthNames[month]} {year}
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
        <TouchableOpacity 
          onPress={() => navigateMonth('next')} 
          style={styles.arrowButton}
          activeOpacity={0.6}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={darkMode ? "rgba(255, 255, 255, 0.7)" : "#334155"}
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
    </View>
  );
};

const getStyles = (Colors: any, darkMode: boolean) => StyleSheet.create({
  container: {
    /* Light: surface2 reads clearly against page bg; dark unchanged */
    backgroundColor: darkMode ? '#2a2a2a' : Colors.surface2,
    borderRadius: 16,
    padding: 12,
    borderWidth: darkMode ? 0 : 1,
    borderColor: darkMode ? 'transparent' : Colors.line,
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
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface,
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
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.line,
  },
  dayNameCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  dayNameText: {
    fontSize: 11,
    fontWeight: '600',
    color: darkMode ? 'rgba(255,255,255,0.75)' : Colors.sub,
    letterSpacing: 0.4,
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
    backgroundColor: darkMode ? 'rgba(45, 255, 196, 0.22)' : 'rgba(13, 148, 136, 0.18)',
    borderWidth: 2,
    borderColor: '#2DFFC4',
  },
  dayInnerTodayHint: {
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(45, 255, 196, 0.35)' : 'rgba(13, 148, 136, 0.4)',
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
    color: darkMode ? '#ffffff' : Colors.text,
  },
  dayTextToday: {
    fontSize: 14,
    fontWeight: '700',
    color: darkMode ? '#2DFFC4' : '#0F766E',
  },
  dayTextSelected: {
    fontSize: 15,
    fontWeight: '800',
    color: darkMode ? '#FFFFFF' : '#0f172a',
  },
  dayTextHighlighted: {
    fontSize: 15,
    fontWeight: '700',
    color: darkMode ? '#ffffff' : Colors.text,
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
});

export default GreyCalendar;
