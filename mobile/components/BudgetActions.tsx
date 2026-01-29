import React, { useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Image,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import AIExpenseValidation from './AIExpenseValidation';

const { width } = Dimensions.get('window');

/** ---------- Types (simple) ---------- */
export type LineItem = {
  id: string;
  category: string;
  budget: number;
  spent: number;
};
export type BudgetTotals = {
  plannedBudget: number;
  approvedChangeOrders: number;
  actualExpenses: number;
  committedPOs: number;
};

export type Expense = {
  id: string;
  category?: string;
  vendor?: string;
  amount: number;
  date?: string;
  notes?: string;
  receiptUri?: string | null;
};

export type ChangeOrder = {
  id: string;
  title?: string;
  amount: number; // positive = add, negative = credit
  approved: boolean; // approved affects Adjusted Budget
  notes?: string;
};

const uid = () => Math.random().toString(36).slice(2, 9);
const money = (n: number) =>
  (Math.round((n || 0) * 100) / 100).toLocaleString(undefined, { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  });

/** ---------- Enhanced Action Tile with Animations ---------- */
function ActionTile({
  icon = '⚡',
  label,
  bg = 'rgba(15,32,52,0.95)',
  onPress,
  delay = 0,
}: {
  icon?: string;
  label: string;
  bg?: string;
  onPress: () => void;
  delay?: number;
}) {
  const scaleAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 600,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 600,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnimation }],
        opacity: fadeAnimation,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[styles.tile, { backgroundColor: bg }]}
      >
        <Text style={styles.tileIcon}>{icon}</Text>
        <Text style={styles.tileText}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/** ---------- Enhanced Modal with Animations ---------- */
function AnimatedModal({
  visible,
  onClose,
  children,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}) {
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const translateY = slideAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType='none'
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnimation }]}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ translateY }],
              opacity: fadeAnimation,
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/** ---------- Enhanced Form Input with Focus Animation ---------- */
function AnimatedInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  multiline?: boolean;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnimation = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(focusAnimation, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  const borderColor = focusAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0, 0, 0, 0.1)', '#43cea2'],
  });

  return (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Animated.View style={{ borderColor }}>
        <TextInput
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            isFocused && styles.inputFocused,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          multiline={multiline}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </Animated.View>
    </View>
  );
}

