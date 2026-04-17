import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  StatusBar,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";

const { width } = Dimensions.get("window");

const TESTIMONIALS = [
  {
    text: "This app made bidding and tracking projects so much easier!",
    author: "Mike Johnson, GC",
  },
  {
    text: "A must-have for every contractor and developer.",
    author: "Sarah Chen, Developer",
  },
  {
    text: "The best tool for managing construction projects.",
    author: "David Rodriguez, Contractor",
  },
  {
    text: "Trusted by 1,000+ builders nationwide.",
    author: "Build Profit Solutions",
  },
];

export default function LandingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors, darkMode), [Colors, darkMode]);
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade-in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    const interval = setInterval(() => {
      setTestimonialIdx((idx) => (idx + 1) % TESTIMONIALS.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [fadeAnim]);

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/auth?mode=signin");
      };

  return (
    <View style={styles.root}>
      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />

        {/* Subtle gradient background behind logo (light mode only) - positioned outside ScrollView */}
        {!darkMode && (
          <LinearGradient
            colors={['rgba(34,197,94,0.06)', 'rgba(34,197,94,0.03)', 'rgba(34,197,94,0.01)', 'transparent']}
            locations={[0, 0.3, 0.6, 1]}
            style={styles.logoGradientBg}
          />
        )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          {/* HEADER / BRAND */}
          <View style={styles.wideContainer}>
            <View style={[styles.headerSection, { zIndex: 1 }]}>
            <View style={styles.logoWrapper}>
              {/* Main ring + logo */}
              <View style={styles.logoGlowWrapper}>
                <LinearGradient
                  colors={["#22c55e", "#22d3ee"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.logoOuter}
                >
                  <View style={styles.logoInner}>
                    {/* Gloss highlight on the ring */}
                    <View pointerEvents="none" style={styles.logoGloss} />
            <Image
                      source={require("../assets/images/bps-logo-white.png")}
                      key={`logo-${darkMode ? 'dark' : 'light'}`}
              style={[
                styles.logoImage,
                // Only apply black tint in light mode, no tint in dark mode (original white/blue)
                !darkMode ? { tintColor: '#000000' } : undefined
              ]}
                      resizeMode="contain"
                    />
                  </View>
                </LinearGradient>
              </View>
            </View>

            {/* Title + tagline (slightly tightened spacing) */}
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.screenTitle, { color: darkMode ? "#f9fafb" : "#000000" }]}>BUILD PROFIT</Text>
            </View>
            <Text style={[styles.screenSubtitle, { color: darkMode ? "#FFFFFF" : "#000000" }]}>SOLUTIONS</Text>

            <View style={styles.taglineRow}>
              <Ionicons name="sparkles" size={14} color="#22c55e" />
              <Text style={styles.tagline}>{t('landing.tagline')}</Text>
              <Ionicons name="sparkles" size={14} color="#22c55e" />
            </View>

            <View style={styles.aiStatusRow}>
              <View style={styles.aiDot} />
              <Text style={styles.aiStatusText}>
                {t('landing.aiPowered')}
              </Text>
            </View>
          </View>
          </View>

                    {/* HERO CARD */}
          <View style={styles.wideContainer}>
          <LinearGradient
            colors={["#2DFFC4", "#00A6FF"]}
            start={{ x: 0.05, y: 0.1 }}
            end={{ x: 0.95, y: 0.9 }}
            style={styles.cardBorder}
          >
            <View style={[styles.card, !darkMode && { backgroundColor: Colors.bg, borderColor: Colors.line, borderWidth: 1 }]}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>{t('landing.getStarted')}</Text>
                  <Text style={styles.cardSubtitle}>
                    {t('landing.launchDescription')}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleGetStarted}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#22c55e", "#22d3ee"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Ionicons name="rocket-outline" size={20} color="#020617" />
                  <Text style={styles.primaryButtonText}>{t('landing.getStartedButton')}</Text>
                </LinearGradient>
              </TouchableOpacity>

                                  <View style={styles.featuresRow}>
            <View style={styles.featureItem}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="calculator-outline" size={22} color="#22c55e" />
              </View>
              <Text style={styles.featureTitle}>{t('landing.aiEstimates')}</Text>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="trending-up-outline" size={22} color="#22c55e" />
              </View>
              <Text style={styles.featureTitle}>{t('landing.profitTracking')}</Text>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="people-outline" size={22} color="#22c55e" />
              </View>
              <Text style={styles.featureTitle}>{t('landing.teamManagement')}</Text>
            </View>
          </View>

<View style={styles.reassureRow}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={16}
                  color={darkMode ? "#6ee7b7" : "#16a34a"}
                />
                <Text style={styles.reassureText}>
                  {t('landing.dataPrivacy')}
                </Text>
              </View>
            </View>
          </LinearGradient>
          </View>

                    {/* TESTIMONIAL CARD */}
          <View style={styles.wideContainer}>
          <LinearGradient
            colors={["#2DFFC4", "#00A6FF"]}
            start={{ x: 0.05, y: 0.1 }}
            end={{ x: 0.95, y: 0.9 }}
            style={[styles.cardBorder, { marginBottom: 0 }]}
          >
            <View style={[styles.card, !darkMode && { backgroundColor: Colors.bg, borderColor: Colors.line, borderWidth: 1 }]}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>{t('landing.whatBuildersSay')}</Text>
                  <Text style={styles.cardSubtitle}>
                    {t('landing.trustedBy')}
                  </Text>
                </View>
              </View>

              <View style={styles.testimonialContent}>
                <View style={styles.testimonialIconCircle}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={20}
                    color="#22c55e"
                  />
                </View>
                <Text style={styles.testimonialText}>
                  "{TESTIMONIALS[testimonialIdx].text}"
                </Text>
                <Text style={styles.testimonialAuthor}>
                  — {TESTIMONIALS[testimonialIdx].author}
                </Text>
              </View>
            </View>
          </LinearGradient>
          </View>
        </Animated.View>
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (Colors: any, darkMode: boolean) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    position: 'relative',
    overflow: 'visible',
  },
  glossOverlay: {
    position: "absolute",
    top: -120,
    left: -60,
    right: -60,
    height: 260,
    backgroundColor: "rgba(15,23,42,0.6)",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 40,
    overflow: 'visible',
  },
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'visible',
  },
  wideContainer: {
    marginHorizontal: -20,
    paddingHorizontal: 8,
    position: 'relative',
  },
  logoGradientBg: {
    position: "absolute",
    top: -500,
    left: -width * 1.5,
    right: -width * 1.5,
    height: 1000,
    borderRadius: 999,
    zIndex: 0,
  },

  headerSection: {
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 20,
  },
  logoWrapper: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  logoGlowWrapper: {
    shadowColor: "#22c55e",
    shadowOpacity: 0.55, // stronger glow
    shadowRadius: 26, // smoother spread
    shadowOffset: { width: 0, height: 0 },
  },
  logoOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    padding: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  logoInner: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: darkMode ? "#000000" : Colors.card,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  logoImage: {
    width: 70,
    height: 70,
  },
  logoGloss: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    height: "55%",
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    backgroundColor: "rgba(255,255,255,0.03)", // very subtle white sheen
  },

  titleGlow: {
    position: "absolute",
    left: -16,
    top: -8,
    width: 260,
    height: 48,
    opacity: 0.22,
    borderRadius: 999,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 1,
  },
  screenSubtitle: {
    fontSize: 18,
    fontWeight: "700", // Increased from 600
    textAlign: "center",
    marginTop: 4,
    letterSpacing: 0.4,
  },
  taglineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  tagline: {
    fontSize: 14,
    color: darkMode ? "#FFFFFF" : "#475569",
    fontWeight: "500",
  },
  aiStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  aiDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#22c55e",
    marginRight: 6,
  },
  aiStatusText: {
    fontSize: 12,
    color: darkMode ? "#6ee7b7" : "#15803d",
  },

  cardBorder: {
    borderRadius: 28,
    padding: 1,
    marginBottom: 16,
    shadowColor: darkMode ? '#00A6FF' : "transparent",
    shadowOpacity: darkMode ? 0.16 : 0,
    shadowRadius: darkMode ? 14 : 0,
    shadowOffset: { width: 0, height: darkMode ? 10 : 0 },
    elevation: darkMode ? 10 : 0,
    borderWidth: 0,
    borderColor: "transparent",
    overflow: 'hidden',
  },
  card: {
    backgroundColor: darkMode ? "#000000" : "#FFFFFF",
    borderRadius: 26,
    padding: 20,
    borderWidth: darkMode ? 0 : 0, // Border on wrapper, not card
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: darkMode ? "700" : "800",
    color: darkMode ? "#FFFFFF" : "#0F172A",
    textAlign: "center",
  },
  cardSubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: darkMode ? "#FFFFFF" : "#475569",
    textAlign: "center",
  },

  primaryButton: {
    width: "100%",
    marginBottom: 22,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: darkMode ? 6 : 4 },
    shadowOpacity: darkMode ? 0.35 : 0.25,
    shadowRadius: 14,
    elevation: darkMode ? 10 : 2,
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 10,
  },
  primaryButtonText: {
    color: "#020617",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  featuresRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 10,
  },
  featureItem: {
    alignItems: "center",
    flex: 1,
  },
      featureIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: darkMode ? "#000000" : "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  featureTitle: {
    fontSize: 13,
    color: darkMode ? "#e2e8f0" : "#0F172A",
    fontWeight: "600",
    textAlign: "center",
  },

  reassureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 6,
  },
  reassureText: {
    fontSize: 12,
    color: darkMode ? "#FFFFFF" : "#475569",
  },

  testimonialContent: {
    alignItems: "center",
  },
  testimonialIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,166,255,0.42)',
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  testimonialText: {
    fontSize: 15,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 22,
    color: darkMode ? "#e2e8f0" : "#0F172A",
    marginBottom: 10,
  },
  testimonialAuthor: {
    fontSize: 14,
    textAlign: "center",
    color: darkMode ? "#FFFFFF" : "#64748B",
    fontWeight: "600",
  },
});
