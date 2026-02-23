# Debug OCR Issues

## Quick Checklist

1. **Backend is running?**
   ```bash
   curl http://localhost:3001/health
   ```

2. **Backend restarted after adding API key?**
   - The backend needs to be restarted to load the new OPENAI_API_KEY
   - Stop it (Ctrl+C) and restart: `cd backend && npm start`

3. **Check backend logs when scanning receipt:**
   - Look for: `✅ OCR Success: Extracted receipt data using OpenAI`
   - Or: `⚠️  Using mock OCR data`

4. **Check mobile app console logs:**
   - Look for: `🔍 Starting OCR processing`
   - Look for: `🌐 Calling backend OCR API...`
   - Look for: `✅ Backend OCR succeeded` or error messages

## Common Issues

### Issue: "Using mock OCR data"
**Cause:** Backend not using OpenAI API
**Fix:** 
- Check `.env` file has correct API key
- Restart backend server
- Check backend logs for OpenAI errors

### Issue: "Network request failed"
**Cause:** Backend not accessible from mobile device
**Fix:**
- Check backend is running: `curl http://localhost:3001/health`
- Check mobile app is using correct API URL
- For physical device, use LAN IP (not localhost)

### Issue: "Failed to read image file"
**Cause:** Image URI is invalid or file system error
**Fix:**
- Make sure ImagePicker returns valid URI
- Check file permissions
- Try using `base64: true` in ImagePicker (already added)

### Issue: "OpenAI API error"
**Cause:** API key invalid or no credits
**Fix:**
- Verify API key at https://platform.openai.com/api-keys
- Check billing at https://platform.openai.com/account/billing
- Test API key directly

## Test the Receipt Image

The Home Depot receipt you showed should work perfectly:
- **Vendor:** The Home Depot
- **Date:** 04/25/19
- **Total:** $12.57
- **Items:** 2 spray paint items

This is a clear, readable receipt that OCR should handle easily.
