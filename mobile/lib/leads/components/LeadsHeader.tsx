import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from 'expo-haptics';
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";

type ViewTabKey = "leads" | "analytics" | "insights";

interface LeadsHeaderProps {
  activeViewTab?: ViewTabKey;
  setActiveViewTab?: (tab: ViewTabKey) => void;
}

export default function LeadsHeader({ 
  activeViewTab = "leads",
  setActiveViewTab
}: LeadsHeaderProps) {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === "#000000";

  const handleViewTabPress = (tab: ViewTabKey) => {
    if (setActiveViewTab) {
      setActiveViewTab(tab);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <View style={styles.viewTabContainer}>
      <View style={styles.wideContainer}>
        <BlurView
          intensity={darkMode ? 35 : 15}
          tint={darkMode ? "dark" : "light"}
          style={[
            styles.segmentContainer,
            !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line },
          ]}
        >
          <View style={styles.segmentInner}>
            <SegmentTab
              label="Leads"
              icon="list-outline"
              isActive={activeViewTab === "leads"}
              onPress={() => handleViewTabPress("leads")}
              darkMode={darkMode}
              textColor={Colors.text}
            />
            <SegmentTab
              label="Analytics"
              icon="bar-chart-outline"
              isActive={activeViewTab === "analytics"}
              onPress={() => handleViewTabPress("analytics")}
              darkMode={darkMode}
              textColor={Colors.text}
            />
            <SegmentTab
              label="Campaigns"
              icon="megaphone-outline"
              isActive={activeViewTab === "insights"}
              onPress={() => handleViewTabPress("insights")}
              darkMode={darkMode}
              textColor={Colors.text}
            />
          </View>
        </BlurView>
      </View>
    </View>
  );
}

type SegmentProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  onPress: () => void;
  darkMode: boolean;
  textColor: string;
};

const SegmentTab: React.FC<SegmentProps> = ({
  label,
  icon,
  isActive,
  onPress,
  darkMode,
  textColor,
}) => {
  if (isActive) {
    return (
      <LinearGradient
        colors={["#22c55e", "#22d3ee"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.segmentTab, styles.segmentTabActive]}
      >
        <Pressable onPress={onPress}>
          <View style={styles.segmentTabInner}>
            <Ionicons name={icon} size={18} color="#050B13" />
            <Text style={[styles.segmentLabel, styles.segmentLabelActive]}>
              {label}
            </Text>
          </View>
        </Pressable>
      </LinearGradient>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={styles.segmentTab}
    >
      <View style={styles.segmentTabInner}>
        <Ionicons name={icon} size={18} color={darkMode ? "#E5F7FF" : textColor} />
        <Text style={[styles.segmentLabel, !darkMode && { color: textColor }]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  viewTabContainer: {
    marginBottom: 16,
  },
  wideContainer: {
    marginHorizontal: -20, // Extend beyond ScrollView padding (matches dashboard, projects, landing)
    paddingHorizontal: 8, // Add padding back inside (matches dashboard, projects, landing)
  },
  segmentContainer: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#19E180",
    overflow: 'hidden',
  },
  segmentInner: {
    flexDirection: "row",
    padding: 4,
  },
  segmentTab: {
    flex: 1,
    borderRadius: 999,
  },
  segmentTabActive: {
    shadowColor: "#22c55e",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  segmentTabInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 8,
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#E5F7FF",
  },
  segmentLabelActive: {
    color: "#050B13",
  },
});



