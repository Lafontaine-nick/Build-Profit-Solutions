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
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import GradientRingBackInner from './GradientRingBackInner';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { 
  getSavedMaterials, 
  removeSavedMaterial,
  SavedMaterial 
} from '../services/savedMaterialsService';

interface SavedMaterialsScreenProps {
  onClose: () => void;
  onAddToBid?: (item: SavedMaterial & { quantity?: number }) => void;
}

export default function SavedMaterialsScreen({ 
  onClose, 
  onAddToBid 
}: SavedMaterialsScreenProps) {
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


  const getPriceSignal = (price: number) => {
    const estimatedMarketAvg = price * 1.15;
    const priceRatio = price / estimatedMarketAvg;
    
    if (priceRatio < 0.85) {
      return { signal: 'good', color: '#10b981', text: 'Good Deal' };
    } else if (priceRatio > 1.15) {
      return { signal: 'expensive', color: '#ef4444', text: 'Pricey' };
    }
    return { signal: 'fair', color: '#3b82f6', text: 'Fair' };
  };

  const renderMaterial = ({ item }: { item: SavedMaterial }) => {
    const priceSignal = getPriceSignal(item.price);
    const qty = quantities.get(item.sku) || 1;

    return (
      <View style={styles.materialCard}>
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
              color="#8DA0B8"
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
            <Text style={styles.price}>
              ${item.price.toFixed(2)}
              {item.unit ? ` • ${item.unit}` : ''}
            </Text>
            <View style={[styles.badge, { backgroundColor: priceSignal.color }]}>
              <MaterialIcons
                name={
                  priceSignal.signal === 'good' ? 'trending-down' :
                  priceSignal.signal === 'expensive' ? 'trending-up' : 'trending-flat'
                }
                size={12}
                color="#FFFFFF"
              />
              <Text style={styles.badgeText}>AI: {priceSignal.text}</Text>
            </View>
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
              <MaterialIcons name="add-shopping-cart" size={16} color="#000000" />
              <Text style={styles.addButtonText}>Add to Bid</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => item.url && Linking.openURL(item.url)}
              style={styles.viewButton}
            >
              <MaterialIcons name="open-in-new" size={18} color="#FFFFFF" />
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <LinearGradient
          colors={BRAND_FRAME_GRADIENT_COLORS}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            padding: 1,
            marginRight: 12,
          }}
        >
          <GradientRingBackInner
            darkMode
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 19,
              backgroundColor: '#000000',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </GradientRingBackInner>
        </LinearGradient>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Saved Materials</Text>
          <Text style={styles.headerSubtitle}>
            {materials.length} {materials.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.emptyText}>Loading saved materials...</Text>
        </View>
      ) : materials.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="bookmark-outline"
            size={64}
            color="#8DA0B8"
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
              tintColor="#22c55e"
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8DA0B8',
    marginTop: 2,
  },
  listContent: {
    padding: 16,
  },
  materialCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    color: '#8DA0B8',
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
    color: '#22c55e',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.3,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  quantityLabel: {
    fontSize: 12,
    color: '#8DA0B8',
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
  },
  addButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 12,
  },
  viewButton: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
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
    color: '#8DA0B8',
    textAlign: 'center',
  },
});
