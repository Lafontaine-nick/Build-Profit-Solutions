import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundaryClass extends Component<Props & { theme: any }, State> {
  constructor(props: Props & { theme: any }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Don't log anything that might cause text rendering issues
    // Just silently handle the error
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View
          style={[
            styles.container,
            { backgroundColor: this.props.theme.background },
          ]}
        >
          <Text style={[styles.title, { color: this.props.theme.text }]}>
            Oops! Something went wrong
          </Text>
          <Text style={[styles.message, { color: this.props.theme.subtext }]}>
            We're sorry, but something unexpected happened. Please try again.
          </Text>
          <TouchableOpacity
            style={[
              styles.retryButton,
              { backgroundColor: this.props.theme.accent },
            ]}
            onPress={this.handleRetry}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

// Wrapper to provide theme context
export default function ErrorBoundary(props: Props) {
  const { darkMode } = useTheme();
  const theme = darkMode
    ? {
        background: '#0b1c38',
        text: '#fff',
        subtext: '#aaa',
        accent: '#43cea2',
      }
    : {
        background: '#f5f7fa',
        text: '#222',
        subtext: '#555',
        accent: '#1976d2',
      };

  return <ErrorBoundaryClass {...props} theme={theme} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
