import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, useThemedStyles } from './theme';
import JoblyIcon from '../components/jobly-icon';

type BottomNavProps = {
  flushToBottom?: boolean;
};

const BottomNav: React.FC<BottomNavProps> = ({ flushToBottom = false }) => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));

  // Pin the bar to the very bottom and add a stable safe-area padding
  const bottomInset = insets?.bottom ?? 0;
  const baseHeight = 68;
  const totalHeight = baseHeight + bottomInset;
  const jobsActive = [
    '/configuratore/incarichi',
    '/configuratore/hires',
    '/configuratore/worker-hires',
    '/configuratore/proposte',
    '/configuratore/job',
    '/configuratore/hire/',
  ].some((route) => pathname.startsWith(route));
  const settingsActive =
    pathname === '/configuratore/settings' || pathname === '/configuratore/curriculum';

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View
        pointerEvents="box-none"
        style={[
          styles.dockPosition,
          {
            left: 16 + insets.left,
            right: 16 + insets.right,
            bottom: flushToBottom ? 0 : bottomInset > 0 ? bottomInset : 8,
          },
        ]}
      >
        <View style={[styles.container, { height: totalHeight }]}>
          <Pressable
            style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
            accessibilityRole="button"
            accessibilityLabel="I miei incarichi"
            accessibilityState={{ selected: jobsActive }}
            onPress={() => router.push('/configuratore/incarichi')}
          >
            <View style={[styles.navIconShell, jobsActive && styles.navIconShellActive]}>
              <JoblyIcon
                name={jobsActive ? 'briefcase' : 'briefcase-outline'}
                size="navigation"
                color={jobsActive ? theme.colors.primary : theme.colors.textSecondary}
              />
            </View>
            <Text style={[styles.navLabel, jobsActive && styles.navLabelActive]}>I miei incarichi</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
            accessibilityRole="button"
            accessibilityLabel="Impostazioni"
            accessibilityState={{ selected: settingsActive }}
            onPress={() => router.push('/configuratore/settings')}
          >
            <View style={[styles.navIconShell, settingsActive && styles.navIconShellActive]}>
              <JoblyIcon
                name={settingsActive ? 'settings' : 'settings-outline'}
                size="navigation"
                color={settingsActive ? theme.colors.primary : theme.colors.textSecondary}
              />
            </View>
            <Text style={[styles.navLabel, settingsActive && styles.navLabelActive]}>Impostazioni</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const createStyles = (t: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    dockPosition: {
      position: 'absolute',
      alignItems: 'center',
    },
    container: {
      width: '100%',
      maxWidth: 560,
      boxSizing: 'border-box',
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
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      borderRadius: 18,
    },
    navItemPressed: {
      opacity: 0.7,
    },
    navIconShell: {
      minWidth: 42,
      height: 28,
      paddingHorizontal: 10,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navIconShellActive: {
      backgroundColor: t.colors.card,
    },
    navLabel: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.2,
      color: t.colors.textSecondary,
    },
    navLabelActive: {
      color: t.colors.primary,
    },
  });

export default BottomNav;
