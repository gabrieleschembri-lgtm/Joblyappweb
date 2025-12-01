import React, { useEffect } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import BottomNav from './bottom-nav';
import { useProfile } from './profile-context';
import { useTheme, useThemedStyles, type ThemePreference } from './theme';

const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const { profile, logout, loading } = useProfile();
  const { theme, preference, setPreference } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));

  useEffect(() => {
    if (!loading && !profile) {
      router.replace('/configuratore/landing');
    }
  }, [loading, profile, router]);

  const performLogout = async () => {
    try {
      await logout();
      router.replace('/configuratore/landing');
    } catch (error) {
      Alert.alert('Errore', 'Non è stato possibile effettuare il logout.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Conferma', 'Sei sicuro di voler uscire?', [
      { text: 'No', style: 'cancel' },
      { text: 'Sì', style: 'destructive', onPress: () => void performLogout() },
    ]);
  };

  const handleSwitchProfile = () => {
    router.replace('/configuratore?mode=switch');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Ionicons name="person-circle" size={56} color={theme.colors.primary} />
          </View>

          <Text style={styles.name}>
            {profile ? `${profile.nome} ${profile.cognome}`.trim() : 'Ospite'}
          </Text>
          {profile ? (
            <>
              <Text style={styles.meta}>Ruolo: {profile.role}</Text>
              <Text style={styles.meta}>
                Data di nascita: {profile.dataNascita}
              </Text>
            </>
          ) : (
            <Text style={styles.meta}>Non hai ancora configurato il profilo.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <Pressable
            style={styles.option}
            onPress={() => router.push('/configuratore/curriculum')}
            accessibilityRole="button"
          >
            <MaterialIcons name="badge" size={22} color={theme.colors.primary} />
            <View style={styles.optionInfo}>
              <Text style={styles.optionLabel}>Curriculum</Text>
              <Text style={styles.optionDescription}>
                Rivedi e aggiorna le tue informazioni professionali.
              </Text>
            </View>
          </Pressable>


          <View style={styles.option}>
            <MaterialIcons name="security" size={22} color={theme.colors.primary} />
            <View style={styles.optionInfo}>
              <Text style={styles.optionLabel}>Privacy & sicurezza</Text>
              <Text style={styles.optionDescription}>
                Gestisci preferenze e visibilità del profilo.
              </Text>
            </View>
          </View>

          <View style={styles.option}>
            <MaterialIcons name="notifications-none" size={22} color={theme.colors.primary} />
            <View style={styles.optionInfo}>
              <Text style={styles.optionLabel}>Notifiche</Text>
              <Text style={styles.optionDescription}>
                Configura avvisi su incarichi e messaggi.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tema</Text>
          <View style={styles.pillRow}>
            {(['system', 'light', 'dark'] as ThemePreference[]).map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setPreference(opt)}
                style={[styles.pill, preference === opt && { backgroundColor: theme.colors.primary }]}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: preference === opt ? theme.colors.surface : theme.colors.textPrimary },
                  ]}
                >
                  {opt === 'system' ? 'Sistema' : opt === 'light' ? 'Chiaro' : 'Scuro'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          style={styles.switchButton}
          accessibilityRole="button"
          onPress={handleSwitchProfile}
        >
          <Ionicons name="swap-horizontal-outline" size={22} color={theme.colors.primary} />
          <Text style={[styles.switchText, { color: theme.colors.primary }]}>Modifica configurazione</Text>
        </Pressable>

        <Pressable
          style={styles.logoutButton}
          accessibilityRole="button"
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={22} color="#ffffff" />
          <Text style={styles.logoutText}>Esci dall'account</Text>
        </Pressable>
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
};

const createStyles = (t: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    content: {
      padding: 24,
      gap: 24,
      paddingBottom: 220, // ensure last button stays above bottom bar
    },
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    avatar: {
      marginBottom: 12,
    },
    name: {
      fontSize: 22,
      fontWeight: '700',
      color: t.colors.textPrimary,
    },
    meta: {
      fontSize: 15,
      color: t.colors.textSecondary,
      marginTop: 6,
    },
    section: {
      backgroundColor: t.colors.surface,
      borderRadius: 20,
      padding: 20,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: t.colors.textPrimary,
      marginBottom: 16,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 18,
    },
    optionInfo: {
      flex: 1,
    },
    optionLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: t.colors.textPrimary,
    },
    optionDescription: {
      fontSize: 13,
      color: t.colors.textSecondary,
      marginTop: 4,
    },
    switchButton: {
      marginTop: 12,
      backgroundColor: t.colors.card,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 20,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    switchText: {
      color: t.colors.primary,
      fontSize: 16,
      fontWeight: '700',
    },
    logoutButton: {
      marginTop: 12,
      backgroundColor: '#ef4444',
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 20,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      shadowColor: '#ef4444',
      shadowOpacity: 0.2,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    logoutText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700',
    },
    pillRow: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
      marginTop: 10,
      alignItems: 'center',
    },
    pill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    pillText: {
      fontSize: 13,
      fontWeight: '700',
    },
  });

export default SettingsScreen;
