import React from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({
  size = 'large',
  color,
  text = 'Loading...',
  fullScreen = false,
}: LoadingSpinnerProps) {
  const { darkMode } = useTheme();
  const theme = darkMode
    ? {
        background: '#0b1c38',
        text: '#fff',
        subtext: '#aaa',
      }
    : {
        background: '#f5f7fa',
        text: '#222',
        subtext: '#555',
      };

  const spinnerColor = color || theme.text;

  if (fullScreen) {
    return (
      <View style={[styles.fullScreen, { backgroundColor: theme.background }]}>
        <ActivityIndicator size={size} color={spinnerColor} />
        {text && (
          <Text style={[styles.text, { color: theme.text }]}>{text}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={spinnerColor} />
      {text && <Text style={[styles.text, { color: theme.text }]}>{text}</Text>}
    </View>
  );
}

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#E0E0E0',
          opacity,
        },
        style,
      ]}
    />
  );
};

interface SkeletonCardProps {
  title?: boolean;
  subtitle?: boolean;
  lines?: number;
  style?: any;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  title = true,
  subtitle = true,
  lines = 3,
  style,
}) => {
  return (
    <View style={[styles.card, style]}>
      {title && <Skeleton width='60%' height={16} style={styles.title} />}
      {subtitle && <Skeleton width='40%' height={12} style={styles.subtitle} />}
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} width='100%' height={12} style={styles.line} />
      ))}
    </View>
  );
};

interface SkeletonListProps {
  count?: number;
  itemHeight?: number;
  style?: any;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  count = 5,
  itemHeight = 80,
  style,
}) => {
  return (
    <View style={style}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={[styles.listItem, { height: itemHeight }]}>
          <Skeleton width='70%' height={16} style={styles.itemTitle} />
          <Skeleton width='50%' height={12} style={styles.itemSubtitle} />
          <Skeleton width='30%' height={12} style={styles.itemMeta} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 12,
  },
  line: {
    marginBottom: 8,
  },
  listItem: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemTitle: {
    marginBottom: 8,
  },
  itemSubtitle: {
    marginBottom: 4,
  },
  itemMeta: {
    marginTop: 4,
  },
});
