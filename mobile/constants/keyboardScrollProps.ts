import type { ScrollViewProps } from 'react-native';

/**
 * Estimates Step 1 behavior: drag/scroll dismisses the keyboard; `handled` lets taps reach
 * buttons/fields before the scroll view eats them. Use on primary `ScrollView` / `FlatList`
 * that wrap forms with `TextInput`.
 */
export const KEYBOARD_SCROLL_DEFAULTS: Pick<
  ScrollViewProps,
  'keyboardShouldPersistTaps' | 'keyboardDismissMode'
> = {
  keyboardShouldPersistTaps: 'handled',
  keyboardDismissMode: 'on-drag',
};
