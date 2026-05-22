import AsyncStorage from '@react-native-async-storage/async-storage';
import { TabActions } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { router } from 'expo-router';

export type ProjectsTabParam = 'active' | 'submitted' | 'completed';

const PENDING_TAB_KEY = 'bps.pendingProjectsTab';
const FROM_SUBMIT_KEY = 'bps.fromSubmitBid';

export function projectsTabForDisplayStatus(status: string | undefined): ProjectsTabParam {
  if (status === 'Submitted') return 'submitted';
  if (status === 'Completed') return 'completed';
  return 'active';
}

/** Tab params are unreliable with the bottom tab navigator — persist intended tab before switching. */
export async function goToProjectsTab(
  tab: ProjectsTabParam = 'active',
  navigation?: NavigationProp<ParamListBase>,
) {
  try {
    await AsyncStorage.setItem(PENDING_TAB_KEY, tab);
    await AsyncStorage.removeItem(FROM_SUBMIT_KEY);
  } catch {
    /* ignore */
  }

  if (navigation) {
    try {
      navigation.dispatch(TabActions.jumpTo('projects'));
      return;
    } catch {
      /* fall through */
    }
  }

  try {
    router.replace('/(tabs)/projects');
  } catch {
    router.push('/(tabs)/projects');
  }
}
