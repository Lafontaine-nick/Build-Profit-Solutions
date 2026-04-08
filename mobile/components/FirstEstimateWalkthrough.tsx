import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';

const SHEET_MAX_VH = 0.26;

type ColorTokens = {
  text: string;
  sub: string;
  card: string;
  line: string;
  primary: string;
};

export type WalkthroughBackdropVariant = 'full' | 'blurOnly' | 'none';

type ShellProps = {
  darkMode: boolean;
  bottomOffset: number;
  children: React.ReactNode;
  /**
   * full: dim + blur (default). blurOnly: blur only, no dim — keeps black behind nav/pills true
   * while still frosting content behind the sheet. none: sheet only.
   */
  backdropVariant?: WalkthroughBackdropVariant;
};

/**
 * Light backdrop + anchored bottom sheet. Backdrop uses pointerEvents="none" so the estimate
 * UI stays scrollable/tappable; only the sheet captures touches.
 */
export function FirstEstimateWalkthroughSheetShell({
  darkMode,
  bottomOffset,
  children,
  backdropVariant = 'full',
}: ShellProps) {
  const maxH = Math.round(Dimensions.get('window').height * SHEET_MAX_VH);

  return (
    <View
      style={[styles.shellRoot, { zIndex: 2000, elevation: 2000 }]}
      pointerEvents="box-none"
    >
      {backdropVariant === 'full' ? (
        <>
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: darkMode ? 'rgba(0,0,0,0.115)' : 'rgba(0,0,0,0.038)',
              },
            ]}
          />
          {Platform.OS === 'ios' ? (
            <BlurView
              pointerEvents="none"
              intensity={darkMode ? 6 : 4}
              tint={darkMode ? 'dark' : 'light'}
              style={[StyleSheet.absoluteFillObject, { opacity: darkMode ? 0.5 : 0.31 }]}
            />
          ) : null}
        </>
      ) : null}
      {backdropVariant === 'blurOnly' ? (
        <BlurView
          pointerEvents="none"
          intensity={darkMode ? 6 : 4}
          tint={darkMode ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFillObject, { opacity: darkMode ? 0.36 : 0.26 }]}
        />
      ) : null}

      <View
        style={[styles.sheetAnchor, { bottom: bottomOffset, maxHeight: maxH }]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.sheetCard,
            {
              backgroundColor: darkMode ? 'rgba(18, 22, 28, 0.97)' : 'rgba(255,255,255,0.98)',
              borderColor: darkMode ? 'rgba(148, 163, 184, 0.17)' : 'rgba(0,0,0,0.07)',
            },
          ]}
        >
          <View style={styles.dragPill} />
          {children}
        </View>
      </View>
    </View>
  );
}

