import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { BusinessTermDraft } from "@/lib/proposals/contractWordingSerialization";
import { previewFromDrafts } from "@/lib/proposals/contractWordingSerialization";

type ColorsLike = {
  text: string;
  sub: string;
  line?: string;
  surface2?: string;
  bg?: string;
};

function hapticLight() {
  if (Platform.OS !== "web") {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

function AutoGrowTextInput({
  value,
  onChangeText,
  style,
  minHeight = 52,
  ...rest
}: React.ComponentProps<typeof TextInput> & { minHeight?: number }) {
  const [h, setH] = useState(minHeight);
  return (
    <TextInput
      {...rest}
      value={value}
      onChangeText={onChangeText}
      multiline
      scrollEnabled={false}
      textAlignVertical="top"
      onContentSizeChange={(e) => {
        const next = Math.max(minHeight, Math.ceil(e.nativeEvent.contentSize.height));
        setH(next);
      }}
      style={[style, { height: h, minHeight }]}
    />
  );
}

function IconRow({
  onDuplicate,
  onDelete,
  onUp,
  onDown,
  disableUp,
  disableDown,
  accent,
  muted,
}: {
  onDuplicate: () => void;
  onDelete: () => void;
  onUp: () => void;
  onDown: () => void;
  disableUp: boolean;
  disableDown: boolean;
  accent: string;
  muted: string;
}) {
  const hit = { padding: 8, marginHorizontal: -4 };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      <TouchableOpacity
        onPress={() => {
          hapticLight();
          onDuplicate();
        }}
        style={hit}
        accessibilityLabel="Duplicate"
      >
        <MaterialIcons name="content-copy" size={20} color={accent} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          hapticLight();
          onDelete();
        }}
        style={hit}
        accessibilityLabel="Delete"
      >
        <MaterialIcons name="delete-outline" size={22} color="rgba(248,113,113,0.95)" />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          if (!disableUp) {
            hapticLight();
            onUp();
          }
        }}
        style={hit}
        disabled={disableUp}
        accessibilityLabel="Move up"
      >
        <MaterialIcons name="keyboard-arrow-up" size={24} color={disableUp ? muted : accent} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          if (!disableDown) {
            hapticLight();
            onDown();
          }
        }}
        style={hit}
        disabled={disableDown}
        accessibilityLabel="Move down"
      >
        <MaterialIcons name="keyboard-arrow-down" size={24} color={disableDown ? muted : accent} />
      </TouchableOpacity>
    </View>
  );
}

