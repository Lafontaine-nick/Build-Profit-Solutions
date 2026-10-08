import React, { useCallback, useEffect, useRef, useMemo, useState } from "react";
import {
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useUser } from "@clerk/clerk-react";
import { useClerkUiReady } from "@/hooks/useClerkUiReady";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import { useClerkUiEnabled } from "@/contexts/ClerkUiContext";
import {
  WEB_CENTERED_COLUMN_MAX_WIDTH,
  WEB_CENTERED_COLUMN_MIN_WIDTH,
  getWideContainerInset,
} from "@/constants/ScreenLayout";
import {
  ESTIMATE_FLOW_NESTED_FIELD_BG_DARK,
  estimateFlowCardStyle,
} from "@/utils/estimateFlowCardStyle";

/** Solid fill on the green side of the logo glow. The ring fades to cyan, so a cyan fill reads bluer than the halo. */
const LANDING_BUTTON_MINT = "#2dcc9a";

function LandingPrimaryCTA({
  styles,
  label,
  onPress,
  disabled,
  loading,
}: {
  styles: ReturnType<typeof getStyles>;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#050B13" />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

/** Clerk session — used only to decide Go to Dashboard vs Get Started; never blocks the CTA. */
function useClerkLandingSession() {
  const { isSignedIn, isLoaded, getToken, clerkTimedOut } = useClerkUiReady();
  const { user } = useUser();
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
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
  }, [isLoaded, isSignedIn, getToken]);

  /** Only when Clerk fully loaded — not after AuthGate timeout with a stale/partial session. */
  const showGoToDashboard =
    isLoaded && !clerkTimedOut && (!!isSignedIn || !!user?.id || hasToken);

  return {
    showGoToDashboard,
    clerkLoaded: isLoaded,
    clerkTimedOut,
    user,
    getToken,
    isSignedIn,
  };
}

type LandingSessionState = "loading" | "signedIn" | "signedOut";

function ClerkLandingHeroContent({
  styles,
  t,
  onSessionStateChange,
}: {
  styles: ReturnType<typeof getStyles>;
  t: (key: string) => string;
  onSessionStateChange: (state: LandingSessionState) => void;
}) {
  const router = useRouter();
  const { showGoToDashboard, clerkLoaded, clerkTimedOut, user, getToken, isSignedIn } =
    useClerkLandingSession();
  const [openingDashboard, setOpeningDashboard] = useState(false);

  useEffect(() => {
    onSessionStateChange(
      showGoToDashboard
        ? "signedIn"
        : clerkLoaded || clerkTimedOut
          ? "signedOut"
          : "loading"
    );
  }, [showGoToDashboard, clerkLoaded, clerkTimedOut, onSessionStateChange]);

  useEffect(() => {
    if (!openingDashboard) return;
    const reset = setTimeout(() => setOpeningDashboard(false), 8000);
    return () => clearTimeout(reset);
  }, [openingDashboard]);

  const onPress = async () => {
    if (openingDashboard) return;
    setOpeningDashboard(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      let goDashboard = showGoToDashboard;
      if (!goDashboard && clerkLoaded && !clerkTimedOut) {
        try {
          const tok = await Promise.race([
            getToken(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
          ]);
          goDashboard = !!(isSignedIn || user?.id || tok);
        } catch {
          goDashboard = false;
        }
      }
      if (goDashboard && clerkLoaded && !clerkTimedOut) {
        router.replace("/(tabs)/dashboard");
      } else {
        router.push("/auth?mode=signin");
      }
    } catch {
      router.push("/auth?mode=signin");
    } finally {
      setOpeningDashboard(false);
    }
  };

  const buttonLabel = openingDashboard
    ? "Opening Dashboard..."
    : showGoToDashboard
      ? t("landing.goToDashboardButton")
      : t("landing.getStartedButton");
  const firstName = user?.firstName?.trim();
  const welcomeHeadline = firstName
    ? `${t("landing.goToDashboardHeadline")}, ${firstName}`
    : t("landing.goToDashboardHeadline");

  return (
    <>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderTextBlock}>
          <Text style={styles.cardTitle}>
            {showGoToDashboard ? welcomeHeadline : t("landing.getStarted")}
          </Text>
          <Text style={styles.cardSubtitle}>
            {showGoToDashboard
              ? t("landing.goToDashboardDescription")
              : t("landing.launchDescription")}
          </Text>
        </View>
      </View>

      <LandingPrimaryCTA
        styles={styles}
        label={buttonLabel}
        onPress={onPress}
        disabled={openingDashboard}
        loading={openingDashboard}
      />
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
    <LandingPrimaryCTA
      styles={styles}
      label={t("landing.getStartedButton")}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push("/auth?mode=signin");
      }}
    />
  );
}

/**
 * The quotes in `landing.testimonials` are placeholders. Fabricated testimonials can't ship
 * (FTC 16 CFR 465), so the card only renders in dev builds until real, permissioned quotes
 * replace them — then set this to true.
 */
const LANDING_REVIEWS_APPROVED_FOR_RELEASE = false;
const SHOW_LANDING_REVIEWS = LANDING_REVIEWS_APPROVED_FOR_RELEASE || __DEV__;

