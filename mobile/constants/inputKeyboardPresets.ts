import { Platform, type TextInputProps } from 'react-native';
import { KEYBOARD_ACCESSORY_IDS, iosAccessoryId } from './keyboard';

const NUMERIC_KEYBOARD_TYPES = new Set(['phone-pad', 'decimal-pad', 'number-pad']);
const CHAIN_RETURN_KEY_TYPES = new Set(['next', 'search', 'go', 'send', 'join']);

/**
 * LOCKED keyboard presets — Sep 2026
 * App-wide: blue iOS checkmark via resolveTextInputKeyboardProps(); no InputAccessoryView on text fields.
 * See `.cursor/rules/mobile-keyboard-presets.mdc` before editing.
 */
export type MultilineKeyboardMode = 'compact' | 'growable';

/**
 * iOS blue checkmark / Done return key — use on default-keyboard text fields.
 * Pair multiline fields with `submitBehavior: 'blurAndSubmit'` (included on iOS).
 */
export function blueDoneKeyboardProps(_options?: { multiline?: boolean }) {
  return {
    returnKeyType: 'done' as const,
    blurOnSubmit: true as const,
    ...(Platform.OS === 'ios' ? { submitBehavior: 'blurAndSubmit' as const } : {}),
  };
}

/**
 * iOS blue checkmark on visually single-line fields (requires multiline + submitBehavior).
 * Android uses standard done key.
 */
export function blueDoneSingleLineTextFieldProps() {
  if (Platform.OS === 'ios') {
    return {
      multiline: true as const,
      scrollEnabled: false as const,
      textAlignVertical: 'center' as const,
      ...blueDoneKeyboardProps({ multiline: true }),
    };
  }
  return blueDoneKeyboardProps();
}

/**
 * Single entry point for raw `TextInput` keyboard props — spread **last** on the component.
 * Skips blue done for numeric pads and intentional `next` / `search` / … chains.
 */
export function resolveTextInputKeyboardProps(options: {
  multiline?: boolean;
  multilineMode?: MultilineKeyboardMode;
  returnKeyType?: TextInputProps['returnKeyType'];
  keyboardType?: TextInputProps['keyboardType'];
  enableBlueDone?: boolean;
} = {}): Partial<TextInputProps> {
  if (options.enableBlueDone === false) {
    return {};
  }
  if (
    !shouldUseBlueDoneKeyboard({
      keyboardType: options.keyboardType,
      returnKeyType: options.returnKeyType,
      multiline: options.multiline,
    })
  ) {
    return {};
  }

  if (options.multiline) {
    if (options.multilineMode === 'growable') {
      return blueDoneKeyboardProps({ multiline: true });
    }
    return {
      multiline: true,
      scrollEnabled: false,
      textAlignVertical: 'top' as const,
      ...blueDoneKeyboardProps({ multiline: true }),
    };
  }

  return blueDoneSingleLineTextFieldProps();
}

/** Whether to apply {@link blueDoneKeyboardProps} (skip numeric pads and form "next" chains). */
export function shouldUseBlueDoneKeyboard(options: {
  keyboardType?: string;
  returnKeyType?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
}): boolean {
  if (options.keyboardType && NUMERIC_KEYBOARD_TYPES.has(options.keyboardType)) {
    return false;
  }
  if (options.returnKeyType && CHAIN_RETURN_KEY_TYPES.has(options.returnKeyType)) {
    return false;
  }
  return true;
}

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
  ...resolveTextInputKeyboardProps(),
  autoCorrect: false,
  autoCapitalize: 'words' as const,
  selectTextOnFocus: false,
};

/**
 * Numeric pads — native keyboard only (no toolbar above the keyboard).
 * Dismiss by tapping another field, a button, or outside the input.
 */
export const nativeNumericKeyboardProps = {
  textContentType: 'none' as const,
  autoComplete: 'off' as const,
};

/**
 * @deprecated Use {@link nativeNumericKeyboardProps} — budget screens no longer mount a plain accessory.
 */
export const projectAddExpenseNumericKeyboardProps = nativeNumericKeyboardProps;

/** Estimates step 1–2 phone / ZIP / sqft — native pad only (no accessory bar). */
export const estimateStep12NumericKeyboardProps = nativeNumericKeyboardProps;

/** Estimates Add Labor / Add Materials full-screen modal — native pad only (no accessory bar). */
export const lineItemModalNumericKeyboardProps = nativeNumericKeyboardProps;

/** AI Confirm Scope quick measurements + item qty — native pad only (no accessory bar). */
export const aiScopeConfirmNumericKeyboardProps = nativeNumericKeyboardProps;
