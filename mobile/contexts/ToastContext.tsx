import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenLayout } from '@/constants/ScreenLayout';
import { haptic } from '@/utils/haptics';

type ToastTone = 'success' | 'error' | 'info';

type ToastState = {
  id: number;
  message: string;
  subtitle?: string;
  tone: ToastTone;
};

type ToastApi = {
  success: (message: string, subtitle?: string) => void;
  error: (message: string, subtitle?: string) => void;
  info: (message: string, subtitle?: string) => void;
};

const noop: ToastApi = { success: () => {}, error: () => {}, info: () => {} };
const ToastContext = createContext<ToastApi>(noop);

const TONE = {
  success: { icon: 'check-circle' as const, color: '#2dcc9a', border: 'rgba(45, 204, 154, 0.35)' },
  error: { icon: 'error' as const, color: '#f87171', border: 'rgba(248, 113, 113, 0.4)' },
  info: { icon: 'info' as const, color: '#d7e1f0', border: 'rgba(148, 163, 184, 0.35)' },
};

const VISIBLE_MS = 2400;

function ToastView({ toast, onHidden }: { toast: ToastState; onHidden: () => void }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.parallel([
      Animated.timing(translateY, { toValue: 40, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => finished && onHidden());
  }, [translateY, opacity, onHidden]);

  useEffect(() => {
    translateY.setValue(40);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 4 }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
    timer.current = setTimeout(hide, VISIBLE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast.id, translateY, opacity, hide]);

  const tone = TONE[toast.tone];
  const bottom =
    Platform.OS === 'web'
      ? 20
      : ScreenLayout.tabBar.bottomOffset + ScreenLayout.tabBar.height + 12 + insets.bottom;

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom }]}>
      <Animated.View style={{ transform: [{ translateY }], opacity }}>
        <Pressable
          onPress={hide}
          accessibilityRole="alert"
          accessibilityLabel={toast.subtitle ? `${toast.message}. ${toast.subtitle}` : toast.message}
          style={[styles.toast, { borderColor: tone.border }]}
        >
          <MaterialIcons name={tone.icon} size={20} color={tone.color} />
          <View style={styles.textCol}>
            <Text style={styles.message} numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {toast.subtitle}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(1);

  const show = useCallback((tone: ToastTone, message: string, subtitle?: string) => {
    if (tone === 'success') haptic.success();
    else if (tone === 'error') haptic.error();
    setToast({ id: nextId.current++, message, subtitle, tone });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, subtitle) => show('success', message, subtitle),
      error: (message, subtitle) => show('error', message, subtitle),
      info: (message, subtitle) => show('info', message, subtitle),
    }),
    [show]
  );

  const clear = useCallback(() => setToast(null), []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onHidden={clear} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 3000,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 520,
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  textCol: {
    flexShrink: 1,
  },
  message: {
    color: '#F5F7FA',
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: '#d7e1f0',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
});
