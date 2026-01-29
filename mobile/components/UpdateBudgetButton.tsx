import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BudgetUpdateModal, {
  BudgetNumbers,
  BudgetPayload,
} from './modals/BudgetUpdateModal';

type Props = {
  numbers: BudgetNumbers; // current totals from your screen
  onSubmit: (payload: BudgetPayload) => void; // send to API / state
};

export default function UpdateBudgetButton({ numbers, onSubmit }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setOpen(true)}
        style={styles.btn}
      >
        {/* Icon is absolutely positioned so the TEXT stays perfectly centered */}
        <Text style={styles.icon} accessibilityElementsHidden>
          ⚡
        </Text>
        <Text style={styles.btnText}>Update Budget</Text>
      </TouchableOpacity>

      <BudgetUpdateModal
        visible={open}
        numbers={numbers}
        onClose={() => setOpen(false)}
        onSubmit={payload => {
          setOpen(false);
          onSubmit(payload);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 12 },
  btn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FACC15', // your yellow tile
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  icon: {
    position: 'absolute',
    left: 14,
    fontSize: 18,
    top: 18, // centers visually for h=56
  },
});
