import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BenchmarkComparableProject } from '@/utils/benchmarkEngine';
import { formatDisplayMoneyNearest100, measurementSemanticsV1Enabled } from '@/utils/measurementSemantics';

type Props = {
  visible: boolean;
  onClose: () => void;
  detached: BenchmarkComparableProject[];
  twinHomes: BenchmarkComparableProject[];
  darkMode: boolean;
  scopeName?: string | null;
  livingSf?: number | null;
};

function money(value: number | null | undefined): string {
  return value == null ? 'Not available' : `$${Math.round(value).toLocaleString()}`;
}

function enrichProject(
  project: BenchmarkComparableProject,
  scopeName: string | null | undefined,
  livingSf: number | null | undefined
): BenchmarkComparableProject {
  const exact =
    project.exactSourceMatch === true ||
    project.similarityReasons.some((r) => /living area within 0%/i.test(r)) ||
    (livingSf != null &&
      Number.isFinite(livingSf) &&
      livingSf > 0 &&
      Math.abs(Number(project.livingSf) - Number(livingSf)) / livingSf < 0.005);
  const perSf =
    project.scopeCostPerLivingSf != null
      ? project.scopeCostPerLivingSf
      : project.scopeCost != null && project.livingSf > 0
        ? project.scopeCost / project.livingSf
        : null;
  return {
    ...project,
    scopeName: project.scopeName || scopeName || null,
    scopeCostPerLivingSf: perSf,
    exactSourceMatch: exact,
  };
}

function ComparableRow({
  project,
  darkMode,
  scopeName,
}: {
  project: BenchmarkComparableProject;
  darkMode: boolean;
  scopeName?: string | null;
}) {
  const text = darkMode ? '#f8fafc' : '#0f172a';
  const sub = darkMode ? '#94a3b8' : '#64748b';
  const label = project.scopeName || scopeName || 'Source budget line';
  const perSf =
    project.scopeCostPerLivingSf != null
      ? `$${project.scopeCostPerLivingSf.toFixed(2)} per living SF`
      : null;
  const garageBit =
    project.garageSf != null
      ? `${Number(project.garageSf).toLocaleString()} garage SF`
      : null;
  const storiesBit = project.stories != null ? `${project.stories} stor${project.stories === 1 ? 'y' : 'ies'}` : null;
  const patioBit =
    project.patioPorchSf != null && project.livingSf > 0
      ? `${Math.round((Number(project.patioPorchSf) / project.livingSf) * 100)}% patio ratio`
      : null;

  return (
    <View style={[styles.row, { borderBottomColor: darkMode ? '#263242' : '#e2e8f0' }]}>
      <View style={styles.rowHeader}>
        <Text style={[styles.name, { color: text }]}>{project.name}</Text>
        <Text style={[styles.score, { color: '#0f766e' }]}>{project.similarityScore}% match</Text>
      </View>
      {project.exactSourceMatch ? (
        <Text style={[styles.exact, { color: '#0f766e' }]}>Exact benchmark source match</Text>
      ) : null}
      <Text style={[styles.detail, { color: sub }]}>
        {project.buildingType.replace(/_/g, ' ')} · {project.livingSf.toLocaleString()} living SF
        {storiesBit ? ` · ${storiesBit}` : ''}
        {garageBit ? ` · ${garageBit}` : ''}
        {patioBit ? ` · ${patioBit}` : ''}
      </Text>
      <Text style={[styles.detail, { color: text, fontWeight: '700' }]}>
        {label} cost: {money(project.scopeCost)}
        {perSf ? ` · ${perSf}` : ''}
      </Text>
      <Text style={[styles.detail, { color: sub }]}>
        Preliminary build budget {formatDisplayMoneyNearest100(project.preliminaryBuildCostPerHome)}
        {project.sourceStatus ? ` · ${project.sourceStatus}` : ''}
      </Text>
      {project.similarityReasons
        .filter((reason) => !/unknown|incomplete|limited/i.test(reason))
        .slice(0, 6)
        .map((reason) => (
          <Text key={reason} style={[styles.reason, { color: sub }]}>
            • {reason}
          </Text>
        ))}
      {(project.notes || []).slice(0, 1).map((note) => (
        <Text key={note} style={[styles.reason, { color: sub }]}>
          • {note}
        </Text>
      ))}
    </View>
  );
}

