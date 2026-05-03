import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

/** Fallback UI colors — do not use `useTheme()` here: on `_layout` this boundary wraps providers *above* `ThemeProvider`. */
const FALLBACK_THEME = {
  background: '#0b1c38',
  text: '#fff',
  subtext: '#aaa',
  accent: '#43cea2',
};

interface State {
  hasError: boolean;
  /** Set when a child throws so __DEV__ UI can show the real cause (e.g. Expo web + Clerk). */
  caughtError: Error | null;
}

class ErrorBoundaryClass extends Component<Props & { theme: typeof FALLBACK_THEME }, State> {
  constructor(props: Props & { theme: typeof FALLBACK_THEME }) {
    super(props);
    this.state = { hasError: false, caughtError: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, caughtError: error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[ErrorBoundary]', msg, stack, errorInfo?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, caughtError: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const err = this.state.caughtError;
      const devDetail =
        typeof __DEV__ !== 'undefined' && __DEV__ && err
          ? `${err.message || String(err)}\n\n${err.stack || ''}`
          : null;

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
          {devDetail ? (
            <Text
              selectable
              style={[styles.devDetail, { color: this.props.theme.subtext }]}
            >
              {devDetail}
            </Text>
          ) : null}
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

// Wrapper — no ThemeContext dependency (boundary sits above ThemeProvider in root layout).
export default function ErrorBoundary(props: Props) {
  return <ErrorBoundaryClass {...props} theme={FALLBACK_THEME} />;
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
  devDetail: {
    fontSize: 11,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    textAlign: 'left',
    alignSelf: 'stretch',
    marginBottom: 16,
    maxHeight: 240,
  },
});
