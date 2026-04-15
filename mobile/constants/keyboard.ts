import { Platform } from 'react-native';

/** iOS `InputAccessoryView` nativeIDs (must match mounted `KeyboardDoneAccessory` / `KeyboardDoneBar`). */
export const KEYBOARD_ACCESSORY_IDS = {
  text: 'bps-text-keyboard-accessory',
  number: 'bps-number-keyboard-accessory',
  /** Estimates step 5 (direct costs / overhead / markup) — dedicated pill Done; avoids iOS accessory glitches on first field vs shared `number` bar. */
  step5Numeric: 'bps-step5-numeric-keyboard-accessory',
  /** Step 5 decimal fields without Done strip (Equipment Rental, Plans, …) — empty `InputAccessoryView` above `decimal-pad`. */
  step5EquipmentPlain: 'bps-step5-equipment-plain-keyboard-accessory',
  /**
   * Single global green Done bar for all numeric keypads (`phone-pad` / `decimal-pad`).
   * Mounted once in `app/_layout.tsx` (`ThemeAwareLayout`). Point every numeric `TextInput` here.
   */
  bpsKeyboardDone: 'bps-keyboard-done',
} as const;

/** Use on `inputAccessoryViewID` so Android does not receive iOS-only IDs. */
export function iosAccessoryId(accessoryId: string | undefined): string | undefined {
  if (!accessoryId) return undefined;
  return Platform.OS === 'ios' ? accessoryId : undefined;
}
