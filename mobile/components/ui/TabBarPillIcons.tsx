import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** iOS-style tab bar icon colors (spec) */
export const TAB_NAV_ACTIVE = '#4ade80';
export const TAB_NAV_INACTIVE_DARK = '#8E8E93';
export const TAB_NAV_INACTIVE_LIGHT = '#64748B';
export const TAB_ASSISTANT_STAR = '#4ade80';
/** Lines on filled estimate icon */
const ESTIMATE_LINES_ON_FILL = '#111111';

type IconBaseProps = {
  focused: boolean;
  darkMode: boolean;
  size?: number;
};

function inactiveColor(darkMode: boolean) {
  return darkMode ? TAB_NAV_INACTIVE_DARK : TAB_NAV_INACTIVE_LIGHT;
}

/** Dashboard: 2×2 grid — filled active, outlined inactive */
export function TabBarDashboardIcon({ focused, darkMode, size = 26 }: IconBaseProps) {
  const active = TAB_NAV_ACTIVE;
  const stroke = inactiveColor(darkMode);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {focused ? (
        <>
          <Rect x="3" y="3" width="7" height="7" rx="1.5" fill={active} />
          <Rect x="14" y="3" width="7" height="7" rx="1.5" fill={active} />
          <Rect x="3" y="14" width="7" height="7" rx="1.5" fill={active} />
          <Rect x="14" y="14" width="7" height="7" rx="1.5" fill={active} />
        </>
      ) : (
        <>
          <Rect x="3" y="3" width="7" height="7" rx="1.5" fill="none" stroke={stroke} strokeWidth={1.5} />
          <Rect x="14" y="3" width="7" height="7" rx="1.5" fill="none" stroke={stroke} strokeWidth={1.5} />
          <Rect x="3" y="14" width="7" height="7" rx="1.5" fill="none" stroke={stroke} strokeWidth={1.5} />
          <Rect x="14" y="14" width="7" height="7" rx="1.5" fill="none" stroke={stroke} strokeWidth={1.5} />
        </>
      )}
    </Svg>
  );
}

/** Projects folder */
export function TabBarProjectsIcon({ focused, darkMode, size = 26 }: IconBaseProps) {
  const active = TAB_NAV_ACTIVE;
  const stroke = inactiveColor(darkMode);
  const folderPath =
    'M3 7C3 5.89543 3.89543 5 5 5H9L11 7H19C20.1046 7 21 7.89543 21 9V17C21 18.1046 20.1046 19 19 19H5C3.89543 19 3 18.1046 3 17V7Z';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {focused ? (
        <Path d={folderPath} fill={active} />
      ) : (
        <Path
          d={folderPath}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

/** Estimate / document */
export function TabBarEstimateIcon({ focused, darkMode, size = 26 }: IconBaseProps) {
  const active = TAB_NAV_ACTIVE;
  const stroke = inactiveColor(darkMode);
  const lines = (
    <>
      <Path d="M8 8H16M8 12H16M8 16H13" stroke={focused ? ESTIMATE_LINES_ON_FILL : stroke} strokeWidth={1.5} strokeLinecap="round" />
    </>
  );
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {focused ? (
        <>
          <Rect x="4" y="3" width="16" height="18" rx="2" fill={active} />
          {lines}
        </>
      ) : (
        <>
          <Rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke={stroke} strokeWidth={1.5} />
          {lines}
        </>
      )}
    </Svg>
  );
}

/** Leads / people */
export function TabBarLeadsIcon({ focused, darkMode, size = 26 }: IconBaseProps) {
  const active = TAB_NAV_ACTIVE;
  const stroke = inactiveColor(darkMode);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {focused ? (
        <>
          <Circle cx="9" cy="8" r="4" fill={active} />
          <Path
            d="M3 20C3 16.6863 5.68629 14 9 14C12.3137 14 15 16.6863 15 20"
            stroke={active}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx="17" cy="9" r="3" fill={active} />
          <Path
            d="M21 20C21 17.7909 19.2091 16 17 16"
            stroke={active}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        </>
      ) : (
        <>
          <Circle cx="9" cy="8" r="4" fill="none" stroke={stroke} strokeWidth={1.5} />
          <Path
            d="M3 20C3 16.6863 5.68629 14 9 14C12.3137 14 15 16.6863 15 20"
            stroke={stroke}
            strokeWidth={1.5}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx="17" cy="9" r="3" fill="none" stroke={stroke} strokeWidth={1.5} />
          <Path
            d="M21 20C21 17.7909 19.2091 16 17 16"
            stroke={stroke}
            strokeWidth={1.5}
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}
    </Svg>
  );
}

/** Assistant — always filled star (spec) */
export function TabBarAssistantStar({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Path
        d="M11 3L12.8 8.2H18.2L13.8 11.5L15.5 17L11 13.5L6.5 17L8.2 11.5L3.8 8.2H9.2L11 3Z"
        fill={TAB_ASSISTANT_STAR}
      />
    </Svg>
  );
}

/** 26×26 slot for outer tabs */
export function TabIconSlot({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ width: 26, height: 26, marginBottom: 3, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
}
