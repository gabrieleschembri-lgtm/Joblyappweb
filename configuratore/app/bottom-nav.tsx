import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import { useProfile } from './profile-context';

const BottomNav: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();

  const datoreHome = '/configuratore/datore';
  const lavoratoreHome = '/configuratore/lavoratore';
  const isDatore = profile?.role === 'datore';
  const isLavoratore = profile?.role === 'lavoratore';
  // Pin the bar to the very bottom and just add safe-area padding in style
  const bottomInset = insets?.bottom ?? 0;

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
            left: 24 + insets.left,
            right: 24 + insets.right,
            bottom: 14 + bottomInset, // stick to physical bottom consistently
          },
        ]}
      >
        <Pressable
          style={styles.navItem}
          accessibilityRole="button"
          onPress={() => router.push('/configuratore/incarichi')}
        >
          <MaterialIcons name="work-outline" size={22} color="#0f172a" />
          <Text style={styles.navLabel}>I miei incarichi</Text>
        </Pressable>

        <Pressable
          style={styles.fab}
          accessibilityRole="button"
          onPress={handleCenterPress}
        >
          <Ionicons
            name={centerIcon as keyof typeof Ionicons.glyphMap}
            size={centerIcon === 'add' ? 28 : 26}
            color="#ffffff"
          />
        </Pressable>

        <Pressable
          style={styles.navItem}
          accessibilityRole="button"
          onPress={() => router.push('/configuratore/settings')}
        >
          <Ionicons name="settings-outline" size={22} color="#0f172a" />
          <Text style={styles.navLabel}>Impostazioni</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 40,
    paddingHorizontal: 28,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: '#0f172a',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BottomNav;
