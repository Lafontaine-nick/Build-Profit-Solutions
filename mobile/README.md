# Build Profit Solutions - Mobile App

A comprehensive construction management mobile application built with React Native and Expo, featuring estimate generation, project management, subcontractor marketplace, and analytics.

## 🚀 Features

### Core Functionality
- **Estimate Generator**: AI-powered cost estimation with detailed breakdowns
- **Project Management**: Complete project lifecycle management
- **Subcontractor Marketplace**: Find and book qualified subcontractors
- **Client Management**: Track client relationships and project history
- **Analytics Dashboard**: Real-time performance metrics and insights
- **Profile Management**: User settings, preferences, and account management

### Technical Features
- **TypeScript**: Full type safety and better development experience
- **Dark/Light Theme**: Adaptive theming system
- **Offline Support**: Data caching and offline functionality
- **Real-time Sync**: Backend integration with Python FastAPI
- **File Management**: Document upload and sharing
- **Push Notifications**: Real-time alerts and updates

## 📱 Screenshots

### Main Screens
- **Dashboard**: Analytics overview and quick actions
- **Estimate Generator**: AI-powered bid creation
- **Projects**: Project management and file handling
- **Subcontractor Marketplace**: Search and book subcontractors
- **Profile**: User settings and analytics

## 🛠 Tech Stack

### Frontend
- **React Native**: Cross-platform mobile development
- **Expo**: Development platform and tools
- **TypeScript**: Type-safe JavaScript
- **React Navigation**: Navigation and routing
- **React Native Reanimated**: Smooth animations
- **React Native Gifted Charts**: Data visualization

### Backend Integration
- **FastAPI**: Python backend API
- **JWT Authentication**: Secure user authentication
- **RESTful API**: Complete CRUD operations
- **Real-time Sync**: Live data synchronization

### Development Tools
- **Jest**: Unit testing framework
- **React Native Testing Library**: Component testing
- **Detox**: End-to-end testing
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript**: Static type checking

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd build-profit-solutions/mobile
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Run on device/simulator**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd ../  # Go to project root
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the backend server**
   ```bash
   python main.py
   ```

The backend will be available at `http://localhost:8000`

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### End-to-End Tests
```bash
# Build for E2E testing
npm run test:e2e:build

# Run E2E tests
npm run test:e2e
```

### Code Quality
```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run type-check

# Format code
npm run prettier

# Check formatting
npm run prettier:check
```

## 📁 Project Structure

```
mobile/
├── app/                    # Expo Router screens
│   ├── (tabs)/           # Tab navigation screens
│   ├── auth/             # Authentication screens
│   └── profile/          # Profile-related screens
├── components/            # Reusable UI components
│   └── ui/              # UI-specific components
├── contexts/             # React Context providers
├── services/             # API and external services
├── hooks/                # Custom React hooks
├── constants/            # App constants and config
├── assets/               # Images, fonts, etc.
├── __tests__/           # Test files
├── scripts/             # Build and utility scripts
└── types/               # TypeScript type definitions
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the mobile directory:
```env
API_BASE_URL=http://localhost:8000
EXPO_PUBLIC_API_URL=http://localhost:8000
```

### API Configuration
Update the API base URL in `services/api.ts`:
```typescript
const API_BASE_URL = 'http://localhost:8000'; // Change to your backend URL
```

## 🎨 Theming

The app supports both light and dark themes. Theme configuration is in `contexts/ThemeContext.tsx`:

```typescript
// Light theme
const lightTheme = {
  background: ["#f5f7fa", "#c3cfe2", "#fff"],
  card: '#fff',
  text: '#222',
  // ... more colors
};

// Dark theme
const darkTheme = {
  background: ["#0b1c38", "#1B365D", "#43cea2"],
  card: '#142850',
  text: '#fff',
  // ... more colors
};
```

## 📊 Analytics

The app includes comprehensive analytics:
- Monthly revenue tracking
- Project performance metrics
- Customer satisfaction scores
- Win rate analysis
- Repeat customer rates

## 🔐 Authentication

The app uses JWT-based authentication:
- Secure login/register flow
- Token management
- Automatic token refresh
- Persistent login state

## 📱 Platform Support

- **iOS**: 12.0+
- **Android**: 5.0+ (API level 21+)
- **Web**: Chrome, Firefox, Safari, Edge

## 🚀 Deployment

### Expo Build
```bash
# Build for iOS
expo build:ios

# Build for Android
expo build:android

# Build for web
expo build:web
```

### EAS Build (Recommended)
```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Login to Expo
eas login

# Configure build
eas build:configure

# Build for platforms
eas build --platform ios
eas build --platform android
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write unit tests for new features
- Use ESLint and Prettier for code formatting
- Follow React Native performance guidelines
- Test on both iOS and Android

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the test files for usage examples

## 🔄 Changelog

### v1.0.0
- Initial release
- Complete estimate generator
- Project management system
- Subcontractor marketplace
- Analytics dashboard
- User profile management
- Backend integration
- Comprehensive testing suite

---

**Built with ❤️ using React Native and Expo**
