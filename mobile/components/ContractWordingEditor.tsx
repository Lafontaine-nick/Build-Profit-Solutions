import React, { useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  ScrollView,
  StyleSheet,
  Modal,
  Keyboard,
  StatusBar,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { BusinessTermDraft } from "@/lib/proposals/contractWordingSerialization";
import {
  formatContractWordingSummary,
  isNonemptyBusinessTerm,
  previewFromDrafts,
} from "@/lib/proposals/contractWordingSerialization";
import { FORM_KEYBOARD_SCROLL_PROPS } from "@/constants/keyboardScrollProps";
import { resolveTextInputKeyboardProps } from "@/constants/inputKeyboardPresets";
import BackButton from "@/components/ui/BackButton";

type ColorsLike = {
  text: string;
  sub: string;
  line?: string;
  surface2?: string;
  bg?: string;
};

type SectionKey = "assumptions" | "business" | "work";

type EditTarget =
  | { kind: "assumption"; index: number }
  | { kind: "business"; index: number }
  | { kind: "work"; index: number };

function hapticLight() {
  if (Platform.OS !== "web") {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

function previewLine(text: string, max = 96): string {
  const trimmed = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed) return "Empty — tap to edit";
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function businessTermTitle(row: BusinessTermDraft): string {
  return String(row.title ?? "").trim() || "Untitled term";
}

function businessTermSubtitle(row: BusinessTermDraft): string | undefined {
  const body = String(row.body ?? "").trim();
  return body ? previewLine(body, 96) : undefined;
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
    color: "#d7e1f0",
    fontSize: 12,
    fontWeight: "600" as const,
    marginBottom: 6,
  };
  const lineText = { color: colors.sub, fontSize: 11, lineHeight: 16, marginBottom: 4 };

  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: 10 }}>
        PDF preview
      </Text>
      <Text style={{ color: colors.sub, fontSize: 11, lineHeight: 16, marginBottom: 12 }}>
        Summary of how items will appear on the agreement.
      </Text>
      <ScrollView style={{ maxHeight: 560 }} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
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
        {preview.work.length > 0 ? (
          <View style={panel}>
            <Text style={smallTitle}>Job-Specific Notes</Text>
            {preview.work.map((line, i) => (
              <Text key={`w-${i}`} style={lineText}>
                • {line}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function CollapsibleSection({
  title,
  countLabel,
  helper,
  expanded,
  onToggle,
  children,
  colors,
  darkMode,
}: {
  title: string;
  countLabel: string;
  helper?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  colors: ColorsLike;
  darkMode: boolean;
}) {
  const border = darkMode ? "rgba(148, 163, 184, 0.12)" : (colors.line ?? "#e5e5e5");
  return (
    <View>
      <TouchableOpacity
        onPress={() => {
          hapticLight();
          onToggle();
        }}
        activeOpacity={0.75}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 14,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>{title}</Text>
          <Text style={{ color: "#d7e1f0", fontSize: 13, lineHeight: 18, marginTop: 4 }}>{countLabel}</Text>
        </View>
        <MaterialIcons
          name={expanded ? "expand-less" : "expand-more"}
          size={24}
          color={darkMode ? '#d7e1f0' : '#64748b'}
        />
      </TouchableOpacity>
      {expanded ? (
        <View
          style={{
            paddingHorizontal: 14,
            paddingBottom: 14,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: border,
          }}
        >
          {helper ? (
            <Text style={{ color: colors.sub, fontSize: 12, lineHeight: 18, marginTop: 10, marginBottom: 8 }}>
              {helper}
            </Text>
          ) : null}
          {children}
        </View>
      ) : null}
    </View>
  );
}

function CompactClauseRow({
  index,
  preview,
  subtitle,
  onPress,
  colors,
  darkMode,
}: {
  index: number;
  preview: string;
  subtitle?: string;
  onPress: () => void;
  colors: ColorsLike;
  darkMode: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={() => {
        hapticLight();
        onPress();
      }}
      activeOpacity={0.75}
      style={{
        flexDirection: "row",
        alignItems: subtitle ? "flex-start" : "center",
        gap: 10,
        paddingVertical: 12,
        marginBottom: 0,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: darkMode ? "rgba(148, 163, 184, 0.2)" : (colors.line ?? "#e5e5e5"),
      }}
    >
      <Text
        style={{
          color: "#d7e1f0",
          fontSize: 12,
          fontWeight: "700",
          width: 22,
          textAlign: "right",
          marginTop: subtitle ? 2 : 0,
        }}
      >
        {index + 1}
      </Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        {subtitle ? (
          <>
            <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" }} numberOfLines={1}>
              {preview}
            </Text>
            <Text style={{ color: colors.sub, fontSize: 12, lineHeight: 17, marginTop: 3 }} numberOfLines={2}>
              {subtitle}
            </Text>
          </>
        ) : (
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
            {preview}
          </Text>
        )}
      </View>
      <MaterialIcons name="chevron-right" size={20} color={colors.sub} style={{ marginTop: subtitle ? 2 : 0 }} />
    </TouchableOpacity>
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
  showSummary?: boolean;
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
  showSummary = true,
}: ContractWordingEditorProps) {
  const linkColor = "#e2e8f0";
  const resetColor = (darkMode ? "#d7e1f0" : "#64748b");
  const insets = useSafeAreaInsets();

  const assumptionCount = useMemo(
    () => assumptions.filter((s) => String(s).trim()).length,
    [assumptions],
  );
  const businessTermCount = useMemo(
    () => businessTerms.filter(isNonemptyBusinessTerm).length,
    [businessTerms],
  );
  const workNoteCount = useMemo(
    () => workNotes.filter((s) => String(s).trim()).length,
    [workNotes],
  );

  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    assumptions: false,
    business: false,
    work: false,
  });
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const bodyInputRef = useRef<TextInput>(null);
  const screenBg = darkMode ? "#000000" : (colors.bg ?? "#fff");

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

  const summary = useMemo(
    () => formatContractWordingSummary(assumptions, businessTerms, workNotes),
    [assumptions, businessTerms, workNotes],
  );

  const toggleSection = (key: SectionKey) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openEdit = (target: EditTarget) => {
    setEditTarget(target);
    if (target.kind === "business") {
      const row = businessTerms[target.index];
      setDraftTitle(row?.title ?? "");
      setDraftBody(row?.body ?? "");
      setDraftText("");
    } else if (target.kind === "assumption") {
      setDraftText(assumptions[target.index] ?? "");
      setDraftTitle("");
      setDraftBody("");
    } else {
      setDraftText(workNotes[target.index] ?? "");
      setDraftTitle("");
      setDraftBody("");
    }
  };

  const closeEdit = () => {
    Keyboard.dismiss();
    setEditTarget(null);
  };

  const saveEdit = () => {
    if (!editTarget) return;
    Keyboard.dismiss();
    if (editTarget.kind === "business") {
      const next = [...businessTerms];
      next[editTarget.index] = { title: draftTitle, body: draftBody };
      onChangeBusinessTerms(next);
    } else if (editTarget.kind === "assumption") {
      const next = [...assumptions];
      next[editTarget.index] = draftText;
      onChangeAssumptions(next);
    } else {
      const next = [...workNotes];
      next[editTarget.index] = draftText;
      onChangeWorkNotes(next);
    }
    closeEdit();
  };

  const deleteEdit = () => {
    if (!editTarget) return;
    Keyboard.dismiss();
    if (editTarget.kind === "business") {
      onChangeBusinessTerms(businessTerms.filter((_, i) => i !== editTarget.index));
    } else if (editTarget.kind === "assumption") {
      onChangeAssumptions(assumptions.filter((_, i) => i !== editTarget.index));
    } else {
      onChangeWorkNotes(workNotes.filter((_, i) => i !== editTarget.index));
    }
    closeEdit();
  };

  const editIndex = editTarget?.index ?? -1;
  const editKind = editTarget?.kind;

  const addAssumption = () => {
    const next = [...assumptions, ""];
    onChangeAssumptions(next);
    openEdit({ kind: "assumption", index: next.length - 1 });
  };

  const addBusinessTerm = () => {
    const next = [...businessTerms, { title: "", body: "" }];
    onChangeBusinessTerms(next);
    openEdit({ kind: "business", index: next.length - 1 });
  };

  const addWorkNote = () => {
    const next = [...workNotes, ""];
    onChangeWorkNotes(next);
    openEdit({ kind: "work", index: next.length - 1 });
  };

  const sectionActions = (addLabel: string, onAdd: () => void, onReset: () => void) => (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        marginTop: 4,
        alignItems: "center",
        justifyContent: "flex-start",
        width: "100%",
      }}
    >
      <TouchableOpacity
        onPress={() => {
          hapticLight();
          onAdd();
        }}
        activeOpacity={0.75}
      >
        <Text style={{ color: linkColor, fontSize: 13, fontWeight: "700" }}>{addLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          hapticLight();
          onReset();
        }}
        activeOpacity={0.75}
      >
        <Text style={{ color: resetColor, fontSize: 13, fontWeight: "600" }}>Reset section</Text>
      </TouchableOpacity>
    </View>
  );

  const modalTitle =
    editKind === "business"
      ? `Business term ${editIndex + 1}`
      : editKind === "assumption"
        ? `Assumption ${editIndex + 1}`
        : editKind === "work"
          ? `Job note ${editIndex + 1}`
          : "";

  const modalSubtitle =
    editKind === "business"
      ? "Title and body appear as a numbered clause on the agreement."
      : editKind === "assumption"
        ? "This becomes a bullet on the scope & pricing page."
        : editKind === "work"
          ? "Optional language for this project only."
          : "";

  const headerTopPadding = Math.max(insets.top, Platform.OS === "ios" ? 54 : 0) + 8;

  const editorBody = (
    <View style={{ minWidth: 0 }}>
      {showSummary ? (
        <Text style={{ color: colors.sub, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>{summary}</Text>
      ) : null}

      <View
        style={{
          borderRadius: 14,
          backgroundColor: darkMode ? "#202022" : (colors.surface2 ?? "#fafafa"),
          borderWidth: 1,
          borderColor: darkMode ? "rgba(148, 163, 184, 0.12)" : (colors.line ?? "#e5e5e5"),
          paddingHorizontal: 14,
        }}
      >
      <CollapsibleSection
        title="Project assumptions"
        countLabel={`${assumptionCount} bullet${assumptionCount === 1 ? "" : "s"} on the scope page`}
        helper="Each item becomes a bullet on the scope & pricing page."
        expanded={expanded.assumptions}
        onToggle={() => toggleSection("assumptions")}
        colors={colors}
        darkMode={darkMode}
      >
        {assumptions.map((text, i) => (
          <CompactClauseRow
            key={`pa-${i}`}
            index={i}
            preview={previewLine(text)}
            onPress={() => openEdit({ kind: "assumption", index: i })}
            colors={colors}
            darkMode={darkMode}
          />
        ))}
        {sectionActions("+ Add assumption", addAssumption, onResetAssumptions)}
      </CollapsibleSection>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: darkMode ? "rgba(148, 163, 184, 0.2)" : (colors.line ?? "#e5e5e5") }} />

      <CollapsibleSection
        title="Contract terms"
        countLabel={`${businessTermCount} clause${businessTermCount === 1 ? "" : "s"} on the agreement`}
        helper="Each item becomes a numbered term on the contract page."
        expanded={expanded.business}
        onToggle={() => toggleSection("business")}
        colors={colors}
        darkMode={darkMode}
      >
        {businessTerms.map((row, i) => (
          <CompactClauseRow
            key={`bt-${i}`}
            index={i}
            preview={businessTermTitle(row)}
            subtitle={businessTermSubtitle(row)}
            onPress={() => openEdit({ kind: "business", index: i })}
            colors={colors}
            darkMode={darkMode}
          />
        ))}
        {sectionActions("+ Add business term", addBusinessTerm, onResetBusinessTerms)}
      </CollapsibleSection>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: darkMode ? "rgba(148, 163, 184, 0.2)" : (colors.line ?? "#e5e5e5") }} />

      <CollapsibleSection
        title="Project notes"
        countLabel={
          workNoteCount === 0
            ? "None added"
            : `${workNoteCount} note${workNoteCount === 1 ? "" : "s"} on the contract page`
        }
        helper="Add only when this project needs language beyond the standard template."
        expanded={expanded.work}
        onToggle={() => toggleSection("work")}
        colors={colors}
        darkMode={darkMode}
      >
        {workNotes.length === 0 ? (
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              addWorkNote();
            }}
            activeOpacity={0.75}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: "rgba(148, 163, 184, 0.35)",
              marginBottom: 8,
            }}
          >
            <Text style={{ color: linkColor, fontSize: 13, fontWeight: "700", textAlign: "center" }}>
              + Add a project note
            </Text>
          </TouchableOpacity>
        ) : (
          workNotes.map((text, i) => (
            <CompactClauseRow
              key={`wn-${i}`}
              index={i}
              preview={previewLine(text)}
              onPress={() => openEdit({ kind: "work", index: i })}
              colors={colors}
              darkMode={darkMode}
            />
          ))
        )}
        {sectionActions("+ Add project note", addWorkNote, onResetWorkNotes)}
      </CollapsibleSection>
      </View>

      <TouchableOpacity
        onPress={() => {
          hapticLight();
          onResetAll();
        }}
        activeOpacity={0.75}
        style={{ alignSelf: "flex-start", marginTop: 16, paddingVertical: 4 }}
      >
        <Text style={{ color: resetColor, fontSize: 15, fontWeight: "600" }}>Reset all to template defaults</Text>
      </TouchableOpacity>

      <Modal
        visible={editTarget != null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeEdit}
        {...(Platform.OS !== "web" ? { statusBarTranslucent: true } : {})}
      >
        <View style={[styles.fullScreenRoot, { backgroundColor: screenBg }]}>
          <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
          <View style={{ flex: 1 }}>
            <View style={{ paddingTop: headerTopPadding, paddingHorizontal: 16, paddingBottom: 12 }} pointerEvents="box-none">
              <View style={{ minHeight: 44, justifyContent: "center" }} pointerEvents="box-none">
                <Text style={{ textAlign: "center", color: colors.text, fontSize: 18, fontWeight: "700", letterSpacing: -0.25, lineHeight: 23 }} numberOfLines={1}>
                  {modalTitle}
                </Text>
                <View style={{ position: "absolute", left: 0, zIndex: 2 }}>
                  <BackButton darkMode={darkMode} onPress={() => closeEdit()} accessibilityLabel="Go back" />
                </View>
              </View>
              {modalSubtitle ? (
                <Text style={{ textAlign: "center", color: "#d7e1f0", fontSize: 14, fontWeight: "500", marginTop: 4, lineHeight: 20 }}>
                  {modalSubtitle}
                </Text>
              ) : null}
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[
                styles.fullScreenBody,
                { paddingBottom: Math.max(insets.bottom, 16) + 8 },
              ]}
              showsVerticalScrollIndicator={false}
              {...FORM_KEYBOARD_SCROLL_PROPS}
            >
              {editKind === "business" ? (
                <>
                  <Text style={{ color: "#d7e1f0", fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Title</Text>
                  <TextInput
                    value={draftTitle}
                    onChangeText={setDraftTitle}
                    placeholder="e.g. Payments"
                    placeholderTextColor={colors.sub}
                    autoFocus
                    onSubmitEditing={() => bodyInputRef.current?.focus()}
                    style={[inputBase, { minHeight: 48, marginBottom: 16 }]}
                    {...resolveTextInputKeyboardProps()}
                  />
                  <Text style={{ color: "#d7e1f0", fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Body</Text>
                  <TextInput
                    ref={bodyInputRef}
                    value={draftBody}
                    onChangeText={setDraftBody}
                    placeholder="Full clause text…"
                    placeholderTextColor={colors.sub}
                    multiline
                    scrollEnabled
                    textAlignVertical="top"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    style={[inputBase, { minHeight: 160, maxHeight: 220 }]}
                    {...resolveTextInputKeyboardProps({ multiline: true })}
                  />
                </>
              ) : (
                <TextInput
                  value={draftText}
                  onChangeText={setDraftText}
                  placeholder={
                    editKind === "work" ? "Job-specific caveat or assumption…" : "Assumption text…"
                  }
                  placeholderTextColor={colors.sub}
                  multiline
                  scrollEnabled
                  textAlignVertical="top"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  style={[inputBase, { minHeight: 160, maxHeight: 220 }]}
                  autoFocus
                  {...resolveTextInputKeyboardProps({ multiline: true })}
                />
              )}
            </ScrollView>
            <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16), gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  saveEdit();
                }}
                activeOpacity={0.85}
                style={{
                  width: "100%",
                  backgroundColor: "#2dcc9a",
                  borderRadius: 14,
                  minHeight: 50,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#050B13", fontSize: 16, fontWeight: "800" }}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  deleteEdit();
                }}
                activeOpacity={0.75}
                style={{
                  minHeight: 44,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <MaterialIcons name="delete-outline" size={18} color="#ef4444" />
                <Text style={{ color: "#ef4444", fontSize: 15, fontWeight: "600" }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  if (desktopTwoColumn) {
    return (
      <View style={{ flexDirection: "row", gap: 20, alignItems: "flex-start" }}>
        {editorBody}
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

  return editorBody;
}

const styles = StyleSheet.create({
  fullScreenRoot: {
    flex: 1,
  },
  fullScreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 4,
  },
  fullScreenHeaderBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  fullScreenBody: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
});
