import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
  Alert,
  ActionSheetIOS,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { formatDraftMoney, getScopePackages } from '@/utils/estimateAiDraft';
import {
  compactPackageAmount,
  compactPackageStatusLabel,
  dedupeMissingPriceSuggestions,
  formatScopeQuantity,
  getCompactProjectSummary,
  getUniformStatusLabel,
  pendingProposalCalculatedTotal,
  resolveScopePackageBudgetBreakdown,
  type ScopePackageBudgetBreakdown,
  scopePackageNeedsManualPrice,
  scopePackagePricingHint,
  scopePackagePricedAmount,
  sumLiveScopePackageTotals,
  SCOPE_LIST_DEFAULT_LIMIT,
  shouldHidePerRowStatus,
} from '@/utils/estimateDraftReviewUi';
import { draftHasApplyablePricing } from '@/utils/estimateAiDraftPricing';
import { isSoftCostScopePackage } from '@/utils/softCostScope';
import type { EstimateConfidenceLevel } from '@/utils/estimateAiDraft';
import { estimateFlowCardStyle, estimateFlowDividerColor } from '@/utils/estimateFlowCardStyle';
import ScopeBudgetBreakdownPanel from '@/components/estimate/ScopeBudgetBreakdownPanel';

type Colors = {
  text: string;
  sub: string;
  line: string;
  bg: string;
  surface2: string;
};

type Props = {
  draft: EstimateAiDraft;
  Colors: Colors;
  darkMode: boolean;
  busy: boolean;
  confStyle: { bg: string; color: string };
  confidenceLevel?: EstimateConfidenceLevel;
  onPriceScopeItem?: (packageName: string) => void;
  onUpdateScopeBudgetSplit?: (
    packageName: string,
    material: number,
    labor: number,
    basis?: ScopePackageBudgetBreakdown['basis']
  ) => void;
  onRemoveScopeItem?: (packageName: string) => void;
  markupPct?: number;
  onRegenerate: () => void;
  showDetailsContent: React.ReactNode;
};

const flowCard = (Colors: Colors, darkMode: boolean) =>
  estimateFlowCardStyle(Colors, darkMode, { marginBottom: 12 });
const flowDivider = (darkMode: boolean) => estimateFlowDividerColor(darkMode);

function formatUnitLabel(unit: string | null | undefined) {
  const normalized = String(unit || '').toLowerCase();
  if (normalized === 'sqft' || normalized === 'sf') return 'sqft';
  if (normalized === 'lf' || normalized === 'linear foot' || normalized === 'linear feet') return 'LF';
  return normalized || 'unit';
}

function parseMoneyInput(text: string) {
  const value = Number(String(text || '').replace(/[$,\s]/g, ''));
  return Number.isFinite(value) ? value : 0;
}

function roundedMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function PriceRow({
  label,
  value,
  Colors,
  highlight,
}: {
  label: string;
  value: string;
  Colors: Colors;
  highlight?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <Text style={{ color: Colors.sub, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: highlight ? '#22c55e' : Colors.text, fontSize: 15, fontWeight: '700' }}>
        {value}
      </Text>
    </View>
  );
}

