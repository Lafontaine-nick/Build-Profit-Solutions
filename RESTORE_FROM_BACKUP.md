# 📦 Step-by-Step: Restore Your App from Backup

Complete guide to restore your app on a new laptop using the backup file.

---

## 📋 STEP 1: Get the Backup File to Your New Laptop

### Option A: From Your Old Laptop
1. Find the backup file on your old laptop:
   - Location: `~/app-backups/build-profit-solutions-backup-20251230_234537.tar.gz`
   - Or check: `~/app-backups/` folder

2. Transfer it to your new laptop using one of these methods:
   - **USB Drive**: Copy the `.tar.gz` file to a USB drive, then copy to new laptop
   - **Cloud Storage**: Upload to iCloud, Dropbox, Google Drive, etc.
   - **AirDrop**: If both are Macs, use AirDrop
   - **Email**: If file is small enough, email it to yourself

### Option B: Download from Cloud/Backup Location
- If you saved it to cloud storage, download it to your new laptop

**Where to save it on new laptop:**
- Desktop: `~/Desktop/`
- Documents: `~/Documents/`
- Or anywhere you can find it easily

---

## 📥 STEP 2: Install Prerequisites on New Laptop

### 2.1 Install Node.js
1. Go to: https://nodejs.org/
2. Download the **LTS version** (v18 or higher)
3. Run the installer
4. Verify installation:
   ```bash
   node --version
   npm --version
   ```
   You should see version numbers (e.g., v20.10.0)

### 2.2 Install Git (if not already installed)
1. Open Terminal
2. Check if Git is installed:
   ```bash
   git --version
   ```
3. If not installed:
   - macOS: Usually pre-installed
   - Or download from: https://git-scm.com/downloads

### 2.3 Install Cursor IDE
1. Go to: https://cursor.sh/
2. Download Cursor for macOS
3. Install and open Cursor

### 2.4 Install Expo Go on Your Phone
- **iOS**: App Store → Search "Expo Go" → Install
- **Android**: Google Play → Search "Expo Go" → Install

---

## 📂 STEP 3: Extract the Backup File

### 3.1 Open Terminal
- Press `Cmd + Space`
- Type "Terminal"
- Press Enter

### 3.2 Navigate to Where You Want the Project
```bash
cd ~/Documents
```
(Or wherever you want to keep your projects)

### 3.3 Extract the Backup
```bash
# Replace the path with where YOUR backup file is located
tar -xzf ~/Desktop/build-profit-solutions-backup-20251230_234537.tar.gz
```

**If your backup is in a different location, adjust the path:**
```bash
# Examples:
tar -xzf ~/Downloads/build-profit-solutions-backup-20251230_234537.tar.gz
tar -xzf ~/Documents/backup-file.tar.gz
```

**Wait for extraction to complete** (may take 1-2 minutes)

### 3.4 Verify Extraction
```bash
ls
```
You should see a folder like `Build-Profit-Solutions` or `build-profit-solutions`

### 3.5 Go Into the Project Folder
```bash
cd Build-Profit-Solutions
# or
cd build-profit-solutions
# (use whatever folder name appeared)
```

---

## 📦 STEP 4: Install Dependencies

### 4.1 Install Backend Dependencies
```bash
cd backend
npm install
```
⏱️ **Wait 2-5 minutes** - You'll see lots of package names scrolling

### 4.2 Go Back to Project Root
```bash
cd ..
```

### 4.3 Install Mobile App Dependencies
```bash
cd mobile
npm install
```
⏱️ **Wait 3-7 minutes** - This installs React Native, Expo, and all mobile dependencies

### 4.4 Go Back to Project Root
```bash
cd ..
```

---

## 🔐 STEP 5: Set Up Environment Variables

### 5.1 Copy the Example Environment File
```bash
cd backend
cp env.example .env
```

### 5.2 Open the .env File
You can use Cursor or any text editor:
```bash
# Option 1: Open in Cursor
# In Cursor: File → Open → Select backend/.env

# Option 2: Open in default editor
open .env

# Option 3: Use terminal editor
nano .env
```

### 5.3 Add Your API Keys
Edit the `.env` file and add your keys:

**Required:**
```
OPENAI_API_KEY=your_actual_openai_key_here
JWT_SECRET=generate_a_random_string_here
```

**To generate a random JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and paste it as your `JWT_SECRET`.

**Optional (add if you have them):**
```
WEBSCRAPINGAPI_KEY=your_key_here
SERPAPI_KEY=your_key_here
YELP_API_KEY=your_key_here
STRIPE_SECRET_KEY=your_key_here
```

