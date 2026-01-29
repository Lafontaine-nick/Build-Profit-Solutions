import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

/**
 * Build Profit Solutions — Voice to Log Component
 * AI-powered voice input for daily site logs with photo integration
 */

// ---------- Types ----------
export type VoiceLogEntry = {
  id: string;
  timestamp: Date;
  voiceText: string;
  processedText: string;
  weather: string;
  crewCount: number;
  tasksCompleted: string[];
  issues: string[];
  photos: string[];
  aiSummary: string;
  status: 'recording' | 'processing' | 'completed' | 'error';
};

// ---------- Theme ----------
const palette = {
  dark: {
    bg: 'transparent',
    card: '#1B365D',
    text: '#FFFFFF',
    sub: 'rgba(255,255,255,0.8)',
    divider: 'rgba(255,255,255,0.2)',
    primary: '#22C55E',
    warning: '#FACC15',
    danger: '#EF4444',
    accent: '#22C55E',
  },
  light: {
    bg: '#F6F8FB',
    card: '#FFFFFF',
    text: '#0A1A2B',
    sub: '#5A6B7C',
    divider: 'rgba(0,0,0,0.06)',
    primary: '#16A34A',
    warning: '#B45309',
    danger: '#DC2626',
    accent: '#16A34A',
  },
};

export type ThemeName = keyof typeof palette;

// ---------- AI Service Mock (Replace with real AI integration) ----------
const AIService = {
  processVoiceInput: async (
    voiceText: string
  ): Promise<{
    processedText: string;
    weather: string;
    crewCount: number;
    tasksCompleted: string[];
    issues: string[];
    summary: string;
  }> => {
    // Mock AI processing - in real implementation, this would use speech-to-text and NLP
    const lowerText = voiceText.toLowerCase();

    // Extract weather information
    let weather = 'Sunny';
    if (lowerText.includes('rain') || lowerText.includes('raining'))
      weather = 'Rainy';
    else if (lowerText.includes('cloud') || lowerText.includes('cloudy'))
      weather = 'Cloudy';
    else if (lowerText.includes('storm') || lowerText.includes('stormy'))
      weather = 'Stormy';
    else if (lowerText.includes('snow') || lowerText.includes('snowy'))
      weather = 'Snowy';

    // Extract crew count
    const crewMatch = voiceText.match(/(\d+)\s*(crew|people|workers|guys)/i);
    const crewCount = crewMatch ? parseInt(crewMatch[1]) : 3; // Default to 3

    // Extract tasks completed
    const tasksCompleted: string[] = [];
    if (lowerText.includes('foundation') || lowerText.includes('concrete')) {
      tasksCompleted.push('Foundation work completed');
    }
    if (lowerText.includes('framing') || lowerText.includes('frame')) {
      tasksCompleted.push('Framing progress made');
    }
    if (lowerText.includes('electrical') || lowerText.includes('wiring')) {
      tasksCompleted.push('Electrical work done');
    }
    if (lowerText.includes('plumbing') || lowerText.includes('pipe')) {
      tasksCompleted.push('Plumbing installation');
    }

    // Extract issues
    const issues: string[] = [];
    if (lowerText.includes('delay') || lowerText.includes('behind')) {
      issues.push('Schedule delay noted');
    }
    if (lowerText.includes('material') || lowerText.includes('supply')) {
      issues.push('Material delivery issue');
    }
    if (lowerText.includes('weather') || lowerText.includes('rain')) {
      issues.push('Weather impact on work');
    }

    // Generate summary
    const summary = `Daily site log: ${weather} weather with ${crewCount} crew members. ${tasksCompleted.length > 0 ? `Completed: ${tasksCompleted.join(', ')}.` : 'No specific tasks completed.'} ${issues.length > 0 ? `Issues: ${issues.join(', ')}.` : 'No major issues reported.'}`;

    return {
      processedText: voiceText,
      weather,
      crewCount,
      tasksCompleted,
      issues,
      summary,
    };
  },
};

