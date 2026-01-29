import React from "react";
import { View, Text, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ProfileAvatarButton from "./ProfileAvatarButton";

interface HeaderBarProps {
  title: string;
  subtitle?: string;
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * Optional right-side element (e.g. custom button).
   * If not provided, a Profile avatar button will be shown.
   */
  rightElement?: React.ReactNode;
  /**
   * Optional initials for the Profile avatar button (when rightElement is not provided).
   */
  userInitials?: string;
}

const HeaderBar: React.FC<HeaderBarProps> = ({
  title,
  subtitle,
  containerStyle,
  rightElement,
  userInitials,
}) => {
  return (
    <SafeAreaView style={[styles.safeArea, containerStyle]} edges={['top']}>
      <View style={styles.row}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : null}
        </View>

        <View style={styles.right}>
          {rightElement ?? <ProfileAvatarButton initials={userInitials} />}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: "transparent",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleBlock: {
    flexShrink: 1,
    paddingRight: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 2,
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  right: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
});

export default HeaderBar;




