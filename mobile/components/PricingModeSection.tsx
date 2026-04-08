import React, { useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatMoneyFull } from "@/src/lib/budgetUtils";
import { useTheme } from "../contexts/ThemeContext";
import { getColors } from "../theme/getColors";

export type PricingMode = "flat" | "sqft";

export function sanitizeOneDecimalField(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    return parts[0] + "." + parts.slice(1).join("");
  }
  return cleaned;
}

type Props = {
  pricingMode: PricingMode;
  onPricingModeChange: (mode: PricingMode) => void;
  sqftInput: string;
  ratePerSqftInput: string;
  onSqftInputChange: (text: string) => void;
  onRatePerSqftInputChange: (text: string) => void;
  amount: string;
  onAmountChange: (text: string) => void;
  sqftRef?: React.RefObject<TextInput | null>;
  ratePerSqftRef?: React.RefObject<TextInput | null>;
  amountRef?: React.RefObject<TextInput | null>;
  onFlatAmountSubmitEditing?: () => void;
  onSqftSubmitEditing?: () => void;
  onRateSubmitEditing?: () => void;
  /** Shown next to the amount / total label (e.g. price reasonableness) */
  amountLabelAccessory?: React.ReactNode;
  /**
   * When set, flat mode renders this instead of the single $ amount field
   * (e.g. change order materials + labor breakdown).
   */
  flatReplacement?: React.ReactNode;
  /** Label for the row below Pricing when `flatReplacement` is used (default "Breakdown") */
  flatModeLabel?: string;
};

export default function PricingModeSection({
  pricingMode,
  onPricingModeChange,
  sqftInput,
  ratePerSqftInput,
  onSqftInputChange,
  onRatePerSqftInputChange,
  amount,
  onAmountChange,
  sqftRef,
  ratePerSqftRef,
  amountRef,
  onFlatAmountSubmitEditing,
  onSqftSubmitEditing,
  onRateSubmitEditing,
  amountLabelAccessory,
  flatReplacement,
  flatModeLabel,
}: Props) {
  const { theme, darkMode } = useTheme();
  const Colors = getColors(theme);

  const onFlatAmountChange = useCallback(
    (text: string) => onAmountChange(sanitizeOneDecimalField(text)),
    [onAmountChange]
  );

  return (
    <>
      <View style={styles.field}>
        <Text style={[styles.label, { color: Colors.text }]}>Pricing *</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPricingModeChange("flat");
            }}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: pricingMode === "flat" ? "#22c55e" : Colors.line,
              backgroundColor: pricingMode === "flat" ? "#22c55e" : Colors.surface2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: pricingMode === "flat" ? "#000000" : Colors.text,
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              💵 Flat amount
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPricingModeChange("sqft");
            }}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: pricingMode === "sqft" ? "#22c55e" : Colors.line,
              backgroundColor: pricingMode === "sqft" ? "#22c55e" : Colors.surface2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: pricingMode === "sqft" ? "#000000" : Colors.text,
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              📐 Per sq ft
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.field}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <Text style={[styles.label, { color: Colors.text, marginBottom: 0 }]}>
            {pricingMode === "sqft"
              ? "Total (calculated) *"
              : flatReplacement != null
                ? flatModeLabel ?? "Breakdown"
                : "Amount *"}
          </Text>
          {amountLabelAccessory}
        </View>

        {pricingMode === "sqft" ? (
          <>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: Colors.text, marginBottom: 8 }]}>
                  Square feet *
                </Text>
                <View
                  style={[
                    styles.amountInputContainer,
                    {
                      backgroundColor: Colors.surface2,
                      borderColor: Colors.line,
                      borderWidth: 1,
                      borderRadius: 12,
                    },
                  ]}
                >
                  <Feather
                    name="maximize-2"
                    size={16}
                    color="#8DA0B8"
                    style={{ marginLeft: 12, marginRight: 8 }}
                  />
                  <TextInput
                    ref={sqftRef}
                    style={[
                      styles.input,
                      styles.amountInput,
                      {
                        backgroundColor: "transparent",
                        borderWidth: 0,
                        color: Colors.text,
                      },
                    ]}
                    placeholder="0"
                    placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                    value={sqftInput}
                    onChangeText={onSqftInputChange}
                    keyboardType="numeric"
                    returnKeyType="next"
                    onSubmitEditing={onSqftSubmitEditing}
                    blurOnSubmit={false}
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: Colors.text, marginBottom: 8 }]}>
                  Rate ($/sq ft) *
                </Text>
                <View
                  style={[
                    styles.amountInputContainer,
                    {
                      backgroundColor: Colors.surface2,
                      borderColor: Colors.line,
                      borderWidth: 1,
                      borderRadius: 12,
                    },
                  ]}
                >
                  <Text style={styles.dollarSign}>$</Text>
                  <TextInput
                    ref={ratePerSqftRef}
                    style={[
                      styles.input,
                      styles.amountInput,
                      {
                        backgroundColor: "transparent",
                        borderWidth: 0,
                        color: Colors.text,
                      },
                    ]}
                    placeholder="0.00"
                    placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                    value={ratePerSqftInput}
                    onChangeText={onRatePerSqftInputChange}
                    keyboardType="numeric"
                    returnKeyType="next"
                    onSubmitEditing={onRateSubmitEditing}
                    blurOnSubmit={false}
                  />
                </View>
              </View>
            </View>
            <View
              style={{
                marginTop: 12,
                backgroundColor: "rgba(45, 255, 196, 0.1)",
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: "rgba(45, 255, 196, 0.3)",
              }}
            >
              <Text
                style={{
                  color: "#2DFFC4",
                  fontSize: 18,
                  fontWeight: "700",
                  textAlign: "center",
                }}
              >
                Total:{" "}
                {(() => {
                  const sq = parseFloat(sqftInput.replace(/[^0-9.]/g, "")) || 0;
                  const rate = parseFloat(ratePerSqftInput.replace(/[^0-9.]/g, "")) || 0;
                  const t = sq * rate;
                  return formatMoneyFull(t, { decimals: 2 });
                })()}
              </Text>
            </View>
          </>
        ) : flatReplacement != null ? (
          flatReplacement
        ) : (
          <View
            style={[
              styles.amountInputContainer,
              {
                backgroundColor: Colors.surface2,
                borderColor: Colors.line,
                borderWidth: 1,
                borderRadius: 12,
              },
            ]}
          >
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              ref={amountRef}
              style={[
                styles.input,
                styles.amountInput,
                {
                  backgroundColor: "transparent",
                  borderWidth: 0,
                  color: Colors.text,
                },
              ]}
              placeholder="0.00"
              placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
              value={amount}
              onChangeText={onFlatAmountChange}
              keyboardType="numeric"
              returnKeyType="next"
              onSubmitEditing={onFlatAmountSubmitEditing}
              blurOnSubmit={false}
            />
          </View>
        )}

        {amount &&
          !isNaN(parseFloat(amount)) &&
          pricingMode !== "sqft" &&
          flatReplacement == null && (
            <Text style={[styles.hint, { color: Colors.sub }]}>
              {formatMoneyFull(parseFloat(amount), { decimals: 2 })}
            </Text>
          )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  dollarSign: {
    fontSize: 18,
    fontWeight: "600",
    color: "#22c55e",
    marginLeft: 12,
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  amountInput: {
    paddingLeft: 4,
  },
  hint: {
    marginTop: 8,
    fontSize: 13,
  },
});
