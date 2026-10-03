import React, { useEffect, useMemo, useState } from "react";
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
  Image,
  Platform,
  Keyboard,
  StatusBar,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import { FORM_KEYBOARD_SCROLL_PROPS } from "@/constants/keyboardScrollProps";
import { resolveTextInputKeyboardProps } from "@/constants/inputKeyboardPresets";
import { AI_FLOW_CARD_BG_DARK } from "@/utils/estimateFlowCardStyle";
import { saveProjectPhoto } from "@/services/projectPhotoService";

type Props = {
  visible: boolean;
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function AddProjectPhotoModal({
  visible,
  projectId,
  onClose,
  onSaved,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const placeholderTint = darkMode ? "rgba(226, 232, 240, 0.58)" : Colors.sub;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setImageUri(null);
    setCaption("");
    setSaving(false);
  }, [visible]);

  const buttonSurface = useMemo(
    () => ({
      backgroundColor: darkMode ? "#3A3A3C" : Colors.surface2,
      borderColor: darkMode ? "rgba(148, 163, 184, 0.35)" : Colors.line,
    }),
    [darkMode, Colors]
  );
  const textFieldSurface = useMemo(
    () => ({
      backgroundColor: darkMode ? AI_FLOW_CARD_BG_DARK : Colors.surface2,
      borderColor: darkMode ? "rgba(148, 163, 184, 0.12)" : Colors.line,
    }),
    [darkMode, Colors]
  );

  const resetAndClose = () => {
    setImageUri(null);
    setCaption("");
    onClose();
  };

  const pickImage = async (source: "camera" | "library") => {
    try {
      if (source === "camera") {
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
        if (!result.canceled && result.assets?.[0]?.uri) {
          setImageUri(result.assets[0].uri);
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Photos needed", "Allow photo library access to attach site photos.");
          return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.7,
          exif: false,
          base64: false,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
          setImageUri(result.assets[0].uri);
        }
      }
    } catch (error) {
      console.error("Add project photo picker error:", error);
      Alert.alert("Error", "Failed to open photo picker.");
    }
  };

  const handleSave = async () => {
    if (!projectId) {
      Alert.alert("Error", "No project selected.");
      return;
    }
    if (!imageUri) {
      Alert.alert("Photo required", "Take or choose a photo to add to the portfolio.");
      return;
    }

    try {
      setSaving(true);
      await saveProjectPhoto(projectId, {
        localUri: imageUri,
        source: "portfolio",
        caption: caption.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      resetAndClose();
    } catch (error) {
      console.error("Error saving project photo:", error);
      Alert.alert("Error", "Failed to save photo. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={resetAndClose}>
      <View style={[styles.container, { backgroundColor: Colors.bg }]}>
        <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header} pointerEvents="box-none">
            <View style={styles.headerTitleContainer} pointerEvents="none">
              <Text style={[styles.title, !darkMode && { color: Colors.text }]}>Add site photo</Text>
              <Text style={[styles.subtitle, !darkMode && { color: Colors.sub }]}>
                Add to your project portfolio
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                resetAndClose();
              }}
              style={[styles.backButton, !darkMode && { backgroundColor: "rgba(15, 23, 42, 0.06)" }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <MaterialIcons
                name="arrow-back"
                size={22}
                color={darkMode ? "#e2e8f0" : Colors.text}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={[styles.form, { backgroundColor: Colors.bg }]}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            {...FORM_KEYBOARD_SCROLL_PROPS}
          >
          <Text style={[styles.hint, { color: darkMode ? "#d7e1f0" : Colors.sub }]}>
            Add progress or inspection photos directly to your project portfolio — no daily log required.
          </Text>

          {imageUri ? (
            <View style={[styles.previewWrap, { borderColor: textFieldSurface.borderColor }]}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
              <TouchableOpacity
                style={styles.previewRemove}
                onPress={() => setImageUri(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoActionsRow}>
              <TouchableOpacity
                style={[styles.photoActionButton, buttonSurface]}
                onPress={() => pickImage("camera")}
              >
                <MaterialIcons name="photo-camera" size={20} color={darkMode ? '#d7e1f0' : '#64748b'} />
                <Text style={[styles.photoActionText, !darkMode && { color: Colors.text }]}>Take photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoActionButton, buttonSurface]}
                onPress={() => pickImage("library")}
              >
                <MaterialIcons name="photo-library" size={20} color={darkMode ? '#d7e1f0' : '#64748b'} />
                <Text style={[styles.photoActionText, !darkMode && { color: Colors.text }]}>Library</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: darkMode ? "#e2e8f0" : Colors.text }]}>Description</Text>
            <Text style={[styles.fieldHint, { color: darkMode ? "#d7e1f0" : Colors.sub }]}>Optional — note what this photo shows.</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="e.g. Kitchen demo complete, rough plumbing inspection"
              placeholderTextColor={placeholderTint}
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              onSubmitEditing={() => Keyboard.dismiss()}
              {...(Platform.OS === "ios" ? { keyboardAppearance: darkMode ? "dark" : "light" } : {})}
              {...resolveTextInputKeyboardProps({ multiline: true })}
              style={[
                styles.captionInput,
                textFieldSurface,
                { color: Colors.text },
              ]}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <MaterialIcons name="add-photo-alternate" size={22} color="#050B13" />
            <Text style={styles.saveButtonText}>
              {saving ? "Saving..." : "Add to portfolio"}
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    marginBottom: 8,
    minHeight: 56,
  },
  backButton: {
    position: "absolute",
    left: 16,
    top: 8,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    alignItems: "center",
    paddingHorizontal: 56,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.25,
    lineHeight: 23,
    textAlign: "center",
  },
  subtitle: {
    color: "#d7e1f0",
    fontSize: 13,
    marginTop: 2,
    fontWeight: "500",
    textAlign: "center",
  },
  form: {
    flex: 1,
    paddingHorizontal: 20,
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  photoActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  photoActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  photoActionText: {
    color: "rgba(226, 232, 240, 0.92)",
    fontSize: 15,
    fontWeight: "600",
  },
  previewWrap: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 16,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewRemove: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldGroup: {
    gap: 6,
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  fieldHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  captionInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 88,
  },
  saveButton: {
    width: "100%",
    backgroundColor: "#2dcc9a",
    borderRadius: 14,
    minHeight: 50,
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveButtonText: {
    color: "#050B13",
    fontSize: 16,
    fontWeight: "800",
  },
  saveDisabled: {
    opacity: 0.65,
  },
});
