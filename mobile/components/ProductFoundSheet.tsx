// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Image,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientRingBackInner from './GradientRingBackInner';
import type {
  ProductScannerDestination,
  ProductScannerSavePayload,
  ScannedProduct,
} from '../lib/products/productScannerTypes';
import {
  getProductPageLabel,
  getProductPageUrl,
  getProductUnitPrice,
  hasResolvedProductDetails,
  isBarcodePlaceholderTitle,
  isDirectProductPageUrl,
  isGenericSupplier,
  needsProductDetailRefresh,
  supplierNameFromId,
} from '../lib/products/productScannerTypes';
import { lookupScannedProduct } from '../services/productLookupService';
import { openStoreProductPage } from '../lib/products/openStoreProductPage';
import {
  AI_FLOW_CARD_BG_DARK,
  ESTIMATE_FLOW_CARD_GAP,
  ESTIMATE_FLOW_CHIP_GREEN,
  ESTIMATE_FLOW_CHIP_GREEN_BG,
  ESTIMATE_FLOW_TEXT_SECONDARY_DARK,
  confirmScopeSectionLabelStyle,
  estimateFlowCardStyle,
  estimateFlowInputShellStyle,
  estimateFlowLineItemsTotalStyle,
  estimateFlowOutlineActionButtonStyle,
  estimateFlowOutlineActionButtonTextStyle,
} from '@/utils/estimateFlowCardStyle';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from '@/constants/brandFrameGradient';
import { FORM_KEYBOARD_SCROLL_PROPS } from '@/constants/keyboardScrollProps';
import { nativeNumericKeyboardProps, resolveTextInputKeyboardProps } from '@/constants/inputKeyboardPresets';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';

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
  const [customerNotes, setCustomerNotes] = useState('');
  const [changeOrderId, setChangeOrderId] = useState('');
  const [resolvedProduct, setResolvedProduct] = useState<ScannedProduct | null>(null);
  const [isResolvingDetails, setIsResolvingDetails] = useState(false);
  const [detailsLookupFinished, setDetailsLookupFinished] = useState(false);
  const [lookupFailureMessage, setLookupFailureMessage] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [vendor, setVendor] = useState('');
  const lookupRequestRef = useRef(0);
  const leftAppRef = useRef(false);
  const resolvedProductRef = useRef<ScannedProduct | null>(null);
  const descriptionRef = useRef('');
  const unitCostRef = useRef('');
  const quantityRef = useRef('1');
  const userEditedQuantityRef = useRef(false);
  const userEditedUnitCostRef = useRef(false);
  const userEditedDescriptionRef = useRef(false);
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const Colors = getColors(theme);
  const darkMode = Colors.bg === '#000000';
  const flowCardStyle = useMemo(
    () => estimateFlowCardStyle(Colors, darkMode),
    [Colors, darkMode],
  );
  const inputShellStyle = useMemo(
    () => ({
      ...estimateFlowInputShellStyle(Colors, darkMode),
      ...(darkMode ? { backgroundColor: AI_FLOW_CARD_BG_DARK } : {}),
    }),
    [Colors, darkMode],
  );
  const productScanKey = product
    ? [product.rawCode, product.upc, product.sku, product.title].filter(Boolean).join('|')
    : '';
  const destinationsKey = destinations.join(',');
  const openedSessionRef = useRef<string | null>(null);

  const displayProduct = resolvedProduct || product;

  useEffect(() => {
    resolvedProductRef.current = resolvedProduct;
  }, [resolvedProduct]);

  useEffect(() => {
    descriptionRef.current = description;
  }, [description]);

  useEffect(() => {
    unitCostRef.current = unitCost;
  }, [unitCost]);

  useEffect(() => {
    quantityRef.current = quantity;
  }, [quantity]);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  useEffect(() => {
    if (!visible || Platform.OS === 'web') {
      setKeyboardVisible(false);
      return undefined;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hidden = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [visible]);

  const applyResolvedProduct = useCallback(
    (nextProduct: ScannedProduct) => {
      setResolvedProduct(nextProduct);
      const merchant = String(nextProduct.supplier || '').trim();
      if (
        isGenericSupplier(nextProduct.supplierId) &&
        merchant &&
        merchant !== 'Any store' &&
        merchant !== 'Unknown supplier'
      ) {
        setVendor((current) => current || merchant);
      }
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
      if (reason === 'initial' && !needsProductDetailRefresh(product)) {
        setDetailsLookupFinished(true);
        return;
      }

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
          sourceHint: 'auto',
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
      openedSessionRef.current = null;
      return;
    }
    if (!product) return;

    if (openedSessionRef.current === productScanKey) {
      return;
    }
    openedSessionRef.current = productScanKey;

    setResolvedProduct(product);
    setDetailsLookupFinished(!needsProductDetailRefresh(product));
    setLookupFailureMessage('');
    leftAppRef.current = false;
    const nextDestination = defaultDestination || destinations[0] || 'estimate';
    setDestination(nextDestination);
    setQuantity('1');
    const initialPrice = getProductUnitPrice(product);
    setUnitCost(initialPrice > 0 ? String(initialPrice) : '');
    setMarkupPct('20');
    setDescription(product.title || '');
    setCustomerNotes('');
    setChangeOrderId('');
    const supplier = String(product.supplier || '').trim();
    const prefillVendor =
      isGenericSupplier(product.supplierId) &&
      supplier &&
      supplier !== 'Any store' &&
      supplier !== 'Unknown supplier'
        ? supplier
        : '';
    setVendor(prefillVendor);
    userEditedQuantityRef.current = false;
    userEditedUnitCostRef.current = false;
    userEditedDescriptionRef.current = false;
  }, [defaultDestination, destinationsKey, product, productScanKey, visible]);

  useEffect(() => {
    if (!visible || !product) return undefined;

    void runProductLookup('initial');

    const currentState = AppState.currentState;
    if (currentState === 'background') {
      leftAppRef.current = true;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        leftAppRef.current = true;
      }
      if (nextState === 'active' && leftAppRef.current) {
        const current = resolvedProductRef.current || product;
        if (needsProductDetailRefresh(current)) {
          void runProductLookup('foreground');
        }
      }
    });

    return () => {
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

  if (!displayProduct) return null;

  const priceSourceLabel =
    isGenericSupplier(displayProduct.supplierId) &&
    displayProduct.supplier &&
    displayProduct.supplier !== 'Any store' &&
    displayProduct.supplier !== 'Unknown supplier'
      ? displayProduct.supplier
      : supplierNameFromId(displayProduct.supplierId);
  const hasMultipleDestinations = destinations.length > 1;

  const isGenericProduct = isGenericSupplier(displayProduct.supplierId);
  const knownMerchant =
    isGenericProduct &&
    displayProduct.supplier &&
    displayProduct.supplier !== 'Any store' &&
    displayProduct.supplier !== 'Unknown supplier';
  const effectiveVendor = knownMerchant ? vendor.trim() || displayProduct.supplier : vendor.trim();
  const showVendorField = isGenericProduct && !knownMerchant;
  const canSave =
    qtyNum > 0 &&
    unitCostNum > 0 &&
    description.trim() &&
    (!isGenericProduct || effectiveVendor.length > 0);
  const selectedMeta = DESTINATION_LABELS[destination];
  const sheetFooterBottomInset = Math.max(14, insets.bottom + 8);
  const footerReservedSpace = keyboardVisible ? 24 : 12 + 50 + sheetFooterBottomInset;
  const isSearchResultLink = Boolean(
    productPageUrl &&
      /\/search(?:[/?]|$)|\/s\/|[?&](?:q|query|searchTerm)=/i.test(productPageUrl),
  );
  const isWebSearchLink = Boolean(productPageUrl && /google\.com\/search/i.test(productPageUrl));
  const storePageLabel = isSearchResultLink
    ? isWebSearchLink
      ? 'Search web'
      : `Search ${priceSourceLabel}`
    : getProductPageLabel(displayProduct);
  const isRedundantIdentifier = (value?: string | null) => {
    const normalized = String(value || '').trim();
    return (
      !normalized ||
      normalized === String(displayProduct.upc || '').trim() ||
      normalized === String(displayProduct.sku || '').trim() ||
      /^\d{12,}$/.test(normalized)
    );
  };
  const metaChips = [
    !isRedundantIdentifier(displayProduct.model) ? `Model ${displayProduct.model}` : '',
    displayProduct.upc ? `UPC ${displayProduct.upc}` : '',
    !isRedundantIdentifier(displayProduct.sku) ? `SKU ${displayProduct.sku}` : '',
  ].filter(Boolean);
  const showLoadingBanner =
    !hasResolvedProductDetails(displayProduct) && (isResolvingDetails || !detailsLookupFinished);
  const hasCleanTitle = !isBarcodePlaceholderTitle(displayProduct.title, displayProduct.rawCode);
  const hasConfirmedPrice = getProductUnitPrice(displayProduct) > 0;
  const directProductPage = productPageUrl ? isDirectProductPageUrl(productPageUrl) : false;
  const hasDirectOfferLink = Boolean(productPageUrl && !isSearchResultLink);
  const matchStatusLabel = showLoadingBanner
    ? 'Checking product details…'
    : !hasCleanTitle
      ? 'Manual details required'
      : displayProduct.supplierId === 'lowes' && !hasConfirmedPrice
        ? "Lowe's listing found · price unavailable"
      : hasDirectOfferLink && hasConfirmedPrice
        ? 'Verified product match'
        : hasDirectOfferLink
          ? 'Product page match · verify price'
          : hasConfirmedPrice
            ? 'Catalog match · verify price'
            : 'Catalog match · verify details';
  const fallbackMessage = (() => {
    if (lookupFailureMessage) return lookupFailureMessage;
    if (showLoadingBanner || !detailsLookupFinished) return '';
    if (isGenericProduct && hasCleanTitle && hasConfirmedPrice) {
      return 'Price prefilled from product data. Confirm the store and what you paid before adding.';
    }
    if (isGenericProduct && hasCleanTitle && !hasConfirmedPrice) {
      return 'Product name found from barcode. Enter the store, unit cost, and quantity you paid.';
    }
    if (isGenericProduct && !hasCleanTitle) {
      return 'Enter the store, description, and price you paid for this item.';
    }
    if (hasCleanTitle && !hasConfirmedPrice) {
      return 'We found the product, but could not confirm the current price. Enter the unit cost manually before adding it.';
    }
    if (directProductPage && (!hasCleanTitle || !hasResolvedProductDetails(displayProduct))) {
      return 'We found the product page, but some details could not be filled automatically. Review and edit the fields before adding.';
    }
    if (!hasCleanTitle) {
      return 'Cannot accurately scan or find this product. Enter the description, store, and price manually, or scan again.';
    }
    return '';
  })();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <View
          style={[
            styles.fullScreenModal,
            { paddingTop: insets.top, backgroundColor: Colors.bg },
          ]}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: darkMode ? '#000000' : Colors.surface2,
                borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
              },
            ]}
          >
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={[
              styles.sheetScrollContent,
              { paddingBottom: footerReservedSpace },
            ]}
            showsVerticalScrollIndicator={false}
            {...FORM_KEYBOARD_SCROLL_PROPS}
          >
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <View style={styles.gradientBackButtonWrapper}>
                  <LinearGradient
                    colors={BRAND_FRAME_GRADIENT_COLORS}
                    start={BRAND_FRAME_GRADIENT_START}
                    end={BRAND_FRAME_GRADIENT_END}
                    style={styles.gradientBackButtonBorder}
                  >
                    <GradientRingBackInner
                      onPress={onClose}
                      darkMode={darkMode}
                      accessibilityLabel="Back"
                      hitSlop={{ top: 0, bottom: 0, left: 0, right: 0 }}
                      style={[
                        styles.gradientBackButtonFill,
                        { backgroundColor: darkMode ? '#000000' : Colors.bg },
                      ]}
                    >
                      <Ionicons name="arrow-back" size={22} color={darkMode ? '#FFFFFF' : Colors.text} />
                    </GradientRingBackInner>
                  </LinearGradient>
                </View>
                <Text style={[styles.sheetTitle, { color: darkMode ? '#FFFFFF' : Colors.text }]}>
                  Product Found
                </Text>
                <View style={styles.headerSpacer} />
              </View>

              <View style={[flowCardStyle, styles.productCard]}>
                <View style={styles.productRow}>
                  {displayProduct.imageUrl ? (
                    <Image
                      source={{ uri: displayProduct.imageUrl }}
                      style={styles.productImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={[styles.productImage, styles.productImagePlaceholder]}>
                      <Ionicons name="cube-outline" size={26} color={ESTIMATE_FLOW_CHIP_GREEN} />
                    </View>
                  )}
                  <View style={styles.productCopy}>
                    <Text
                      style={[styles.productTitle, { color: darkMode ? '#FFFFFF' : Colors.text }]}
                      numberOfLines={2}
                    >
                      {displayProduct.title}
                    </Text>
                    <Text style={[styles.productMeta, { color: darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : Colors.sub }]}>
                      {isGenericProduct
                        ? knownMerchant
                          ? `${displayProduct.supplier}${displayProduct.unitPrice ? ` · ${money(displayProduct.unitPrice)} suggested` : ' · Confirm price'}`
                          : displayProduct.unitPrice
                            ? `${money(displayProduct.unitPrice)} suggested · confirm store and price`
                            : 'Enter the store and price you paid'
                        : `${displayProduct.supplier}${displayProduct.unitPrice ? ` · ${money(displayProduct.unitPrice)} each` : ' · Confirm price'}`}
                    </Text>
                    {metaChips.length ? (
                      <View style={styles.metaChipRow}>
                        {metaChips.map((chip) => (
                          <MetaChip key={chip} label={chip} darkMode={darkMode} />
                        ))}
                      </View>
                    ) : null}
                    <Text
                      style={[
                        styles.matchStatus,
                        {
                          color:
                            matchStatusLabel === 'Verified product match'
                              ? ESTIMATE_FLOW_CHIP_GREEN
                              : darkMode
                                ? 'rgba(226,232,240,0.62)'
                                : Colors.sub,
                        },
                      ]}
                    >
                      {matchStatusLabel}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {showLoadingBanner ? (
              <View style={[flowCardStyle, styles.infoBanner, styles.loadingBanner]}>
                <Ionicons name="sync-outline" size={16} color={ESTIMATE_FLOW_CHIP_GREEN} />
                <Text style={[styles.infoBannerText, { color: darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : Colors.sub }]}>
                  Filling in product details...
                </Text>
              </View>
            ) : null}

            {fallbackMessage ? (
              <View style={[flowCardStyle, styles.infoBanner, styles.fallbackBanner]}>
                <Text style={[styles.infoBannerText, { color: darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : Colors.sub }]}>
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
                  style={[
                    estimateFlowOutlineActionButtonStyle(),
                    styles.storeLinkButton,
                    { backgroundColor: ESTIMATE_FLOW_CHIP_GREEN_BG },
                  ]}
                >
                  <Ionicons name="open-outline" size={16} color={ESTIMATE_FLOW_CHIP_GREEN} />
                  <Text style={estimateFlowOutlineActionButtonTextStyle()}>{storePageLabel}</Text>
                </TouchableOpacity>
                <Text style={[styles.priceDisclaimer, { color: darkMode ? 'rgba(226,232,240,0.46)' : Colors.sub }]}>
                  {isSearchResultLink
                    ? `Suggested online price from ${priceSourceLabel}. Verify the exact item, package, tax, and availability.`
                    : `Price source: ${priceSourceLabel}. Verify price, tax, and availability before purchase.`}
                </Text>
              </>
            ) : null}

            <Text style={[styles.affiliationDisclaimer, { color: darkMode ? 'rgba(226,232,240,0.46)' : Colors.sub }]}>
              Not affiliated with Home Depot or Lowe&apos;s.
            </Text>

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

            {showVendorField ? (
              <Field
                label="Store / vendor"
                value={vendor}
                onChangeText={setVendor}
                inputShellStyle={inputShellStyle}
                labelColor={darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : Colors.sub}
                placeholder="e.g. Floor & Decor, Ferguson"
              />
            ) : null}

            <View style={styles.fieldRow}>
              <Field
                label="Quantity"
                value={quantity}
                onChangeText={(value) => {
                  userEditedQuantityRef.current = true;
                  setQuantity(value);
                }}
                keyboardType="decimal-pad"
                inputShellStyle={inputShellStyle}
                labelColor={darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : Colors.sub}
              />
              <Field
                label="Unit cost"
                value={unitCost}
                onChangeText={(value) => {
                  userEditedUnitCostRef.current = true;
                  setUnitCost(value);
                }}
                keyboardType="decimal-pad"
                inputShellStyle={inputShellStyle}
                labelColor={darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : Colors.sub}
              />
            </View>
            <View style={[estimateFlowLineItemsTotalStyle(darkMode), styles.lineTotalCard]}>
              <Text style={[confirmScopeSectionLabelStyle(), { color: darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : Colors.sub }]}>
                Line item total
              </Text>
              <Text style={styles.lineTotalValue}>{money(costTotal)}</Text>
            </View>
            <Field
              label="Description"
              value={description}
              onChangeText={(value) => {
                userEditedDescriptionRef.current = true;
                setDescription(value);
              }}
              multiline
              inputShellStyle={inputShellStyle}
              labelColor={darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : Colors.sub}
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
                <Field label="Markup %" value={markupPct} onChangeText={setMarkupPct} keyboardType="decimal-pad" inputShellStyle={inputShellStyle} labelColor={darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : Colors.sub} />
                <View style={[estimateFlowLineItemsTotalStyle(darkMode), styles.lineTotalCard, { marginTop: 8 }]}>
                  <Text style={[confirmScopeSectionLabelStyle(), { color: darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : Colors.sub }]}>
                    Change order customer price
                  </Text>
                  <Text style={styles.lineTotalValue}>{money(changeOrderSellTotal)}</Text>
                </View>
                <View style={{ height: 12 }} />
                <Field label="Customer-facing notes" value={customerNotes} onChangeText={setCustomerNotes} multiline inputShellStyle={inputShellStyle} labelColor={darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : Colors.sub} />
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
          </ScrollView>

          {!keyboardVisible ? (
            <View
              style={[
                styles.sheetFooter,
                {
                  borderTopColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
                  backgroundColor: darkMode ? '#000000' : Colors.surface2,
                  paddingBottom: sheetFooterBottomInset,
                },
              ]}
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
                    customerNotes: customerNotes.trim(),
                    changeOrderId: destination === 'change_order' ? changeOrderId || undefined : undefined,
                    vendor: isGenericProduct ? effectiveVendor : undefined,
                  });
                }}
                activeOpacity={0.88}
                style={{ opacity: canSave ? 1 : 0.45 }}
              >
                <LinearGradient
                  colors={canSave ? ['#22c55e', '#22d3ee'] : ['#3a3a3c', '#3a3a3c']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>
                    {primaryActionTitle || selectedMeta?.title || 'Add Product'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : null}
          </View>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}

