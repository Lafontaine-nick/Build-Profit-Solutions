import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { RateCalibrationSuggestion } from '@/utils/estimateFeedback';
import {
  approveCloseoutCalibration,
  submitCloseoutCalibration,
  type CloseoutCalibrationResult,
} from '@/utils/contractorPricingMemory';
import {
  canPerformBuildWithAiAction,
  DEFAULT_BUILD_WITH_AI_FEATURE_FLAGS,
  type BuildWithAiRole,
} from '@/utils/buildWithAiProductionHardening';

export type CalibrationReviewSuggestion = {
  suggestionId: string;
  scopeItemName: string;
  trade?: string;
  category?: string;
  unit?: string;
  currentRate?: number | null;
  suggestedRate: number;
  variancePct?: number | null;
  confidence?: string;
  message?: string;
  reason?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  projectLike: Record<string, unknown> | null | undefined;
  /** Client-side tips from Budget estimateFeedback (optional seed). */
  clientSuggestions?: RateCalibrationSuggestion[];
  /** owner → owner role; cost_control → manager */
  budgetAccessMode?: 'owner' | 'cost_control';
  darkMode?: boolean;
  onApproved?: (count: number) => void;
};

function mapClientSuggestion(s: RateCalibrationSuggestion): CalibrationReviewSuggestion {
  return {
    suggestionId: s.key,
    scopeItemName: String(s.scopeKey || s.key),
    trade: s.trade,
    unit: String(s.unit || 'unit'),
    currentRate: s.currentRate ?? null,
    suggestedRate: s.suggestedRate,
    confidence: s.confidence,
    reason: s.reason,
    message: `Update saved rate for ${s.scopeKey} to $${s.suggestedRate}/${s.unit || 'unit'} (${s.reason.replace(/_/g, ' ')}).`,
  };
}

function mapServerSuggestion(raw: Record<string, unknown>): CalibrationReviewSuggestion {
  return {
    suggestionId: String(raw.suggestionId || raw.key || ''),
    scopeItemName: String(raw.scopeItemName || raw.scopeKey || 'Scope item'),
    trade: raw.trade != null ? String(raw.trade) : undefined,
    category: raw.category != null ? String(raw.category) : undefined,
    unit: raw.unit != null ? String(raw.unit) : 'unit',
    currentRate: raw.currentRate != null ? Number(raw.currentRate) : null,
    suggestedRate: Number(raw.suggestedRate) || 0,
    variancePct: raw.variancePct != null ? Number(raw.variancePct) : null,
    confidence: raw.confidence != null ? String(raw.confidence) : undefined,
    message: raw.message != null ? String(raw.message) : undefined,
    reason: raw.reason != null ? String(raw.reason) : undefined,
  };
}

function formatRate(rate: number | null | undefined, unit?: string) {
  if (rate == null || !Number.isFinite(rate)) return '—';
  const u = unit || 'unit';
  return `$${rate}/${u}`;
}

