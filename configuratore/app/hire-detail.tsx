import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

import { db } from '../lib/firebase';
import { acceptHire, completeHire, rejectHire } from '../lib/api';
import { useProfile } from './profile-context';
import { useTheme, useThemedStyles } from './theme';

type HireDetail = {
  id: string;
  status: string;
  employerProfileId?: string;
  workerProfileId?: string;
  jobTitle?: string;
  jobDate?: string;
  jobStartTime?: string;
  jobEndTime?: string;
  jobLocationText?: string;
  jobPayAmount?: number;
  jobPayCurrency?: string;
};

const formatDateTime = (dateRaw?: string, start?: string, end?: string) => {
  if (!dateRaw) return '';
  const date = new Date(`${dateRaw}T00:00:00`);
  const formattedDate = Number.isNaN(date.getTime())
    ? dateRaw
    : date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeLabel = start ? `${start}${end ? ` - ${end}` : ''}` : '';
  return [formattedDate, timeLabel].filter((v) => v).join(' · ');
};

const HireDetailScreen: React.FC = () => {
  const router = useRouter();
  const { hireId: raw } = useLocalSearchParams<{ hireId?: string }>();
  const hireId = Array.isArray(raw) ? raw[0] : raw;
  const { profile } = useProfile();
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));

  const [hire, setHire] = useState<HireDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [otherName, setOtherName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!hireId) return;
    const ref = doc(db, 'hires', hireId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setHire(null);
          setLoading(false);
          return;
        }
        const data = snap.data() ?? {};
        setHire({
          id: snap.id,
          status: typeof data.status === 'string' ? data.status : 'proposed',
          employerProfileId: typeof data.employerProfileId === 'string' ? data.employerProfileId : undefined,
          workerProfileId: typeof data.workerProfileId === 'string' ? data.workerProfileId : undefined,
          jobTitle: typeof data.jobTitle === 'string' ? data.jobTitle : 'Incarico',
          jobDate: typeof data.jobDate === 'string' ? data.jobDate : undefined,
          jobStartTime: typeof data.jobStartTime === 'string' ? data.jobStartTime : undefined,
          jobEndTime: typeof data.jobEndTime === 'string' ? data.jobEndTime : undefined,
          jobLocationText: typeof data.jobLocationText === 'string' ? data.jobLocationText : undefined,
          jobPayAmount: typeof data.jobPayAmount === 'number' ? data.jobPayAmount : Number(data.jobPayAmount ?? 0),
          jobPayCurrency: typeof data.jobPayCurrency === 'string' ? data.jobPayCurrency : 'EUR',
        });
        setLoading(false);
      },
      () => {
        setHire(null);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [hireId]);

  useEffect(() => {
    let cancelled = false;
    const loadName = async () => {
      if (!hire || !profile) return;
      const targetId = profile.role === 'datore' ? hire.workerProfileId : hire.employerProfileId;
      if (!targetId) return;
      try {
        const snap = await getDoc(doc(db, 'profiles', targetId));
        const data = snap.data() as Record<string, any> | undefined;
        if (!data || cancelled) return;
        const nome = typeof data.nome === 'string' ? data.nome : (typeof data.name === 'string' ? data.name : '');
        const cognome = typeof data.cognome === 'string' ? data.cognome : (typeof data.surname === 'string' ? data.surname : '');
        const full = `${nome} ${cognome}`.trim();
        if (!cancelled) setOtherName(full || targetId);
      } catch {
        // ignore
      }
    };
    void loadName();
    return () => { cancelled = true; };
  }, [hire, profile]);

  const dateLabel = useMemo(
    () => formatDateTime(hire?.jobDate, hire?.jobStartTime, hire?.jobEndTime),
    [hire?.jobDate, hire?.jobStartTime, hire?.jobEndTime]
  );

  const payLabel = useMemo(() => {
    if (!hire) return '';
    if (hire.jobPayAmount && hire.jobPayAmount > 0) {
      return `€ ${hire.jobPayAmount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ora`;
    }
    return 'Compenso non specificato';
  }, [hire]);

  const handleAccept = async () => {
    if (!hireId || submitting) return;
    setSubmitting(true);
    try {
      await acceptHire(hireId);
      Alert.alert('Assunzione confermata', 'Hai accettato la proposta.');
    } catch (e) {
      Alert.alert('Errore', (e as Error)?.message ?? 'Impossibile accettare la proposta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!hireId || submitting) return;
    setSubmitting(true);
    try {
      await rejectHire(hireId);
      Alert.alert('Proposta rifiutata', 'Hai rifiutato la proposta.');
    } catch (e) {
      Alert.alert('Errore', (e as Error)?.message ?? 'Impossibile rifiutare la proposta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!hireId || submitting) return;
    setSubmitting(true);
    try {
      await completeHire(hireId);
      Alert.alert('Incarico completato', 'Hai completato l’incarico.');
    } catch (e) {
      Alert.alert('Errore', (e as Error)?.message ?? 'Impossibile completare l’incarico.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.textPrimary} />
            <Text style={styles.backText}>Indietro</Text>
          </Pressable>
          <Text style={styles.title}>Dettagli assunzione</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : !hire ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Assunzione non trovata.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{hire.jobTitle || 'Incarico'}</Text>
            {otherName ? <Text style={styles.cardSubtitle}>{otherName}</Text> : null}
            {dateLabel ? <Text style={styles.cardMeta}>{dateLabel}</Text> : null}
            {hire.jobLocationText ? <Text style={styles.cardMeta}>{hire.jobLocationText}</Text> : null}
            <Text style={styles.cardMeta}>{payLabel}</Text>
            <Text style={styles.statusBadge}>
              {hire.status === 'proposed'
                ? 'Proposta'
                : hire.status === 'confirmed'
                  ? 'Confermata'
                  : hire.status === 'completed'
                    ? 'Completata'
                    : hire.status === 'rejected'
                      ? 'Rifiutata'
                      : hire.status}
            </Text>

            {profile?.role === 'lavoratore' && hire.status === 'proposed' ? (
              <View style={styles.actions}>
                <Pressable
                  style={[styles.primaryButton, submitting && styles.buttonDisabled]}
                  onPress={handleAccept}
                  disabled={submitting}
                >
                  <Text style={styles.primaryButtonText}>Accetta</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, submitting && styles.buttonDisabled]}
                  onPress={handleReject}
                  disabled={submitting}
                >
                  <Text style={styles.secondaryButtonText}>Rifiuta</Text>
                </Pressable>
              </View>
            ) : null}

            {profile?.role === 'datore' && hire.status === 'confirmed' ? (
              <Pressable
                style={[styles.primaryButton, submitting && styles.buttonDisabled]}
                onPress={handleComplete}
                disabled={submitting}
              >
                <Text style={styles.primaryButtonText}>Completa incarico</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (t: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: t.colors.background },
    content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 80, gap: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8 },
    backText: { fontSize: 14, color: t.colors.textPrimary, fontWeight: '600' },
    title: { fontSize: 20, fontWeight: '700', color: t.colors.textPrimary },
    loader: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
    emptyState: {
      backgroundColor: t.colors.surface,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    emptyText: { fontSize: 14, color: t.colors.textSecondary },
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: 16,
      padding: 18,
      gap: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    cardTitle: { fontSize: 18, fontWeight: '700', color: t.colors.textPrimary },
    cardSubtitle: { fontSize: 14, color: t.colors.textSecondary },
    cardMeta: { fontSize: 13, color: t.colors.textSecondary },
    statusBadge: {
      marginTop: 8,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: t.colors.border,
      color: t.colors.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    primaryButton: {
      backgroundColor: t.colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      flex: 1,
    },
    primaryButtonText: { color: t.colors.surface, fontWeight: '700' },
    secondaryButton: {
      backgroundColor: t.colors.border,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      flex: 1,
    },
    secondaryButtonText: { color: t.colors.textPrimary, fontWeight: '700' },
    buttonDisabled: { opacity: 0.6 },
  });

export default HireDetailScreen;
