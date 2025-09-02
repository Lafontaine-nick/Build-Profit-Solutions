# 🚀 Build Profit Solutions - Complete Deployment Guide

## Overview
This guide will walk you through deploying Build Profit Solutions to production, making it fully operational with live backend, published frontend, authentication, and subscription management.

## ✅ Step-by-Step Deployment Process

### Step 1: Deploy Backend to Render

1. **Install Render CLI** (if not already installed):
   ```bash
   brew install render
   render login
   ```

2. **Deploy using the automated script**:
   ```bash
   cd backend
   ./deploy.sh
   ```

3. **Manual deployment alternative**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Create new Web Service
   - Connect your GitHub repository
   - Set build command: `npm install`
   - Set start command: `npm start`
   - Add environment variables (see below)

4. **Required Environment Variables**:
   ```
   NODE_ENV=production
   PORT=10000
   FRONTEND_URL=https://build-profit-solutions-mobile.vercel.app
   OPENAI_API_KEY=your_openai_api_key
   DATABASE_URL=your_postgresql_url
   JWT_SECRET=your_jwt_secret_key
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
   CLERK_SECRET_KEY=your_clerk_secret_key
   ```

5. **Database Setup**:
   - Create PostgreSQL database on Render or external provider
   - Run the schema: `backend/src/database/schema.sql`
   - Update `DATABASE_URL` environment variable

### Step 2: Publish Expo Frontend

1. **Install EAS CLI**:
   ```bash
   npm install -g @expo/eas-cli
   eas login
   ```

2. **Deploy using the automated script**:
   ```bash
   cd mobile
   ./deploy-expo.sh
   ```

3. **Manual deployment alternative**:
   ```bash
   eas build --platform all --profile preview
   ```

4. **Your app will be available at**:
   - Expo Go: Scan QR code from dashboard
   - Web: https://build-profit-solutions-mobile.vercel.app

### Step 3: Connect Live Backend to Frontend

1. **Update mobile app configuration**:
   - Ensure `env.production` has correct backend URL
   - Verify `API_BASE_URL` points to Render deployment

2. **Test API connectivity**:
   ```bash
   curl https://your-backend.onrender.com/health
   ```

### Step 4: Enable Authentication with Clerk

1. **Set up Clerk**:
   - Go to [Clerk Dashboard](https://dashboard.clerk.com)
   - Create new application
   - Configure authentication methods
   - Get API keys

2. **Update environment variables**:
   - Backend: `CLERK_SECRET_KEY`
   - Mobile: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`

3. **Test authentication flow**:
   - Sign up new user
   - Sign in existing user
   - Verify JWT token generation

### Step 5: Integrate Stripe Subscriptions

1. **Set up Stripe**:
   - Go to [Stripe Dashboard](https://dashboard.stripe.com)
   - Create products and pricing plans:
     - Basic Plan: $25/month
     - Premium Plan: $50/month
   - Get API keys

2. **Update environment variables**:
   - Backend: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   - Mobile: `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`

3. **Configure webhooks**:
   - Endpoint: `https://your-backend.onrender.com/api/stripe/webhook`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`

### Step 6: Test Complete System

1. **Backend Health Check**:
   ```bash
   curl https://your-backend.onrender.com/health
   ```

2. **Authentication Flow**:
   - User registration
   - User login
   - JWT token validation

3. **Subscription Flow**:
   - View subscription plans
   - Create checkout session
   - Process payment
   - Verify webhook handling

4. **Lead Management**:
   - Create new lead
   - AI scoring
   - Perfect fit calculation

## 🔧 Production Checklist

- [ ] Backend deployed to Render
- [ ] Database created and schema applied
- [ ] Environment variables configured
- [ ] Frontend published to Expo
- [ ] Authentication working with Clerk
- [ ] Stripe subscriptions configured
- [ ] Webhooks properly set up
- [ ] API endpoints responding
- [ ] Mobile app connecting to live backend
- [ ] Error monitoring configured
- [ ] Performance monitoring active

## 🌐 Production URLs

- **Backend API**: https://build-profit-solutions-backend.onrender.com
- **Mobile App**: https://expo.dev/@buildprofitsolutions/build-profit-solutions-mobile
- **Web Version**: https://build-profit-solutions-mobile.vercel.app

## 🚨 Troubleshooting

### Common Issues:

1. **Backend won't start**:
   - Check environment variables
   - Verify database connection
   - Check Render logs

2. **Frontend can't connect to backend**:
   - Verify CORS settings
   - Check backend URL in mobile config
   - Ensure backend is running

3. **Authentication not working**:
   - Verify Clerk API keys
   - Check JWT secret
   - Test auth endpoints

4. **Stripe payments failing**:
   - Verify Stripe keys
   - Check webhook configuration
   - Monitor Stripe dashboard

## 📱 Testing with Real Users

1. **Share Expo Go link**:
   ```
   https://expo.dev/@buildprofitsolutions/build-profit-solutions-mobile
   ```

2. **Test user flow**:
   - Download Expo Go app
   - Scan QR code
   - Complete onboarding
   - Test lead creation
   - Verify subscription flow

## 🔒 Security Considerations

- All API endpoints use HTTPS
- JWT tokens expire after 7 days
- Rate limiting enabled (500 req/15min in production)
- Input validation on all endpoints
- CORS properly configured
- Helmet.js security headers

## 📊 Monitoring & Analytics

- Health check endpoint: `/health`
- Error logging to console (configure external logging in production)
- Request logging with Morgan
- Performance monitoring ready for integration

## 🎯 Next Steps After Deployment

1. **Set up monitoring**:
   - Sentry for error tracking
   - Log aggregation service
   - Performance monitoring

2. **Scale infrastructure**:
   - Database connection pooling
   - CDN for static assets
   - Load balancing if needed

3. **User feedback collection**:
   - In-app feedback forms
   - User analytics
   - A/B testing setup

---

**🎉 Congratulations!** Your Build Profit Solutions app is now fully operational and ready for real users. 