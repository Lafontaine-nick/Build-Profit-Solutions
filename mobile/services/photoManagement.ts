import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { apiService } from './api';

export interface TaskPhoto {
  id: string;
  taskId: string;
  url: string;
  localUri?: string;
  filename: string;
  type: 'progress' | 'issue' | 'completion' | 'before' | 'after' | 'inspection';
  description?: string;
  uploadedBy: string;
  uploadedAt: string;
  size: number;
  width: number;
  height: number;
  metadata?: {
    location?: {
      latitude: number;
      longitude: number;
    };
    tags?: string[];
    equipment?: string[];
  };
}

export interface PhotoUploadProgress {
  taskId: string;
  filename: string;
  progress: number;
  status: 'uploading' | 'completed' | 'failed';
  error?: string;
}

class PhotoManagementService {
  private uploadQueue: PhotoUploadProgress[] = [];
  private maxFileSize = 10 * 1024 * 1024; // 10MB
  private allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  // Request camera and media library permissions
  async requestPermissions(): Promise<boolean> {
    try {
      const cameraPermission =
        await ImagePicker.requestCameraPermissionsAsync();
      const mediaLibraryPermission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      return (
        cameraPermission.status === 'granted' &&
        mediaLibraryPermission.status === 'granted'
      );
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  // Capture photo from camera
  async captureTaskPhoto(
    taskId: string,
    type: TaskPhoto['type']
  ): Promise<TaskPhoto | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Camera and media library permissions are required');
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        exif: true,
      });

      if (result.canceled || !result.assets[0]) {
        return null;
      }

      const asset = result.assets[0];
      const photo: TaskPhoto = {
        id: `photo-${Date.now()}`,
        taskId,
        url: asset.uri,
        localUri: asset.uri,
        filename: `task-${taskId}-${Date.now()}.jpg`,
        type,
        uploadedBy: 'current-user-id', // TODO: Get from auth context
        uploadedAt: new Date().toISOString(),
        size: asset.fileSize || 0,
        width: asset.width,
        height: asset.height,
        metadata: {
          location: asset.exif?.GPS
            ? {
                latitude: asset.exif.GPS.GPSLatitude || 0,
                longitude: asset.exif.GPS.GPSLongitude || 0,
              }
            : undefined,
          tags: [],
          equipment: [],
        },
      };

