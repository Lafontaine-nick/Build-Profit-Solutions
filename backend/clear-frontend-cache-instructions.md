# Clear Frontend Leads Cache

The frontend caches leads in AsyncStorage. To see the new leads, you need to clear this cache.

## Option 1: Clear via App (Recommended)
1. Open the app
2. Go to the Leads screen
3. Pull down to refresh (swipe down from the top)
4. If that doesn't work, restart the app completely

## Option 2: Clear AsyncStorage Programmatically
If you have access to the React Native debugger or Expo dev tools:

```javascript
// In the app console or React Native debugger:
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.removeItem('leadsData');
console.log('✅ Cleared leadsData from AsyncStorage');
```

## Option 3: Clear All App Data
- **iOS Simulator**: Reset Simulator (Device > Erase All Content and Settings)
- **Android Emulator**: Wipe Data (Settings > Apps > Your App > Storage > Clear Data)
- **Physical Device**: Uninstall and reinstall the app

## Verify Backend is Serving New Leads
Run this command to verify:
```bash
curl "http://localhost:3001/api/unified-leads/contractor/contractor-demo" | jq '.leads | length'
```

You should see 16 leads with IDs starting with "MOCK-".
