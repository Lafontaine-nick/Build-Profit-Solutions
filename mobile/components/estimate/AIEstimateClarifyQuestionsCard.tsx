import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ClarifyAnswer, ClarifyQuestionItem } from '@/utils/estimateAiDraft';
import { estimateFlowCardStyle } from '@/utils/estimateFlowCardStyle';

type Colors = {
  text: string;
  sub: string;
  line: string;
  surface2: string;
};

type Props = {
  questionItems: ClarifyQuestionItem[];
  Colors: Colors;
  darkMode: boolean;
  busy: boolean;
  applying: boolean;
  appliedSummary?: string[] | null;
  onSubmitAnswers: (answers: ClarifyAnswer[]) => void;
  onDismiss: () => void;
  /** Clears only the applied summary strip; keeps remaining questions. */
  onDismissApplied?: () => void;
};

function placeholderForQuestion(q: ClarifyQuestionItem): string {
  if (q.kind === 'pricing') return 'e.g. $2,000';
  if (q.kind !== 'measurement') return 'Type a short answer';

  const key = String(q.targetKey || '').toLowerCase();
  const text = String(q.question || '').toLowerCase();

  if (/\blinear\s*(foot|feet|footage)\b|\blf\b/.test(text)) return 'e.g. 80 LF';
  if (/\bsquare\s*(foot|feet|footage)\b|\bsq\.?\s*ft\b|\bsqft\b/.test(text)) return 'e.g. 1,200 sqft';
  if (/\bcubic\s*yards?\b|\bcy\b/.test(text)) return 'e.g. 12 CY';
  if (/\broof(?:ing)?\s*squares?\b|\b\d+\s*squares?\b/.test(text)) return 'e.g. 24 squares';
  if (/\btons?\b/.test(text)) return 'e.g. 8 tons';

  if (key.endsWith('lf') || key.includes('linear')) return 'e.g. 80 LF';
  if (key.includes('cy')) return 'e.g. 12 CY';
  if (key === 'roofsquares' || key.endsWith('squares')) return 'e.g. 24 squares';
  if (key.includes('ton')) return 'e.g. 8 tons';
  return 'e.g. 1,200 sqft';
}

function usefulWhy(why: string | null | undefined, question: string): string | null {
  const text = String(why || '').trim();
  if (!text) return null;
  if (/this (measurement|price|info|detail) is needed to (price|complete|finish)/i.test(text)) {
    return null;
  }
  if (/necessary to complete the pricing/i.test(text)) return null;
  const qNorm = question.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const wNorm = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  if (wNorm.includes(qNorm.slice(0, 40)) || qNorm.includes(wNorm.slice(0, 40))) return null;
  return text;
}

