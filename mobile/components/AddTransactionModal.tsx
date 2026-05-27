import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { View, Text, Modal, TextInput, TouchableOpacity, Pressable, StyleSheet, ScrollView, Alert, Keyboard, Platform, Image, KeyboardAvoidingView, useWindowDimensions } from "react-native";
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import GreyCalendar from './GreyCalendar';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { formatMoneyFull } from "@/src/lib/budgetUtils";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import { useProjectData } from "@/contexts/ProjectDataContext";
import { classifyExpensePriceReasonableness } from "@/utils/expensePriceReasonableness";
import {
  centsDigitsToNumber,
  clampCentsDigitsInput,
  decimalMoneyInputToNumber,
  digitsOnly,
  dollarsToCentsDigits,
  sanitizeDecimalMoneyInput,
} from "@/src/lib/keyboardMoney";
import GradientRingBackInner from "./GradientRingBackInner";
import { isDesktopWebLayoutWidth, getProjectExpenseFormHorizontalPadding } from "@/constants/ScreenLayout";
import KeyboardPlainAccessory from "./ui/KeyboardPlainAccessory";
import { KEYBOARD_ACCESSORY_IDS } from "@/constants/keyboard";
import { projectAddExpenseNumericKeyboardProps } from "@/constants/inputKeyboardPresets";

