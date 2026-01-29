# 🍎 Apple Sign-In Setup Checklist

Use this checklist to track your progress:

## Apple Developer Portal Setup

### Step 1: Create App ID
- [ ] Go to https://developer.apple.com/account/
- [ ] Navigate to Certificates, Identifiers & Profiles → Identifiers
- [ ] Create new App ID with:
  - **Bundle ID**: `com.buildprofitsolutions.mobile`
  - **Description**: Build Profit Solutions
  - **Capability**: ✅ Sign in with Apple (checked)
- [ ] Register the App ID

### Step 2: Create Service ID
- [ ] Create new Service ID with:
  - **Identifier**: `com.buildprofitsolutions.mobile.web`
  - **Description**: Build Profit Solutions Web
- [ ] Enable "Sign in with Apple" on the Service ID
- [ ] Configure with:
  - **Primary App ID**: `com.buildprofitsolutions.mobile`
  - **Domains and Subdomains**: `accounts.clerk.dev`
  - **Return URLs**: `https://accounts.clerk.dev/v1/oauth_callback`
- [ ] Save configuration

### Step 3: Create Key
- [ ] Create new Key with:
  - **Key Name**: Sign in with Apple Key
  - **Capability**: ✅ Sign in with Apple (checked)
- [ ] Configure with Primary App ID: `com.buildprofitsolutions.mobile`
- [ ] Register the key
- [ ] **DOWNLOAD** the .p8 key file (you can only download once!)
- [ ] **NOTE** your Key ID (shown on confirmation page)
- [ ] **NOTE** your Team ID (top right of Apple Developer Portal)

## Clerk Dashboard Setup

### Step 4: Configure Apple in Clerk
- [ ] Go to https://dashboard.clerk.com
- [ ] Select your application: "Build profit solutions"
- [ ] Navigate to User & Authentication → Social Connections
- [ ] Find Apple and click Configure
- [ ] Fill in:
  - **Team ID**: [Your Team ID from Step 3]
  - **Key ID**: [Your Key ID from Step 3]
  - **Service ID**: `com.buildprofitsolutions.mobile.web`
  - **Key File**: Upload the .p8 file from Step 3
- [ ] Click Save

## Testing

### Step 5: Test Apple Sign-In
- [ ] Reload your app (press `r` in Expo terminal)
- [ ] Go to Sign In or Create Account screen
- [ ] Verify "Continue with Apple" button appears
- [ ] Click the button to test the flow
- [ ] Complete Apple Sign-In
- [ ] Verify you're signed in and stay in the app

## Information to Collect

Before configuring Clerk, make sure you have:

1. **Team ID**: _____________________
2. **Key ID**: _____________________
3. **Service ID**: `com.buildprofitsolutions.mobile.web`
4. **Key File**: ✅ Downloaded (.p8 file)

## Quick Reference

- **Bundle ID**: `com.buildprofitsolutions.mobile`
- **Service ID**: `com.buildprofitsolutions.mobile.web`
- **Return URL**: `https://accounts.clerk.dev/v1/oauth_callback`
- **Domain**: `accounts.clerk.dev`





