import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { applyActionCode, getAuth, reload, sendEmailVerification } from 'firebase/auth';

import { auth } from '../../configuratore/lib/firebase';
import { useTheme, useThemedStyles } from '../../configuratore/app/theme';
import IconTextInput from '../../configuratore/components/icon-text-input';
import JoblyIcon from '../../configuratore/components/jobly-icon';
import { useJoblyDialog } from '../../configuratore/components/jobly-dialog';

const VerifyEmailScreen: React.FC = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));
  const { showDialog } = useJoblyDialog();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      const match = /oobCode=([^&]+)/.exec(url ?? '');
      if (match && match[1]) {
        setCode(decodeURIComponent(match[1]));
      }
    });
    (async () => {
      const url = await Linking.getInitialURL();
      const match = /oobCode=([^&]+)/.exec(url ?? '');
      if (match && match[1]) {
        setCode(decodeURIComponent(match[1]));
      }
    })().catch(() => {});
    return () => sub.remove();
  }, []);

  const canConfirm = useMemo(() => code.trim().length > 0, [code]);

  const handleConfirm = useCallback(async () => {
    if (!canConfirm) return;
    try {
      setBusy(true);
      await applyActionCode(getAuth(), code.trim());
      if (auth.currentUser) {
        await reload(auth.currentUser);
      }
      showDialog('Verifica completata', 'La tua email è stata verificata.', [
        { text: 'OK', onPress: () => router.replace('/configuratore/landing') },
      ]);
    } catch {
      showDialog('Errore', 'Codice non valido o scaduto. Prova a reinviare l\'email.');
    } finally {
      setBusy(false);
    }
  }, [canConfirm, code, router, showDialog]);

  const handleResend = useCallback(async () => {
    try {
      setBusy(true);
      if (!auth.currentUser) {
        showDialog('Attenzione', 'Accedi prima con email e password per inviare la verifica.');
        return;
      }
      await sendEmailVerification(auth.currentUser, {
        // The link will work in browser; you can copy the oobCode into the app
        url: 'https://jobly.example/verify',
        handleCodeInApp: true,
      });
      showDialog('Email inviata', 'Controlla la posta e copia il codice oobCode dal link.');
    } catch {
      showDialog('Errore', 'Impossibile inviare l\'email di verifica in questo momento.');
    } finally {
      setBusy(false);
    }
  }, [showDialog]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.iconButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Torna indietro"
          >
            <JoblyIcon name="chevron-back" size="medium" color={theme.colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Verifica email</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.card}>
          <View style={styles.featureIcon}>
            <JoblyIcon name="mail-open-outline" size="large" color={theme.colors.primary} />
          </View>
          <Text style={styles.subtitle}>Incolla qui il codice oobCode ricevuto via email oppure incolla l&apos;intero link.</Text>
          <IconTextInput
            icon="key-outline"
            value={code}
            onChangeText={(v) => {
              const m = /oobCode=([^&]+)/.exec(v);
              setCode(m ? decodeURIComponent(m[1]) : v);
            }}
            placeholder="oobCode o link di verifica"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={[styles.button, (!canConfirm || busy) && styles.disabled]}
            onPress={busy ? undefined : handleConfirm}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canConfirm || busy, busy }}
          >
            <JoblyIcon name="checkmark-circle-outline" size="standard" color={theme.colors.surface} />
            <Text style={styles.buttonText}>Conferma</Text>
          </Pressable>
          <Pressable
            style={[styles.linkButton, busy && styles.disabled]}
            onPress={busy ? undefined : handleResend}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy }}
          >
            <JoblyIcon name="paper-plane-outline" size="small" color={theme.colors.primary} />
            <Text style={styles.linkText}>Reinvia email di verifica</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (t: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: t.colors.background },
    container: {
      flex: 1,
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
      boxSizing: 'border-box',
      backgroundColor: t.colors.background,
      padding: 16,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
    iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    headerSpacer: { width: 44 },
    title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: t.colors.textPrimary },
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: 20,
      padding: 20,
      gap: 14,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    featureIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    subtitle: { fontSize: 14, color: t.colors.textSecondary, lineHeight: 20 },
    button: {
      minHeight: 48,
      marginTop: 6,
      backgroundColor: t.colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    buttonText: { color: t.colors.surface, fontSize: 16, fontWeight: '600' },
    disabled: { opacity: 0.6 },
    linkButton: {
      minHeight: 44,
      marginTop: 4,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    linkText: { color: t.colors.primary, fontSize: 14, fontWeight: '600' },
  });

export default VerifyEmailScreen;
