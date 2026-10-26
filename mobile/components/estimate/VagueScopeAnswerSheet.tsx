import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import EstimateVoiceDictationButton from '@/components/estimate/EstimateVoiceDictationButton';
import { resolveTextInputKeyboardProps } from '@/constants/inputKeyboardPresets';
import type { VagueScopeChip } from '@/utils/vagueScopeNote';

type SheetColors = {
  text: string;
  sub: string;
  line: string;
  surface: string;
  surface2: string;
};

type Props = {
  visible: boolean;
  darkMode: boolean;
  Colors: SheetColors;
  chips: VagueScopeChip[];
  example: string | null;
  onSubmit: (answer: string) => boolean;
  onDismiss: () => void;
};

const MINT = '#2dcc9a';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fieldHasChip(value: string, chip: VagueScopeChip): boolean {
  return new RegExp(`(?:^|[\\s.,;])${escapeRegExp(chip.text)}(?=$|[\\s.,;])`, 'i').test(
    value
  );
}

function appendChip(value: string, addition: string): string {
  const base = value.replace(/[\s,]+$/, '');
  if (!base) return addition;
  return /[.;]$/.test(base) ? `${base} ${addition}` : `${base}, ${addition}`;
}

function removeChip(value: string, chip: VagueScopeChip): string {
  return value
    .replace(new RegExp(`${escapeRegExp(chip.text)}`, 'i'), '')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*\./g, '.')
    .replace(/^[\s.,;]+|[\s,;]+$/g, '')
    .replace(/\s{2,}/g, ' ');
}

export default function VagueScopeAnswerSheet({
  visible,
  darkMode,
  Colors,
  chips,
  example,
  onSubmit,
  onDismiss,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const [value, setValue] = useState('');
  const [needsScope, setNeedsScope] = useState(false);
  const trimmed = value.replace(/[\s,]+$/, '').trim();
  const muted = darkMode ? 'rgba(235,235,245,0.6)' : Colors.sub;
  const fieldFill = darkMode ? 'rgba(255,255,255,0.05)' : Colors.surface2;
  const fieldBorder = darkMode ? 'rgba(148, 163, 184, 0.22)' : Colors.line;
  const chipFill = fieldFill;
  const chipBorder = fieldBorder;

  const updateValue = (next: string) => {
    setValue(next);
    if (needsScope) setNeedsScope(false);
  };

  const toggleChip = (chip: VagueScopeChip) => {
    Haptics.selectionAsync().catch(() => {});
    updateValue(
      fieldHasChip(value, chip) ? removeChip(value, chip) : appendChip(value, chip.text)
    );
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submit = () => {
    if (!trimmed) return;
    if (!onSubmit(trimmed)) {
      setNeedsScope(true);
      return;
    }
    setValue('');
    setNeedsScope(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      onShow={() => setTimeout(() => inputRef.current?.focus(), 150)}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.scrim} onPress={onDismiss} />
        <View
          style={[
            styles.card,
            { backgroundColor: darkMode ? '#202022' : Colors.surface },
          ]}
        >
          <View
            style={[
              styles.handle,
              {
                backgroundColor: darkMode
                  ? 'rgba(255,255,255,0.28)'
                  : 'rgba(15,23,42,0.2)',
              },
            ]}
          />
          <Text style={[styles.title, { color: Colors.text }]}>
            Structure this bid
          </Text>
          <Text style={[styles.subtitle, { color: muted }]}>
            Tap the scopes in this job, then add any measurements you have.
            Anything missing stays blank.
          </Text>
          {chips.length ? (
            <Text style={[styles.hint, { color: muted }]}>
              Not listed? Type it or dictate it.
            </Text>
          ) : null}

          {chips.length ? (
            <View style={styles.chipWrap}>
              {chips.map(item => {
                const selected = fieldHasChip(value, item);
                return (
                  <Pressable
                    key={item.label}
                    onPress={() => toggleChip(item)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={item.label}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? MINT : chipBorder,
                        backgroundColor: selected
                          ? 'rgba(45, 204, 154, 0.14)'
                          : 'transparent',
                      },
                    ]}
                  >
                    {selected ? (
                      <Ionicons name="checkmark" size={14} color={MINT} />
                    ) : null}
                    <Text
                      style={[
                        styles.chipText,
                        { color: selected ? MINT : Colors.text },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={updateValue}
            placeholder="Scopes and measurements"
            placeholderTextColor={
              darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8'
            }
            style={[
              styles.field,
              {
                color: Colors.text,
                backgroundColor: fieldFill,
                borderColor: needsScope ? '#f59e0b' : fieldBorder,
              },
            ]}
            multiline
            {...resolveTextInputKeyboardProps({
              multiline: true,
              multilineMode: 'growable',
            })}
          />
          {needsScope ? (
            <Text style={styles.error}>
              That doesn't name a scope yet. Use the trade name, such as HVAC,
              roofing, or cabinets.
            </Text>
          ) : example ? (
            <Text style={[styles.example, { color: muted }]}>
              Example: {example}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <EstimateVoiceDictationButton
              Colors={Colors}
              darkMode={darkMode}
              variant="action"
              style={styles.dictate}
              onTranscript={text =>
                updateValue(value.trim() ? `${value.trim()} ${text}` : text)
              }
            />
            <Pressable
              style={[
                styles.primary,
                trimmed
                  ? { backgroundColor: MINT }
                  : {
                      backgroundColor: darkMode ? '#3A3A3C' : '#E2E8F0',
                    },
              ]}
              disabled={!trimmed}
              onPress={submit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !trimmed }}
            >
              <Text
                style={[
                  styles.primaryText,
                  { color: trimmed ? '#050B13' : muted },
                ]}
              >
                Add to scope
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={onDismiss} style={styles.secondary}>
            <Text style={[styles.secondaryText, { color: muted }]}>Not yet</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  field: {
    minHeight: 80,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    lineHeight: 22,
  },
  example: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  error: {
    color: '#f59e0b',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  dictate: {
    flex: 0,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  primary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '800',
  },
  secondary: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
