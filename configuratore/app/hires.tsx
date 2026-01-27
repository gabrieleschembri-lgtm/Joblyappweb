import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { db, ensureSignedIn } from '../lib/firebase';
import { useProfile } from './profile-context';
import { useTheme, useThemedStyles } from './theme';

type HireItem = {
  id: string;
  status: string;
  workerUid: string;
  workerProfileId?: string;
  jobTitle: string;
  jobDate?: string;
  jobStartTime?: string;
  jobEndTime?: string;
  jobLocationText?: string;
  jobPayAmount?: number;
  jobPayCurrency?: string;
  updatedAt?: Date | null;
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

const HiresEmployerScreen: React.FC = () => {
  const router = useRouter();
  const { profile, loading } = useProfile();
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));

  const [uid, setUid] = useState<string | null>(null);
  const [items, setItems] = useState<HireItem[]>([]);
  const [loadingHires, setLoadingHires] = useState(true);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && profile) {
      if (profile.role !== 'datore') {
        router.replace(`/configuratore/${profile.role}`);
      }
    }
  }, [loading, profile, router]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const resolved = await ensureSignedIn();
        if (!cancelled) setUid(resolved);
      } catch {
        if (!cancelled) setUid(null);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoadingHires(false);
      return;
    }
    setLoadingHires(true);
    const hiresRef = collection(db, 'hires');
    const q = query(hiresRef, where('employerUid', '==', uid), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs.map((docSnap) => {
          const data = docSnap.data() ?? {};
          return {
            id: docSnap.id,
            status: typeof data.status === 'string' ? data.status : 'proposed',
            workerUid: typeof data.workerUid === 'string' ? data.workerUid : '',
            workerProfileId: typeof data.workerProfileId === 'string' ? data.workerProfileId : undefined,
            jobTitle: typeof data.jobTitle === 'string' ? data.jobTitle : 'Incarico',
            jobDate: typeof data.jobDate === 'string' ? data.jobDate : undefined,
            jobStartTime: typeof data.jobStartTime === 'string' ? data.jobStartTime : undefined,
            jobEndTime: typeof data.jobEndTime === 'string' ? data.jobEndTime : undefined,
            jobLocationText: typeof data.jobLocationText === 'string' ? data.jobLocationText : undefined,
            jobPayAmount: typeof data.jobPayAmount === 'number' ? data.jobPayAmount : Number(data.jobPayAmount ?? 0),
            jobPayCurrency: typeof data.jobPayCurrency === 'string' ? data.jobPayCurrency : 'EUR',
            updatedAt: data.updatedAt?.toDate?.() ?? null,
          } satisfies HireItem;
        });
        setItems(mapped);
        setLoadingHires(false);
      },
      (error) => {
        const code = (error as { code?: string }).code;
        if (code === 'failed-precondition') {
          console.warn('[HIRE_DEBUG] Missing index for employer hires query:', (error as Error).message);
        } else {
          console.warn('[HIRE_DEBUG] Employer hires subscribe error:', error);
        }
        setItems([]);
        setLoadingHires(false);
      }
    );
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    let cancelled = false;
    const loadNames = async () => {
      const missing = items
        .map((item) => item.workerProfileId)
        .filter((id): id is string => !!id && !names[id]);
      if (missing.length === 0) return;
      for (const id of missing) {
        try {
          const snap = await getDoc(doc(db, 'profiles', id));
          const data = snap.data() as Record<string, any> | undefined;
          if (!data) continue;
          const nome = typeof data.nome === 'string' ? data.nome : (typeof data.name === 'string' ? data.name : '');
          const cognome = typeof data.cognome === 'string' ? data.cognome : (typeof data.surname === 'string' ? data.surname : '');
          const full = `${nome} ${cognome}`.trim();
          if (!cancelled) {
            setNames((prev) => ({ ...prev, [id]: full || id }));
          }
        } catch {
          // ignore
        }
      }
    };
    void loadNames();
    return () => { cancelled = true; };
  }, [items, names]);

  const grouped = useMemo(() => {
    const sections = [
      { key: 'proposed', title: 'Proposte' },
      { key: 'confirmed', title: 'Confermate' },
      { key: 'completed', title: 'Completate' },
      { key: 'rejected', title: 'Rifiutate' },
    ];
    return sections.map((section) => ({
      ...section,
      data: items.filter((item) => item.status === section.key),
    }));
  }, [items]);

  if (!profile || profile.role !== 'datore') {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.textPrimary} />
            <Text style={styles.backText}>Indietro</Text>
          </Pressable>
          <Text style={styles.title}>Assunzioni</Text>
          <View style={{ width: 24 }} />
        </View>

        {loadingHires ? (
          <View style={styles.loader}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={28} color={theme.colors.muted} />
            <Text style={styles.emptyText}>Nessuna assunzione ancora.</Text>
          </View>
        ) : (
          grouped.map((section) => {
            if (section.data.length === 0) return null;
            return (
              <View key={section.key} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.data.map((item) => {
                  const name = item.workerProfileId ? names[item.workerProfileId] : '';
                  const dateLabel = formatDateTime(item.jobDate, item.jobStartTime, item.jobEndTime);
                  const payLabel = item.jobPayAmount && item.jobPayAmount > 0
                    ? `€ ${item.jobPayAmount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ora`
                    : 'Compenso non specificato';
                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                      onPress={() => router.push(`/configuratore/hire/${encodeURIComponent(item.id)}`)}
                    >
                      <Text style={styles.cardTitle}>{name || 'Collaboratore'}</Text>
                      <Text style={styles.cardSubtitle}>{item.jobTitle}</Text>
                      {dateLabel ? <Text style={styles.cardMeta}>{dateLabel}</Text> : null}
                      {item.jobLocationText ? <Text style={styles.cardMeta}>{item.jobLocationText}</Text> : null}
                      <Text style={styles.cardMeta}>{payLabel}</Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })
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
      gap: 10,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    emptyText: { fontSize: 14, color: t.colors.textSecondary, textAlign: 'center' },
    section: { gap: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: t.colors.textPrimary },
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: 16,
      padding: 16,
      gap: 6,
      borderWidth: 1,
      borderColor: t.colors.border,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    cardPressed: { transform: [{ scale: 0.98 }] },
    cardTitle: { fontSize: 16, fontWeight: '700', color: t.colors.textPrimary },
    cardSubtitle: { fontSize: 14, color: t.colors.textSecondary },
    cardMeta: { fontSize: 13, color: t.colors.textSecondary },
  });

export default HiresEmployerScreen;
