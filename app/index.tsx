import React from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useProfile } from '../configuratore/app/profile-context';

const IndexRoute = () => {
  const { profile, loading } = useProfile();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
        }}
      >
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (profile) {
    return <Redirect href={`/configuratore/${profile.role}`} />;
  }

  return <Redirect href="/configuratore/landing" />;
};

export default IndexRoute;
