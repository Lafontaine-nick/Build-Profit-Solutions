import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LeadNote {
  id: string;
  content: string;
  timestamp: Date;
  type: 'note' | 'call' | 'email' | 'meeting' | 'reminder';
  reminderDate?: Date;
}

interface LeadNotesModalProps {
  visible: boolean;
  onClose: () => void;
  leadId: string;
  leadTitle: string;
}

const LeadNotesModal: React.FC<LeadNotesModalProps> = ({
  visible,
  onClose,
  leadId,
  leadTitle,
}) => {
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<'note' | 'call' | 'email' | 'meeting' | 'reminder'>('note');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');

  useEffect(() => {
    if (visible) {
      loadNotes();
    }
  }, [visible, leadId]);

  const loadNotes = async () => {
    try {
      const storedNotes = await AsyncStorage.getItem(`lead_notes_${leadId}`);
      if (storedNotes) {
        const parsedNotes = JSON.parse(storedNotes).map((note: any) => ({
          ...note,
          timestamp: new Date(note.timestamp),
          reminderDate: note.reminderDate ? new Date(note.reminderDate) : undefined,
        }));
        setNotes(parsedNotes);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const saveNotes = async (updatedNotes: LeadNote[]) => {
    try {
      await AsyncStorage.setItem(`lead_notes_${leadId}`, JSON.stringify(updatedNotes));
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  const addNote = () => {
    if (!newNote.trim()) return;

    const note: LeadNote = {
      id: Date.now().toString(),
      content: newNote.trim(),
      timestamp: new Date(),
      type: noteType,
      reminderDate: noteType === 'reminder' && reminderDate ? new Date(`${reminderDate}T${reminderTime}`) : undefined,
    };

    const updatedNotes = [note, ...notes];
    setNotes(updatedNotes);
    saveNotes(updatedNotes);
    setNewNote('');
    setReminderDate('');
    setReminderTime('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const deleteNote = (noteId: string) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedNotes = notes.filter(note => note.id !== noteId);
            setNotes(updatedNotes);
            saveNotes(updatedNotes);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getNoteIcon = (type: string) => {
    switch (type) {
      case 'call': return 'phone';
      case 'email': return 'email';
      case 'meeting': return 'event';
      case 'reminder': return 'alarm';
      default: return 'note';
    }
  };

  const getNoteColor = (type: string) => {
    switch (type) {
      case 'call': return '#3B82F6';
      case 'email': return '#10B981';
      case 'meeting': return '#F59E0B';
      case 'reminder': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lead Notes & History</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Lead Info */}
        <View style={styles.leadInfo}>
          <Text style={styles.leadTitle}>{leadTitle}</Text>
          <Text style={styles.leadId}>ID: {leadId}</Text>
        </View>

        {/* Add Note Section */}
        <View style={styles.addNoteSection}>
          <Text style={styles.sectionTitle}>Add Note</Text>
          
          {/* Note Type Selector */}
          <View style={styles.typeSelector}>
            {[
              { key: 'note', label: 'Note', icon: 'note' },
              { key: 'call', label: 'Call', icon: 'phone' },
              { key: 'email', label: 'Email', icon: 'email' },
              { key: 'meeting', label: 'Meeting', icon: 'event' },
              { key: 'reminder', label: 'Reminder', icon: 'alarm' },
            ].map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.typeButton,
                  noteType === type.key && styles.activeTypeButton,
                ]}
                onPress={() => setNoteType(type.key as any)}
              >
                <MaterialIcons
                  name={type.icon as any}
                  size={16}
                  color={noteType === type.key ? '#FFFFFF' : '#6B7280'}
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    noteType === type.key && styles.activeTypeButtonText,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Reminder Date/Time (only for reminder type) */}
          {noteType === 'reminder' && (
            <View style={styles.reminderSection}>
              <Text style={styles.reminderLabel}>Set Reminder</Text>
              <View style={styles.reminderInputs}>
                <TextInput
                  style={styles.reminderInput}
                  placeholder="Date (MM/DD/YYYY)"
                  value={reminderDate}
                  onChangeText={setReminderDate}
                />
                <TextInput
                  style={styles.reminderInput}
                  placeholder="Time (HH:MM)"
                  value={reminderTime}
                  onChangeText={setReminderTime}
                />
              </View>
            </View>
          )}

          {/* Note Input */}
          <TextInput
            style={styles.noteInput}
            placeholder="Enter your note here..."
            value={newNote}
            onChangeText={setNewNote}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity
            style={[styles.addButton, !newNote.trim() && styles.disabledButton]}
            onPress={addNote}
            disabled={!newNote.trim()}
          >
            <MaterialIcons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add Note</Text>
          </TouchableOpacity>
        </View>

        {/* Notes History */}
        <ScrollView style={styles.notesContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>History ({notes.length})</Text>
          
          {notes.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="note" size={48} color="#6B7280" />
              <Text style={styles.emptyStateText}>No notes yet</Text>
              <Text style={styles.emptyStateSubtext}>Add your first note to track this lead</Text>
            </View>
          ) : (
            notes.map((note) => (
              <View key={note.id} style={styles.noteCard}>
                <View style={styles.noteHeader}>
                  <View style={styles.noteTypeInfo}>
                    <MaterialIcons
                      name={getNoteIcon(note.type)}
                      size={16}
                      color={getNoteColor(note.type)}
                    />
                    <Text style={[styles.noteType, { color: getNoteColor(note.type) }]}>
                      {note.type.charAt(0).toUpperCase() + note.type.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.noteActions}>
                    <Text style={styles.noteTimestamp}>
                      {formatTimestamp(note.timestamp)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => deleteNote(note.id)}
                      style={styles.deleteButton}
                    >
                      <MaterialIcons name="delete" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
                
                <Text style={styles.noteContent}>{note.content}</Text>
                
                {note.reminderDate && (
                  <View style={styles.reminderInfo}>
                    <MaterialIcons name="alarm" size={14} color="#EF4444" />
                    <Text style={styles.reminderText}>
                      Reminder: {formatTimestamp(note.reminderDate)}
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1c38',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#1B365D',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  leadInfo: {
    padding: 20,
    backgroundColor: '#1B365D',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  leadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  leadId: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  addNoteSection: {
    padding: 20,
    backgroundColor: '#1B365D',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  activeTypeButton: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  typeButtonText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  activeTypeButtonText: {
    color: '#FFFFFF',
  },
  reminderSection: {
    marginBottom: 16,
  },
  reminderLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  reminderInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  reminderInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  noteInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#6B7280',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  notesContainer: {
    flex: 1,
    padding: 20,
  },
  noteCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteTypeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteType: {
    fontSize: 12,
    fontWeight: '600',
  },
  noteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noteTimestamp: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  deleteButton: {
    padding: 4,
  },
  noteContent: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 8,
  },
  reminderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  reminderText: {
    fontSize: 12,
    color: '#EF4444',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});

export default LeadNotesModal;










