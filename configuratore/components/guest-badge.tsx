import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useProfile } from '../app/profile-context';
import { useTheme, useThemedStyles } from '../app/theme';
import JoblyIcon from './jobly-icon';

const GuestBadge: React.FC = () => {
  const { profile } = useProfile();
  const { theme } = useTheme();
  const styles = useThemedStyles((currentTheme) => createStyles(currentTheme));

  if (!profile?.isGuest) {
    return null;
  }

  const roleLabel = profile.role === 'datore' ? 'Datore di lavoro' : 'Lavoratore';

  return (
    <View style={styles.badge} accessibilityRole="text" accessibilityLabel={`joblyapp, ospite, ${roleLabel}`}>
      <JoblyIcon name="sparkles" size="small" color={theme.colors.primary} />
      <View>
        <Text style={styles.name}>joblyapp</Text>
        <Text style={styles.role}>Ospite • {roleLabel}</Text>
      </View>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    badge: {
      alignSelf: 'flex-start',
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 14,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    name: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    role: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 1,
    },
  });

export default GuestBadge;
