import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MapView, {
  Marker,
  Callout,
  PROVIDER_DEFAULT,
  UrlTile,
  type Region,
} from 'react-native-maps';

import BottomNav from './bottom-nav';
import { useProfile, type Incarico } from './profile-context';
import MapPin from '../components/map-pin';

const MapScreen: React.FC = () => {
  const router = useRouter();
  const { profile, loading, availableJobs } = useProfile();

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

  const jobsWithLocation = useMemo(
    () =>
      availableJobs.filter(
        (job): job is Incarico & { location: { lat: number; lng: number } } =>
          Boolean(job.location && typeof job.location.lat === 'number' && typeof job.location.lng === 'number')
      ),
    [availableJobs]
  );

  const initialRegion: Region = useMemo(() => {
    if (jobsWithLocation.length > 0) {
      const first = jobsWithLocation[0].location;
      return {
        latitude: first.lat,
        longitude: first.lng,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      };
    }
    return {
      latitude: 41.9028,
      longitude: 12.4964,
      latitudeDelta: 2,
      longitudeDelta: 2,
    };
  }, [jobsWithLocation]);

  const provider = Platform.OS === 'android' ? PROVIDER_DEFAULT : undefined;

  // Keep hooks order stable across renders to avoid hook mismatch on logout
  if (!profile || profile.role !== 'lavoratore') {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <MapView
          provider={provider}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton
          loadingEnabled
        >
          <UrlTile
            urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
            tileSize={256}
          />
          {jobsWithLocation.map((job) => {
            const titolo =
              job.tipo.categoria === 'altro'
                ? job.tipo.altroDettaglio ?? 'Altro'
                : job.tipo.categoria.charAt(0).toUpperCase() + job.tipo.categoria.slice(1);

            return (
              <Marker
                key={job.id}
                coordinate={{ latitude: job.location.lat, longitude: job.location.lng }}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 1 }}
              >
                <MapPin />
                <Callout tooltip>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>{titolo}</Text>
                    <Text style={styles.calloutSubtitle}>
                      {job.data} · {job.oraInizio}
                    </Text>
                    <Text style={styles.calloutDescription} numberOfLines={2}>
                      {job.descrizione || 'Nessuna descrizione'}
                    </Text>
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>

        {jobsWithLocation.length === 0 && (
          <View style={styles.emptyOverlay} pointerEvents="none">
            <Text style={styles.emptyTitle}>Nessuna posizione disponibile</Text>
            <Text style={styles.emptySubtitle}>
              Quando gli incarichi avranno coordinate precise, li vedrai comparire qui.
            </Text>
          </View>
        )}

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
  map: {
    flex: 1,
  },
  calloutContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    width: 220,
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  calloutSubtitle: {
    fontSize: 13,
    color: '#2563eb',
    marginTop: 4,
  },
  calloutDescription: {
    fontSize: 13,
    color: '#475569',
    marginTop: 6,
  },
  emptyOverlay: {
    position: 'absolute',
    top: 80,
    left: 24,
    right: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(248, 250, 252, 0.92)',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
});

export default MapScreen;
