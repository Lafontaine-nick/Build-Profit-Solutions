// Run this in the Expo app console to clear chat data
import AsyncStorage from '@react-native-async-storage/async-storage';

async function clearChatData() {
  try {
    await AsyncStorage.removeItem('@chat_conversations');
    await AsyncStorage.removeItem('@chat_messages');
    console.log('✅ Chat data cleared! Please reload the app.');
  } catch (error) {
    console.error('❌ Error clearing chat data:', error);
  }
}

clearChatData();
