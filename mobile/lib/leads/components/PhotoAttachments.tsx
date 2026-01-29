/**
 * Photo Attachments Component
 * Upload and manage photos for leads (site photos, documents, etc.)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { c, radius, shadow } from '../ui/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface LeadPhoto {
  id: string;
  uri: string;
  type: 'site_photo' | 'document' | 'blueprint' | 'other';
  caption?: string;
  uploadedAt: string;
}

interface PhotoAttachmentsProps {
  photos: LeadPhoto[];
  onAddPhoto: (photo: LeadPhoto) => void;
  onDeletePhoto: (photoId: string) => void;
  onViewPhoto?: (photo: LeadPhoto) => void;
}

export default function PhotoAttachments({
  photos,
  onAddPhoto,
  onDeletePhoto,
  onViewPhoto,
}: PhotoAttachmentsProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<LeadPhoto | null>(null);
  const [showViewer, setShowViewer] = useState(false);

  // Request camera permissions
  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  };

  // Take a photo
  const takePhoto = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Camera permission is required to take photos');
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const photo: LeadPhoto = {
          id: `photo-${Date.now()}`,
          uri: result.assets[0].uri,
          type: 'site_photo',
          uploadedAt: new Date().toISOString(),
        };

        onAddPhoto(photo);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Pick from gallery
  const pickFromGallery = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        result.assets.forEach(asset => {
          const photo: LeadPhoto = {
            id: `photo-${Date.now()}-${Math.random()}`,
            uri: asset.uri,
            type: 'site_photo',
            uploadedAt: new Date().toISOString(),
          };
          onAddPhoto(photo);
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error picking photo:', error);
      Alert.alert('Error', 'Failed to pick photo');
    }
  };

  // Show add options
  const showAddOptions = () => {
    Alert.alert(
      'Add Photo',
      'Choose how you want to add a photo',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: pickFromGallery },
      ]
    );
  };

  // Handle photo press
  const handlePhotoPress = (photo: LeadPhoto) => {
    Haptics.selectionAsync();
    setSelectedPhoto(photo);
    setShowViewer(true);
    onViewPhoto?.(photo);
  };

  // Handle photo delete
  const handlePhotoDelete = (photo: LeadPhoto) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDeletePhoto(photo.id);
            setShowViewer(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  // Get type icon
  const getTypeIcon = (type: LeadPhoto['type']) => {
    switch (type) {
      case 'site_photo':
        return 'photo-camera';
      case 'document':
        return 'description';
      case 'blueprint':
        return 'architecture';
      default:
        return 'image';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📸 Photos & Documents</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={showAddOptions}
        >
          <MaterialIcons name="add-a-photo" size={20} color={c.accent} />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {photos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="photo-library" size={48} color={c.sub} />
          <Text style={styles.emptyText}>No photos yet</Text>
          <Text style={styles.emptySubtext}>Add site photos or documents</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoList}
        >
          {photos.map(photo => (
            <TouchableOpacity
              key={photo.id}
              style={styles.photoItem}
              onPress={() => handlePhotoPress(photo)}
              activeOpacity={0.8}
            >
              <Image source={{ uri: photo.uri }} style={styles.photoImage} />
              <View style={styles.photoOverlay}>
                <MaterialIcons
                  name={getTypeIcon(photo.type) as any}
                  size={16}
                  color="#fff"
                />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Photo Viewer Modal */}
      <Modal
        visible={showViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowViewer(false)}
      >
        <View style={styles.viewerContainer}>
          <View style={styles.viewerHeader}>
            <TouchableOpacity
              style={styles.viewerButton}
              onPress={() => setShowViewer(false)}
            >
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.viewerButton}
              onPress={() => selectedPhoto && handlePhotoDelete(selectedPhoto)}
            >
              <MaterialIcons name="delete" size={24} color="#FF4444" />
            </TouchableOpacity>
          </View>

          {selectedPhoto && (
            <Image
              source={{ uri: selectedPhoto.uri }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          )}

          {selectedPhoto?.caption && (
            <View style={styles.captionContainer}>
              <Text style={styles.caption}>{selectedPhoto.caption}</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  title: {
    color: c.text,
    fontSize: 16,
    fontWeight: '700',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.railTrack,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    gap: 6,
  },
  addButtonText: {
    color: c.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyText: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    color: c.sub,
    fontSize: 14,
    marginTop: 4,
  },
  photoList: {
    paddingHorizontal: 12,
    gap: 12,
  },
  photoItem: {
    width: 120,
    height: 120,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginHorizontal: 4,
    ...shadow.card,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  viewerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  captionContainer: {
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  caption: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
});





