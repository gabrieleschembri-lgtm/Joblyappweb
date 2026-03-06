import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import { ProfileProvider } from '../configuratore/app/profile-context';
import { ThemeProvider } from '../configuratore/app/theme';

const RootLayout: React.FC = () => {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <ProfileProvider>
        <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
      </ProfileProvider>
    </ThemeProvider>
  );
};

export default RootLayout;
