import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import BottomNav from './bottom-nav';
import { useProfile } from './profile-context';

import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const ApplicantsCount = ({ jobId }: { jobId: string }) => {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    const ref = doc(db, 'jobs', jobId);
    const unsub = onSnapshot(ref, (snap) => {
      const data = (snap.data() ?? {}) as Record<string, any>;
      const ids = Array.isArray((data as any)?.applicants)
        ? ((data as any).applicants as unknown[]).filter((x) => typeof x === 'string')
        : [];
      if (!cancelled) {
        setCount(ids.length);
        setLoading(false);
      }
    }, () => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; unsub(); };
  }, [jobId]);

  return (
    <View style={styles.applicantsBadge}>
      <Text style={styles.applicantsBadgeText}>
        {loading ? 'Candidati: …' : `Candidati: ${count}`}
      </Text>
    </View>
  );
};

const DatoreScreen: React.FC = () => {
  const router = useRouter();
  const { profile, loading, incarichi } = useProfile();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!profile) {
      router.replace('/configuratore/landing');
      return;
    }
    if (profile.role !== 'datore') {
      router.replace(`/configuratore/${profile.role}`);
    }
  }, [loading, profile, router]);

  const nomeCompleto = useMemo(() => {
    if (!profile) return '—';
    return `${profile.nome} ${profile.cognome}`.trim();
  }, [profile]);

  const totaleIncarichi = incarichi.length;

  const prossimaOccorrenza = useMemo(() => {
    const now = new Date();
    const parsed = incarichi
      .map((incarico) => {
        const dateTime = new Date(`${incarico.data}T${incarico.oraInizio}:00`);
        return {
          incarico,
          timestamp: dateTime.getTime(),
        };
      })
      .filter(({ timestamp }) => !Number.isNaN(timestamp) && timestamp >= now.getTime())
      .sort((a, b) => a.timestamp - b.timestamp);
    return parsed[0]?.incarico ?? null;
  }, [incarichi]);

  const prossimaDescrizione = useMemo(() => {
    if (!prossimaOccorrenza) {
      return 'Nessun incarico imminente';
    }
    const dateString = `${prossimaOccorrenza.data}T${prossimaOccorrenza.oraInizio}:00`;
    const localized = new Date(dateString);
    const formattedDate = Number.isNaN(localized.getTime())
      ? prossimaOccorrenza.data
      : localized.toLocaleDateString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
    const formattedTime = Number.isNaN(localized.getTime())
      ? prossimaOccorrenza.oraInizio
      : localized.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    return `${formattedDate} · ${formattedTime}`;
  }, [prossimaOccorrenza]);

  if (!profile || profile.role !== 'datore') {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.greeting}>Ciao {nomeCompleto}</Text>
          <Text style={styles.subtitle}>
            Benvenuto nella tua area Datore. Qui puoi gestire incarichi e
            collaboratori.
          </Text>

          <View style={styles.overviewCard}>
            <View style={styles.overviewColumn}>
              <Text style={styles.overviewLabel}>Totale incarichi</Text>
              <Text style={styles.overviewValue}>{totaleIncarichi}</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewColumn}>
              <Text style={styles.overviewLabel}>Prossimo incarico</Text>
              <Text style={styles.overviewSubValue}>{prossimaDescrizione}</Text>
            </View>
          </View>

          <View style={styles.cardGrid}>
            <View style={styles.card}>
              <MaterialIcons name="group" size={28} color="#2563eb" />
              <Text style={styles.cardTitle}>Team</Text>
              <Text style={styles.cardText}>
                Invita nuovi collaboratori e monitora le loro attività.
              </Text>
            </View>
            <View style={styles.card}>
              <MaterialIcons name="task" size={28} color="#0ea5e9" />
              <Text style={styles.cardTitle}>Incarichi attivi</Text>
              <Text style={styles.cardText}>
                Visualizza lo stato dei progetti e approva le richieste.
              </Text>
            </View>
          </View>

          <View style={styles.profileSummary}>
            <Ionicons name="person-outline" size={22} color="#2563eb" />
            <View>
              <Text style={styles.summaryLabel}>Profilo</Text>
              <Text style={styles.summaryValue}>{nomeCompleto}</Text>
              <Text style={styles.summaryMeta}>
                Data di nascita: {profile.dataNascita}
              </Text>
            </View>
          </View>

          <View style={styles.banner}>
            <View style={styles.bannerIcon}>
              <Ionicons name="calendar" size={24} color="#0f172a" />
            </View>
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>Pianifica un nuovo incarico</Text>
              <Text style={styles.bannerSubtitle}>
                Definisci requisiti, durata e budget in pochi passaggi.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#0f172a" />
          </View>

          <View style={styles.incarichiSection}>
            <Text style={styles.sectionHeading}>I tuoi incarichi</Text>
            {incarichi.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="briefcase-outline" size={26} color="#64748b" />
                <Text style={styles.emptyText}>
                  Non hai ancora inserito incarichi. Usa il pulsante “+” per crearne uno.
                </Text>
              </View>
            ) : (
              incarichi.map((incarico) => {
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
                    onPress={() => router.push(`/configuratore/job?jobId=${encodeURIComponent(incarico.id)}`)}
                    style={({ pressed }) => [styles.incaricoCard, pressed && styles.incaricoCardPressed]}
                  >
                    <View style={styles.incaricoHeader}>
                      <Text style={styles.incaricoTitle}>{titolo}</Text>
                      <Text style={styles.incaricoTime}>
                        {incarico.data} · {incarico.oraInizio} - {incarico.oraFine}
                      </Text>
                    </View>
                    <View style={styles.incaricoRow}>
                      <Ionicons name="location-outline" size={16} color="#2563eb" />
                      <Text style={styles.incaricoDetail}>
                        {incarico.indirizzo.via}, {incarico.indirizzo.civico} · {incarico.indirizzo.citta}
                        {' '}- {incarico.indirizzo.provincia} {incarico.indirizzo.cap}
                      </Text>
                    </View>
                    <View style={styles.incaricoRow}>
                      <Ionicons name="cash-outline" size={16} color="#16a34a" />
                      <Text style={styles.incaricoDetail}>
                        {incarico.compensoOrario > 0
                          ? `€ ${compensoFormattato} / ora`
                          : 'Compenso non specificato'}
                      </Text>
                    </View>
                    <ApplicantsCount jobId={incarico.id} />
                    <Text style={styles.incaricoDescription}>{incarico.descrizione}</Text>
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>

        <BottomNav />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 120,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    marginTop: 8,
  },
  cardGrid: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
  },
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  profileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#e0f2fe',
    borderRadius: 16,
    padding: 18,
    marginTop: 26,
  },
  overviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 24,
    marginTop: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  overviewColumn: {
    flex: 1,
    gap: 4,
  },
  overviewLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  overviewSubValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  overviewDivider: {
    width: 1,
    height: 42,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 16,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  summaryMeta: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 14,
  },
  cardText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 6,
    lineHeight: 20,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: 18,
    padding: 20,
    marginTop: 28,
  },
  bannerIcon: {
    backgroundColor: '#bae6fd',
    borderRadius: 12,
    padding: 12,
    marginRight: 16,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
  },
  incarichiSection: {
    marginTop: 28,
    gap: 16,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  incaricoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    gap: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  incaricoHeader: {
    gap: 4,
  },
  incaricoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    textTransform: 'capitalize',
  },
  incaricoTime: {
    fontSize: 13,
    color: '#475569',
  },
  incaricoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  incaricoDetail: {
    fontSize: 14,
    color: '#1e293b',
    flex: 1,
  },
  incaricoDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  incaricoCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  applicantsBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  applicantsBadgeText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
  },
});

export default DatoreScreen;