export default function AIEstimateClarifyQuestionsCard({
  questionItems,
  Colors,
  darkMode,
  busy,
  applying,
  appliedSummary,
  onSubmitAnswers,
  onDismiss,
  onDismissApplied,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  /** Collapsed by default so Step 3 opens on the bid — expand only when needed. */
  const [expanded, setExpanded] = useState(false);

  const answeredCount = questionItems.filter((q) => (answers[q.id] || '').trim()).length;
  const hasApplied = Boolean(appliedSummary?.length);
  const hasRemaining = questionItems.length > 0;
  const count = questionItems.length;
  const appliedPreview = (appliedSummary || []).slice(0, 3).join(' · ');
  const appliedOverflow = Math.max(0, (appliedSummary || []).length - 3);

  useEffect(() => {
    if (hasApplied) setExpanded(false);
  }, [hasApplied, count]);

  useEffect(() => {
    const ids = new Set(questionItems.map((q) => q.id));
    setAnswers((prev) => {
      const next: Record<string, string> = {};
      for (const [id, value] of Object.entries(prev)) {
        if (ids.has(id)) next[id] = value;
      }
      return next;
    });
  }, [questionItems]);

  if (!hasRemaining && !hasApplied) return null;

  const handleSubmit = () => {
    const payload: ClarifyAnswer[] = questionItems
      .map((q) => ({
        question: q.question,
        answer: (answers[q.id] || '').trim(),
        targetKey: q.targetKey ?? null,
        targetPackage: q.targetPackage ?? null,
      }))
      .filter((a) => a.answer);
    if (payload.length) onSubmitAnswers(payload);
  };

  return (
    <View style={{ marginBottom: 12 }}>
      {hasApplied ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
            marginBottom: hasRemaining ? 8 : 0,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.06)',
          }}
        >
          <MaterialIcons name="check-circle" size={15} color="#22c55e" style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.text, fontSize: 12, lineHeight: 17 }}>
              {appliedPreview}
              {appliedOverflow > 0 ? ` · +${appliedOverflow} more` : ''}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={onDismissApplied || onDismiss}
            hitSlop={8}
          >
            <MaterialIcons name="close" size={16} color={Colors.sub} />
          </TouchableOpacity>
        </View>
      ) : null}

      {hasRemaining ? (
        expanded ? (
          <View style={estimateFlowCardStyle(Colors, darkMode, { marginBottom: 0 })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setExpanded(false)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, paddingRight: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Hide clarifying questions"
              >
                <MaterialIcons name="live-help" size={15} color="#60a5fa" />
                <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700', flexShrink: 1 }}>
                  {hasApplied
                    ? `${count} still open`
                    : `${count} question${count === 1 ? '' : 's'} about this job`}
                </Text>
                <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '700' }}>Hide</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.75} disabled={applying} onPress={onDismiss}>
                <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600' }}>Dismiss</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 10 }}>
              {questionItems.map((q, index) => {
                const why = usefulWhy(q.why, q.question);
                return (
                  <View key={q.id} style={{ marginBottom: index === questionItems.length - 1 ? 4 : 12 }}>
                    <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '600', lineHeight: 18 }}>
                      {index + 1}. {q.question}
                    </Text>
                    {why ? (
                      <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 2 }}>{why}</Text>
                    ) : null}
                    <TextInput
                      value={answers[q.id] || ''}
                      onChangeText={(text) => setAnswers((prev) => ({ ...prev, [q.id]: text }))}
                      editable={!applying && !busy}
                      placeholder={placeholderForQuestion(q)}
                      placeholderTextColor={darkMode ? 'rgba(148, 163, 184, 0.55)' : '#94a3b8'}
                      style={{
                        marginTop: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: (answers[q.id] || '').trim()
                          ? 'rgba(96, 165, 250, 0.45)'
                          : darkMode
                            ? 'rgba(148, 163, 184, 0.2)'
                            : Colors.line,
                        color: Colors.text,
                        fontSize: 14,
                        backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : Colors.surface2,
                      }}
                    />
                  </View>
                );
              })}
              <TouchableOpacity
                activeOpacity={0.88}
                disabled={applying || busy || answeredCount === 0}
                onPress={handleSubmit}
                style={{
                  marginTop: 8,
                  paddingVertical: 11,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: answeredCount > 0 ? '#3b82f6' : 'rgba(59, 130, 246, 0.25)',
                  opacity: applying || busy ? 0.7 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {applying ? <ActivityIndicator size="small" color="#eff6ff" /> : null}
                  <Text style={{ color: '#eff6ff', fontSize: 14, fontWeight: '800' }}>
                    {applying
                      ? 'Updating draft…'
                      : answeredCount > 0
                        ? `Apply ${answeredCount} answer${answeredCount === 1 ? '' : 's'}`
                        : 'Answer a question to apply'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: darkMode ? 'rgba(96, 165, 250, 0.08)' : 'rgba(59, 130, 246, 0.06)',
            }}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setExpanded(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Show clarifying questions"
            >
              <MaterialIcons name="live-help" size={15} color="#60a5fa" />
              <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1 }}>
                {hasApplied
                  ? `${count} still open`
                  : `${count} question${count === 1 ? '' : 's'}`}
              </Text>
              <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '600' }}>Show</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.75} disabled={applying} onPress={onDismiss} hitSlop={8}>
              <Text style={{ color: Colors.sub, fontSize: 13, fontWeight: '600' }}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )
      ) : null}
    </View>
  );
}
