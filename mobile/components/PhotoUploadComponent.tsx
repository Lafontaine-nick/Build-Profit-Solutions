import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  TextInput,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';

interface PhotoUploadComponentProps {
  portfolio: Array<{
    id: string;
    uri: string;
    type: 'before_after' | 'project_complete';
    caption?: string;
    projectType?: string;
  }>;
  onUpdate: (portfolio: any[]) => void;
}

const PHOTO_TYPES = [
  { key: 'before_after', label: 'Before & After', icon: 'compare', color: '#10B981' },
  { key: 'project_complete', label: 'Completed Projects', icon: 'check-circle', color: '#3B82F6' },
];

export function PhotoUploadComponent({
  portfolio,
  onUpdate,
}: PhotoUploadComponentProps) {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  const neutralIconColor = darkMode ? '#FFFFFF' : '#000000';
  const styles = useMemo(() => getStyles(darkMode, Colors), [darkMode, Colors]);
  const [selectedType, setSelectedType] = useState<string>('project_complete');
  const [editingPhoto, setEditingPhoto] = useState<any>(null);
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [captionText, setCaptionText] = useState('');

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload photos.');
        return false;
      }
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newPhoto = {
        id: `photo-${Date.now()}`,
        uri: result.assets[0].uri,
        type: selectedType as any,
        caption: '',
        projectType: '',
      };

      onUpdate([...portfolio, newPhoto]);
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newPhoto = {
        id: `photo-${Date.now()}`,
        uri: result.assets[0].uri,
        type: selectedType as any,
        caption: '',
        projectType: '',
      };

      onUpdate([...portfolio, newPhoto]);
    }
  };

  const removePhoto = (photoId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdate(portfolio.filter(photo => photo.id !== photoId));
  };

  const setFeaturedPhoto = (photoId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const photoIndex = portfolio.findIndex(p => p.id === photoId);
    if (photoIndex > 0) {
      const updatedPortfolio = [...portfolio];
      const [featuredPhoto] = updatedPortfolio.splice(photoIndex, 1);
      updatedPortfolio.unshift(featuredPhoto);
      onUpdate(updatedPortfolio);
      Alert.alert('Featured Photo Set', 'This photo will appear first in your portfolio');
    }
  };

  const openCaptionModal = (photo: any) => {
    setEditingPhoto(photo);
    setCaptionText(photo.caption || '');
    setShowCaptionModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const saveCaption = () => {
    if (editingPhoto) {
      const updatedPortfolio = portfolio.map(photo =>
        photo.id === editingPhoto.id
          ? { ...photo, caption: captionText }
          : photo
      );
      onUpdate(updatedPortfolio);
      setShowCaptionModal(false);
      setEditingPhoto(null);
      setCaptionText('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const movePhoto = (photoId: string, direction: 'left' | 'right') => {
    const photoIndex = portfolio.findIndex(p => p.id === photoId);
    if (
      (direction === 'left' && photoIndex > 0) ||
      (direction === 'right' && photoIndex < portfolio.length - 1)
    ) {
      const updatedPortfolio = [...portfolio];
      const targetIndex = direction === 'left' ? photoIndex - 1 : photoIndex + 1;
      [updatedPortfolio[photoIndex], updatedPortfolio[targetIndex]] = 
        [updatedPortfolio[targetIndex], updatedPortfolio[photoIndex]];
      onUpdate(updatedPortfolio);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const updatePhotoCaption = (photoId: string, caption: string) => {
    onUpdate(portfolio.map(photo => 
      photo.id === photoId ? { ...photo, caption } : photo
    ));
  };

  const updatePhotoProjectType = (photoId: string, projectType: string) => {
    onUpdate(portfolio.map(photo => 
      photo.id === photoId ? { ...photo, projectType } : photo
    ));
  };

  const getPhotosByType = (type: string) => {
    return portfolio.filter(photo => photo.type === type);
  };

  const renderPhotoType = (type: any) => {
    const photos = getPhotosByType(type.key);
    
    return (
      <View key={type.key} style={styles.photoTypeSection}>
        <View style={styles.photoTypeHeader}>
          <View style={styles.photoTypeInfo}>
            <MaterialIcons name={type.icon} size={20} color={type.color} />
            <Text style={styles.photoTypeLabel}>{type.label}</Text>
            <Text style={styles.photoCount}>({photos.length})</Text>
          </View>
          {selectedType === type.key && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: type.color }]}
              onPress={pickImage}
            >
              <MaterialIcons name="add" size={16} color={neutralIconColor} />
            </TouchableOpacity>
          )}
        </View>

        {photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosContainer}>
            {photos.map((photo, index) => (
              <View key={photo.id} style={styles.photoItem}>
                <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                
                {/* Featured Badge */}
                {index === 0 && (
                  <View style={styles.featuredBadge}>
                    <MaterialIcons name="star" size={12} color="#F59E0B" />
                    <Text style={styles.featuredText}>Featured</Text>
                  </View>
                )}
                
                {/* Action Buttons */}
                <View style={styles.photoActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => removePhoto(photo.id)}
                  >
                    <MaterialIcons name="delete" size={18} color="#EF4444" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => openCaptionModal(photo)}
                  >
                    <MaterialIcons name="edit" size={18} color="#3B82F6" />
                  </TouchableOpacity>
                  
                  {index > 0 && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => setFeaturedPhoto(photo.id)}
                    >
                      <MaterialIcons name="star-border" size={18} color="#F59E0B" />
                    </TouchableOpacity>
                  )}
                </View>
                
                {/* Reorder Buttons */}
                <View style={styles.reorderButtons}>
                  {index > 0 && (
                    <TouchableOpacity
                      style={styles.reorderButton}
                      onPress={() => movePhoto(photo.id, 'left')}
                    >
                      <MaterialIcons name="chevron-left" size={20} color="#43cea2" />
                    </TouchableOpacity>
                  )}
                  {index < photos.length - 1 && (
                    <TouchableOpacity
                      style={styles.reorderButton}
                      onPress={() => movePhoto(photo.id, 'right')}
                    >
                      <MaterialIcons name="chevron-right" size={20} color="#43cea2" />
                    </TouchableOpacity>
                  )}
                </View>
                
                {/* Caption */}
                {photo.caption && (
                  <View style={styles.photoInfo}>
                    <Text style={styles.photoCaption} numberOfLines={2}>
                      {photo.caption}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )}

        {selectedType === type.key && photos.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="photo-library" size={48} color={darkMode ? "#6B7280" : Colors.sub} />
            <Text style={styles.emptyStateText}>No {type.label.toLowerCase()} yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Tap the + button to add photos
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Photo Type Selector */}
      <View style={styles.typeSelector}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="photo-library" size={20} color={neutralIconColor} />
          <Text style={styles.sectionTitle}>Project Proof</Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          Profiles with photos get 3× more requests. Showcase your work with high-quality photos.
        </Text>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeChips}>
          {PHOTO_TYPES.map((type) => (
            <TouchableOpacity
              key={type.key}
              style={[
                styles.typeChip,
                selectedType === type.key && styles.typeChipSelected,
                { borderColor: type.color }
              ]}
              onPress={() => {
                setSelectedType(type.key);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <MaterialIcons 
                name={type.icon} 
                size={16} 
                color={selectedType === type.key ? type.color : (darkMode ? '#9CA3AF' : Colors.sub)} 
              />
              <Text
                style={[
                  styles.typeChipText,
                  selectedType === type.key && { color: type.color }
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Upload Options */}
      <View style={styles.uploadOptions}>
        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
          <MaterialIcons name="photo-library" size={20} color="#43cea2" />
          <Text style={styles.uploadButtonText}>Choose from Library</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.uploadButton} onPress={takePhoto}>
          <MaterialIcons name="camera-alt" size={20} color="#43cea2" />
          <Text style={styles.uploadButtonText}>Take Photo</Text>
        </TouchableOpacity>
      </View>

      {/* Photo Types */}
      <ScrollView style={styles.photoTypesContainer} showsVerticalScrollIndicator={false}>
        {PHOTO_TYPES.map(renderPhotoType)}
      </ScrollView>

      {/* Tips */}
      <View style={styles.tipsContainer}>
        <MaterialIcons name="lightbulb" size={16} color="#F59E0B" />
        <Text style={styles.tipsText}>
          Pro tip: The first photo is featured and will appear prominently. Add captions to describe your work!
        </Text>
      </View>

      {/* Caption Modal */}
      <Modal visible={showCaptionModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={['#0b1c38', '#1B365D', '#43cea2']}
            style={styles.captionModal}
          >
            <View style={styles.captionHeader}>
              <Text style={styles.captionTitle}>Add Caption</Text>
              <TouchableOpacity onPress={() => setShowCaptionModal(false)}>
              <MaterialIcons name="close" size={24} color={darkMode ? "#E2E8F0" : Colors.text} />
              </TouchableOpacity>
            </View>
            
            {editingPhoto && (
              <Image source={{ uri: editingPhoto.uri }} style={styles.captionPreviewImage} />
            )}
            
            <TextInput
              style={styles.captionInput}
              placeholder="Describe this project..."
              placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
              value={captionText}
              onChangeText={setCaptionText}
              multiline
              numberOfLines={4}
              maxLength={200}
            />
            
            <Text style={styles.captionCounter}>{captionText.length}/200</Text>
            
            <TouchableOpacity style={styles.saveCaptionButton} onPress={saveCaption}>
              <MaterialIcons name="check" size={20} color={neutralIconColor} />
              <Text style={styles.saveCaptionText}>Save Caption</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (darkMode: boolean, Colors: ReturnType<typeof getColors>) => ({
  container: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
    marginLeft: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginBottom: 20,
  },
  typeSelector: {
    marginBottom: 20,
  },
  typeChips: {
    marginTop: 12,
  },
  typeChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
    marginRight: 8,
  },
  typeChipSelected: {
    backgroundColor: 'rgba(67, 206, 162, 0.1)',
  },
  typeChipText: {
    fontSize: 12,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginLeft: 4,
    fontWeight: '500' as const,
  },
  uploadOptions: {
    flexDirection: 'row' as const,
    gap: 12,
    marginBottom: 24,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
    backgroundColor: 'rgba(67, 206, 162, 0.1)',
  },
  uploadButtonText: {
    color: '#43cea2',
    fontWeight: '600' as const,
    marginLeft: 8,
  },
  photoTypesContainer: {
    flex: 1,
  },
  photoTypeSection: {
    marginBottom: 24,
  },
  photoTypeHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
  },
  photoTypeInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  photoTypeLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: darkMode ? '#E2E8F0' : Colors.text,
    marginLeft: 8,
  },
  photoCount: {
    fontSize: 12,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginLeft: 8,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  photosContainer: {
    marginTop: 8,
  },
  photoItem: {
    width: 120,
    marginRight: 12,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
    borderRadius: 8,
    overflow: 'hidden' as const,
  },
  photoImage: {
    width: '100%',
    height: 80,
    backgroundColor: '#374151',
  },
  removeButton: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  photoInfo: {
    padding: 8,
  },
  photoCaption: {
    fontSize: 12,
    color: darkMode ? '#E2E8F0' : Colors.text,
    marginBottom: 2,
  },
  photoProjectType: {
    fontSize: 10,
    color: darkMode ? '#9CA3AF' : Colors.sub,
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.1)',
    borderStyle: 'dashed' as const,
  },
  emptyStateText: {
    fontSize: 14,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginTop: 8,
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: darkMode ? '#6B7280' : Colors.sub,
    marginTop: 4,
  },
  tipsContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    padding: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginTop: 16,
  },
  tipsText: {
    flex: 1,
    fontSize: 12,
    color: '#FCD34D',
    marginLeft: 8,
    lineHeight: 16,
  },
  featuredBadge: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(245, 158, 11, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  featuredText: {
    color: darkMode ? '#FFFFFF' : Colors.text,
    fontSize: 10,
    fontWeight: '600' as const,
    marginLeft: 4,
  },
  photoActions: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    flexDirection: 'row' as const,
    gap: 6,
    zIndex: 10,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(11, 28, 56, 0.9)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  reorderButtons: {
    position: 'absolute' as const,
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: 8,
    zIndex: 10,
  },
  reorderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(11, 28, 56, 0.9)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: '#43cea2',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 20,
  },
  captionModal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
  },
  captionHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  captionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: darkMode ? '#E2E8F0' : Colors.text,
  },
  captionPreviewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  captionInput: {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderRadius: 8,
    padding: 12,
    color: darkMode ? '#E2E8F0' : Colors.text,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top' as const,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
  },
  captionCounter: {
    fontSize: 12,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    textAlign: 'right' as const,
    marginTop: 8,
    marginBottom: 16,
  },
  saveCaptionButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#43cea2',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  saveCaptionText: {
    color: darkMode ? '#FFFFFF' : Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
    marginLeft: 8,
  },
});

