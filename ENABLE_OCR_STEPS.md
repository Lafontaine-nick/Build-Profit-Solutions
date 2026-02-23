# Step-by-Step Guide: Enable Real OCR for Receipt Scanning

## Overview
This guide will help you enable real OCR (Optical Character Recognition) using OpenAI Vision API to automatically extract data from receipt photos.

---

## Step 1: Get OpenAI API Key

1. **Go to OpenAI Platform**
   - Visit: https://platform.openai.com/
   - Sign in or create an account

2. **Create API Key**
   - Click on your profile (top right)
   - Select "API Keys" from the menu
   - Click "Create new secret key"
   - Give it a name (e.g., "BPS Receipt OCR")
   - **Copy the key immediately** (you won't be able to see it again!)

3. **Check Your Billing**
   - Make sure you have credits/billing set up
   - GPT-4 Vision API costs ~$0.01-0.03 per image
   - Visit: https://platform.openai.com/account/billing

---

## Step 2: Add API Key to Backend

1. **Navigate to backend directory**
   ```bash
   cd /Users/nicholas/Documents/Build-Profit-Solutions/backend
   ```

2. **Check if .env file exists**
   ```bash
   ls -la .env
   ```
   
   If it doesn't exist, create it from the example:
   ```bash
   cp env.example .env
   ```

3. **Open .env file in your editor**
   ```bash
   nano .env
   ```
   Or use your preferred editor (VS Code, etc.)

4. **Find the OPENAI_API_KEY line and update it**
   ```env
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```
   
   Replace `sk-your-actual-api-key-here` with the key you copied from Step 1.

5. **Save the file**
   - If using nano: Press `Ctrl+X`, then `Y`, then `Enter`
   - If using VS Code: `Cmd+S` (Mac) or `Ctrl+S` (Windows)

---

## Step 3: Update Backend OCR Route

The backend code will be updated to use the OpenAI endpoint. The main `/api/ocr/receipt` endpoint will now call the OpenAI Vision API instead of returning mock data.

**Note:** The code update is already prepared. After you complete Step 2, the backend will automatically use OpenAI when you restart it.

---

## Step 4: Restart Backend Server

1. **Stop the current backend** (if running)
   - Press `Ctrl+C` in the terminal where backend is running
   - Or kill the process:
     ```bash
     lsof -ti:3001 | xargs kill -9
     ```

2. **Start the backend again**
   ```bash
   cd /Users/nicholas/Documents/Build-Profit-Solutions/backend
   npm start
   ```

3. **Verify it's running**
   - You should see: `🚀 Server running on port 3001`
   - Check: http://localhost:3001/health

---

## Step 5: Test OCR Functionality

1. **Open the mobile app** (or refresh if already open)

2. **Navigate to a project**
   - Go to Projects tab
   - Select any project
   - Go to Budget tab

3. **Add Materials & Equipment**
   - Tap "+ Add Materials & Equipment"
   - Scroll down to "Receipt (Optional)" section
   - Tap "📸 Take Photo or 📄 Upload Receipt"

4. **Take/Upload a Receipt Photo**
   - Take a photo of a receipt OR upload one from your gallery
   - Wait for "OCR Processing" modal

5. **Verify Auto-Fill**
   - The form should auto-fill with:
     - ✅ Vendor name
     - ✅ Amount
     - ✅ Description (from receipt items)
   - Review and edit if needed
   - Tap "✓ Save"

---

## Troubleshooting

### Issue: "OpenAI API key not configured"
**Solution:** 
- Check that `.env` file exists in `backend/` directory
- Verify `OPENAI_API_KEY=sk-...` is set correctly
- Make sure there are no extra spaces or quotes around the key
- Restart the backend server

### Issue: "Failed to process receipt with AI"
**Possible causes:**
- API key is invalid or expired
- No billing/credits on OpenAI account
- Network connectivity issue
- Receipt image is too blurry or unclear

**Solution:**
- Check OpenAI dashboard for API errors
- Verify billing is set up
- Try a clearer receipt image
- Check backend logs for detailed error messages

### Issue: OCR returns mock data instead of real data
**Solution:**
- Verify backend is using the updated code (check Step 3)
- Check backend console logs - should show OpenAI API calls
- Verify `.env` file has correct API key
- Restart backend server

### Issue: Backend won't start
**Solution:**
- Check for syntax errors in `.env` file
- Make sure no other process is using port 3001
- Check backend logs for error messages

---

## Cost Estimation

**OpenAI GPT-4 Vision Pricing:**
- ~$0.01-0.03 per receipt image
- 100 receipts = ~$1-3
- 1000 receipts = ~$10-30

**Tips to reduce costs:**
- Only use OCR when needed (optional feature)
- Users can still manually enter data
- Consider caching results for duplicate receipts

---

## Next Steps (Optional Enhancements)

1. **Add error handling for edge cases**
   - Handle receipts with poor image quality
   - Handle receipts in different languages
   - Handle receipts with unusual formats

2. **Add confidence threshold**
   - Only auto-fill if confidence > 80%
   - Show confidence score to user

3. **Add receipt validation**
   - Verify extracted amounts match receipt totals
   - Flag suspicious data for manual review

---

## Support

If you encounter issues:
1. Check backend console logs
2. Check mobile app console logs
3. Verify API key is valid at https://platform.openai.com/api-keys
4. Test API key directly with OpenAI API

---

**That's it! Your OCR should now be working with real AI-powered receipt scanning! 🎉**
