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
import { LinearGradient } from "expo-linear-gradient";
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from "@/constants/brandFrameGradient";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import { FORM_KEYBOARD_SCROLL_PROPS } from "@/constants/keyboardScrollProps";
import { resolveTextInputKeyboardProps } from "@/constants/inputKeyboardPresets";
import {
  estimateFlowPrimaryButtonStyle,
  estimateFlowPrimaryButtonTextStyle,
} from "@/utils/estimateFlowCardStyle";
import { saveProjectPhoto } from "@/services/projectPhotoService";
import GradientRingBackInner from "@/components/GradientRingBackInner";

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

  const fieldSurface = useMemo(
    () => ({
      backgroundColor: darkMode ? "#18181b" : Colors.surface2,
      borderColor: darkMode ? "#3f3f46" : Colors.line,
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
              <Text style={[styles.title, !darkMode && { color: Colors.text }]}>Add site photo</Text>
              <Text style={[styles.subtitle, !darkMode && { color: Colors.sub }]}>
                Add to your project portfolio
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={[styles.form, { backgroundColor: Colors.bg }]}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            {...FORM_KEYBOARD_SCROLL_PROPS}
          >
          <Text style={[styles.hint, { color: Colors.sub }]}>
            Add progress or inspection photos directly to your project portfolio — no daily log required.
          </Text>

          {imageUri ? (
            <View style={[styles.previewWrap, { borderColor: fieldSurface.borderColor }]}>
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
                style={[styles.photoActionButton, fieldSurface]}
                onPress={() => pickImage("camera")}
              >
                <MaterialIcons name="photo-camera" size={22} color="#22d3ee" />
                <Text style={styles.photoActionText}>Take photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoActionButton, fieldSurface]}
                onPress={() => pickImage("library")}
              >
                <MaterialIcons name="photo-library" size={22} color="#22d3ee" />
                <Text style={styles.photoActionText}>Library</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: Colors.text }]}>Description</Text>
            <Text style={[styles.fieldHint, { color: Colors.sub }]}>Optional — note what this photo shows.</Text>
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
                fieldSurface,
                { color: Colors.text },
              ]}
            />
          </View>

          <TouchableOpacity
            style={[estimateFlowPrimaryButtonStyle(), saving && styles.saveDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <MaterialIcons name="add-photo-alternate" size={22} color="#071018" />
            <Text style={estimateFlowPrimaryButtonTextStyle()}>
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
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  photoActionText: {
    color: "#22d3ee",
    fontSize: 14,
    fontWeight: "700",
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
    fontWeight: "700",
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
  saveDisabled: {
    opacity: 0.65,
  },
});