function MetaChip({ label, darkMode }: { label: string; darkMode: boolean }) {
  return (
    <View
      style={[
        styles.metaChip,
        {
          backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(0,0,0,0.08)',
        },
      ]}
    >
      <Text style={[styles.metaChipText, { color: darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : '#475569' }]}>{label}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  multiline = false,
  compact = false,
  inputShellStyle,
  labelColor,
  placeholder,
}) {
  const isNumericPad =
    keyboardType === 'decimal-pad' ||
    keyboardType === 'numeric' ||
    keyboardType === 'number-pad' ||
    keyboardType === 'phone-pad';

  return (
    <View style={{ flex: 1, marginBottom: ESTIMATE_FLOW_CARD_GAP }}>
      <Text style={[confirmScopeSectionLabelStyle(), styles.fieldLabel, { color: labelColor }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable
        keyboardType={keyboardType}
        multiline={multiline || compact}
        numberOfLines={multiline ? 3 : compact ? 2 : 1}
        placeholder={placeholder}
        placeholderTextColor="rgba(226,232,240,0.45)"
        onSubmitEditing={() => Keyboard.dismiss()}
        {...(isNumericPad
          ? nativeNumericKeyboardProps
          : resolveTextInputKeyboardProps({ multiline: multiline || compact }))}
        style={[
          inputShellStyle,
          styles.fieldInput,
          multiline ? styles.fieldInputMultiline : null,
          compact ? styles.fieldInputCompact : null,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  sheet: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'column',
    borderRadius: 0,
    borderWidth: 0,
    overflow: 'hidden',
  },
  sheetHeader: {
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 10,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  sheetTitle: {
    position: 'absolute',
    left: 42,
    right: 42,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  gradientBackButtonWrapper: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
  },
  gradientBackButtonBorder: {
    flex: 1,
    padding: 1,
    borderRadius: 21,
  },
  gradientBackButtonFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerSpacer: {
    width: 42,
  },
  productCard: {
    marginBottom: 0,
    padding: 12,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#111827',
    marginRight: 12,
  },
  productImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ESTIMATE_FLOW_CHIP_GREEN_BG,
  },
  productCopy: {
    flex: 1,
    minWidth: 0,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  productMeta: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  matchStatus: {
    fontSize: 10.5,
    marginTop: 7,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
  metaChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  metaChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingHorizontal: 14,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: ESTIMATE_FLOW_CARD_GAP,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  loadingBanner: {
    borderColor: 'rgba(52, 211, 153, 0.28)',
    backgroundColor: ESTIMATE_FLOW_CHIP_GREEN_BG,
  },
  fallbackBanner: {},
  infoBannerText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    flex: 1,
  },
  storeLinkButton: {
    width: '100%',
    minHeight: 46,
    marginBottom: 6,
    gap: 6,
  },
  priceDisclaimer: {
    fontSize: 10.5,
    lineHeight: 15,
    marginBottom: 6,
    fontWeight: '600',
  },
  affiliationDisclaimer: {
    fontSize: 10.5,
    lineHeight: 15,
    marginBottom: 14,
    fontWeight: '600',
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldLabel: {
    marginBottom: 6,
  },
  fieldInput: {
    minHeight: 46,
    paddingHorizontal: 13,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  fieldInputMultiline: {
    minHeight: 88,
    maxHeight: 120,
    textAlignVertical: 'top',
    paddingVertical: 10,
  },
  fieldInputCompact: {
    minHeight: 52,
    maxHeight: 52,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  lineTotalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ESTIMATE_FLOW_CARD_GAP,
  },
  lineTotalValue: {
    color: ESTIMATE_FLOW_CHIP_GREEN,
    fontSize: 16,
    fontWeight: '900',
  },
  sheetFooter: {
    paddingHorizontal: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#020617',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
