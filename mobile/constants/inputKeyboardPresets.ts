/**
 * Presets for `AttachSkuModal` (ZIP + search query) and similar raw `TextInput`s.
 *
 * Estimates (`estimate-generator.jsx`) Step 1–2 fields (phone, ZIP, square footage, etc.)
 * keep **inline** `keyboardType` / `accessoryID` on `AppTextField` — do not refactor those
 * to spreads here unless the user explicitly asks.
 *
 * See `.cursor/rules/mobile-keyboard-presets.mdc` for the project rule.
 */
import { KEYBOARD_ACCESSORY_IDS, iosAccessoryId } from './keyboard';

const phonePadDoneBase = {
  keyboardType: 'phone-pad' as const,
  textContentType: 'none' as const,
  autoComplete: 'off' as const,
  returnKeyType: 'done' as const,
  blurOnSubmit: true as const,
};

/** Raw `TextInput` (e.g. SKU modal ZIP): phone-pad + same Done bar via native accessory id. */
export const textInputPhonePadDoneAccessory = {
  ...phonePadDoneBase,
  inputAccessoryViewID: iosAccessoryId(KEYBOARD_ACCESSORY_IDS.bpsKeyboardDone),
};

/**
 * SKU Search Query — match Step 1 Customer Name: default keyboard + blue return key only.
 * iOS: `inputAccessoryViewID` points at an empty `InputAccessoryView` in `AttachSkuModal` so the
 * field never shows the global green `bpsKeyboardDone` strip (e.g. after focusing ZIP).
 */
export const skuSearchQueryTextKeyboard = {
  returnKeyType: 'done' as const,
  blurOnSubmit: true,
  autoCorrect: false,
  autoCapitalize: 'words' as const,
  selectTextOnFocus: false,
  inputAccessoryViewID: iosAccessoryId(KEYBOARD_ACCESSORY_IDS.skuSearchQueryPlain),
};
