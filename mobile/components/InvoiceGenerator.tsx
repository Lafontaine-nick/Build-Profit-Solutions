import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { invoiceService } from '../services/invoiceService';
import { pdfGenerator } from '../services/pdfGenerator';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

interface InvoiceGeneratorProps {
  projectData?: any;
  clientData?: any;
  onClose?: () => void;
  onInvoiceCreated?: (invoice: any) => void;
}

export default function InvoiceGenerator({
  projectData,
  clientData,
  onClose,
  onInvoiceCreated,
}: InvoiceGeneratorProps) {
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Net 30 - Payment due within 30 days');
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InvoiceItem | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const calculateSubtotal = () => {
    return invoiceItems.reduce((sum, item) => sum + item.amount, 0);
  };

  const calculateTax = () => {
    return calculateSubtotal() * 0.08; // 8% tax rate
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const addInvoiceItem = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingItem(null);
    setShowItemModal(true);
  };

  const editInvoiceItem = (item: InvoiceItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingItem(item);
    setShowItemModal(true);
  };

  const deleteInvoiceItem = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Item', 'Are you sure you want to delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setInvoiceItems(items => items.filter(item => item.id !== itemId));
        },
      },
    ]);
  };

  const saveInvoiceItem = (item: Omit<InvoiceItem, 'id'>) => {
    if (editingItem) {
      setInvoiceItems(items =>
        items.map(i => (i.id === editingItem.id ? { ...item, id: i.id } : i))
      );
    } else {
      setInvoiceItems(items => [
        ...items,
        { ...item, id: Date.now().toString() },
      ]);
    }
    setShowItemModal(false);
    setEditingItem(null);
  };

  const generateInvoice = async () => {
    if (invoiceItems.length === 0) {
      Alert.alert('Error', 'Please add at least one item to the invoice.');
      return;
    }

    if (!projectData || !clientData) {
      Alert.alert('Error', 'Project and client data are required.');
      return;
    }

    setIsGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Create invoice data
      const invoiceData = {
        projectData,
        clientData,
        items: invoiceItems,
        invoiceNumber,
        issueDate,
        dueDate,
        notes,
        terms,
        subtotal: calculateSubtotal(),
        tax: calculateTax(),
        total: calculateTotal(),
      };

      // Generate invoice using service
      const invoice = await invoiceService.generateInvoice(
        projectData,
        clientData
      );

      // Generate PDF
      const pdfOptions = {
        title: `Invoice #${invoice.number}`,
        subtitle: `Project: ${projectData.name}`,
        companyInfo: {
          name: 'Build Profit Solutions',
          address: '123 Business St, City, State 12345',
          phone: '(555) 123-4567',
          email: 'info@buildprofitsolutions.com',
          website: 'www.buildprofitsolutions.com',
        },
        clientInfo: {
          name: clientData.name,
          address: `${clientData.address || 'N/A'}`,
          phone: clientData.phone || 'N/A',
          email: clientData.email || 'N/A',
        },
        items: invoiceItems,
        totals: {
          subtotal: calculateSubtotal(),
          tax: calculateTax(),
          total: calculateTotal(),
        },
        notes,
        terms,
        footer: 'Thank you for your business!',
      };

      const pdfUri = await pdfGenerator.generateInvoicePDF(invoice, pdfOptions);

      // Share PDF
      await pdfGenerator.sharePDF(pdfUri, `Invoice_${invoice.number}.pdf`);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Invoice generated and shared successfully!');

      if (onInvoiceCreated) {
        onInvoiceCreated(invoice);
      }
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to generate invoice. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const renderInvoiceItem = (item: InvoiceItem) => (
    <View key={item.id} style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemDescription}>{item.description}</Text>
        <Text style={styles.itemDetails}>
          {item.quantity} {item.unit} @ ${item.rate.toLocaleString()}
        </Text>
      </View>

      <View style={styles.itemActions}>
        <Text style={styles.itemAmount}>${item.amount.toLocaleString()}</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => editInvoiceItem(item)}
        >
          <MaterialIcons name='edit' size={16} color='#2196F3' />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteInvoiceItem(item.id)}
        >
          <MaterialIcons name='delete' size={16} color='#F44336' />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <LinearGradient
      colors={['#0b1c38', '#1B365D', '#2d5a3d', '#43cea2']}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Generate Invoice</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <MaterialIcons name='close' size={24} color='white' />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Invoice Number</Text>
              <TextInput
                style={styles.textInput}
                value={invoiceNumber}
                onChangeText={setInvoiceNumber}
                placeholder='INV-2024-001'
                placeholderTextColor='#999'
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Issue Date</Text>
              <TextInput
                style={styles.textInput}
                value={issueDate}
                onChangeText={setIssueDate}
                placeholder='YYYY-MM-DD'
                placeholderTextColor='#999'
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Due Date</Text>
              <TextInput
                style={styles.textInput}
                value={dueDate}
                onChangeText={setDueDate}
                placeholder='YYYY-MM-DD'
                placeholderTextColor='#999'
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Invoice Items</Text>
            <TouchableOpacity style={styles.addButton} onPress={addInvoiceItem}>
              <MaterialIcons name='add' size={20} color='white' />
              <Text style={styles.addButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {invoiceItems.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name='receipt' size={48} color='#666' />
              <Text style={styles.emptyStateText}>No items added yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Tap "Add Item" to get started
              </Text>
            </View>
          ) : (
            <View style={styles.itemsList}>
              {invoiceItems.map(renderInvoiceItem)}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Totals</Text>
          <View style={styles.totalsContainer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>
                ${calculateSubtotal().toLocaleString()}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax (8%):</Text>
              <Text style={styles.totalValue}>
                ${calculateTax().toLocaleString()}
              </Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={styles.grandTotalLabel}>Total:</Text>
              <Text style={styles.grandTotalValue}>
                ${calculateTotal().toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes & Terms</Text>

          <Text style={styles.inputLabel}>Notes</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder='Additional notes for the client...'
            placeholderTextColor='#999'
            multiline
            numberOfLines={3}
          />

          <Text style={styles.inputLabel}>Payment Terms</Text>
          <TextInput
            style={styles.textInput}
            value={terms}
            onChangeText={setTerms}
            placeholder='Payment terms...'
            placeholderTextColor='#999'
          />
        </View>

        <TouchableOpacity
          style={[
            styles.generateButton,
            isGenerating && styles.generateButtonDisabled,
          ]}
          onPress={generateInvoice}
          disabled={isGenerating}
        >
          <MaterialIcons
            name={isGenerating ? 'sync' : 'receipt'}
            size={24}
            color='white'
            style={isGenerating ? styles.rotating : undefined}
          />
          <Text style={styles.generateButtonText}>
            {isGenerating ? 'Generating...' : 'Generate Invoice'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showItemModal}
        transparent
        animationType='slide'
        onRequestClose={() => setShowItemModal(false)}
      >
        <InvoiceItemModal
          item={editingItem}
          onSave={saveInvoiceItem}
          onCancel={() => setShowItemModal(false)}
        />
      </Modal>
    </LinearGradient>
  );
}

// Invoice Item Modal Component
interface InvoiceItemModalProps {
  item?: InvoiceItem | null;
  onSave: (item: Omit<InvoiceItem, 'id'>) => void;
  onCancel: () => void;
}

function InvoiceItemModal({ item, onSave, onCancel }: InvoiceItemModalProps) {
  const [description, setDescription] = useState(item?.description || '');
  const [quantity, setQuantity] = useState(item?.quantity?.toString() || '');
  const [unit, setUnit] = useState(item?.unit || '');
  const [rate, setRate] = useState(item?.rate?.toString() || '');

  const handleSave = () => {
    if (!description || !quantity || !unit || !rate) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    const numQuantity = parseFloat(quantity);
    const numRate = parseFloat(rate);

    if (isNaN(numQuantity) || isNaN(numRate)) {
      Alert.alert('Error', 'Please enter valid numbers for quantity and rate.');
      return;
    }

    onSave({
      description,
      quantity: numQuantity,
      unit,
      rate: numRate,
      amount: numQuantity * numRate,
    });
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {item ? 'Edit Item' : 'Add Item'}
          </Text>
          <TouchableOpacity onPress={onCancel}>
            <MaterialIcons name='close' size={24} color='#666' />
          </TouchableOpacity>
        </View>

        <View style={styles.modalBody}>
          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={styles.textInput}
            value={description}
            onChangeText={setDescription}
            placeholder='Item description'
            placeholderTextColor='#999'
          />

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Quantity</Text>
              <TextInput
                style={styles.textInput}
                value={quantity}
                onChangeText={setQuantity}
                placeholder='1'
                placeholderTextColor='#999'
                keyboardType='numeric'
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Unit</Text>
              <TextInput
                style={styles.textInput}
                value={unit}
                onChangeText={setUnit}
                placeholder='hour, item, etc.'
                placeholderTextColor='#999'
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Rate</Text>
          <TextInput
            style={styles.textInput}
            value={rate}
            onChangeText={setRate}
            placeholder='0.00'
            placeholderTextColor='#999'
            keyboardType='numeric'
          />

          {quantity && rate && (
            <View style={styles.calculation}>
              <Text style={styles.calculationText}>
                Total: ${(parseFloat(quantity) * parseFloat(rate)).toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    padding: 8,
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputGroup: {
    flex: 1,
    marginRight: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: 'white',
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  itemsList: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  itemInfo: {
    flex: 1,
  },
  itemDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  itemDetails: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
    marginRight: 12,
  },
  editButton: {
    padding: 4,
    marginRight: 8,
  },
  deleteButton: {
    padding: 4,
  },
  totalsContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#ccc',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 8,
    marginTop: 8,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 30,
  },
  generateButtonDisabled: {
    backgroundColor: '#666',
  },
  generateButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  rotating: {
    transform: [{ rotate: '360deg' }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  calculation: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  calculationText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#f5f5f5',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: '#4CAF50',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
