import React from 'react';
import { Stack } from 'expo-router';

import { ProfileProvider } from '../configuratore/app/profile-context';
import { ThemeProvider } from '../configuratore/app/theme';

const RootLayout: React.FC = () => {
  return (
    <ThemeProvider>
      <ProfileProvider>
        <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
      </ProfileProvider>
    </ThemeProvider>
  );
};

export default RootLayout;