### 5.4 Save the File
- If using Cursor: `Cmd + S`
- If using nano: `Ctrl + X`, then `Y`, then `Enter`

### 5.5 Go Back to Project Root
```bash
cd ..
```

---

## 🚀 STEP 6: Start the Backend Server

### 6.1 Open a Terminal Window
Keep this terminal open - you'll run the backend here.

### 6.2 Navigate to Backend
```bash
cd ~/Documents/Build-Profit-Solutions/backend
```
(Adjust path if you extracted to a different location)

### 6.3 Start the Server
```bash
npm run dev
```

**You should see:**
```
[nodemon] starting `node src/server.js`
Server running on port 3001
```

✅ **Leave this terminal running!** Don't close it.

---

## 📱 STEP 7: Start the Mobile App

### 7.1 Open a NEW Terminal Window
- Press `Cmd + T` in Terminal (new tab)
- Or open a completely new Terminal window

### 7.2 Navigate to Mobile Folder
```bash
cd ~/Documents/Build-Profit-Solutions/mobile
```
(Adjust path if needed)

### 7.3 Start Expo
```bash
npm run dev:lan
```

**You should see:**
- Metro bundler starting
- A QR code appearing in the terminal
- Text like "Metro waiting on..."

✅ **Leave this terminal running too!**

---

## 📲 STEP 8: Connect Your Phone

### 8.1 Make Sure Phone and Laptop are on Same WiFi
- Check your phone's WiFi settings
- Check your computer's WiFi
- **They must be on the same network**

### 8.2 Open Expo Go App
- Open the Expo Go app on your phone

### 8.3 Scan the QR Code
1. In Expo Go, tap "Scan QR code"
2. Point your phone's camera at the QR code in Terminal 2
3. The app should start loading

### 8.4 Wait for App to Load
- You'll see "Building JavaScript bundle" in the terminal
- The app will open on your phone when ready
- This may take 30-60 seconds the first time

---

## 💻 STEP 9: Open Project in Cursor

### 9.1 Open Cursor IDE
- Click the Cursor icon in Applications
- Or use Spotlight: `Cmd + Space`, type "Cursor"

### 9.2 Open the Project
1. In Cursor: Click **File** → **Open Folder...**
2. Navigate to: `~/Documents/Build-Profit-Solutions`
   (or wherever you extracted the backup)
3. Click "Open"

### 9.3 Wait for Indexing
- Cursor will start indexing your codebase
- You'll see a progress indicator
- This may take 1-2 minutes

---

## ✅ STEP 10: Verify Everything Works

### 10.1 Check Backend is Running
Open a browser and go to:
```
http://localhost:3001/health
```
You should see: `{"status":"ok"}`

### 10.2 Check Mobile App
- Your phone should show the app running
- Try navigating around the app
- Everything should work as before!

---

## 🎉 You're Done!

Your app is now restored and running:
- ✅ All your code is restored from backup
- ✅ Backend running on port 3001
- ✅ Mobile app ready on your phone
- ✅ Cursor IDE ready for editing
- ✅ Everything works exactly as before!

---

## 🆘 Troubleshooting

### Problem: "command not found: npm"
**Solution:** Node.js isn't installed. Go back to STEP 2.1 and install Node.js.

### Problem: "npm install" fails
**Solution:**
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Problem: Port 3001 already in use
**Solution:**
```bash
lsof -i :3001
# Note the PID number, then:
kill -9 <PID>
```

### Problem: Can't scan QR code / Network error
**Solutions:**
1. Make sure phone and computer are on same WiFi
2. Try using tunnel mode:
   ```bash
   cd mobile
   npm run dev:tunnel
   ```
3. Check if backend is running (visit http://localhost:3001/health)

### Problem: Backend won't start
**Solution:**
1. Check if `.env` file exists in `backend/` folder
2. Make sure required keys are set (OPENAI_API_KEY, JWT_SECRET)
3. Check for error messages in terminal

### Problem: App won't load on phone
**Solution:**
```bash
cd mobile
npm run dev:clear
npm run dev:lan
```

---

## 📝 Quick Command Reference

**From project root:**
```bash
# Start backend (Terminal 1)
cd backend && npm run dev

# Start mobile (Terminal 2)
cd mobile && npm run dev:lan

# Check if backend is running
curl http://localhost:3001/health
```

---

**That's it! Your app is restored and ready to use! 🚀**


