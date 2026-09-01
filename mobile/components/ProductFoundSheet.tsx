// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  ProductScannerDestination,
  ProductScannerSavePayload,
  ScannedProduct,
} from '../lib/products/productScannerTypes';
import {
  getProductPageUrl,
  getProductUnitPrice,
  hasResolvedProductDetails,
  isBarcodePlaceholderTitle,
  isDirectProductPageUrl,
} from '../lib/products/productScannerTypes';
import { lookupScannedProduct } from '../services/productLookupService';
import { openStoreProductPage } from '../lib/products/openStoreProductPage';
import { PROJECT_WIDE_CONTAINER_CARD_INSET } from '../constants/ScreenLayout';
import {
  ESTIMATE_FLOW_CHIP_GREEN,
  ESTIMATE_FLOW_CHIP_GREEN_BG,
  ESTIMATE_FLOW_GREEN,
  estimateFlowPrimaryButtonStyle,
  estimateFlowPrimaryButtonTextStyle,
} from '@/utils/estimateFlowCardStyle';

const SHEET_HEIGHT_RATIO = 0.88;
const IOS_MODAL_BOTTOM_INSET = 34;

const DESTINATION_LABELS: Record<ProductScannerDestination, { title: string; subtitle: string; icon: string }> = {
  estimate: {
    title: 'Add to Estimate',
    subtitle: 'Original bid pricing',
    icon: 'calculator-outline',
  },
  project_budget: {
    title: 'Add to Project Budget',
    subtitle: 'Approved/original scope cost',
    icon: 'folder-outline',
  },
  change_order: {
    title: 'Add to Change Order',
    subtitle: 'New scope, revenue after approval',
    icon: 'document-text-outline',
  },
  purchase_order: {
    title: 'Add to Purchase Order',
    subtitle: 'Ordering/committed cost only',
    icon: 'receipt-outline',
  },
};

