import React from "react";
import {
  View,
  ScrollView,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export type WebPageShellSize =
  | "dashboard"
  | "projects"
  | "projectDetail"
  | "form"
  | "assistant"
  | "estimate"
  | "calendar"
  | "full"
  | "leads"
  | "profile";

const MAX_WIDTH: Record<WebPageShellSize, number> = {
  dashboard: 1180,
  projects: 1180,
  projectDetail: 1120,
  form: 860,
  assistant: 960,
  estimate: 1120,
  calendar: 1180,
  full: 1280,
  leads: 1180,
  profile: 960,
};

export function getWebPageShellMaxWidth(size: WebPageShellSize): number {
  return MAX_WIDTH[size];
}

/** Inner horizontal padding of the centered web column — keep in sync with `columnStyle` below. */
export const WEB_PAGE_SHELL_HORIZONTAL_PADDING = 32;

export type WebPageShellProps = {
  children: React.ReactNode;
  size?: WebPageShellSize;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Desktop web: centered column with consistent padding and max-width.
 * Native / non-web: `flex: 1` wrapper only — no layout change to mobile app UI.
 */
export default function WebPageShell({
  children,
  size = "dashboard",
  scroll = true,
  style,
  contentStyle,
}: WebPageShellProps) {
  if (Platform.OS !== "web") {
    return <View style={[styles.nativePassThrough, style]}>{children}</View>;
  }

  const maxW = MAX_WIDTH[size];
  const columnStyle: ViewStyle = {
    width: "100%",
    maxWidth: maxW,
    alignSelf: "center",
    paddingHorizontal: WEB_PAGE_SHELL_HORIZONTAL_PADDING,
    paddingTop: 40,
    paddingBottom: 80,
  };

  if (scroll) {
    return (
      <ScrollView
        style={[styles.webRoot, style]}
        contentContainerStyle={styles.webScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        <View style={[columnStyle, contentStyle]}>{children}</View>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.webRoot, style]}>
      <View style={[columnStyle, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  nativePassThrough: {
    flex: 1,
  },
  webRoot: {
    flex: 1,
    width: "100%",
  },
  webScrollContent: {
    flexGrow: 1,
    alignItems: "center",
    width: "100%",
  },
});
