import { KEYBOARD_ACCESSORY_IDS, iosAccessoryId } from './keyboard';

/**
 * Presets for `AttachSkuModal` (ZIP + search query) and similar raw `TextInput`s.
 *
 * Estimates (`estimate-generator.jsx`) Step 1–2 fields (phone, ZIP, square footage, etc.)
 * keep **inline** `keyboardType` / `accessoryID` on `AppTextField` — do not refactor those
 * to spreads here unless the user explicitly asks.
 *
 * See `.cursor/rules/mobile-keyboard-presets.mdc` for the project rule.
 */
const phonePadDoneBase = {
  keyboardType: 'phone-pad' as const,
  textContentType: 'none' as const,
  autoComplete: 'off' as const,
  returnKeyType: 'done' as const,
  blurOnSubmit: true as const,
};

/** Raw `TextInput` (e.g. SKU modal ZIP): native phone-pad, no shared iOS Done accessory. */
export const textInputPhonePadDoneAccessory = {
  ...phonePadDoneBase,
};

/**
 * SKU Search Query — match Step 1 Customer Name: default keyboard + blue return key only.
 * Do not attach the shared green Done accessory here; iOS can reuse it after focusing ZIP.
 */
export const skuSearchQueryTextKeyboard = {
  returnKeyType: 'done' as const,
  blurOnSubmit: true,
  autoCorrect: false,
  autoCapitalize: 'words' as const,
  selectTextOnFocus: false,
};

/**
 * Budget expense modals (`AddTransactionModal`, `PricingModeSection`, add-materials):
 * pair with `KeyboardPlainAccessory` mounted using `KEYBOARD_ACCESSORY_IDS.projectAddExpensePlain`.
 */
export const projectAddExpenseNumericKeyboardProps = {
  inputAccessoryViewID: iosAccessoryId(KEYBOARD_ACCESSORY_IDS.projectAddExpensePlain),
  textContentType: 'none' as const,
  autoComplete: 'off' as const,
};

/** Estimates step 1–2 phone / ZIP / sqft — pair with `KeyboardPlainAccessory` on the estimate screen. */
export const estimateStep12NumericKeyboardProps = {
  inputAccessoryViewID: iosAccessoryId(KEYBOARD_ACCESSORY_IDS.estimateStep12Plain),
  textContentType: 'none' as const,
  autoComplete: 'off' as const,
};

/** Estimates Add Labor / Add Materials full-screen modal — pair with `KeyboardPlainAccessory` inside `LineItemModal`. */
export const lineItemModalNumericKeyboardProps = {
  inputAccessoryViewID: iosAccessoryId(KEYBOARD_ACCESSORY_IDS.lineItemModalPlain),
  textContentType: 'none' as const,
  autoComplete: 'off' as const,
};

/** AI Confirm Scope quick measurements + item qty — empty accessory (no Done pill). */
export const aiScopeConfirmNumericKeyboardProps = {
  inputAccessoryViewID: iosAccessoryId(KEYBOARD_ACCESSORY_IDS.aiScopeConfirmNumeric),
  textContentType: 'none' as const,
  autoComplete: 'off' as const,
};
