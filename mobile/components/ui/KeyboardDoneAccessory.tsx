import React from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  nativeID: string;
  /**
   * iOS paints `InputAccessoryView` as a full-width strip; `transparent` often reads as a harsh black
   * block above the keyboard. Use a solid fill (match app bg or a system-like grey).
   */
  backgroundColor?: string;
};

const DEFAULT_ACCESSORY_BG = '#3A3A3C';

/**
 * iOS-only toolbar above the keyboard with a trailing Done button.
 * Pairs with `inputAccessoryViewID` on TextInputs (see KEYBOARD_ACCESSORY_IDS).
 */
export default function KeyboardDoneAccessory({
  nativeID,
  backgroundColor = DEFAULT_ACCESSORY_BG,
}: Props) {
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={nativeID} backgroundColor={backgroundColor}>
      <View style={[styles.keyboardBar, { backgroundColor }]}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => Keyboard.dismiss()}
          style={styles.keyboardDoneButton}
        >
          <Text style={styles.keyboardDoneText}>Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  keyboardBar: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  keyboardDoneButton: {
    minHeight: 38,
    paddingHorizontal: 20,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(32, 32, 36, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  keyboardDoneText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
