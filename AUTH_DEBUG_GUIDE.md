# Authentication Debugging Guide

## How to Check and Fix Authentication Issues

### Quick Check Methods

#### Method 1: Check in React Native Debugger Console

1. Open your app in development mode
2. Open React Native Debugger or Chrome DevTools
3. In the console, run:

```javascript
// Check token status
import { debugAuthStatus } from './mobile/utils/authTokenHelper';
await debugAuthStatus();
```

#### Method 2: Add Debug Button to Your App (Temporary)

Add this to any screen temporarily to check auth status:

```typescript
import { debugAuthStatus, checkAuthTokenStatus } from '@/utils/authTokenHelper';
import { Button } from 'react-native';

// In your component:
<Button 
  title="Check Auth Status" 
  onPress={async () => {
    const status = await checkAuthTokenStatus();
    Alert.alert('Auth Status', JSON.stringify(status, null, 2));
    await debugAuthStatus();
  }} 
/>
```

#### Method 3: Check Backend Logs

When you try to add an expense, check the backend terminal. You should see:
- `✅ Auth token found (length: XXX)` - Token is present
- `⚠️ No auth token found` - Token is missing

### Common Issues and Fixes

#### Issue 1: Token Not in AsyncStorage

**Symptoms:**
- Error: "Access token required" or "Invalid or expired token"
- Backend logs show: "⚠️ No auth token found"

**Fix:**
The token should be automatically synced when you use the AI Assistant (it uses Clerk). If it's not working:

1. **Log out and log back in** - This will refresh the token
2. **Check if Clerk is properly configured** - Make sure `CLERK_PUBLISHABLE_KEY` is set
3. **Manually sync token** (if needed):

```typescript
import { syncClerkTokenToAsyncStorage } from '@/utils/authTokenHelper';
import { useAuth } from '@clerk/clerk-expo';

// In a component:
const { getToken } = useAuth();
const token = await getToken();
if (token) {
  await syncClerkTokenToAsyncStorage(token);
}
```

#### Issue 2: Token Expired

**Symptoms:**
- Error: "Invalid or expired token"
- Backend returns 403 status

**Fix:**
1. **Log out and log back in** to get a fresh token
2. The token should auto-refresh, but if it doesn't, manually refresh:

```typescript
// In clerkAuth.ts, there's a refreshToken method
// Or simply log out and back in
```

#### Issue 3: Token Format Wrong

**Symptoms:**
- Token exists but backend rejects it
- Backend logs show token but authentication fails

**Fix:**
1. Check token format - should be a JWT (starts with `eyJ`)
2. Verify backend JWT_SECRET matches
3. Check token expiration time

### Testing Authentication

#### Test 1: Check Token Exists

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const token = await AsyncStorage.getItem('auth_token');
console.log('Token exists:', !!token);
console.log('Token length:', token?.length);
console.log('Token preview:', token?.substring(0, 20));
```

#### Test 2: Test Backend API Call

```typescript
import api from '@/services/BackendAPI';

// Try a simple API call
const response = await api.healthCheck();
console.log('Backend health check:', response);
```

#### Test 3: Test Expense Endpoint Directly

```typescript
import api from '@/services/BackendAPI';

const response = await api.addExpense('test-project-id', {
  amount: 1,
  category: 'Test',
  vendor: 'Test Vendor',
});

if (response.success) {
  console.log('✅ Authentication working!');
} else {
  console.error('❌ Authentication failed:', response.error);
}
```

### Automatic Fixes Applied

The code has been updated to:

1. **Auto-sync Clerk tokens** - When AI Assistant is used, it now syncs the Clerk token to AsyncStorage
2. **Better error messages** - More descriptive errors when auth fails
3. **Token validation** - Checks token exists before making API calls

### Manual Fix Steps

If automatic fixes don't work:

1. **Clear all auth data:**
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.removeItem('auth_token');
await AsyncStorage.removeItem('user_data');
```

2. **Log out completely:**
```typescript
// Use your app's logout function
// This should clear Clerk session and AsyncStorage
```

3. **Log back in:**
- Use your normal login flow
- The token should be stored automatically

4. **Verify token is stored:**
```typescript
import { checkAuthTokenStatus } from '@/utils/authTokenHelper';
const status = await checkAuthTokenStatus();
console.log('Token status:', status);
```

### Backend Configuration Check

Make sure your backend has:

1. **JWT_SECRET set** in `.env`:
```bash
JWT_SECRET=your-secret-key-here
```

2. **Token expiration** is reasonable (default is 7 days):
```javascript
// In backend/src/routes/auth.js
{ expiresIn: '7d' }
```

3. **CORS allows your app's origin**

### Still Having Issues?

1. Check backend logs for detailed error messages
2. Verify backend is running: `curl http://localhost:3001/health`
3. Check network connectivity between app and backend
4. Verify API base URL is correct in app config
