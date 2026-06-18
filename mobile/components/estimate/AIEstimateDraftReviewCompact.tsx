import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  TextInput,
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
  getCompactStillNeeded,
  getUniformStatusLabel,
  pendingProposalCalculatedTotal,
  resolveScopePackageBudgetBreakdown,
  type ScopePackageBudgetBreakdown,
  scopePackageNeedsManualPrice,
  scopePackagePricingHint,
  SCOPE_LIST_DEFAULT_LIMIT,
  shouldHidePerRowStatus,
} from '@/utils/estimateDraftReviewUi';
import { draftHasApplyablePricing } from '@/utils/estimateAiDraftPricing';
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
  onSuggestMissingPrices?: () => void;
  suggestingMissingPrices?: boolean;
  onPriceScopeItem?: (packageName: string) => void;
  onUpdateScopeBudgetSplit?: (
    packageName: string,
    material: number,
    labor: number,
    basis?: ScopePackageBudgetBreakdown['basis']
  ) => void;
  markupPct?: number;
  onRegenerate: () => void;
  showDetailsContent: React.ReactNode;
};

const SCOPE_CARD_INSET = 14;
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
        <Text style={{ color: Colors.sub, fontSize: 15, fontWeight: '700' }}>$</Text>
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
          <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600', minWidth: 44 }}>
            /{unitLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
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
  const handleMaterialChange = (material: number) => {
    onUpdateScopeBudgetSplit(packageName, material, breakdown.labor, breakdown.basis);
  };
  const handleLaborChange = (labor: number) => {
    onUpdateScopeBudgetSplit(packageName, breakdown.material, labor, breakdown.basis);
  };
  return (
    <View style={{ marginTop: 8 }}>
      <ScopeSplitPricingInput
        label="Material"
        amount={breakdown.material}
        basis={breakdown.basis}
        Colors={Colors}
        darkMode={darkMode}
        busy={busy}
        onAmountChange={handleMaterialChange}
      />
      <ScopeSplitPricingInput
        label="Labor"
        amount={breakdown.labor}
        basis={breakdown.basis}
        Colors={Colors}
        darkMode={darkMode}
        busy={busy}
        onAmountChange={handleLaborChange}
      />
    </View>
  );
}

