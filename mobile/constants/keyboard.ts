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
  /**
   * SKU Search Query (`AttachSkuModal`) — empty accessory so the field does not pick up the green
   * `bpsKeyboardDone` strip (matches Estimates Customer Name: default keyboard, no app Done bar).
   * Pair with a zero-height `InputAccessoryView` mounted in the modal.
   */
  skuSearchQueryPlain: 'bps-sku-search-query-plain-keyboard-accessory',
  /**
   * Projects Budget → Add transaction modal (`AddTransactionModal`) and add-materials screen:
   * empty accessory so vendor + phone-pad amount/rate/sqft do not pick up the global green `bpsKeyboardDone` bar.
   */
  projectAddExpensePlain: 'bps-project-add-expense-plain-keyboard-accessory',
  /**
   * Estimates line-item full-screen modal (`LineItemModal`) text fields:
   * mount inside the modal itself so iOS does not fall back to the global green `bpsKeyboardDone` bar.
   */
  lineItemModalPlain: 'bps-line-item-modal-plain-keyboard-accessory',
  /**
   * Product Found sheet (`ProductFoundSheet`) — empty accessory so qty/cost fields do not pick up
   * the global green `bpsKeyboardDone` bar above the decimal pad.
   */
  productFoundSheetPlain: 'bps-product-found-sheet-plain-keyboard-accessory',
} as const;

/** Use on `inputAccessoryViewID` so Android does not receive iOS-only IDs. */
export function iosAccessoryId(accessoryId: string | undefined): string | undefined {
  if (!accessoryId) return undefined;
  return Platform.OS === 'ios' ? accessoryId : undefined;
}
