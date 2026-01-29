import { safeAsyncStorage } from '../utils/asyncStorage';

export interface SavedMaterial {
  sku: string;
  title: string;
  price: number;
  store: string;
  zip?: string;
  url?: string;
  image?: string;
  unit?: string;
  savedAt: string; // ISO timestamp
}

const STORAGE_KEY = 'bps.savedMaterials';

/**
 * Get all saved materials
 */
export async function getSavedMaterials(): Promise<SavedMaterial[]> {
  try {
    const data = await safeAsyncStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading saved materials:', error);
    return [];
  }
}

/**
 * Save a material to saved list
 */
export async function saveMaterial(material: Omit<SavedMaterial, 'savedAt'>): Promise<void> {
  try {
    const saved = await getSavedMaterials();
    // Check if already saved
    const exists = saved.find(m => m.sku === material.sku && m.store === material.store);
    if (exists) {
      // Update existing
      const updated = saved.map(m => 
        m.sku === material.sku && m.store === material.store 
          ? { ...material, savedAt: m.savedAt } // Keep original savedAt
          : m
      );
      await safeAsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } else {
      // Add new
      const newMaterial: SavedMaterial = {
        ...material,
        savedAt: new Date().toISOString(),
      };
      await safeAsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...saved, newMaterial]));
    }
  } catch (error) {
    console.error('Error saving material:', error);
  }
}

/**
 * Remove a material from saved list
 */
export async function removeSavedMaterial(sku: string, store: string): Promise<void> {
  try {
    const saved = await getSavedMaterials();
    const filtered = saved.filter(m => !(m.sku === sku && m.store === store));
    await safeAsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing saved material:', error);
  }
}

/**
 * Check if a material is saved
 */
export async function isMaterialSaved(sku: string, store: string): Promise<boolean> {
  try {
    const saved = await getSavedMaterials();
    return saved.some(m => m.sku === sku && m.store === store);
  } catch (error) {
    console.error('Error checking if material is saved:', error);
    return false;
  }
}

/**
 * Clear all saved materials
 */
export async function clearSavedMaterials(): Promise<void> {
  try {
    await safeAsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing saved materials:', error);
  }
}
