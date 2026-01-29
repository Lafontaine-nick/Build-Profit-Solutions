import React, { useMemo, useState } from "react";
import { View, TextInput, Text, Pressable, Linking, StyleSheet } from "react-native";
import { SvgXml } from "react-native-svg";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";

const IG_REGEX = /^[a-zA-Z0-9._]{1,30}$/;

const IG_GRADIENT = `
<svg width="18" height="18" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="1" y2="0">
      <stop offset="0" stop-color="#f58529"/>
      <stop offset="0.5" stop-color="#dd2a7b"/>
      <stop offset="1" stop-color="#8134af"/>
    </linearGradient>
  </defs>
  <path fill="url(#g)"
    d="M224 202.7A53.3 53.3 0 1 0 277.3 256 53.38 53.38 0 0 0 224 202.7Zm124.7-41a54.9 54.9 0 0 0-31-31c-21.4-8.5-72.2-6.6-93.7-6.6s-72.3-1.9-93.7 6.6a54.9 54.9 0 0 0-31 31c-8.5 21.4-6.6 72.2-6.6 93.7s-1.9 72.3 6.6 93.7a54.9 54.9 0 0 0 31 31c21.4 8.5 72.2 6.6 93.7 6.6s72.3 1.9 93.7-6.6a54.9 54.9 0 0 0 31-31c8.5-21.4 6.6-72.2 6.6-93.7s1.9-72.3-6.6-93.7ZM224 338a82 82 0 1 1 82-82 82.09 82.09 0 0 1-82 82Zm85.3-148.5a19.2 19.2 0 1 1 19.2-19.2 19.2 19.2 0 0 1-19.2 19.2Z"/>
  <path fill="url(#g)"
    d="M400 32H48A48 48 0 0 0 0 80v352a48 48 0 0 0 48 48h352a48 48 0 0 0 48-48V80a48 48 0 0 0-48-48Zm-24 306.3a94.8 94.8 0 0 1-94.8 94.8H166.8A94.8 94.8 0 0 1 72 338.3V205.2A94.8 94.8 0 0 1 166.8 110.4H281a94.8 94.8 0 0 1 94.8 94.8Z"/>
</svg>
`;

function IGLogo() {
  return <SvgXml xml={IG_GRADIENT} />;
}

export default function InstagramField({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (v: string) => void;
}) {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === "#000000";
  const styles = useMemo(() => getStyles(darkMode, Colors), [darkMode, Colors]);
  const [username, setUsername] = useState(value?.replace(/^@/, "") ?? "");

  const isValid = useMemo(() => IG_REGEX.test(username), [username]);
  const igUrl = useMemo(() => `https://instagram.com/${username}`, [username]);

  return (
    <View style={styles.wrap}>
      <View style={styles.pill}>
        <IGLogo />
        <Text style={styles.pillText}> Instagram</Text>
      </View>

      <View style={[styles.inputWrap, !isValid && username ? styles.error : null]}>
        <Text style={styles.at}>@</Text>
        <TextInput
          value={username}
          onChangeText={(t) => {
            const clean = t.replace(/^@/, ""); // strip extra @ if pasted
            setUsername(clean);
            onChange?.(clean);
          }}
          placeholder="yourcompany"
          placeholderTextColor={darkMode ? "rgba(255,255,255,0.45)" : "#64748B"}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        {isValid && username.length > 0 && (
          <Pressable
            hitSlop={10}
            onPress={() => Linking.openURL(igUrl)}
            style={styles.previewBtn}
          >
            <Text style={styles.previewText}>Preview</Text>
          </Pressable>
        )}
      </View>

      {!isValid && username.length > 0 && (
        <Text style={styles.helper}>Only letters, numbers, "." and "_" (max 30)</Text>
      )}
    </View>
  );
}

const getStyles = (darkMode: boolean, Colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
  wrap: { gap: 8 },
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(225, 48, 108, 0.18)",
  },
  pillText: { fontWeight: "600", color: darkMode ? "#E2E8F0" : Colors.text },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(225, 48, 108, 0.3)",
    backgroundColor: darkMode ? "rgba(255,255,255,0.06)" : Colors.surface2,
    paddingHorizontal: 12,
    height: 52,
  },
  error: { borderColor: "rgba(255,80,80,0.7)" },
  at: { opacity: 0.7, fontWeight: "600", marginRight: 2, color: darkMode ? "#E2E8F0" : Colors.text },
  input: { flex: 1, height: "100%", fontSize: 16, color: darkMode ? "#E2E8F0" : Colors.text },
  previewBtn: { 
    paddingVertical: 6, 
    paddingHorizontal: 10, 
    borderRadius: 10,
    backgroundColor: "rgba(225, 48, 108, 0.2)",
  },
  previewText: { fontSize: 13, fontWeight: "600", color: "#E1306C" },
  helper: { color: "rgba(255,120,120,0.9)", fontSize: 12, marginTop: 4 },
});





