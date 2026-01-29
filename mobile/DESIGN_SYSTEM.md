# Build Profit Solutions - Design System

## 🎨 **Professional Design Standards**

This document outlines the design system for consistent, professional appearance across the Build Profit Solutions mobile app.

## 📝 **Typography**

### **Font Families**
- **Primary**: `Saira_400Regular` - Clean, readable body text
- **Secondary**: `Montserrat_700Bold` - Strong, professional headings
- **Monospace**: `monospace` - Code and technical content

### **Font Hierarchy**
```typescript
// Use ThemedText component for consistent typography
<ThemedText type="h1">Main Page Title</ThemedText>
<ThemedText type="h2">Section Heading</ThemedText>
<ThemedText type="h3">Subsection Heading</ThemedText>
<ThemedText type="body">Body text content</ThemedText>
<ThemedText type="caption">Small descriptive text</ThemedText>
<ThemedText type="button">BUTTON TEXT</ThemedText>
<ThemedText type="link">Clickable link text</ThemedText>
```

### **Font Sizes**
- **H1**: 32px - Main titles
- **H2**: 24px - Section headings  
- **H3**: 20px - Subsection headings
- **Body**: 16px - Standard text
- **Caption**: 14px - Small text
- **Button**: 16px - Button text

## 🎨 **Color Palette**

### **Primary Colors**
- **Navy Blue**: `#1B365D` - Primary brand color
- **Teal Green**: `#43cea2` - Accent and success
- **Gold**: `#FFD700` - Premium/highlight

### **Semantic Colors**
- **Success**: `#10b981` - Green for success states
- **Warning**: `#f59e0b` - Amber for warnings
- **Error**: `#ef4444` - Red for errors
- **Info**: `#3b82f6` - Blue for information

### **Usage Guidelines**
```typescript
import { Colors, getThemeColor } from '../constants/Colors';

// Theme-aware colors
const textColor = getThemeColor('text', isDarkMode);
const primaryColor = Colors.light.primary; // or Colors.dark.primary

// Semantic colors
const successColor = getSemanticColor('success');
```

## 📐 **Spacing System**

### **8px Grid System**
- **xs**: 4px - Minimal spacing
- **sm**: 8px - Small spacing
- **md**: 16px - Medium spacing
- **lg**: 24px - Large spacing
- **xl**: 32px - Extra large spacing

### **Component Spacing**
```typescript
import { Spacing } from '../constants/Spacing';

const styles = StyleSheet.create({
  container: {
    padding: Spacing.component.padding,    // 16px
    margin: Spacing.component.margin,      // 16px
    borderRadius: Spacing.component.borderRadius, // 12px
  },
  card: {
    padding: Spacing.card.padding,         // 20px
    margin: Spacing.card.margin,           // 16px
    borderRadius: Spacing.card.borderRadius, // 16px
  },
});
```

## 🧩 **Component Standards**

### **Cards**
- **Padding**: 20px internal, 16px external
- **Border Radius**: 16px for modern appearance
- **Shadow**: Subtle elevation with proper contrast
- **Background**: Theme-aware with proper contrast

### **Buttons**
- **Padding**: 16px horizontal, 12px vertical
- **Border Radius**: 8px for modern buttons
- **Typography**: Montserrat Bold, uppercase
- **States**: Pressed, disabled, loading states

### **Forms**
- **Input Padding**: 16px for comfortable touch targets
- **Label Spacing**: 8px above inputs
- **Validation**: Clear error states with semantic colors
- **Accessibility**: Proper contrast ratios

## 🔧 **Implementation Guidelines**

### **1. Always Use ThemedText Component**
```typescript
// ✅ Correct - Uses design system
<ThemedText type="h2">Project Details</ThemedText>

// ❌ Incorrect - Hardcoded styles
<Text style={{ fontSize: 24, fontWeight: 'bold' }}>Project Details</Text>
```

### **2. Use Spacing Constants**
```typescript
// ✅ Correct - Consistent spacing
<View style={{ margin: Spacing.md, padding: Spacing.lg }}>

// ❌ Incorrect - Inconsistent spacing
<View style={{ margin: 16, padding: 24 }}>
```

### **3. Theme-Aware Colors**
```typescript
// ✅ Correct - Theme-aware
const backgroundColor = getThemeColor('background', isDarkMode);

// ❌ Incorrect - Hardcoded colors
const backgroundColor = '#ffffff';
```

### **4. Professional Shadows**
```typescript
const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
};
```

## 📱 **Platform Considerations**

### **iOS**
- **Tab Bar Height**: 88px (includes safe area)
- **Safe Area**: Respect notch and home indicator
- **Haptic Feedback**: Use appropriate haptic patterns

### **Android**
- **Tab Bar Height**: 70px
- **Material Design**: Follow Material Design principles
- **Elevation**: Use proper elevation values

## 🎯 **Quality Checklist**

Before submitting any UI changes, ensure:

- [ ] Uses `ThemedText` component for all text
- [ ] Uses `Spacing` constants for layout
- [ ] Uses `Colors` constants for theming
- [ ] Proper contrast ratios (WCAG AA compliant)
- [ ] Consistent border radius values
- [ ] Professional shadow implementation
- [ ] Theme-aware color usage
- [ ] Proper touch target sizes (44px minimum)
- [ ] Accessibility labels where appropriate

## 🚀 **Quick Start**

```typescript
import { ThemedText } from '../components/ThemedText';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Spacing';

const ProfessionalComponent = () => (
  <View style={{
    padding: Spacing.lg,
    backgroundColor: Colors.light.background,
    borderRadius: Spacing.component.borderRadius,
  }}>
    <ThemedText type="h2">Professional Title</ThemedText>
    <ThemedText type="body">Professional content with proper spacing.</ThemedText>
  </View>
);
```

---

**Remember**: Consistency is key to professional appearance. Always use the design system components and constants! 