import React, { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import BottomNav from './bottom-nav';
import { useProfile } from './profile-context';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useTheme, useThemedStyles } from './theme';

const IncarichiScreen: React.FC = () => {
  const router = useRouter();
  const { profile, incarichi, loading } = useProfile();
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!profile) {
      router.replace('/configuratore/landing');
    }
  }, [loading, profile, router]);

  const sortedIncarichi = useMemo(
    () =>
      [...incarichi].sort((a, b) => {
        const aDate = new Date(`${a.data}T${a.oraInizio}:00`).getTime();
        const bDate = new Date(`${b.data}T${b.oraInizio}:00`).getTime();
        if (Number.isNaN(aDate) || Number.isNaN(bDate)) {
          return 0;
        }
        return aDate - bDate;
      }),
    [incarichi]
  );

  if (!profile) {
    return null;
  }

  const isDatore = profile.role === 'datore';

  const ApplicantsCount = ({ jobId }: { jobId: string }) => {
    const [count, setCount] = React.useState<number>(0);
    React.useEffect(() => {
      let cancelled = false;
      const ref = doc(db, 'jobs', jobId);
      const unsub = onSnapshot(ref, (snap) => {
        const data = (snap.data() ?? {}) as Record<string, any>;
        const ids = Array.isArray((data as any)?.applicants)
          ? ((data as any).applicants as unknown[]).filter((x) => typeof x === 'string')
          : [];
        if (!cancelled) setCount(ids.length);
      });
      return () => { cancelled = true; unsub(); };
    }, [jobId]);
    return (
      <View style={styles.countPill}><Text style={styles.countPillText}>Candidati: {count}</Text></View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>I miei incarichi</Text>
        <Text style={styles.subtitle}>
          {isDatore
            ? 'Una panoramica delle attività che hai pianificato come datore.'
            : 'Qui troverai gli incarichi assegnati al tuo profilo lavoratore.'}
        </Text>

        {isDatore ? (
          sortedIncarichi.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="clipboard-outline" size={42} color={theme.colors.muted} />
              <Text style={styles.emptyTitle}>Ancora nessun incarico</Text>
              <Text style={styles.emptyText}>
                Crea un nuovo incarico dalla pagina principale per iniziare a organizzare le tue attività.
              </Text>
            </View>
          ) : (
            sortedIncarichi.map((incarico) => {
              const titolo =
                incarico.tipo.categoria === 'altro'
                  ? incarico.tipo.altroDettaglio ?? 'Altro'
                  : incarico.tipo.categoria.charAt(0).toUpperCase() +
                    incarico.tipo.categoria.slice(1);
              const compensoFormattato = incarico.compensoOrario.toLocaleString('it-IT', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });

              return (
                <Pressable
                  key={incarico.id}
                  style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.98 }] }]}
                  onPress={() => router.push(`/configuratore/job?jobId=${encodeURIComponent(incarico.id)}`)}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{titolo}</Text>
                    <Text style={styles.cardDate}>
                      {incarico.data} · {incarico.oraInizio} - {incarico.oraFine}
                    </Text>
                  </View>

                  <View style={styles.row}>
                    <Ionicons name="location-outline" size={16} color={theme.colors.primary} />
                    <Text style={styles.rowText}>
                      {incarico.indirizzo.via}, {incarico.indirizzo.civico}, {incarico.indirizzo.citta}
                      {' '}({incarico.indirizzo.provincia}) {incarico.indirizzo.cap}
                    </Text>
                  </View>

                  <View style={styles.row}>
                    <Ionicons name="cash-outline" size={16} color={theme.colors.success} />
                    <Text style={styles.rowText}>
                      {incarico.compensoOrario > 0
                        ? `€ ${compensoFormattato} / ora`
                        : 'Compenso non specificato'}
                    </Text>
                  </View>

                  <View style={styles.descriptionBlock}>
                    <MaterialIcons name="notes" size={16} color="#475569" />
                    <Text style={styles.descriptionText}>{incarico.descrizione}</Text>
                  </View>
                  <ApplicantsCount jobId={incarico.id} />
                </Pressable>
              );
            })
          )
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={42} color={theme.colors.muted} />
            <Text style={styles.emptyTitle}>Nessun incarico assegnato</Text>
            <Text style={styles.emptyText}>
              Attendi che un datore ti assegni un incarico oppure esplora le opportunità dalla schermata principale.
            </Text>
          </View>
        )}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
};

const createStyles = (t: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 32,
    gap: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: t.colors.textPrimary,
  },
  subtitle: {
    fontSize: 15,
    color: t.colors.textSecondary,
    lineHeight: 20,
  },
  emptyState: {
    marginTop: 40,
    backgroundColor: t.colors.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    shadowColor: t.colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: t.colors.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    color: t.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: 18,
    padding: 18,
    gap: 12,
    shadowColor: t.colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardHeader: {
    gap: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: t.colors.textPrimary,
  },
  cardDate: {
    fontSize: 13,
    color: t.colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowText: {
    fontSize: 14,
    color: t.colors.textPrimary,
    flex: 1,
  },
  descriptionBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  descriptionText: {
    flex: 1,
    fontSize: 14,
    color: t.colors.textSecondary,
    lineHeight: 20,
  },
  countPill: {
    alignSelf: 'flex-start',
    backgroundColor: t.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  countPillText: {
    fontSize: 12,
    color: t.colors.textPrimary,
    fontWeight: '600',
  },
});

export default IncarichiScreen;
