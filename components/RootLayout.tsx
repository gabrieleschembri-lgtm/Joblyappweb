import React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

import { ProfileProvider } from '../configuratore/app/profile-context';
import { ThemeProvider } from '../configuratore/app/theme';
import { JoblyDialogProvider } from '../configuratore/components/jobly-dialog';

const RootLayout: React.FC = () => {
  const [fontsLoaded] = useFonts(
    Platform.OS === 'web'
      ? { ionicons: '/fonts/Ionicons.ttf' }
      : Ionicons.font,
  );

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <JoblyDialogProvider>
        <ProfileProvider>
          <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
        </ProfileProvider>
      </JoblyDialogProvider>
    </ThemeProvider>
  );
};

export default RootLayout;
