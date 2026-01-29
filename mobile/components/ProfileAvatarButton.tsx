import React from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

interface Props {
  style?: ViewStyle;
  initials?: string; // e.g. "NL"
}

const ProfileAvatarButton: React.FC<Props> = ({ style, initials = "NL" }) => {
  const router = useRouter();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/profile");
  };

  return (
    <TouchableOpacity
      style={[styles.avatar, style]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Text style={styles.initials}>{initials}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: "#F9FAFB",
    fontSize: 13,
    fontWeight: "600",
  },
});

export default ProfileAvatarButton;

