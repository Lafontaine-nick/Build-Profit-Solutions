#!/usr/bin/env node

/**
 * Cleanup script to remove duplicate "Untitled Bid" entries
 * Run this in your React Native app or use it as a reference for cleanup
 */

const AsyncStorage = require('@react-native-async-storage/async-storage').default;

async function cleanupDuplicateBids() {
  try {
    const STORAGE_KEY = 'bps.unifiedProjects.v1';
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    
    if (!saved) {
      console.log('No projects found in storage');
      return;
    }
    
    const projects = JSON.parse(saved);
    console.log(`Found ${projects.length} total projects`);
    
    // Find all "Untitled Bid" entries with status 'estimate'
    const untitledBids = projects.filter(p => {
      const titleMatch = (p.title === 'Untitled Bid' || p.title === '' || !p.title);
      const statusMatch = p.status === 'estimate';
      return titleMatch && statusMatch;
    });
    
    console.log(`Found ${untitledBids.length} "Untitled Bid" entries`);
    
    if (untitledBids.length > 1) {
      // Sort by updatedAt (most recent first)
      const sorted = [...untitledBids].sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      
      const keepId = sorted[0].id;
      console.log(`\nKeeping most recent: ${keepId}`);
      console.log(`  Updated: ${sorted[0].updatedAt || sorted[0].createdAt}`);
      
      const toDelete = sorted.slice(1);
      console.log(`\nDeleting ${toDelete.length} duplicate(s):`);
      toDelete.forEach(bid => {
        console.log(`  - ${bid.id} (updated: ${bid.updatedAt || bid.createdAt})`);
      });
      
      // Remove duplicates from projects array
      const cleanedProjects = projects.filter(p => {
        const isDuplicate = toDelete.some(d => d.id === p.id);
        return !isDuplicate;
      });
      
      // Save back to storage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cleanedProjects));
      
      console.log(`\n✅ Cleanup complete! Removed ${toDelete.length} duplicate(s)`);
      console.log(`   Remaining projects: ${cleanedProjects.length}`);
    } else {
      console.log('No duplicates found');
    }
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
  }
}

// For use in React Native
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cleanupDuplicateBids };
}





