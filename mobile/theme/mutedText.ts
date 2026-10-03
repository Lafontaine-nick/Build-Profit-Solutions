/** Secondary text. Dark matches the estimate cost step; light stays readable on white. */
export const MUTED_TEXT_DARK = '#d7e1f0';
export const MUTED_TEXT_LIGHT = '#64748b';
export const MUTED_TEXT_SOFT_DARK = 'rgba(215, 225, 240, 0.72)';

export function mutedTextColor(darkMode: boolean) {
  return darkMode ? MUTED_TEXT_DARK : MUTED_TEXT_LIGHT;
}