const money = (value: number) =>
  (Number(value) || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const applyProductFields = ({
  nextProduct,
  rawCode,
  setDescription,
  setUnitCost,
  setQuantity,
  currentDescription,
  currentUnitCost,
  currentQuantity,
  userEditedDescription = false,
  userEditedUnitCost = false,
  userEditedQuantity = false,
}: {
  nextProduct: ScannedProduct;
  rawCode?: string;
  setDescription: (value: string) => void;
  setUnitCost: (value: string) => void;
  setQuantity: (value: string) => void;
  currentDescription: string;
  currentUnitCost: string;
  currentQuantity: string;
  userEditedDescription?: boolean;
  userEditedUnitCost?: boolean;
  userEditedQuantity?: boolean;
}) => {
  const price = getProductUnitPrice(nextProduct);
  const title = String(nextProduct.title || '').trim();

  if (!userEditedDescription && title && !isBarcodePlaceholderTitle(title, rawCode)) {
    if (!currentDescription.trim() || isBarcodePlaceholderTitle(currentDescription, rawCode)) {
      setDescription(title);
    }
  }

  if (!userEditedUnitCost && price > 0) {
    if (!currentUnitCost.trim() || Number(String(currentUnitCost).replace(/[^0-9.]/g, '')) <= 0) {
      setUnitCost(String(price));
    }
  }

  if (!userEditedQuantity && (!currentQuantity.trim() || Number(currentQuantity) <= 0)) {
    setQuantity('1');
  }
};

export default function ProductFoundSheet({
  visible,
  product,
  destinations,
  defaultDestination,
  existingChangeOrders = [],
  lookupZip,
  primaryActionTitle,
  onClose,
  onSave,
}: {
  visible: boolean;
  product: ScannedProduct | null;
  destinations: ProductScannerDestination[];
  defaultDestination?: ProductScannerDestination;
  existingChangeOrders?: { id: string; title?: string; status?: string; amount?: number }[];
  lookupZip?: string;
  primaryActionTitle?: string;
  onClose: () => void;
  onSave: (payload: ProductScannerSavePayload) => void;
}) {
  const [destination, setDestination] = useState<ProductScannerDestination>(
    defaultDestination || destinations[0] || 'estimate',
  );
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [markupPct, setMarkupPct] = useState('20');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [changeOrderId, setChangeOrderId] = useState('');
  const [resolvedProduct, setResolvedProduct] = useState<ScannedProduct | null>(null);
  const [isResolvingDetails, setIsResolvingDetails] = useState(false);
  const [detailsLookupFinished, setDetailsLookupFinished] = useState(false);
  const [lookupFailureMessage, setLookupFailureMessage] = useState('');
  const [sheetReady, setSheetReady] = useState(false);
  const [internalNotesOpen, setInternalNotesOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const lookupRequestRef = useRef(0);
  const leftAppRef = useRef(false);
  const descriptionRef = useRef('');
  const unitCostRef = useRef('');
  const quantityRef = useRef('1');
  const userEditedQuantityRef = useRef(false);
  const userEditedUnitCostRef = useRef(false);
  const userEditedDescriptionRef = useRef(false);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const safeViewportHeight = Math.max(1, windowHeight - insets.top - insets.bottom);
  const sheetBottomInset = Math.max(
    insets.bottom,
    Platform.OS === 'ios' ? IOS_MODAL_BOTTOM_INSET : 16,
  );
  const sheetMaxHeight = Math.floor(safeViewportHeight * SHEET_HEIGHT_RATIO);
  const productScanKey = product
    ? [product.rawCode, product.upc, product.sku, product.title].filter(Boolean).join('|')
    : '';
  const destinationsKey = destinations.join(',');
  const openedSessionRef = useRef<string | null>(null);

  const displayProduct = resolvedProduct || product;

  useEffect(() => {
    descriptionRef.current = description;
  }, [description]);

  useEffect(() => {
    unitCostRef.current = unitCost;
  }, [unitCost]);

  useEffect(() => {
    quantityRef.current = quantity;
  }, [quantity]);

  useEffect(() => {
    if (!visible) {
      setKeyboardVisible(false);
      return undefined;
    }

    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const handleBackdropPress = useCallback(() => {
    if (keyboardVisible) {
      dismissKeyboard();
      return;
    }
    onClose();
  }, [dismissKeyboard, keyboardVisible, onClose]);

  const applyResolvedProduct = useCallback(
    (nextProduct: ScannedProduct) => {
      setResolvedProduct(nextProduct);
      applyProductFields({
        nextProduct,
        rawCode: product?.rawCode || nextProduct.rawCode,
        setDescription,
        setUnitCost,
        setQuantity,
        currentDescription: descriptionRef.current,
        currentUnitCost: unitCostRef.current,
        currentQuantity: quantityRef.current,
        userEditedDescription: userEditedDescriptionRef.current,
        userEditedUnitCost: userEditedUnitCostRef.current,
        userEditedQuantity: userEditedQuantityRef.current,
      });
    },
    [product?.rawCode],
  );

  const runProductLookup = useCallback(
    async (reason = 'initial') => {
      if (!product) return;
      const lookupCode = product.rawCode || product.upc || product.sku || product.title;
      if (!lookupCode) return;

      const requestId = ++lookupRequestRef.current;
      setIsResolvingDetails(true);
      setDetailsLookupFinished(false);
      setLookupFailureMessage('');

      try {
        const result = await lookupScannedProduct({
          code: lookupCode,
          codeType: product.codeType || 'barcode',
          sourceHint: product.supplierId || 'hd',
          zip: lookupZip,
        });
        if (requestId !== lookupRequestRef.current) return;
        if (result?.product) {
          applyResolvedProduct(result.product);
        }
      } catch {
        // Keep the placeholder product visible so the user can enter details manually.
        if (requestId === lookupRequestRef.current) {
          setLookupFailureMessage('Product lookup failed. Check your connection and try again.');
        }
      } finally {
        if (requestId === lookupRequestRef.current) {
          setIsResolvingDetails(false);
          setDetailsLookupFinished(true);
        }
      }
    },
    [applyResolvedProduct, lookupZip, product],
  );

  useEffect(() => {
    if (!visible) {
      setSheetReady(false);
      openedSessionRef.current = null;
      return;
    }
    if (!product) return;

    if (openedSessionRef.current === productScanKey) {
      return;
    }
    openedSessionRef.current = productScanKey;

    setResolvedProduct(product);
    setDetailsLookupFinished(false);
    setLookupFailureMessage('');
    setSheetReady(false);
    leftAppRef.current = false;
    const nextDestination = defaultDestination || destinations[0] || 'estimate';
    setDestination(nextDestination);
    setQuantity('1');
    setUnitCost('');
    setMarkupPct('20');
    setDescription(product.title || '');
    setNotes('');
    setCustomerNotes('');
    setChangeOrderId('');
    setInternalNotesOpen(false);
    userEditedQuantityRef.current = false;
    userEditedUnitCostRef.current = false;
    userEditedDescriptionRef.current = false;
  }, [defaultDestination, destinationsKey, product, productScanKey, visible]);

  useEffect(() => {
    if (!visible || !product) return undefined;

    const currentState = AppState.currentState;
    if (currentState === 'background') {
      leftAppRef.current = true;
    }

    const fallbackTimer = setTimeout(() => {
      setSheetReady(true);
      void runProductLookup('fallback');
    }, 2500);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        leftAppRef.current = true;
      }
      if (nextState === 'active' && leftAppRef.current) {
        clearTimeout(fallbackTimer);
        setSheetReady(true);
        void runProductLookup('foreground');
      }
    });

    return () => {
      clearTimeout(fallbackTimer);
      subscription.remove();
    };
  }, [product, runProductLookup, visible]);

  const qtyNum = Math.max(Number(quantity) || 0, 0);
  const unitCostNum = Math.max(Number(String(unitCost).replace(/[^0-9.]/g, '')) || 0, 0);
  const markupNum = Math.max(Number(String(markupPct).replace(/[^0-9.]/g, '')) || 0, 0);
  const costTotal = qtyNum * unitCostNum;
  const changeOrderSellTotal = useMemo(
    () => costTotal * (1 + markupNum / 100),
    [costTotal, markupNum],
  );

  const productPageUrl = displayProduct ? getProductPageUrl(displayProduct) : null;

  if (!displayProduct || !sheetReady) return null;

  const storePageLabel =
    displayProduct.supplierId === 'lowes'
      ? "View on Lowe's"
      : displayProduct.supplierId === 'hd'
        ? 'View on Home Depot'
        : 'View product page';
  const hasMultipleDestinations = destinations.length > 1;

  const canSave = qtyNum > 0 && unitCostNum > 0 && description.trim();
  const selectedMeta = DESTINATION_LABELS[destination];
  const sheetHorizontalInset = PROJECT_WIDE_CONTAINER_CARD_INSET;
  const sheetFooterBottomInset = 14;
  const metaChips = [
    displayProduct.model ? `Model ${displayProduct.model}` : '',
    displayProduct.upc ? `UPC ${displayProduct.upc}` : '',
    displayProduct.sku ? `SKU ${displayProduct.sku}` : '',
  ].filter(Boolean);
  const showLoadingBanner =
    !hasResolvedProductDetails(displayProduct) && (isResolvingDetails || !detailsLookupFinished);
  const hasCleanTitle = !isBarcodePlaceholderTitle(displayProduct.title, displayProduct.rawCode);
  const hasConfirmedPrice = getProductUnitPrice(displayProduct) > 0;
  const directProductPage = productPageUrl ? isDirectProductPageUrl(productPageUrl) : false;
  const fallbackMessage = (() => {
    if (lookupFailureMessage) return lookupFailureMessage;
    if (showLoadingBanner || !detailsLookupFinished) return '';
    if (hasCleanTitle && !hasConfirmedPrice) {
      return 'We found the product, but could not confirm the current price. Enter the unit cost manually before adding it.';
    }
    if (directProductPage && (!hasCleanTitle || !hasResolvedProductDetails(displayProduct))) {
      return 'We found the product page, but some details could not be filled automatically. Review and edit the fields before adding.';
    }
    if (!hasCleanTitle) {
      return "We couldn’t find a matching product. Try scanning again, entering the UPC manually, or searching by model number.";
    }
    return '';
  })();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)' }}>
            <Pressable
              style={{ flex: 1 }}
              onPress={handleBackdropPress}
              accessibilityRole="button"
              accessibilityLabel={keyboardVisible ? 'Dismiss keyboard' : 'Dismiss product sheet'}
            />
            <View
              style={{
                paddingHorizontal: sheetHorizontalInset,
                marginBottom: sheetBottomInset,
              }}
            >
              <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
              <View
                style={{
                  width: '100%',
                  alignSelf: 'stretch',
                  flexGrow: 0,
                  maxHeight: sheetMaxHeight,
                  flexDirection: 'column',
                  borderRadius: 24,
                  backgroundColor: '#050807',
                  borderWidth: 1,
                  borderColor: 'rgba(52, 211, 153, 0.24)',
                  overflow: 'hidden',
                }}
              >
          <Pressable onPress={dismissKeyboard} style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 }}>
            <View style={{ width: 48, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center', marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: ESTIMATE_FLOW_CHIP_GREEN, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Product Found
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              {displayProduct.imageUrl ? (
                <Image
                  source={{ uri: displayProduct.imageUrl }}
                  style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: '#111827', marginRight: 12 }}
                  resizeMode="contain"
                />
              ) : (
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    backgroundColor: ESTIMATE_FLOW_CHIP_GREEN_BG,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="cube-outline" size={26} color={ESTIMATE_FLOW_CHIP_GREEN} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900', lineHeight: 21 }}
                  numberOfLines={2}
                >
                  {displayProduct.title}
                </Text>
                <Text style={{ color: 'rgba(226,232,240,0.68)', fontSize: 12, marginTop: 4 }}>
                  {displayProduct.supplier}
                  {displayProduct.unitPrice ? ` · ${money(displayProduct.unitPrice)} each` : ' · Confirm price'}
                </Text>
                {metaChips.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {metaChips.map((chip) => (
                      <MetaChip key={chip} label={chip} />
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>

          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScrollBeginDrag={dismissKeyboard}
            nestedScrollEnabled
            bounces={false}
          >
            {showLoadingBanner ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(52, 211, 153, 0.28)',
                  backgroundColor: ESTIMATE_FLOW_CHIP_GREEN_BG,
                }}
              >
                <Ionicons name="sync-outline" size={16} color={ESTIMATE_FLOW_CHIP_GREEN} />
                <Text style={{ color: 'rgba(226,232,240,0.72)', fontSize: 12, fontWeight: '700', flex: 1 }}>
                  Filling in product details...
                </Text>
              </View>
            ) : null}

            {fallbackMessage ? (
              <View
                style={{
                  borderRadius: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(148,163,184,0.18)',
                  backgroundColor: 'rgba(148,163,184,0.08)',
                }}
              >
                <Text style={{ color: 'rgba(226,232,240,0.72)', fontSize: 12, lineHeight: 17, fontWeight: '700' }}>
                  {fallbackMessage}
                </Text>
              </View>
            ) : null}

            {productPageUrl ? (
              <>
                <TouchableOpacity
                  onPress={() => {
                    void openStoreProductPage(productPageUrl);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    borderRadius: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    marginBottom: 6,
                    borderWidth: 1,
                    borderColor: 'rgba(52, 211, 153, 0.35)',
                    backgroundColor: ESTIMATE_FLOW_CHIP_GREEN_BG,
                  }}
                >
                  <Ionicons name="open-outline" size={16} color={ESTIMATE_FLOW_CHIP_GREEN} />
                  <Text style={{ color: ESTIMATE_FLOW_CHIP_GREEN, fontSize: 12.5, fontWeight: '800' }}>{storePageLabel}</Text>
                </TouchableOpacity>
                <Text style={{ color: 'rgba(226,232,240,0.46)', fontSize: 10.5, lineHeight: 15, marginBottom: 14 }}>
                  Price source: Home Depot. Verify price, tax, and availability before purchase.
                </Text>
              </>
            ) : null}

            {hasMultipleDestinations ? (
              <>
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginBottom: 8 }}>Save product to</Text>
                <View style={{ gap: 8, marginBottom: 14 }}>
                  {destinations.map((option) => {
                    const meta = DESTINATION_LABELS[option];
                    const selected = destination === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        onPress={() => setDestination(option)}
                        style={{
                          borderRadius: 14,
                          padding: 11,
                          flexDirection: 'row',
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: selected ? ESTIMATE_FLOW_CHIP_GREEN : 'rgba(255,255,255,0.12)',
                          backgroundColor: selected ? ESTIMATE_FLOW_CHIP_GREEN_BG : 'rgba(255,255,255,0.045)',
                        }}
                      >
                        <Ionicons name={meta.icon} size={18} color={selected ? ESTIMATE_FLOW_CHIP_GREEN : 'rgba(226,232,240,0.7)'} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900' }}>{meta.title}</Text>
                          <Text style={{ color: 'rgba(226,232,240,0.62)', fontSize: 11, marginTop: 1 }}>{meta.subtitle}</Text>
                        </View>
                        {selected ? <Ionicons name="checkmark-circle" size={18} color={ESTIMATE_FLOW_CHIP_GREEN} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <Field
                label="Quantity"
                value={quantity}
                onChangeText={(value) => {
                  userEditedQuantityRef.current = true;
                  setQuantity(value);
                }}
                keyboardType="decimal-pad"
              />
              <Field
                label="Unit cost"
                value={unitCost}
                onChangeText={(value) => {
                  userEditedUnitCostRef.current = true;
                  setUnitCost(value);
                }}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={{ color: ESTIMATE_FLOW_CHIP_GREEN, fontSize: 12, fontWeight: '900', marginBottom: 12 }}>
              Line item total: {money(costTotal)}
            </Text>
            <Field
              label="Description"
              value={description}
              onChangeText={(value) => {
                userEditedDescriptionRef.current = true;
                setDescription(value);
              }}
              multiline
            />

            {destination === 'change_order' ? (
              <>
                {existingChangeOrders.length > 0 ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ color: 'rgba(226,232,240,0.72)', fontSize: 11, fontWeight: '800', marginBottom: 8 }}>
                      Change order
                    </Text>
                    <View style={{ gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => setChangeOrderId('')}
                        style={{
                          borderRadius: 13,
                          padding: 11,
                          borderWidth: 1,
                          borderColor: !changeOrderId ? ESTIMATE_FLOW_CHIP_GREEN : 'rgba(255,255,255,0.13)',
                          backgroundColor: !changeOrderId ? ESTIMATE_FLOW_CHIP_GREEN_BG : 'rgba(255,255,255,0.06)',
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' }}>Create new change order</Text>
                      </TouchableOpacity>
                      {existingChangeOrders.slice(0, 4).map((co) => (
                        <TouchableOpacity
                          key={co.id}
                          onPress={() => setChangeOrderId(co.id)}
                          style={{
                            borderRadius: 13,
                            padding: 11,
                            borderWidth: 1,
                            borderColor: changeOrderId === co.id ? ESTIMATE_FLOW_CHIP_GREEN : 'rgba(255,255,255,0.13)',
                            backgroundColor: changeOrderId === co.id ? ESTIMATE_FLOW_CHIP_GREEN_BG : 'rgba(255,255,255,0.06)',
                          }}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' }}>
                            Add to {co.title || 'Change Order'}
                          </Text>
                          <Text style={{ color: 'rgba(226,232,240,0.58)', fontSize: 11, marginTop: 2 }}>
                            {co.status || 'Submitted'} {co.amount ? `• ${money(co.amount)}` : ''}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}
                <View style={{ height: 12 }} />
                <Field label="Markup %" value={markupPct} onChangeText={setMarkupPct} keyboardType="decimal-pad" />
                <Text style={{ color: ESTIMATE_FLOW_CHIP_GREEN, fontSize: 12, fontWeight: '900', marginTop: 8 }}>
                  Change order customer price: {money(changeOrderSellTotal)}
                </Text>
                <View style={{ height: 12 }} />
                <Field label="Customer-facing notes" value={customerNotes} onChangeText={setCustomerNotes} multiline />
              </>
            ) : null}

            {destination === 'purchase_order' ? (
              <View
                style={{
                  borderRadius: 14,
                  padding: 12,
                  marginTop: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(245,158,11,0.38)',
                  backgroundColor: 'rgba(245,158,11,0.08)',
                }}
              >
                <Text style={{ color: '#fbbf24', fontSize: 12.5, lineHeight: 18, fontWeight: '800' }}>
                  This purchase order tracks ordering only. If this is new scope, add it to a Change Order first.
                </Text>
              </View>
            ) : null}

            <View style={{ marginTop: 12 }}>
              {internalNotesOpen || notes.trim() ? (
                <Field label="Internal notes" value={notes} onChangeText={setNotes} multiline />
              ) : (
                <TouchableOpacity
                  onPress={() => setInternalNotesOpen(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 8,
                  }}
                >
                  <Ionicons name="add-circle-outline" size={18} color={ESTIMATE_FLOW_CHIP_GREEN} />
                  <Text style={{ color: ESTIMATE_FLOW_CHIP_GREEN, fontSize: 13, fontWeight: '800' }}>Add internal notes (optional)</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          <View
            style={{
              paddingHorizontal: 14,
              paddingTop: 12,
              paddingBottom: sheetFooterBottomInset,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.08)',
              backgroundColor: '#050807',
            }}
          >
            <TouchableOpacity
              disabled={!canSave}
              onPress={() => {
                dismissKeyboard();
                onSave({
                  product: displayProduct,
                  destination,
                  quantity: qtyNum,
                  unitCost: unitCostNum,
                  markupPct: markupNum,
                  description: description.trim(),
                  notes: notes.trim(),
                  customerNotes: customerNotes.trim(),
                  changeOrderId: destination === 'change_order' ? changeOrderId || undefined : undefined,
                });
              }}
              style={[
                estimateFlowPrimaryButtonStyle(),
                {
                  minHeight: 50,
                  opacity: canSave ? 1 : 0.45,
                  backgroundColor: canSave ? ESTIMATE_FLOW_GREEN : 'rgba(255,255,255,0.12)',
                },
              ]}
            >
              <Text style={canSave ? estimateFlowPrimaryButtonTextStyle() : { color: 'rgba(226,232,240,0.55)', fontSize: 15, fontWeight: '900' }}>
                {primaryActionTitle || selectedMeta?.title || 'Add Product'}
              </Text>
            </TouchableOpacity>
          </View>
              </View>
              </TouchableWithoutFeedback>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    </Modal>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
      }}
    >
      <Text style={{ color: 'rgba(226,232,240,0.82)', fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function Field({ label, value, onChangeText, keyboardType = 'default', multiline = false, compact = false }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: 'rgba(226,232,240,0.72)', fontSize: 11, fontWeight: '800', marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable
        keyboardType={keyboardType}
        multiline={multiline || compact}
        numberOfLines={multiline ? 3 : compact ? 2 : 1}
        placeholderTextColor="rgba(226,232,240,0.45)"
        returnKeyType={multiline ? 'default' : 'done'}
        blurOnSubmit={!multiline}
        onSubmitEditing={multiline ? undefined : () => Keyboard.dismiss()}
        style={{
          minHeight: multiline ? 88 : compact ? 52 : 46,
          maxHeight: compact ? 52 : multiline ? 120 : undefined,
          borderRadius: 14,
          paddingHorizontal: 13,
          paddingVertical: multiline ? 10 : Platform.OS === 'ios' ? 12 : 10,
          color: '#FFFFFF',
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: 1,
          borderColor: 'rgba(148, 163, 184, 0.12)',
          textAlignVertical: multiline || compact ? 'top' : 'center',
          fontWeight: '700',
          fontSize: compact ? 13 : 15,
        }}
      />
    </View>
  );
}
