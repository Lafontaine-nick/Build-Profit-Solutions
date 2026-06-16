import React, { useCallback, useEffect, useRef, useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Platform,
  StatusBar,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import { useClerkUiEnabled } from "@/contexts/ClerkUiContext";
import {
  getStaySignedInPreference,
} from "@/lib/authSessionPreference";
import {
  WEB_CENTERED_COLUMN_MAX_WIDTH,
  WEB_CENTERED_COLUMN_MIN_WIDTH,
} from "@/constants/ScreenLayout";

/** Clerk session signals can lag `isSignedIn` on web; `getToken()` confirms an active session. */
function useClerkLandingSession() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    if (!isLoaded) {
      setHasToken(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const tok = await getToken();
        if (!cancelled) setHasToken(!!tok);
      } catch {
        if (!cancelled) setHasToken(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, getToken]);

  const showGoToDashboard =
    isLoaded && (!!isSignedIn || !!user?.id || hasToken);

  return { showGoToDashboard, isLoaded, user };
}

function ClerkLandingHeroContent({
  styles,
  t,
}: {
  styles: ReturnType<typeof getStyles>;
  t: (key: string) => string;
}) {
  const router = useRouter();
  const { showGoToDashboard, isLoaded, user } = useClerkLandingSession();
  const [openingDashboard, setOpeningDashboard] = useState(false);

  const onPress = async () => {
    if (!isLoaded || openingDashboard) return;
    setOpeningDashboard(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (showGoToDashboard) {
        const stay = await getStaySignedInPreference();
        if (!stay) {
          router.push("/auth?mode=signin");
          return;
        }
        router.replace("/(tabs)/dashboard");
        return;
      }
    } catch {
      // fall through to sign-in
    }
    setOpeningDashboard(false);
    router.push("/auth?mode=signin");
  };

  const buttonLabel = openingDashboard
    ? "Opening Dashboard..."
    : !isLoaded
    ? t("landing.checkingSessionButton")
    : showGoToDashboard
      ? t("landing.goToDashboardButton")
      : t("landing.getStartedButton");

  return (
    <>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderTextBlock}>
          <Text style={styles.cardTitle}>
            {!isLoaded
              ? t("landing.getStarted")
              : showGoToDashboard
                ? t("landing.goToDashboardHeadline")
                : t("landing.getStarted")}
          </Text>
          <Text style={styles.cardSubtitle}>
            {!isLoaded
              ? t("landing.launchDescription")
              : showGoToDashboard
                ? t("landing.goToDashboardDescription")
                : t("landing.launchDescription")}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, (!isLoaded || openingDashboard) && { opacity: 0.7 }]}
        onPress={onPress}
        activeOpacity={0.85}
        disabled={!isLoaded || openingDashboard}
      >
        <LinearGradient
          colors={["#22c55e", "#22d3ee"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.buttonGradient}
        >
          {openingDashboard ? (
            <ActivityIndicator size="small" color="#020617" />
          ) : (
            <Ionicons name="rocket-outline" size={20} color="#020617" />
          )}
          <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </>
  );
}

