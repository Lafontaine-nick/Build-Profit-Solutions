// @ts-nocheck
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { lookupScannedProduct } from '../services/productLookupService';
import { normalizeScannedBarcode } from '../lib/products/productScannerTypes';
import type { ProductSupplierId, ScannedProduct } from '../lib/products/productScannerTypes';
import { AI_FLOW_CARD_BG_DARK, ESTIMATE_FLOW_CARD_GAP, ESTIMATE_FLOW_CHIP_GREEN, ESTIMATE_FLOW_CHIP_GREEN_BG, ESTIMATE_FLOW_GREEN, ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD, estimateFlowCardStyle, estimateFlowInputShellStyle, estimateFlowOutlineActionButtonStyle, estimateFlowOutlineActionButtonTextStyle } from '@/utils/estimateFlowCardStyle';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';

let CameraView = null;
let CameraModule = null;
let useCameraPermissions = null;
let cameraUnavailableReason = '';
try {
  const { requireNativeModule } = require('expo-modules-core');
  requireNativeModule('ExpoCamera');
  const ExpoCamera = require('expo-camera');
  CameraModule =
    ExpoCamera?.launchScanner || ExpoCamera?.onModernBarcodeScanned
      ? ExpoCamera
      : ExpoCamera.Camera || ExpoCamera;
  CameraView = ExpoCamera.CameraView;
  useCameraPermissions = ExpoCamera.useCameraPermissions;
} catch (error) {
  cameraUnavailableReason =
    error?.message || 'Camera scanner is unavailable until the native app is rebuilt with expo-camera.';
}

const BARCODE_TYPES = [
  'aztec',
  'codabar',
  'code128',
  'code39',
  'code93',
  'datamatrix',
  'ean13',
  'ean8',
  'itf14',
  'pdf417',
  'qr',
  // iOS often reports UPC-A as EAN-13, but keeping UPC-A helps Android/devices that support it.
  'upc_e',
  'upc_a',
];

const SCANNER_SCREEN_BG = '#000000';
const PRODUCT_LOOKUP_TIMEOUT_MS = 20000;
const CAMERA_START_DELAY_MS = 1000;

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Product lookup timed out.')), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
};

export default function ProductScannerModal({
  visible,
  onClose,
  onProductFound,
  defaultZip,
  sourceHint,
}: {
  visible: boolean;
  onClose: () => void;
  onProductFound: (product: ScannedProduct) => void;
  defaultZip?: string;
  sourceHint?: ProductSupplierId | string;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaProvider>
        <ProductScannerModalContent
          visible={visible}
          onClose={onClose}
          onProductFound={onProductFound}
          defaultZip={defaultZip}
          sourceHint={sourceHint}
        />
      </SafeAreaProvider>
    </Modal>
  );
}

