import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import { useProfile } from '../../configuratore/app/profile-context';
import { authenticateProfile } from '../../configuratore/lib/api';
import { useTheme, useThemedStyles } from '../../configuratore/app/theme';

const LandingScreen: React.FC = () => {
  const router = useRouter();
  const { profile, loading, login } = useProfile();
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));

  const [showLoginForm, setShowLoginForm] = useState(false);
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && profile) {
      router.replace(`/configuratore/${profile.role}`);
    }
  }, [loading, profile, router]);

  const isLoginValid = useMemo(() => {
    const byName = nome.trim() !== '' && cognome.trim() !== '' && password.trim().length > 0;
    const byUsername = username.trim().length >= 3 && password.trim().length > 0;
    const byEmail = /.+@.+\..+/.test(email.trim()) && password.trim().length > 0;
    return byName || byUsername || byEmail;
  }, [nome, cognome, password, username, email]);

  const handleLogin = async () => {
    if (submitting) return;

    if (!isLoginValid) {
      Alert.alert('Errore', 'Compila tutti i campi per accedere.');
      return;
    }

    setSubmitting(true);
    try {
      if (/.+@.+\..+/.test(email.trim())) {
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        const { auth } = await import('../../configuratore/lib/firebase');
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const { getProfileByEmail } = await import('../../configuratore/lib/api');
        const prof = await getProfileByEmail(cred.user.email ?? email.trim());
        if (!prof) {
          Alert.alert('Profilo non trovato', 'Completa la registrazione del profilo.');
          router.replace('/configuratore');
          return;
        }
        await login(prof as any);
        router.replace(`/configuratore/${prof.role}`);
      } else {
        const { profile: storedProfile } = await authenticateProfile(
          username.trim().length >= 3
            ? { username: username.trim(), password }
            : { nome, cognome, password }
        );
        await login(storedProfile);
        router.replace(`/configuratore/${storedProfile.role}`);
      }
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      if (code === 'auth/profile-not-found') {
        Alert.alert('Profilo non trovato', 'Verifica le informazioni inserite o registra un nuovo profilo.');
      } else if (code === 'auth/invalid-password') {
        Alert.alert('Password errata', 'La password inserita non è corretta.');
      } else {
        console.warn('Login failed:', error);
        Alert.alert('Errore', 'Impossibile effettuare l\'accesso in questo momento.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderChoice = () => (
    <View style={styles.selectionContainer}>
      <Text style={styles.heroTitle}>Benvenuto su Jobly</Text>
      <Text style={styles.heroSubtitle}>
        Gestisci i tuoi profili Datore e Lavoratore in un unico posto sicuro.
      </Text>

      <View style={styles.actionGroup}>
        <Pressable
          style={[styles.actionButton, styles.primaryAction]}
          accessibilityRole="button"
          onPress={() => setShowLoginForm(true)}
        >
          <Ionicons name="log-in-outline" size={22} color="#ffffff" />
          <Text style={styles.actionTextPrimary}>Accedi</Text>
        </Pressable>

        <Pressable
          style={[styles.actionButton, styles.secondaryAction]}
          accessibilityRole="button"
          onPress={() => router.push('/configuratore')}
        >
          <Ionicons name="person-add-outline" size={22} color={theme.colors.primary} />
          <Text style={styles.actionTextSecondary}>Registrati</Text>
        </Pressable>

      </View>
    </View>
  );

  const renderLoginForm = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.formCard}>
        <View style={styles.formHeader}>
          <View style={styles.formIconWrapper}>
            <MaterialIcons name="key" size={22} color={theme.colors.textPrimary} />
          </View>
          <Text style={styles.formTitle}>Accedi al tuo profilo</Text>
        </View>

        <Text style={styles.label}>Email (opzionale)</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Es. mario.rossi@email.com"
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Username (opzionale)</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Es. mario.rossi"
          style={styles.input}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Nome</Text>
        <TextInput
          value={nome}
          onChangeText={setNome}
          placeholder="Inserisci il nome"
          style={styles.input}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Cognome</Text>
        <TextInput
          value={cognome}
          onChangeText={setCognome}
          placeholder="Inserisci il cognome"
          style={styles.input}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Inserisci la password"
          style={styles.input}
          secureTextEntry
        />

        <Pressable
          style={[styles.loginButton, (!isLoginValid || submitting) && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={!isLoginValid || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.surface} />
          ) : (
            <>
              <Ionicons name="log-in-outline" size={20} color={theme.colors.surface} />
              <Text style={styles.loginButtonText}>Accedi</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={styles.backLink}
          onPress={() => {
            setShowLoginForm(false);
            setNome('');
            setCognome('');
            setPassword('');
          }}
        >
          <Ionicons name="arrow-back" size={18} color={theme.colors.primary} />
          <Text style={styles.backLinkText}>Torna indietro</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
          <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.container}>
          {showLoginForm ? renderLoginForm() : renderChoice()}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (t: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
      padding: 24,
      justifyContent: 'center',
    },
    loaderContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    selectionContainer: {
      alignItems: 'center',
      gap: 20,
    },
    heroTitle: {
      fontSize: 30,
      fontWeight: '700',
      color: t.colors.textPrimary,
      textAlign: 'center',
    },
    heroSubtitle: {
      fontSize: 16,
      color: t.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 12,
    },
    actionGroup: {
      width: '100%',
      gap: 14,
      marginTop: 12,
    },
    actionButton: {
      paddingVertical: 18,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    primaryAction: {
      backgroundColor: t.colors.primary,
    },
    secondaryAction: {
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    actionTextPrimary: {
      color: t.colors.surface,
      fontSize: 16,
      fontWeight: '700',
    },
    actionTextSecondary: {
      color: t.colors.primary,
      fontSize: 16,
      fontWeight: '700',
    },
    scrollContent: {
      paddingBottom: 200,
    },
    formCard: {
      backgroundColor: t.colors.surface,
      borderRadius: 20,
      padding: 20,
      gap: 16,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    formHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 4,
    },
    formIconWrapper: {
      backgroundColor: t.colors.border,
      borderRadius: 12,
      padding: 10,
    },
    formTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: t.colors.textPrimary,
    },
    label: {
      fontSize: 15,
      fontWeight: '600',
      color: t.colors.textPrimary,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
      color: t.colors.textPrimary,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
    },
    loginButton: {
      marginTop: 8,
      backgroundColor: t.colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    loginButtonText: {
      color: t.colors.surface,
      fontSize: 16,
      fontWeight: '600',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    backLink: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'center',
    },
    backLinkText: {
      color: t.colors.primary,
      fontSize: 15,
      fontWeight: '600',
    },
  });

export default LandingScreen;