export default function AIEstimateDraftReviewCompact({
  draft,
  Colors,
  darkMode,
  busy,
  confStyle,
  onSuggestMissingPrices,
  suggestingMissingPrices,
  onPriceScopeItem,
  onUpdateScopeBudgetSplit,
  markupPct = 0,
  onRegenerate,
  showDetailsContent,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const [showAllScope, setShowAllScope] = useState(false);
  const [editingPricingFor, setEditingPricingFor] = useState<string | null>(null);
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
  const stillNeeded = getCompactStillNeeded(draft, 5);
  const hasPricing = draftHasApplyablePricing(draft);
  const statedTotal = draft.statedTotal ?? draft.totalValidation?.statedTotal;
  const pendingTotal = pendingProposalCalculatedTotal(draft);
  const calculatedTotal =
    draft.calculatedLineItemTotal ??
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
  const showSuggestPrices = Boolean(onSuggestMissingPrices && (missingPriceCount > 0 || partialCount > 0));
  const roughSuggestionLines = dedupeMissingPriceSuggestions(
    draft.pricingMemoryMissingSuggestions || [],
    6
  );
  const hasRoughOnScope = scopePackages.some((p) => p.status === 'rough_price');
  const scopeBudgetTotals = scopePackages.reduce(
    (sum, pkg) => {
      const breakdown = resolveScopePackageBudgetBreakdown(pkg, draft);
      if (!breakdown) return sum;
      return {
        material: sum.material + breakdown.material,
        labor: sum.labor + breakdown.labor,
        coveredTotal: sum.coveredTotal + breakdown.total,
      };
    },
    { material: 0, labor: 0, coveredTotal: 0 }
  );
  const materialTotal =
    scopeBudgetTotals.material > 0
      ? roundedMoney(scopeBudgetTotals.material)
      : draft.totalValidation?.materialsTotal ?? draft.calculatedMaterialTotal;
  const laborTotal =
    scopeBudgetTotals.labor > 0
      ? roundedMoney(scopeBudgetTotals.labor)
      : draft.totalValidation?.laborTotal ?? draft.calculatedLaborTotal;
  const directSubtotal =
    calculatedTotal != null && calculatedTotal > 0
      ? calculatedTotal
      : materialTotal != null && laborTotal != null
        ? roundedMoney(materialTotal + laborTotal)
        : null;
  const normalizedMarkupPct = Math.max(0, Number(markupPct) || 0);
  const estimatedBidWithMarkup =
    directSubtotal != null && directSubtotal > 0 && normalizedMarkupPct > 0
      ? roundedMoney(directSubtotal * (1 + normalizedMarkupPct / 100))
      : null;
  const showTotalsCard = (calculatedTotal != null && calculatedTotal > 0) || statedTotal != null;

  return (
    <>
      {draft.estimateConfidence ? (
        <View
          style={{
            ...flowCard(Colors, darkMode),
            backgroundColor: confStyle.bg,
          }}
        >
          <Text style={{ color: confStyle.color, fontSize: 13, fontWeight: '800' }}>
            {draft.estimateConfidence.label}
          </Text>
          <Text style={{ color: Colors.text, fontSize: 13, marginTop: 4, lineHeight: 18 }} numberOfLines={2}>
            {hasPricing
              ? draft.estimateConfidence.summary
              : 'Scope and quantities found. Confirm items below, then add or apply pricing.'}
          </Text>
        </View>
      ) : null}

      <View style={flowCard(Colors, darkMode)}>
        <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800', marginBottom: 4 }}>
          {getCompactProjectSummary(draft)}
        </Text>
        {draft.projectAddress ? (
          <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 4 }} numberOfLines={1}>
            {draft.projectAddress}
          </Text>
        ) : null}
        {statedTotal != null && statedTotal > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Text style={{ color: Colors.sub, fontSize: 13 }}>Bid total in notes:</Text>
            <Text style={{ color: '#22c55e', fontSize: 15, fontWeight: '800' }}>
              {formatDraftMoney(statedTotal)}
            </Text>
            {draft.totalMatches === true ? (
              <MaterialIcons name="check-circle" size={16} color="#22c55e" />
            ) : null}
          </View>
        ) : calculatedTotal != null && calculatedTotal > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Text style={{ color: Colors.sub, fontSize: 13 }}>Calculated total:</Text>
            <Text style={{ color: '#22c55e', fontSize: 15, fontWeight: '800' }}>
              {formatDraftMoney(calculatedTotal)}
            </Text>
          </View>
        ) : null}
        {uniformStatusLabel ? (
          <Text style={{ color: '#60a5fa', fontSize: 12, marginTop: 6 }}>{uniformStatusLabel}</Text>
        ) : partialCount > 0 ? (
          <Text style={{ color: '#60a5fa', fontSize: 12, marginTop: 6 }}>
            {partialCount} item{partialCount === 1 ? '' : 's'} need more pricing
          </Text>
        ) : null}
      </View>

      <View style={flowCard(Colors, darkMode)}>
        <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 10 }}>
          Scope ({scopePackages.length})
        </Text>
        {missingPriceCount > 0 ? (
          <Text style={{ color: Colors.sub, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
            Tap any <Text style={{ fontWeight: '700', color: '#fbbf24' }}>Needs price</Text> item to
            enter a price before applying.
          </Text>
        ) : null}
        {visibleScope.map((pkg, index) => {
          const qty = formatScopeQuantity(pkg);
          const amount = compactPackageAmount(pkg, draft);
          const budgetBreakdown = amount ? resolveScopePackageBudgetBreakdown(pkg, draft) : null;
          const statusLabel = compactPackageStatusLabel(pkg, draft);
          const hint = !amount ? scopePackagePricingHint(pkg) : null;
          const needsPrice = scopePackageNeedsManualPrice(pkg, draft);
          const showStatus =
            !hideRowStatus &&
            amount &&
            pkg.status !== 'user_provided' &&
            pkg.status !== 'confirmed' &&
            statusLabel !== 'Confirmed';
          const rowBody = (
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Text style={{ color: Colors.sub, fontSize: 13, width: 20 }}>{index + 1}.</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }} numberOfLines={2}>
                    {pkg.name}
                  </Text>
                  {qty ? (
                    <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 2 }}>{qty}</Text>
                  ) : hint ? (
                    <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 2 }}>{hint}</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', flexShrink: 0, marginLeft: 8 }}>
                  {amount ? (
                    <Text style={{ color: '#22c55e', fontSize: 14, fontWeight: '800' }}>{amount}</Text>
                  ) : (
                    <Text
                      style={{
                        color: needsPrice ? '#fbbf24' : Colors.sub,
                        fontSize: 12,
                        fontWeight: needsPrice ? '700' : '400',
                      }}
                    >
                      {statusLabel}
                    </Text>
                  )}
                  {showStatus ? (
                    <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 2 }}>{statusLabel}</Text>
                  ) : null}
                </View>
              </View>
              {budgetBreakdown ? (
                <ScopeBudgetBreakdownPanel breakdown={budgetBreakdown} Colors={Colors} darkMode={darkMode} />
              ) : null}
              {budgetBreakdown && onUpdateScopeBudgetSplit ? (
                editingPricingFor === pkg.name ? (
                  <>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      disabled={busy}
                      onPress={() => setEditingPricingFor(null)}
                      style={{ marginTop: 12 }}
                    >
                      <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '700' }}>
                        Tap card to collapse
                      </Text>
                    </TouchableOpacity>
                    <ScopeSplitPricingEditor
                      packageName={pkg.name}
                      breakdown={budgetBreakdown}
                      Colors={Colors}
                      darkMode={darkMode}
                      busy={busy}
                      onUpdateScopeBudgetSplit={onUpdateScopeBudgetSplit}
                    />
                  </>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={busy}
                    onPress={() => setEditingPricingFor(pkg.name)}
                    style={{ marginTop: 12 }}
                  >
                    <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '700' }}>Edit pricing</Text>
                  </TouchableOpacity>
                )
              ) : null}
              {needsPrice ? (
                <Text style={{ color: '#60a5fa', fontSize: 11, marginTop: 4, fontWeight: '600' }}>
                  Tap to add price
                </Text>
              ) : null}
            </View>
          );
          return needsPrice && onPriceScopeItem ? (
            <TouchableOpacity
              key={`scope-${pkg.name}-${index}`}
              activeOpacity={0.88}
              disabled={busy}
              onPress={() => onPriceScopeItem(pkg.name)}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                marginHorizontal: -SCOPE_CARD_INSET,
                paddingHorizontal: SCOPE_CARD_INSET,
                paddingVertical: 10,
                borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                borderTopColor: flowDivider(darkMode),
                backgroundColor: darkMode ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.06)',
              }}
            >
              {rowBody}
            </TouchableOpacity>
          ) : (
            <View
              key={`scope-${pkg.name}-${index}`}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                paddingVertical: 10,
                borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                borderTopColor: flowDivider(darkMode),
              }}
            >
              {rowBody}
            </View>
          );
        })}
        {hiddenScopeCount > 0 && !showAllScope ? (
          <TouchableOpacity activeOpacity={0.88} onPress={() => setShowAllScope(true)} style={{ marginTop: 8 }}>
            <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
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
            borderColor: 'rgba(251, 191, 36, 0.35)',
            backgroundColor: darkMode ? 'rgba(251, 191, 36, 0.08)' : 'rgba(251, 191, 36, 0.06)',
          }}
        >
          <Text style={{ color: '#fbbf24', fontSize: 13, fontWeight: '800', marginBottom: 6 }}>
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

      {stillNeeded.items.length > 0 ? (
        <View style={flowCard(Colors, darkMode)}>
          <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>
            Still needed
          </Text>
          {stillNeeded.items
            .filter((item) => !/finish pricing on partial scope/i.test(item))
            .map((item, i) => (
              <Text key={`need-${i}`} style={{ color: Colors.sub, fontSize: 13, marginBottom: 4, lineHeight: 18 }}>
                • {item}
              </Text>
            ))}
          {stillNeeded.overflow > 0 ? (
            <Text style={{ color: '#60a5fa', fontSize: 12, marginTop: 2 }}>
              + {stillNeeded.overflow} more in details
            </Text>
          ) : null}
        </View>
      ) : null}

      {showSuggestPrices ? (
        <TouchableOpacity
          activeOpacity={0.88}
          disabled={busy}
          onPress={onSuggestMissingPrices}
          style={{
            marginBottom: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#60a5fa',
            opacity: busy ? 0.5 : 1,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {suggestingMissingPrices ? (
              <ActivityIndicator size="small" color="#60a5fa" />
            ) : (
              <MaterialIcons name="lightbulb-outline" size={16} color="#60a5fa" />
            )}
            <Text style={{ color: '#60a5fa', fontSize: 14, fontWeight: '700' }}>Suggest missing prices</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => setShowDetails((v) => !v)}
        style={{ marginBottom: showDetails ? 10 : 4, alignItems: 'center' }}
      >
        <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '700' }}>
          {showDetails ? 'Hide details' : 'View details'}
        </Text>
      </TouchableOpacity>

      {showDetails ? showDetailsContent : null}

      <TouchableOpacity activeOpacity={0.88} disabled={busy} onPress={onRegenerate} style={{ marginTop: 8 }}>
        <Text style={{ color: Colors.sub, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
          Edit notes & regenerate
        </Text>
      </TouchableOpacity>
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
    gap: 8,
  },
  pricingInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
  },
});