function ProductScannerModalContent({
  visible,
  onClose,
  onProductFound,
  defaultZip,
  sourceHint,
}: {
  visible: boolean;
  onClose: () => void;
  onProductFound: (product: ScannedProduct) => void;
  defaultZip?: string;
  sourceHint?: ProductSupplierId | string;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const Colors = getColors(theme);
  const darkMode = Colors.bg === '#000000';
  const flowHorizontalPad = ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD;
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const scanLockRef = useRef(false);
  const isLockedRef = useRef(isLocked);
  const isLookingUpRef = useRef(isLookingUp);
  const lookupRequestRef = useRef(0);
  const scanCooldownUntilRef = useRef(0);
  const scanResetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [cameraPaneReady, setCameraPaneReady] = useState(false);

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  useEffect(() => {
    isLookingUpRef.current = isLookingUp;
  }, [isLookingUp]);

  useEffect(() => {
    if (!visible) {
      setCameraPaneReady(false);
      return undefined;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      setCameraPaneReady(true);
    });

    return () => task.cancel?.();
  }, [visible]);

  const resetScannerState = useCallback(() => {
    lookupRequestRef.current += 1;
    scanLockRef.current = false;
    scanCooldownUntilRef.current = 0;
    if (scanResetTimerRef.current) {
      clearTimeout(scanResetTimerRef.current);
      scanResetTimerRef.current = undefined;
    }
    setIsLocked(false);
    setIsLookingUp(false);
    setManualCode('');
  }, []);

  useEffect(() => {
    resetScannerState();
  }, [resetScannerState, visible]);

  const handleClose = useCallback(() => {
    resetScannerState();
    void Promise.resolve(CameraModule?.dismissScanner?.()).catch(() => {});
    onClose();
  }, [onClose, resetScannerState]);

  const openProductFromCode = useCallback(
    async (code: string, codeType = 'manual') => {
      const trimmed = normalizeScannedBarcode(String(code || '').trim());
      if (!trimmed) {
        Alert.alert('Search product', 'Enter a UPC, SKU, model number, or product URL to search.');
        return;
      }
      if (scanLockRef.current) return;
      if (Date.now() < scanCooldownUntilRef.current) return;

      const isShortCameraBarcode =
        codeType !== 'manual' &&
        (/^ean8$/i.test(String(codeType || '')) ||
          (trimmed.length === 8 && /^barcode$/i.test(String(codeType || ''))));
      if (isShortCameraBarcode && trimmed.length === 8) {
        scanCooldownUntilRef.current = Date.now() + 1800;
        scanLockRef.current = true;
        setIsLocked(true);
        Alert.alert(
          'Short barcode detected',
          'This may be a secondary package barcode. Scan the longer 12-digit UPC-A barcode on the product, or enter this code manually below.',
        );
        scanResetTimerRef.current = setTimeout(() => {
          scanLockRef.current = false;
          scanCooldownUntilRef.current = 0;
          setIsLocked(false);
          scanResetTimerRef.current = undefined;
        }, 1800);
        return;
      }

      scanLockRef.current = true;
      const requestId = ++lookupRequestRef.current;
      setIsLocked(true);
      setIsLookingUp(true);

      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      try {
        const result = await withTimeout(
          lookupScannedProduct({
            code: trimmed,
            codeType,
            sourceHint: sourceHint || 'auto',
            zip: defaultZip,
          }),
          PRODUCT_LOOKUP_TIMEOUT_MS,
        );
        if (requestId !== lookupRequestRef.current) return;
        onProductFound(result.product);
      } catch (error) {
        if (requestId !== lookupRequestRef.current) return;
        const timedOut = error?.message === 'Product lookup timed out.';
        Alert.alert(
          timedOut ? 'Product lookup took too long' : 'Product lookup failed',
          timedOut
            ? 'The camera is ready again. Try scanning once more or enter the code manually.'
            : 'Check your connection and try again.',
        );
        resetScannerState();
      } finally {
        if (requestId === lookupRequestRef.current) {
          setIsLookingUp(false);
        }
      }
    },
    [defaultZip, onProductFound, resetScannerState, sourceHint],
  );

  const handleScanned = useCallback(
    ({ data, type }) => {
      if (scanLockRef.current || isLockedRef.current || isLookingUpRef.current) return;
      openProductFromCode(data, type || 'barcode');
    },
    [openProductFromCode],
  );

  const hasNativeCamera = Boolean(CameraView && useCameraPermissions);

  return (
    <View style={{ flex: 1, backgroundColor: SCANNER_SCREEN_BG }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: flowHorizontalPad,
          paddingBottom: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: SCANNER_SCREEN_BG,
        }}
      >
          <TouchableOpacity
            onPress={handleClose}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(52, 211, 153, 0.35)',
            }}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900' }}>Product Scanner</Text>
            <Text style={{ color: 'rgba(226,232,240,0.72)', fontSize: 12, marginTop: 2 }}>
              Scan any product — we detect Home Depot, Lowe&apos;s, and other stores automatically.
            </Text>
          </View>
          {isLookingUp ? <ActivityIndicator color={ESTIMATE_FLOW_CHIP_GREEN} /> : null}
        </View>

        <View
          style={{
            flex: 1,
            margin: flowHorizontalPad,
            borderRadius: 24,
            overflow: 'hidden',
            backgroundColor: SCANNER_SCREEN_BG,
            borderWidth: 1,
            borderColor: darkMode ? 'rgba(148,163,184,0.12)' : 'rgba(255,255,255,0.08)',
          }}
        >
          {hasNativeCamera ? (
            visible && cameraPaneReady ? (
              <LiveCameraScanner
                visible={visible}
                isLocked={isLocked}
                isLookingUp={isLookingUp}
                onScanned={handleScanned}
              />
            ) : (
              <View style={{ flex: 1, backgroundColor: SCANNER_SCREEN_BG }} />
            )
          ) : (
            <CameraUnavailablePanel reason={cameraUnavailableReason} />
          )}
        </View>

        <View style={{ paddingHorizontal: flowHorizontalPad, paddingBottom: Math.max(insets.bottom, 16) + 12, backgroundColor: SCANNER_SCREEN_BG }}>
          <View style={[estimateFlowCardStyle(Colors, darkMode), { gap: ESTIMATE_FLOW_CARD_GAP }]}>
            <Text style={{ color: 'rgba(226,232,240,0.72)', fontSize: 12, fontWeight: '700' }}>
              Enter code manually
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'stretch' }}>
              <TextInput
                value={manualCode}
                onChangeText={setManualCode}
                placeholder="UPC, SKU, model, or product URL"
                placeholderTextColor="rgba(226,232,240,0.45)"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLookingUp}
                returnKeyType="search"
                blurOnSubmit
                onSubmitEditing={() => openProductFromCode(manualCode, 'manual')}
                keyboardAppearance="dark"
                style={[
                  estimateFlowInputShellStyle(Colors, darkMode),
                  {
                    flex: 1,
                    flexBasis: 0,
                    minHeight: 46,
                    paddingHorizontal: 14,
                    color: '#FFFFFF',
                  },
                ]}
              />
              <TouchableOpacity
                onPress={() => openProductFromCode(manualCode, 'manual')}
                disabled={isLookingUp}
                style={[
                  estimateFlowOutlineActionButtonStyle(),
                  {
                    flex: 1,
                    flexBasis: 0,
                    minHeight: 46,
                    paddingHorizontal: 12,
                    opacity: isLookingUp ? 0.5 : 1,
                    backgroundColor: ESTIMATE_FLOW_CHIP_GREEN_BG,
                  },
                ]}
              >
                <Text style={[estimateFlowOutlineActionButtonTextStyle(), { fontWeight: '800' }]}>Search</Text>
              </TouchableOpacity>
            </View>
            {isLookingUp ? (
              <TouchableOpacity
                onPress={handleClose}
                style={{ alignItems: 'center', paddingVertical: 4 }}
              >
                <Text style={{ color: ESTIMATE_FLOW_CHIP_GREEN, fontWeight: '800' }}>
                  Cancel lookup
                </Text>
              </TouchableOpacity>
            ) : isLocked ? (
              <TouchableOpacity
                onPress={() => {
                  scanLockRef.current = false;
                  setIsLocked(false);
                }}
                style={{ alignItems: 'center', paddingVertical: 4 }}
              >
                <Text style={{ color: ESTIMATE_FLOW_CHIP_GREEN, fontWeight: '800' }}>Scan another code</Text>
              </TouchableOpacity>
            ) : null}
            <Text
              style={{
                color: 'rgba(226,232,240,0.46)',
                fontSize: 10.5,
                lineHeight: 15,
                fontWeight: '600',
                textAlign: 'center',
                marginTop: 4,
              }}
            >
              Not affiliated with Home Depot or Lowe&apos;s.
            </Text>
          </View>
        </View>
    </View>
  );
}