export default function BenchmarkComparablesDrawer({
  visible,
  onClose,
  detached,
  twinHomes,
  darkMode,
  scopeName = null,
  livingSf = null,
}: Props) {
  const bg = darkMode ? '#111827' : '#ffffff';
  const text = darkMode ? '#f8fafc' : '#0f172a';
  const sub = darkMode ? '#94a3b8' : '#64748b';
  const [twinExpanded, setTwinExpanded] = useState(false);
  const semantics = measurementSemanticsV1Enabled();

  const enrichedDetached = useMemo(
    () => detached.map((p) => enrichProject(p, scopeName, livingSf)),
    [detached, scopeName, livingSf]
  );
  const enrichedTwin = useMemo(
    () => twinHomes.map((p) => enrichProject(p, scopeName, livingSf)),
    [twinHomes, scopeName, livingSf]
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.shell, { backgroundColor: bg }]}>
        <View style={[styles.header, { borderBottomColor: darkMode ? '#263242' : '#e2e8f0' }]}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: text }]}>Comparable projects</Text>
            <Text style={[styles.subtitle, { color: sub }]}>Preliminary Southern Utah budget references</Text>
          </View>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close comparables">
            <Ionicons name="close" size={24} color={text} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {!scopeName ? (
            <Text style={[styles.disclaimer, { color: sub, marginBottom: 12 }]}>
              Line amounts below are source budget lines used for similarity — not the full stage
              planning total shown on the estimate card.
            </Text>
          ) : null}
          <Text style={[styles.sectionTitle, { color: text }]}>Detached homes</Text>
          {enrichedDetached.map((project) => (
            <ComparableRow
              key={project.projectId}
              project={project}
              darkMode={darkMode}
              scopeName={scopeName}
            />
          ))}
          {enrichedTwin.length ? (
            <>
              <TouchableOpacity
                style={styles.twinHeader}
                onPress={() => setTwinExpanded((v) => !v)}
                accessibilityLabel="Twin-home reference"
              >
                <Text style={[styles.sectionTitle, { color: text, marginBottom: 0 }]}>
                  Twin-home reference
                </Text>
                <Ionicons
                  name={twinExpanded || !semantics ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={sub}
                />
              </TouchableOpacity>
              {(twinExpanded || !semantics) ? (
                <>
                  <Text style={[styles.disclaimer, { color: sub }]}>
                    Silver Leaf is shown separately and is excluded from detached medians. Its source
                    contains two homes.
                  </Text>
                  {enrichedTwin.map((project) => (
                    <ComparableRow
                      key={project.projectId}
                      project={project}
                      darkMode={darkMode}
                      scopeName={scopeName}
                    />
                  ))}
                </>
              ) : (
                <Text style={[styles.disclaimer, { color: sub }]}>
                  Silver Leaf kept separate from detached medians. Tap to expand.
                </Text>
              )}
            </>
          ) : null}
          <Text style={[styles.disclaimer, { color: sub }]}>
            Similarity is transparent guidance, not a quote. Verify scope, quantities, and current
            subcontractor pricing.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 3 },
  content: { padding: 20, paddingBottom: 48 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  twinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 6,
  },
  row: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, fontSize: 14, fontWeight: '700' },
  score: { fontSize: 12, fontWeight: '800' },
  exact: { fontSize: 11, fontWeight: '800', marginTop: 3 },
  detail: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  reason: { fontSize: 11, lineHeight: 17, marginTop: 2 },
  disclaimer: { fontSize: 11, lineHeight: 17, marginTop: 8 },
});
