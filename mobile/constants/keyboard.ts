import { Platform } from 'react-native';

/** iOS `InputAccessoryView` nativeIDs (must match mounted `KeyboardDoneAccessory`). */
export const KEYBOARD_ACCESSORY_IDS = {
  text: 'bps-text-keyboard-accessory',
  number: 'bps-number-keyboard-accessory',
} as const;

/** Use on `inputAccessoryViewID` so Android does not receive iOS-only IDs. */
export function iosAccessoryId(accessoryId: string | undefined): string | undefined {
  if (!accessoryId) return undefined;
  return Platform.OS === 'ios' ? accessoryId : undefined;
}
