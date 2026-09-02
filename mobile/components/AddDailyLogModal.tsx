import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  Keyboard,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from "@/constants/brandFrameGradient";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GreyCalendar from "./GreyCalendar";
import GradientRingBackInner from "./GradientRingBackInner";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import { FORM_KEYBOARD_SCROLL_PROPS } from "@/constants/keyboardScrollProps";
import { resolveTextInputKeyboardProps } from "@/constants/inputKeyboardPresets";
import {
  estimateFlowPrimaryButtonStyle,
  estimateFlowPrimaryButtonTextStyle,
} from "@/utils/estimateFlowCardStyle";
import {
  deleteProjectPhoto,
  getProjectPhotosByIds,
  linkPhotosToDailyLog,
  saveProjectPhoto,
  updateProjectPhotoCaption,
} from "@/services/projectPhotoService";

export type DailyLogEntry = {
  id: string;
  date: string;
  noteText: string;
  weather: string | null;
  crewCount: number | null;
  hoursWorked: number | null;
  createdAt: string;
  photoIds?: string[];
};

type AttachedLogPhoto = {
  id: string;
  uri: string;
  existing: boolean;
  caption?: string;
};

const MAX_LOG_PHOTOS = 6;

type Props = {
  visible: boolean;
  projectId: string;
  existingLog?: DailyLogEntry | null;
  onClose: () => void;
  onSaved: () => void;
};

const WEATHER_OPTIONS = ["Sunny", "Cloudy", "Rainy", "Stormy", "Snowy"] as const;

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function saveDailyLog(projectId: string, entry: DailyLogEntry): Promise<void> {
  const logKey = `daily_logs_${projectId}`;
  const raw = await AsyncStorage.getItem(logKey);
  const logs = raw ? JSON.parse(raw) : [];
  logs.push(entry);
  await AsyncStorage.setItem(logKey, JSON.stringify(logs));
}

export async function updateDailyLog(projectId: string, entry: DailyLogEntry): Promise<void> {
  const logKey = `daily_logs_${projectId}`;
  const raw = await AsyncStorage.getItem(logKey);
  const logs = raw ? JSON.parse(raw) : [];
  const updated = Array.isArray(logs)
    ? logs.map((log: DailyLogEntry) => (log.id === entry.id ? entry : log))
    : [];
  await AsyncStorage.setItem(logKey, JSON.stringify(updated));
}

