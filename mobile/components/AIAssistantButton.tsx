import React from "react";
import { TouchableOpacity, StyleSheet, View, Text, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface Props {
  onPress: () => void;
  pulse?: boolean;
  label?: string;
  containerStyle?: ViewStyle;
}

const AIAssistantButton: React.FC<Props> = ({
  onPress,
  pulse = false,
  label,
  containerStyle,
}) => {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        style={[styles.button, pulse && styles.pulse]}
      >
        <Ionicons name="sparkles" size={24} color="#0d2745" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 24,
    right: 24,
    alignItems: "center",
    zIndex: 1000,
  },
  label: {
    color: "#38d39f",
    fontSize: 12,
    marginBottom: 6,
    opacity: 0.9,
    fontWeight: "500",
  },
  button: {
    backgroundColor: "#38d39f",
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#38d39f",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  pulse: {
    shadowOpacity: 0.75,
    shadowRadius: 16,
  },
});

export default AIAssistantButton;





