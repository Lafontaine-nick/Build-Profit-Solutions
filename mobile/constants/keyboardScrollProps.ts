import { Platform } from 'react-native';
import type { ScrollViewProps } from 'react-native';

/**
 * LOCKED scroll/keyboard inset presets — Sep 2026
 * Forms: FORM_KEYBOARD_SCROLL_PROPS. Legacy lists: KEYBOARD_SCROLL_DEFAULTS (non-form only).
 * See `.cursor/rules/mobile-keyboard-presets.mdc` before editing.
 */
export const KEYBOARD_SCROLL_DEFAULTS: Pick<
  ScrollViewProps,
  'keyboardShouldPersistTaps' | 'keyboardDismissMode'
> = {
  keyboardShouldPersistTaps: 'handled',
  keyboardDismissMode: 'on-drag',
};

/**
 * Default form scroll + keyboard inset handling for screens outside `estimate-generator.jsx`.
 * iOS: native inset animation only (no `useKeyboard` padding / `KeyboardAvoidingView`).
 * iOS `keyboardDismissMode: 'none'` keeps the blue checkmark stable on multiline fields.
 */
export const FORM_KEYBOARD_SCROLL_PROPS: Pick<
  ScrollViewProps,
  | 'keyboardShouldPersistTaps'
  | 'keyboardDismissMode'
  | 'automaticallyAdjustKeyboardInsets'
  | 'automaticallyAdjustContentInsets'
  | 'contentInsetAdjustmentBehavior'
> = {
  keyboardShouldPersistTaps: 'handled',
  ...(Platform.OS === 'ios'
    ? {
        automaticallyAdjustKeyboardInsets: true,
        automaticallyAdjustContentInsets: false,
        contentInsetAdjustmentBehavior: 'never',
        keyboardDismissMode: 'none',
      }
    : {
        keyboardDismissMode: 'on-drag',
      }),
};