/** ---------- Main Component ---------- */
export default function BudgetActions({
  onAddExpense,
  onAddChangeOrder,
}: {
  onAddExpense: (expense: Expense) => void;
  onAddChangeOrder: (changeOrder: ChangeOrder) => void;
}) {
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddChangeOrder, setShowAddChangeOrder] = useState(false);
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);

  // Form states
  const [f, setF] = useState<Partial<Expense>>({});
  const [co, setCo] = useState<Partial<ChangeOrder>>({});

  // Animation values
  const containerAnimation = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(containerAnimation, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const scanReceipt = async () => {
    try {
      setIsProcessingReceipt(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;

        // Simulate OCR processing with loading animation
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Mock OCR results
        const mockOCRData = {
          vendor: 'Home Depot',
          amount: 125.5,
          category: 'Materials',
          date: new Date().toISOString(),
        };

        setF(prev => ({
          ...prev,
          ...mockOCRData,
          receiptUri: imageUri,
        }));

        Alert.alert(
          'Receipt Scanned! 📄',
          `Found: ${mockOCRData.vendor} - $${mockOCRData.amount}`,
          [{ text: 'Great!', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Receipt scanning error:', error);
      Alert.alert('Error', 'Failed to scan receipt. Please try again.');
    } finally {
      setIsProcessingReceipt(false);
    }
  };

  const handleAddExpense = () => {
    if (!f.vendor || !f.amount) {
      Alert.alert('Missing Info', 'Please fill in vendor and amount.');
      return;
    }

    const expense: Expense = {
      id: uid(),
      vendor: f.vendor,
      amount: Number(f.amount),
      category: f.category || 'Uncategorized',
      date: f.date || new Date().toISOString(),
      notes: f.notes || '',
      receiptUri: f.receiptUri || null,
    };

    onAddExpense(expense);
    setF({});
    setShowAddExpense(false);

    Alert.alert('Success! ✅', 'Expense added successfully.');
  };

  const handleAddChangeOrder = () => {
    if (!co.title || !co.amount) {
      Alert.alert('Missing Info', 'Please fill in title and amount.');
      return;
    }

    const changeOrder: ChangeOrder = {
      id: uid(),
      title: co.title,
      amount: Number(co.amount),
      approved: co.approved || false,
      notes: co.notes || '',
    };

    onAddChangeOrder(changeOrder);
    setCo({});
    setShowAddChangeOrder(false);

    Alert.alert('Success! ✅', 'Change order added successfully.');
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: containerAnimation,
          transform: [
            {
              translateY: containerAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={styles.sectionTitle}>Quick Actions</Text>

      <View style={styles.actionsGrid}>
        <ActionTile
          icon='💰'
          label='Add Expense'
          bg='linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          onPress={() => setShowAddExpense(true)}
          delay={0}
        />
        <ActionTile
          icon='📋'
          label='Change Order'
          bg='linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
          onPress={() => setShowAddChangeOrder(true)}
          delay={100}
        />
        <ActionTile
          icon='📄'
          label='Scan Receipt'
          bg='linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
          onPress={scanReceipt}
          delay={200}
        />
        <ActionTile
          icon='📊'
          label='Budget Report'
          bg='linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
          onPress={() =>
            Alert.alert('Coming Soon', 'Budget reports will be available soon!')
          }
          delay={300}
        />
      </View>

      {/* Add Expense Modal */}
      <AnimatedModal
        visible={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        title='Add New Expense'
      >
        <ScrollView
          style={styles.modalBody}
          showsVerticalScrollIndicator={false}
        >
          <AnimatedInput
            label='Vendor'
            value={f.vendor || ''}
            onChangeText={text => setF({ ...f, vendor: text })}
            placeholder='Enter vendor name'
          />

          <AnimatedInput
            label='Amount'
            value={f.amount?.toString() || ''}
            onChangeText={text => setF({ ...f, amount: text })}
            placeholder='0.00'
            keyboardType='numeric'
          />

          <AnimatedInput
            label='Category'
            value={f.category || ''}
            onChangeText={text => setF({ ...f, category: text })}
            placeholder='e.g., Materials, Labor, Equipment'
          />

          <AnimatedInput
            label='Notes'
            value={f.notes || ''}
            onChangeText={text => setF({ ...f, notes: text })}
            placeholder='Additional notes...'
            multiline
          />

          {/* Receipt Section */}
          <View style={styles.receiptSection}>
            <Text style={styles.receiptLabel}>Receipt</Text>
            {f.receiptUri ? (
              <View style={styles.receiptPreview}>
                <Image
                  source={{ uri: f.receiptUri }}
                  style={styles.receiptImage}
                />
                <TouchableOpacity
                  onPress={() => setF({ ...f, receiptUri: null })}
                  style={styles.removeReceiptButton}
                >
                  <Text style={styles.removeReceiptText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={scanReceipt}
                style={styles.scanReceiptButton}
                disabled={isProcessingReceipt}
              >
                {isProcessingReceipt ? (
                  <ActivityIndicator color='#43cea2' />
                ) : (
                  <Text style={styles.scanReceiptText}>📄 Scan Receipt</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* AI Expense Validation */}
          {f?.amount && f?.vendor ? (
            <AIExpenseValidation
              expense={{
                id: f?.id ?? String(Date.now()),
                vendor: f.vendor,
                category: f?.category ?? 'Uncategorized',
                amount: Number(f.amount),
                date: f?.date ?? new Date().toISOString(),
                notes: f?.notes ?? '',
                receiptUri: f?.receiptUri ?? null,
              }}
              projectContext={{
                projectType: 'Construction',
                budgetCategories: ['Materials', 'Labor', 'Equipment'],
                averageExpenseAmount: 500,
                recentExpenses: [],
              }}
              onValidationComplete={validation => {
                console.log('AI Validation:', validation);
              }}
              onCategorySuggestion={suggestedCategory => {
                setF({ ...f, category: suggestedCategory });
              }}
            />
          ) : null}

          <TouchableOpacity
            onPress={handleAddExpense}
            style={styles.submitButton}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>Add Expense</Text>
          </TouchableOpacity>
        </ScrollView>
      </AnimatedModal>

      {/* Add Change Order Modal */}
      <AnimatedModal
        visible={showAddChangeOrder}
        onClose={() => setShowAddChangeOrder(false)}
        title='Add Change Order'
      >
        <ScrollView
          style={styles.modalBody}
          showsVerticalScrollIndicator={false}
        >
          <AnimatedInput
            label='Title'
            value={co.title || ''}
            onChangeText={text => setCo({ ...co, title: text })}
            placeholder='Change order title'
          />

          <AnimatedInput
            label='Amount'
            value={co.amount?.toString() || ''}
            onChangeText={text => setCo({ ...co, amount: text })}
            placeholder='0.00 (positive for additions, negative for credits)'
            keyboardType='numeric'
          />

          <AnimatedInput
            label='Notes'
            value={co.notes || ''}
            onChangeText={text => setCo({ ...co, notes: text })}
            placeholder='Description of changes...'
            multiline
          />

          <View style={styles.checkboxContainer}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setCo({ ...co, approved: !co.approved })}
            >
              <Text style={styles.checkboxText}>
                {co.approved ? '☑️' : '☐'} Approved
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleAddChangeOrder}
            style={styles.submitButton}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>Add Change Order</Text>
          </TouchableOpacity>
        </ScrollView>
      </AnimatedModal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    color: '#1e293b',
    letterSpacing: 0.5,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  tile: {
    width: (width - 48) / 2,
    height: 100,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  tileIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  tileText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#64748b',
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f8fafc',
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputFocused: {
    borderColor: '#43cea2',
    backgroundColor: 'white',
  },
  receiptSection: {
    marginBottom: 20,
  },
  receiptLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  receiptPreview: {
    alignItems: 'center',
  },
  receiptImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 12,
  },
  removeReceiptButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ef4444',
    borderRadius: 8,
  },
  removeReceiptText: {
    color: 'white',
    fontWeight: '600',
  },
  scanReceiptButton: {
    borderWidth: 2,
    borderColor: '#43cea2',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(67, 206, 162, 0.1)',
  },
  scanReceiptText: {
    fontSize: 16,
    color: '#43cea2',
    fontWeight: '600',
  },
  checkboxContainer: {
    marginBottom: 20,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxText: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#43cea2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#43cea2',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
});