/** Subtle inline hint for steps 1–2 (no bottom sheet). */
export function FirstEstimateWalkthroughMicroHint({
  darkMode,
  text,
}: {
  darkMode: boolean;
  text: string;
}) {
  return (
    <View
      style={[
        styles.microHint,
        {
          backgroundColor: darkMode ? 'rgba(148, 163, 184, 0.055)' : 'rgba(15, 23, 42, 0.032)',
          borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.06)',
        },
      ]}
    >
      <Text
        style={[
          styles.microHintText,
          { color: darkMode ? 'rgba(248, 250, 252, 0.82)' : 'rgba(15, 23, 42, 0.78)' },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

type IntroContentProps = {
  darkMode: boolean;
  Colors: ColorTokens;
  onStart: () => void;
  onSkip: () => void;
  /** Override defaults (e.g. active-project walkthrough on Projects tab). */
  title?: string;
  body?: string;
  startButtonLabel?: string;
};

export function FirstEstimateWalkthroughIntroSheetContent({
  darkMode,
  Colors,
  onStart,
  onSkip,
  title = "Let's build your first estimate",
  body = "We'll point out the key parts so you can price the job right and bid with confidence.",
  startButtonLabel = 'Start walkthrough',
}: IntroContentProps) {
  return (
    <>
      <Text style={[styles.title, { color: Colors.text }]}>{title}</Text>
      <Text
        style={[styles.body, { color: darkMode ? 'rgba(248, 250, 252, 0.78)' : Colors.sub }]}
        numberOfLines={4}
      >
        {body}
      </Text>
      <View style={styles.introRow}>
        <LinearGradient
          colors={['#22c55e', '#22d3ee']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradFlex}
        >
          <Pressable style={styles.gradPadSm} onPress={onStart}>
            <Text style={styles.gradLabel}>{startButtonLabel}</Text>
          </Pressable>
        </LinearGradient>
        <TouchableOpacity onPress={onSkip} style={styles.skipCompact} hitSlop={10} activeOpacity={0.7}>
          <Text style={[styles.skipLabel, { color: darkMode ? 'rgba(148, 163, 184, 0.95)' : Colors.sub }]}>
            Skip
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

type StepContentProps = {
  darkMode: boolean;
  Colors: ColorTokens;
  title: string;
  body: string;
  onGotIt: () => void;
  onSkipWalkthrough: () => void;
};

export function FirstEstimateWalkthroughStepSheetContent({
  darkMode,
  Colors,
  title,
  body,
  onGotIt,
  onSkipWalkthrough,
}: StepContentProps) {
  return (
    <>
      <View style={styles.stepHeaderRow}>
        <Text style={[styles.titleSm, { color: Colors.text, flex: 1 }]} numberOfLines={2}>
          {title}
        </Text>
        <TouchableOpacity
          onPress={onSkipWalkthrough}
          hitSlop={14}
          style={styles.closeBtn}
          accessibilityLabel="Skip walkthrough"
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="close"
            size={22}
            color={darkMode ? 'rgba(148, 163, 184, 0.9)' : Colors.sub}
          />
        </TouchableOpacity>
      </View>
      <Text
        style={[styles.bodySm, { color: darkMode ? 'rgba(248, 250, 252, 0.8)' : Colors.sub }]}
        numberOfLines={4}
      >
        {body}
      </Text>
      <View style={styles.stepActions}>
        <TouchableOpacity
          onPress={onSkipWalkthrough}
          style={styles.skipWalkthroughBtn}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.skipWalkthroughLabel,
              {
                color: darkMode ? 'rgba(203, 213, 225, 0.88)' : 'rgba(51, 65, 85, 0.92)',
              },
            ]}
          >
            Skip walkthrough
          </Text>
        </TouchableOpacity>
        <LinearGradient
          colors={['#22c55e', '#22d3ee']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradFlex}
        >
          <TouchableOpacity style={styles.gradPadSm} onPress={onGotIt} activeOpacity={0.85}>
            <Text style={styles.gradLabel}>Got it</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </>
  );
}

/** Wrap the primary step card to add a soft coach highlight (first-estimate walkthrough). */
export function FirstEstimateWalkthroughHighlight({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  if (!active) return <>{children}</>;
  return (
    <LinearGradient
      colors={['rgba(148, 200, 190, 0.14)', 'rgba(148, 163, 184, 0.11)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.highlightRing}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  shellRoot: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
  },
  sheetCard: {
    marginHorizontal: 18,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingTop: 4,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 14,
  },
  dragPill: {
    alignSelf: 'center',
    width: 28,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(148, 163, 184, 0.22)',
    marginBottom: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 22,
    marginBottom: 4,
  },
  titleSm: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.25,
    lineHeight: 21,
    marginBottom: 0,
    paddingRight: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 8,
  },
  bodySm: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 7,
    marginTop: 1,
  },
  introRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  closeBtn: {
    padding: 4,
    marginTop: -2,
  },
  stepActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skipWalkthroughBtn: {
    flexShrink: 1,
    minHeight: 40,
    paddingHorizontal: 4,
    paddingVertical: 0,
    justifyContent: 'center',
  },
  skipWalkthroughLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.15,
  },
  gradFlex: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradPadSm: {
    minHeight: 40,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  skipCompact: {
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  skipLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  highlightRing: {
    borderRadius: 24,
    padding: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  microHint: {
    marginBottom: 14,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  microHintText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
});
