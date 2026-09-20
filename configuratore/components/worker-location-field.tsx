import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';

import { useTheme, useThemedStyles } from '../app/theme';
import {
  reverseWorkerLocation,
  searchWorkerLocations,
  WORK_RADIUS_OPTIONS,
  type WorkerWorkLocation,
  type WorkerWorkRadius,
} from '../lib/worker-location';
import IconTextInput from './icon-text-input';
import JoblyIcon from './jobly-icon';
import { useJoblyDialog } from './jobly-dialog';

type WorkerLocationFieldProps = {
  location: WorkerWorkLocation | null;
  radiusKm: WorkerWorkRadius;
  onLocationChange: (location: WorkerWorkLocation | null) => void;
  onRadiusChange: (radius: WorkerWorkRadius) => void;
};

const WorkerLocationField: React.FC<WorkerLocationFieldProps> = ({
  location,
  radiusKm,
  onLocationChange,
  onRadiusChange,
}) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { showDialog } = useJoblyDialog();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [results, setResults] = useState<WorkerWorkLocation[]>([]);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!focused || trimmedQuery.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      void searchWorkerLocations(trimmedQuery, controller.signal)
        .then(setResults)
        .catch((error) => {
          if ((error as Error).name !== 'AbortError') setResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [focused, query]);

  useEffect(() => () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
  }, []);

  const cancelPendingBlur = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  };

  const selectLocation = (nextLocation: WorkerWorkLocation) => {
    cancelPendingBlur();
    onLocationChange(nextLocation);
    setQuery('');
    setResults([]);
    setFocused(false);
  };

  const useCurrentLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        showDialog('Posizione non disponibile', 'Consenti l’accesso alla posizione oppure cerca manualmente una città.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const resolved = await reverseWorkerLocation(current.coords.latitude, current.coords.longitude);
      onLocationChange(resolved);
      setQuery('');
      setResults([]);
      setFocused(false);
    } catch {
      showDialog('Errore posizione', 'Non è stato possibile rilevare la posizione. Cerca manualmente una città.');
    } finally {
      setLocating(false);
    }
  };

  const suggestionsVisible = focused && query.trim().length >= 2;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Zona di lavoro</Text>
      <Pressable
        style={({ pressed }) => [styles.currentButton, pressed && styles.pressed]}
        onPress={() => void useCurrentLocation()}
        disabled={locating}
        accessibilityRole="button"
        accessibilityLabel="Usa la mia posizione attuale"
        accessibilityState={{ busy: locating, disabled: locating }}
      >
        {locating ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <JoblyIcon name="navigate-circle-outline" size="medium" color={theme.colors.primary} />
        )}
        <Text style={styles.currentButtonText}>{locating ? 'Rilevamento...' : 'Usa la mia posizione'}</Text>
      </Pressable>

      <Text style={styles.orText}>oppure cerca manualmente</Text>
      <IconTextInput
        icon="location-outline"
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          if (text.trim().length >= 2) setFocused(true);
        }}
        placeholder="Cerca città o località"
        autoCapitalize="words"
        autoCorrect={false}
        onFocus={() => {
          cancelPendingBlur();
          setFocused(true);
        }}
        onBlur={() => {
          blurTimeoutRef.current = setTimeout(() => setFocused(false), 150);
        }}
        onSubmitEditing={() => {
          if (results[0]) selectLocation(results[0]);
        }}
      />

      {suggestionsVisible ? (
        <ScrollView
          style={styles.results}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          {searching ? <ActivityIndicator style={styles.searching} color={theme.colors.primary} /> : null}
          {!searching && results.length === 0 ? (
            <Text style={styles.emptyText}>Nessuna località trovata.</Text>
          ) : null}
          {results.map((result) => (
            <Pressable
              key={`${result.latitude}-${result.longitude}-${result.label}`}
              style={({ pressed, hovered }) => [styles.result, (pressed || hovered) && styles.resultActive]}
              onPressIn={cancelPendingBlur}
              onPress={() => selectLocation(result)}
              accessibilityRole="button"
              accessibilityLabel={`Seleziona ${result.label}`}
            >
              <JoblyIcon name="location" size="small" color={theme.colors.primary} />
              <Text style={styles.resultText} numberOfLines={2}>{result.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {location ? (
        <View style={styles.selectedLocation}>
          <JoblyIcon name="checkmark-circle" size="medium" color={theme.colors.success} />
          <View style={styles.selectedCopy}>
            <Text style={styles.selectedTitle}>{location.city || 'Località selezionata'}</Text>
            <Text style={styles.selectedText} numberOfLines={2}>{location.label}</Text>
          </View>
          <Pressable
            style={styles.clearButton}
            onPress={() => onLocationChange(null)}
            accessibilityRole="button"
            accessibilityLabel="Rimuovi posizione di lavoro"
          >
            <JoblyIcon name="close" size="standard" color={theme.colors.danger} />
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.label}>Raggio notifiche</Text>
      <View style={styles.radiusRow}>
        {WORK_RADIUS_OPTIONS.map((radius) => {
          const selected = radiusKm === radius;
          return (
            <Pressable
              key={radius}
              style={[styles.radiusButton, selected && styles.radiusButtonSelected]}
              onPress={() => onRadiusChange(radius)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Raggio ${radius} chilometri`}
            >
              <Text style={[styles.radiusText, selected && styles.radiusTextSelected]}>{radius} km</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>La posizione sarà usata solo per trovare opportunità nel raggio scelto.</Text>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: { gap: 10 },
    label: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600', marginTop: 4 },
    currentButton: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
    },
    currentButtonText: { color: theme.colors.primary, fontSize: 15, fontWeight: '700' },
    pressed: { opacity: 0.78 },
    orText: { color: theme.colors.muted, fontSize: 12, textAlign: 'center' },
    results: {
      maxHeight: 220,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
    },
    searching: { padding: 16 },
    emptyText: { color: theme.colors.muted, fontSize: 13, padding: 14, textAlign: 'center' },
    result: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    resultActive: { backgroundColor: theme.colors.card },
    resultText: { flex: 1, color: theme.colors.textPrimary, fontSize: 14 },
    selectedLocation: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.colors.success,
      borderRadius: 12,
      backgroundColor: theme.colors.card,
    },
    selectedCopy: { flex: 1 },
    selectedTitle: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '700' },
    selectedText: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
    clearButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    radiusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    radiusButton: {
      minWidth: 68,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
    },
    radiusButtonSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
    radiusText: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '600' },
    radiusTextSelected: { color: theme.colors.surface },
    hint: { color: theme.colors.muted, fontSize: 12, lineHeight: 17 },
  });

export default WorkerLocationField;
