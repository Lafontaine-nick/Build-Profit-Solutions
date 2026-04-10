import React from 'react';
import {
  View,
  Text,
  Platform,
  Keyboard,
  TouchableOpacity,
  StyleSheet,
  InputAccessoryView,
} from 'react-native';

/** Must match `nativeID` on `InputAccessoryView` and `inputAccessoryViewID` on numeric `TextInput`s (iOS). */
export const NUMERIC_KEYBOARD_DONE_ACCESSORY_NATIVE_ID = 'numericKeyboardDoneAccessory';

export const numericKeyboardDoneAccessoryId =
  Platform.OS === 'ios' ? NUMERIC_KEYBOARD_DONE_ACCESSORY_NATIVE_ID : undefined;

type Props = {
  /** When true, toolbar/button match dark UI (e.g. black app bg). */
  darkMode: boolean;
  /**
   * Must match the screen root fill (`Colors.bg` / SafeArea) behind the keyboard.
   * iOS often paints `InputAccessoryView` as an opaque strip; `transparent` reads as a different
   * “black” than your app — using the same hex removes the visible bar.
   */
  surfaceColor?: string;
};

const defaultSurface = (darkMode: boolean) =>
  darkMode ? '#000000' : '#E8EDF5';

/**
 * iOS-only pill "Done" above decimal/number pads. Letter fields should omit `inputAccessoryViewID`
 * and use `returnKeyType="done"` so the system return key dismisses the keyboard.
 */
export function KeyboardNumericDoneAccessory({ darkMode, surfaceColor }: Props) {
  if (Platform.OS !== 'ios') return null;

  const fill = surfaceColor ?? defaultSurface(darkMode);

  return (
    <InputAccessoryView
      nativeID={NUMERIC_KEYBOARD_DONE_ACCESSORY_NATIVE_ID}
      backgroundColor={fill}
      style={[styles.accessoryRoot, { backgroundColor: fill }]}
    >
      <View style={styles.toolbar}>
        <TouchableOpacity
          onPress={() => Keyboard.dismiss()}
          activeOpacity={0.65}
          style={[styles.pill, darkMode ? styles.pillDark : styles.pillLight]}
          hitSlop={{ top: 6, bottom: 6, left: 8, right: 4 }}
        >
          <Text
            style={[styles.pillLabel, darkMode ? styles.pillLabelDark : styles.pillLabelLight]}
            allowFontScaling={false}
          >
            Done
          </Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  accessoryRoot: {
    width: '100%',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: 8,
    paddingLeft: 12,
    paddingVertical: 4,
    minHeight: 40,
    backgroundColor: 'transparent',
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 19,
    paddingVertical: 7,
    borderRadius: 100,
  },
  /** Slightly above the strip so it reads like the reference pill on dark grey. */
  pillDark: {
    backgroundColor: '#333333',
  },
  pillLight: {
    backgroundColor: '#8E8E93',
  },
  pillLabel: {
    fontSize: 17,
    fontWeight: '400',
  },
  pillLabelDark: {
    color: '#FFFFFF',
  },
  pillLabelLight: {
    color: '#FFFFFF',
  },
});
