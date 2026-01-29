import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import BottomNav from './bottom-nav';
import { useProfile, type Incarico } from './profile-context';
import MapViewCrossPlatform from '../components/MapViewCrossPlatform';
import { useTheme, useThemedStyles } from './theme';
import { useUnreadConversations } from './use-unread-conversations';

const LavoratoreScreen: React.FC = () => {
  const router = useRouter();
  const { profile, loading, availableJobs, refreshAvailableJobs, applyToJob } = useProfile();
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));
  const unreadCount = useUnreadConversations();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Incarico | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!profile) {
      router.replace('/configuratore/landing');
      return;
    }
    if (profile.role !== 'lavoratore') {
      router.replace(`/configuratore/${profile.role}`);
    }
  }, [loading, profile, router]);

  const nomeCompleto = useMemo(() => {
    if (!profile) return '—';
    return `${profile.nome} ${profile.cognome}`.trim();
  }, [profile]);

  const incarichiDisponibili = useMemo(() => {
    return [...availableJobs]
      .map((item) => {
        const created = Date.parse(item.createdAt);
        return {
          item,
          created: Number.isFinite(created) ? created : 0,
        };
      })
      .sort((a, b) => b.created - a.created)
      .map(({ item }) => item);
  }, [availableJobs]);

  const totaleIncarichi = incarichiDisponibili.length;

  const handleRefresh = useCallback(async () => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    try {
      await refreshAvailableJobs();
    } catch (error) {
      console.warn('Failed to refresh available jobs:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, refreshAvailableJobs]);

  const handleOpenJob = useCallback((job: Incarico) => {
    setSelectedJob(job);
  }, []);

  const handleCloseJob = useCallback(() => {
    setSelectedJob(null);
  }, []);

  const handlePropose = useCallback(async () => {
    if (!selectedJob || applying) {
      return;
    }

    const title =
      selectedJob.tipo.categoria === 'altro'
        ? selectedJob.tipo.altroDettaglio ?? 'Altro'
        : selectedJob.tipo.categoria.charAt(0).toUpperCase() +
          selectedJob.tipo.categoria.slice(1);

    if (selectedJob.status === 'applied') {
      Alert.alert('Già candidata', `Hai già inviato la tua candidatura per "${title}".`);
      return;
    }

    setApplying(true);

    try {
      await applyToJob(selectedJob);
      handleCloseJob();
      Alert.alert('Candidatura inviata', `Hai inviato la tua candidatura per "${title}".`);
    } catch (error) {
      const message =
        (error as Error)?.message ?? 'Non è stato possibile inviare la candidatura. Riprova.';
      Alert.alert('Errore', message);
    } finally {
      setApplying(false);
    }
  }, [selectedJob, applying, applyToJob, handleCloseJob]);

  const initialRegion = useMemo(
    () => ({
      // Milan center with a delta that covers the metropolitan area
      latitude: 45.4642,
      longitude: 9.1900,
      latitudeDelta: 0.6,
      longitudeDelta: 0.8,
    }),
    []
  );

  // Important: keep hooks order stable across renders (even when logging out)
  if (!profile || profile.role !== 'lavoratore') {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#2563eb"
              colors={["#2563eb"]}
            />
          }
        >
          <View style={styles.headerRow}>
            <View style={styles.headerTextBlock}>
              <Text style={styles.greeting}>Ciao {nomeCompleto}</Text>
              <Text style={styles.subtitle}>
                Benvenuto! Qui trovi un riepilogo dei tuoi prossimi incarichi e l'area per la mappa.
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

          <View style={styles.actionsRow}>
            <Pressable
              style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
              onPress={() => router.push('/configuratore/proposte')}
            >
              <Ionicons name="mail-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.actionText}>Proposte</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
              onPress={() => router.push('/configuratore/worker-hires')}
            >
              <Ionicons name="briefcase-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.actionText}>I miei incarichi</Text>
            </Pressable>
          </View>

          <View style={styles.mapWrapper}>
            <MapViewCrossPlatform
              center={{ lat: initialRegion.latitude, lng: initialRegion.longitude }}
              zoom={initialRegion.latitudeDelta > 1 ? 6 : 12}
              style={styles.map}
              markers={incarichiDisponibili
                .map((job) => {
                  const coords = (job as unknown as { location?: { lat?: number; lng?: number } }).location;
                  if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
                    return null;
                  }
                  const title =
                    job.tipo.categoria === 'altro'
                      ? job.tipo.altroDettaglio ?? 'Altro'
                      : job.tipo.categoria.charAt(0).toUpperCase() + job.tipo.categoria.slice(1);
                  return {
                    id: job.id,
                    lat: coords.lat,
                    lng: coords.lng,
                    title,
                    description: `${job.data} · ${job.oraInizio}`,
                  };
                })
                .filter((item): item is { id: string; lat: number; lng: number; title?: string; description?: string } => !!item)}
            />
            <Text style={styles.mapCaption}>
              Base cartografica OpenStreetMap: puoi pizzicare o trascinare per esplorare.
              I punti compariranno appena saranno disponibili le coordinate degli incarichi.
            </Text>
          </View>

          <View style={styles.overviewCard}>
            <View style={styles.overviewColumn}>
              <Text style={styles.overviewLabel}>Totale incarichi</Text>
              <Text style={styles.overviewValue}>{totaleIncarichi}</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewColumn}>
              <Text style={styles.overviewLabel}>Disponibilità</Text>
              <Text style={styles.overviewSubValue}>Aggiorna la tua agenda</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Incarichi disponibili</Text>
            {incarichiDisponibili.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="briefcase-outline" size={24} color="#64748b" />
                <Text style={styles.emptyText}>
                  Nessun incarico disponibile al momento. Controlla di nuovo più tardi per nuove opportunità.
                </Text>
              </View>
            ) : (
              incarichiDisponibili.map((incarico) => {
                const dateString = `${incarico.data}T${incarico.oraInizio}:00`;
                const localized = new Date(dateString);
                const formattedDate = Number.isNaN(localized.getTime())
                  ? incarico.data
                  : localized.toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    });
                const formattedTime = Number.isNaN(localized.getTime())
                  ? incarico.oraInizio
                  : localized.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                const titolo =
                  incarico.tipo.categoria === 'altro'
                    ? incarico.tipo.altroDettaglio ?? 'Altro'
                    : incarico.tipo.categoria.charAt(0).toUpperCase() +
                      incarico.tipo.categoria.slice(1);

                return (
                  <Pressable
                    key={incarico.id}
                    onPress={() => handleOpenJob(incarico)}
                    style={({ pressed }) => [
                      styles.incaricoCard,
                      pressed && styles.incaricoCardPressed,
                    ]}
                  >
                    <Text style={styles.incaricoTitle}>{titolo}</Text>
                    <Text style={styles.incaricoMeta}>
                      {formattedDate} · {formattedTime}
                    </Text>
                    <View style={styles.row}>
                      <Ionicons name="location-outline" size={16} color="#2563eb" />
                      <Text style={styles.rowText}>
                        {incarico.indirizzo.via}, {incarico.indirizzo.citta} ({incarico.indirizzo.provincia})
                      </Text>
                    </View>
                    <View style={styles.row}>
                      <Ionicons name="cash-outline" size={16} color="#16a34a" />
                      <Text style={styles.rowText}>
                        {incarico.compensoOrario > 0
                          ? `€ ${incarico.compensoOrario.toLocaleString('it-IT', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} / ora`
                          : 'Compenso non specificato'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>

      <BottomNav flushToBottom />
      </View>

      <Modal
        visible={!!selectedJob}
        transparent
        animationType="slide"
        onRequestClose={handleCloseJob}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedJob && (
              <>
                <Text style={styles.modalTitle}>
                  {selectedJob.tipo.categoria === 'altro'
                    ? selectedJob.tipo.altroDettaglio ?? 'Altro'
                    : selectedJob.tipo.categoria.charAt(0).toUpperCase() +
                      selectedJob.tipo.categoria.slice(1)}
                </Text>
                <Text style={styles.modalMeta}>
                  {selectedJob.data} · {selectedJob.oraInizio} - {selectedJob.oraFine}
                </Text>
                <View style={styles.modalRow}>
                  <Ionicons name="location-outline" size={18} color="#2563eb" />
                  <Text style={styles.modalRowText}>
                    {selectedJob.indirizzo.via}, {selectedJob.indirizzo.civico} · {selectedJob.indirizzo.citta} ({selectedJob.indirizzo.provincia}) {selectedJob.indirizzo.cap}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Ionicons name="cash-outline" size={18} color="#16a34a" />
                  <Text style={styles.modalRowText}>
                    {selectedJob.compensoOrario > 0
                      ? `€ ${selectedJob.compensoOrario.toLocaleString('it-IT', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} / ora`
                      : 'Compenso non specificato'}
                  </Text>
                </View>
                {selectedJob.descrizione ? (
                  <Text style={styles.modalDescription}>{selectedJob.descrizione}</Text>
                ) : null}

                <View style={styles.modalActions}>
                  <Pressable
                    style={[
                      styles.modalButton,
                      styles.modalPrimary,
                      (applying || selectedJob.status === 'applied') && styles.modalButtonDisabled,
                    ]}
                    onPress={handlePropose}
                    disabled={applying || selectedJob.status === 'applied'}
                  >
                    {applying ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.modalPrimaryText}>
                        {selectedJob.status === 'applied'
                          ? 'Candidatura inviata'
                          : 'Proponi candidatura'}
                      </Text>
                    )}
                  </Pressable>
                  <Pressable style={[styles.modalButton, styles.modalSecondary]} onPress={handleCloseJob}>
                    <Text style={styles.modalSecondaryText}>Torna alla home</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (t: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: t.colors.background },
    container: { flex: 1, backgroundColor: t.colors.background },
    scrollContent: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120, gap: 24 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerTextBlock: { flex: 1, gap: 6 },
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
    badgeText: { color: t.colors.surface, fontSize: 11, fontWeight: '700' },
    iconButtonPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
    actionsRow: { flexDirection: 'row', gap: 12 },
    actionCard: {
      flex: 1,
      backgroundColor: t.colors.surface,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    actionCardPressed: { transform: [{ scale: 0.98 }] },
    actionText: { fontSize: 13, fontWeight: '600', color: t.colors.textPrimary },
    greeting: { fontSize: 26, fontWeight: '700', color: t.colors.textPrimary },
    subtitle: { fontSize: 16, color: t.colors.textSecondary, lineHeight: 22 },
    mapCaption: { marginTop: 8, fontSize: 12, color: t.colors.textSecondary, textAlign: 'center', backgroundColor: t.colors.surface },
    mapWrapper: { marginTop: 12, borderRadius: 18, overflow: 'hidden', height: 220, backgroundColor: t.colors.border },
    map: { flex: 1 },
    overviewCard: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface, borderRadius: 18,
      paddingVertical: 18, paddingHorizontal: 24, shadowColor: t.colors.shadow, shadowOpacity: 0.08,
      shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
    },
    overviewColumn: { flex: 1, gap: 4 },
    overviewLabel: { fontSize: 13, color: t.colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
    overviewValue: { fontSize: 24, fontWeight: '700', color: t.colors.textPrimary },
    overviewSubValue: { fontSize: 14, fontWeight: '600', color: t.colors.textPrimary },
    overviewDivider: { width: 1, height: 42, backgroundColor: t.colors.border, marginHorizontal: 16 },
    section: { gap: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: t.colors.textPrimary },
    emptyState: {
      backgroundColor: t.colors.surface, borderRadius: 18, padding: 20, alignItems: 'center', gap: 12,
      shadowColor: t.colors.shadow, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
    },
    emptyText: { fontSize: 14, color: t.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
    incaricoCard: {
      backgroundColor: t.colors.surface, borderRadius: 18, padding: 18, gap: 8, shadowColor: t.colors.shadow,
      shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
    },
    incaricoTitle: { fontSize: 16, fontWeight: '700', color: t.colors.textPrimary },
    incaricoMeta: { fontSize: 13, color: t.colors.textSecondary },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowText: { fontSize: 14, color: t.colors.textPrimary, flex: 1 },
    incaricoCardPressed: { transform: [{ scale: 0.98 }] },
    modalBackdrop: { flex: 1, backgroundColor: t.colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 },
    modalCard: { width: '100%', borderRadius: 20, backgroundColor: t.colors.surface, padding: 24, gap: 16 },
    modalTitle: { fontSize: 22, fontWeight: '700', color: t.colors.textPrimary },
    modalMeta: { fontSize: 14, color: t.colors.textSecondary, fontWeight: '600' },
    modalRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    modalRowText: { flex: 1, fontSize: 14, color: t.colors.textPrimary },
    modalDescription: { fontSize: 14, color: t.colors.textSecondary, lineHeight: 20 },
    modalActions: { flexDirection: 'row', gap: 12 },
    modalButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    modalPrimary: { backgroundColor: t.colors.primary },
    modalButtonDisabled: { opacity: 0.6 },
    modalPrimaryText: { fontSize: 15, fontWeight: '600', color: t.colors.surface },
    modalSecondary: { backgroundColor: t.colors.border },
    modalSecondaryText: { fontSize: 15, fontWeight: '600', color: t.colors.textPrimary },
  });

export default LavoratoreScreen;
