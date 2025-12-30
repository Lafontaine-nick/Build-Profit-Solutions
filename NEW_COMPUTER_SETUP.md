# 🚀 Setting Up Build Profit Solutions on a New Computer

This guide will help you get your project running on your new laptop with Cursor.

## 📋 Prerequisites

1. **Install Node.js** (v18 or higher)
   - Download from: https://nodejs.org/
   - Or use Homebrew: `brew install node`

2. **Install Git** (if not already installed)
   - macOS: Usually pre-installed, or `brew install git`
   - Check with: `git --version`

3. **Install Cursor IDE**
   - Download from: https://cursor.sh/
   - Install and sign in with your account

## 🔄 Step 1: Clone the Repository

```bash
# Navigate to where you want the project
cd ~/Documents  # or wherever you keep projects

# Clone the repository
git clone https://github.com/Lafontaine-nick/Build-Profit-Solutions.git

# Navigate into the project
cd Build-Profit-Solutions
```

## 📦 Step 2: Install Dependencies

### Backend Dependencies
```bash
cd backend
npm install
cd ..
```

### Mobile App Dependencies
```bash
cd mobile
npm install
cd ..
```

## 🔐 Step 3: Set Up Environment Variables

### Backend Environment (.env file)

1. Copy the example environment file:
```bash
cd backend
cp env.example .env
```

2. Edit the `.env` file and add your API keys:
```bash
# You can use any editor, or use Cursor to edit:
# backend/.env
```

**Required keys to set:**
- `OPENAI_API_KEY` - Your OpenAI API key
- `JWT_SECRET` - Generate a random string (for security)
- `WEBSCRAPINGAPI_KEY` or `SERPAPI_KEY` - For SKU search (optional)
- `YELP_API_KEY` - For contractor search (optional)
- `STRIPE_SECRET_KEY` - If using Stripe (optional)

**Quick JWT Secret generator:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Mobile App Environment (if needed)
The mobile app typically gets its config from environment variables or config files. Check `mobile/app.config.js` if you need to configure anything.

## ✅ Step 4: Verify Setup

### Check Node.js version:
```bash
node --version  # Should be v18 or higher
npm --version
```

### Check if dependencies installed:
```bash
cd backend && npm list --depth=0
cd ../mobile && npm list --depth=0
```

## 🚀 Step 5: Start the App

### Option 1: Start Everything (Recommended)
From the project root:
```bash
./start-app.sh
```

### Option 2: Start Services Separately

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Mobile App:**
```bash
cd mobile
npm run dev:lan
```

### Option 3: Mobile App Only (if backend is running elsewhere)
```bash
cd mobile
npm start
```

## 📱 Step 6: Connect Your Phone

1. Make sure your phone and computer are on the same WiFi network
2. Scan the QR code shown in the terminal with the Expo Go app
3. The app should load on your phone

## 🔧 Step 7: Open in Cursor

1. Open Cursor IDE
2. File → Open Folder
3. Select the `Build-Profit-Solutions` folder
4. Cursor will automatically index the codebase

## 🎯 Quick Commands Reference

```bash
# Start backend
cd backend && npm run dev

# Start mobile app
cd mobile && npm start

# Start both (from project root)
./start-app.sh

# Check if backend is running
curl http://localhost:3001/health

# Install new packages (backend)
cd backend && npm install <package-name>

# Install new packages (mobile)
cd mobile && npm install <package-name>
```

## 🔍 Troubleshooting

### Port 3001 already in use?
```bash
# Find what's using it
lsof -i :3001

# Kill the process (replace PID with actual process ID)
kill -9 <PID>
```

### Dependencies won't install?
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Expo/Metro bundler issues?
```bash
cd mobile
npm run dev:clear  # Clear cache
# or
npm run dev:reset  # Full reset
```

### Git authentication issues?
```bash
# Set up SSH key or use HTTPS with personal access token
# GitHub guide: https://docs.github.com/en/authentication
```

## 📝 Environment Variables Checklist

Make sure you have these in `backend/.env`:
- [ ] `OPENAI_API_KEY`
- [ ] `JWT_SECRET` (random string)
- [ ] `PORT=3001` (default)
- [ ] `NODE_ENV=development`
- [ ] Optional: `WEBSCRAPINGAPI_KEY`
- [ ] Optional: `SERPAPI_KEY`
- [ ] Optional: `YELP_API_KEY`
- [ ] Optional: Stripe keys if using payments

## 🎉 You're All Set!

Your project should now be running. The backend will be at:
- **Backend**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **Mobile**: Scan QR code with Expo Go

## 💡 Tips

1. **Keep your `.env` file safe** - Don't commit it to git (it's in .gitignore)
2. **Use Cursor's AI features** - Cmd+K for inline edits, Cmd+L for chat
3. **Sync your code** - Regularly commit and push to GitHub
4. **Backend must run first** - Start backend before mobile app for full functionality

---

**Repository**: https://github.com/Lafontaine-nick/Build-Profit-Solutions.git