function DefaultGetStartedCTA({
  styles,
  t,
}: {
  styles: ReturnType<typeof getStyles>;
  t: (key: string) => string;
}) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.primaryButton}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push("/auth?mode=signin");
      }}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={["#22c55e", "#22d3ee"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.buttonGradient}
      >
        <Ionicons name="rocket-outline" size={20} color="#020617" />
        <Text style={styles.primaryButtonText}>{t("landing.getStartedButton")}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

type LandingTestimonial = { quote: string; attribution: string };

const TESTIMONIAL_ROTATE_MS = 5500;
const TESTIMONIAL_FADE_MS = 350;

function getLandingTestimonials(t: TFunction): LandingTestimonial[] {
  const raw = t("landing.testimonials", { returnObjects: true });
  if (Array.isArray(raw)) {
    const items = raw.filter(
      (item): item is LandingTestimonial =>
        !!item &&
        typeof item === "object" &&
        typeof (item as LandingTestimonial).quote === "string" &&
        typeof (item as LandingTestimonial).attribution === "string"
    );
    if (items.length > 0) return items;
  }
  return [
    {
      quote: t("landing.testimonialQuote"),
      attribution: t("landing.testimonialAttribution"),
    },
  ];
}

function RotatingTestimonial({
  testimonials,
  styles,
  darkMode,
}: {
  testimonials: LandingTestimonial[];
  styles: ReturnType<typeof getStyles>;
  darkMode: boolean;
}) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  const advance = useCallback(() => {
    if (testimonials.length <= 1) return;
    Animated.timing(opacity, {
      toValue: 0,
      duration: TESTIMONIAL_FADE_MS,
      useNativeDriver: Platform.OS !== "web",
    }).start(({ finished }) => {
      if (!finished) return;
      setIndex((prev) => (prev + 1) % testimonials.length);
      Animated.timing(opacity, {
        toValue: 1,
        duration: TESTIMONIAL_FADE_MS,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    });
  }, [opacity, testimonials.length]);

  useEffect(() => {
    if (testimonials.length <= 1) return;
    const timer = setInterval(advance, TESTIMONIAL_ROTATE_MS);
    return () => clearInterval(timer);
  }, [advance, testimonials.length]);

  const current = testimonials[index] ?? testimonials[0];

  return (
    <>
      <Animated.View style={[styles.testimonialContent, { opacity }]}>
        <Text style={styles.testimonialQuote}>{current.quote}</Text>
        <Text style={styles.testimonialAttribution}>{current.attribution}</Text>
      </Animated.View>
      {testimonials.length > 1 ? (
        <View style={styles.testimonialDots}>
          {testimonials.map((_, i) => (
            <View
              key={i}
              style={[
                styles.testimonialDot,
                i === index && styles.testimonialDotActive,
                {
                  backgroundColor:
                    i === index
                      ? "#22c55e"
                      : darkMode
                        ? "rgba(148, 163, 184, 0.45)"
                        : "rgba(100, 116, 139, 0.35)",
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </>
  );
}

/** Wide web: centered premium column (not full-bleed mobile layout) */
const LANDING_WIDE_WEB_MIN_WIDTH = WEB_CENTERED_COLUMN_MIN_WIDTH;
const LANDING_MAX_CONTENT_WIDTH = WEB_CENTERED_COLUMN_MAX_WIDTH;
const LANDING_CTA_MAX_WIDTH = 400;

export default function LandingScreen() {
  const clerkUiEnabled = useClerkUiEnabled();
  const { width: windowWidth } = useWindowDimensions();
  const { t, i18n } = useTranslation();
  const testimonials = useMemo(
    () => getLandingTestimonials(t),
    [t, i18n.language]
  );
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(
    () => getStyles(Colors, darkMode, windowWidth),
    [Colors, darkMode, windowWidth]
  );

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [fadeAnim]);

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
                      source={
                        darkMode
                          ? require("../assets/images/bps-logo-updated.png")
                          : require("../assets/images/bps-logo-updated-light.png")
                      }
              style={styles.logoImage}
                      resizeMode="contain"
                    />
                  </View>
                </LinearGradient>
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              <Text
                style={[
                  styles.screenTitle,
                  { color: darkMode ? "#f9fafb" : "#000000" },
                ]}
              >
                BUILD PROFIT SOLUTIONS
              </Text>
            </View>

            <View style={styles.taglineRow}>
              <Ionicons name="sparkles" size={14} color="#22c55e" />
              <Text style={styles.tagline}>{t("landing.tagline")}</Text>
              <Ionicons name="sparkles" size={14} color="#22c55e" />
            </View>

            <Text style={styles.aiStatusText}>{t("landing.aiPowered")}</Text>
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
            <View
              style={[
                styles.card,
                !darkMode && {
                  backgroundColor: Colors.bg,
                  borderColor: Colors.line,
                  borderWidth: 1,
                },
              ]}
            >
              {clerkUiEnabled ? (
                <ClerkLandingHeroContent styles={styles} t={t} />
              ) : (
                <>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderTextBlock}>
                      <Text style={styles.cardTitle}>{t("landing.getStarted")}</Text>
                      <Text style={styles.cardSubtitle}>
                        {t("landing.launchDescription")}
                      </Text>
                    </View>
                  </View>
                  <DefaultGetStartedCTA styles={styles} t={t} />
                </>
              )}

              <View style={styles.featuresRow}>
                <View style={styles.featureItem}>
                  <View style={styles.featureIconContainer}>
                    <Ionicons
                      name="calculator-outline"
                      size={22}
                      color="#22c55e"
                    />
                  </View>
                  <Text style={styles.featureTitle}>
                    {t("landing.aiEstimates")}
                  </Text>
                </View>

                <View style={styles.featureItem}>
                  <View style={styles.featureIconContainer}>
                    <Ionicons
                      name="trending-up-outline"
                      size={22}
                      color="#22c55e"
                    />
                  </View>
                  <Text style={styles.featureTitle}>
                    {t("landing.profitTracking")}
                  </Text>
                </View>

                <View style={styles.featureItem}>
                  <View style={styles.featureIconContainer}>
                    <Ionicons name="people-outline" size={22} color="#22c55e" />
                  </View>
                  <Text style={styles.featureTitle}>
                    {t("landing.teamManagement")}
                  </Text>
                </View>
              </View>

              <View style={styles.reassureRow}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={16}
                  color={darkMode ? "#6ee7b7" : "#16a34a"}
                />
                <Text style={styles.reassureText}>
                  {t("landing.dataPrivacy")}
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
            style={[styles.cardBorder, styles.feedbackCardBorder]}
          >
            <View
              style={[
                styles.card,
                styles.feedbackCard,
                !darkMode && {
                  backgroundColor: Colors.bg,
                  borderColor: Colors.line,
                  borderWidth: 1,
                },
              ]}
            >
              <View style={styles.feedbackCardInner}>
                <Text style={styles.feedbackTitle}>
                  {t("landing.whatBuildersSay")}
                </Text>
                <Text style={styles.feedbackSubtitle}>
                  {t("landing.trustedBy")}
                </Text>
                <View style={styles.testimonialIconCircle}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={26}
                    color="#22c55e"
                  />
                </View>
                <RotatingTestimonial
                  testimonials={testimonials}
                  styles={styles}
                  darkMode={darkMode}
                />
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

const getStyles = (Colors: any, darkMode: boolean, windowWidth: number) => {
  const wideWeb =
    Platform.OS === "web" && windowWidth >= LANDING_WIDE_WEB_MIN_WIDTH;

  return StyleSheet.create({
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
    paddingHorizontal: wideWeb ? 24 : 20,
    paddingTop: 0,
    paddingBottom: 40,
    overflow: 'visible',
  },
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'visible',
  },
  scrollView: {
    flex: 1,
  },
  wideContainer: {
    ...(wideWeb
      ? {
          marginHorizontal: 0,
          paddingHorizontal: 0,
          maxWidth: LANDING_MAX_CONTENT_WIDTH,
          alignSelf: "center" as const,
          width: "100%",
        }
      : {
          marginHorizontal: -20,
          paddingHorizontal: 8,
        }),
    position: "relative",
  },
  logoGradientBg: {
    position: "absolute",
    top: -500,
    left: -windowWidth * 1.5,
    right: -windowWidth * 1.5,
    height: 1000,
    borderRadius: 999,
    zIndex: 0,
  },

  headerSection: {
    alignItems: "center",
    marginBottom: wideWeb ? 12 : 22,
    paddingTop: wideWeb ? 12 : 20,
  },
  logoWrapper: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  logoGlowWrapper: {
    width: 116,
    height: 116,
    borderRadius: 58,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    shadowColor: "#22c55e",
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: darkMode ? 8 : 6,
  },
  logoOuter: {
    width: 116,
    height: 116,
    borderRadius: 58,
    padding: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  logoInner: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: Colors.bg,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  logoImage: {
    width: 176,
    height: 176,
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
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.6,
    lineHeight: 32,
    paddingHorizontal: 8,
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
  aiStatusText: {
    fontSize: 13,
    marginTop: 10,
    textAlign: "center",
    paddingHorizontal: 12,
    color: darkMode ? "#6ee7b7" : "#15803d",
    fontWeight: "500",
  },

  cardBorder: {
    borderRadius: 28,
    padding: 1,
    marginBottom: wideWeb ? 12 : 16,
    shadowColor: darkMode ? '#00A6FF' : "transparent",
    shadowOpacity: darkMode ? 0.16 : 0,
    shadowRadius: darkMode ? 14 : 0,
    shadowOffset: { width: 0, height: darkMode ? 10 : 0 },
    elevation: darkMode ? 10 : 0,
    borderWidth: 0,
    borderColor: "transparent",
    overflow: 'hidden',
  },
  feedbackCardBorder: {
    marginBottom: 0,
    shadowOpacity: darkMode ? 0.1 : 0,
    shadowRadius: darkMode ? 10 : 0,
    shadowOffset: { width: 0, height: darkMode ? 6 : 0 },
  },
  card: {
    backgroundColor: darkMode ? "#000000" : "#FFFFFF",
    borderRadius: 26,
    padding: wideWeb ? 22 : 20,
    borderWidth: darkMode ? 0 : 0, // Border on wrapper, not card
  },
  feedbackCard: {
    paddingVertical: wideWeb ? 14 : 16,
    paddingHorizontal: wideWeb ? 20 : 18,
  },
  feedbackCardInner: {
    alignItems: "center",
  },
  testimonialIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: darkMode ? "rgba(34, 197, 94, 0.12)" : "rgba(34, 197, 94, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: darkMode ? "rgba(34, 197, 94, 0.35)" : "rgba(34, 197, 94, 0.25)",
  },
  testimonialContent: {
    width: "100%",
    minHeight: 88,
    justifyContent: "center",
  },
  testimonialQuote: {
    fontSize: wideWeb ? 15 : 14,
    lineHeight: 22,
    fontStyle: "italic",
    textAlign: "center",
    color: darkMode ? "#e2e8f0" : "#334155",
    fontWeight: "500",
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  testimonialDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  testimonialDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  testimonialDotActive: {
    width: 18,
    borderRadius: 3,
  },
  testimonialAttribution: {
    fontSize: 13,
    textAlign: "center",
    color: darkMode ? "#94a3b8" : "#64748b",
    fontWeight: "500",
  },
  feedbackTitle: {
    fontSize: wideWeb ? 17 : 18,
    fontWeight: "700",
    textAlign: "center",
    color: darkMode ? "#FFFFFF" : "#0F172A",
    letterSpacing: 0.2,
  },
  feedbackSubtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    color: darkMode ? "#94a3b8" : "#64748b",
    fontWeight: "500",
    maxWidth: 440,
    paddingHorizontal: 8,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: wideWeb ? 14 : 16,
  },
  cardHeaderTextBlock: {
    alignItems: "center",
    width: "100%",
    ...(wideWeb ? { maxWidth: 520 } : {}),
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
    ...(wideWeb
      ? {
          alignSelf: "center" as const,
          maxWidth: LANDING_CTA_MAX_WIDTH,
        }
      : {}),
    marginBottom: wideWeb ? 18 : 22,
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
    justifyContent: wideWeb ? "space-evenly" : "space-between",
    width: "100%",
    gap: wideWeb ? 12 : 10,
    paddingHorizontal: wideWeb ? 4 : 0,
  },
  featureItem: {
    flex: 1,
    alignItems: "center",
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
    fontSize: wideWeb ? 14 : 13,
    color: darkMode ? "#e2e8f0" : "#0F172A",
    fontWeight: "600",
    textAlign: "center",
  },

  reassureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: wideWeb ? 12 : 16,
    gap: 6,
  },
  reassureText: {
    fontSize: 12,
    color: darkMode ? "#FFFFFF" : "#475569",
  },

});
};