function PdfPreviewColumn({
  assumptions,
  businessTerms,
  workNotes,
  colors,
  darkMode,
}: {
  assumptions: string[];
  businessTerms: BusinessTermDraft[];
  workNotes: string[];
  colors: ColorsLike;
  darkMode: boolean;
}) {
  const preview = previewFromDrafts(assumptions, businessTerms, workNotes);
  const panel = {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: darkMode ? "rgba(255,255,255,0.08)" : (colors.line ?? "#e5e5e5"),
    backgroundColor: darkMode ? "rgba(255,255,255,0.02)" : (colors.surface2 ?? "#f5f5f5"),
    padding: 12,
    marginBottom: 10,
  };
  const smallTitle = {
    color: "#2DFFC4",
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    marginBottom: 6,
  };
  const lineText = { color: colors.sub, fontSize: 11, lineHeight: 16, marginBottom: 4 };

  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text
        style={{
          color: colors.text,
          fontSize: 13,
          fontWeight: "800",
          marginBottom: 10,
        }}
      >
        PDF preview
      </Text>
      <Text style={{ color: colors.sub, fontSize: 11, lineHeight: 16, marginBottom: 12 }}>
        Summary of how items will appear (bullets, numbered terms, job-specific list).
      </Text>
      <ScrollView
        style={{ maxHeight: 560 }}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        <View style={panel}>
          <Text style={smallTitle}>Project Assumptions</Text>
          {preview.assumptions.length === 0 ? (
            <Text style={lineText}>(No bullets yet)</Text>
          ) : (
            preview.assumptions.map((line, i) => (
              <Text key={`a-${i}`} style={lineText}>
                • {line}
              </Text>
            ))
          )}
        </View>
        <View style={panel}>
          <Text style={smallTitle}>Business Terms</Text>
          {preview.business.length === 0 ? (
            <Text style={lineText}>(No terms yet)</Text>
          ) : (
            preview.business.map((line, i) => (
              <Text key={`b-${i}`} style={lineText}>
                {i + 1}. {line}
              </Text>
            ))
          )}
        </View>
        <View style={panel}>
          <Text style={smallTitle}>Job-Specific Assumptions</Text>
          {preview.work.length === 0 ? (
            <Text style={lineText}>(No assumptions yet)</Text>
          ) : (
            preview.work.map((line, i) => (
              <Text key={`w-${i}`} style={lineText}>
                • {line}
              </Text>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

export type ContractWordingEditorProps = {
  colors: ColorsLike;
  darkMode: boolean;
  isWeb: boolean;
  desktopTwoColumn: boolean;
  assumptions: string[];
  onChangeAssumptions: (next: string[]) => void;
  businessTerms: BusinessTermDraft[];
  onChangeBusinessTerms: (next: BusinessTermDraft[]) => void;
  workNotes: string[];
  onChangeWorkNotes: (next: string[]) => void;
  onResetAssumptions: () => void;
  onResetBusinessTerms: () => void;
  onResetWorkNotes: () => void;
  onResetAll: () => void;
};

export function ContractWordingEditor({
  colors,
  darkMode,
  isWeb,
  desktopTwoColumn,
  assumptions,
  onChangeAssumptions,
  businessTerms,
  onChangeBusinessTerms,
  workNotes,
  onChangeWorkNotes,
  onResetAssumptions,
  onResetBusinessTerms,
  onResetWorkNotes,
  onResetAll,
}: ContractWordingEditorProps) {
  const accent = "#2DFFC4";
  const iconMuted = darkMode ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.22)";
  /** Outer section frame: bordered panel on web only; native stays flat so clause cards are not double-boxed. */
  const sectionChrome = isWeb
    ? {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: darkMode ? "rgba(255,255,255,0.08)" : (colors.line ?? "#e5e5e5"),
        backgroundColor: darkMode ? "rgba(255,255,255,0.02)" : (colors.surface2 ?? "#fafafa"),
        padding: 16,
        marginBottom: 0,
      }
    : {
        borderRadius: 0,
        borderWidth: 0,
        borderColor: "transparent",
        backgroundColor: "transparent",
        padding: 0,
        marginBottom: 0,
      };
  const inputBase = {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: darkMode ? "rgba(255,255,255,0.12)" : (colors.line ?? "#e5e5e5"),
    backgroundColor: darkMode ? "rgba(255,255,255,0.04)" : (colors.bg ?? "#fff"),
    color: colors.text,
    fontSize: isWeb ? 14 : 13,
    lineHeight: isWeb ? 22 : 20,
    ...(isWeb ? ({ outlineStyle: "none", outlineWidth: 0 } as object) : {}),
  };

  const moveString = useCallback(
    (arr: string[], i: number, delta: number) => {
      const j = i + delta;
      if (j < 0 || j >= arr.length) return arr;
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    },
    [],
  );

  const moveBusiness = useCallback((arr: BusinessTermDraft[], i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= arr.length) return arr;
    const next = [...arr];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  }, []);

  const sectionEyebrow = {
    color: accent,
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    marginBottom: 8,
  };

  const helperAssumptions = (
    <Text style={{ color: colors.sub, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>
      Each item becomes a bullet on the final PDF.
    </Text>
  );
  const helperBusiness = (
    <Text style={{ color: colors.sub, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>
      Each item becomes a numbered contract term on the final PDF.
    </Text>
  );
  const helperJobSpecific = (
    <Text style={{ color: colors.sub, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>
      Each item becomes a bullet on the final PDF.
    </Text>
  );

  const sectionActions = (addLabel: string, onAdd: () => void, onReset: () => void) => (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginTop: 12,
        alignItems: "center",
      }}
    >
      <TouchableOpacity
        onPress={() => {
          hapticLight();
          onAdd();
        }}
        activeOpacity={0.75}
      >
        <Text style={{ color: accent, fontSize: 13, fontWeight: "700" }}>{addLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          hapticLight();
          onReset();
        }}
        activeOpacity={0.75}
      >
        <Text style={{ color: accent, fontSize: 13, fontWeight: "700" }}>Reset section</Text>
      </TouchableOpacity>
    </View>
  );

  const leftColumn = (
    <View style={{ flex: 1, gap: 16, minWidth: 0 }}>
      <View style={[sectionChrome, { marginTop: 4 }]}>
        <Text style={sectionEyebrow}>Project assumptions</Text>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
          What the Price Assumes
        </Text>
        {helperAssumptions}
        {assumptions.map((text, i) => (
          <View
            key={`pa-${i}`}
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: darkMode ? "rgba(255,255,255,0.1)" : (colors.line ?? "#eee"),
              backgroundColor: darkMode ? "rgba(255,255,255,0.03)" : (colors.bg ?? "#fff"),
              padding: 12,
              marginBottom: 10,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Text style={{ color: colors.sub, fontSize: 11, fontWeight: "700", marginBottom: 8 }}>
                Assumption {i + 1}
              </Text>
              <IconRow
                accent={accent}
                muted={iconMuted}
                disableUp={i === 0}
                disableDown={i === assumptions.length - 1}
                onDuplicate={() => {
                  const next = [...assumptions];
                  next.splice(i + 1, 0, text);
                  onChangeAssumptions(next);
                }}
                onDelete={() => {
                  if (assumptions.length <= 1) {
                    onChangeAssumptions([""]);
                    return;
                  }
                  onChangeAssumptions(assumptions.filter((_, idx) => idx !== i));
                }}
                onUp={() => onChangeAssumptions(moveString(assumptions, i, -1))}
                onDown={() => onChangeAssumptions(moveString(assumptions, i, 1))}
              />
            </View>
            <AutoGrowTextInput
              value={text}
              onChangeText={(t) => {
                const next = [...assumptions];
                next[i] = t;
                onChangeAssumptions(next);
              }}
              placeholder="e.g. Pricing includes permits listed in scope."
              placeholderTextColor={colors.sub}
              style={inputBase}
              minHeight={isWeb ? 56 : 48}
            />
          </View>
        ))}
        {sectionActions(
          "+ Add assumption",
          () => onChangeAssumptions([...assumptions, ""]),
          onResetAssumptions,
        )}
      </View>

      <View style={sectionChrome}>
        <Text style={sectionEyebrow}>Business terms</Text>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
          Business Terms
        </Text>
        {helperBusiness}
        {businessTerms.map((row, i) => (
          <View
            key={`bt-${i}`}
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: darkMode ? "rgba(255,255,255,0.1)" : (colors.line ?? "#eee"),
              backgroundColor: darkMode ? "rgba(255,255,255,0.03)" : (colors.bg ?? "#fff"),
              padding: 12,
              marginBottom: 10,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Text style={{ color: colors.sub, fontSize: 11, fontWeight: "700", marginBottom: 8 }}>
                Term {i + 1}
              </Text>
              <IconRow
                accent={accent}
                muted={iconMuted}
                disableUp={i === 0}
                disableDown={i === businessTerms.length - 1}
                onDuplicate={() => {
                  const next = [...businessTerms];
                  next.splice(i + 1, 0, { ...row });
                  onChangeBusinessTerms(next);
                }}
                onDelete={() => {
                  if (businessTerms.length <= 1) {
                    onChangeBusinessTerms([{ title: "", body: "" }]);
                    return;
                  }
                  onChangeBusinessTerms(businessTerms.filter((_, idx) => idx !== i));
                }}
                onUp={() => onChangeBusinessTerms(moveBusiness(businessTerms, i, -1))}
                onDown={() => onChangeBusinessTerms(moveBusiness(businessTerms, i, 1))}
              />
            </View>
            <Text style={{ color: colors.sub, fontSize: 11, marginBottom: 6 }}>Title</Text>
            <TextInput
              value={row.title}
              onChangeText={(t) => {
                const next = [...businessTerms];
                next[i] = { ...next[i], title: t };
                onChangeBusinessTerms(next);
              }}
              placeholder="e.g. Payments"
              placeholderTextColor={colors.sub}
              style={[inputBase, { minHeight: 44, marginBottom: 10 }]}
            />
            <Text style={{ color: colors.sub, fontSize: 11, marginBottom: 6 }}>Body</Text>
            <AutoGrowTextInput
              value={row.body}
              onChangeText={(t) => {
                const next = [...businessTerms];
                next[i] = { ...next[i], body: t };
                onChangeBusinessTerms(next);
              }}
              placeholder="Full clause text…"
              placeholderTextColor={colors.sub}
              style={inputBase}
              minHeight={isWeb ? 72 : 64}
            />
          </View>
        ))}
        {sectionActions(
          "+ Add business term",
          () => onChangeBusinessTerms([...businessTerms, { title: "", body: "" }]),
          onResetBusinessTerms,
        )}
      </View>

      <View style={sectionChrome}>
        <Text style={sectionEyebrow}>Job-specific assumptions</Text>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
          Job-Specific Assumptions
        </Text>
        {helperJobSpecific}
        {workNotes.map((text, i) => (
          <View
            key={`wn-${i}`}
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: darkMode ? "rgba(255,255,255,0.1)" : (colors.line ?? "#eee"),
              backgroundColor: darkMode ? "rgba(255,255,255,0.03)" : (colors.bg ?? "#fff"),
              padding: 12,
              marginBottom: 10,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Text style={{ color: colors.sub, fontSize: 11, fontWeight: "700", marginBottom: 8 }}>
                Job-specific {i + 1}
              </Text>
              <IconRow
                accent={accent}
                muted={iconMuted}
                disableUp={i === 0}
                disableDown={i === workNotes.length - 1}
                onDuplicate={() => {
                  const next = [...workNotes];
                  next.splice(i + 1, 0, text);
                  onChangeWorkNotes(next);
                }}
                onDelete={() => {
                  if (workNotes.length <= 1) {
                    onChangeWorkNotes([""]);
                    return;
                  }
                  onChangeWorkNotes(workNotes.filter((_, idx) => idx !== i));
                }}
                onUp={() => onChangeWorkNotes(moveString(workNotes, i, -1))}
                onDown={() => onChangeWorkNotes(moveString(workNotes, i, 1))}
              />
            </View>
            <AutoGrowTextInput
              value={text}
              onChangeText={(t) => {
                const next = [...workNotes];
                next[i] = t;
                onChangeWorkNotes(next);
              }}
              placeholder="Job-specific caveat or assumption…"
              placeholderTextColor={colors.sub}
              style={inputBase}
              minHeight={isWeb ? 56 : 48}
            />
          </View>
        ))}
        {sectionActions(
          "+ Add job-specific assumption",
          () => onChangeWorkNotes([...workNotes, ""]),
          onResetWorkNotes,
        )}
      </View>

      <View
        style={{
          marginTop: 4,
          paddingTop: 16,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: darkMode ? "rgba(255,255,255,0.08)" : (colors.line ?? "#e5e5e5"),
        }}
      >
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            onResetAll();
          }}
          activeOpacity={0.75}
        >
          <Text style={{ color: accent, fontSize: 14, fontWeight: "700" }}>Reset all to template defaults</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (desktopTwoColumn) {
    return (
      <View style={{ flexDirection: "row", gap: 20, alignItems: "flex-start" }}>
        {leftColumn}
        <View
          style={{
            width: 300,
            flexShrink: 0,
            paddingLeft: 16,
            borderLeftWidth: 1,
            borderLeftColor: darkMode ? "rgba(255,255,255,0.08)" : (colors.line ?? "#e5e5e5"),
          }}
        >
          <PdfPreviewColumn
            assumptions={assumptions}
            businessTerms={businessTerms}
            workNotes={workNotes}
            colors={colors}
            darkMode={darkMode}
          />
        </View>
      </View>
    );
  }

  return leftColumn;
}
