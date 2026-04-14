// ============================================================
// BUILD PROFIT SOLUTIONS — KeyboardDoneBar Component
// ============================================================
// Place this file at: components/KeyboardDoneBar.js
// ============================================================

import React from 'react';
import {
  InputAccessoryView,
  View,
  Text,
  TouchableOpacity,
  Keyboard,
  Platform,
  StyleSheet,
} from 'react-native';

const KeyboardDoneBar = ({
  inputAccessoryViewID = 'keyboard-done',
  onDone,
  doneText = 'Done',
}) => {
  if (Platform.OS !== 'ios') return null;

  const handleDone = () => {
    if (onDone) onDone();
    else Keyboard.dismiss();
  };

  return (
    <InputAccessoryView
      nativeID={inputAccessoryViewID}
      backgroundColor="transparent"
    >
      <View style={styles.container}>
        <View style={styles.spacer} />
        <TouchableOpacity
          onPress={handleDone}
          style={styles.doneButton}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
        >
          <Text style={styles.doneText}>{doneText}</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 6,
  },
  spacer: {
    flex: 1,
  },
  doneButton: {
    backgroundColor: '#30D158',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  doneText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: 0.3,
  },
});

export default KeyboardDoneBar;
