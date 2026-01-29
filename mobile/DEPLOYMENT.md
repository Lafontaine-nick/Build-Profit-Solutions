# 🚀 Deployment Guide - Build Profit Solutions

## 📋 Pre-Deployment Checklist

### ✅ Code Quality
- [ ] All TypeScript errors resolved
- [ ] ESLint passes with no errors
- [ ] All tests passing
- [ ] Code coverage meets 70% threshold
- [ ] No console.log statements in production code

### ✅ Backend Setup
- [ ] Python backend running on production server
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] API endpoints tested

### ✅ Mobile App Configuration
- [ ] API base URL updated for production
- [ ] App icons and splash screens ready
- [ ] App store metadata prepared
- [ ] Privacy policy and terms of service
- [ ] App signing certificates configured

## 🏗️ Production Build Process

### 1. **Environment Setup**
```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install --legacy-peer-deps

# Run quality checks
npm run type-check
npm run lint
npm test
```

### 2. **Build Commands**

#### **iOS Build**
```bash
# Build for iOS App Store
npx expo build:ios --clear-cache

# Or use EAS Build (recommended)
eas build --platform ios --profile production
```

#### **Android Build**
```bash
# Build for Google Play Store
npx expo build:android --clear-cache

# Or use EAS Build (recommended)
eas build --platform android --profile production
```

#### **Web Build**
```bash
# Build for web deployment
npx expo build:web --clear-cache
```

### 3. **Automated Build Script**
```bash
# Run the automated build script
./scripts/build-production.sh
```

## 📱 App Store Deployment

### **iOS App Store**
1. **Prepare App Store Connect**
   - Create new app in App Store Connect
   - Configure app metadata and screenshots
   - Set up app review information

2. **Upload Build**
   ```bash
   # Upload to App Store Connect
   npx expo upload:ios
   ```

3. **Submit for Review**
   - Complete app review questionnaire
   - Submit for Apple review process

### **Google Play Store**
1. **Prepare Google Play Console**
   - Create new app in Google Play Console
   - Configure app metadata and screenshots
   - Set up content rating

2. **Upload Build**
   ```bash
   # Upload to Google Play Console
   npx expo upload:android
   ```

3. **Submit for Review**
   - Complete app review questionnaire
   - Submit for Google review process

## 🌐 Web Deployment

### **Vercel Deployment**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
vercel --prod
```

### **Netlify Deployment**
```bash
# Build for web
npx expo build:web

# Deploy to Netlify
netlify deploy --prod --dir=web-build
```

## 🔧 Production Configuration

### **Environment Variables**
Create `.env.production` file:
```env
API_BASE_URL=https://your-production-api.com
EXPO_PUBLIC_API_URL=https://your-production-api.com
SENTRY_DSN=your-sentry-dsn
```

### **App Configuration**
Update `app.json` for production:
```json
{
  "expo": {
    "name": "Build Profit Solutions",
    "slug": "build-profit-solutions",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0b1c38"
    },
    "updates": {
      "fallbackToCacheTimeout": 0
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.buildprofitsolutions"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0b1c38"
      },
      "package": "com.yourcompany.buildprofitsolutions"
    },
    "web": {
      "favicon": "./assets/favicon.png"
    }
  }
}
```

## 🔍 Post-Deployment Checklist

### ✅ **Testing**
- [ ] Test app on physical devices
- [ ] Verify all features work correctly
- [ ] Test offline functionality
- [ ] Verify push notifications
- [ ] Test payment flows (if applicable)

### ✅ **Monitoring**
- [ ] Set up crash reporting (Sentry)
- [ ] Configure analytics (Google Analytics)
- [ ] Set up performance monitoring
- [ ] Configure error alerting

### ✅ **Documentation**
- [ ] Update user documentation
- [ ] Create support documentation
- [ ] Document API endpoints
- [ ] Create troubleshooting guide

## 🚨 Rollback Plan

### **Emergency Rollback Steps**
1. **Immediate Actions**
   - Disable new version in app stores
   - Revert to previous stable version
   - Notify users of temporary issues

2. **Investigation**
   - Review crash reports and analytics
   - Identify root cause of issues
   - Fix critical bugs

3. **Re-deployment**
   - Test fixes thoroughly
   - Deploy updated version
   - Monitor closely for 24-48 hours

## 📊 Monitoring & Analytics

### **Key Metrics to Track**
- **User Engagement**: Daily/Monthly active users
- **Performance**: App load times, crash rates
- **Business Metrics**: Estimate generation, project creation
- **Technical Metrics**: API response times, error rates

### **Tools Setup**
- **Crash Reporting**: Sentry
- **Analytics**: Google Analytics for Firebase
- **Performance**: Firebase Performance Monitoring
- **User Feedback**: In-app feedback system

## 🎯 Success Criteria

### **Technical Success**
- [ ] Zero critical crashes in first week
- [ ] < 2 second app load time
- [ ] 99.9% API uptime
- [ ] All features working as expected

### **Business Success**
- [ ] User adoption targets met
- [ ] Positive user reviews
- [ ] Successful estimate generation
- [ ] Active project management usage

---

**Ready for Production! 🚀**

Your Build Profit Solutions app is now ready for deployment to production environments. 