import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { c, radius } from '../ui/tokens';

interface ActionBarProps {
  primary: { 
    label: string; 
    onPress: () => void; 
  };
  secondary?: { 
    label: string; 
    onPress: () => void; 
  };
}

export default function ActionBar({ primary, secondary }: ActionBarProps) {
  return (
    <View style={styles.bar}>
      {secondary ? (
        <Pressable onPress={secondary.onPress} style={styles.ghost}>
          <Text style={styles.ghostTxt}>{secondary.label}</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={primary.onPress} style={styles.primary}>
        <Text style={styles.primaryTxt}>{primary.label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { 
    padding: 16, 
    flexDirection: 'row', 
    gap: 12 
  },
  primary: { 
    flex: 1, 
    backgroundColor: c.accent, 
    paddingVertical: 14, 
    borderRadius: radius.md, 
    alignItems: 'center' 
  },
  primaryTxt: { 
    color: '#052016', 
    fontWeight: '800' 
  },
  ghost: { 
    flex: 1, 
    borderColor: '#94A3B8', 
    borderWidth: 1, 
    paddingVertical: 14, 
    borderRadius: radius.md, 
    alignItems: 'center' 
  },
  ghostTxt: { 
    color: '#D1D5DB', 
    fontWeight: '800' 
  }
});