function ScopeSplitPricingInput({
  label,
  amount,
  basis,
  Colors,
  darkMode,
  busy,
  onAmountChange,
}: {
  label: string;
  amount: number;
  basis?: ScopePackageBudgetBreakdown['basis'];
  Colors: Colors;
  darkMode: boolean;
  busy: boolean;
  onAmountChange: (amount: number) => void;
}) {
  const [inputMode, setInputMode] = useState<'total' | 'rate'>('total');
  const supportsRateMode = Boolean(basis?.quantity && basis.quantity > 0);
  const unitLabel = formatUnitLabel(basis?.unit);
  const rate = supportsRateMode ? Math.round((amount / basis!.quantity) * 100) / 100 : 0;
  const displayValue = inputMode === 'rate' ? String(rate || '') : String(amount || '');
  const helper =
    inputMode === 'rate'
      ? `Total ${formatDraftMoney(amount || 0)}`
      : supportsRateMode
        ? `$${rate || 0} / ${unitLabel}`
        : null;

  const handleChangeText = (text: string) => {
    const value = parseMoneyInput(text);
    onAmountChange(inputMode === 'rate' && basis?.quantity ? Math.round(value * basis.quantity * 100) / 100 : value);
  };

  return (
    <View
      style={[
        styles.pricingInputCard,
        {
          borderColor: darkMode ? 'rgba(148, 163, 184, 0.18)' : Colors.line,
          backgroundColor: darkMode ? 'rgba(255,255,255,0.035)' : 'rgba(248,250,252,0.9)',
        },
      ]}
    >
      <View style={styles.pricingInputHeader}>
        <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '700' }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {helper ? (
            <View
              style={[
                styles.rateChip,
                {
                  borderColor: darkMode ? 'rgba(96, 165, 250, 0.28)' : 'rgba(59, 130, 246, 0.24)',
                  backgroundColor: darkMode ? 'rgba(96, 165, 250, 0.09)' : 'rgba(59, 130, 246, 0.08)',
                },
              ]}
            >
              <Text style={{ color: '#60a5fa', fontSize: 11, fontWeight: '700' }}>{helper}</Text>
            </View>
          ) : null}
          {supportsRateMode ? (
            <TouchableOpacity
              activeOpacity={0.75}
              disabled={busy}
              onPress={() => setInputMode((mode) => (mode === 'total' ? 'rate' : 'total'))}
              style={[
                styles.rateModeToggle,
                {
                  borderColor: darkMode ? 'rgba(34, 197, 94, 0.3)' : 'rgba(22, 163, 74, 0.24)',
                  backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.08)' : 'rgba(22, 163, 74, 0.08)',
                },
              ]}
            >
              <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '700' }}>
                {inputMode === 'total' ? `Edit $/${unitLabel}` : 'Edit total'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <View
        style={[
          styles.pricingInputRow,
          {
            borderColor: darkMode ? 'rgba(148, 163, 184, 0.22)' : Colors.line,
            backgroundColor: darkMode ? 'rgba(255,255,255,0.045)' : '#fff',
          },
        ]}
      >
        <Text style={[styles.pricingCurrency, { color: Colors.sub }]}>$</Text>
        <TextInput
          value={displayValue}
          onChangeText={handleChangeText}
          placeholder="0"
          placeholderTextColor={darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8'}
          keyboardType="decimal-pad"
          editable={!busy}
          style={[styles.pricingInput, { color: Colors.text }]}
        />
        {inputMode === 'rate' ? (
          <Text style={[styles.pricingUnitSuffix, { color: Colors.sub }]}>/{unitLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

function emptyBudgetBreakdown(
  pkg: {
    price?: number | null;
    knownSubtotal?: number | null;
    calculatedSubtotal?: number | null;
    materialPrice?: number | null;
    laborPrice?: number | null;
    scopeQuantities?: Array<{ quantity: number; unit: string }>;
  },
  existing?: ScopePackageBudgetBreakdown | null
): ScopePackageBudgetBreakdown {
  if (existing) return existing;
  const q = pkg.scopeQuantities?.[0];
  const basis = q && q.quantity > 0 ? { quantity: q.quantity, unit: q.unit } : null;
  const pkgMat = Math.max(0, Number(pkg.materialPrice) || 0);
  const pkgLab = Math.max(0, Number(pkg.laborPrice) || 0);
  const packageTotal = Math.max(
    0,
    Number(pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0) || 0
  );
  // Unpriced: start at $0 / $0. Priced lump with no resolved split: keep total on labor.
  if (packageTotal <= 0 && pkgMat <= 0 && pkgLab <= 0) {
    return {
      total: 0,
      material: 0,
      labor: 0,
      materialSource: 'manual',
      laborSource: 'manual',
      basis,
    };
  }
  if (pkgMat > 0 || pkgLab > 0) {
    return {
      total: Math.round((pkgMat + pkgLab) * 100) / 100 || packageTotal,
      material: pkgMat,
      labor: pkgLab,
      materialSource: 'manual',
      laborSource: 'manual',
      basis,
    };
  }
  return {
    total: packageTotal,
    material: 0,
    labor: packageTotal,
    materialSource: 'manual',
    laborSource: 'manual',
    basis,
  };
}

function ScopeSplitPricingEditor({
  packageName,
  breakdown,
  Colors,
  darkMode,
  busy,
  onUpdateScopeBudgetSplit,
}: {
  packageName: string;
  breakdown: ScopePackageBudgetBreakdown;
  Colors: Colors;
  darkMode: boolean;
  busy: boolean;
  onUpdateScopeBudgetSplit: (
    packageName: string,
    material: number,
    labor: number,
    basis?: ScopePackageBudgetBreakdown['basis']
  ) => void;
}) {
  const material = Number(breakdown.material) || 0;
  const labor = Number(breakdown.labor) || 0;
  const total = Math.round((material + labor) * 100) / 100;
  const handleMaterialChange = (nextMaterial: number) => {
    onUpdateScopeBudgetSplit(packageName, nextMaterial, labor, breakdown.basis);
  };
  const handleLaborChange = (nextLabor: number) => {
    onUpdateScopeBudgetSplit(packageName, material, nextLabor, breakdown.basis);
  };
  return (
    <View style={{ marginTop: 8 }}>
      <ScopeSplitPricingInput
        label="Material"
        amount={material}
        basis={breakdown.basis}
        Colors={Colors}
        darkMode={darkMode}
        busy={busy}
        onAmountChange={handleMaterialChange}
      />
      <ScopeSplitPricingInput
        label="Labor"
        amount={labor}
        basis={breakdown.basis}
        Colors={Colors}
        darkMode={darkMode}
        busy={busy}
        onAmountChange={handleLaborChange}
      />
      <View
        style={{
          marginTop: 10,
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ color: Colors.sub, fontSize: 13, fontWeight: '600' }}>Total</Text>
        <Text style={{ color: '#22c55e', fontSize: 16, fontWeight: '800' }}>
          {formatDraftMoney(total)}
        </Text>
      </View>
    </View>
  );
}

/** Soft-cost packages: single lump-sum allowance — never Material/Labor. */
function ScopeAllowancePricingEditor({
  packageName,
  amount,
  Colors,
  darkMode,
  busy,
  onUpdateScopeBudgetSplit,
}: {
  packageName: string;
  amount: number;
  Colors: Colors;
  darkMode: boolean;
  busy: boolean;
  onUpdateScopeBudgetSplit: (
    packageName: string,
    material: number,
    labor: number,
    basis?: ScopePackageBudgetBreakdown['basis']
  ) => void;
}) {
  return (
    <View style={{ marginTop: 8 }}>
      <ScopeSplitPricingInput
        label="Allowance"
        amount={amount}
        Colors={Colors}
        darkMode={darkMode}
        busy={busy}
        onAmountChange={(next) => onUpdateScopeBudgetSplit(packageName, 0, Math.max(0, next))}
      />
    </View>
  );
}

function softCostPackageAmount(pkg: {
  price?: number | null;
  knownSubtotal?: number | null;
  calculatedSubtotal?: number | null;
  materialPrice?: number | null;
  laborPrice?: number | null;
}): number {
  const total = Math.max(
    0,
    Number(pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0) || 0
  );
  if (total > 0) return total;
  return Math.max(0, (Number(pkg.materialPrice) || 0) + (Number(pkg.laborPrice) || 0));
}

export default function AIEstimateDraftReviewCompact({
  draft,
  Colors,
  darkMode,
  busy,
  confStyle,
  onPriceScopeItem,
  onUpdateScopeBudgetSplit,
  onRemoveScopeItem,
  markupPct = 0,
  onRegenerate,
  showDetailsContent,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const [showAllScope, setShowAllScope] = useState(false);
  const [editingPricingFor, setEditingPricingFor] = useState<string | null>(null);
  const [expandedBudgetSplits, setExpandedBudgetSplits] = useState<Record<string, true>>({});
  const scopePackages = getScopePackages(draft);
  if (__DEV__) {
    const q = draft.scopeMeasurements?.itemQuantities || {};
    const pkg = scopePackages.find((p) => /flooring|lvp/i.test(`${p.name || ''} ${p.scope || ''}`));
    if (pkg) {
      console.log('[scope-pricing] step3 render', {
        rows: scopePackages.map((p) => ({
          name: p.name,
          price: p.price ?? p.knownSubtotal ?? p.calculatedSubtotal,
          status: p.status,
        })),
        material: q.flooring__material,
        labor: q.flooring__labor,
        allowance: q.flooring__allowance,
        packagePrice: pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal,
        packageStatus: pkg.status,
      });
    }
  }
  const hasPricing = draftHasApplyablePricing(draft);
  const statedTotal = draft.statedTotal ?? draft.totalValidation?.statedTotal;
  const pendingTotal = pendingProposalCalculatedTotal(draft);
  const liveScopeTotal = sumLiveScopePackageTotals(draft);
  // Prefer the sum of displayed rows so header Total always matches scope lines.
  const calculatedTotal =
    liveScopeTotal > 0
      ? liveScopeTotal
      : draft.calculatedLineItemTotal ??
        draft.calculatedTotal ??
        draft.totalValidation?.calculatedLineItemsTotal ??
        (pendingTotal > 0 ? pendingTotal : null);
  const partialCount = scopePackages.filter((p) => p.status === 'partial_pricing').length;
  const missingPriceCount = scopePackages.filter((p) => p.status === 'missing_price').length;
  const hideRowStatus = shouldHidePerRowStatus(scopePackages);
  const uniformStatusLabel = getUniformStatusLabel(scopePackages);
  const visibleScope = showAllScope
    ? scopePackages
    : scopePackages.slice(0, SCOPE_LIST_DEFAULT_LIMIT);
  const hiddenScopeCount = Math.max(0, scopePackages.length - SCOPE_LIST_DEFAULT_LIMIT);
  const roughSuggestionLines = dedupeMissingPriceSuggestions(
    draft.pricingMemoryMissingSuggestions || [],
    6
  );
  const hasRoughOnScope = scopePackages.some((p) => p.status === 'rough_price');
  const scopeBudgetTotals = scopePackages.reduce(
    (sum, pkg) => {
      const isSoftCost = isSoftCostScopePackage(pkg, draft);
      const breakdown = isSoftCost ? null : resolveScopePackageBudgetBreakdown(pkg, draft);
      const numericAmount = scopePackagePricedAmount(pkg, draft);
      if (numericAmount <= 0) return sum;
      // Soft costs only in Allowances. Unsplit trades count as Labor (same as apply-to-bid).
      if (isSoftCost || !breakdown) {
        return isSoftCost
          ? { ...sum, allowance: sum.allowance + numericAmount }
          : { ...sum, labor: sum.labor + numericAmount };
      }
      const material = Math.min(breakdown.material, numericAmount);
      const labor = Math.min(breakdown.labor, Math.max(0, numericAmount - material));
      const allowance = Math.max(0, numericAmount - material - labor);
      return {
        material: sum.material + material,
        labor: sum.labor + labor,
        allowance: sum.allowance + allowance,
        coveredTotal: sum.coveredTotal + numericAmount,
      };
    },
    { material: 0, labor: 0, allowance: 0, coveredTotal: 0 }
  );
  // Only use live scope buckets — never mix in stale draft.calculatedMaterialTotal
  // (that double-counted against unsplit packages already rolled into Labor).
  const materialTotal =
    scopeBudgetTotals.material > 0 ? roundedMoney(scopeBudgetTotals.material) : null;
  const laborTotal = scopeBudgetTotals.labor > 0 ? roundedMoney(scopeBudgetTotals.labor) : null;
  const allowanceTotal =
    scopeBudgetTotals.allowance > 0 ? roundedMoney(scopeBudgetTotals.allowance) : null;
  const directSubtotal =
    calculatedTotal != null && calculatedTotal > 0
      ? calculatedTotal
      : materialTotal != null || laborTotal != null || allowanceTotal != null
        ? roundedMoney((materialTotal || 0) + (laborTotal || 0) + (allowanceTotal || 0))
        : null;
  const normalizedMarkupPct = Math.max(0, Number(markupPct) || 0);
  const estimatedBidWithMarkup =
    directSubtotal != null && directSubtotal > 0 && normalizedMarkupPct > 0
      ? roundedMoney(directSubtotal * (1 + normalizedMarkupPct / 100))
      : null;
  const showTotalsCard =
    (calculatedTotal != null && calculatedTotal > 0) ||
    allowanceTotal != null ||
    statedTotal != null;

  const heroTotal =
    statedTotal != null && statedTotal > 0
      ? statedTotal
      : calculatedTotal != null && calculatedTotal > 0
        ? calculatedTotal
        : null;
  const heroTotalLabel =
    statedTotal != null && statedTotal > 0 ? 'Bid total in notes' : 'Calculated total';
  const statusLine = uniformStatusLabel
    ? uniformStatusLabel
    : partialCount > 0
      ? `${partialCount} item${partialCount === 1 ? '' : 's'} need more pricing`
      : missingPriceCount > 0
        ? `${missingPriceCount} item${missingPriceCount === 1 ? '' : 's'} still need a price`
        : null;

  const confirmRemoveScopeItem = (packageName: string) => {
    Alert.alert(
      'Delete scope item?',
      `Remove “${packageName}” from this draft? You can add it again from Confirm Scope.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (editingPricingFor === packageName) {
              setEditingPricingFor(null);
            }
            setExpandedBudgetSplits((current) => {
              if (!current[packageName]) return current;
              const next = { ...current };
              delete next[packageName];
              return next;
            });
            onRemoveScopeItem?.(packageName);
          },
        },
      ]
    );
  };

  const openScopeRowActions = (params: {
    packageName: string;
    needsPrice: boolean;
    hasAmount: boolean;
    canEditInline: boolean;
    openInlinePricing: () => void;
  }) => {
    if (busy) return;
    const { packageName, needsPrice, hasAmount, canEditInline, openInlinePricing } = params;
    const canPrice = canEditInline || Boolean(onPriceScopeItem);
    const canDelete = Boolean(onRemoveScopeItem);
    if (!canPrice && !canDelete) return;

    const options: string[] = [];
    const actions: Array<() => void> = [];
    if (canPrice && needsPrice) {
      options.push('Add price');
      actions.push(openInlinePricing);
    } else if (canPrice && hasAmount) {
      options.push('Edit price');
      actions.push(openInlinePricing);
    }
    if (canDelete) {
      options.push('Delete');
      actions.push(() => confirmRemoveScopeItem(packageName));
    }
    options.push('Cancel');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: canDelete ? options.indexOf('Delete') : undefined,
          title: packageName,
        },
        (buttonIndex) => {
          if (buttonIndex == null || buttonIndex >= actions.length) return;
          actions[buttonIndex]?.();
        }
      );
      return;
    }

    Alert.alert(
      packageName,
      undefined,
      [
        ...actions.map((action, i) => ({
          text: options[i],
          style: options[i] === 'Delete' ? ('destructive' as const) : ('default' as const),
          onPress: action,
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };

  return (
    <>
      <View style={flowCard(Colors, darkMode)}>
        <View style={{ marginBottom: 4 }}>
          <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
            {getCompactProjectSummary(draft)}
            {scopePackages.length > 0 ? ` · ${scopePackages.length} items` : ''}
          </Text>
          {heroTotal != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <Text style={{ color: '#22c55e', fontSize: 26, fontWeight: '700', letterSpacing: -0.4 }}>
                {formatDraftMoney(heroTotal)}
              </Text>
              {draft.totalMatches === true ? (
                <MaterialIcons name="check-circle" size={16} color="#22c55e" />
              ) : null}
            </View>
          ) : null}
          {heroTotal != null ? (
            <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 2 }}>{heroTotalLabel}</Text>
          ) : null}
          {draft.projectAddress ? (
            <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
              {draft.projectAddress}
            </Text>
          ) : null}
          {draft.estimateConfidence ? (
            <Text
              style={{ color: confStyle.color, fontSize: 11, fontWeight: '600', marginTop: 8 }}
              numberOfLines={2}
            >
              {draft.estimateConfidence.label}
              <Text style={{ color: Colors.sub, fontWeight: '500' }}>
                {' · '}
                {hasPricing
                  ? draft.estimateConfidence.summary
                  : 'Confirm items below, then add or apply pricing.'}
              </Text>
            </Text>
          ) : null}
          {statusLine ? (
            <Text
              style={{
                color: darkMode ? 'rgba(148, 163, 184, 0.85)' : Colors.sub,
                fontSize: 11,
                marginTop: 6,
              }}
            >
              {statusLine}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: flowDivider(darkMode),
            marginTop: 12,
            marginBottom: 2,
          }}
        />

        {visibleScope.map((pkg, index) => {
          const qty = formatScopeQuantity(pkg, draft);
          const amount = compactPackageAmount(pkg, draft);
          const isSoftCost = isSoftCostScopePackage(pkg, draft);
          const resolvedBreakdown = amount ? resolveScopePackageBudgetBreakdown(pkg, draft) : null;
          // Soft costs are flat allowances — never show a fake Material $0 / Labor split.
          const budgetBreakdown = isSoftCost ? null : resolvedBreakdown;
          const statusLabel = compactPackageStatusLabel(pkg, draft);
          const hint = !amount ? scopePackagePricingHint(pkg) : null;
          const needsPrice = scopePackageNeedsManualPrice(pkg, draft);
          const isEditingPricing = editingPricingFor === pkg.name;
          const canEditInline = Boolean(onUpdateScopeBudgetSplit);
          const showBudgetSplit =
            Boolean(budgetBreakdown) &&
            (isEditingPricing || Boolean(expandedBudgetSplits[pkg.name]));
          const editorBreakdown =
            isEditingPricing && canEditInline && !isSoftCost
              ? emptyBudgetBreakdown(pkg, resolvedBreakdown)
              : null;
          const showAllowanceEditor = isEditingPricing && canEditInline && isSoftCost;
          const showStatus =
            !hideRowStatus &&
            amount &&
            pkg.status !== 'user_provided' &&
            pkg.status !== 'confirmed' &&
            statusLabel !== 'Confirmed';
          const openInlinePricing = () => {
            if (canEditInline) {
              setEditingPricingFor(pkg.name);
              if (!isSoftCost) {
                setExpandedBudgetSplits((current) => ({ ...current, [pkg.name]: true }));
              }
              return;
            }
            onPriceScopeItem?.(pkg.name);
          };
          const collapseBudgetSplit = () => {
            setEditingPricingFor((current) => (current === pkg.name ? null : current));
            setExpandedBudgetSplits((current) => {
              if (!current[pkg.name]) return current;
              const next = { ...current };
              delete next[pkg.name];
              return next;
            });
          };
          const toggleBudgetSplit = () => {
            if (!budgetBreakdown) return;
            // Chevron collapse = Done: close budget split and exit inline Material/Labor edit.
            if (isEditingPricing || expandedBudgetSplits[pkg.name]) {
              collapseBudgetSplit();
              return;
            }
            setExpandedBudgetSplits((current) => ({ ...current, [pkg.name]: true }));
          };
          const showRowMenu =
            !isEditingPricing &&
            (Boolean(onRemoveScopeItem) || canEditInline || Boolean(onPriceScopeItem));
          return (
            <Pressable
              key={`scope-${pkg.name}-${index}`}
              onLongPress={
                showRowMenu
                  ? () =>
                      openScopeRowActions({
                        packageName: pkg.name,
                        needsPrice,
                        hasAmount: Boolean(amount),
                        canEditInline,
                        openInlinePricing,
                      })
                  : undefined
              }
              delayLongPress={320}
              style={{
                paddingVertical: 12,
                borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                borderTopColor: flowDivider(darkMode),
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{ color: Colors.text, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 }}
                    numberOfLines={2}
                  >
                    {pkg.name}
                  </Text>
                  {qty ? (
                    <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 3 }}>{qty}</Text>
                  ) : isSoftCost ? (
                    <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 3 }}>Allowance</Text>
                  ) : hint ? (
                    <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 3 }}>{hint}</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', flexShrink: 0, flexDirection: 'row', gap: 2 }}>
                  <View style={{ alignItems: 'flex-end' }}>
                    {amount ? (
                      <TouchableOpacity
                        activeOpacity={budgetBreakdown ? 0.75 : 1}
                        disabled={!budgetBreakdown}
                        onPress={toggleBudgetSplit}
                        accessibilityRole={budgetBreakdown ? 'button' : undefined}
                        accessibilityLabel={
                          budgetBreakdown
                            ? showBudgetSplit
                              ? `Hide budget split for ${pkg.name}`
                              : `Show budget split for ${pkg.name}`
                            : undefined
                        }
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}
                      >
                        <Text
                          style={{
                            color: '#22c55e',
                            fontSize: 15,
                            fontWeight: '600',
                            letterSpacing: -0.2,
                          }}
                        >
                          {amount}
                        </Text>
                        {budgetBreakdown ? (
                          <MaterialIcons
                            name={showBudgetSplit ? 'expand-less' : 'expand-more'}
                            size={18}
                            color="rgba(34, 197, 94, 0.85)"
                          />
                        ) : null}
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={busy || (!canEditInline && !onPriceScopeItem)}
                        onPress={openInlinePricing}
                      >
                        <Text
                          style={{
                            color: needsPrice ? '#fbbf24' : Colors.sub,
                            fontSize: 13,
                            fontWeight: needsPrice ? '600' : '400',
                          }}
                        >
                          {needsPrice ? 'Add price' : statusLabel}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {showStatus ? (
                      <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 2 }}>
                        {statusLabel}
                      </Text>
                    ) : null}
                  </View>
                  {showRowMenu ? (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      disabled={busy}
                      hitSlop={{ top: 10, bottom: 10, left: 8, right: 4 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Actions for ${pkg.name}`}
                      onPress={() =>
                        openScopeRowActions({
                          packageName: pkg.name,
                          needsPrice,
                          hasAmount: Boolean(amount),
                          canEditInline,
                          openInlinePricing,
                        })
                      }
                      style={{ paddingTop: 1, paddingLeft: 2 }}
                    >
                      <MaterialIcons name="more-horiz" size={20} color={Colors.sub} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              {showBudgetSplit && budgetBreakdown ? (
                <ScopeBudgetBreakdownPanel
                  breakdown={budgetBreakdown}
                  Colors={Colors}
                  darkMode={darkMode}
                />
              ) : null}
              {(editorBreakdown || showAllowanceEditor) && onUpdateScopeBudgetSplit ? (
                <>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={busy}
                    onPress={collapseBudgetSplit}
                    style={{ marginTop: 10 }}
                  >
                    <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600' }}>Done</Text>
                  </TouchableOpacity>
                  {showAllowanceEditor ? (
                    <ScopeAllowancePricingEditor
                      packageName={pkg.name}
                      amount={softCostPackageAmount(pkg)}
                      Colors={Colors}
                      darkMode={darkMode}
                      busy={busy}
                      onUpdateScopeBudgetSplit={onUpdateScopeBudgetSplit}
                    />
                  ) : editorBreakdown ? (
                    <ScopeSplitPricingEditor
                      packageName={pkg.name}
                      breakdown={editorBreakdown}
                      Colors={Colors}
                      darkMode={darkMode}
                      busy={busy}
                      onUpdateScopeBudgetSplit={onUpdateScopeBudgetSplit}
                    />
                  ) : null}
                </>
              ) : null}
            </Pressable>
          );
        })}
        {hiddenScopeCount > 0 && !showAllScope ? (
          <TouchableOpacity activeOpacity={0.88} onPress={() => setShowAllScope(true)} style={{ marginTop: 8 }}>
            <Text style={{ color: Colors.sub, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
              Show all {scopePackages.length} items
            </Text>
          </TouchableOpacity>
        ) : null}
        {showAllScope && hiddenScopeCount > 0 ? (
          <TouchableOpacity activeOpacity={0.88} onPress={() => setShowAllScope(false)} style={{ marginTop: 8 }}>
            <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
              Show less
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {showTotalsCard ? (
        <View style={flowCard(Colors, darkMode)}>
          <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 6 }}>
            Totals
          </Text>
          {materialTotal != null ? (
            <PriceRow label="Materials" value={formatDraftMoney(materialTotal)} Colors={Colors} />
          ) : null}
          {laborTotal != null ? (
            <PriceRow label="Labor" value={formatDraftMoney(laborTotal)} Colors={Colors} />
          ) : null}
          {allowanceTotal != null ? (
            <PriceRow label="Allowances" value={formatDraftMoney(allowanceTotal)} Colors={Colors} />
          ) : null}
          {calculatedTotal != null && calculatedTotal > 0 ? (
            <PriceRow label="Total" value={formatDraftMoney(calculatedTotal)} Colors={Colors} highlight />
          ) : null}
          {estimatedBidWithMarkup != null ? (
            <>
              <PriceRow
                label={`Est. bid w/ ${normalizedMarkupPct}% markup`}
                value={formatDraftMoney(estimatedBidWithMarkup)}
                Colors={Colors}
              />
              <Text style={{ color: Colors.sub, fontSize: 11, lineHeight: 16, marginTop: 2 }}>
                Uses your current markup setting. Overhead and project costs on Step 5 may change the final bid.
              </Text>
            </>
          ) : null}
          {statedTotal != null && statedTotal > 0 ? (
            <PriceRow label="In your notes" value={formatDraftMoney(statedTotal)} Colors={Colors} />
          ) : null}
          {draft.totalMatches === true ? (
            <Text style={{ color: '#22c55e', fontSize: 12, marginTop: 4 }}>Totals match your notes.</Text>
          ) : null}
        </View>
      ) : null}

      {roughSuggestionLines.length > 0 || hasRoughOnScope ? (
        <View
          style={{
            ...flowCard(Colors, darkMode),
            borderColor: darkMode ? 'rgba(251, 191, 36, 0.22)' : 'rgba(251, 191, 36, 0.28)',
            backgroundColor: 'transparent',
          }}
        >
          <Text style={{ color: darkMode ? 'rgba(251,191,36,0.9)' : '#d97706', fontSize: 13, fontWeight: '800', marginBottom: 6 }}>
            AI price suggestions
          </Text>
          <Text style={{ color: Colors.sub, fontSize: 12, lineHeight: 18, marginBottom: 8 }}>
            {draft.pricingMemoryMissingMessage ||
              'Rates for items still missing template pricing — review before applying to your bid.'}
          </Text>
          {roughSuggestionLines.map((line, i) => (
            <Text key={`sug-${i}`} style={{ color: Colors.text, fontSize: 12, marginBottom: 4 }}>
              • {line}
            </Text>
          ))}
        </View>
      ) : null}

      <View
        style={{
          marginTop: 4,
          marginBottom: showDetails ? 10 : 4,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <TouchableOpacity activeOpacity={0.88} onPress={() => setShowDetails((v) => !v)}>
          <Text style={{ color: Colors.sub, fontSize: 13, fontWeight: '600' }}>
            {showDetails ? 'Hide details' : 'View details'}
          </Text>
        </TouchableOpacity>
        <Text style={{ color: flowDivider(darkMode), fontSize: 13 }}>·</Text>
        <TouchableOpacity activeOpacity={0.88} disabled={busy} onPress={onRegenerate}>
          <Text style={{ color: Colors.sub, fontSize: 13, fontWeight: '600' }}>
            Edit notes
          </Text>
        </TouchableOpacity>
      </View>

      {showDetails ? showDetailsContent : null}
    </>
  );
}

const styles = StyleSheet.create({
  pricingInputCard: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
  },
  pricingInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rateChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  rateModeToggle: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pricingInputRow: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pricingCurrency: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    includeFontPadding: false,
  },
  pricingInput: {
    flex: 1,
    margin: 0,
    paddingHorizontal: 0,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    ...(Platform.OS === 'android'
      ? { textAlignVertical: 'center' as const, includeFontPadding: false }
      : null),
  },
  pricingUnitSuffix: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 20,
    minWidth: 44,
    includeFontPadding: false,
  },
});
