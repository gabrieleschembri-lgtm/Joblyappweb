import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import BottomNav from './bottom-nav';
import { useProfile, type Incarico } from './profile-context';
import MapViewCrossPlatform from '../components/MapViewCrossPlatform';
import { useTheme, useThemedStyles } from './theme';

const MapScreen: React.FC = () => {
  const router = useRouter();
  const { profile, loading, availableJobs } = useProfile();
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));

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

  const initialRegion = useMemo(() => {
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


  // Keep hooks order stable across renders to avoid hook mismatch on logout
  if (!profile || profile.role !== 'lavoratore') {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.map}>
          <MapViewCrossPlatform
            center={{ lat: initialRegion.latitude, lng: initialRegion.longitude }}
            zoom={initialRegion.latitudeDelta > 1 ? 6 : 12}
            style={styles.map}
            markers={jobsWithLocation.map((job) => {
              const titolo =
                job.tipo.categoria === 'altro'
                  ? job.tipo.altroDettaglio ?? 'Altro'
                  : job.tipo.categoria.charAt(0).toUpperCase() + job.tipo.categoria.slice(1);
              return {
                id: job.id,
                lat: job.location.lat,
                lng: job.location.lng,
                title: titolo,
                description: `${job.data} · ${job.oraInizio}`,
              };
            })}
          />
        </View>

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
    map: {
      flex: 1,
    },
    emptyOverlay: {
      position: 'absolute',
      top: 80,
      left: 24,
      right: 24,
      padding: 16,
      borderRadius: 16,
      backgroundColor: t.colors.card,
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: t.colors.textPrimary,
    },
    emptySubtitle: {
      fontSize: 14,
      color: t.colors.textSecondary,
      textAlign: 'center',
    },
  });

export default MapScreen;
