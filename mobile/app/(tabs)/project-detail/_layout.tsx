import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import TabScreenBottomScrollFade from '@/components/layout/TabScreenBottomScrollFade';

export default function ProjectDetailStackLayout() {
  return (
    <View style={styles.shell}>
      <Stack screenOptions={{ headerShown: false }} />
      <TabScreenBottomScrollFade />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
});
