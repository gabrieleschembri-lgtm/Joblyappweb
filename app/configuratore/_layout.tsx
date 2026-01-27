import React from 'react';
import { Stack } from 'expo-router';
import { ChatNotificationProvider } from '../../configuratore/app/chat-notifications';
import { HireNotificationProvider } from '../../configuratore/app/hire-notifications';

const ConfiguratoreLayout: React.FC = () => {
  return (
    <ChatNotificationProvider>
      <HireNotificationProvider>
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
          <Stack.Screen
            name="chat/[chatId]"
            options={({ route }) => ({
              headerShown: true,
              title: typeof route.params?.otherName === 'string' && route.params.otherName
                ? route.params.otherName
                : 'Chat',
            })}
          />
          <Stack.Screen name="hires" />
          <Stack.Screen name="proposte" />
          <Stack.Screen name="worker-hires" />
          <Stack.Screen name="hire/[hireId]" />
          <Stack.Screen name="applicant" />
          <Stack.Screen name="map" />
        </Stack>
      </HireNotificationProvider>
    </ChatNotificationProvider>
  );
};

export default ConfiguratoreLayout;