function CameraUnavailablePanel({ reason }: { reason: string }) {
  const { darkMode } = useTheme();
  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  const platformLabel = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Ionicons name="camera-outline" size={42} color={ESTIMATE_FLOW_CHIP_GREEN} />
      <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: 12, textAlign: 'center' }}>
        Camera scanner needs a rebuild
      </Text>
      <Text style={{ color: 'rgba(226,232,240,0.72)', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 }}>
        {isExpoGo
          ? 'Expo Go does not include this app’s camera module. Install your development build, or enter a code manually below.'
          : 'This install was built before expo-camera was added. Rebuild the dev client once, then open the app from that build (not Expo Go).'}
      </Text>
      {reason ? (
        <Text
          style={{
            color: 'rgba(148,163,184,0.9)',
            fontSize: 11,
            textAlign: 'center',
            marginTop: 10,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          }}
        >
          {reason}
        </Text>
      ) : null}
      <View
        style={{
          marginTop: 18,
          width: '100%',
          borderRadius: 14,
          padding: 14,
          backgroundColor: darkMode ? AI_FLOW_CARD_BG_DARK : 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          borderColor: darkMode ? 'rgba(148,163,184,0.12)' : 'rgba(52, 211, 153, 0.22)',
        }}
      >
        <Text style={{ color: ESTIMATE_FLOW_CHIP_GREEN, fontSize: 12, fontWeight: '800', marginBottom: 8 }}>
          Rebuild {platformLabel} dev client
        </Text>
        <Text style={{ color: 'rgba(226,232,240,0.82)', fontSize: 12, lineHeight: 18 }}>
          {`cd mobile\nnpm install\nnpm run build:dev:${Platform.OS === 'android' ? 'android' : 'ios'}`}
        </Text>
        <Text style={{ color: 'rgba(226,232,240,0.55)', fontSize: 11, marginTop: 8, lineHeight: 16 }}>
          Or locally: npx expo run:{Platform.OS === 'android' ? 'android' : 'ios'}
        </Text>
      </View>
      <Text style={{ color: 'rgba(226,232,240,0.55)', fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 17 }}>
        Manual UPC, SKU, model, or product URL entry works without a rebuild.
      </Text>
    </View>
  );
}