export default function CalibrationReviewModal({
  visible,
  onClose,
  projectLike,
  clientSuggestions = [],
  budgetAccessMode = 'owner',
  darkMode = true,
  onApproved,
}: Props) {
  const role: BuildWithAiRole = budgetAccessMode === 'owner' ? 'owner' : 'manager';
  const canApprove =
    DEFAULT_BUILD_WITH_AI_FEATURE_FLAGS.calibrationApproval &&
    canPerformBuildWithAiAction(role, 'approve_calibration');

  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [closeout, setCloseout] = useState<CloseoutCalibrationResult | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    const fromServer = (closeout?.rateSuggestions || []).map((s) =>
      mapServerSuggestion(s as Record<string, unknown>)
    );
    const serverIds = new Set(fromServer.map((s) => s.suggestionId));
    const fromClient = clientSuggestions
      .map(mapClientSuggestion)
      .filter((s) => s.suggestionId && !serverIds.has(s.suggestionId));
    return [...fromServer, ...fromClient].filter((s) => s.suggestedRate > 0);
  }, [closeout, clientSuggestions]);

  const load = useCallback(async () => {
    if (!projectLike?.id && !(projectLike as any)?.projectData) {
      setError('No project loaded.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await submitCloseoutCalibration(projectLike);
      setCloseout(result);
      const ids = (result.rateSuggestions || []).map((s) =>
        String((s as Record<string, unknown>).suggestionId || '')
      );
      const next: Record<string, boolean> = {};
      for (const id of ids) {
        if (id) next[id] = true;
      }
      // Pre-select client tips too when server returned none
      if (!ids.length) {
        for (const s of clientSuggestions) {
          next[s.key] = true;
        }
      }
      setSelected(next);
      if (result.success === false && result.message) {
        setError(result.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load calibration tips');
    } finally {
      setLoading(false);
    }
  }, [projectLike, clientSuggestions]);

  useEffect(() => {
    if (visible) {
      void load();
    } else {
      setCloseout(null);
      setSelected({});
      setError(null);
    }
  }, [visible, load]);

  const selectedList = suggestions.filter((s) => selected[s.suggestionId]);

  const toggle = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const onApprove = async () => {
    if (!canApprove) {
      Alert.alert('Permission needed', 'Only managers and owners can approve rate updates.');
      return;
    }
    if (!selectedList.length) {
      Alert.alert('Nothing selected', 'Select at least one rate tip to apply.');
      return;
    }
    setApproving(true);
    try {
      const res = await approveCloseoutCalibration({
        suggestions: selectedList.map((s) => ({
          suggestionId: s.suggestionId,
          scopeItemName: s.scopeItemName,
          trade: s.trade,
          category: s.category,
          unit: s.unit,
          currentRate: s.currentRate,
          suggestedRate: s.suggestedRate,
          reason: s.reason,
        })),
        suggestionIds: selectedList.map((s) => s.suggestionId),
        role,
      });
      Alert.alert(
        'Rates updated',
        res.message || `Updated ${res.approved} saved rate${res.approved === 1 ? '' : 's'}.`
      );
      onApproved?.(res.approved);
      onClose();
    } catch (e) {
      Alert.alert('Could not apply', e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setApproving(false);
    }
  };

  const bg = darkMode ? '#0B1220' : '#F8FAFC';
  const card = darkMode ? '#111827' : '#FFFFFF';
  const text = darkMode ? '#F8FAFC' : '#0F172A';
  const muted = darkMode ? 'rgba(248,250,252,0.62)' : '#64748B';
  const line = darkMode ? 'rgba(148,163,184,0.2)' : '#E2E8F0';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: bg }]}>
        <View style={[styles.header, { borderBottomColor: line }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: text }]}>Review rate tips</Text>
            <Text style={[styles.subtitle, { color: muted }]}>
              From this job’s actual costs. Nothing changes until you approve.
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <MaterialIcons name="close" size={24} color={muted} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#22c55e" />
            <Text style={[styles.subtitle, { color: muted, marginTop: 12 }]}>Comparing estimate vs actual…</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {closeout?.summary ? (
              <View style={[styles.summaryCard, { backgroundColor: card, borderColor: line }]}>
                <Text style={[styles.summaryLabel, { color: muted }]}>This close-out</Text>
                <Text style={[styles.summaryValue, { color: text }]}>
                  {String(closeout.status || '').replace(/_/g, ' ')}
                  {closeout.summary.overallVariancePct != null
                    ? ` · ${Number(closeout.summary.overallVariancePct) > 0 ? '+' : ''}${closeout.summary.overallVariancePct}% vs estimate`
                    : ''}
                </Text>
                {closeout.message ? (
                  <Text style={[styles.summaryHint, { color: muted }]}>{closeout.message}</Text>
                ) : null}
              </View>
            ) : null}

            {error ? (
              <Text style={[styles.error, { color: '#fbbf24' }]}>{error}</Text>
            ) : null}

            {!suggestions.length ? (
              <View style={[styles.emptyCard, { backgroundColor: card, borderColor: line }]}>
                <MaterialIcons name="check-circle" size={28} color="#22c55e" />
                <Text style={[styles.emptyTitle, { color: text }]}>No rate changes suggested</Text>
                <Text style={[styles.summaryHint, { color: muted, textAlign: 'center' }]}>
                  Actuals were recorded when available. Add more expenses linked to budget categories to get tips.
                </Text>
              </View>
            ) : (
              suggestions.map((s) => {
                const on = !!selected[s.suggestionId];
                return (
                  <Pressable
                    key={s.suggestionId}
                    onPress={() => toggle(s.suggestionId)}
                    style={[
                      styles.tipCard,
                      {
                        backgroundColor: card,
                        borderColor: on ? '#22c55e' : line,
                      },
                    ]}
                  >
                    <View style={styles.tipRow}>
                      <MaterialIcons
                        name={on ? 'check-box' : 'check-box-outline-blank'}
                        size={22}
                        color={on ? '#22c55e' : muted}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.tipTitle, { color: text }]} numberOfLines={2}>
                          {s.scopeItemName}
                        </Text>
                        <Text style={[styles.tipRates, { color: muted }]}>
                          {formatRate(s.currentRate, s.unit)} → {formatRate(s.suggestedRate, s.unit)}
                          {s.variancePct != null
                            ? `  (${s.variancePct > 0 ? '+' : ''}${s.variancePct}%)`
                            : ''}
                        </Text>
                        {s.message ? (
                          <Text style={[styles.tipMsg, { color: muted }]}>{s.message}</Text>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        )}

        <View style={[styles.footer, { borderTopColor: line, backgroundColor: bg }]}>
          {!canApprove ? (
            <Text style={[styles.summaryHint, { color: muted, marginBottom: 8 }]}>
              Viewing only — ask a manager or owner to approve rate updates.
            </Text>
          ) : null}
          <Pressable
            onPress={onApprove}
            disabled={!canApprove || approving || !selectedList.length}
            style={[
              styles.approveBtn,
              {
                opacity: !canApprove || approving || !selectedList.length ? 0.45 : 1,
              },
            ]}
          >
            {approving ? (
              <ActivityIndicator color="#04140C" />
            ) : (
              <Text style={styles.approveText}>
                Approve {selectedList.length || 0} rate{selectedList.length === 1 ? '' : 's'}
              </Text>
            )}
          </Pressable>
          <Pressable onPress={onClose} style={styles.dismissBtn}>
            <Text style={[styles.dismissText, { color: muted }]}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  scroll: { padding: 16, paddingBottom: 28, gap: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
  },
  summaryLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryValue: { fontSize: 15, fontWeight: '600', marginTop: 4, textTransform: 'capitalize' },
  summaryHint: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  error: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  tipCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
  },
  tipRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipTitle: { fontSize: 15, fontWeight: '700' },
  tipRates: { fontSize: 13, marginTop: 4, fontWeight: '600' },
  tipMsg: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  approveBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveText: { color: '#04140C', fontSize: 16, fontWeight: '800' },
  dismissBtn: { alignItems: 'center', paddingVertical: 12 },
  dismissText: { fontSize: 14, fontWeight: '600' },
});
