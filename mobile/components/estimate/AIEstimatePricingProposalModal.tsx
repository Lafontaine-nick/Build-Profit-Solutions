import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import type { PricingProposal, PricingScopeItemProposal } from '@/utils/estimateAiDraftPricing';
import { sourceBadgeColor, sourceDisplayLabel } from '@/utils/estimateAiDraftPricing';
import { formatDraftMoney } from '@/utils/estimateAiDraft';

type Props = {
  visible: boolean;
  proposal: PricingProposal | null;
  title: string;
  subtitle: string;
  applyLabel: string;
  onApply: () => void;
  onEdit?: () => void;
  onAddManually?: () => void;
  onClose: () => void;
};

const COMPARISON_KEYS = [
  'saved_pricing',
  'saved_template',
  'company_default',
  'supplier_pricing',
  'national_trade_average',
  'construction_cost_database',
  'ai_rough_estimate_fallback',
] as const;

function ComparisonCard({
  item,
  Colors,
  darkMode,
}: {
  item: PricingScopeItemProposal;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  const rec = item.recommended;
  const qtyLabel =
    item.quantity != null ? `${item.quantity.toLocaleString()} ${item.unit}` : '—';

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
          backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : Colors.surface2,
        },
      ]}
    >
      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }}>{item.scopeName}</Text>
      <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 2, marginBottom: 8 }}>
        Quantity: {qtyLabel}
      </Text>

      <Text style={{ color: Colors.sub, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
        Pricing comparison
      </Text>
      {COMPARISON_KEYS.map((key) => {
        const row = item.comparison?.[key];
        if (!row) return null;
        return (
          <Text key={key} style={{ color: Colors.sub, fontSize: 11, marginBottom: 2 }}>
            • {row.label}: {row.available ? row.summary : 'not found'}
          </Text>
        );
      })}

      {rec && (item.proposedRates?.length ?? 0) > 0 ? (
        <View
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: Colors.line,
          }}
        >
          <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '800' }}>Recommended</Text>
          {item.proposedRates!.map((line, i) => (
            <View key={`pr-${i}`} style={{ marginTop: 6 }}>
              <Text style={{ color: Colors.text, fontSize: 13 }}>{line.label}</Text>
              {line.formula ? (
                <Text style={{ color: Colors.sub, fontSize: 12 }}>{line.formula}</Text>
              ) : null}
              <Text
                style={{
                  color: sourceBadgeColor(line.source),
                  fontSize: 11,
                  fontWeight: '700',
                  marginTop: 2,
                }}
              >
                Source: {sourceDisplayLabel(line.source)}
              </Text>
              <Text style={{ color: Colors.sub, fontSize: 10 }}>
                Confidence: {line.confidence} · Approval required
              </Text>
              {(line.assumptions || []).map((a, j) => (
                <Text key={`as-${i}-${j}`} style={{ color: Colors.sub, fontSize: 10, marginTop: 2, lineHeight: 14 }}>
                  {a}
                </Text>
              ))}
            </View>
          ))}
          <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 6, lineHeight: 16 }}>
            {rec.reason}
          </Text>
        </View>
      ) : rec && item.comparison?.saved_template?.available ? (
        <View
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: Colors.line,
          }}
        >
          <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '800' }}>Recommended</Text>
          <Text style={{ color: Colors.text, fontSize: 13, marginTop: 6 }}>
            {item.comparison.saved_template.summary}
          </Text>
          <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 6, lineHeight: 16 }}>
            {rec.reason}
          </Text>
        </View>
      ) : null}

      {(item.warnings || []).map((w, i) => (
        <Text key={`w-${i}`} style={{ color: '#fbbf24', fontSize: 11, marginTop: 6 }}>
          {w}
        </Text>
      ))}
    </View>
  );
}