export default function AddDailyLogModal({ visible, projectId, existingLog, onClose, onSaved }: Props) {
  const isEditing = !!existingLog;
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const placeholderTint = darkMode ? "rgba(226, 232, 240, 0.58)" : Colors.sub;

  const fieldSurface = useMemo(
    () => ({
      backgroundColor: darkMode ? "#18181b" : Colors.surface2,
      borderColor: darkMode ? "#3f3f46" : Colors.line,
    }),
    [darkMode, Colors]
  );

  const [logDate, setLogDate] = useState(() => toDateString(new Date()));
  const [noteText, setNoteText] = useState("");
  const [weather, setWeather] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [attachedPhotos, setAttachedPhotos] = useState<AttachedLogPhoto[]>([]);

  const notesRef = useRef<TextInput>(null);
  const [notesInputKey, setNotesInputKey] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setNotesInputKey((key) => key + 1);
    let cancelled = false;

    const hydrate = async () => {
      if (existingLog) {
        const rawDate = existingLog.date || existingLog.createdAt;
        const dateOnly = rawDate ? String(rawDate).match(/^(\d{4}-\d{2}-\d{2})/)?.[1] : null;
        setLogDate(dateOnly || toDateString(new Date()));
        setNoteText(existingLog.noteText || "");
        setWeather(existingLog.weather || null);

        if (existingLog.photoIds?.length && projectId) {
          const photos = await getProjectPhotosByIds(projectId, existingLog.photoIds);
          if (!cancelled) {
            setAttachedPhotos(
              photos.map((photo) => ({
                id: photo.id,
                uri: photo.localUri,
                existing: true,
                caption: photo.caption,
              }))
            );
          }
        } else if (!cancelled) {
          setAttachedPhotos([]);
        }
      } else {
        setLogDate(toDateString(new Date()));
        setNoteText("");
        setWeather(null);
        setAttachedPhotos([]);
      }
      if (!cancelled) setSaving(false);
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [visible, existingLog, projectId]);

  const resetAndClose = () => {
    setNoteText("");
    setWeather(null);
    setAttachedPhotos([]);
    onClose();
  };

  const addPhotoAsset = (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset?.uri) return;
    setAttachedPhotos((prev) => {
      if (prev.length >= MAX_LOG_PHOTOS) return prev;
      return [
        ...prev,
        {
          id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          uri: asset.uri,
          existing: false,
        },
      ];
    });
  };

  const takePhoto = async () => {
    if (attachedPhotos.length >= MAX_LOG_PHOTOS) {
      Alert.alert("Photo limit", `You can attach up to ${MAX_LOG_PHOTOS} photos per log.`);
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Camera needed", "Allow camera access to take site photos.");
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
        exif: false,
        base64: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        addPhotoAsset(result.assets[0]);
      }
    } catch (error) {
      console.error("Daily log camera error:", error);
      Alert.alert("Error", "Failed to take photo.");
    }
  };

  const pickFromLibrary = async () => {
    if (attachedPhotos.length >= MAX_LOG_PHOTOS) {
      Alert.alert("Photo limit", `You can attach up to ${MAX_LOG_PHOTOS} photos per log.`);
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Photos needed", "Allow photo library access to attach site photos.");
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: Math.max(1, MAX_LOG_PHOTOS - attachedPhotos.length),
        quality: 0.7,
        exif: false,
        base64: false,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.length) {
        setAttachedPhotos((prev) => {
          const remaining = MAX_LOG_PHOTOS - prev.length;
          if (remaining <= 0) return prev;
          const toAdd = result.assets.slice(0, remaining).map((asset) => ({
            id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            uri: asset.uri,
            existing: false,
          }));
          return [...prev, ...toAdd];
        });
      }
    } catch (error) {
      console.error("Daily log library error:", error);
      Alert.alert("Error", "Failed to open photo library.");
    }
  };

  const removeAttachedPhoto = (photoId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAttachedPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
  };

  const updateAttachedPhotoCaption = (photoId: string, caption: string) => {
    setAttachedPhotos((prev) =>
      prev.map((photo) => (photo.id === photoId ? { ...photo, caption } : photo))
    );
  };

  const handleSave = async () => {
    if (!projectId) {
      Alert.alert("Error", "No project selected.");
      return;
    }
    if (!noteText.trim()) {
      Alert.alert("Required", "Please enter notes about today's work.");
      return;
    }

    const logId = existingLog?.id ?? `log-${Date.now()}`;
    const originalPhotoIds = new Set(existingLog?.photoIds || []);

    try {
      setSaving(true);

      for (const photoId of originalPhotoIds) {
        if (!attachedPhotos.some((photo) => photo.id === photoId)) {
          await deleteProjectPhoto(projectId, photoId);
        }
      }

      const photoIds: string[] = [];
      for (const photo of attachedPhotos) {
        if (photo.existing) {
          await updateProjectPhotoCaption(projectId, photo.id, photo.caption);
          photoIds.push(photo.id);
        } else {
          const saved = await saveProjectPhoto(projectId, {
            localUri: photo.uri,
            source: "daily_log",
            dailyLogId: logId,
            caption: photo.caption?.trim() || undefined,
          });
          photoIds.push(saved.id);
        }
      }
      await linkPhotosToDailyLog(projectId, logId, photoIds);

      const entry: DailyLogEntry = {
        id: logId,
        date: logDate,
        noteText: noteText.trim(),
        weather,
        crewCount: existingLog?.crewCount ?? null,
        hoursWorked: existingLog?.hoursWorked ?? null,
        createdAt: existingLog?.createdAt ?? new Date().toISOString(),
        photoIds,
      };

      if (isEditing) {
        await updateDailyLog(projectId, entry);
      } else {
        await saveDailyLog(projectId, entry);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      resetAndClose();
    } catch (error) {
      console.error("❌ Error saving daily log:", error);
      Alert.alert("Error", "Failed to save daily log. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const formattedDate = useMemo(() => {
    try {
      const d = new Date(`${logDate}T12:00:00`);
      return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    } catch {
      return logDate;
    }
  }, [logDate]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.container, { backgroundColor: Colors.bg }]}>
        <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
              <View style={styles.backButtonWrapper}>
                <LinearGradient
                  colors={BRAND_FRAME_GRADIENT_COLORS}
                  start={BRAND_FRAME_GRADIENT_START}
                  end={BRAND_FRAME_GRADIENT_END}
                  style={styles.backButtonBorder}
                >
                  <GradientRingBackInner
                    darkMode={darkMode}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      resetAndClose();
                    }}
                    style={[styles.backButton, !darkMode && { backgroundColor: Colors.bg }]}
                  >
                    <MaterialIcons
                      name="arrow-back"
                      size={24}
                      color={darkMode ? "#FFFFFF" : Colors.text}
                    />
                  </GradientRingBackInner>
                </LinearGradient>
              </View>
              <View style={styles.headerTitleContainer}>
                <Text style={[styles.title, !darkMode && { color: Colors.text }]}>
                  {isEditing ? "Edit Daily Log" : "Daily Log"}
                </Text>
                <Text style={[styles.subtitle, !darkMode && { color: Colors.sub }]}>
                  {isEditing ? "Update site notes for this entry" : "Record site notes for this job"}
                </Text>
              </View>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView
              style={[styles.form, { backgroundColor: Colors.bg }]}
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              showsVerticalScrollIndicator={false}
              {...FORM_KEYBOARD_SCROLL_PROPS}
            >
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardLabel}>Log date</Text>
              <Text style={styles.summaryCardValue}>{formattedDate}</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Date</Text>
              <View style={styles.calendarWrap}>
                <GreyCalendar
                  initialDate={logDate}
                  selectedDateString={logDate}
                  onDayPress={(day) => setLogDate(day.dateString)}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, !darkMode && { color: Colors.text }]}>Notes *</Text>
              <View style={[styles.inputWrapper, styles.textAreaWrapper, fieldSurface]}>
                <TextInput
                  key={`daily-log-notes-${notesInputKey}`}
                  ref={notesRef}
                  style={[styles.input, styles.textArea, !darkMode && { color: Colors.text }]}
                  placeholder="What happened on site today? Progress, delays, issues..."
                  placeholderTextColor={placeholderTint}
                  value={noteText}
                  onChangeText={setNoteText}
                  multiline
                  scrollEnabled={false}
                  textAlignVertical="top"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  {...(Platform.OS === "ios"
                    ? { keyboardAppearance: darkMode ? "dark" : "light" }
                    : {})}
                  {...resolveTextInputKeyboardProps({ multiline: true })}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, !darkMode && { color: Colors.text }]}>Site photos</Text>
              <Text style={[styles.photoHint, !darkMode && { color: Colors.sub }]}>
                Attach inspection or progress photos for this log.
              </Text>
              <View style={styles.photoActionsRow}>
                <TouchableOpacity
                  style={[styles.photoActionButton, fieldSurface]}
                  onPress={takePhoto}
                >
                  <MaterialIcons name="photo-camera" size={20} color="#22d3ee" />
                  <Text style={styles.photoActionText}>Take photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoActionButton, fieldSurface]}
                  onPress={pickFromLibrary}
                >
                  <MaterialIcons name="photo-library" size={20} color="#22d3ee" />
                  <Text style={styles.photoActionText}>Library</Text>
                </TouchableOpacity>
              </View>
              {attachedPhotos.length > 0 ? (
                <View style={styles.photoList}>
                  {attachedPhotos.map((photo) => (
                    <View key={photo.id} style={styles.photoItem}>
                      <View style={styles.photoThumbWrap}>
                        <Image source={{ uri: photo.uri }} style={styles.photoThumb} resizeMode="cover" />
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removeAttachedPhoto(photo.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialIcons name="close" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        value={photo.caption || ""}
                        onChangeText={(text) => updateAttachedPhotoCaption(photo.id, text)}
                        placeholder="Description (optional)"
                        placeholderTextColor={placeholderTint}
                        multiline
                        scrollEnabled={false}
                        textAlignVertical="top"
                        onSubmitEditing={() => Keyboard.dismiss()}
                        {...(Platform.OS === "ios"
                          ? { keyboardAppearance: darkMode ? "dark" : "light" }
                          : {})}
                        {...resolveTextInputKeyboardProps({ multiline: true })}
                        style={[
                          styles.photoCaptionInput,
                          fieldSurface,
                          { color: Colors.text },
                        ]}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, !darkMode && { color: Colors.text }]}>Weather</Text>
              <View style={styles.chipRow}>
                {WEATHER_OPTIONS.map((option) => {
                  const selected = weather === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.chip,
                        fieldSurface,
                        selected && styles.chipSelected,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setWeather(selected ? null : option);
                      }}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[
                estimateFlowPrimaryButtonStyle(),
                { marginTop: 8 },
                saving && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              <MaterialIcons name="check" size={22} color="#071018" />
              <Text style={estimateFlowPrimaryButtonTextStyle()}>
                {saving ? "Saving..." : isEditing ? "Save changes" : "Save daily log"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    marginBottom: 8,
  },
  backButtonWrapper: {
    marginRight: 12,
  },
  backButtonBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: "hidden",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 19,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "#8DA0B8",
    fontSize: 14,
    marginTop: 4,
    fontWeight: "500",
  },
  form: {
    flex: 1,
    paddingHorizontal: 20,
  },
  summaryCard: {
    backgroundColor: "rgba(34, 211, 238, 0.08)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.22)",
    padding: 16,
    marginBottom: 16,
  },
  summaryCardLabel: {
    color: "rgba(226, 232, 240, 0.72)",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  summaryCardValue: {
    color: "#22d3ee",
    fontSize: 18,
    fontWeight: "700",
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    color: "rgba(226, 232, 240, 0.86)",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  calendarWrap: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  textAreaWrapper: {
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    paddingVertical: 14,
  },
  textArea: {
    minHeight: 160,
    paddingTop: 0,
    paddingBottom: 0,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipSelected: {
    borderColor: "#22d3ee",
    backgroundColor: "rgba(34, 211, 238, 0.15)",
  },
  chipText: {
    color: "rgba(226, 232, 240, 0.82)",
    fontSize: 14,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: "#22d3ee",
  },
  photoHint: {
    color: "rgba(226, 232, 240, 0.62)",
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  },
  photoActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  photoActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  photoActionText: {
    color: "#22d3ee",
    fontSize: 14,
    fontWeight: "700",
  },
  photoThumbRow: {
    gap: 10,
    paddingVertical: 2,
  },
  photoList: {
    gap: 12,
    marginTop: 4,
  },
  photoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  photoCaptionInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 88,
  },
  photoThumbWrap: {
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
  },
  photoThumb: {
    width: "100%",
    height: "100%",
  },
  photoRemoveButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
});
