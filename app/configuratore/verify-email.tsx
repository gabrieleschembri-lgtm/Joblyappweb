import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { applyActionCode, getAuth, reload, sendEmailVerification } from 'firebase/auth';

import { auth } from '../../configuratore/lib/firebase';

const VerifyEmailScreen: React.FC = () => {
  const router = useRouter();
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
      Alert.alert('Verifica completata', 'La tua email è stata verificata.', [
        { text: 'OK', onPress: () => router.replace('/configuratore/landing') },
      ]);
    } catch (e) {
      Alert.alert('Errore', 'Codice non valido o scaduto. Prova a reinviare l\'email.');
    } finally {
      setBusy(false);
    }
  }, [canConfirm, code, router]);

  const handleResend = useCallback(async () => {
    try {
      setBusy(true);
      if (!auth.currentUser) {
        Alert.alert('Attenzione', 'Accedi prima con email e password per inviare la verifica.');
        return;
      }
      await sendEmailVerification(auth.currentUser, {
        // The link will work in browser; you can copy the oobCode into the app
        url: 'https://jobly.example/verify',
        handleCodeInApp: true,
      });
      Alert.alert('Email inviata', 'Controlla la posta e copia il codice oobCode dal link.');
    } catch {
      Alert.alert('Errore', 'Impossibile inviare l\'email di verifica in questo momento.');
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <Ionicons name="chevron-back" size={26} color="#0f172a" />
          </Pressable>
          <Text style={styles.title}>Verifica email</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.card}>
          <Text style={styles.subtitle}>Incolla qui il codice oobCode ricevuto via email oppure incolla l'intero link.</Text>
          <TextInput
            value={code}
            onChangeText={(v) => {
              const m = /oobCode=([^&]+)/.exec(v);
              setCode(m ? decodeURIComponent(m[1]) : v);
            }}
            placeholder="oobCode o link di verifica"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <Pressable style={[styles.button, (!canConfirm || busy) && styles.disabled]} onPress={busy ? undefined : handleConfirm}>
            <Text style={styles.buttonText}>Conferma</Text>
          </Pressable>
          <Pressable style={[styles.linkButton, busy && styles.disabled]} onPress={busy ? undefined : handleResend}>
            <Text style={styles.linkText}>Reinvia email di verifica</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#0f172a' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  subtitle: { fontSize: 14, color: '#475569' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  button: { marginTop: 6, backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  linkButton: { marginTop: 8, alignItems: 'center' },
  linkText: { color: '#1d4ed8', fontSize: 14, fontWeight: '600' },
});

export default VerifyEmailScreen;