export default function AIEstimatePricingProposalModal({
  visible,
  proposal,
  title,
  subtitle,
  applyLabel,
  onApply,
  onEdit,
  onAddManually,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = getColors(theme);

  if (!visible || !proposal) return null;

  const useEngineCards = (proposal.scopeItems?.length ?? 0) > 0;
  const byPackage = new Map<string, typeof proposal.lines>();
  if (!useEngineCards) {
    for (const line of proposal.lines) {
      const list = byPackage.get(line.packageName) || [];
      list.push(line);
      byPackage.set(line.packageName, list);
    }
  }

  const headerSource = proposal.anyFallbackOnly
    ? 'AI Rough Estimate Fallback'
    : proposal.sourceLabel;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.shell, { backgroundColor: Colors.bg, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors.text }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={{ color: Colors.sub, fontSize: 22 }}>×</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: Colors.sub, fontSize: 13, paddingHorizontal: 16, marginBottom: 8 }}>
          {subtitle}
        </Text>
        {!proposal.empty ? (
          <Text
            style={{
              color: sourceBadgeColor(proposal.anyFallbackOnly ? 'ai_rough_estimate_fallback' : 'saved_pricing'),
              fontSize: 12,
              fontWeight: '800',
              paddingHorizontal: 16,
              marginBottom: 8,
            }}
          >
            Primary source: {headerSource}
          </Text>
        ) : null}

        {proposal.empty ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800', marginBottom: 8 }}>
              No saved pricing found yet
            </Text>
            <Text style={{ color: Colors.sub, fontSize: 14, lineHeight: 20 }}>
              {proposal.message ||
                'You have not saved pricing for this scope yet. Add prices manually or request suggested pricing.'}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>
            {proposal.anyFallbackOnly && !proposal.anyRealSource ? (
              <Text
                style={{
                  color: '#fbbf24',
                  fontSize: 12,
                  lineHeight: 18,
                  marginBottom: 12,
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: darkMode ? 'rgba(251,191,36,0.1)' : 'rgba(251,191,36,0.08)',
                }}
              >
                No saved pricing or live pricing source was found. These are AI fallback assumptions
                for planning only.
              </Text>
            ) : null}

            {useEngineCards
              ? proposal.scopeItems!.map((item) => (
                  <ComparisonCard key={item.scopeItemId} item={item} Colors={Colors} darkMode={darkMode} />
                ))
              : [...byPackage.entries()].map(([pkgName, lines]) => (
                  <View
                    key={pkgName}
                    style={[
                      styles.card,
                      {
                        borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
                        backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : Colors.surface2,
                      },
                    ]}
                  >
                    <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800', marginBottom: 8 }}>
                      {pkgName}
                    </Text>
                    {lines.map((line, i) => (
                      <View key={`${pkgName}-${i}`} style={{ marginBottom: 6 }}>
                        <Text style={{ color: Colors.text, fontSize: 13 }}>{line.label}</Text>
                        <Text style={{ color: Colors.sub, fontSize: 12 }}>{line.formula}</Text>
                        <Text
                          style={{
                            color: sourceBadgeColor(line.priceSource),
                            fontSize: 11,
                            fontWeight: '700',
                          }}
                        >
                          Source: {sourceDisplayLabel(line.priceSource)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}

            <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800', marginTop: 8 }}>
              Total suggested: {formatDraftMoney(proposal.totalSuggested)}
            </Text>
            {(proposal.assumptions || []).map((a, i) => (
              <Text key={`a-${i}`} style={{ color: Colors.sub, fontSize: 11, marginTop: 4 }}>
                • {a}
              </Text>
            ))}
            {proposal.disclaimer ? (
              <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 8, lineHeight: 16 }}>
                {proposal.disclaimer}
              </Text>
            ) : null}
          </ScrollView>
        )}

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {!proposal.empty ? (
            <>
              <TouchableOpacity style={styles.primaryBtn} onPress={onApply}>
                <Text style={styles.primaryBtnText}>{applyLabel}</Text>
              </TouchableOpacity>
              {onEdit ? (
                <TouchableOpacity style={styles.secondaryBtn} onPress={onEdit}>
                  <Text style={{ color: Colors.text, fontWeight: '700' }}>Edit rates first</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : onAddManually ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={onAddManually}>
              <Text style={styles.primaryBtnText}>Add prices manually</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: Colors.sub, fontWeight: '700', textAlign: 'center' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 18, fontWeight: '800', flex: 1 },
  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
});
