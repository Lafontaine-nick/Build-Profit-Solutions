import { Platform } from "react-native";

/**
 * Icon / circular header controls: Android `Pressable` defaults to a strong theme-colored ripple
 * (often blue). Use on `Pressable` back buttons that must stay visually neutral.
 */
export function neutralIconPressableProps(darkMode: boolean) {
  if (Platform.OS !== "android") {
    return {};
  }
  return {
    android_ripple: {
      color: darkMode ? "rgba(255, 255, 255, 0.14)" : "rgba(0, 0, 0, 0.08)",
      borderless: false,
    },
  } as const;
}

/** RN Web: avoid blue tap highlight / focus ring on icon controls. */
export function neutralIconPressableWebStyle(): Record<string, unknown> | undefined {
  if (Platform.OS !== "web") {
    return undefined;
  }
  const web: Record<string, unknown> = {
    cursor: "pointer",
    outlineStyle: "none",
    outlineWidth: 0,
    outlineColor: "transparent",
    WebkitTapHighlightColor: "transparent",
    WebkitUserSelect: "none",
    userSelect: "none",
    touchAction: "manipulation",
  };
  return web;
}
