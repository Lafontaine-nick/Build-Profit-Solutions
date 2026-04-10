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
};

/** iOS-only toolbar above the keyboard with a trailing Done button (dismisses keyboard). */
export default function KeyboardDoneAccessory({ nativeID }: Props) {
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={styles.accessoryBar}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => Keyboard.dismiss()}
          style={styles.doneButton}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  accessoryBar: {
    minHeight: 50,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: '#111214',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  doneButton: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
