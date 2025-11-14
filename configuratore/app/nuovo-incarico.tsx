import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useProfile } from './profile-context';

const tipoOptions = ['bar', 'pizzeria', 'ristorante', 'negozio', 'magazzino', 'altro'] as const;

type StepKey = 'quando' | 'dove' | 'compenso' | 'dettagli';

const steps: StepKey[] = ['quando', 'dove', 'compenso', 'dettagli'];

const stepMeta: Record<StepKey, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  quando: { label: 'Quando', icon: 'time-outline' },
  dove: { label: 'Dove', icon: 'location-outline' },
  compenso: { label: 'Compenso', icon: 'cash-outline' },
  dettagli: { label: 'Dettagli', icon: 'list-outline' },
};

const formatDate = (date: Date | null) => {
  if (!date) return 'Seleziona data';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTime = (date: Date | null) =>
  date
    ? date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    : 'Seleziona orario';

const startOfToday = () => {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return base;
};

const combineDateTime = (date: Date, time: Date) => {
  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined;
};

const roundToQuarterHour = (date: Date, strategy: 'ceil' | 'floor' | 'round' = 'ceil') => {
  const result = new Date(date);
  const minutes = result.getMinutes();
  const remainder = minutes % 15;
  if (strategy === 'floor') {
    if (remainder !== 0) {
      result.setMinutes(minutes - remainder);
    }
  } else if (strategy === 'round') {
    const quarters = Math.round(minutes / 15);
    result.setMinutes(quarters * 15);
  } else {
    if (remainder !== 0) {
      result.setMinutes(minutes + (15 - remainder));
    }
  }
  result.setSeconds(0, 0);
  return result;
};

const NuovoIncaricoScreen: React.FC = () => {
  const router = useRouter();
  const { profile, loading, addIncarico } = useProfile();

  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState<Date | null>(null);
  const [oraInizio, setOraInizio] = useState<Date | null>(null);
  const [oraFine, setOraFine] = useState<Date | null>(null);
  const [attivo, setAttivo] = useState<'data' | 'inizio' | 'fine' | null>(null);

  const [via, setVia] = useState('');
  const [civico, setCivico] = useState('');
  const [citta, setCitta] = useState('');
  const [provincia, setProvincia] = useState('');
  const [cap, setCap] = useState('');

  const [categoria, setCategoria] = useState<typeof tipoOptions[number] | undefined>(undefined);
  const [altroDettaglio, setAltroDettaglio] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [compenso, setCompenso] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<
    Array<{ label: string; lat: number; lng: number; address: Record<string, string> }>
  >([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (selectedLocation) {
      return;
    }

    const trimmed = addressQuery.trim();
    if (!trimmed) {
      if (via) setVia('');
      if (civico) setCivico('');
      if (citta) setCitta('');
      if (provincia) setProvincia('');
      if (cap) setCap('');
      return;
    }

    const parts = trimmed.split(',');
    const guessedStreet = parts[0]?.trim();
    const guessedCity = parts[1]?.trim();
    const guessedProvince = parts[2]?.trim();

    if (guessedStreet && via.trim().length === 0) {
      setVia(guessedStreet);
    }
    if (civico.trim().length === 0) {
      setCivico('1');
    }
    if (guessedCity && citta.trim().length === 0) {
      setCitta(guessedCity);
    }
    if (guessedProvince && provincia.trim().length === 0) {
      setProvincia(guessedProvince);
    }
  }, [addressQuery, selectedLocation, via, civico, citta, provincia, cap]);

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

  const stepLabel = useMemo(() => {
    const key = steps[stepIndex];
    switch (key) {
      case 'quando':
        return 'Quando?';
      case 'dove':
        return 'Dove si svolge?';
      case 'compenso':
        return 'Quanto verrà pagato?';
      case 'dettagli':
        return 'Dettagli incarico';
      default:
        return '';
    }
  }, [stepIndex]);

  const wordCount = useMemo(() => {
    const trimmed = descrizione.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [descrizione]);

  const compensoValue = useMemo(
    () => parseFloat(compenso.replace(',', '.')),
    [compenso]
  );
  const compensoIsValid = compenso.trim().length > 0 && Number.isFinite(compensoValue);

  const normalizeAddressField = (value: unknown): string =>
    typeof value === 'string' ? value : '';

  const fetchAddressSuggestions = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (trimmed.length < 3) {
        setAddressResults([]);
        setAddressLoading(false);
        return;
      }

      try {
        setAddressLoading(true);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=it&q=${encodeURIComponent(trimmed)}`,
          {
            headers: {
              'User-Agent': 'JoblyApp/1.0 (support@jobly.placeholder)',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Status ${response.status}`);
        }

        const data = (await response.json()) as Array<{
          display_name?: string;
          lat?: string;
          lon?: string;
          address?: Record<string, string>;
        }>;

        const mapped = (data ?? [])
          .map((entry) => {
            const lat = Number(entry.lat);
            const lng = Number(entry.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              return null;
            }
            return {
              label: entry.display_name ?? 'Indirizzo',
              lat,
              lng,
              address: entry.address ?? {},
            };
          })
          .filter(
            (item): item is {
              label: string;
              lat: number;
              lng: number;
              address: Record<string, string>;
            } => item !== null
          );

        setAddressResults(mapped);
      } catch (error) {
        console.warn('Address suggestions failed:', error);
        setAddressResults([]);
      } finally {
        setAddressLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      void fetchAddressSuggestions(addressQuery);
    }, 350);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [addressQuery, fetchAddressSuggestions]);

  const handleSelectAddress = (
    item: {
      label: string;
      lat: number;
      lng: number;
      address: Record<string, string>;
    }
  ) => {
    setAddressQuery(item.label);
    setAddressResults([]);

    const component = item.address;
    setVia(
      normalizeAddressField(
        component.road ||
          component.pedestrian ||
          component.footway ||
          component.cycleway ||
          component.residential
      )
    );
    const guessedNumber = normalizeAddressField(component.house_number);
    setCivico(guessedNumber.length > 0 ? guessedNumber : '1');
    setCitta(
      normalizeAddressField(
        component.city || component.town || component.village || component.municipality
      )
    );
    setProvincia(
      normalizeAddressField(component.state || component.region || component.province)
    );
    setCap(normalizeAddressField(component.postcode));
    setSelectedLocation({ lat: item.lat, lng: item.lng });
  };

  const canProceed = useMemo(() => {
    const key = steps[stepIndex];
    if (key === 'quando') {
      if (!data || !oraInizio || !oraFine) return false;
      const chosenDay = new Date(data);
      chosenDay.setHours(0, 0, 0, 0);
      if (chosenDay < startOfToday()) {
        return false;
      }
      const startDateTime = combineDateTime(data, oraInizio);
      const endDateTime = combineDateTime(data, oraFine);
      if (endDateTime <= startDateTime) {
        return false;
      }
      if (startDateTime < new Date()) {
        return false;
      }
      return true;
    }
    if (key === 'dove') {
      const hasAddressText = addressQuery.trim().length > 3;
      return hasAddressText;
    }
    if (key === 'compenso') {
      return compensoIsValid;
    }
    if (key === 'dettagli') {
      if (!categoria) return false;
      if (categoria === 'altro' && altroDettaglio.trim().length === 0) {
        return false;
      }
      if (!descrizione.trim()) return false;
      return wordCount <= 200;
    }
    return false;
  }, [
    stepIndex,
    data,
    oraInizio,
    oraFine,
    via,
    civico,
    citta,
    provincia,
    cap,
    compensoIsValid,
    categoria,
    altroDettaglio,
    descrizione,
    wordCount,
    selectedLocation,
    addressQuery,
  ]);

  const openPicker = (target: 'data' | 'inizio' | 'fine') => {
    setAttivo(target);
  };

  const handlePickerConfirm = (selected: Date) => {
    if (attivo === 'data') {
      const normalized = new Date(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
        0,
        0,
        0,
        0
      );
      setData(normalized);
    }
    if (attivo === 'inizio') {
      setOraInizio(roundToQuarterHour(selected));
    }
    if (attivo === 'fine') {
      setOraFine(roundToQuarterHour(selected));
    }
    setAttivo(null);
  };

  const handleCompensoChange = (value: string) => {
    const sanitized = value.replace(/[^0-9.,]/g, '');
    setCompenso(sanitized);
  };

  const handleNext = async () => {
    if (steps[stepIndex] !== 'dettagli') {
      setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
      return;
    }

    if (!profile) {
      Alert.alert('Errore', 'Nessun profilo attivo.');
      return;
    }

    if (wordCount > 200) {
      Alert.alert('Attenzione', 'La descrizione può contenere al massimo 200 parole.');
      return;
    }

    try {
      if (!data || !oraInizio || !oraFine) {
        throw new Error('Invalid date');
      }

      const chosenDay = new Date(data);
      chosenDay.setHours(0, 0, 0, 0);
      if (chosenDay < startOfToday()) {
        Alert.alert('Attenzione', 'La data deve essere oggi o futura.');
        return;
      }

      const startDateTime = combineDateTime(data, oraInizio);
      const endDateTime = combineDateTime(data, oraFine);
      if (startDateTime < new Date()) {
        Alert.alert('Attenzione', "L'orario di inizio deve essere nel futuro.");
        return;
      }
      if (endDateTime <= startDateTime) {
        Alert.alert('Attenzione', "L'orario di fine deve essere successivo all'inizio.");
        return;
      }

      if (!compensoIsValid) {
        Alert.alert('Attenzione', 'Inserisci un compenso orario valido.');
        return;
      }

      if (!categoria) {
        Alert.alert('Attenzione', 'Seleziona una categoria valida.');
        return;
      }
      const trimmedQuery = addressQuery.trim();
      let fallbackVia = via.trim();
      let fallbackCivico = civico.trim();
      let fallbackCity = citta.trim();
      let fallbackProvincia = provincia.trim();
      const fallbackCap = cap.trim();

      if (!fallbackVia && trimmedQuery) {
        fallbackVia = trimmedQuery.split(',')[0]?.trim() ?? trimmedQuery;
      }
      if (!fallbackCity && trimmedQuery.includes(',')) {
        fallbackCity = trimmedQuery.split(',')[1]?.trim() ?? '';
      }
      if (!fallbackProvincia && trimmedQuery.split(',').length >= 3) {
        fallbackProvincia = trimmedQuery.split(',')[2]?.trim() ?? '';
      }
      if (!fallbackCivico) {
        fallbackCivico = '1';
      }

      await addIncarico({
        data: formatDate(data),
        oraInizio: formatTime(oraInizio),
        oraFine: formatTime(oraFine),
        indirizzo: {
          via: fallbackVia,
          civico: fallbackCivico,
          citta: fallbackCity,
          provincia: fallbackProvincia,
          cap: fallbackCap,
        },
        tipo: {
          categoria: categoria,
          altroDettaglio: categoria === 'altro' ? altroDettaglio.trim() : undefined,
        },
        descrizione: descrizione.trim(),
        compensoOrario: compensoValue,
        location: selectedLocation ?? undefined,
      });
      Alert.alert('Successo', 'Incarico salvato con successo!', [
        {
          text: 'OK',
          onPress: () => router.replace('/configuratore/datore'),
        },
      ]);
    } catch (error) {
      Alert.alert('Errore', 'Non è stato possibile salvare l\'incarico.');
    }
  };

  const handleBack = () => {
    if (stepIndex === 0) {
      router.back();
    } else {
      setStepIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  if (!profile || profile.role !== 'datore') {
    return null;
  }

  const renderQuando = () => (
    <View style={styles.stepBox}>
      <View style={styles.summaryBox}>
        <Ionicons name="calendar-outline" size={18} color="#2563eb" />
        <Text style={styles.summaryText}>
          {data ? formatDate(data) : 'Data non selezionata'} · {formatTime(oraInizio)} → {formatTime(oraFine)}
          {compensoIsValid
            ? ` · € ${compensoValue.toLocaleString('it-IT', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}/ora`
            : ''}
        </Text>
      </View>
      <Text style={styles.stepDescription}>
        Scegli la data e l'orario di inizio e fine per questo incarico.
      </Text>

      <Pressable
        style={styles.selector}
        onPress={() => openPicker('data')}
        accessibilityRole="button"
      >
        <MaterialIcons name="event" size={22} color="#2563eb" />
        <Text style={styles.selectorLabel}>{formatDate(data)}</Text>
        <Ionicons name="chevron-down" size={18} color="#64748b" />
      </Pressable>

      <View style={styles.timeRow}>
        <Pressable
          style={[styles.selector, styles.timeSelector]}
          onPress={() => openPicker('inizio')}
          accessibilityRole="button"
        >
          <MaterialIcons name="schedule" size={22} color="#2563eb" />
          <Text style={styles.selectorValue}>{formatTime(oraInizio)}</Text>
          <Ionicons name="chevron-down" size={18} color="#64748b" />
        </Pressable>
        <Pressable
          style={[styles.selector, styles.timeSelector]}
          onPress={() => openPicker('fine')}
          accessibilityRole="button"
        >
          <MaterialIcons name="schedule" size={22} color="#2563eb" />
          <Text style={styles.selectorValue}>{formatTime(oraFine)}</Text>
          <Ionicons name="chevron-down" size={18} color="#64748b" />
        </Pressable>
      </View>

      {oraInizio && oraFine && oraFine <= oraInizio && (
        <Text style={styles.errorText}>
          L'orario di fine deve essere successivo all'orario di inizio.
        </Text>
      )}
    </View>
  );

  const renderDove = () => {
    const summaryText = via
      ? `${via}${civico ? ` ${civico}` : ''}, ${citta}${provincia ? ` (${provincia})` : ''} ${cap}`
      : addressQuery.trim().length > 0
        ? addressQuery
        : 'Seleziona un indirizzo per continuare';

    return (
      <View style={styles.stepBox}>
        <Text style={styles.stepDescription}>
          Inserisci l'indirizzo (Italia) e seleziona la voce corretta. In questo modo
          salveremo automaticamente le coordinate precise sulla mappa.
        </Text>

        <Text style={styles.label}>Cerca indirizzo</Text>
        <TextInput
          style={styles.input}
          value={addressQuery}
          onChangeText={(value) => {
            setAddressQuery(value);
            setSelectedLocation(null);
            setVia('');
            setCivico('');
            setCitta('');
            setProvincia('');
            setCap('');
          }}
          autoCapitalize="words"
          autoCorrect={false}
          placeholder="Es. Via Roma 10, Milano"
        />
        {addressLoading && (
          <Text style={styles.addressLoading}>Sto cercando indirizzi in Italia...</Text>
        )}
        {addressResults.length > 0 && (
          <View style={styles.addressResults}>
            {addressResults.map((result) => (
              <Pressable
                key={`${result.lat}-${result.lng}`}
                style={styles.addressResultItem}
                onPress={() => handleSelectAddress(result)}
              >
                <Text style={styles.addressResultText}>{result.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.addressSummaryBox}>
          <Ionicons name="location-outline" size={18} color="#2563eb" />
          <Text style={styles.addressSummaryText}>{summaryText}</Text>
        </View>

        {selectedLocation && (
          <Text style={styles.locationPreview}>
            Coordinate selezionate: lat {selectedLocation.lat.toFixed(6)}, lng{' '}
            {selectedLocation.lng.toFixed(6)}
          </Text>
        )}
      </View>
    );
  };

  const renderCompenso = () => (
    <View style={styles.stepBox}>
      <Text style={styles.stepDescription}>
        Indica il compenso orario previsto per il lavoratore.
      </Text>
      <View style={styles.compensoRow}>
        <View style={styles.currencyBadge}>
          <Text style={styles.currencyLabel}>€</Text>
        </View>
        <TextInput
          style={styles.compensoInput}
          value={compenso}
          onChangeText={handleCompensoChange}
          keyboardType="decimal-pad"
          placeholder="Es. 12"
          accessibilityLabel="Compenso orario"
          inputMode="decimal"
        />
        <Text style={styles.compensoSuffix}>/ora</Text>
      </View>
      {(!compenso || !compensoIsValid) && (
        <Text style={styles.errorText}>
          Inserisci un valore numerico valido (es. 12 oppure 9,50).
        </Text>
      )}
    </View>
  );

  const renderDettagli = () => (
    <View style={styles.stepBox}>
      <Text style={styles.stepDescription}>
        Scegli la tipologia di incarico e aggiungi una breve descrizione.
      </Text>

      <Text style={styles.label}>Tipo di incarico</Text>
      <View style={styles.chipRow}>
        {tipoOptions.map((option) => {
          const isSelected = categoria === option;
          return (
            <Pressable
              key={option}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => setCategoria(option)}
              accessibilityRole="button"
            >
              <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {categoria === 'altro' && (
        <TextInput
          style={styles.input}
          value={altroDettaglio}
          onChangeText={setAltroDettaglio}
          placeholder="Specifica il tipo di incarico"
        />
      )}

      <Text style={styles.label}>Descrizione (max 200 parole)</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={descrizione}
        onChangeText={setDescrizione}
        placeholder="Descrivi brevemente attività e requisiti"
        multiline
        numberOfLines={5}
      />
      <Text style={styles.counter}>{wordCount}/200 parole</Text>
    </View>
  );

  const currentStep = steps[stepIndex];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} accessibilityRole="button">
            <Ionicons name="chevron-back" size={26} color="#0f172a" />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.stepIndicator}>Passo {stepIndex + 1} di {steps.length}</Text>
            <Text style={styles.stepTitle}>{stepLabel}</Text>
          </View>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.stepperContainer}>
          {steps.map((key, index) => {
            const meta = stepMeta[key];
            const isActive = index === stepIndex;
            const isCompleted = index < stepIndex;
            const circleStyle = [
              styles.stepCircle,
              isActive && styles.stepCircleActive,
              isCompleted && styles.stepCircleCompleted,
            ];
            const labelStyle = [
              styles.stepperLabel,
              (isActive || isCompleted) && styles.stepperLabelActive,
            ];
            return (
              <Fragment key={key}>
                <View style={styles.stepperItem}>
                  <View style={circleStyle}>
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={16} color="#ffffff" />
                    ) : (
                      <Ionicons
                        name={meta.icon}
                        size={16}
                        color={isActive ? '#ffffff' : '#64748b'}
                      />
                    )}
                  </View>
                  <Text style={labelStyle}>{meta.label}</Text>
                </View>
                {index < steps.length - 1 && (
                  <View
                    style={[
                      styles.stepperConnector,
                      isCompleted && styles.stepperConnectorActive,
                    ]}
                  />
                )}
              </Fragment>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {currentStep === 'quando' && renderQuando()}
          {currentStep === 'dove' && renderDove()}
          {currentStep === 'compenso' && renderCompenso()}
          {currentStep === 'dettagli' && renderDettagli()}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.footerButton, styles.secondaryButton]}
            onPress={handleBack}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryLabel}>{stepIndex === 0 ? 'Annulla' : 'Indietro'}</Text>
          </Pressable>
          <Pressable
            style={[styles.footerButton, canProceed ? styles.primaryButton : styles.disabledButton]}
            onPress={canProceed ? handleNext : undefined}
            accessibilityRole="button"
          >
            <Text style={styles.primaryLabel}>
              {currentStep === 'dettagli' ? 'Salva incarico' : 'Continua'}
            </Text>
          </Pressable>
        </View>
      </View>

      <DateTimePickerModal
        isVisible={attivo !== null}
        mode={attivo === 'data' ? 'date' : 'time'}
        minuteInterval={attivo === 'data' ? undefined : 15}
        minimumDate={(() => {
          if (attivo === 'data') {
            return startOfToday();
          }
          if (!data) {
            return new Date();
          }
          const todayStart = startOfToday();
          const selectedDay = new Date(data);
          selectedDay.setHours(0, 0, 0, 0);

          if (attivo === 'inizio') {
            if (selectedDay.getTime() <= todayStart.getTime()) {
              return roundToQuarterHour(new Date());
            }
            return roundToQuarterHour(selectedDay);
          }

          if (attivo === 'fine') {
            if (oraInizio) {
              const base = roundToQuarterHour(combineDateTime(data, oraInizio));
              if (base < new Date()) {
                return roundToQuarterHour(new Date());
              }
              const copy = new Date(base.getTime());
              copy.setMinutes(copy.getMinutes() + 15);
              return copy;
            }
            if (selectedDay.getTime() <= todayStart.getTime()) {
              return roundToQuarterHour(new Date());
            }
            return roundToQuarterHour(selectedDay);
          }

          return undefined;
        })()}
        is24Hour
        date={(() => {
          const now = new Date();
          if (attivo === 'data') {
            return data ?? now;
          }
          if (attivo === 'inizio') {
            return oraInizio ? roundToQuarterHour(oraInizio) : roundToQuarterHour(now);
          }
          if (attivo === 'fine') {
            if (oraFine) return roundToQuarterHour(oraFine);
            if (oraInizio) {
              const base = roundToQuarterHour(new Date(oraInizio));
              base.setMinutes(base.getMinutes() + 15);
              return base;
            }
            return roundToQuarterHour(now);
          }
          return now;
        })()}
        onConfirm={handlePickerConfirm}
        onCancel={() => setAttivo(null)}
      />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  stepIndicator: {
    fontSize: 13,
    color: '#64748b',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 140,
    gap: 24,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 12,
    marginBottom: 4,
  },
  stepperItem: {
    alignItems: 'center',
    width: 80,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#cbd5f5',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  stepCircleCompleted: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  stepperLabel: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  stepperLabelActive: {
    color: '#0f172a',
    fontWeight: '600',
  },
  stepperConnector: {
    flex: 1,
    height: 2,
    backgroundColor: '#e2e8f0',
  },
  stepperConnectorActive: {
    backgroundColor: '#2563eb',
  },
  stepBox: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  stepDescription: {
    fontSize: 15,
    color: '#475569',
    marginBottom: 18,
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 14,
    color: '#0f172a',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#f8fafc',
    gap: 12,
  },
  selectorLabel: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
  },
  selectorValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 16,
  },
  timeSelector: {
    flex: 1,
    minWidth: 0,
  },
  compensoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  currencyBadge: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  currencyLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  compensoInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  compensoSuffix: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    marginTop: 4,
    fontSize: 13,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 16,
  },
  inlineField: {
    flex: 1,
  },
  inlineFieldWide: {
    flex: 1,
  },
  addressLoading: {
    marginTop: -8,
    marginBottom: 8,
    fontSize: 12,
    color: '#64748b',
  },
  addressResults: {
    marginTop: -8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  addressResultItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  addressResultText: {
    fontSize: 14,
    color: '#1e293b',
  },
  addressSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  addressSummaryText: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
  },
  locationPreview: {
    marginTop: 12,
    fontSize: 12,
    color: '#475569',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  chipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipLabel: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  chipLabelSelected: {
    color: '#ffffff',
  },
  textarea: {
    height: 140,
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    flexDirection: 'row',
    gap: 16,
  },
  footerButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: '#e2e8f0',
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  disabledButton: {
    backgroundColor: '#94a3b8',
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default NuovoIncaricoScreen;
