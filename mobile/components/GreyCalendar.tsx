import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

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
  events = [],
}) => {
  useEffect(() => {
    if (__DEV__) {
      console.log('📅 GreyCalendar: Received events:', events.length);
      if (events.length > 0) {
        console.log('📅 GreyCalendar: Sample events:', events.slice(0, 3));
      }
    }
  }, [events]);

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

      // Get events for this date
      const dayEvents = events.filter(e => e.date === dateString);
      const hasEvents = dayEvents.length > 0;
      const eventColor = dayEvents[0]?.color || dayEvents[0]?.type || '#22c55e';

      days.push(
        <TouchableOpacity
          key={day}
          style={styles.dayCell}
          onPress={() => handleDayPress(day)}
          activeOpacity={0.7}
        >
          {isToday ? (
            <>
              <Text style={styles.dayTextToday}>
                {day}
              </Text>
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
            </>
          ) : (
            <>
              <Text style={styles.dayText}>
                {day}
              </Text>
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
            </>
          )}
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
          <Ionicons name="chevron-back" size={22} color="rgba(255, 255, 255, 0.7)" />
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
          <Ionicons name="chevron-forward" size={22} color="rgba(255, 255, 255, 0.7)" />
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2a2a2a', // iOS-style grey background
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  arrowButton: {
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
  monthYear: {
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
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  dayNameCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayNameText: {
    fontSize: 13,
    fontWeight: '600',
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
});

export default GreyCalendar;
