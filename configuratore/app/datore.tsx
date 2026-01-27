import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import BottomNav from './bottom-nav';
import { useProfile } from './profile-context';
import { useUnreadConversations } from './use-unread-conversations';

import { db, ensureSignedIn } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useTheme, useThemedStyles } from './theme';
import { deleteJobAndRelated } from '../lib/api';

const ApplicantsCount = ({ jobId }: { jobId: string }) => {
  const styles = useThemedStyles((t) => createStyles(t));
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
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));
  const unreadCount = useUnreadConversations();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentUid, setCurrentUid] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    const loadUid = async () => {
      try {
        const uid = await ensureSignedIn();
        if (!cancelled) setCurrentUid(uid);
      } catch {
        if (!cancelled) setCurrentUid(null);
      }
    };
    void loadUid();
    return () => { cancelled = true; };
  }, []);

  const nomeCompleto = useMemo(() => {
    if (!profile) return '—';
    return `${profile.nome} ${profile.cognome}`.trim();
  }, [profile]);

  const totaleIncarichi = incarichi.length;

  const handleDeleteJob = (jobId: string) => {
    if (deletingId) return;
    Alert.alert(
      'Elimina incarico',
      'Sei sicuro? Questa azione è irreversibile.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(jobId);
              await deleteJobAndRelated(jobId);
            } catch (error) {
              const message =
                (error as Error)?.message ?? "Non e' stato possibile eliminare l'incarico.";
              Alert.alert('Errore', message);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerTextBlock}>
              <Text style={styles.greeting}>Ciao {nomeCompleto}</Text>
              <Text style={styles.subtitle}>
                Benvenuto nella tua area Datore. Qui puoi gestire incarichi e
                collaboratori.
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Vai ai messaggi"
              onPress={() => router.push('/configuratore/chat')}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.colors.textPrimary} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </Pressable>
          </View>

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

          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.incaricoCardPressed]}
            onPress={() => router.push('/configuratore/hires')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="briefcase-outline" size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Assunzioni</Text>
              <Text style={styles.actionSubtitle}>Gestisci proposte e incarichi confermati.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
          </Pressable>

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
            <Ionicons name="person-outline" size={22} color={theme.colors.primary} />
            <View>
              <Text style={styles.summaryLabel}>Profilo</Text>
              <Text style={styles.summaryValue}>{nomeCompleto}</Text>
              <Text style={styles.summaryMeta}>
                Data di nascita: {profile.dataNascita}
              </Text>
            </View>
          </View>

          <View style={styles.incarichiSection}>
            <Text style={styles.sectionHeading}>I tuoi incarichi</Text>
            {incarichi.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="briefcase-outline" size={26} color={theme.colors.muted} />
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
                const isDeleting = deletingId === incarico.id;
                const canDeleteJob = !incarico.ownerUid || incarico.ownerUid === currentUid;
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
                      <Ionicons name="location-outline" size={16} color={theme.colors.primary} />
                      <Text style={styles.incaricoDetail}>
                        {incarico.indirizzo.via}, {incarico.indirizzo.civico} · {incarico.indirizzo.citta}
                        {' '}- {incarico.indirizzo.provincia} {incarico.indirizzo.cap}
                      </Text>
                    </View>
                    <View style={styles.incaricoRow}>
                      <Ionicons name="cash-outline" size={16} color={theme.colors.success} />
                      <Text style={styles.incaricoDetail}>
                        {incarico.compensoOrario > 0
                          ? `€ ${compensoFormattato} / ora`
                          : 'Compenso non specificato'}
                      </Text>
                    </View>
                    <ApplicantsCount jobId={incarico.id} />
                    <Text style={styles.incaricoDescription}>{incarico.descrizione}</Text>
                    {canDeleteJob ? (
                      <Pressable
                        style={({ pressed }) => [
                          styles.deleteButton,
                          pressed && styles.deleteButtonPressed,
                          isDeleting && styles.deleteButtonDisabled,
                        ]}
                        onPress={() => handleDeleteJob(incarico.id)}
                        disabled={isDeleting}
                        accessibilityRole="button"
                        accessibilityLabel="Elimina incarico"
                      >
                        <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                        <Text style={styles.deleteButtonText}>
                          {isDeleting ? 'Eliminazione...' : 'Elimina incarico'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>

        <BottomNav flushToBottom />
      </View>
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
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 120,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerTextBlock: {
      flex: 1,
      gap: 6,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    iconButtonPressed: {
      transform: [{ scale: 0.97 }],
      opacity: 0.9,
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: t.colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeText: {
      color: t.colors.surface,
      fontSize: 11,
      fontWeight: '700',
    },
    greeting: {
      fontSize: 26,
      fontWeight: '700',
      color: t.colors.textPrimary,
    },
    subtitle: {
      fontSize: 16,
      color: t.colors.textSecondary,
      marginTop: 8,
    },
    cardGrid: {
      flexDirection: 'row',
      gap: 16,
      marginTop: 24,
    },
    card: {
      flex: 1,
      backgroundColor: t.colors.surface,
      padding: 18,
      borderRadius: 16,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    profileSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: t.colors.card,
      borderRadius: 16,
      padding: 18,
      marginTop: 26,
    },
    overviewCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.surface,
      borderRadius: 18,
      paddingVertical: 18,
      paddingHorizontal: 24,
      marginTop: 20,
      shadowColor: t.colors.shadow,
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
      color: t.colors.muted,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    overviewValue: {
      fontSize: 24,
      fontWeight: '700',
      color: t.colors.textPrimary,
    },
    overviewSubValue: {
      fontSize: 14,
      fontWeight: '600',
      color: t.colors.textPrimary,
    },
    overviewDivider: {
      width: 1,
      height: 42,
      backgroundColor: t.colors.border,
      marginHorizontal: 16,
    },
    actionCard: {
      marginTop: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: t.colors.surface,
      borderRadius: 18,
      padding: 16,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    actionIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: t.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionText: {
      flex: 1,
      gap: 4,
    },
    actionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: t.colors.textPrimary,
    },
    actionSubtitle: {
      fontSize: 13,
      color: t.colors.textSecondary,
    },
    summaryLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: t.colors.textPrimary,
    },
    summaryValue: {
      fontSize: 16,
      fontWeight: '700',
      color: t.colors.textPrimary,
      marginTop: 2,
    },
    summaryMeta: {
      fontSize: 13,
      color: t.colors.textSecondary,
      marginTop: 4,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: t.colors.textPrimary,
      marginTop: 14,
    },
    cardText: {
      fontSize: 14,
      color: t.colors.textSecondary,
      marginTop: 6,
      lineHeight: 20,
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.card,
      borderRadius: 18,
      padding: 20,
      marginTop: 28,
    },
    bannerIcon: {
      backgroundColor: t.colors.surface,
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
      color: t.colors.textPrimary,
    },
    bannerSubtitle: {
      fontSize: 14,
      color: t.colors.textSecondary,
      marginTop: 4,
    },
    incarichiSection: {
      marginTop: 28,
      gap: 16,
    },
    sectionHeading: {
      fontSize: 18,
      fontWeight: '700',
      color: t.colors.textPrimary,
    },
    emptyState: {
      backgroundColor: t.colors.surface,
      borderRadius: 18,
      padding: 20,
      alignItems: 'center',
      gap: 12,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    emptyText: {
      fontSize: 14,
      color: t.colors.textSecondary,
      textAlign: 'center',
    },
    incaricoCard: {
      backgroundColor: t.colors.surface,
      borderRadius: 18,
      padding: 18,
      gap: 8,
      shadowColor: t.colors.shadow,
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
      color: t.colors.textPrimary,
      textTransform: 'capitalize',
    },
    incaricoTime: {
      fontSize: 13,
      color: t.colors.textSecondary,
    },
    incaricoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    incaricoDetail: {
      fontSize: 14,
      color: t.colors.textPrimary,
      flex: 1,
    },
    incaricoDescription: {
      fontSize: 14,
      color: t.colors.textSecondary,
      lineHeight: 20,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.danger,
    },
    deleteButtonPressed: {
      opacity: 0.7,
    },
    deleteButtonDisabled: {
      opacity: 0.5,
    },
    deleteButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: t.colors.danger,
    },
    incaricoCardPressed: {
      transform: [{ scale: 0.98 }],
    },
    applicantsBadge: {
      marginTop: 8,
      alignSelf: 'flex-start',
      backgroundColor: t.colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    applicantsBadgeText: {
      fontSize: 12,
      color: t.colors.textPrimary,
      fontWeight: '600',
    },
  });

export default DatoreScreen;
