import * as WebBrowser from "expo-web-browser";
import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";

// Completes in-app-browser OAuth handoff when that path is used (native / some clients).
WebBrowser.maybeCompleteAuthSession();

/**
 * Clerk OAuth **redirect** flow lands here (`authenticateWithRedirect` + `redirectUrl`).
 * `AuthenticateWithRedirectCallback` runs `clerk.handleRedirectCallback()` so the session
 * activates (this is required on web; `useOAuth` + `openAuthSessionAsync` is unreliable there).
 */
export default function OAuthNativeCallbackScreen() {
  return (
    <View style={styles.root} testID="oauth-native-callback">
      <AuthenticateWithRedirectCallback
        signInUrl="/oauth-native-callback"
        signUpUrl="/oauth-native-callback"
        signInFallbackRedirectUrl="/(tabs)/dashboard"
        signUpFallbackRedirectUrl="/(tabs)/dashboard"
      />
      <ActivityIndicator size="large" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  spinner: {
    marginTop: 28,
  },
});
