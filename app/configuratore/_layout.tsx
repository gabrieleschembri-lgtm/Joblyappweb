import React from 'react';
import { Stack } from 'expo-router';

const ConfiguratoreLayout: React.FC = () => {
  return (
    <Stack screenOptions={{ headerShown: false }} initialRouteName="landing">
      <Stack.Screen name="landing" />
      <Stack.Screen name="index" />
      <Stack.Screen name="datore" />
      <Stack.Screen name="lavoratore" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="curriculum" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="nuovo-incarico" />
      <Stack.Screen name="incarichi" />
      <Stack.Screen name="job" />
      <Stack.Screen name="chat/index" />
      <Stack.Screen name="chat/[chatId]" />
      <Stack.Screen name="applicant" />
      <Stack.Screen name="map" />
    </Stack>
  );
};

export default ConfiguratoreLayout;
