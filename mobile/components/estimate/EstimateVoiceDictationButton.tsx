import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { postAiAssistantJson } from '@/utils/resolveAiBackendUrl';
import { estimateStep1GhostActionStyle, estimateStep1ActionButtonStyle } from '@/utils/estimateFlowCardStyle';

type Colors = {
  text: string;
  sub: string;
  line: string;
  surface2: string;
};

type Props = {
  Colors: Colors;
  darkMode: boolean;
  disabled?: boolean;
  /** Receives the cleaned transcript when transcription completes. */
  onTranscript: (text: string) => void;
  variant?: 'compact' | 'action' | 'ghost';
  style?: ViewStyle;
};

/** Strip standalone filler words Whisper keeps; leave everything else untouched. */
export function cleanWalkthroughTranscript(raw: string): string {
  return String(raw || '')
    .replace(/\b(?:um+|uh+|erm+|hmm+)\b[,.]?\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Mic button for dictating walkthrough notes.
 * Records via expo-av, sends base64 audio to /api/ai-assistant/transcribe (Whisper),
 * and returns the transcript through onTranscript.
 */
export default function EstimateVoiceDictationButton({
  Colors,
  darkMode,
  disabled = false,
  onTranscript,
  variant = 'compact',
  style,
}: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  useEffect(() => {
    if (isRecording && !timerRef.current) {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } else if (!isRecording && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording]);

  // Stop any live recording when the screen unmounts.
  useEffect(
    () => () => {
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    },
    []
  );

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Microphone needed', 'Allow microphone access to dictate your walkthrough.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = rec;
      setDuration(0);
      setIsRecording(true);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.warn('Voice dictation: failed to start recording', err);
      Alert.alert('Recording failed', 'Could not start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    setIsRecording(false);
    recordingRef.current = null;
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = rec.getURI();
      if (!uri) {
        Alert.alert('Recording failed', 'No audio captured. Please try again.');
        return;
      }
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await transcribe(uri);
    } catch (err) {
      console.warn('Voice dictation: failed to stop recording', err);
      Alert.alert('Recording failed', 'Could not process the recording. Please try again.');
    }
  };

  const transcribe = async (audioUri: string) => {
    setTranscribing(true);
    try {
      const base64Audio = await FileSystemLegacy.readAsStringAsync(audioUri, {
        encoding: 'base64',
      });
      const data = await postAiAssistantJson<{ text?: string; transcription?: string }>(
        '/transcribe',
        {
          audio: base64Audio,
          format: Platform.OS === 'ios' ? 'm4a' : 'mp4',
        }
      );
      const text = cleanWalkthroughTranscript(data.text || data.transcription || '');
      if (text) {
        onTranscript(text);
      } else {
        Alert.alert('No speech detected', 'Could not hear anything in the recording. Try again closer to the mic.');
      }
    } catch (err: unknown) {
      console.warn('Voice dictation: transcription failed', err);
      const message = err instanceof Error ? err.message : 'Please try again.';
      Alert.alert('Transcription failed', `${message}\n\nYou can type your notes instead.`);
    } finally {
      setTranscribing(false);
    }
  };

  if (transcribing) {
    if (variant === 'action' || variant === 'ghost') {
      const shellStyle =
        variant === 'ghost'
          ? estimateStep1GhostActionStyle(darkMode)
          : estimateStep1ActionButtonStyle(Colors, darkMode);
      return (
        <View style={[shellStyle, style]}>
          <ActivityIndicator size="small" color="#22c55e" />
          <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '600' }}>Transcribing…</Text>
        </View>
      );
    }
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <ActivityIndicator size="small" color="#60a5fa" />
        <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600' }}>Transcribing…</Text>
      </View>
    );
  }

  if (isRecording) {
    const recordingShell =
      variant === 'ghost'
        ? [
            estimateStep1GhostActionStyle(darkMode),
            {
              backgroundColor: darkMode ? 'rgba(239, 68, 68, 0.14)' : 'rgba(239, 68, 68, 0.1)',
            },
            style,
          ]
        : variant === 'action'
          ? [
              estimateStep1ActionButtonStyle(Colors, darkMode),
              {
                backgroundColor: darkMode ? 'rgba(239, 68, 68, 0.14)' : 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.25)',
              },
              style,
            ]
          : {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: darkMode ? 'rgba(239, 68, 68, 0.14)' : 'rgba(239, 68, 68, 0.1)',
            };
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={stopRecording}
        accessibilityRole="button"
        accessibilityLabel="Stop recording"
        style={recordingShell}
      >
        <MaterialIcons name="stop-circle" size={18} color="#ef4444" />
        <Text style={{ color: '#ef4444', fontSize: variant === 'compact' ? 12 : 13, fontWeight: '700' }}>
          {duration}s · tap to stop
        </Text>
      </TouchableOpacity>
    );
  }

  const actionShell =
    variant === 'ghost'
      ? [estimateStep1GhostActionStyle(darkMode, { disabled }), style]
      : variant === 'action'
        ? [estimateStep1ActionButtonStyle(Colors, darkMode, { disabled }), style]
        : {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: darkMode ? 'rgba(148, 163, 184, 0.25)' : Colors.line,
            opacity: disabled ? 0.5 : 1,
          };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={startRecording}
      accessibilityRole="button"
      accessibilityLabel="Dictate walkthrough notes"
      style={actionShell}
    >
      <MaterialIcons name="mic" size={variant === 'compact' ? 16 : 18} color="#22c55e" />
      <Text
        style={{
          color: variant === 'ghost' ? Colors.sub : Colors.text,
          fontSize: variant === 'compact' ? 12 : 13,
          fontWeight: variant === 'ghost' ? '600' : '700',
        }}
      >
        Dictate
      </Text>
    </TouchableOpacity>
  );
}
