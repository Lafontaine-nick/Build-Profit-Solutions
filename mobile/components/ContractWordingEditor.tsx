import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ESTIMATE_FLOW_CHIP_GREEN,
  ESTIMATE_FLOW_GREEN,
} from "@/utils/estimateFlowCardStyle";
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
  Dimensions,
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
    color: ESTIMATE_FLOW_CHIP_GREEN,
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
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
  eyebrow,
  title,
  countLabel,
  helper,
  expanded,
  onToggle,
  children,
  colors,
  darkMode,
}: {
  eyebrow: string;
  title: string;
  countLabel: string;
  helper?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  colors: ColorsLike;
  darkMode: boolean;
}) {
  const border = darkMode ? "rgba(255,255,255,0.1)" : (colors.line ?? "#e5e5e5");
  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: darkMode ? "rgba(255,255,255,0.025)" : (colors.surface2 ?? "#fafafa"),
        overflow: "hidden",
      }}
    >
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
          paddingVertical: 12,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              color: ESTIMATE_FLOW_CHIP_GREEN,
              fontSize: 10,
              fontWeight: "800",
              letterSpacing: 1.1,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {eyebrow}
          </Text>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{title}</Text>
          <Text style={{ color: colors.sub, fontSize: 12, marginTop: 4 }}>{countLabel}</Text>
        </View>
        <MaterialIcons
          name={expanded ? "expand-less" : "expand-more"}
          size={24}
          color={ESTIMATE_FLOW_CHIP_GREEN}
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
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: darkMode ? "rgba(255,255,255,0.03)" : (colors.bg ?? "#fff"),
        borderWidth: 1,
        borderColor: darkMode ? "rgba(255,255,255,0.08)" : (colors.line ?? "#e5e5e5"),
        marginBottom: 8,
      }}
    >
      <Text
        style={{
          color: ESTIMATE_FLOW_CHIP_GREEN,
          fontSize: 12,
          fontWeight: "800",
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
  const linkColor = ESTIMATE_FLOW_GREEN;
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
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [textAreaHeight, setTextAreaHeight] = useState(140);
  const [bodyAreaHeight, setBodyAreaHeight] = useState(160);

  useEffect(() => {
    if (editTarget == null) {
      setKeyboardOpen(false);
      setTextAreaHeight(140);
      setBodyAreaHeight(160);
      return;
    }
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [editTarget]);

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
        justifyContent: "center",
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
        <Text style={{ color: linkColor, fontSize: 13, fontWeight: "700" }}>Reset section</Text>
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

  const headerTopPadding = Math.max(insets.top, Platform.OS === "ios" ? 12 : 0) + 8;
  const windowHeight = Dimensions.get("window").height;
  const textAreaMaxHeight = Math.round(windowHeight * (keyboardOpen ? 0.52 : 0.38));
  const textAreaMinHeight = 140;

  useEffect(() => {
    setTextAreaHeight((height) => Math.min(height, textAreaMaxHeight));
    setBodyAreaHeight((height) => Math.min(height, textAreaMaxHeight));
  }, [textAreaMaxHeight]);

  const clampTextAreaHeight = (contentHeight: number, min = textAreaMinHeight) =>
    Math.max(min, Math.min(textAreaMaxHeight, contentHeight + 28));

  const editorBody = (
    <View style={{ flex: 1, gap: 12, minWidth: 0 }}>
      <Text style={{ color: colors.sub, fontSize: 12, lineHeight: 18 }}>{summary}</Text>

      <CollapsibleSection
        eyebrow="Project assumptions"
        title="What the Price Assumes"
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

      <CollapsibleSection
        eyebrow="Business terms"
        title="Contract Terms"
        countLabel={`${businessTermCount} numbered clause${businessTermCount === 1 ? "" : "s"} on the agreement`}
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

      <CollapsibleSection
        eyebrow="Job-specific notes"
        title="Optional Project Notes"
        countLabel={
          workNoteCount === 0
            ? "None added — tap below to add custom language for this job"
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
              borderColor: darkMode ? "rgba(52,211,153,0.35)" : ESTIMATE_FLOW_CHIP_GREEN,
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

      <TouchableOpacity
        onPress={() => {
          hapticLight();
          onResetAll();
        }}
        activeOpacity={0.75}
        style={{ alignSelf: "flex-start", paddingVertical: 4 }}
      >
        <Text style={{ color: linkColor, fontSize: 14, fontWeight: "700" }}>Reset all to template defaults</Text>
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
            <View style={[styles.fullScreenHeader, { paddingTop: headerTopPadding }]}>
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  closeEdit();
                }}
                hitSlop={12}
                accessibilityLabel="Go back"
                style={styles.fullScreenHeaderBtn}
              >
                <MaterialIcons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 8 }}>
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }} numberOfLines={1}>
                  {modalTitle}
                </Text>
                {modalSubtitle ? (
                  <Text style={{ color: colors.sub, fontSize: 12, lineHeight: 17, marginTop: 2 }} numberOfLines={2}>
                    {modalSubtitle}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  saveEdit();
                }}
                hitSlop={12}
                accessibilityLabel="Save"
                style={styles.fullScreenHeaderBtn}
              >
                <Text style={{ color: ESTIMATE_FLOW_GREEN, fontSize: 16, fontWeight: "800" }}>Save</Text>
              </TouchableOpacity>
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
                  <Text style={{ color: colors.sub, fontSize: 11, marginBottom: 6 }}>Title</Text>
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
                  <Text style={{ color: colors.sub, fontSize: 11, marginBottom: 6 }}>Body</Text>
                  <TextInput
                    ref={bodyInputRef}
                    value={draftBody}
                    onChangeText={setDraftBody}
                    placeholder="Full clause text…"
                    placeholderTextColor={colors.sub}
                    multiline
                    scrollEnabled
                    textAlignVertical="top"
                    onContentSizeChange={(e) =>
                      setBodyAreaHeight(clampTextAreaHeight(e.nativeEvent.contentSize.height, 160))
                    }
                    onSubmitEditing={() => Keyboard.dismiss()}
                    style={[inputBase, { height: bodyAreaHeight }]}
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
                  onContentSizeChange={(e) =>
                    setTextAreaHeight(clampTextAreaHeight(e.nativeEvent.contentSize.height))
                  }
                  onSubmitEditing={() => Keyboard.dismiss()}
                  style={[inputBase, { height: textAreaHeight }]}
                  autoFocus
                  {...resolveTextInputKeyboardProps({ multiline: true })}
                />
              )}
            </ScrollView>
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
