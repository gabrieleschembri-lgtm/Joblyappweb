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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useProfile } from '../../configuratore/app/profile-context';
import { authenticateProfile } from '../../configuratore/lib/api';
import { useTheme, useThemedStyles } from '../../configuratore/app/theme';
import IconTextInput from '../../configuratore/components/icon-text-input';
import JoblyIcon from '../../configuratore/components/jobly-icon';

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
  const [showPassword, setShowPassword] = useState(false);
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
        await login(prof);
        router.replace(prof.role === 'datore' ? '/configuratore/datore' : '/configuratore/lavoratore');
      } else {
        const { profile: storedProfile } = await authenticateProfile(
          username.trim().length >= 3
            ? { username: username.trim(), password }
            : { nome, cognome, password }
        );
        await login(storedProfile);
        router.replace(
          storedProfile.role === 'datore' ? '/configuratore/datore' : '/configuratore/lavoratore'
        );
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
      <View style={styles.brandMark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <JoblyIcon name="briefcase" size="feature" color={theme.colors.surface} />
        <View style={styles.brandCheck}>
          <JoblyIcon name="checkmark" size="small" color={theme.colors.surface} />
        </View>
      </View>
      <Text style={styles.eyebrow}>IL LAVORO, PIÙ SEMPLICE</Text>
      <Text style={styles.heroTitle}>Benvenuto su Jobly</Text>
      <Text style={styles.heroSubtitle}>
        Gestisci i tuoi profili Datore e Lavoratore in un unico posto sicuro.
      </Text>

      <View style={styles.actionGroup}>
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            styles.primaryAction,
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Accedi a Jobly"
          onPress={() => setShowLoginForm(true)}
        >
          <JoblyIcon name="log-in-outline" size="medium" color={theme.colors.surface} />
          <Text style={styles.actionTextPrimary}>Accedi</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            styles.secondaryAction,
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Crea un account Jobly"
          onPress={() => router.push('/configuratore')}
        >
          <JoblyIcon name="person-add-outline" size="medium" color={theme.colors.primary} />
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
            <JoblyIcon name="key-outline" size="medium" color={theme.colors.primary} />
          </View>
          <View style={styles.formHeaderText}>
            <Text style={styles.formTitle}>Accedi al tuo profilo</Text>
            <Text style={styles.formSubtitle}>Usa email, username oppure nome e cognome.</Text>
          </View>
        </View>

        <Text style={styles.label}>Email (opzionale)</Text>
        <IconTextInput
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          placeholder="Es. mario.rossi@email.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <Text style={styles.label}>Username (opzionale)</Text>
        <IconTextInput
          icon="at-outline"
          value={username}
          onChangeText={setUsername}
          placeholder="Es. mario.rossi"
          autoCapitalize="none"
          autoComplete="username"
          textContentType="username"
        />

        <Text style={styles.label}>Nome</Text>
        <IconTextInput
          icon="person-outline"
          value={nome}
          onChangeText={setNome}
          placeholder="Inserisci il nome"
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
        />

        <Text style={styles.label}>Cognome</Text>
        <IconTextInput
          icon="person-outline"
          value={cognome}
          onChangeText={setCognome}
          placeholder="Inserisci il cognome"
          autoCapitalize="words"
          autoComplete="family-name"
          textContentType="familyName"
        />

        <Text style={styles.label}>Password</Text>
        <IconTextInput
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          placeholder="Inserisci la password"
          autoComplete="current-password"
          textContentType="password"
          secureTextEntry={!showPassword}
          trailingIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
          trailingAccessibilityLabel={showPassword ? 'Nascondi password' : 'Mostra password'}
          onTrailingPress={() => setShowPassword((current) => !current)}
        />

        <Pressable
          style={({ pressed }) => [
            styles.loginButton,
            (!isLoginValid || submitting) && styles.buttonDisabled,
            pressed && isLoginValid && !submitting && styles.buttonPressed,
          ]}
          onPress={handleLogin}
          disabled={!isLoginValid || submitting}
          accessibilityRole="button"
          accessibilityLabel="Accedi al profilo"
          accessibilityState={{ disabled: !isLoginValid || submitting, busy: submitting }}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.surface} />
          ) : (
            <>
              <JoblyIcon name="log-in-outline" size="standard" color={theme.colors.surface} />
              <Text style={styles.loginButtonText}>Accedi</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.backLink, pressed && styles.backLinkPressed]}
          accessibilityRole="button"
          accessibilityLabel="Torna alla scelta iniziale"
          onPress={() => {
            setShowLoginForm(false);
            setNome('');
            setCognome('');
            setEmail('');
            setUsername('');
            setPassword('');
            setShowPassword(false);
          }}
        >
          <JoblyIcon name="arrow-back" size="standard" color={theme.colors.primary} />
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
      justifyContent: 'center',
      alignItems: 'center',
    },
    loaderContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    selectionContainer: {
      width: '90%',
      maxWidth: 480,
      alignItems: 'center',
      gap: 14,
    },
    brandMark: {
      width: 92,
      height: 92,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.primary,
      marginBottom: 6,
      shadowColor: t.colors.primary,
      shadowOpacity: 0.24,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 7,
    },
    brandCheck: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.success,
      borderWidth: 3,
      borderColor: t.colors.background,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: t.colors.primary,
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
      marginTop: 18,
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
    buttonPressed: {
      opacity: 0.86,
      transform: [{ scale: 0.99 }],
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
      flexGrow: 1,
      justifyContent: 'center',
      paddingVertical: 32,
    },
    formCard: {
      width: '90%',
      maxWidth: 520,
      alignSelf: 'center',
      boxSizing: 'border-box',
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
    formHeaderText: {
      flex: 1,
      gap: 3,
    },
    formTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: t.colors.textPrimary,
    },
    formSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: t.colors.textSecondary,
    },
    label: {
      fontSize: 15,
      fontWeight: '600',
      color: t.colors.textPrimary,
      marginBottom: 6,
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
    backLinkPressed: {
      opacity: 0.65,
    },
  });

export default LandingScreen;