type LandingReview = { quote: string; attribution: string };

const REVIEW_ROTATE_MS = 5500;
const REVIEW_FADE_MS = 350;

function getLandingReviews(t: TFunction): LandingReview[] {
  const raw = t("landing.testimonials", { returnObjects: true });
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is LandingReview =>
      !!item &&
      typeof item === "object" &&
      typeof (item as LandingReview).quote === "string" &&
      typeof (item as LandingReview).attribution === "string"
  );
}

function LandingReviewsCard({
  reviews,
  title,
  styles,
  darkMode,
}: {
  reviews: LandingReview[];
  title: string;
  styles: ReturnType<typeof getStyles>;
  darkMode: boolean;
}) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  const advance = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: REVIEW_FADE_MS,
      useNativeDriver: Platform.OS !== "web",
    }).start(({ finished }) => {
      if (!finished) return;
      setIndex((prev) => (prev + 1) % reviews.length);
      Animated.timing(opacity, {
        toValue: 1,
        duration: REVIEW_FADE_MS,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    });
  }, [opacity, reviews.length]);

  useEffect(() => {
    if (reviews.length <= 1) return;
    const timer = setInterval(advance, REVIEW_ROTATE_MS);
    return () => clearInterval(timer);
  }, [advance, reviews.length]);

  const current = reviews[index] ?? reviews[0];
  if (!current) return null;
  const quoteText = `\u201C${current.quote.trim().replace(/^["\u201C]+|["\u201D]+$/g, "")}\u201D`;

  return (
    <>
      <Text style={[styles.feedbackTitle, styles.reviewCentered]}>{title}</Text>
      <Animated.View style={[styles.reviewContent, { opacity }]}>
        <View style={styles.reviewStars}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Ionicons key={i} name="star" size={14} color="#2dcc9a" />
          ))}
        </View>
        <Text style={styles.reviewQuote}>{quoteText}</Text>
        <Text style={styles.reviewAttribution}>{current.attribution}</Text>
      </Animated.View>
      {reviews.length > 1 ? (
        <View style={styles.reviewDots}>
          {reviews.map((_, i) => (
            <View
              key={i}
              style={[
                styles.reviewDot,
                i === index && styles.reviewDotActive,
                {
                  backgroundColor:
                    i === index
                      ? "#2dcc9a"
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

const HOW_IT_WORKS_STEPS: {
  key: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  { key: "landing.howItWorksStep1", icon: "document-text-outline" },
  { key: "landing.howItWorksStep2", icon: "pricetags-outline" },
  { key: "landing.howItWorksStep3", icon: "stats-chart-outline" },
];

/** Wide web: centered premium column (not full-bleed mobile layout) */
const LANDING_WIDE_WEB_MIN_WIDTH = WEB_CENTERED_COLUMN_MIN_WIDTH;
const LANDING_MAX_CONTENT_WIDTH = WEB_CENTERED_COLUMN_MAX_WIDTH;
const LANDING_CTA_MAX_WIDTH = 400;

export default function LandingScreen() {
  const clerkUiEnabled = useClerkUiEnabled();
  const { width: windowWidth } = useWindowDimensions();
  const { t, i18n } = useTranslation();
  const reviews = useMemo(
    () => (SHOW_LANDING_REVIEWS ? getLandingReviews(t) : []),
    [t, i18n.language]
  );
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(
    () => getStyles(Colors, darkMode, windowWidth),
    [Colors, darkMode, windowWidth]
  );
  const wideWeb =
    Platform.OS === "web" && windowWidth >= LANDING_WIDE_WEB_MIN_WIDTH;
  const insets = useSafeAreaInsets();
  const [sessionState, setSessionState] = useState<LandingSessionState>(
    clerkUiEnabled ? "loading" : "signedOut"
  );
  const showIntro = sessionState === "signedOut";
  const returningUser = sessionState === "signedIn";
  const showReviews = sessionState !== "loading" && reviews.length > 0;
  const cardGap = wideWeb ? 12 : 16;

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
      <SafeAreaView style={styles.safeAreaShell} edges={['top']}>
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
        contentContainerStyle={[
          styles.scrollContent,
          { flexGrow: 1, paddingBottom: 24 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <Animated.View
          style={[
            styles.container,
            returningUser && styles.containerCentered,
            { opacity: fadeAnim },
          ]}
        >
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

            <Text style={styles.tagline}>{t("landing.tagline")}</Text>

            <Text style={styles.aiStatusText}>{t("landing.aiPowered")}</Text>
          </View>
          </View>

                    {/* HERO CARD */}
          <View style={[styles.wideContainer, styles.heroCardSection]}>
            <View
              style={[
                estimateFlowCardStyle(Colors, darkMode, {
                  marginBottom: showIntro || showReviews ? cardGap : 0,
                }),
                styles.card,
              ]}
            >
              {clerkUiEnabled ? (
                <ClerkLandingHeroContent
                  styles={styles}
                  t={t}
                  onSessionStateChange={setSessionState}
                />
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
                    <Ionicons name="calculator-outline" size={22} color="#2dcc9a" />
                  </View>
                  <Text
                    style={styles.featureTitle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {t("landing.aiEstimates")}
                  </Text>
                </View>

                <View style={styles.featureItem}>
                  <View style={styles.featureIconContainer}>
                    <Ionicons name="receipt-outline" size={22} color="#2dcc9a" />
                  </View>
                  <Text
                    style={styles.featureTitle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {t("landing.jobCosting")}
                  </Text>
                </View>

                <View style={styles.featureItem}>
                  <View style={styles.featureIconContainer}>
                    <Ionicons name="trending-up-outline" size={22} color="#2dcc9a" />
                  </View>
                  <Text
                    style={styles.featureTitle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {t("landing.profit")}
                  </Text>
                </View>

                <View style={styles.featureItem}>
                  <View style={styles.featureIconContainer}>
                    <Ionicons name="document-text-outline" size={22} color="#2dcc9a" />
                  </View>
                  <Text
                    style={styles.featureTitle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {t("landing.taxCenter")}
                  </Text>
                </View>
              </View>

              <View style={styles.reassureRow}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#2dcc9a" />
                <Text style={styles.reassureText}>
                  {t("landing.dataPrivacy")}
                </Text>
              </View>
            </View>
          </View>

          {/* HOW IT WORKS CARD */}
          {showIntro ? (
            <View style={styles.wideContainer}>
              <View
                style={[
                  estimateFlowCardStyle(Colors, darkMode, {
                    marginBottom: showReviews ? cardGap : 0,
                  }),
                  styles.card,
                  styles.feedbackCard,
                ]}
              >
                <Text style={styles.feedbackTitle}>{t("landing.howItWorks")}</Text>
                <View style={styles.howItWorksList}>
                  {HOW_IT_WORKS_STEPS.map((step) => (
                    <View key={step.key} style={styles.howItWorksRow}>
                      <View style={styles.howItWorksIcon}>
                        <Ionicons name={step.icon} size={18} color="#2dcc9a" />
                      </View>
                      <Text style={styles.howItWorksText}>{t(step.key)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {showReviews ? (
            <View style={styles.wideContainer}>
              <View
                style={[
                  estimateFlowCardStyle(Colors, darkMode, { marginBottom: 0 }),
                  styles.card,
                  styles.feedbackCard,
                ]}
              >
                <LandingReviewsCard
                  reviews={reviews}
                  title={t("landing.whatBuildersSay")}
                  styles={styles}
                  darkMode={darkMode}
                />
              </View>
            </View>
          ) : null}
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
  safeAreaShell: {
    flex: 1,
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
    overflow: 'visible',
  },
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'visible',
  },
  containerCentered: {
    justifyContent: "center",
    paddingBottom: 48,
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
          paddingHorizontal: getWideContainerInset(false, 8),
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
  tagline: {
    marginTop: 10,
    fontSize: 14,
    color: darkMode ? "#d7e1f0" : "#64748b",
    fontWeight: "500",
    textAlign: "center",
  },
  aiStatusText: {
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 12,
    color: darkMode ? "#d7e1f0" : "#64748b",
    fontWeight: "500",
  },

  heroCardSection: {
    marginTop: wideWeb ? 6 : 10,
  },
  card: {
    padding: wideWeb ? 22 : 20,
  },
  feedbackCard: {
    paddingVertical: wideWeb ? 14 : 16,
    paddingHorizontal: wideWeb ? 20 : 18,
  },
  feedbackTitle: {
    fontSize: wideWeb ? 17 : 18,
    fontWeight: "700",
    color: darkMode ? "#FFFFFF" : "#0F172A",
    letterSpacing: 0.2,
  },
  reviewCentered: {
    textAlign: "center",
  },
  reviewContent: {
    marginTop: 12,
    minHeight: 96,
    alignItems: "center",
  },
  reviewStars: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 2,
    marginBottom: 8,
  },
  reviewQuote: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 4,
    color: darkMode ? "#e2e8f0" : "#334155",
  },
  reviewAttribution: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    color: darkMode ? "#d7e1f0" : "#64748b",
  },
  reviewDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  reviewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  reviewDotActive: {
    width: 18,
  },
  howItWorksList: {
    marginTop: 14,
    gap: 12,
  },
  howItWorksRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  howItWorksIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(45, 204, 154, 0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  howItWorksText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: darkMode ? "#e2e8f0" : "#0F172A",
    fontWeight: "500",
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
    lineHeight: 19,
    color: darkMode ? "rgba(255, 255, 255, 0.72)" : "#475569",
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
    backgroundColor: LANDING_BUTTON_MINT,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#050B13",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  featuresRow: {
    flexDirection: "row",
    justifyContent: wideWeb ? "space-evenly" : "space-between",
    width: "100%",
    gap: wideWeb ? 12 : 6,
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
    backgroundColor: darkMode ? ESTIMATE_FLOW_NESTED_FIELD_BG_DARK : "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  featureTitle: {
    fontSize: wideWeb ? 14 : 12,
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
