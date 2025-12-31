# 📝 Step-by-Step Setup Guide for New Computer

Follow these steps exactly to get your app running on a new computer.

---

## STEP 1: Install Required Software

### 1.1 Install Node.js
1. Go to: https://nodejs.org/
2. Download the LTS version (v18 or higher)
3. Run the installer
4. Verify installation by opening Terminal and running:
   ```bash
   node --version
   npm --version
   ```
   You should see version numbers (e.g., v20.10.0 and 10.2.3)

### 1.2 Install Git (if not already installed)
1. macOS: Usually pre-installed. Check with:
   ```bash
   git --version
   ```
2. If not installed, download from: https://git-scm.com/downloads
   - OR use Homebrew: `brew install git`

### 1.3 Install Cursor IDE
1. Go to: https://cursor.sh/
2. Download Cursor for your operating system
3. Install Cursor
4. Open Cursor and sign in with your account

---

## STEP 2: Get Your Code

### 2.1 Open Terminal
- On macOS: Press `Cmd + Space`, type "Terminal", press Enter
- Or: Applications → Utilities → Terminal

### 2.2 Navigate to Your Projects Folder
```bash
cd ~/Documents
```
(Or wherever you want to keep your projects)

### 2.3 Clone the Repository
```bash
git clone https://github.com/Lafontaine-nick/Build-Profit-Solutions.git
```

Wait for it to finish downloading (you'll see a progress indicator).

### 2.4 Go Into the Project Folder
```bash
cd Build-Profit-Solutions
```

You should now be in: `/Users/YourName/Documents/Build-Profit-Solutions`

---

## STEP 3: Install Backend Dependencies

### 3.1 Navigate to Backend Folder
```bash
cd backend
```

### 3.2 Install Packages
```bash
npm install
```

**Wait for this to complete** (may take 2-5 minutes). You'll see lots of package names scrolling by.

### 3.3 Go Back to Project Root
```bash
cd ..
```

---

## STEP 4: Install Mobile App Dependencies

### 4.1 Navigate to Mobile Folder
```bash
cd mobile
```

### 4.2 Install Packages
```bash
npm install
```

**Wait for this to complete** (may take 3-7 minutes). This installs React Native, Expo, and all mobile dependencies.

### 4.3 Go Back to Project Root
```bash
cd ..
```

---

## STEP 5: Set Up Environment Variables

### 5.1 Copy the Example Environment File
```bash
cd backend
cp env.example .env
```

### 5.2 Open the .env File
You can use any text editor, or use Cursor:
```bash
# In Cursor: File → Open → Select backend/.env
# OR use terminal editor:
nano .env
```

### 5.3 Add Your API Keys

Edit the `.env` file and replace the placeholder values:

**Required:**
```
OPENAI_API_KEY=your_actual_openai_key_here
JWT_SECRET=generate_a_random_string_here
```

**Optional (add if you have them):**
```
WEBSCRAPINGAPI_KEY=your_key_here
SERPAPI_KEY=your_key_here
YELP_API_KEY=your_key_here
STRIPE_SECRET_KEY=your_key_here
```

**To generate a random JWT_SECRET, run this in terminal:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and paste it as your `JWT_SECRET`.

### 5.4 Save the File
- If using `nano`: Press `Ctrl+X`, then `Y`, then `Enter`
- If using Cursor: Just save normally (`Cmd+S`)

### 5.5 Go Back to Project Root
```bash
cd ..
```

---

## STEP 6: Verify Everything is Ready

### 6.1 Check You're in the Right Place
```bash
pwd
```
Should show: `/Users/YourName/Documents/Build-Profit-Solutions`

### 6.2 List Folders (optional check)
```bash
ls
```
You should see: `backend`, `mobile`, `app`, and other folders

---

## STEP 7: Start the Backend Server

### 7.1 Open a Terminal Window/Tab
Keep this terminal open - you'll run the backend here.

### 7.2 Navigate to Backend
```bash
cd ~/Documents/Build-Profit-Solutions/backend
```
(Adjust path if you cloned to a different location)

### 7.3 Start the Server
```bash
npm run dev
```

**You should see:**
```
[nodemon] starting `node src/server.js`
Server running on port 3001
```

**Leave this terminal running!** Don't close it.

---

## STEP 8: Start the Mobile App

### 8.1 Open a NEW Terminal Window/Tab
- macOS: `Cmd + T` in Terminal, or open a new Terminal window

### 8.2 Navigate to Mobile Folder
```bash
cd ~/Documents/Build-Profit-Solutions/mobile
```

### 8.3 Start Expo
```bash
npm run dev:lan
```

**You should see:**
- Metro bundler starting
- A QR code appearing in the terminal
- Some text like "Metro waiting on..."

**Leave this terminal running too!**

---

## STEP 9: Connect Your Phone

### 9.1 Install Expo Go App
- iOS: Download "Expo Go" from the App Store
- Android: Download "Expo Go" from Google Play Store

### 9.2 Make Sure Phone and Computer are on Same WiFi
- Check your phone's WiFi settings
- Check your computer's WiFi
- They must be on the same network

### 9.3 Scan the QR Code
1. Open Expo Go app on your phone
2. Tap "Scan QR code"
3. Point camera at the QR code in your terminal
4. The app should start loading

### 9.4 Wait for App to Load
- You'll see "Building JavaScript bundle" in the terminal
- The app will open on your phone when ready
- This may take 30-60 seconds the first time

---

## STEP 10: Open Project in Cursor

### 10.1 Open Cursor IDE
Click the Cursor icon in your Applications folder (or use Spotlight: `Cmd + Space`, type "Cursor")

### 10.2 Open the Project
1. In Cursor: Click **File** → **Open Folder...**
2. Navigate to: `/Users/YourName/Documents/Build-Profit-Solutions`
3. Click "Open"

### 10.3 Wait for Indexing
Cursor will start indexing your codebase (you'll see a progress indicator). This may take a minute.

---

## ✅ You're Done!

Your app should now be:
- ✅ Backend running on port 3001
- ✅ Mobile app showing QR code
- ✅ App loaded on your phone via Expo Go
- ✅ Project open in Cursor IDE

---

## 🆘 Troubleshooting

### Problem: "command not found: npm"
**Solution:** Node.js isn't installed or not in PATH. Reinstall Node.js from nodejs.org

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
2. Try using `npm run dev:tunnel` instead of `npm run dev:lan`
3. Check if backend is running (visit http://localhost:3001/health in browser)

### Problem: Backend won't start
**Solution:**
1. Check if `.env` file exists in `backend/` folder
2. Make sure required keys are set (OPENAI_API_KEY, JWT_SECRET)
3. Check for error messages in terminal

### Problem: Expo app won't load
**Solution:**
```bash
cd mobile
npm run dev:clear
npm run dev:lan
```

---

## 📋 Quick Command Reference

**From project root (`~/Documents/Build-Profit-Solutions`):**

```bash
# Start backend (Terminal 1)
cd backend && npm run dev

# Start mobile (Terminal 2)  
cd mobile && npm run dev:lan

# Or use the all-in-one script
./start-app.sh

# Check if backend is running
curl http://localhost:3001/health
```

---

## 🎯 Next Steps

1. **Make changes in Cursor** - Edit your code
2. **See changes instantly** - Expo hot reloads automatically
3. **Commit your work** - Use git to save changes:
   ```bash
   git add .
   git commit -m "Your message"
   git push
   ```

---

**Need help?** Check the error messages in your terminal - they usually tell you exactly what's wrong!



