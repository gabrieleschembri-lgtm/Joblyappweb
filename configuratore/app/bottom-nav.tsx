import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import { useProfile } from './profile-context';
import { useTheme, useThemedStyles } from './theme';

type BottomNavProps = {
  flushToBottom?: boolean;
};

const BottomNav: React.FC<BottomNavProps> = ({ flushToBottom = false }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));

  const datoreHome = '/configuratore/datore';
  const lavoratoreHome = '/configuratore/lavoratore';
  const isDatore = profile?.role === 'datore';
  const isLavoratore = profile?.role === 'lavoratore';
  // Pin the bar to the very bottom and add a stable safe-area padding
  const bottomInset = insets?.bottom ?? 0;
  const baseHeight = 68;
  const totalHeight = baseHeight + bottomInset;

  const handleCenterPress = () => {
    if (isDatore) {
      if (pathname === datoreHome) {
        router.push('/configuratore/nuovo-incarico');
        return;
      }
      if (pathname !== datoreHome) {
        router.push(datoreHome);
      }
      return;
    }

    if (isLavoratore) {
      if (pathname === lavoratoreHome) {
        router.push('/configuratore/map');
        return;
      }
      if (pathname !== lavoratoreHome) {
        router.push(lavoratoreHome);
      }
      return;
    }

    if (profile) {
      router.push(`/configuratore/${profile.role}`);
    } else {
      router.push('/configuratore/landing');
    }
  };

  const centerIconName = () => {
    if (isDatore) {
      return pathname === datoreHome ? 'add' : 'home-outline';
    }
    if (isLavoratore) {
      return pathname === lavoratoreHome ? 'map-outline' : 'home-outline';
    }
    return 'home-outline';
  };

  const centerIcon = centerIconName();

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
      <View
        style={[
          styles.container,
          {
            left: 16 + insets.left,
            right: 16 + insets.right,
            bottom: flushToBottom ? 0 : bottomInset > 0 ? bottomInset : 8,
            height: totalHeight,
          },
        ]}
      >
        <Pressable
          style={styles.navItem}
          accessibilityRole="button"
          onPress={() => router.push('/configuratore/incarichi')}
        >
          <MaterialIcons name="work-outline" size={22} color={theme.colors.textPrimary} />
          <Text style={[styles.navLabel, { color: theme.colors.textPrimary }]}>I miei incarichi</Text>
        </Pressable>

        <Pressable
          style={styles.fab}
          accessibilityRole="button"
          onPress={handleCenterPress}
        >
          <Ionicons
            name={centerIcon as keyof typeof Ionicons.glyphMap}
            size={centerIcon === 'add' ? 28 : 26}
            color={theme.colors.surface}
          />
        </Pressable>

        <Pressable
          style={styles.navItem}
          accessibilityRole="button"
          onPress={() => router.push('/configuratore/settings')}
        >
          <Ionicons name="settings-outline" size={22} color={theme.colors.textPrimary} />
          <Text style={[styles.navLabel, { color: theme.colors.textPrimary }]}>Impostazioni</Text>
        </Pressable>
      </View>
    </View>
  );
};

const createStyles = (t: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      minHeight: 68,
      backgroundColor: t.colors.surface,
      borderRadius: 32,
      paddingHorizontal: 22,
      paddingVertical: 10,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    navItem: {
      flex: 1,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    navLabel: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    fab: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export default BottomNav;