// ---------- Components ----------
const VoiceRecorder: React.FC<{
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  theme: ThemeName;
}> = ({ isRecording, onStartRecording, onStopRecording, theme }) => {
  const c = palette[theme];

  return (
    <View style={[styles.recorderContainer, { backgroundColor: c.card }]}>
      <View style={styles.recorderHeader}>
        <Ionicons name='mic' size={24} color={c.primary} />
        <Text style={[styles.recorderTitle, { color: c.text }]}>
          Voice Log Entry
        </Text>
      </View>

      <View style={styles.recorderContent}>
        <TouchableOpacity
          style={[
            styles.recordButton,
            {
              backgroundColor: isRecording ? c.danger : c.primary,
              borderColor: isRecording ? c.danger : c.primary,
            },
          ]}
          onPress={isRecording ? onStopRecording : onStartRecording}
        >
          <Ionicons
            name={isRecording ? 'stop' : 'mic'}
            size={32}
            color='#FFFFFF'
          />
        </TouchableOpacity>

        <Text style={[styles.recordText, { color: c.sub }]}>
          {isRecording
            ? 'Tap to stop recording...'
            : 'Tap to start recording your daily log'}
        </Text>

        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View
              style={[styles.recordingDot, { backgroundColor: c.danger }]}
            />
            <Text style={[styles.recordingText, { color: c.danger }]}>
              RECORDING
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const LogPreview: React.FC<{
  entry: VoiceLogEntry;
  theme: ThemeName;
  onEdit: () => void;
  onSave: () => void;
  onAddPhoto: () => void;
}> = ({ entry, theme, onEdit, onSave, onAddPhoto }) => {
  const c = palette[theme];

  return (
    <View style={[styles.previewContainer, { backgroundColor: c.card }]}>
      <View style={styles.previewHeader}>
        <Text style={[styles.previewTitle, { color: c.text }]}>
          Log Preview
        </Text>
        <TouchableOpacity onPress={onEdit}>
          <Ionicons name='create' size={20} color={c.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.previewContent}>
        <View style={styles.previewSection}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>
            Original Voice Input:
          </Text>
          <Text style={[styles.sectionText, { color: c.sub }]}>
            {entry.voiceText}
          </Text>
        </View>

        <View style={styles.previewSection}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>
            Extracted Information:
          </Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Ionicons name='partly-sunny' size={16} color={c.primary} />
              <Text style={[styles.infoText, { color: c.sub }]}>
                {entry.weather}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name='people' size={16} color={c.primary} />
              <Text style={[styles.infoText, { color: c.sub }]}>
                {entry.crewCount} crew
              </Text>
            </View>
          </View>
        </View>

        {entry.tasksCompleted.length > 0 && (
          <View style={styles.previewSection}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              Tasks Completed:
            </Text>
            {entry.tasksCompleted.map((task, index) => (
              <View key={index} style={styles.taskItem}>
                <Ionicons name='checkmark-circle' size={16} color={c.primary} />
                <Text style={[styles.taskText, { color: c.sub }]}>{task}</Text>
              </View>
            ))}
          </View>
        )}

        {entry.issues.length > 0 && (
          <View style={styles.previewSection}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              Issues Reported:
            </Text>
            {entry.issues.map((issue, index) => (
              <View key={index} style={styles.issueItem}>
                <Ionicons name='warning' size={16} color={c.warning} />
                <Text style={[styles.issueText, { color: c.sub }]}>
                  {issue}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.previewSection}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>
            AI Summary:
          </Text>
          <Text style={[styles.summaryText, { color: c.sub }]}>
            {entry.aiSummary}
          </Text>
        </View>

        {entry.photos.length > 0 && (
          <View style={styles.previewSection}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              Photos:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {entry.photos.map((photo, index) => (
                <Image
                  key={index}
                  source={{ uri: photo }}
                  style={styles.photoPreview}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <View style={styles.previewActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: c.primary }]}
          onPress={onAddPhoto}
        >
          <Ionicons name='camera' size={20} color='#FFFFFF' />
          <Text style={styles.actionButtonText}>Add Photos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: c.accent }]}
          onPress={onSave}
        >
          <Ionicons name='save' size={20} color='#FFFFFF' />
          <Text style={styles.actionButtonText}>Save Log</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ---------- Main Component ----------
export const VoiceToLog: React.FC<{
  projectId: string;
  theme?: ThemeName;
  onLogSaved?: (log: VoiceLogEntry) => void;
}> = ({ projectId, theme = 'dark', onLogSaved }) => {
  const c = palette[theme];
  const [isRecording, setIsRecording] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<VoiceLogEntry | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleStartRecording = () => {
    setIsRecording(true);
    // In real implementation, start voice recording
    // For demo, simulate recording after 3 seconds
    setTimeout(() => {
      handleStopRecording();
    }, 3000);
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    setIsProcessing(true);

    // Mock voice input - in real implementation, this would be actual voice recording
    const mockVoiceText =
      'Hey, today was a good day. We had 4 crew members working on the foundation. The weather was sunny and we got the concrete pour done. We also finished the rebar installation. No major issues, just a small delay with the material delivery but we caught up. Overall good progress.';

    try {
      const processed = await AIService.processVoiceInput(mockVoiceText);

      const entry: VoiceLogEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        voiceText: mockVoiceText,
        processedText: processed.processedText,
        weather: processed.weather,
        crewCount: processed.crewCount,
        tasksCompleted: processed.tasksCompleted,
        issues: processed.issues,
        photos: [],
        aiSummary: processed.summary,
        status: 'completed',
      };

      setCurrentEntry(entry);
    } catch (error) {
      console.error('Error processing voice input:', error);
      Alert.alert('Error', 'Failed to process voice input. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && currentEntry) {
        setCurrentEntry({
          ...currentEntry,
          photos: [...currentEntry.photos, result.assets[0].uri],
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to add photo. Please try again.');
    }
  };

  const handleSaveLog = () => {
    if (currentEntry) {
      onLogSaved?.(currentEntry);
      setCurrentEntry(null);
      Alert.alert('Success', 'Daily log saved successfully!');
    }
  };

  const handleEditLog = () => {
    Alert.alert(
      'Edit Log',
      'Log editing functionality would be implemented here'
    );
  };

  if (isProcessing) {
    return (
      <LinearGradient
        colors={['#0b1c38', '#1B365D', '#43cea2']}
        style={styles.container}
      >
        <View style={[styles.screen, { backgroundColor: c.bg }]}>
          <View
            style={[styles.processingContainer, { backgroundColor: c.card }]}
          >
            <Ionicons name='bulb' size={48} color={c.primary} />
            <Text style={[styles.processingTitle, { color: c.text }]}>
              Processing Voice Input
            </Text>
            <Text style={[styles.processingText, { color: c.sub }]}>
              AI is analyzing your voice input and extracting key information...
            </Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  if (currentEntry) {
    return (
      <LinearGradient
        colors={['#0b1c38', '#1B365D', '#43cea2']}
        style={styles.container}
      >
        <View style={[styles.screen, { backgroundColor: c.bg }]}>
          <LogPreview
            entry={currentEntry}
            theme={theme}
            onEdit={handleEditLog}
            onSave={handleSaveLog}
            onAddPhoto={handleAddPhoto}
          />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#0b1c38', '#1B365D', '#43cea2']}
      style={styles.container}
    >
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <VoiceRecorder
          isRecording={isRecording}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          theme={theme}
        />

        <View
          style={[styles.instructionsContainer, { backgroundColor: c.card }]}
        >
          <Text style={[styles.instructionsTitle, { color: c.text }]}>
            How to Use Voice Log:
          </Text>
          <View style={styles.instructionsList}>
            <View style={styles.instructionItem}>
              <Ionicons name='mic' size={16} color={c.primary} />
              <Text style={[styles.instructionText, { color: c.sub }]}>
                Tap the microphone to start recording
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <Ionicons name='chatbubble' size={16} color={c.primary} />
              <Text style={[styles.instructionText, { color: c.sub }]}>
                Speak naturally about your day's work
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <Ionicons name='bulb' size={16} color={c.primary} />
              <Text style={[styles.instructionText, { color: c.sub }]}>
                AI will extract weather, crew count, tasks, and issues
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <Ionicons name='camera' size={16} color={c.primary} />
              <Text style={[styles.instructionText, { color: c.sub }]}>
                Add photos to document progress
              </Text>
            </View>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
};

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screen: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  recorderContainer: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  recorderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  recorderTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  recorderContent: {
    alignItems: 'center',
    gap: 16,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  recordText: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: 250,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '700',
  },
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    padding: 40,
    gap: 20,
  },
  processingTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  processingText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  previewContainer: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  previewContent: {
    flex: 1,
    marginBottom: 16,
  },
  previewSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  taskText: {
    fontSize: 14,
  },
  issueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  issueText: {
    fontSize: 14,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  instructionsContainer: {
    borderRadius: 16,
    padding: 16,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  instructionsList: {
    gap: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  instructionText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});

export default VoiceToLog;
