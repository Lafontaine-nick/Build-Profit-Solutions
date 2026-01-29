import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
type Props = {
  title?: string;
  onBack?: () => void;
};
export default function ProjectHeader({
  title = 'Project Details',
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
      {/* Ensure content is below the status bar */}
      <StatusBar
        barStyle='light-content'
        translucent={false} // IMPORTANT: avoid overlay issues
      />
      <View style={[styles.header, { paddingTop: 6 + (insets?.top ? 0 : 0) }]}>
        {onBack ? (
          <View style={styles.headerRow}>
            <View style={styles.backBtnWrapper}>
              <LinearGradient
                colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backBtnBorder}
              >
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onBack();
                  }}
                  style={styles.backBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </LinearGradient>
            </View>
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
          </View>
        ) : (
          <Text numberOfLines={1} style={styles.titleNoBack}>
            {title}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtnWrapper: {
    marginRight: 12,
  },
  backBtnBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: "hidden",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 19,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  titleNoBack: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    alignSelf: 'flex-start',
  },
});
