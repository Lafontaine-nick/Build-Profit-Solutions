import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  KeyboardNumericDoneAccessory,
  numericKeyboardDoneAccessoryId,
} from '../components/KeyboardNumericDoneAccessory';
import { KEYBOARD_SCROLL_DEFAULTS } from '@/constants/keyboardScrollProps';
import WebPageShell from '@/components/layout/WebPageShell';

const Colors = {
  bg: '#0d2745',
  card: '#173659',
  cardDark: '#132f54',
  text: '#e9f1ff',
  sub: '#a7bed9',
  line: '#1f3c66',
  primary: '#38d39f',
};

export default function ManualLaborEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [name, setName] = useState('');
  const [pricingMode, setPricingMode] = useState<'hourly' | 'sqft'>(
    (params.mode as string) === 'sqft' ? 'sqft' : 'hourly'
  );
  const [laborType, setLaborType] = useState<'inhouse' | 'subcontractor'>('inhouse');
  const [units, setUnits] = useState('1');
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setUnits('1');
    setRate('');
  }, [pricingMode]);

  const handleAdd = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a labor description');
      return;
    }
    if (!units || Number(units) <= 0) {
      Alert.alert('Error', `Please enter valid ${pricingMode === 'sqft' ? 'sq ft' : 'hours'}`);
      return;
    }
    if (!rate || Number(rate) <= 0) {
      Alert.alert('Error', 'Please enter a valid rate');
      return;
    }

    const laborData = {
      name: name.trim(),
      mode: pricingMode,
      laborType,
      hours: Number(units),
      rate: Number(rate),
      notes: notes?.trim() || '',
    };

    await AsyncStorage.setItem('manualLaborEntry', JSON.stringify(laborData));

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Added!', `${name} has been added to your labor items`, [
      {
        text: 'OK',
        onPress: () => router.back(),
      },
    ]);
  };

  const total = (Number(units) || 0) * (Number(rate) || 0);
  const quantityLabel = pricingMode === 'sqft' ? 'Square Feet' : 'Hours';
  const rateLabel = pricingMode === 'sqft' ? 'Rate ($/sq ft)' : 'Rate ($/hr)';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#0b1c38', '#1B365D', '#43cea2']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <KeyboardNumericDoneAccessory darkMode surfaceColor={Colors.bg} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.back();
                }}
                style={styles.backButton}
              >
                <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.titleContainer}>
                <Text style={styles.headerTitle}>Labor Pricing</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.contentCard}>
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                {...KEYBOARD_SCROLL_DEFAULTS}
              >
                <WebPageShell size="form" scroll={false} contentStyle={{ paddingBottom: 0 }}>
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="engineering" size={22} color="#43cea2" />
                    <Text style={styles.sectionTitle}>Labor Role *</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g., Framing Crew, Tile Installer"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    blurOnSubmit
                  />
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="tune" size={22} color="#43cea2" />
                    <Text style={styles.sectionTitle}>Pricing Mode</Text>
                  </View>
                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      onPress={() => setPricingMode('hourly')}
                      style={[styles.toggleButton, pricingMode === 'hourly' && styles.toggleButtonActive]}
                    >
                      <Text style={[styles.toggleText, pricingMode === 'hourly' && styles.toggleTextActive]}>⏰ Per Hour</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setPricingMode('sqft')}
                      style={[styles.toggleButton, pricingMode === 'sqft' && styles.toggleButtonActive]}
                    >
                      <Text style={[styles.toggleText, pricingMode === 'sqft' && styles.toggleTextActive]}>📐 Per Sq Ft</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="people" size={22} color="#43cea2" />
                    <Text style={styles.sectionTitle}>Labor Type</Text>
                  </View>
                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      onPress={() => setLaborType('inhouse')}
                      style={[styles.toggleButton, laborType === 'inhouse' && styles.toggleButtonActive]}
                    >
                      <Text style={[styles.toggleText, laborType === 'inhouse' && styles.toggleTextActive]}>👷 In-house</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setLaborType('subcontractor')}
                      style={[styles.toggleButton, laborType === 'subcontractor' && styles.toggleButtonActive]}
                    >
                      <Text style={[styles.toggleText, laborType === 'subcontractor' && styles.toggleTextActive]}>🔧 Subcontractor</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="calculate" size={22} color="#43cea2" />
                    <Text style={styles.sectionTitle}>Quantity & Rate *</Text>
                  </View>
                  <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>{quantityLabel}</Text>
                      <TextInput
                        style={styles.input}
                        value={units}
                        onChangeText={(text) => {
                          const cleanText = text.replace(/[^0-9.]/g, '');
                          setUnits(cleanText);
                        }}
                        keyboardType="decimal-pad"
                        inputAccessoryViewID={numericKeyboardDoneAccessoryId}
                        placeholder="1"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                      <Text style={styles.label}>{rateLabel}</Text>
                      <TextInput
                        style={styles.input}
                        value={rate}
                        onChangeText={(text) => {
                          const cleanText = text.replace(/[^0-9.]/g, '');
                          setRate(cleanText);
                        }}
                        keyboardType="decimal-pad"
                        inputAccessoryViewID={numericKeyboardDoneAccessoryId}
                        placeholder="0.00"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="notes" size={22} color="#43cea2" />
                    <Text style={styles.sectionTitle}>Notes (optional)</Text>
                  </View>
                  <TextInput
                    style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Add internal notes or reminders"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    multiline
                  />
                </View>

                <View style={styles.totalCard}>
                  <Text style={styles.totalLabel}>Estimated Total</Text>
                  <Text style={styles.totalAmount}>
                    $
                    {total.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>

                <TouchableOpacity onPress={handleAdd} style={styles.addButton}>
                  <MaterialIcons name="add-circle" size={24} color="#0d2745" />
                  <Text style={styles.addButtonText}>Add Labor Item</Text>
                </TouchableOpacity>
                </WebPageShell>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(67, 206, 162, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  contentCard: {
    flex: 1,
    marginHorizontal: 4,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 40, 80, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.2)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollContent: {
    padding: 16,
  },
  sectionCard: {
    backgroundColor: 'rgba(67, 206, 162, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.2)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  input: {
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    borderWidth: 1,
    borderColor: '#6B7280',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
  },
  inputGroup: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#43cea2',
    borderColor: '#43cea2',
  },
  toggleText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    fontSize: 14,
  },
  toggleTextActive: {
    color: '#0d2745',
    fontWeight: '700',
  },
  totalCard: {
    backgroundColor: 'rgba(67, 206, 162, 0.15)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  addButton: {
    backgroundColor: '#43cea2',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  addButtonText: {
    color: '#0d2745',
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 8,
  },
});





