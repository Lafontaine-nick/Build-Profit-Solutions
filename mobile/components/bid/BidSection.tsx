import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

export default function BidSection({
  title, subtitle, complete, warnings = [], children, onValidate, onAIClick,
}: {
  title: string; 
  subtitle?: string; 
  complete?: boolean;
  warnings?: string[]; 
  onValidate?: () => void; 
  onAIClick?: () => void;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  
  return (
    <View style={s.wrap}>
      <TouchableOpacity onPress={() => setOpen(!open)} style={s.head} activeOpacity={0.85}>
        <View style={{ flex: 1 }}>
          <View style={s.row}>
            <Text style={s.title}>{title}</Text>
            <StatusBadge ok={!!complete} warn={warnings.length > 0} />
          </View>
          {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
        </View>
        <Text style={s.chev}>{open ? "▾" : "▸"}</Text>
      </TouchableOpacity>

      {open && (
        <View style={s.body}>
          {warnings.map((w, i) => <Text key={i} style={s.warn}>⚠︎ {w}</Text>)}
          {children}
          <View style={s.actions}>
            <TouchableOpacity style={s.btn} onPress={onAIClick}>
              <Text style={s.btnTextDark}>🤖 AI Tips</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnOutline]} onPress={onValidate}>
              <Text style={s.btnText}>✓ Validate</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const StatusBadge = ({ ok, warn }: { ok: boolean; warn: boolean }) => (
  <View style={[s.badge, { backgroundColor: warn ? "#ffd166" : ok ? "#38d39f" : "#8aa1ba" }]}>
    <Text style={{ color: "#0d1b2a", fontWeight: "900", fontSize: 12 }}>
      {warn ? "Review" : ok ? "Done" : "Pending"}
    </Text>
  </View>
);

const s = StyleSheet.create({
  wrap: { backgroundColor: "#132f54", borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: "#1f3c66" },
  head: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: "#e9f1ff", fontWeight: "800", fontSize: 18 },
  sub: { color: "#a7bed9", marginTop: 2 },
  chev: { color: "#e9f1ff", fontSize: 18 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  warn: { color: "#ffd166", fontWeight: "700", fontSize: 13 },
  actions: { flexDirection: "row", gap: 8, marginTop: 6 },
  btn: { flex: 1, backgroundColor: "#38d39f", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, alignItems: "center" },
  btnOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#a7bed9" },
  btnText: { color: "#e9f1ff", fontWeight: "800" },
  btnTextDark: { color: "#0d1b2a", fontWeight: "900" },
}); 