/** RN Web: validation `Alert.alert` is easy to miss in Safari; sync dialog is obvious. */
function alertAddTxnValidation(title: string, message: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

/** Matches estimate-generator `LineItemModal` desktop web column cap (Add Labor step 4). */
const ESTIMATE_LINE_ITEM_WEB_MAX_WIDTH = 900;

export type AddTransactionChangeOrderDraft = {
  vendor?: string;
  amount?: number;
  materialsAmount?: number;
  laborAmount?: number;
  description?: string;
};

type Props = {
  visible: boolean;
  categoryName: string;
  onClose: () => void;
  onSave: (transaction: { 
    id: string; 
    vendor: string; 
    material?: string;
    amount: number; 
    description: string; 
    materialsAmount?: number;
    laborAmount?: number;
    po?: string; 
    date: string;
    receiptUri?: string;
    isPlanned?: boolean;
    projectPhase?: string;
    scope?: string;
    priceReasonableness?: 'normal' | 'high' | 'outlier';
    expectedDelivery?: string;
  }) => void;
  /** Pre-fill when editing a change order from Category detail (web + native). */
  initialDraft?: AddTransactionChangeOrderDraft | null;
  /** Identity for draft changes (e.g. change order id or `"new"`). */
  initialDraftKey?: string;
  /** Change orders: delete persisted CO when user confirms footer "delete" while editing (`initialDraftKey` !== `"new"`). */
  onRequestDeleteChangeOrder?: (changeOrderId: string) => void;
};

export default function AddTransactionModal({
  visible,
  categoryName,
  onClose,
  onSave,
  initialDraft = null,
  initialDraftKey = "",
  onRequestDeleteChangeOrder,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const { projectData } = useProjectData();

  const referenceBudgetUsd = useMemo(() => {
    const b = Number(projectData?.budgeted);
    return Number.isFinite(b) && b > 0 ? b : 0;
  }, [projectData?.budgeted]);
  
  const [vendor, setVendor] = useState("");
  const [material, setMaterial] = useState("");
  /** Budget Labor / Subs: work description (notes) vs trade name (vendor on expense). */
  const [laborDescription, setLaborDescription] = useState("");
  const [trade, setTrade] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [po, setPo] = useState("");
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [isPlanned, setIsPlanned] = useState<boolean>(true);
  const [projectPhase, setProjectPhase] = useState<string>('');
  const [scope, setScope] = useState<string>('');
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [priceReasonableness, setPriceReasonableness] = useState<'normal' | 'high' | 'outlier' | null>(null);
  const [expectedDelivery, setExpectedDelivery] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
  const [showDeliveryDatePicker, setShowDeliveryDatePicker] = useState(false);

  /** Same idea as estimate-generator materials/labor: flat total vs sq ft × $/sq ft */
  const [pricingMode, setPricingMode] = useState<"flat" | "sqft">("flat");
  const [sqftInput, setSqftInput] = useState("");
  const [ratePerSqftInput, setRatePerSqftInput] = useState("");
  /** Change orders + per sq ft: separate material vs labor sq ft × rate */
  const [materialSqftInput, setMaterialSqftInput] = useState("");
  const [materialRatePerSqftInput, setMaterialRatePerSqftInput] = useState("");
  const [laborSqftInput, setLaborSqftInput] = useState("");
  const [laborRatePerSqftInput, setLaborRatePerSqftInput] = useState("");
  const [materialsAmountInput, setMaterialsAmountInput] = useState("");
  const [laborAmountInput, setLaborAmountInput] = useState("");

  // Input refs for keyboard navigation
  const vendorRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);
  const sqftRef = useRef<TextInput>(null);
  const ratePerSqftRef = useRef<TextInput>(null);
  const materialSqftRef = useRef<TextInput>(null);
  const materialRatePerSqftRef = useRef<TextInput>(null);
  const laborSqftRef = useRef<TextInput>(null);
  const laborRatePerSqftRef = useRef<TextInput>(null);
  const materialsAmountRef = useRef<TextInput>(null);
  const laborAmountRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  const poRef = useRef<TextInput>(null);
  const materialRef = useRef<TextInput>(null);
  const laborDescRef = useRef<TextInput>(null);
  const tradeRef = useRef<TextInput>(null);

  const categoryNameLower = categoryName.toLowerCase();
  const isPurchaseOrdersCategory = categoryNameLower.includes('purchase order');
  const isChangeOrdersCategory = categoryNameLower.includes('change order');
  /** Change Orders: left action reads "delete" per product copy (still dismisses / closes like Cancel). */
  const budgetFooterDismissLabel = isChangeOrdersCategory ? 'delete' : 'Cancel';
  /** Budget add form for materials & equipment (not labor, subs, PO, or change order). */
  const isMaterialsEquipmentExpense =
    (categoryNameLower.includes('material') || categoryNameLower.includes('equipment')) &&
    !isChangeOrdersCategory &&
    !isPurchaseOrdersCategory &&
    !categoryNameLower.includes('labor') &&
    !categoryNameLower.includes('subs');

  const isLaborOrSubs =
    categoryName === 'Labor' ||
    categoryName === 'Subs' ||
    categoryNameLower.includes('labor') ||
    categoryNameLower.includes('subcontract');

  const supportsPerSqftPricing = useMemo(() => {
    return (
      categoryNameLower.includes("material") ||
      categoryNameLower.includes("equipment") ||
      categoryNameLower.includes("labor") ||
      categoryNameLower.includes("purchase order") ||
      categoryNameLower.includes("change order")
    );
  }, [categoryNameLower]);

  /**
   * Amount state: **Flat** pricing uses normal dollar entry (500 → $500) on web and native.
   * **Per sq ft** mode keeps POS cent-digit strings for the computed total (matches phone-pad digit stream).
   */
  const parseAmountFieldToNumber = useCallback(
    (raw: string) => {
      if (pricingMode === "flat") {
        return decimalMoneyInputToNumber(raw);
      }
      return centsDigitsToNumber(raw);
    },
    [pricingMode]
  );

  const applyFlatAmountTextChange = useCallback(
    (text: string) => {
      if (pricingMode === "flat") {
        setAmount(sanitizeDecimalMoneyInput(text));
      } else {
        setAmount(clampCentsDigitsInput(text));
      }
    },
    [pricingMode]
  );

  useEffect(() => {
    if (!visible) return;
    setReceiptUri(null);
    setIsPlanned(true);
    setProjectPhase('');
    setScope('');
    setPriceReasonableness(null);
    setExpectedDelivery(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
    setPricingMode("flat");
    setSqftInput("");
    setRatePerSqftInput("");
    setMaterialSqftInput("");
    setMaterialRatePerSqftInput("");
    setLaborSqftInput("");
    setLaborRatePerSqftInput("");
    setMaterialsAmountInput("");
    setLaborAmountInput("");
    setMaterial("");
    setLaborDescription("");
    setTrade("");
    setVendor("");
    setAmount("");
    setDescription("");
    setPo("");

    if (initialDraft && isChangeOrdersCategory) {
      const mat = Number(initialDraft.materialsAmount) || 0;
      const lab = Number(initialDraft.laborAmount) || 0;
      const tot = Number(initialDraft.amount) || mat + lab;
      setVendor(initialDraft.vendor ?? "");
      setDescription(initialDraft.description ?? "");
      setMaterialsAmountInput(mat > 0 ? String(mat) : "");
      setLaborAmountInput(lab > 0 ? String(lab) : "");
      setAmount(tot > 0 ? sanitizeDecimalMoneyInput(tot.toFixed(2)) : "");
    }
  }, [visible, initialDraftKey, initialDraft, isChangeOrdersCategory]);

  // Per-sq-ft: keep Amount in sync. Amount state = cent digit string (phone-pad).
  useEffect(() => {
    if (!supportsPerSqftPricing || pricingMode !== "sqft") return;
    if (isChangeOrdersCategory) {
      const mSq = parseInt(digitsOnly(materialSqftInput), 10) || 0;
      const mRate = decimalMoneyInputToNumber(materialRatePerSqftInput);
      const lSq = parseInt(digitsOnly(laborSqftInput), 10) || 0;
      const lRate = decimalMoneyInputToNumber(laborRatePerSqftInput);
      const materialTotal = mSq > 0 && mRate > 0 ? mSq * mRate : 0;
      const laborTotal = lSq > 0 && lRate > 0 ? lSq * lRate : 0;
      const sum = materialTotal + laborTotal;
      setAmount(sum > 0 ? dollarsToCentsDigits(sum) : "");
    } else {
      const sq = parseInt(digitsOnly(sqftInput), 10) || 0;
      const rate = decimalMoneyInputToNumber(ratePerSqftInput);
      if (sq > 0 && rate > 0) {
        setAmount(dollarsToCentsDigits(sq * rate));
      } else {
        setAmount("");
      }
    }
  }, [
    supportsPerSqftPricing,
    pricingMode,
    isChangeOrdersCategory,
    sqftInput,
    ratePerSqftInput,
    materialSqftInput,
    materialRatePerSqftInput,
    laborSqftInput,
    laborRatePerSqftInput,
  ]);

  useEffect(() => {
    if (!isChangeOrdersCategory || pricingMode === "sqft") return;
    const materials = decimalMoneyInputToNumber(materialsAmountInput);
    const labor = decimalMoneyInputToNumber(laborAmountInput);
    const total = materials + labor;
    if (total > 0) {
      setAmount(sanitizeDecimalMoneyInput(total.toFixed(2)));
    }
    /** When M+L is zero, keep `amount` (total-only CO / fallback from total field). */
  }, [isChangeOrdersCategory, pricingMode, materialsAmountInput, laborAmountInput]);

  // High / outlier vs total project budget (not fixed dollar cutoffs on large bids)
  useEffect(() => {
    const amountNum = parseAmountFieldToNumber(amount);
    if (amountNum > 0) {
      setPriceReasonableness(
        classifyExpensePriceReasonableness(amountNum, referenceBudgetUsd)
      );
    } else {
      setPriceReasonableness(null);
    }
  }, [amount, referenceBudgetUsd, parseAmountFieldToNumber]);

  // Request camera permissions
  const requestCameraPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is required to take receipt photos');
      return false;
    }
    return true;
  };

  // Request media library permissions
  const requestMediaLibraryPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library permission is required to upload receipts');
      return false;
    }
    return true;
  };

  // Take photo of receipt
  const takeReceiptPhoto = async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.55,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.uri;
        setReceiptUri(uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Trigger OCR processing
        processOCR(uri, asset.base64 ?? undefined);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Upload receipt from gallery
  const uploadReceipt = async () => {
    const hasPermission = await requestMediaLibraryPermissions();
    if (!hasPermission) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.55,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.uri;
        setReceiptUri(uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Trigger OCR processing
        processOCR(uri, asset.base64 ?? undefined);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // Show receipt options
  const showReceiptOptions = () => {
    Alert.alert(
      "Add Receipt",
      "Capture or upload a receipt",
      [
        { text: "📸 Take Photo", onPress: takeReceiptPhoto },
        { text: "🖼️ Upload from Gallery", onPress: uploadReceipt },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  // Process OCR using receiptOCRService
  const processOCR = async (uri: string, base64Data?: string) => {
    setIsProcessingOCR(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Import receiptOCRService dynamically to avoid circular dependencies
      const { receiptOCRService } = await import('@/services/receiptOCRService');
      
      // Prefer URI/file upload path for faster network payloads.
      const ocrResult = await receiptOCRService.processReceipt(uri);
      
      if (ocrResult.success && ocrResult.data) {
        const receiptData = ocrResult.data;
        
        // Auto-fill form fields from OCR data
        if (receiptData.vendor) {
          if (isLaborOrSubs) {
            setTrade(receiptData.vendor);
          } else {
            setVendor(receiptData.vendor);
          }
        }
        if (receiptData.amount) {
          if (pricingMode === "flat") {
            setAmount(sanitizeDecimalMoneyInput(receiptData.amount.toFixed(2)));
          } else {
            setAmount(dollarsToCentsDigits(receiptData.amount));
          }
        }
        if (receiptData.date) {
          // Date is already set to today by default, but we could parse receipt date if needed
        }
        if (receiptData.items && receiptData.items.length > 0) {
          const firstDesc = receiptData.items[0]?.description?.trim();
          if (firstDesc && isMaterialsEquipmentExpense) {
            setMaterial((prev) => (prev.trim() ? prev : firstDesc));
          }
          if (firstDesc && isLaborOrSubs) {
            setLaborDescription((prev) => (prev.trim() ? prev : firstDesc));
          }
          const itemsDescription = receiptData.items
            .map(item => `${item.description}${item.quantity ? ` (Qty: ${item.quantity})` : ''}`)
            .join(', ');
          if (!isLaborOrSubs) {
            setDescription(itemsDescription);
          }
        }

        // Show success message with extracted data
        Alert.alert(
          'OCR Processing',
          `Receipt scanned successfully!\n\nVendor: ${receiptData.vendor}\nAmount: $${receiptData.amount.toFixed(2)}\nConfidence: ${receiptData.confidence}%\n\nFields have been auto-filled.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'OCR Processing',
          `Receipt scanned. ${ocrResult.error || 'Could not extract data automatically.'}\n\nPlease enter details manually.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('OCR processing error:', error);
      Alert.alert(
        'OCR Processing',
        'Error processing receipt. Please enter details manually.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessingOCR(false);
    }
  };

  const categoryIcon = categoryName === 'Labor' ? '👷' : 
                       categoryName === 'Materials' ? '🧱' :
                       categoryName === 'Equipment' ? '🔧' : 
                       categoryName === 'Subs' ? '👥' : '📦';

  // Customize labels based on category
  const vendorLabel = isChangeOrdersCategory
    ? 'Change Order Title *'
    : categoryName === 'Labor' || categoryName === 'Subs' 
    ? 'Sub / Trade *' 
    : 'Vendor / Supplier *';
  
  const vendorPlaceholder = isChangeOrdersCategory
    ? 'e.g., Extra concrete work'
    : categoryName === 'Labor' || categoryName === 'Subs'
    ? 'e.g., ABC Electrical, Joe\'s Plumbing'
    : 'e.g., Home Depot, ABC Contractors';

  const descriptionPlaceholder = isChangeOrdersCategory
    ? 'Additional notes about this change order'
    : categoryName === 'Labor' || categoryName === 'Subs'
    ? 'What work was performed?'
    : categoryName === 'Equipment'
    ? 'What was rented or purchased?'
    : 'What was purchased or service provided?';

  const resetFormState = () => {
    setVendor("");
    setMaterial("");
    setLaborDescription("");
    setTrade("");
    setAmount("");
    setDescription("");
    setPo("");
    setReceiptUri(null);
    setIsPlanned(true);
    setProjectPhase('');
    setScope('');
    setPriceReasonableness(null);
    setExpectedDelivery(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
    setPricingMode("flat");
    setSqftInput("");
    setRatePerSqftInput("");
    setMaterialSqftInput("");
    setMaterialRatePerSqftInput("");
    setLaborSqftInput("");
    setLaborRatePerSqftInput("");
    setMaterialsAmountInput("");
    setLaborAmountInput("");
  };

  const dismissModal = () => {
    resetFormState();
    Keyboard.dismiss();
    onClose();
  };

  const handleFooterDismiss = () => {
    const editingCoId =
      isChangeOrdersCategory &&
      initialDraftKey &&
      initialDraftKey !== "new" &&
      onRequestDeleteChangeOrder
        ? initialDraftKey
        : null;

    if (editingCoId) {
      const runDelete = () => {
        onRequestDeleteChangeOrder(editingCoId);
        dismissModal();
      };
      if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.confirm === "function") {
        if (window.confirm("Delete this change order?\n\nThis removes it from the project.")) {
          runDelete();
        }
        return;
      }
      Alert.alert("Delete change order?", "This removes it from the project.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: runDelete },
      ]);
      return;
    }

    dismissModal();
  };

  const handleSave = () => {
    if (isLaborOrSubs) {
      if (!laborDescription.trim()) {
        alertAddTxnValidation("Required", "Please enter a labor description.");
        return;
      }
    } else if (!vendor.trim()) {
      const fieldName = isChangeOrdersCategory ? "change order title" : "vendor name";
      alertAddTxnValidation("Required", `Please enter a ${fieldName}.`);
      return;
    }

    if (supportsPerSqftPricing && pricingMode === "sqft") {
      if (isChangeOrdersCategory) {
        const mSq = parseInt(digitsOnly(materialSqftInput), 10) || 0;
        const mRate = decimalMoneyInputToNumber(materialRatePerSqftInput);
        const lSq = parseInt(digitsOnly(laborSqftInput), 10) || 0;
        const lRate = decimalMoneyInputToNumber(laborRatePerSqftInput);
        const mTotal = mSq > 0 && mRate > 0 ? mSq * mRate : 0;
        const lTotal = lSq > 0 && lRate > 0 ? lSq * lRate : 0;
        if (mTotal + lTotal <= 0) {
          alertAddTxnValidation(
            "Square feet & rate required",
            "Enter material and/or labor square feet with rate ($/sq ft) so the total is greater than zero, or switch to Flat amount."
          );
          return;
        }
      } else {
        const sq = parseInt(digitsOnly(sqftInput), 10) || 0;
        const rate = decimalMoneyInputToNumber(ratePerSqftInput);
        if (sq <= 0 || rate <= 0) {
          alertAddTxnValidation(
            "Square feet & rate required",
            "Enter square feet and rate ($/sq ft) to calculate the total, or switch to Flat amount."
          );
          return;
        }
      }
    }

    let materialsAmount = 0;
    let laborAmount = 0;
    if (isChangeOrdersCategory && pricingMode === "flat") {
      materialsAmount = decimalMoneyInputToNumber(materialsAmountInput);
      laborAmount = decimalMoneyInputToNumber(laborAmountInput);
    } else if (isChangeOrdersCategory && pricingMode === "sqft") {
      const mSq = parseInt(digitsOnly(materialSqftInput), 10) || 0;
      const mRate = decimalMoneyInputToNumber(materialRatePerSqftInput);
      const lSq = parseInt(digitsOnly(laborSqftInput), 10) || 0;
      const lRate = decimalMoneyInputToNumber(laborRatePerSqftInput);
      materialsAmount = mSq > 0 && mRate > 0 ? mSq * mRate : 0;
      laborAmount = lSq > 0 && lRate > 0 ? lSq * lRate : 0;
    }

    const amountNum = isChangeOrdersCategory
      ? (() => {
          const sum = materialsAmount + laborAmount;
          if (sum > 0) return sum;
          return parseAmountFieldToNumber(amount);
        })()
      : parseAmountFieldToNumber(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alertAddTxnValidation(
        "Invalid Amount",
        isChangeOrdersCategory && pricingMode !== "sqft"
          ? "Please enter a valid material and/or labor amount"
          : "Please enter a valid amount"
      );
      return;
    }

    let descriptionOut = isLaborOrSubs
      ? [laborDescription.trim(), description.trim()].filter(Boolean).join("\n\n")
      : description.trim();
    if (supportsPerSqftPricing && pricingMode === "sqft") {
      if (isChangeOrdersCategory) {
        const mSq = parseInt(digitsOnly(materialSqftInput), 10) || 0;
        const mRate = decimalMoneyInputToNumber(materialRatePerSqftInput);
        const lSq = parseInt(digitsOnly(laborSqftInput), 10) || 0;
        const lRate = decimalMoneyInputToNumber(laborRatePerSqftInput);
        const extra: string[] = [];
        if (mSq > 0 && mRate > 0) {
          extra.push(
            `📐 Materials: ${mSq.toLocaleString()} sq ft × $${mRate.toFixed(2)}/sq ft`
          );
        }
        if (lSq > 0 && lRate > 0) {
          extra.push(
            `📐 Labor: ${lSq.toLocaleString()} sq ft × $${lRate.toFixed(2)}/sq ft`
          );
        }
        if (extra.length) {
          const block = extra.join("\n");
          descriptionOut = descriptionOut ? `${descriptionOut}\n${block}` : block;
        }
      } else {
        const sq = parseInt(digitsOnly(sqftInput), 10) || 0;
        const rate = decimalMoneyInputToNumber(ratePerSqftInput);
        if (sq > 0 && rate > 0) {
          const line = `📐 ${sq.toLocaleString()} sq ft × $${rate.toFixed(2)}/sq ft`;
          descriptionOut = descriptionOut ? `${descriptionOut}\n${line}` : line;
        }
      }
    }

    const vendorOut = isLaborOrSubs ? trade.trim() || laborDescription.trim() : vendor.trim();

    onSave({
      id: `txn-${Date.now()}`,
      vendor: vendorOut,
      material: isMaterialsEquipmentExpense ? material.trim() || undefined : undefined,
      amount: amountNum,
      description: descriptionOut,
      materialsAmount:
        isChangeOrdersCategory && pricingMode === "flat"
          ? materialsAmount
          : isChangeOrdersCategory && pricingMode === "sqft" && materialsAmount > 0
            ? materialsAmount
            : undefined,
      laborAmount:
        isChangeOrdersCategory && pricingMode === "flat"
          ? laborAmount
          : isChangeOrdersCategory && pricingMode === "sqft" && laborAmount > 0
            ? laborAmount
            : undefined,
      po: po.trim() || undefined,
      date: new Date().toISOString(),
      receiptUri: receiptUri || undefined,
      isPlanned,
      projectPhase: projectPhase || undefined,
      scope: scope || undefined,
      priceReasonableness: priceReasonableness || undefined,
      expectedDelivery: isPurchaseOrdersCategory
        ? `${expectedDelivery.getFullYear()}-${String(expectedDelivery.getMonth() + 1).padStart(2, '0')}-${String(expectedDelivery.getDate()).padStart(2, '0')}`
        : undefined,
    });

    resetFormState();
  };

  const onSqftChange = useCallback((text: string) => {
    setSqftInput(digitsOnly(text));
  }, []);

  const onRatePerSqftChange = useCallback((text: string) => {
    setRatePerSqftInput(sanitizeDecimalMoneyInput(text));
  }, []);

  const scrollViewRef = useRef<ScrollView>(null);

  // Format category name for display
  const displayCategoryName = categoryName.replace('/', ' & ');

  const { width: addTxnLayoutWidth } = useWindowDimensions();
  /** Web-only: match estimate Add Labor / Add PO shell for budget “add expense” categories (not native). */
  const webBudgetExpenseShell =
    Platform.OS === "web" &&
    (isPurchaseOrdersCategory ||
      isChangeOrdersCategory ||
      categoryNameLower.includes("material") ||
      categoryNameLower.includes("equipment") ||
      categoryNameLower.includes("labor") ||
      categoryNameLower.includes("subs"));
  const webPoDesktopWide =
    webBudgetExpenseShell && isDesktopWebLayoutWidth(addTxnLayoutWidth);
  const webPoFormPad = useMemo(() => {
    if (!webBudgetExpenseShell) {
      return { header: 20, scroll: 20, footer: 20 };
    }
    if (webPoDesktopWide) {
      return getProjectExpenseFormHorizontalPadding({ desktopWeb: true });
    }
    return getProjectExpenseFormHorizontalPadding({ desktopWeb: false });
  }, [webBudgetExpenseShell, webPoDesktopWide]);

  const webShellHeaderMci = useMemo(() => {
    if (!webBudgetExpenseShell) return null;
    if (categoryNameLower.includes("labor") || categoryNameLower.includes("subs")) {
      return "account-hard-hat" as const;
    }
    if (categoryNameLower.includes("change")) {
      return "file-document-edit-outline" as const;
    }
    return "package-variant-closed" as const;
  }, [webBudgetExpenseShell, categoryNameLower]);

  const webVendorFeatherIcon = useMemo(() => {
    if (!webBudgetExpenseShell) return "package" as const;
    if (categoryNameLower.includes("labor") || categoryNameLower.includes("subs")) {
      return "user" as const;
    }
    if (categoryNameLower.includes("change")) {
      return "file-text" as const;
    }
    return "package" as const;
  }, [webBudgetExpenseShell, categoryNameLower]);

  const poWebChrome = useMemo(() => {
    if (!webBudgetExpenseShell) return null;
    return {
      headerRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        paddingHorizontal: webPoFormPad.header,
        paddingTop: 8,
        paddingBottom: 14,
        marginBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: darkMode ? "rgba(148, 163, 184, 0.14)" : Colors.line,
      },
      materialTitle: {
        fontSize: 24,
        fontWeight: "800" as const,
        color: Colors.text,
        letterSpacing: -0.35,
        lineHeight: 30,
      },
      materialSubtitle: {
        fontSize: 13,
        color: Colors.sub,
        marginTop: 5,
        lineHeight: 18,
        fontWeight: "500" as const,
        opacity: 0.92,
      },
      iconBorder: { borderRadius: 12, padding: 1 },
      fieldGroup: { marginBottom: 18 },
      materialLabel: {
        fontSize: 13,
        fontWeight: "600" as const,
        color: Colors.text,
        marginBottom: 8,
        letterSpacing: 0.25,
      },
      materialInputWrap: {
        borderRadius: 16,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        paddingHorizontal: 14,
        backgroundColor: darkMode ? "rgba(255, 255, 255, 0.08)" : Colors.surface2,
        borderWidth: 1,
        borderColor: darkMode ? "rgba(148, 163, 184, 0.32)" : Colors.line,
        paddingVertical: 12,
        minHeight: 48,
      },
      materialInput: {
        flex: 1,
        fontSize: 15,
        fontWeight: "500" as const,
        color: Colors.text,
        ...(Platform.OS === "web" ? { outlineStyle: "none" as const, outlineWidth: 0 } : {}),
      },
      pricingRow: { flexDirection: "row" as const, gap: 10 },
      pricingOpt: (active: boolean) => ({
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1.5,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        minHeight: 48,
        borderColor: active ? "#22c55e" : Colors.line,
        backgroundColor: active
          ? "#22c55e"
          : darkMode
            ? "rgba(255, 255, 255, 0.06)"
            : Colors.bg,
      }),
      pricingText: (active: boolean) => ({
        color: active ? "#050B13" : Colors.text,
        fontWeight: (active ? "700" : "600") as "700" | "600",
        fontSize: 14,
      }),
      amountShell: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: darkMode ? "rgba(148, 163, 184, 0.32)" : Colors.line,
        backgroundColor: darkMode ? "rgba(255, 255, 255, 0.08)" : Colors.surface2,
      },
      dollarSign: {
        fontSize: 18,
        fontWeight: "600" as const,
        color: "#22c55e",
        marginLeft: 12,
        marginRight: 4,
      },
      amountInput: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 14,
        paddingHorizontal: 12,
        paddingLeft: 4,
        color: Colors.text,
        ...(Platform.OS === "web" ? { outlineStyle: "none" as const, outlineWidth: 0 } : {}),
      },
      footerFlow: {
        paddingHorizontal: webPoFormPad.footer,
        paddingTop: 14,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        gap: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: Colors.line,
        backgroundColor: Colors.bg,
        /** RN Web / Safari: keep footer above scroll compositor layers so Save receives taps. */
        ...(Platform.OS === "web"
          ? { zIndex: 500, elevation: 24, position: "relative" as const }
          : {}),
      },
      cancelBtn: {
        flex: 1,
        marginRight: 8,
        paddingVertical: 15,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: darkMode ? "#3f3f46" : Colors.line,
        backgroundColor: darkMode ? "#18181b" : Colors.surface2,
        alignItems: "center" as const,
        justifyContent: "center" as const,
      },
      cancelText: {
        fontSize: 15,
        fontWeight: "600" as const,
        color: darkMode ? "rgba(226, 232, 240, 0.92)" : Colors.text,
      },
      saveBtnWrap: { flex: 1, marginLeft: 8, borderRadius: 14, overflow: "hidden" as const },
      saveBtnInner: {
        paddingVertical: 15,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        backgroundColor: "#22c55e",
      },
      saveBtnText: { fontSize: 15, fontWeight: "700" as const, color: "#050B13", letterSpacing: 0.3 },
    };
  }, [webBudgetExpenseShell, webPoFormPad, darkMode, Colors]);

  const focusIntoPricingOrAmount = () => {
    if (isChangeOrdersCategory && pricingMode !== "sqft") {
      materialsAmountRef.current?.focus();
    } else if (supportsPerSqftPricing && pricingMode === "sqft") {
      if (isChangeOrdersCategory) {
        materialSqftRef.current?.focus();
      } else {
        sqftRef.current?.focus();
      }
    } else {
      amountRef.current?.focus();
    }
  };

  const focusNextAfterVendorField = () => {
    if (isMaterialsEquipmentExpense) {
      materialRef.current?.focus();
      return;
    }
    focusIntoPricingOrAmount();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      {...(webBudgetExpenseShell ? {} : { presentationStyle: "fullScreen" as const, statusBarTranslucent: true })}
    >
      <KeyboardPlainAccessory
        nativeID={KEYBOARD_ACCESSORY_IDS.projectAddExpensePlain}
        backgroundColor={darkMode ? '#000000' : Colors.bg}
      />
      <KeyboardAvoidingView
        style={[styles.keyboardAvoid, { backgroundColor: darkMode ? '#000000' : Colors.bg }]}
        behavior={webBudgetExpenseShell ? undefined : (Platform.OS === 'ios' ? 'padding' : undefined)}
        enabled={webBudgetExpenseShell ? false : Platform.OS === 'ios'}
        keyboardVerticalOffset={webBudgetExpenseShell ? 0 : (Platform.OS === 'ios' ? -240 : 0)}
      >
      <View style={[
        styles.container,
        !darkMode && { backgroundColor: Colors.bg },
        webBudgetExpenseShell && { paddingTop: insets.top, paddingBottom: 0 },
        webPoDesktopWide && { maxWidth: ESTIMATE_LINE_ITEM_WEB_MAX_WIDTH, width: '100%', alignSelf: 'center' },
        webBudgetExpenseShell && Platform.OS === 'web' && { position: 'relative' as const },
      ]}>
          {/* Header */}
          <View style={webBudgetExpenseShell && poWebChrome ? poWebChrome.headerRow : [styles.header, !darkMode && { borderBottomColor: Colors.line }]}>
            <View style={styles.backBtnWrapper}>
              <LinearGradient
                colors={BRAND_FRAME_GRADIENT_COLORS}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backBtnBorder}
              >
                <GradientRingBackInner
                  darkMode={darkMode}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    dismissModal();
                  }}
                  style={[styles.backBtn, { backgroundColor: Colors.bg }]}
                >
                  <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : Colors.text} />
                </GradientRingBackInner>
              </LinearGradient>
            </View>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconContainerWrapper}>
                <LinearGradient
                  colors={BRAND_FRAME_GRADIENT_COLORS}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={webBudgetExpenseShell && poWebChrome ? poWebChrome.iconBorder : styles.headerIconBorder}
                >
                  <View style={[
                    styles.headerIconContainer,
                    { backgroundColor: Colors.bg },
                    webBudgetExpenseShell && poWebChrome && {
                      width: 40,
                      height: 40,
                      borderRadius: 11,
                    },
                  ]}>
                    {webBudgetExpenseShell && webShellHeaderMci ? (
                      <MaterialCommunityIcons name={webShellHeaderMci} size={24} color="#22c55e" />
                    ) : (
                      <Text style={{ fontSize: 24 }}>{categoryIcon}</Text>
                    )}
                  </View>
                </LinearGradient>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={webBudgetExpenseShell && poWebChrome ? poWebChrome.materialTitle : [styles.title, { color: Colors.text }]}>
                  Add {displayCategoryName}
                </Text>
                <Text style={webBudgetExpenseShell && poWebChrome ? poWebChrome.materialSubtitle : [styles.subtitle, { color: Colors.sub }]}>
                  Log your expense
                </Text>
              </View>
            </View>
          </View>

          {/* Form */}
          <ScrollView 
            ref={scrollViewRef}
            style={[
              !webBudgetExpenseShell && styles.form,
              { backgroundColor: darkMode ? '#000000' : Colors.bg },
              webBudgetExpenseShell && { flex: 1 },
              /** Native: bound scroll height so footer actions stay on-screen and receive taps. */
              !webBudgetExpenseShell && { flex: 1 },
            ]} 
            contentContainerStyle={
              webBudgetExpenseShell
                ? {
                    paddingHorizontal: webPoFormPad.scroll,
                    paddingTop: 8,
                    paddingBottom: 24,
                  }
                : { paddingBottom: 32, flexGrow: 1 }
            }
            showsVerticalScrollIndicator={false} 
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
          >
            <LinearGradient
              colors={webBudgetExpenseShell ? BRAND_FRAME_GRADIENT_COLORS : ['transparent', 'transparent']}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={{
                borderRadius: webBudgetExpenseShell ? 20 : 0,
                padding: webBudgetExpenseShell ? 1 : 0,
                marginBottom: webBudgetExpenseShell ? 8 : 0,
              }}
            >
              <View
                style={{
                  borderRadius: webBudgetExpenseShell ? 19 : 0,
                  padding: webBudgetExpenseShell ? 16 : 0,
                  backgroundColor: webBudgetExpenseShell
                    ? (darkMode ? Colors.card : Colors.bg)
                    : 'transparent',
                  borderWidth: webBudgetExpenseShell ? 1 : 0,
                  borderColor: Colors.line,
                }}
              >
            {isLaborOrSubs ? (
              <>
                <View style={webBudgetExpenseShell && poWebChrome ? poWebChrome.fieldGroup : styles.field}>
                  <Text style={webBudgetExpenseShell && poWebChrome ? poWebChrome.materialLabel : [styles.label, { color: Colors.text }]}>Labor description *</Text>
                  {webBudgetExpenseShell && poWebChrome ? (
                    <View style={poWebChrome.materialInputWrap}>
                      <Feather name="file-text" size={16} color="#8DA0B8" style={{ marginRight: 12 }} />
                      <TextInput
                        ref={laborDescRef}
                        style={poWebChrome.materialInput}
                        placeholder="e.g., Hang drywall, rough-in electrical"
                        placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                        value={laborDescription}
                        onChangeText={setLaborDescription}
                        autoCapitalize="sentences"
                        returnKeyType="next"
                        onSubmitEditing={() => tradeRef.current?.focus()}
                        blurOnSubmit={false}
                        selectionColor="#22c55e"
                        underlineColorAndroid="transparent"
                      />
                    </View>
                  ) : (
                    <TextInput
                      ref={laborDescRef}
                      style={[
                        styles.input,
                        {
                          backgroundColor: Colors.surface2,
                          borderColor: Colors.line,
                          borderWidth: 1,
                          borderRadius: 12,
                          color: Colors.text,
                        },
                      ]}
                      placeholder="e.g., Hang drywall, rough-in electrical"
                      placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                      value={laborDescription}
                      onChangeText={setLaborDescription}
                      autoCapitalize="sentences"
                      returnKeyType="next"
                      onSubmitEditing={() => tradeRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                  )}
                </View>
                <View style={webBudgetExpenseShell && poWebChrome ? poWebChrome.fieldGroup : styles.field}>
                  <Text style={webBudgetExpenseShell && poWebChrome ? poWebChrome.materialLabel : [styles.label, { color: Colors.text }]}>Trade</Text>
                  {webBudgetExpenseShell && poWebChrome ? (
                    <View style={poWebChrome.materialInputWrap}>
                      <Feather name="briefcase" size={16} color="#8DA0B8" style={{ marginRight: 12 }} />
                      <TextInput
                        ref={tradeRef}
                        style={poWebChrome.materialInput}
                        placeholder="e.g., ABC Electrical, Joe's Plumbing"
                        placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                        value={trade}
                        onChangeText={setTrade}
                        autoCapitalize="words"
                        returnKeyType="next"
                        onSubmitEditing={focusIntoPricingOrAmount}
                        blurOnSubmit={false}
                        selectionColor="#22c55e"
                        underlineColorAndroid="transparent"
                      />
                    </View>
                  ) : (
                    <TextInput
                      ref={tradeRef}
                      style={[
                        styles.input,
                        {
                          backgroundColor: Colors.surface2,
                          borderColor: Colors.line,
                          borderWidth: 1,
                          borderRadius: 12,
                          color: Colors.text,
                        },
                      ]}
                      placeholder="e.g., ABC Electrical, Joe's Plumbing"
                      placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                      value={trade}
                      onChangeText={setTrade}
                      autoCapitalize="words"
                      returnKeyType="next"
                      onSubmitEditing={focusIntoPricingOrAmount}
                      blurOnSubmit={false}
                    />
                  )}
                </View>
              </>
            ) : (
            <View style={webBudgetExpenseShell && poWebChrome ? poWebChrome.fieldGroup : styles.field}>
              <Text style={webBudgetExpenseShell && poWebChrome ? poWebChrome.materialLabel : [styles.label, { color: Colors.text }]}>{vendorLabel}</Text>
              {webBudgetExpenseShell && poWebChrome ? (
                <View style={poWebChrome.materialInputWrap}>
                  <Feather name={webVendorFeatherIcon} size={16} color="#8DA0B8" style={{ marginRight: 12 }} />
                  <TextInput
                    ref={vendorRef}
                    style={poWebChrome.materialInput}
                    placeholder={vendorPlaceholder}
                    placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                    value={vendor}
                    onChangeText={setVendor}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={focusNextAfterVendorField}
                    blurOnSubmit={false}
                    selectionColor="#22c55e"
                    underlineColorAndroid="transparent"
                  />
                </View>
              ) : (
              <TextInput
                ref={vendorRef}
                style={[
                  styles.input,
                  {
                    backgroundColor: Colors.surface2,
                    borderColor: Colors.line,
                    borderWidth: 1,
                    borderRadius: 12,
                    color: Colors.text,
                  }
                ]}
                placeholder={vendorPlaceholder}
                placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                value={vendor}
                onChangeText={setVendor}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={focusNextAfterVendorField}
                blurOnSubmit={false}
              />
              )}
            </View>
            )}

            {isMaterialsEquipmentExpense && (
              <View style={webBudgetExpenseShell && poWebChrome ? poWebChrome.fieldGroup : styles.field}>
                <Text style={webBudgetExpenseShell && poWebChrome ? poWebChrome.materialLabel : [styles.label, { color: Colors.text }]}>Material</Text>
                {webBudgetExpenseShell && poWebChrome ? (
                  <View style={poWebChrome.materialInputWrap}>
                    <Feather name="package" size={16} color="#8DA0B8" style={{ marginRight: 12 }} />
                    <TextInput
                      ref={materialRef}
                      style={poWebChrome.materialInput}
                      placeholder="e.g., 2x4 lumber, conduit, drywall sheets"
                      placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                      value={material}
                      onChangeText={setMaterial}
                      autoCapitalize="sentences"
                      returnKeyType="next"
                      onSubmitEditing={focusIntoPricingOrAmount}
                      blurOnSubmit={false}
                      selectionColor="#22c55e"
                      underlineColorAndroid="transparent"
                    />
                  </View>
                ) : (
                  <TextInput
                    ref={materialRef}
                    style={[
                      styles.input,
                      {
                        backgroundColor: Colors.surface2,
                        borderColor: Colors.line,
                        borderWidth: 1,
                        borderRadius: 12,
                        color: Colors.text,
                      },
                    ]}
                    placeholder="e.g., 2x4 lumber, conduit, drywall sheets"
                    placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                    value={material}
                    onChangeText={setMaterial}
                    autoCapitalize="sentences"
                    returnKeyType="next"
                    onSubmitEditing={focusIntoPricingOrAmount}
                    blurOnSubmit={false}
                  />
                )}
              </View>
            )}

            {supportsPerSqftPricing && (
              <View style={webBudgetExpenseShell && poWebChrome ? poWebChrome.fieldGroup : styles.field}>
                <Text style={webBudgetExpenseShell && poWebChrome ? poWebChrome.materialLabel : [styles.label, { color: Colors.text }]}>Pricing *</Text>
                <View style={webBudgetExpenseShell && poWebChrome ? poWebChrome.pricingRow : { flexDirection: "row", gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPricingMode("flat");
                      setMaterialSqftInput("");
                      setMaterialRatePerSqftInput("");
                      setLaborSqftInput("");
                      setLaborRatePerSqftInput("");
                      setSqftInput("");
                      setRatePerSqftInput("");
                      if (pricingMode === "sqft" && amount) {
                        const usd = centsDigitsToNumber(amount);
                        setAmount(usd > 0 ? sanitizeDecimalMoneyInput(usd.toFixed(2)) : "");
                      }
                    }}
                    style={
                      webBudgetExpenseShell && poWebChrome
                        ? poWebChrome.pricingOpt(pricingMode === "flat")
                        : {
                            flex: 1,
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: pricingMode === "flat" ? "#22c55e" : Colors.line,
                            backgroundColor: pricingMode === "flat" ? "#22c55e" : Colors.surface2,
                            alignItems: "center",
                            justifyContent: "center",
                          }
                    }
                  >
                    <Text
                      style={
                        webBudgetExpenseShell && poWebChrome
                          ? poWebChrome.pricingText(pricingMode === "flat")
                          : {
                              color: pricingMode === "flat" ? "#000000" : Colors.text,
                              fontWeight: "600",
                              fontSize: 14,
                            }
                      }
                    >
                      💵 Flat amount
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPricingMode("sqft");
                      setSqftInput("");
                      setRatePerSqftInput("");
                      setMaterialSqftInput("");
                      setMaterialRatePerSqftInput("");
                      setLaborSqftInput("");
                      setLaborRatePerSqftInput("");
                      setAmount("");
                    }}
                    style={
                      webBudgetExpenseShell && poWebChrome
                        ? poWebChrome.pricingOpt(pricingMode === "sqft")
                        : {
                            flex: 1,
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: pricingMode === "sqft" ? "#22c55e" : Colors.line,
                            backgroundColor: pricingMode === "sqft" ? "#22c55e" : Colors.surface2,
                            alignItems: "center",
                            justifyContent: "center",
                          }
                    }
                  >
                    <Text
                      style={
                        webBudgetExpenseShell && poWebChrome
                          ? poWebChrome.pricingText(pricingMode === "sqft")
                          : {
                              color: pricingMode === "sqft" ? "#000000" : Colors.text,
                              fontWeight: "600",
                              fontSize: 14,
                            }
                      }
                    >
                      📐 Per sq ft
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {isChangeOrdersCategory && pricingMode !== "sqft" && (
              <View style={styles.field}>
                <Text style={[styles.label, { color: Colors.text }]}>Change Order Cost Breakdown *</Text>
                <View style={{ gap: 12 }}>
                  <View>
                    <Text style={[styles.label, { color: Colors.text, marginBottom: 8 }]}>Material Cost</Text>
                    <View
                      style={[
                        styles.amountInputContainer,
                        {
                          backgroundColor: Colors.surface2,
                          borderColor: Colors.line,
                          borderWidth: 1,
                          borderRadius: 12,
                        },
                      ]}
                    >
                      <Text style={styles.dollarSign}>$</Text>
                      <TextInput
                        ref={materialsAmountRef}
                        style={[
                          styles.input,
                          styles.amountInput,
                          {
                            backgroundColor: "transparent",
                            borderWidth: 0,
                            color: Colors.text,
                          },
                        ]}
                        placeholder="0"
                        placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                        value={materialsAmountInput}
                        onChangeText={(text) =>
                          setMaterialsAmountInput(sanitizeDecimalMoneyInput(text))
                        }
                        {...projectAddExpenseNumericKeyboardProps}
                        keyboardType="decimal-pad"
                        returnKeyType="next"
                        onSubmitEditing={() => laborAmountRef.current?.focus()}
                        blurOnSubmit={false}
                      />
                    </View>
                  </View>
                  <View>
                    <Text style={[styles.label, { color: Colors.text, marginBottom: 8 }]}>Labor Cost</Text>
                    <View
                      style={[
                        styles.amountInputContainer,
                        {
                          backgroundColor: Colors.surface2,
                          borderColor: Colors.line,
                          borderWidth: 1,
                          borderRadius: 12,
                        },
                      ]}
                    >
                      <Text style={styles.dollarSign}>$</Text>
                      <TextInput
                        ref={laborAmountRef}
                        style={[
                          styles.input,
                          styles.amountInput,
                          {
                            backgroundColor: "transparent",
                            borderWidth: 0,
                            color: Colors.text,
                          },
                        ]}
                        placeholder="0"
                        placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                        value={laborAmountInput}
                        onChangeText={(text) =>
                          setLaborAmountInput(sanitizeDecimalMoneyInput(text))
                        }
                        {...projectAddExpenseNumericKeyboardProps}
                        keyboardType="decimal-pad"
                        returnKeyType="next"
                        onSubmitEditing={() => descriptionRef.current?.focus()}
                        blurOnSubmit={false}
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}

            <View style={webBudgetExpenseShell && poWebChrome ? poWebChrome.fieldGroup : styles.field}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={webBudgetExpenseShell && poWebChrome ? [poWebChrome.materialLabel, { marginBottom: 0 }] : [styles.label, { color: Colors.text }]}>
                  {supportsPerSqftPricing && pricingMode === "sqft"
                    ? "Total (calculated) *"
                    : isChangeOrdersCategory
                      ? "Total Change Order Amount *"
                      : "Amount *"}
                </Text>
                {priceReasonableness && (
                  <View style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 8,
                    backgroundColor: 
                      priceReasonableness === 'normal' ? 'rgba(34, 197, 94, 0.2)' :
                      priceReasonableness === 'high' ? 'rgba(245, 158, 11, 0.2)' :
                      'rgba(239, 68, 68, 0.2)',
                    borderWidth: 1,
                    borderColor:
                      priceReasonableness === 'normal' ? 'rgba(34, 197, 94, 0.4)' :
                      priceReasonableness === 'high' ? 'rgba(245, 158, 11, 0.4)' :
                      'rgba(239, 68, 68, 0.4)',
                  }}>
                    <Text style={{
                      color:
                        priceReasonableness === 'normal' ? '#22c55e' :
                        priceReasonableness === 'high' ? '#f59e0b' :
                        '#ef4444',
                      fontSize: 11,
                      fontWeight: '600',
                      textTransform: 'uppercase',
                    }}>
                      {priceReasonableness === 'normal' ? '✓ Normal' :
                       priceReasonableness === 'high' ? '⚠ High' :
                       '🚨 Outlier'}
                    </Text>
                  </View>
                )}
              </View>

              {supportsPerSqftPricing && pricingMode === "sqft" ? (
                isChangeOrdersCategory ? (
                  <>
                    <Text
                      style={[
                        styles.label,
                        {
                          color: Colors.sub,
                          marginBottom: 12,
                          fontWeight: "500",
                          fontSize: 13,
                        },
                      ]}
                    >
                      Enter material and/or labor as sq ft × $/sq ft. Total sums both lines.
                    </Text>
                    <View style={{ gap: 16 }}>
                      <View>
                        <Text style={[styles.label, { color: Colors.text, marginBottom: 8 }]}>
                          Material — sq ft & rate
                        </Text>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.label,
                                { color: Colors.text, marginBottom: 8, fontSize: 12 },
                              ]}
                            >
                              Sq ft
                            </Text>
                            <View
                              style={[
                                styles.amountInputContainer,
                                {
                                  backgroundColor: Colors.surface2,
                                  borderColor: Colors.line,
                                  borderWidth: 1,
                                  borderRadius: 12,
                                },
                              ]}
                            >
                              <Feather
                                name="maximize-2"
                                size={16}
                                color="#8DA0B8"
                                style={{ marginLeft: 12, marginRight: 8 }}
                              />
                              <TextInput
                                ref={materialSqftRef}
                                style={[
                                  styles.input,
                                  styles.amountInput,
                                  {
                                    backgroundColor: "transparent",
                                    borderWidth: 0,
                                    color: Colors.text,
                                  },
                                ]}
                                placeholder="0"
                                placeholderTextColor={
                                  darkMode ? "rgba(255,255,255,0.4)" : Colors.sub
                                }
                                value={materialSqftInput}
                                onChangeText={(text) => setMaterialSqftInput(digitsOnly(text))}
                                {...projectAddExpenseNumericKeyboardProps}
                        keyboardType="decimal-pad"
                                returnKeyType="next"
                                onSubmitEditing={() => materialRatePerSqftRef.current?.focus()}
                                blurOnSubmit={false}
                              />
                            </View>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.label,
                                { color: Colors.text, marginBottom: 8, fontSize: 12 },
                              ]}
                            >
                              $/sq ft
                            </Text>
                            <View
                              style={[
                                styles.amountInputContainer,
                                {
                                  backgroundColor: Colors.surface2,
                                  borderColor: Colors.line,
                                  borderWidth: 1,
                                  borderRadius: 12,
                                },
                              ]}
                            >
                              <Text style={styles.dollarSign}>$</Text>
                              <TextInput
                                ref={materialRatePerSqftRef}
                                style={[
                                  styles.input,
                                  styles.amountInput,
                                  {
                                    backgroundColor: "transparent",
                                    borderWidth: 0,
                                    color: Colors.text,
                                  },
                                ]}
                                placeholder="0"
                                placeholderTextColor={
                                  darkMode ? "rgba(255,255,255,0.4)" : Colors.sub
                                }
                                value={materialRatePerSqftInput}
                                onChangeText={(text) =>
                                  setMaterialRatePerSqftInput(sanitizeDecimalMoneyInput(text))
                                }
                                {...projectAddExpenseNumericKeyboardProps}
                        keyboardType="decimal-pad"
                                returnKeyType="next"
                                onSubmitEditing={() => laborSqftRef.current?.focus()}
                                blurOnSubmit={false}
                              />
                            </View>
                          </View>
                        </View>
                      </View>
                      <View>
                        <Text style={[styles.label, { color: Colors.text, marginBottom: 8 }]}>
                          Labor — sq ft & rate
                        </Text>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.label,
                                { color: Colors.text, marginBottom: 8, fontSize: 12 },
                              ]}
                            >
                              Sq ft
                            </Text>
                            <View
                              style={[
                                styles.amountInputContainer,
                                {
                                  backgroundColor: Colors.surface2,
                                  borderColor: Colors.line,
                                  borderWidth: 1,
                                  borderRadius: 12,
                                },
                              ]}
                            >
                              <Feather
                                name="maximize-2"
                                size={16}
                                color="#8DA0B8"
                                style={{ marginLeft: 12, marginRight: 8 }}
                              />
                              <TextInput
                                ref={laborSqftRef}
                                style={[
                                  styles.input,
                                  styles.amountInput,
                                  {
                                    backgroundColor: "transparent",
                                    borderWidth: 0,
                                    color: Colors.text,
                                  },
                                ]}
                                placeholder="0"
                                placeholderTextColor={
                                  darkMode ? "rgba(255,255,255,0.4)" : Colors.sub
                                }
                                value={laborSqftInput}
                                onChangeText={(text) => setLaborSqftInput(digitsOnly(text))}
                                {...projectAddExpenseNumericKeyboardProps}
                        keyboardType="decimal-pad"
                                returnKeyType="next"
                                onSubmitEditing={() => laborRatePerSqftRef.current?.focus()}
                                blurOnSubmit={false}
                              />
                            </View>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.label,
                                { color: Colors.text, marginBottom: 8, fontSize: 12 },
                              ]}
                            >
                              $/sq ft
                            </Text>
                            <View
                              style={[
                                styles.amountInputContainer,
                                {
                                  backgroundColor: Colors.surface2,
                                  borderColor: Colors.line,
                                  borderWidth: 1,
                                  borderRadius: 12,
                                },
                              ]}
                            >
                              <Text style={styles.dollarSign}>$</Text>
                              <TextInput
                                ref={laborRatePerSqftRef}
                                style={[
                                  styles.input,
                                  styles.amountInput,
                                  {
                                    backgroundColor: "transparent",
                                    borderWidth: 0,
                                    color: Colors.text,
                                  },
                                ]}
                                placeholder="0"
                                placeholderTextColor={
                                  darkMode ? "rgba(255,255,255,0.4)" : Colors.sub
                                }
                                value={laborRatePerSqftInput}
                                onChangeText={(text) =>
                                  setLaborRatePerSqftInput(sanitizeDecimalMoneyInput(text))
                                }
                                {...projectAddExpenseNumericKeyboardProps}
                        keyboardType="decimal-pad"
                                returnKeyType="done"
                                onSubmitEditing={() => descriptionRef.current?.focus()}
                                blurOnSubmit={false}
                              />
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                    <View
                      style={{
                        marginTop: 12,
                        backgroundColor: "rgba(34, 197, 94, 0.12)",
                        borderRadius: 12,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: "rgba(34, 197, 94, 0.35)",
                      }}
                    >
                      <Text
                        style={{
                          color: "#22c55e",
                          fontSize: 14,
                          fontWeight: "600",
                          textAlign: "center",
                          marginBottom: 4,
                        }}
                      >
                        {(() => {
                          const mSq = parseInt(digitsOnly(materialSqftInput), 10) || 0;
                          const mRate = decimalMoneyInputToNumber(materialRatePerSqftInput);
                          const lSq = parseInt(digitsOnly(laborSqftInput), 10) || 0;
                          const lRate = decimalMoneyInputToNumber(laborRatePerSqftInput);
                          const mTot = mSq > 0 && mRate > 0 ? mSq * mRate : 0;
                          const lTot = lSq > 0 && lRate > 0 ? lSq * lRate : 0;
                          const parts: string[] = [];
                          if (mTot > 0) parts.push(`Materials ${formatMoneyFull(mTot, { decimals: 2 })}`);
                          if (lTot > 0) parts.push(`Labor ${formatMoneyFull(lTot, { decimals: 2 })}`);
                          return parts.length ? parts.join(" · ") : "—";
                        })()}
                      </Text>
                      <Text
                        style={{
                          color: "#22c55e",
                          fontSize: 18,
                          fontWeight: "700",
                          textAlign: "center",
                        }}
                      >
                        Total:{" "}
                        {(() => {
                          const mSq = parseInt(digitsOnly(materialSqftInput), 10) || 0;
                          const mRate = decimalMoneyInputToNumber(materialRatePerSqftInput);
                          const lSq = parseInt(digitsOnly(laborSqftInput), 10) || 0;
                          const lRate = decimalMoneyInputToNumber(laborRatePerSqftInput);
                          const mTot = mSq > 0 && mRate > 0 ? mSq * mRate : 0;
                          const lTot = lSq > 0 && lRate > 0 ? lSq * lRate : 0;
                          return formatMoneyFull(mTot + lTot, { decimals: 2 });
                        })()}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.label, { color: Colors.text, marginBottom: 8 }]}>
                          Square feet *
                        </Text>
                        <View
                          style={
                            webBudgetExpenseShell && poWebChrome
                              ? poWebChrome.amountShell
                              : [
                                  styles.amountInputContainer,
                                  {
                                    backgroundColor: Colors.surface2,
                                    borderColor: Colors.line,
                                    borderWidth: 1,
                                    borderRadius: 12,
                                  },
                                ]
                          }
                        >
                          <Feather
                            name="maximize-2"
                            size={16}
                            color="#8DA0B8"
                            style={{ marginLeft: 12, marginRight: 8 }}
                          />
                          <TextInput
                            ref={sqftRef}
                            style={
                              webBudgetExpenseShell && poWebChrome
                                ? poWebChrome.amountInput
                                : [
                                    styles.input,
                                    styles.amountInput,
                                    {
                                      backgroundColor: "transparent",
                                      borderWidth: 0,
                                      color: Colors.text,
                                    },
                                  ]
                            }
                            placeholder="0"
                            placeholderTextColor={
                              darkMode ? "rgba(255,255,255,0.4)" : Colors.sub
                            }
                            value={sqftInput}
                            onChangeText={onSqftChange}
                            {...projectAddExpenseNumericKeyboardProps}
                        keyboardType="decimal-pad"
                            returnKeyType="done"
                            onSubmitEditing={() => ratePerSqftRef.current?.focus()}
                            blurOnSubmit={false}
                          />
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.label, { color: Colors.text, marginBottom: 8 }]}>
                          Rate ($/sq ft) *
                        </Text>
                        <View
                          style={
                            webBudgetExpenseShell && poWebChrome
                              ? poWebChrome.amountShell
                              : [
                                  styles.amountInputContainer,
                                  {
                                    backgroundColor: Colors.surface2,
                                    borderColor: Colors.line,
                                    borderWidth: 1,
                                    borderRadius: 12,
                                  },
                                ]
                          }
                        >
                          <Text style={webBudgetExpenseShell && poWebChrome ? poWebChrome.dollarSign : styles.dollarSign}>$</Text>
                          <TextInput
                            ref={ratePerSqftRef}
                            style={
                              webBudgetExpenseShell && poWebChrome
                                ? poWebChrome.amountInput
                                : [
                                    styles.input,
                                    styles.amountInput,
                                    {
                                      backgroundColor: "transparent",
                                      borderWidth: 0,
                                      color: Colors.text,
                                    },
                                  ]
                            }
                            placeholder="0"
                            placeholderTextColor={
                              darkMode ? "rgba(255,255,255,0.4)" : Colors.sub
                            }
                            value={ratePerSqftInput}
                            onChangeText={onRatePerSqftChange}
                            {...projectAddExpenseNumericKeyboardProps}
                        keyboardType="decimal-pad"
                            returnKeyType="done"
                            onSubmitEditing={() => descriptionRef.current?.focus()}
                            blurOnSubmit={false}
                          />
                        </View>
                      </View>
                    </View>
                    <View
                      style={{
                        marginTop: 12,
                        backgroundColor: "rgba(34, 197, 94, 0.12)",
                        borderRadius: 12,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: "rgba(34, 197, 94, 0.35)",
                      }}
                    >
                      <Text
                        style={{
                          color: "#22c55e",
                          fontSize: 18,
                          fontWeight: "700",
                          textAlign: "center",
                        }}
                      >
                        Total:{" "}
                        {(() => {
                          const sq = parseInt(digitsOnly(sqftInput), 10) || 0;
                          const rate = decimalMoneyInputToNumber(ratePerSqftInput);
                          const t = sq * rate;
                          return formatMoneyFull(t, { decimals: 2 });
                        })()}
                      </Text>
                    </View>
                  </>
                )
              ) : (
                <View
                  style={
                    webBudgetExpenseShell && poWebChrome
                      ? poWebChrome.amountShell
                      : [
                          styles.amountInputContainer,
                          {
                            backgroundColor: Colors.surface2,
                            borderColor: Colors.line,
                            borderWidth: 1,
                            borderRadius: 12,
                          },
                        ]
                  }
                >
                  <Text style={webBudgetExpenseShell && poWebChrome ? poWebChrome.dollarSign : styles.dollarSign}>$</Text>
                  <TextInput
                    ref={amountRef}
                    style={
                      webBudgetExpenseShell && poWebChrome
                        ? poWebChrome.amountInput
                        : [
                            styles.input,
                            styles.amountInput,
                            {
                              backgroundColor: "transparent",
                              borderWidth: 0,
                              color: Colors.text,
                            },
                          ]
                    }
                    placeholder="0"
                    placeholderTextColor={
                      darkMode ? "rgba(255,255,255,0.4)" : Colors.sub
                    }
                    value={amount}
                    onChangeText={applyFlatAmountTextChange}
                    {...projectAddExpenseNumericKeyboardProps}
                    keyboardType={pricingMode === "flat" ? "decimal-pad" : "phone-pad"}
                    editable={!(isChangeOrdersCategory && pricingMode !== "sqft")}
                    selectTextOnFocus={!(isChangeOrdersCategory && pricingMode !== "sqft")}
                    returnKeyType="done"
                    onSubmitEditing={() => descriptionRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                </View>
              )}

              {parseAmountFieldToNumber(amount) > 0 &&
                (!supportsPerSqftPricing || pricingMode !== "sqft") && (
                <Text style={styles.hint}>{formatMoneyFull(parseAmountFieldToNumber(amount), { decimals: 2 })}</Text>
              )}
            </View>

            {/* Receipt Capture */}
            <View style={webBudgetExpenseShell && poWebChrome ? poWebChrome.fieldGroup : styles.field}>
              <Text style={webBudgetExpenseShell && poWebChrome ? poWebChrome.materialLabel : [styles.label, { color: Colors.text }]}>Receipt (Optional)</Text>
              {receiptUri ? (
                <View style={{ marginTop: 8 }}>
                  <View style={{ position: 'relative', marginBottom: 8 }}>
                    <Image source={{ uri: receiptUri }} style={{ width: '100%', height: 200, borderRadius: 12 }} resizeMode="cover" />
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setReceiptUri(null);
                      }}
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        borderRadius: 20,
                        width: 32,
                        height: 32,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <MaterialIcons name="close" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                  {isProcessingOCR && (
                    <Text style={{ color: '#22c55e', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>
                      Processing receipt...
                    </Text>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  onPress={showReceiptOptions}
                  style={{
                    borderWidth: 2,
                    borderColor: Colors.line,
                    borderStyle: 'dashed',
                    borderRadius: 12,
                    padding: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: Colors.surface2,
                  }}
                >
                  <MaterialIcons name="receipt" size={32} color="#8DA0B8" />
                  <Text style={{ color: '#8DA0B8', fontSize: 14, marginTop: 8, fontWeight: '500' }}>
                    📸 Take Photo or 📄 Upload Receipt
                  </Text>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: 12, marginTop: 4 }}>
                    Auto-fill from receipt (OCR)
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Expected Delivery (Purchase Orders only) */}
            {isPurchaseOrdersCategory && (
              <View style={webBudgetExpenseShell && poWebChrome ? poWebChrome.fieldGroup : styles.field}>
                <Text style={webBudgetExpenseShell && poWebChrome ? poWebChrome.materialLabel : [styles.label, { color: Colors.text }]}>Expected Delivery *</Text>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowDeliveryDatePicker(prev => !prev);
                  }}
                  style={
                    webBudgetExpenseShell && poWebChrome
                      ? [poWebChrome.materialInputWrap, { minHeight: 52 }]
                      : [
                          styles.dateButton,
                          {
                            backgroundColor: Colors.surface2,
                            borderColor: Colors.line,
                          },
                        ]
                  }
                >
                  <Feather name="calendar" size={16} color="#8DA0B8" style={{ marginRight: 12 }} />
                  <Text style={[styles.dateButtonText, { color: Colors.text }]}>
                    {expectedDelivery.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </TouchableOpacity>
                {showDeliveryDatePicker && (
                  <View style={styles.calendarWrapper}>
                    <GreyCalendar
                      onDayPress={(day) => {
                        const selectedDate = new Date(day.dateString + 'T00:00:00');
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        if (selectedDate < today) {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                          return;
                        }
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setExpectedDelivery(selectedDate);
                        setShowDeliveryDatePicker(false);
                      }}
                      markedDates={{
                        [`${expectedDelivery.getFullYear()}-${String(expectedDelivery.getMonth() + 1).padStart(2, '0')}-${String(expectedDelivery.getDate()).padStart(2, '0')}`]: {
                          selected: true,
                          selectedColor: '#22c55e',
                          selectedTextColor: '#000000',
                        }
                      }}
                      initialDate={`${expectedDelivery.getFullYear()}-${String(expectedDelivery.getMonth() + 1).padStart(2, '0')}-${String(expectedDelivery.getDate()).padStart(2, '0')}`}
                    />
                  </View>
                )}
              </View>
            )}

            {/* Planned vs Unplanned Toggle */}
            <View style={webBudgetExpenseShell && poWebChrome ? poWebChrome.fieldGroup : styles.field}>
              <Text style={webBudgetExpenseShell && poWebChrome ? poWebChrome.materialLabel : [styles.label, { color: Colors.text }]}>Budget Status *</Text>
              <View style={webBudgetExpenseShell && poWebChrome ? poWebChrome.pricingRow : { flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsPlanned(true);
                  }}
                  style={
                    webBudgetExpenseShell && poWebChrome
                      ? poWebChrome.pricingOpt(isPlanned)
                      : {
                          flex: 1,
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: isPlanned ? '#22c55e' : Colors.line,
                          backgroundColor: isPlanned ? '#22c55e' : Colors.surface2,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }
                  }
                >
                  <Text style={
                    webBudgetExpenseShell && poWebChrome
                      ? poWebChrome.pricingText(isPlanned)
                      : {
                          color: isPlanned ? '#000000' : Colors.text,
                          fontWeight: '600',
                          fontSize: 14,
                        }
                  }>✓ Planned</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsPlanned(false);
                  }}
                  style={
                    webBudgetExpenseShell && poWebChrome
                      ? (!isPlanned
                          ? {
                              flex: 1,
                              paddingVertical: 14,
                              paddingHorizontal: 12,
                              borderRadius: 14,
                              borderWidth: 1.5,
                              alignItems: 'center',
                              justifyContent: 'center',
                              minHeight: 48,
                              borderColor: '#f59e0b',
                              backgroundColor: 'rgba(245, 158, 11, 0.22)',
                            }
                          : poWebChrome.pricingOpt(false))
                      : {
                          flex: 1,
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: !isPlanned ? '#f59e0b' : Colors.line,
                          backgroundColor: !isPlanned ? 'rgba(245, 158, 11, 0.2)' : Colors.surface2,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }
                  }
                >
                  <Text style={
                    webBudgetExpenseShell && poWebChrome
                      ? {
                          color: !isPlanned ? '#b45309' : Colors.text,
                          fontWeight: (!isPlanned ? '700' : '600') as '700' | '600',
                          fontSize: 14,
                        }
                      : {
                          color: !isPlanned ? '#f59e0b' : Colors.text,
                          fontWeight: '600',
                          fontSize: 14,
                        }
                  }>⚠ Unplanned</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Phase / Scope Link */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: Colors.text }]}>Project Phase (Optional)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {['Foundation', 'Framing', 'Rough-in', 'Finish', 'Other'].map((phase) => (
                  <TouchableOpacity
                    key={phase}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setProjectPhase(projectPhase === phase ? '' : phase);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: projectPhase === phase ? '#22c55e' : Colors.line,
                      backgroundColor: projectPhase === phase ? '#22c55e' : Colors.surface2,
                    }}
                  >
                    <Text style={{
                      color: projectPhase === phase ? '#000000' : Colors.text,
                      fontSize: 13,
                      fontWeight: '600',
                    }}>{phase}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: Colors.text }]}>Scope / Location (Optional)</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: Colors.surface2,
                    borderColor: Colors.line,
                    borderWidth: 1,
                    borderRadius: 12,
                    color: Colors.text,
                  }
                ]}
                placeholder="e.g., Kitchen, Unit 3, Bathroom"
                placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                value={scope}
                onChangeText={setScope}
                returnKeyType="next"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: Colors.text }]}>Description (Optional)</Text>
              <TextInput
                ref={descriptionRef}
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: Colors.surface2,
                    borderColor: Colors.line,
                    borderWidth: 1,
                    borderRadius: 12,
                    color: Colors.text,
                  }
                ]}
                placeholder={descriptionPlaceholder}
                placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                scrollEnabled={false}
                returnKeyType="next"
                onSubmitEditing={() => poRef.current?.focus()}
                blurOnSubmit={false}
                selectionColor={darkMode ? "rgba(34, 197, 94, 0.4)" : "rgba(34, 197, 94, 0.3)"}
                cursorColor={Colors.text}
                keyboardAppearance={darkMode ? "dark" : "light"}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: Colors.text }]}>PO Number (Optional)</Text>
              <TextInput
                ref={poRef}
                style={[
                  styles.input,
                  {
                    backgroundColor: Colors.surface2,
                    borderColor: Colors.line,
                    borderWidth: 1,
                    borderRadius: 12,
                    color: Colors.text,
                  }
                ]}
                placeholder="e.g., PO-1003"
                placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                value={po}
                onChangeText={setPo}
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={() => {
                  Keyboard.dismiss();
                  handleSave();
                }}
                selectionColor={darkMode ? "rgba(34, 197, 94, 0.4)" : "rgba(34, 197, 94, 0.3)"}
                cursorColor={Colors.text}
                keyboardAppearance={darkMode ? "dark" : "light"}
              />
            </View>
              </View>
            </LinearGradient>
          </ScrollView>

          {/* Actions */}
          {webBudgetExpenseShell && poWebChrome ? (
            <View style={[poWebChrome.footerFlow, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <Pressable
                onPress={handleFooterDismiss}
                style={({ pressed }) => [poWebChrome.cancelBtn, pressed && { opacity: 0.75 }]}
              >
                <Text style={poWebChrome.cancelText}>{budgetFooterDismissLabel}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (Platform.OS === "web") {
                    handleSave();
                    Keyboard.dismiss();
                  } else {
                    Keyboard.dismiss();
                    handleSave();
                  }
                }}
                style={({ pressed }) => [poWebChrome.saveBtnWrap, pressed && { opacity: 0.92 }]}
              >
                <View style={poWebChrome.saveBtnInner}>
                  <Text style={poWebChrome.saveBtnText}>✓ Save</Text>
                </View>
              </Pressable>
            </View>
          ) : (
          <View
            style={[
              styles.actions,
              { paddingBottom: Math.max(insets.bottom, 20) + 10 },
              !darkMode && { borderTopColor: Colors.line, backgroundColor: Colors.bg },
              { zIndex: 10, elevation: 12 },
            ]}
          >
            <TouchableOpacity
              onPress={handleFooterDismiss}
              style={[
                styles.cancelButtonFlat,
                darkMode
                  ? {
                      backgroundColor: "#18181b",
                      borderColor: "#3f3f46",
                    }
                  : {
                      backgroundColor: Colors.surface2,
                      borderColor: Colors.line,
                    },
              ]}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.cancelButtonTextFlat,
                  { color: darkMode ? "rgba(226, 232, 240, 0.92)" : Colors.text },
                ]}
              >
                {budgetFooterDismissLabel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                Keyboard.dismiss();
                handleSave();
              }} 
              style={styles.saveButton}
            >
              <View style={[styles.saveButtonGradient, { backgroundColor: "#22c55e" }]}>
                <Text style={styles.saveButtonText}>✓ Save</Text>
              </View>
            </TouchableOpacity>
          </View>
          )}
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconContainerWrapper: {
    borderRadius: 14,
  },
  headerIconBorder: {
    borderRadius: 14,
    padding: 1,
  },
  headerIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: "white",
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  subtitle: {
    color: "#8DA0B8",
    fontSize: 13,
    marginTop: 4,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  form: {
    padding: 20,
  },
  field: {
    marginBottom: 20,
  },

  label: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  inputBorder: {
    borderRadius: 20,
    padding: 1,
  },
  input: {
    // backgroundColor, borderColor, borderWidth, borderRadius, color are set dynamically
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontWeight: "500",
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    // backgroundColor, borderColor, borderWidth, borderRadius are set dynamically
  },
  dollarSign: {
    position: "absolute",
    left: 16,
    color: "#22c55e",
    fontSize: 18,
    fontWeight: "600",
    zIndex: 1,
  },
  amountInput: {
    paddingLeft: 32,
    flex: 1,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  hint: {
    color: "#22d3ee",
    fontSize: 13,
    marginTop: 6,
    fontWeight: "600",
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  calendarWrapper: {
    width: '100%',
    marginTop: 12,
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#000000",
  },
  cancelButtonFlat: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonTextFlat: {
    fontSize: 15,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  saveButtonGradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
}); 