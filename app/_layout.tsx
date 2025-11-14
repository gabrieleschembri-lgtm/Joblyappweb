import React from 'react';
import { Stack } from 'expo-router';

import { ProfileProvider } from '../configuratore/app/profile-context';

const RootLayout: React.FC = () => {
  return (
    <ProfileProvider>
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
    </ProfileProvider>
  );
};

export default RootLayout;
