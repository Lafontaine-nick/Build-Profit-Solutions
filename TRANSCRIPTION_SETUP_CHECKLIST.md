# Voice Transcription Setup Checklist

Use this checklist to verify your voice transcription setup is working correctly.

## ✅ 1. OpenAI API Key Configuration

**Location:** `backend/.env`

**Check:**
```bash
cd backend
cat .env | grep OPENAI_API_KEY
```

**Expected Output:**
```
OPENAI_API_KEY=sk-...your_actual_key_here...
```

**If missing or placeholder:**
1. Get your API key from: https://platform.openai.com/api-keys
2. Add to `backend/.env`:
   ```
   OPENAI_API_KEY=sk-your_actual_key_here
   ```
3. Restart your backend server

**Status:** ☐ Configured ☐ Missing/Placeholder

---

## ✅ 2. Network Connectivity

**Check if backend is reachable:**

### For iOS Simulator:
```bash
curl http://localhost:3001/health
```

### For Physical Device:
```bash
# Find your Mac's IP address
ifconfig | grep "inet " | grep -v 127.0.0.1

# Test connectivity (replace with your IP)
curl http://192.168.1.XXX:3001/health
```

**Expected Response:**
```json
{"status":"OK","timestamp":"...","version":"1.0.0"}
```

**If not reachable:**
1. Make sure backend is running: `cd backend && npm start`
2. Check firewall settings
3. Verify both devices are on the same network
4. Update `EXPO_PUBLIC_AI_API_URL` in `mobile/.env` if needed

**Status:** ☐ Backend Reachable ☐ Not Reachable

---

## ✅ 3. Audio Format Handling

**Location:** `mobile/components/AIAssistantModal.tsx` (line ~941)

**Check:**
```bash
cd mobile
grep -n "Platform.OS === 'ios' ? 'm4a' : 'mp4'" components/AIAssistantModal.tsx
```

**Expected:**
- iOS devices use `m4a` format
- Android devices use `mp4` format
- Code should be: `format: Platform.OS === 'ios' ? 'm4a' : 'mp4'`

**Status:** ☐ Implemented Correctly ☐ Needs Fix

---

## ✅ 4. Backend Transcription Endpoint

**Location:** `backend/src/routes/aiAssistant.js` (line ~1565)

**Check:**
```bash
cd backend
grep -n "/transcribe" src/routes/aiAssistant.js
grep -n "whisper-1" src/routes/aiAssistant.js
```

**Expected:**
- Endpoint exists at `/api/ai-assistant/transcribe`
- Uses OpenAI Whisper model `whisper-1`
- Handles base64 audio input

**Status:** ☐ Implemented ☐ Missing

---

## ✅ 5. Frontend Logging

**When testing transcription, check console logs for:**

1. **Recording Start:**
   ```
   🎤 Starting transcription for: file:///...
   🎤 Audio file read, size: XXXX characters
   🎤 Sending transcription request to: http://...
   ```

2. **Backend Response:**
   ```
   🎤 Transcription response status: 200
   ✅ Transcription successful: [your text]
   ```

3. **Errors (if any):**
   ```
   ❌ Transcription error: [error message]
   ```

**Status:** ☐ Logs Appearing ☐ No Logs

---

## 🧪 Testing Steps

1. **Start Backend:**
   ```bash
   cd backend
   npm start
   ```

2. **Start Mobile App:**
   ```bash
   cd mobile
   npm start
   ```

3. **Test Recording:**
   - Open AI Assistant (any page)
   - Tap microphone button
   - Grant permissions
   - Speak clearly for 2-3 seconds
   - Tap stop button
   - Check console logs
   - Verify text appears in input field

---

## 🔧 Common Issues & Fixes

### Issue: "Transcription Unavailable" Alert
**Possible Causes:**
- OpenAI API key not set or invalid
- Backend not reachable
- Network connectivity issue

**Fix:**
1. Verify `OPENAI_API_KEY` in `backend/.env`
2. Check backend logs for errors
3. Test backend health endpoint
4. Check network connectivity

### Issue: "Cannot find module 'expo-av'"
**Fix:**
```bash
cd mobile
npm install expo-av
# Restart dev server
```

### Issue: "Cannot unload a Recording that has already been unloaded"
**Status:** ✅ Fixed in latest code
**Action:** Restart dev server to pick up changes

### Issue: Recording works but no transcription
**Check:**
1. Backend console logs for transcription errors
2. OpenAI API key is valid and has credits
3. Network connectivity to backend
4. Audio file size (should be > 0)

---

## 📝 Quick Verification Commands

Run these to quickly check your setup:

```bash
# 1. Check OpenAI key exists (won't show value for security)
cd backend
grep -q "OPENAI_API_KEY=" .env && echo "✅ Key exists" || echo "❌ Key missing"

# 2. Check backend is running
curl -s http://localhost:3001/health | grep -q "OK" && echo "✅ Backend running" || echo "❌ Backend not running"

# 3. Check transcription endpoint exists
grep -q "/transcribe" src/routes/aiAssistant.js && echo "✅ Endpoint exists" || echo "❌ Endpoint missing"

# 4. Check expo-av is installed
cd ../mobile
grep -q "expo-av" package.json && echo "✅ expo-av installed" || echo "❌ expo-av missing"
```

---

## ✅ Final Checklist

Before testing, ensure:
- [ ] OpenAI API key is set in `backend/.env`
- [ ] Backend server is running on port 3001
- [ ] Backend is reachable from your device/simulator
- [ ] `expo-av` package is installed in mobile
- [ ] Mobile app has microphone permissions
- [ ] Console logs are enabled for debugging

---

## 🆘 Still Having Issues?

If transcription still doesn't work after checking all items:

1. **Check Backend Logs:**
   Look for errors starting with `🎤` or `❌` in backend console

2. **Check Mobile Logs:**
   Look for errors starting with `🎤` or `❌` in mobile console

3. **Test OpenAI API Directly:**
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

4. **Verify Audio File:**
   Check that audio file is being created and has content (> 0 bytes)
