import AsyncStorage from '@react-native-async-storage/async-storage';

const STAY_SIGNED_IN_KEY = 'bps.auth.staySignedIn';

/**
 * When true: open the app to the main tab shell (or skip sign-in from Get Started) for an existing session.
 * Default **false** until the user turns on “Stay signed in” on the sign-in screen (or another flow writes `true`).
 */
export async function getStaySignedInPreference(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(STAY_SIGNED_IN_KEY);
    if (v === null) return false;
    return v === 'true';
  } catch {
    return false;
  }
}

export async function setStaySignedInPreference(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(STAY_SIGNED_IN_KEY, value ? 'true' : 'false');
  } catch {
    // non-fatal
  }
}
