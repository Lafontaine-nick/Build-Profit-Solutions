import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { confirmScopeSectionLabelStyle } from '@/utils/estimateFlowCardStyle';

export const UPCOMING_CALENDAR_WINDOW_DAYS = 5;
export const UPCOMING_CALENDAR_FOOTER_LIMIT = 5;

export type CalendarUpcomingFooterEvent = {
  id: string;
  title: string;
  date: string;
  time?: string;
};

type CalendarUpcomingFooterProps = {
  events: CalendarUpcomingFooterEvent[];
  darkMode: boolean;
  textColor: string;
  subColor: string;
  getEventColor: (event: CalendarUpcomingFooterEvent) => string;
  onEventPress?: (event: CalendarUpcomingFooterEvent) => void;
};

export function CalendarUpcomingFooter({
  events,
  darkMode,
  textColor,
  subColor,
  getEventColor,
  onEventPress,
}: CalendarUpcomingFooterProps) {
  const visible = events.slice(0, UPCOMING_CALENDAR_FOOTER_LIMIT);
  const overflow = events.length - visible.length;

  return (
    <View>
      <Text style={[confirmScopeSectionLabelStyle(), { color: subColor, marginBottom: 6 }]}>
        Upcoming events · next {UPCOMING_CALENDAR_WINDOW_DAYS} days
      </Text>
      {visible.length === 0 ? (
        <Text style={{ color: subColor, fontSize: 13, fontWeight: '500', lineHeight: 18 }}>
          Nothing scheduled in the next {UPCOMING_CALENDAR_WINDOW_DAYS} days.
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          {visible.map((event) => (
            <Pressable
              key={event.id}
              onPress={() => onEventPress?.(event)}
              disabled={!onEventPress}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 4,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: getEventColor(event),
                  flexShrink: 0,
                }}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: textColor, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                  {event.title}
                </Text>
                <Text style={{ color: subColor, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                  {new Date(`${event.date}T00:00:00`).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {event.time ? ` · ${event.time}` : ''}
                </Text>
              </View>
            </Pressable>
          ))}
          {overflow > 0 ? (
            <Text style={{ color: subColor, fontSize: 12, fontWeight: '600' }}>
              +{overflow} more
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
