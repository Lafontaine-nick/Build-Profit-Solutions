import { Platform } from 'react-native';

/** iOS `InputAccessoryView` nativeIDs (must match mounted `KeyboardDoneAccessory`). */
export const KEYBOARD_ACCESSORY_IDS = {
  text: 'bps-text-keyboard-accessory',
  number: 'bps-number-keyboard-accessory',
  /** Estimates step 5 (direct costs / overhead / markup) — dedicated pill Done; avoids iOS accessory glitches on first field vs shared `number` bar. */
  step5Numeric: 'bps-step5-numeric-keyboard-accessory',
  /** Step 1 phone — `KeyboardDoneBar` + `phone-pad`. */
  phoneDone: 'phone-done',
  /** Step 1 ZIP — same `KeyboardDoneBar` UI, separate `InputAccessoryView` id (reliable iOS attach). */
  numericDone: 'numeric-done',
} as const;

/** Use on `inputAccessoryViewID` so Android does not receive iOS-only IDs. */
export function iosAccessoryId(accessoryId: string | undefined): string | undefined {
  if (!accessoryId) return undefined;
  return Platform.OS === 'ios' ? accessoryId : undefined;
}
