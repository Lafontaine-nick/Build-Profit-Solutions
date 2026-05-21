// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  ProductScannerDestination,
  ProductScannerSavePayload,
  ScannedProduct,
} from '../lib/products/productScannerTypes';
import { getProductPageUrl, getProductUnitPrice } from '../lib/products/productScannerTypes';
import { lookupScannedProduct } from '../services/productLookupService';
import * as WebBrowser from 'expo-web-browser';

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

const openProductUrl = async (url: string) => {
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      enableBarCollapsing: true,
    });
  }
};

export default function ProductFoundSheet({
  visible,
  product,
  destinations,
  defaultDestination,
  existingChangeOrders = [],
  onClose,
  onSave,
}: {
  visible: boolean;
  product: ScannedProduct | null;
  destinations: ProductScannerDestination[];
  defaultDestination?: ProductScannerDestination;
  existingChangeOrders?: { id: string; title?: string; status?: string; amount?: number }[];
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
  const autoOpenedUrlRef = useRef('');

  const displayProduct = resolvedProduct || product;

  useEffect(() => {
    if (!visible || !product) return;
    setResolvedProduct(product);
    setDetailsLookupFinished(false);
  }, [product, visible]);

  useEffect(() => {
    if (!visible || !product) return;
    const needsDetails = !getProductUnitPrice(product) || product.lookupStatus === 'manual_required';
    const lookupCode = product.rawCode || product.upc || product.sku || product.title;
    if (!needsDetails || !lookupCode) {
      setDetailsLookupFinished(true);
      setIsResolvingDetails(false);
      return;
    }

    let cancelled = false;
    setIsResolvingDetails(true);
    lookupScannedProduct({
      code: lookupCode,
      codeType: product.codeType || 'barcode',
      sourceHint: product.supplierId || 'hd',
    })
      .then((result) => {
        if (!cancelled && result?.product?.title) {
          setResolvedProduct(result.product);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setIsResolvingDetails(false);
          setDetailsLookupFinished(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [product, visible]);

  useEffect(() => {
    if (!visible || !displayProduct) return;
    const nextDestination = defaultDestination || destinations[0] || 'estimate';
    setDestination(nextDestination);
    setQuantity('1');
    setUnitCost(getProductUnitPrice(displayProduct) ? String(getProductUnitPrice(displayProduct)) : '');
    setMarkupPct('20');
    setDescription(displayProduct.title || '');
    setNotes('');
    setCustomerNotes('');
    setChangeOrderId('');
  }, [defaultDestination, destinations, displayProduct, visible]);

  const qtyNum = Math.max(Number(quantity) || 0, 0);
  const unitCostNum = Math.max(Number(String(unitCost).replace(/[^0-9.]/g, '')) || 0, 0);
  const markupNum = Math.max(Number(String(markupPct).replace(/[^0-9.]/g, '')) || 0, 0);
  const costTotal = qtyNum * unitCostNum;
  const changeOrderSellTotal = useMemo(
    () => costTotal * (1 + markupNum / 100),
    [costTotal, markupNum],
  );

  const productPageUrl = displayProduct ? getProductPageUrl(displayProduct) : null;
  const displayNeedsDetails =
    Boolean(displayProduct) &&
    (!getProductUnitPrice(displayProduct) || displayProduct.lookupStatus === 'manual_required') &&
    !detailsLookupFinished;

  useEffect(() => {
    if (!visible) {
      autoOpenedUrlRef.current = '';
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !productPageUrl) return;
    // Do not leave the app while the fallback UPC-only product is still being enriched.
    if (displayNeedsDetails || isResolvingDetails) return;
    const openKey = displayProduct?.rawCode || displayProduct?.sku || productPageUrl;
    if (autoOpenedUrlRef.current === openKey) return;
    autoOpenedUrlRef.current = openKey;

    const timer = setTimeout(() => {
      openProductUrl(productPageUrl);
    }, 500);

    return () => clearTimeout(timer);
  }, [displayNeedsDetails, displayProduct?.rawCode, displayProduct?.sku, isResolvingDetails, productPageUrl, visible]);

  if (!displayProduct) return null;

  const storePageLabel =
    displayProduct.supplierId === 'lowes'
      ? "View on Lowe's"
      : displayProduct.supplierId === 'hd'
        ? 'View on Home Depot'
        : 'View product page';
  const hasMultipleDestinations = destinations.length > 1;

  const canSave = qtyNum > 0 && unitCostNum > 0 && description.trim();
  const selectedMeta = DESTINATION_LABELS[destination];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View
          style={{
            maxHeight: '88%',
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            backgroundColor: '#050807',
            borderWidth: 1,
            borderColor: 'rgba(45,255,196,0.24)',
            overflow: 'hidden',
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
            <View style={{ width: 48, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center', marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              {displayProduct.imageUrl ? (
                <Image
                  source={{ uri: displayProduct.imageUrl }}
                  style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: '#111827', marginRight: 12 }}
                  resizeMode="contain"
                />
              ) : (
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 14,
                    backgroundColor: 'rgba(45,255,196,0.08)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="cube-outline" size={30} color="#2DFFC4" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#2DFFC4', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Product Found
                </Text>
                <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '900', marginTop: 4, lineHeight: 22 }}>
                  {displayProduct.title}
                </Text>
                <Text style={{ color: 'rgba(226,232,240,0.68)', fontSize: 12, marginTop: 4 }}>
                  {displayProduct.supplier} {displayProduct.unitPrice ? `• ${money(displayProduct.unitPrice)} each` : '• Confirm price'}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8, marginBottom: 16 }}>
              {isResolvingDetails ? (
                <View
                  style={{
                    borderRadius: 14,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(45,255,196,0.35)',
                    backgroundColor: 'rgba(45,255,196,0.08)',
                  }}
                >
                  <Text style={{ color: '#2DFFC4', fontSize: 12.5, fontWeight: '900' }}>
                    Looking up Home Depot product details...
                  </Text>
                  <Text style={{ color: 'rgba(226,232,240,0.64)', fontSize: 11.5, marginTop: 4, lineHeight: 16 }}>
                    Price and description will fill before the product page opens.
                  </Text>
                </View>
              ) : null}
              <Text style={{ color: 'rgba(226,232,240,0.72)', fontSize: 12, fontWeight: '800' }}>
                SKU / Model / UPC
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 19 }}>
                {[displayProduct.sku && `SKU ${displayProduct.sku}`, displayProduct.model && `Model ${displayProduct.model}`, displayProduct.upc && `UPC ${displayProduct.upc}`]
                  .filter(Boolean)
                  .join(' • ') || displayProduct.rawCode}
              </Text>
              {productPageUrl ? (
                <TouchableOpacity
                  onPress={() => openProductUrl(productPageUrl)}
                  style={{
                    marginTop: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(45,255,196,0.45)',
                    backgroundColor: 'rgba(45,255,196,0.12)',
                  }}
                >
                  <Ionicons name="open-outline" size={18} color="#2DFFC4" />
                  <Text style={{ color: '#2DFFC4', fontSize: 13, fontWeight: '900' }}>{storePageLabel}</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {hasMultipleDestinations ? (
              <>
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900', marginBottom: 10 }}>Save product to</Text>
                <View style={{ gap: 10, marginBottom: 16 }}>
                  {destinations.map((option) => {
                    const meta = DESTINATION_LABELS[option];
                    const selected = destination === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        onPress={() => setDestination(option)}
                        style={{
                          borderRadius: 16,
                          padding: 13,
                          flexDirection: 'row',
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: selected ? '#2DFFC4' : 'rgba(255,255,255,0.12)',
                          backgroundColor: selected ? 'rgba(45,255,196,0.1)' : 'rgba(255,255,255,0.045)',
                        }}
                      >
                        <Ionicons name={meta.icon} size={20} color={selected ? '#2DFFC4' : 'rgba(226,232,240,0.7)'} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '900' }}>{meta.title}</Text>
                          <Text style={{ color: 'rgba(226,232,240,0.62)', fontSize: 11.5, marginTop: 2 }}>{meta.subtitle}</Text>
                        </View>
                        {selected ? <Ionicons name="checkmark-circle" size={20} color="#2DFFC4" /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <Field label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
              <Field label="Unit cost" value={unitCost} onChangeText={setUnitCost} keyboardType="decimal-pad" />
            </View>
            <Field label="Description" value={description} onChangeText={setDescription} />
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
                          borderColor: !changeOrderId ? '#2DFFC4' : 'rgba(255,255,255,0.13)',
                          backgroundColor: !changeOrderId ? 'rgba(45,255,196,0.1)' : 'rgba(255,255,255,0.06)',
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
                            borderColor: changeOrderId === co.id ? '#2DFFC4' : 'rgba(255,255,255,0.13)',
                            backgroundColor: changeOrderId === co.id ? 'rgba(45,255,196,0.1)' : 'rgba(255,255,255,0.06)',
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
                <Text style={{ color: '#2DFFC4', fontSize: 12, fontWeight: '900', marginTop: 8 }}>
                  Change order customer price: {money(changeOrderSellTotal)}
                </Text>
                <View style={{ height: 12 }} />
                <Field label="Customer-facing notes" value={customerNotes} onChangeText={setCustomerNotes} multiline />
              </>
            ) : null}
            <View style={{ height: 12 }} />
            <Field label="Internal notes" value={notes} onChangeText={setNotes} multiline />

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

            <TouchableOpacity
              disabled={!canSave}
              onPress={() =>
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
                })
              }
              style={{
                minHeight: 52,
                borderRadius: 17,
                backgroundColor: canSave ? '#2DFFC4' : 'rgba(255,255,255,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 18,
              }}
            >
              <Text style={{ color: canSave ? '#001B14' : 'rgba(226,232,240,0.55)', fontSize: 15, fontWeight: '900' }}>
                {selectedMeta?.title || 'Add Product'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, value, onChangeText, keyboardType = 'default', multiline = false }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: 'rgba(226,232,240,0.72)', fontSize: 11, fontWeight: '800', marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor="rgba(226,232,240,0.45)"
        style={{
          minHeight: multiline ? 76 : 46,
          borderRadius: 14,
          paddingHorizontal: 13,
          paddingVertical: multiline ? 11 : 0,
          color: '#FFFFFF',
          backgroundColor: 'rgba(255,255,255,0.07)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.13)',
          textAlignVertical: multiline ? 'top' : 'center',
          fontWeight: '700',
        }}
      />
    </View>
  );
}
