import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
  RefreshControl,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { 
  getSavedMaterials, 
  removeSavedMaterial,
  SavedMaterial 
} from '../services/savedMaterialsService';
import {
  ESTIMATE_FLOW_CARD_GAP,
  ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
} from '@/utils/estimateFlowCardStyle';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';
import BackButton from '@/components/ui/BackButton';

interface SavedMaterialsScreenProps {
  onClose: () => void;
  onAddToBid?: (item: SavedMaterial & { quantity?: number }) => void;
}

export default function SavedMaterialsScreen({ 
  onClose, 
  onAddToBid 
}: SavedMaterialsScreenProps) {
  const { theme, darkMode } = useTheme();
  const Colors = getColors(theme);
  const [materials, setMaterials] = useState<SavedMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map());
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      const saved = await getSavedMaterials();
      setMaterials(saved.sort((a, b) => 
        new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      ));
    } catch (error) {
      console.error('Error loading saved materials:', error);
      Alert.alert('Error', 'Failed to load saved materials');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRemove = async (material: SavedMaterial) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Remove Material',
      `Remove "${material.title}" from saved materials?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeSavedMaterial(material.sku, material.store);
            loadMaterials();
          },
        },
      ]
    );
  };

  const handleAddToBid = (material: SavedMaterial) => {
    const qty = quantities.get(material.sku) || 1;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onAddToBid) {
      onAddToBid({ ...material, quantity: qty });
      Alert.alert('✅ Added!', `Added ${qty}x ${material.title} to bid`);
    }
  };


  const renderMaterial = ({ item }: { item: SavedMaterial }) => {
    const qty = quantities.get(item.sku) || 1;

    return (
      <View style={[styles.materialCard, {
        backgroundColor: darkMode ? '#202022' : Colors.surface2,
        borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
        marginBottom: ESTIMATE_FLOW_CARD_GAP,
      }]}>
        {/* Image */}
        <View style={styles.imageContainer}>
          {item.image && item.image.startsWith('http') ? (
            <Image
              source={{ uri: item.image }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <MaterialCommunityIcons
              name="package-variant"
              size={40}
              color={darkMode ? '#d7e1f0' : '#64748b'}
            />
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.details}>
            {item.store.toUpperCase()} • {item.zip || 'N/A'} • {item.sku}
          </Text>
          
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: item.price > 0 ? '#2dcc9a' : '#d7e1f0' }]}>
              ${item.price.toFixed(2)}
              {item.unit ? ` • ${item.unit}` : ''}
            </Text>
          </View>

          {/* Quantity Selector */}
          <View style={styles.quantityRow}>
            <Text style={styles.quantityLabel}>Quantity:</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                onPress={() => {
                  if (qty > 1) {
                    setQuantities(new Map(quantities.set(item.sku, qty - 1)));
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                style={styles.quantityButton}
              >
                <MaterialIcons name="remove" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.quantityValue}>{qty}</Text>
              <TouchableOpacity
                onPress={() => {
                  setQuantities(new Map(quantities.set(item.sku, qty + 1)));
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={styles.quantityButton}
              >
                <MaterialIcons name="add" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => handleAddToBid(item)}
              style={styles.addButton}
            >
              <MaterialIcons name="add-shopping-cart" size={16} color="#050B13" />
              <Text style={styles.addButtonText}>Add to Bid</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => item.url && Linking.openURL(item.url)}
              style={styles.viewButton}
            >
              <MaterialIcons name="open-in-new" size={18} color={darkMode ? '#d7e1f0' : '#64748b'} />
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => handleRemove(item)}
              style={styles.removeButton}
            >
              <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: darkMode ? '#000000' : Colors.bg }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      
      <View pointerEvents="box-none" style={styles.header}>
        <View pointerEvents="none" style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: darkMode ? '#FFFFFF' : Colors.text }]}>Saved Materials</Text>
          <Text style={styles.headerSubtitle}>
            {materials.length} {materials.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <BackButton
          darkMode={darkMode}
          onPress={() => {
            onClose();
          }}
          style={{ position: 'absolute', left: ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD, top: 8, zIndex: 2 }}
        />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#2dcc9a" />
          <Text style={styles.emptyText}>Loading saved materials...</Text>
        </View>
      ) : materials.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="bookmark-outline"
            size={64}
            color={darkMode ? '#d7e1f0' : '#64748b'}
          />
          <Text style={styles.emptyTitle}>No Saved Materials</Text>
          <Text style={styles.emptyText}>
            Save materials from Material Search to view them here
          </Text>
        </View>
      ) : (
        <FlatList
          data={materials}
          renderItem={renderMaterial}
          keyExtractor={(item) => `${item.sku}-${item.store}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadMaterials();
              }}
              tintColor="#2dcc9a"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
    paddingTop: 8,
    paddingBottom: 16,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  headerContent: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 56,
  },
  backButton: {
    position: 'absolute',
    left: ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
    top: 8,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.25,
    lineHeight: 23,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#d7e1f0',
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 0.12,
    lineHeight: 20,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
    paddingTop: 16,
    paddingBottom: 16,
  },
  materialCard: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  details: {
    fontSize: 13,
    color: '#d7e1f0',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  quantityLabel: {
    fontSize: 12,
    color: '#d7e1f0',
    fontWeight: '600',
    minWidth: 60,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  quantityButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quantityValue: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    minWidth: 30,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#2dcc9a',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  addButtonText: {
    color: '#050B13',
    fontWeight: '700',
    fontSize: 13,
  },
  viewButton: {
    width: 44,
    height: 44,
    backgroundColor: '#3A3A3C',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#d7e1f0',
    textAlign: 'center',
  },
});