const LiveCameraScanner = memo(function LiveCameraScanner({ visible, isLocked, isLookingUp, onScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [lastScanHint, setLastScanHint] = useState('');
  const cameraReadyRef = useRef(false);
  const isLockedRef = useRef(isLocked);
  const isLookingUpRef = useRef(isLookingUp);
  const onScannedRef = useRef(onScanned);
  const hasPermission = permission?.granted;
  const canUseNativeScanner = Boolean(CameraModule?.launchScanner && CameraModule?.onModernBarcodeScanned);

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  useEffect(() => {
    isLookingUpRef.current = isLookingUp;
  }, [isLookingUp]);

  useEffect(() => {
    onScannedRef.current = onScanned;
  }, [onScanned]);

  // Give the user a moment to position the barcode when the scanner opens.
  // Detection and lookup behavior remains unchanged after the warm-up.
  useEffect(() => {
    if (!visible) {
      cameraReadyRef.current = false;
      return undefined;
    }
    const timer = setTimeout(() => {
      cameraReadyRef.current = true;
    }, CAMERA_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (!canUseNativeScanner) return undefined;

    const subscription = CameraModule.onModernBarcodeScanned((event) => {
      const data = event?.data || event?.value || event?.rawValue;
      if (!cameraReadyRef.current || !data || isLockedRef.current || isLookingUpRef.current) return;
      setLastScanHint(`Detected ${event?.type || 'barcode'}: ${data}`);
      void CameraModule.dismissScanner?.().catch?.(() => {});
      onScannedRef.current({ data, type: event?.type || 'barcode' });
    });

    return () => subscription?.remove?.();
  }, [canUseNativeScanner]);

  const launchNativeScanner = useCallback(() => {
    if (!canUseNativeScanner || !cameraReadyRef.current || isLockedRef.current || isLookingUpRef.current) return;
    CameraModule.launchScanner({
      barcodeTypes: BARCODE_TYPES,
      isGuidanceEnabled: true,
      isHighlightingEnabled: true,
    }).catch((error) => {
      Alert.alert('Scanner unavailable', error?.message || 'Use the live camera view or enter the code manually.');
    });
  }, [canUseNativeScanner]);

  const handleLiveBarcodeScanned = useCallback((event) => {
    const data = event?.data || event?.value || event?.rawValue;
    if (!cameraReadyRef.current || !data || isLockedRef.current || isLookingUpRef.current) return;
    setLastScanHint(`Detected ${event?.type || 'barcode'}: ${data}`);
    onScannedRef.current({ data, type: event?.type || 'barcode' });
  }, []);

  if (!hasPermission) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Ionicons name="camera-outline" size={42} color={ESTIMATE_FLOW_CHIP_GREEN} />
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: 12 }}>
          Camera permission needed
        </Text>
        <Text style={{ color: 'rgba(226,232,240,0.72)', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 }}>
          Allow camera access to scan product barcodes and QR codes.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={{ marginTop: 18, backgroundColor: ESTIMATE_FLOW_GREEN, borderRadius: 15, paddingHorizontal: 18, paddingVertical: 12 }}
        >
          <Text style={{ color: '#071018', fontWeight: '900' }}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <CameraView
      style={{ flex: 1, backgroundColor: SCANNER_SCREEN_BG }}
      facing="back"
      active={visible && !isLocked && !isLookingUp}
      barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
      onBarcodeScanned={handleLiveBarcodeScanned}
    >
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>
        <View
          style={{
            height: 210,
            borderRadius: 18,
            borderWidth: 3,
            borderColor: '#FFFFFF',
            backgroundColor: 'rgba(255,255,255,0.06)',
          }}
        />
        <Text
          style={{
            marginTop: 18,
            alignSelf: 'center',
            color: '#FFFFFF',
            backgroundColor: 'rgba(0,0,0,0.58)',
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 12,
            textAlign: 'center',
            fontWeight: '700',
          }}
        >
          Hold the barcode flat, fill the white box, and pause for a second
        </Text>
        {canUseNativeScanner ? (
          <TouchableOpacity
            onPress={launchNativeScanner}
            disabled={isLocked || isLookingUp}
            style={{
              marginTop: 12,
              alignSelf: 'center',
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: ESTIMATE_FLOW_CHIP_GREEN_BG,
              borderWidth: 1,
              borderColor: ESTIMATE_FLOW_CHIP_GREEN,
            }}
          >
            <Text style={{ color: ESTIMATE_FLOW_CHIP_GREEN, fontWeight: '800' }}>Use dedicated scanner</Text>
          </TouchableOpacity>
        ) : null}
        {lastScanHint ? (
          <Text
            style={{
              marginTop: 10,
              alignSelf: 'center',
              color: ESTIMATE_FLOW_CHIP_GREEN,
              backgroundColor: 'rgba(0,0,0,0.58)',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              textAlign: 'center',
              fontSize: 12,
              fontWeight: '800',
            }}
          >
            {lastScanHint}
          </Text>
        ) : null}
      </View>
    </CameraView>
  );
});
