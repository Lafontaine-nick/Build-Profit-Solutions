import React, { useState } from 'react';
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
  /** Set after answers are merged — shows the confirmation state. */
  appliedSummary?: string[] | null;
  onSubmitAnswers: (answers: ClarifyAnswer[]) => void;
  onDismiss: () => void;
};

export default function AIEstimateClarifyQuestionsCard({
  questionItems,
  Colors,
  darkMode,
  busy,
  applying,
  appliedSummary,
  onSubmitAnswers,
  onDismiss,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const answeredCount = questionItems.filter((q) => (answers[q.id] || '').trim()).length;
  const showApplied = Boolean(appliedSummary?.length) && questionItems.length === 0;

  if (!questionItems.length && !showApplied) return null;

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
    <View style={estimateFlowCardStyle(Colors, darkMode, { marginBottom: 12 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <MaterialIcons name="live-help" size={16} color="#60a5fa" />
          <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }}>
            {showApplied ? 'Answers applied' : 'Questions about this job'}
          </Text>
        </View>
        <TouchableOpacity activeOpacity={0.75} disabled={applying} onPress={onDismiss}>
          <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600' }}>Dismiss</Text>
        </TouchableOpacity>
      </View>

      {showApplied ? (
        <View style={{ marginTop: 6 }}>
          {appliedSummary!.map((line, i) => (
            <View key={`applied-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: i === 0 ? 0 : 4 }}>
              <MaterialIcons name="check-circle" size={14} color="#22c55e" />
              <Text style={{ color: Colors.text, fontSize: 13, flex: 1 }}>{line}</Text>
            </View>
          ))}
          <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 8 }}>
            The draft below has been updated with your answers.
          </Text>
        </View>
      ) : (
        <>
          <Text style={{ color: Colors.sub, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
            Answer any of these and the draft updates itself — skip the ones you're not sure about.
          </Text>
          {questionItems.map((q, index) => (
            <View key={q.id} style={{ marginBottom: index === questionItems.length - 1 ? 4 : 12 }}>
              <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '600', lineHeight: 18 }}>
                {index + 1}. {q.question}
              </Text>
              {q.why ? (
                <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 2 }}>{q.why}</Text>
              ) : null}
              <TextInput
                value={answers[q.id] || ''}
                onChangeText={(text) => setAnswers((prev) => ({ ...prev, [q.id]: text }))}
                editable={!applying && !busy}
                placeholder={
                  q.kind === 'measurement'
                    ? 'e.g. 1,200 sqft'
                    : q.kind === 'pricing'
                      ? 'e.g. $2,000'
                      : 'Type a short answer'
                }
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
          ))}
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
        </>
      )}
    </View>
  );
}
