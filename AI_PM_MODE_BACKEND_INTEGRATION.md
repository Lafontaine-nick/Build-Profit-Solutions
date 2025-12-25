# AI Project Manager Mode - Backend API Integration

## Overview
This document describes the backend API integration for AI Project Manager Mode, enabling persistent storage and proactive monitoring capabilities.

## What Was Implemented

### 1. Database Schema (`backend/src/database/schema.sql`)
- Added `user_settings` table to store AI PM mode preferences
- Fields:
  - `ai_project_manager_mode` (boolean) - Enable/disable PM mode
  - `ai_manager_aggressiveness` (varchar) - How proactive the AI should be (low/medium/high)
  - `ai_notify_about` (varchar) - What to notify about (all/schedule_only/profit_only/missing_info)
  - `ai_preferred_channel` (varchar) - How to deliver updates (in_app/email_summary/both)
- Added indexes and triggers for performance

### 2. Backend API Routes (`backend/src/routes/userSettings.js`)
- **GET `/api/user-settings`** - Fetch user's AI PM mode settings
  - Returns default settings if none exist
  - Requires authentication (JWT token)
  
- **PATCH `/api/user-settings`** - Update user's AI PM mode settings
  - Supports partial updates
  - Creates settings if they don't exist
  - Requires authentication (JWT token)

### 3. Frontend API Service (`mobile/services/api.ts`)
- Added `getUserSettings()` method
- Added `updateUserSettings(updates)` method
- Both methods use authenticated requests via the existing API service

### 4. Frontend Hook Update (`mobile/state/useAIManagerMode.ts`)
- Replaced mock API calls with real backend API calls
- Added error handling with fallback to defaults
- Optimistic updates for better UX
- Proper error recovery

### 5. Proactive Monitoring (`mobile/components/AIAssistantModal.tsx`)
- When AI PM mode is enabled and the Assistant opens:
  - Automatically triggers a project health check
  - Provides proactive insights without user prompting
  - Only runs once per session to avoid spam

## How It Works

### User Flow
1. User toggles AI Project Manager Mode in the AI Assistant
2. Frontend sends PATCH request to `/api/user-settings` with new value
3. Backend stores preference in `user_settings` table
4. Setting persists across app sessions
5. When Assistant opens with PM mode enabled, proactive health check runs automatically

### Backend Behavior
- When `ai_project_manager_mode` is `true`, the AI system prompt includes `[AI PROJECT MANAGER MODE: ENABLED]`
- This makes the AI:
  - Proactively check project health
  - Identify risks and missing costs
  - Suggest next actions
  - Monitor profit margins
  - Track schedules and payments

### Authentication
- Uses JWT tokens from `Authorization: Bearer <token>` header
- Token obtained from AsyncStorage (`authToken` key)
- Backend validates token using `JWT_SECRET` environment variable

## Database Migration

To apply the schema changes, run:

```sql
-- Run the updated schema.sql or execute these commands:
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ai_project_manager_mode BOOLEAN DEFAULT false,
    ai_manager_aggressiveness VARCHAR(20) DEFAULT 'medium',
    ai_notify_about VARCHAR(50) DEFAULT 'all',
    ai_preferred_channel VARCHAR(50) DEFAULT 'in_app',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Testing

### Test the API Endpoints

1. **Get Settings** (requires auth token):
```bash
curl -X GET http://localhost:3001/api/user-settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

2. **Update Settings**:
```bash
curl -X PATCH http://localhost:3001/api/user-settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ai_project_manager_mode": true}'
```

### Test in App
1. Open AI Assistant
2. Toggle "AI Project Manager Mode" switch
3. Close and reopen the Assistant
4. Setting should persist
5. With PM mode enabled, health check should run automatically

## Future Enhancements

1. **Background Jobs**: Add scheduled background checks for active projects
2. **Push Notifications**: Send alerts when risks are detected
3. **Email Summaries**: Weekly project health reports via email
4. **Project-Specific Settings**: Allow different PM mode settings per project
5. **Alert History**: Track and display past alerts/notifications

## Notes

- The backend falls back to in-memory storage if database is unavailable (development mode)
- Frontend gracefully handles API failures with sensible defaults
- Proactive monitoring only runs when Assistant is opened (not in background)
- All settings are user-specific and isolated by `user_id`