      return photo;
    } catch (error) {
      console.error('Error capturing task photo:', error);
      throw error;
    }
  }

  // Select photo from gallery
  async selectTaskPhoto(
    taskId: string,
    type: TaskPhoto['type']
  ): Promise<TaskPhoto | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Media library permission is required');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        exif: true,
        allowsMultipleSelection: false,
      });

      if (result.canceled || !result.assets[0]) {
        return null;
      }

      const asset = result.assets[0];
      const photo: TaskPhoto = {
        id: `photo-${Date.now()}`,
        taskId,
        url: asset.uri,
        localUri: asset.uri,
        filename: `task-${taskId}-${Date.now()}.jpg`,
        type,
        uploadedBy: 'current-user-id', // TODO: Get from auth context
        uploadedAt: new Date().toISOString(),
        size: asset.fileSize || 0,
        width: asset.width,
        height: asset.height,
        metadata: {
          location: asset.exif?.GPS
            ? {
                latitude: asset.exif.GPS.GPSLatitude || 0,
                longitude: asset.exif.GPS.GPSLongitude || 0,
              }
            : undefined,
          tags: [],
          equipment: [],
        },
      };

      return photo;
    } catch (error) {
      console.error('Error selecting task photo:', error);
      throw error;
    }
  }

  // Upload photo to backend
  async uploadTaskPhoto(taskId: string, photo: TaskPhoto): Promise<TaskPhoto> {
    try {
      if (!photo.localUri) {
        throw new Error('No local URI found for photo');
      }

      // Validate file size
      if (photo.size > this.maxFileSize) {
        throw new Error(
          `File size exceeds maximum allowed size of ${this.maxFileSize / (1024 * 1024)}MB`
        );
      }

      // Create FormData for upload
      const formData = new FormData();
      formData.append('photo', {
        uri: photo.localUri,
        type: 'image/jpeg',
        name: photo.filename,
      } as any);
      formData.append('taskId', taskId);
      formData.append('type', photo.type);
      formData.append('description', photo.description || '');
      formData.append('metadata', JSON.stringify(photo.metadata || {}));

      // Add to upload queue
      const uploadProgress: PhotoUploadProgress = {
        taskId,
        filename: photo.filename,
        progress: 0,
        status: 'uploading',
      };
      this.uploadQueue.push(uploadProgress);

      try {
        const response = await apiService.post(
          `/tasks/${taskId}/photos`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: progressEvent => {
              const progress = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              uploadProgress.progress = progress;
            },
          }
        );

        const uploadedPhoto = response.data;
        uploadProgress.status = 'completed';
        uploadProgress.progress = 100;

        // Remove from queue
        this.uploadQueue = this.uploadQueue.filter(
          item => item !== uploadProgress
        );

        return uploadedPhoto;
      } catch (error) {
        uploadProgress.status = 'failed';
        uploadProgress.error = error.message;
        throw error;
      }
    } catch (error) {
      console.error('Error uploading task photo:', error);
      throw error;
    }
  }

  // Get all photos for a task
  async getTaskPhotos(taskId: string): Promise<TaskPhoto[]> {
    try {
      const response = await apiService.get(`/tasks/${taskId}/photos`);
      return response.data;
    } catch (error) {
      console.error('Error fetching task photos:', error);
      return [];
    }
  }

  // Delete a photo
  async deleteTaskPhoto(taskId: string, photoId: string): Promise<void> {
    try {
      await apiService.delete(`/tasks/${taskId}/photos/${photoId}`);
    } catch (error) {
      console.error('Error deleting task photo:', error);
      throw error;
    }
  }

  // Update photo metadata
  async updatePhotoMetadata(
    taskId: string,
    photoId: string,
    metadata: Partial<TaskPhoto['metadata']>
  ): Promise<TaskPhoto> {
    try {
      const response = await apiService.put(
        `/tasks/${taskId}/photos/${photoId}/metadata`,
        metadata
      );
      return response.data;
    } catch (error) {
      console.error('Error updating photo metadata:', error);
      throw error;
    }
  }

  // Get upload progress
  getUploadProgress(
    taskId: string,
    filename: string
  ): PhotoUploadProgress | undefined {
    return this.uploadQueue.find(
      item => item.taskId === taskId && item.filename === filename
    );
  }

  // Get all upload progress for a task
  getTaskUploadProgress(taskId: string): PhotoUploadProgress[] {
    return this.uploadQueue.filter(item => item.taskId === taskId);
  }

  // Clear completed uploads from queue
  clearCompletedUploads(): void {
    this.uploadQueue = this.uploadQueue.filter(
      item => item.status !== 'completed'
    );
  }

  // Utility methods
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getPhotoTypeIcon(type: TaskPhoto['type']): string {
    const icons = {
      progress: 'trending-up',
      issue: 'warning',
      completion: 'check-circle',
      before: 'visibility',
      after: 'compare',
      inspection: 'search',
    };
    return icons[type] || 'photo';
  }

  getPhotoTypeColor(type: TaskPhoto['type']): string {
    const colors = {
      progress: '#4CAF50',
      issue: '#F44336',
      completion: '#2196F3',
      before: '#FF9800',
      after: '#9C27B0',
      inspection: '#00BCD4',
    };
    return colors[type] || '#757575';
  }

  // Mock data for development
  async loadMockPhotos(taskId: string): Promise<TaskPhoto[]> {
    const mockPhotos: TaskPhoto[] = [
      {
        id: '1',
        taskId,
        url: 'https://via.placeholder.com/400x300/4CAF50/FFFFFF?text=Progress+Photo',
        filename: 'progress-1.jpg',
        type: 'progress',
        description: 'Foundation work in progress',
        uploadedBy: '1',
        uploadedAt: new Date(Date.now() - 86400000).toISOString(),
        size: 1024000,
        width: 400,
        height: 300,
        metadata: {
          tags: ['foundation', 'concrete'],
          equipment: ['excavator', 'concrete-mixer'],
        },
      },
      {
        id: '2',
        taskId,
        url: 'https://via.placeholder.com/400x300/F44336/FFFFFF?text=Issue+Found',
        filename: 'issue-1.jpg',
        type: 'issue',
        description: 'Crack in the foundation wall',
        uploadedBy: '2',
        uploadedAt: new Date(Date.now() - 172800000).toISOString(),
        size: 2048000,
        width: 400,
        height: 300,
        metadata: {
          tags: ['crack', 'foundation', 'issue'],
          equipment: [],
        },
      },
    ];

    return mockPhotos;
  }
}

export const photoManagementService = new PhotoManagementService();
