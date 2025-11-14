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
import MapView, { Marker, PROVIDER_DEFAULT, UrlTile, type Region } from 'react-native-maps';

import BottomNav from './bottom-nav';
import { useProfile, type Incarico } from './profile-context';
import MapPin from '../components/map-pin';

const LavoratoreScreen: React.FC = () => {
  const router = useRouter();
  const { profile, loading, availableJobs, refreshAvailableJobs, applyToJob } = useProfile();
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

  const initialRegion: Region = useMemo(
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
          <Text style={styles.greeting}>Ciao {nomeCompleto}</Text>
          <Text style={styles.subtitle}>
            Benvenuto! Qui trovi un riepilogo dei tuoi prossimi incarichi e l'area per la mappa.
          </Text>

          <View style={styles.mapWrapper}>
            <MapView
              provider={PROVIDER_DEFAULT}
              style={styles.map}
              showsUserLocation
              showsMyLocationButton
              loadingEnabled
              initialRegion={initialRegion}
            >
              <UrlTile
                urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maximumZ={19}
                tileSize={256}
              />
              {incarichiDisponibili.map((job) => {
                const coords = (job as unknown as { location?: { lat?: number; lng?: number } }).location;
                if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
                  return null;
                }

                const title =
                  job.tipo.categoria === 'altro'
                    ? job.tipo.altroDettaglio ?? 'Altro'
                    : job.tipo.categoria.charAt(0).toUpperCase() + job.tipo.categoria.slice(1);

                return (
                  <Marker
                    key={job.id}
                    coordinate={{ latitude: coords.lat, longitude: coords.lng }}
                    title={title}
                    description={`${job.data} · ${job.oraInizio}`}
                    tracksViewChanges={false}
                    anchor={{ x: 0.5, y: 1 }}
                  >
                    <MapPin />
                  </Marker>
                );
              })}
            </MapView>
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

        <BottomNav />
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
    gap: 24,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  mapCaption: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  mapWrapper: {
    marginTop: 12,
    borderRadius: 18,
    overflow: 'hidden',
    height: 220,
    backgroundColor: '#e2e8f0',
  },
  map: {
    flex: 1,
  },
  overviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 24,
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
  section: {
    gap: 16,
  },
  sectionTitle: {
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
    lineHeight: 20,
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
  incaricoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  incaricoMeta: {
    fontSize: 13,
    color: '#475569',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowText: {
    fontSize: 14,
    color: '#1e293b',
    flex: 1,
  },
  incaricoCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalMeta: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  modalRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  modalRowText: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
  },
  modalDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimary: {
    backgroundColor: '#2563eb',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalSecondary: {
    backgroundColor: '#e2e8f0',
  },
  modalSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
});

export default LavoratoreScreen;
