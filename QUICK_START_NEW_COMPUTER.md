# 🚀 Quick Start on New Computer

Follow these steps to get your app running on your new computer.

## Step 1: Open Terminal
- Press `Cmd + Space`, type "Terminal", press Enter

## Step 2: Clone Your Code
```bash
cd ~/Documents
git clone https://github.com/Lafontaine-nick/Build-Profit-Solutions.git
cd Build-Profit-Solutions
```

## Step 3: Install Backend Dependencies
```bash
cd backend
npm install
cd ..
```
(Wait 2-5 minutes)

## Step 4: Install Mobile Dependencies
```bash
cd mobile
npm install
cd ..
```
(Wait 3-7 minutes)

## Step 5: Set Up Environment Variables
```bash
cd backend
cp env.example .env
```

Then edit the `.env` file (you can open it in Cursor) and add:
- `OPENAI_API_KEY=your_key_here` (if you have one)
- `JWT_SECRET=any_random_string_here` (just make up a random string)

## Step 6: Start Backend (Terminal 1)
```bash
cd backend
npm run dev
```
Leave this running - you should see "Server running on port 3001"

## Step 7: Start Mobile App (Terminal 2 - NEW window)
```bash
cd mobile
npm run dev:lan
```
Leave this running - you'll see a QR code

## Step 8: Open in Cursor
1. Open Cursor IDE
2. File → Open Folder
3. Select: `~/Documents/Build-Profit-Solutions` (or wherever you cloned it)
4. Wait for indexing to finish

## Step 9: Connect Your Phone
1. Install "Expo Go" app on your phone
2. Make sure phone and computer are on same WiFi
3. Open Expo Go → Scan QR code from Terminal 2
4. Wait for app to load

## ✅ Done!
Your app should now be running on your phone!

