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
  yellow: '#ffd166',
  blue: '#60a5fa',
  green: '#34d399',
  orange: '#fbbf24',
  red: '#f87171',
  purple: '#a78bfa',
};

const SECTIONS = {
  kitchen: ['Framing', 'Electrical', 'Plumbing', 'Cabinetry & Tops', 'Flooring', 'Drywall & Paint', 'Appliances'],
  bathroom: ['Framing', 'Electrical', 'Plumbing', 'Waterproof & Tile', 'Drywall & Paint', 'Fixtures'],
  room_addition: ['Sitework', 'Framing', 'Sheathing', 'Roofing', 'Windows & Doors', 'Electrical', 'Insulation', 'Drywall & Paint'],
  home_addition: ['Demolition', 'Framing', 'Electrical', 'Plumbing', 'Drywall & Paint', 'Flooring', 'Cabinetry & Tops', 'Finishes'],
  adu: ['Sitework', 'Foundation', 'Framing', 'Roofing', 'MEP Rough', 'Insulation', 'Drywall', 'Finishes'],
  garage_conversion: ['Demolition', 'Framing', 'Electrical', 'Insulation', 'Drywall & Paint', 'Flooring', 'Windows & Doors'],
  new_build: ['Sitework', 'Foundation', 'Framing', 'Sheathing', 'Roofing', 'MEP Rough', 'Insulation', 'Drywall', 'Finishes'],
  roofing: ['Demolition', 'Roof Deck', 'Underlayment', 'Roofing', 'Flashing', 'Gutters'],
  deck_patio: ['Demolition', 'Footings', 'Framing', 'Decking', 'Railing', 'Concrete & Pavers'],
  plumbing_service: ['Diagnostics', 'Plumbing', 'Fixtures', 'Water Heater', 'Finish & Cleanup'],
  landscaping: ['Hardscape', 'Softscape & Plants', 'Irrigation', 'Lighting'],
  other: ['Materials', 'Equipment', 'Permits', 'Other'],
};

const VENDORS = [
  { id: 'hd', name: 'Home Depot' },
  { id: 'lw', name: 'Lowes' },
  { id: 'loc', name: 'Local Supplier' },
];

export default function ManualMaterialEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const activeScope = (params.scope as string) || 'kitchen';
  const sections = SECTIONS[activeScope as keyof typeof SECTIONS] || SECTIONS.other;

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('loc');
  const [selectedSection, setSelectedSection] = useState(sections[0] || '');

  useEffect(() => {
    setSelectedSection(sections[0] || '');
  }, [activeScope, sections]);

  const handleAdd = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a material name');
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }
    if (!unitPrice || Number(unitPrice) <= 0) {
      Alert.alert('Error', 'Please enter a valid unit price');
      return;
    }

    const materialData = {
      name: name.trim(),
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      vendorId: selectedVendor,
      section: selectedSection,
    };

    await AsyncStorage.setItem('manualMaterialEntry', JSON.stringify(materialData));

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Added!', `${name} has been added to your materials`, [
      {
        text: 'OK',
        onPress: () => router.back(),
      },
    ]);
  };

  const total = (Number(quantity) || 0) * (Number(unitPrice) || 0);

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
                <Text style={styles.headerTitle}>Manual Material Entry</Text>
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
                    <MaterialIcons name="edit" size={22} color="#43cea2" />
                    <Text style={styles.sectionTitle}>Material Name *</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g., 2x4x8 Stud, Drywall Sheet, etc."
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    blurOnSubmit
                  />
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="calculate" size={22} color="#43cea2" />
                    <Text style={styles.sectionTitle}>Quantity & Price *</Text>
                  </View>
                  <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Quantity</Text>
                      <TextInput
                        style={styles.input}
                        value={quantity}
                        onChangeText={(text) => {
                          const cleanText = text.replace(/[^0-9.]/g, '');
                          setQuantity(cleanText);
                        }}
                        keyboardType="decimal-pad"
                        inputAccessoryViewID={numericKeyboardDoneAccessoryId}
                        placeholder="1"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                      <Text style={styles.label}>Unit Price ($)</Text>
                      <TextInput
                        style={styles.input}
                        value={unitPrice}
                        onChangeText={(text) => {
                          const cleanText = text.replace(/[^0-9.]/g, '');
                          setUnitPrice(cleanText);
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
                    <MaterialIcons name="store" size={22} color="#43cea2" />
                    <Text style={styles.sectionTitle}>Vendor</Text>
                  </View>
                  <View style={styles.chipRow}>
                    {VENDORS.map((vendor) => (
                      <TouchableOpacity
                        key={vendor.id}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedVendor(vendor.id);
                        }}
                        style={[styles.chip, selectedVendor === vendor.id && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, selectedVendor === vendor.id && styles.chipTextActive]}>{vendor.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="category" size={22} color="#43cea2" />
                    <Text style={styles.sectionTitle}>Section</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    <View style={styles.chipRow}>
                      {sections.map((section) => (
                        <TouchableOpacity
                          key={section}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSelectedSection(section);
                          }}
                          style={[styles.chip, selectedSection === section && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, selectedSection === section && styles.chipTextActive]}>{section}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.totalCard}>
                  <Text style={styles.totalLabel}>Total</Text>
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
                  <Text style={styles.addButtonText}>Add Material</Text>
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  chipActive: {
    backgroundColor: '#43cea2',
    borderColor: '#43cea2',
  },
  chipText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    fontSize: 14,
  },
  chipTextActive: {
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





