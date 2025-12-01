import { authenticateProfile, upsertUserProfile } from "../lib/api";
import type { BusinessPayload } from "../lib/api";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import TagInput from '../components/tag-input';
import { SKILL_SUGGESTIONS, CERTIFICATION_SUGGESTIONS, DEGREE_SUGGESTIONS, EXPERIENCE_SUGGESTIONS } from '../data/cv-templates';

import { useProfile } from './profile-context';
import { useTheme, useThemedStyles } from './theme';

type Role = 'datore' | 'lavoratore';

type BusinessDetails = BusinessPayload;
type BusinessType = BusinessPayload['type'];

const businessTypeOptions: BusinessType[] = ['bar', 'ristorante', 'cafe', 'altro'];

const isAdult = (date: Date) => {
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < date.getDate())
  ) {
    age -= 1;
  }

  return age >= 18;
};

const parseDateInput = (value: string): Date | null => {
  const trimmed = value.trim();
  const match = /^([0-3]\d)[/.-]([0-1]\d)[/.-](\d{4})$/.exec(trimmed);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm) - 1;
  const year = Number(yyyy);
  const d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null;
  return d;
};

const formatDateISO = (date: Date | null) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ConfiguratoreScreen: React.FC = () => {
  const router = useRouter();
  const { mode: modeParamRaw } = useLocalSearchParams<{ mode?: string }>();
  const modeParam = Array.isArray(modeParamRaw) ? modeParamRaw[0] : modeParamRaw;
  const forceReconfigure = modeParam === 'switch';
  const { login, profile, loading } = useProfile();
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));

  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [username, setUsername] = useState('');
  const [birthDateInput, setBirthDateInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentStep, setCurrentStep] = useState<'personal' | 'workerCv' | 'business'>('personal');
  const [saving, setSaving] = useState(false);

  // Lavoratore: CV fields
  type WorkerCV = {
    sex?: 'male' | 'female' | 'other';
    phone?: string;
    summary?: string;
    skills?: string[];
    certifications?: string[];
    degrees?: string[];
    experiences?: string[];
  };
  const [cvSex, setCvSex] = useState<WorkerCV['sex']>('other');
  const [cvPhone, setCvPhone] = useState('');
  const [cvSummary, setCvSummary] = useState('');
  const [cvSkills, setCvSkills] = useState<string[]>([]);
  const [cvCerts, setCvCerts] = useState<string[]>([]);
  const [cvDegrees, setCvDegrees] = useState<string[]>([]);
  const [cvExperiences, setCvExperiences] = useState<string[]>([]);
  const isWorkerFormValid = useMemo(() => cvPhone.trim().length >= 6, [cvPhone]);
  const parseListInput = useCallback((text: string): string[] =>
    text
      .split(/\n|,/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0), []);

  // Lavoratore: CV wizard meta
  type CvStepKey = 'base' | 'summary' | 'skills' | 'titles' | 'experiences' | 'review';
  const cvSteps: CvStepKey[] = ['base', 'summary', 'skills', 'titles', 'experiences', 'review'];
  const [cvStepIndex, setCvStepIndex] = useState(0);
  const cvStepMeta: Record<CvStepKey, { icon: keyof typeof Ionicons.glyphMap }> = {
    base: { icon: 'person-outline' },
    summary: { icon: 'document-text-outline' },
    skills: { icon: 'star-outline' },
    titles: { icon: 'school-outline' },
    experiences: { icon: 'briefcase-outline' },
    review: { icon: 'checkmark-done-outline' },
  };
  const cvCurrentStep = cvSteps[cvStepIndex];
  const cvCanProceed = useMemo(() => {
    if (cvCurrentStep === 'base') return isWorkerFormValid;
    return true;
  }, [cvCurrentStep, isWorkerFormValid]);
  const parsedBirthDate = useMemo(() => parseDateInput(birthDateInput), [birthDateInput]);

  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [businessOtherDetail, setBusinessOtherDetail] = useState('');
  const [businessStreet, setBusinessStreet] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [businessCity, setBusinessCity] = useState('');
  const [businessProvince, setBusinessProvince] = useState('');
  const [businessPostalCode, setBusinessPostalCode] = useState('');

  const resetBusinessForm = useCallback(() => {
    setBusinessType(null);
    setBusinessOtherDetail('');
    setBusinessStreet('');
    setBusinessNumber('');
    setBusinessCity('');
    setBusinessProvince('');
    setBusinessPostalCode('');
  }, []);

  const isFormValid = useMemo(
    () =>
      nome.trim() !== '' &&
      cognome.trim() !== '' &&
      username.trim().length >= 3 &&
      !!parsedBirthDate &&
      password.trim().length >= 6 &&
      confirmPassword.trim().length >= 6 &&
      password === confirmPassword,
    [nome, cognome, username, parsedBirthDate, password, confirmPassword]
  );

  const isBusinessFormValid = useMemo(() => {
    if (businessType === null) {
      return false;
    }
    if (businessType === 'altro' && businessOtherDetail.trim().length === 0) {
      return false;
    }
    return [
      businessStreet,
      businessNumber,
      businessCity,
      businessProvince,
      businessPostalCode,
    ].every((value) => value.trim().length > 0);
  }, [
    businessType,
    businessOtherDetail,
    businessStreet,
    businessNumber,
    businessCity,
    businessProvince,
    businessPostalCode,
  ]);

  useEffect(() => {
    if (!loading && profile && !forceReconfigure) {
      router.replace(`/configuratore/${profile.role}`);
    }
  }, [loading, profile, router, forceReconfigure]);

  useEffect(() => {
    if (forceReconfigure && profile) {
      setNome(profile.nome);
      setCognome(profile.cognome);
      const parts = profile.dataNascita?.split('-');
      if (parts && parts.length === 3) {
        const [year, month, day] = parts.map(Number);
        if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
          const normalized = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
          setBirthDateInput(normalized);
        }
      }
      setPassword('');
      setConfirmPassword('');

      if (profile.role === 'datore' && profile.business) {
        setBusinessType(profile.business.type);
        setBusinessOtherDetail(profile.business.otherDetail ?? '');
        const address = profile.business.address ?? {
          street: '',
          number: '',
          city: '',
          province: '',
          postalCode: '',
        };
        setBusinessStreet(address.street ?? '');
        setBusinessNumber(address.number ?? '');
        setBusinessCity(address.city ?? '');
        setBusinessProvince(address.province ?? '');
        setBusinessPostalCode(address.postalCode ?? '');
      } else {
        resetBusinessForm();
      }
    } else if (!forceReconfigure) {
      setNome('');
      setCognome('');
      setUsername('');
      setBirthDateInput('');
      setPassword('');
      setConfirmPassword('');
      resetBusinessForm();
    }
  }, [forceReconfigure, profile, resetBusinessForm]);

  const completeRegistration = useCallback(
    async (role: Role, businessDetails?: BusinessDetails, workerCv?: WorkerCV) => {
    const parsedBirth = parseDateInput(birthDateInput);
    if (!parsedBirth) {
      Alert.alert('Errore', 'Seleziona la data di nascita.');
      return;
    }

      if (saving) {
        return;
      }

      const cleanedProfile = {
        role,
        nome: nome.trim(),
        cognome: cognome.trim(),
        dataNascita: formatDateISO(parsedBirth),
      } as const;

      setSaving(true);

      try {
        await upsertUserProfile({
          name: cleanedProfile.nome,
          surname: cleanedProfile.cognome,
          role: cleanedProfile.role,
          birthDate: cleanedProfile.dataNascita,
          password,
          username: username.trim(),
          ...(role === 'datore' ? { business: businessDetails } : {}),
          ...(role === 'lavoratore' && workerCv ? { cv: workerCv } : {}),
        });
      } catch (e) {
        console.error('[CFG] Firestore save error:', e);
        const code = (e as any)?.code as string | undefined;
        if (code === 'profile/username-taken') {
          Alert.alert('Username non disponibile', 'Scegli un altro username.');
        } else if (code === 'profile/username-required') {
          Alert.alert('Errore', 'Inserisci un username valido (min 3 caratteri).');
        } else {
          const msg = (e && (e as any).message) ? (e as any).message : String(e);
          Alert.alert('Errore', `Impossibile salvare il profilo su cloud.\n${msg}`);
        }
        setSaving(false);
        return;
      }

      try {
        const { profile: authenticatedProfile } = await authenticateProfile({
          username: username.trim(),
          password,
        });
        await login(authenticatedProfile);
        setCurrentStep('personal');
        resetBusinessForm();
        setSaving(false);
        router.replace(`/configuratore/${role}`);
      } catch (error) {
        console.warn('[CFG] Failed to authenticate after registration:', error);
        Alert.alert(
          'Errore',
          'Profilo creato ma impossibile completare l\'accesso automatico. Riprova dalla schermata di login.'
        );
        setSaving(false);
        return;
      }
    },
    [parsedBirthDate, nome, cognome, password, login, resetBusinessForm, router, saving, birthDateInput]
  );

  const handlePersonalRolePress = useCallback(
    (role: Role) => {
      if (!isFormValid || !parsedBirthDate) {
        Alert.alert(
          'Errore',
          'Compila tutti i campi, inserisci la data di nascita nel formato GG/MM/AAAA e usa una password di almeno 6 caratteri uguale in entrambi i campi.'
        );
        return;
      }

      if (!isAdult(parsedBirthDate)) {
        Alert.alert('Errore', 'Devi avere almeno 18 anni.');
        return;
      }

      if (role === 'datore') {
        if (!(forceReconfigure && profile?.role === 'datore' && profile.business)) {
          resetBusinessForm();
        }
        setCurrentStep('business');
        return;
      }
      // Lavoratore: go to CV configuration wizard
      setCvStepIndex(0);
      setCurrentStep('workerCv');
    },
    [
      parsedBirthDate,
      completeRegistration,
      forceReconfigure,
      isFormValid,
      profile,
      resetBusinessForm,
    ]
  );

  const handleWorkerSubmit = useCallback(() => {
    if (saving) return;
    if (!isWorkerFormValid) {
      Alert.alert('Errore', 'Inserisci un numero di telefono valido.');
      return;
    }
    const cv: WorkerCV = {
      sex: cvSex,
      phone: cvPhone.trim(),
      summary: cvSummary.trim(),
      skills: cvSkills,
      certifications: cvCerts,
      degrees: cvDegrees,
      experiences: cvExperiences,
  };
    void completeRegistration('lavoratore', undefined, cv);
  }, [
    completeRegistration,
    cvCerts,
    cvDegrees,
    cvExperiences,
    cvPhone,
    cvSex,
    cvSkills,
    cvSummary,
    isWorkerFormValid,
    parseListInput,
    saving,
  ]);

  const handleWorkerBack = useCallback(() => {
    if (cvStepIndex > 0) {
      setCvStepIndex((i) => Math.max(0, i - 1));
      return;
    }
    setCurrentStep('personal');
  }, [cvStepIndex]);

  const handleBusinessSubmit = useCallback(() => {
    if (saving) {
      return;
    }

    if (!isBusinessFormValid || businessType === null) {
      Alert.alert('Errore', 'Compila tutti i dati dell\'attività.');
      return;
    }

    const businessPayload: BusinessDetails = {
      type: businessType,
      ...(businessType === 'altro'
        ? { otherDetail: businessOtherDetail.trim() }
        : {}),
      address: {
        street: businessStreet.trim(),
        number: businessNumber.trim(),
        city: businessCity.trim(),
        province: businessProvince.trim(),
        postalCode: businessPostalCode.trim(),
      },
    };

    void completeRegistration('datore', businessPayload);
  }, [
    businessCity,
    businessNumber,
    businessOtherDetail,
    businessPostalCode,
    businessProvince,
    businessStreet,
    businessType,
    completeRegistration,
    isBusinessFormValid,
    saving,
  ]);

  const handleBusinessBack = useCallback(() => {
    setCurrentStep('personal');
  }, []);

  const handleBirthDateChange = useCallback((raw: string) => {
    // Auto-insert slashes as the user types: DD/MM/YYYY, but keep editing smooth
    const digits = raw.replace(/[^\d]/g, '').slice(0, 8);
    if (digits.length <= 2) {
      setBirthDateInput(digits);
      return;
    }
    if (digits.length <= 4) {
      setBirthDateInput(`${digits.slice(0, 2)}/${digits.slice(2)}`);
      return;
    }
    setBirthDateInput(`${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`);
  }, []);

  if (profile) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Configura il tuo profilo</Text>
            <Text style={styles.subtitle}>
              Inserisci le tue informazioni personali per continuare con
              l'esperienza Jobly.
            </Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <View style={styles.formIconWrapper}>
                <MaterialIcons name="badge" size={22} color={theme.colors.textPrimary} />
              </View>
              <Text style={styles.formTitle}>Dati personali</Text>
            </View>

            <Text style={styles.label}>Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Scegli un username unico (min 3)"
              style={styles.input}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Nome</Text>
            <TextInput
              value={nome}
              onChangeText={setNome}
              placeholder="Inserisci il nome"
              style={styles.input}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={styles.label}>Cognome</Text>
            <TextInput
              value={cognome}
              onChangeText={setCognome}
              placeholder="Inserisci il cognome"
              style={styles.input}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={styles.label}>Data di nascita (GG/MM/AAAA)</Text>
            <TextInput
              value={birthDateInput}
              onChangeText={handleBirthDateChange}
              placeholder="GG/MM/AAAA"
              style={styles.input}
              keyboardType="number-pad"
              maxLength={10}
              autoCapitalize="none"
              returnKeyType="next"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Almeno 6 caratteri"
              style={styles.input}
              secureTextEntry
              returnKeyType="done"
            />

            <Text style={styles.label}>Conferma password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Ripeti la password"
              style={styles.input}
              secureTextEntry
              returnKeyType="done"
            />

            <View style={styles.noticeBox}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={theme.colors.primary}
              />
              <Text style={styles.noticeText}>
                I dati inseriti saranno usati per personalizzare la tua
                esperienza come datore o lavoratore. Conserva la password:
                ti servirà per accedere da altri dispositivi.
              </Text>
            </View>
          </View>

          {currentStep === 'personal' ? (
            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.button, styles.employerButton, saving && styles.buttonDisabled]}
                onPress={() => handlePersonalRolePress('datore')}
                disabled={saving}
              >
                <MaterialIcons name="work-outline" size={20} color={theme.colors.surface} />
                <Text style={styles.buttonText}>Datore</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.workerButton, saving && styles.buttonDisabled]}
                onPress={() => handlePersonalRolePress('lavoratore')}
                disabled={saving}
              >
                <Ionicons name="people-outline" size={20} color={theme.colors.surface} />
                <Text style={styles.buttonText}>Lavoratore</Text>
              </Pressable>
            </View>
          ) : currentStep === 'workerCv' ? (
            <View style={styles.cvCard}>
              <View style={styles.cvHeader}>
                <Text style={styles.cvHeaderStep}>Passo {cvStepIndex + 1} di {cvSteps.length}</Text>
              </View>

              <View style={styles.cvStepperContainer}>
                {cvSteps.map((key, index) => {
                  const meta = cvStepMeta[key];
                  const isActive = index === cvStepIndex;
                  const isCompleted = index < cvStepIndex;
                  return (
                    <React.Fragment key={key}>
                      <View style={styles.cvStepperItem}>
                        <View style={[styles.cvStepCircle, isActive && styles.cvStepCircleActive, isCompleted && styles.cvStepCircleCompleted] }>
                          {isCompleted ? (
                            <Ionicons name="checkmark" size={14} color={theme.colors.surface} />
                          ) : (
                            <Ionicons name={meta.icon} size={14} color={isActive ? theme.colors.surface : theme.colors.muted} />
                          )}
                        </View>
                      </View>
                      {index < cvSteps.length - 1 && (
                        <View style={[styles.cvStepperConnector, (index < cvStepIndex) && styles.cvStepperConnectorActive]} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>

              {cvCurrentStep === 'base' && (
                <View style={styles.cvBox}>
                  <Text style={styles.cvHint}>Queste informazioni aiutano i datori a contattarti.</Text>
                  <Text style={styles.label}>Sesso</Text>
                  <View style={styles.businessTypeRow}>
                    {([
                      { key: 'male', label: 'Uomo' },
                      { key: 'female', label: 'Donna' },
                      { key: 'other', label: 'Altro' },
                    ] as const).map((opt) => {
                      const active = cvSex === opt.key;
                      return (
                        <Pressable
                          key={opt.key}
                          onPress={() => setCvSex(opt.key)}
                          style={[styles.businessTypeButton, active && styles.businessTypeButtonActive]}
                        >
                          <Text style={[styles.businessTypeButtonText, active && styles.businessTypeButtonTextActive]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.label}>Telefono</Text>
                  <TextInput
                    value={cvPhone}
                    onChangeText={setCvPhone}
                    placeholder="Es. +39 333 1234567"
                    style={styles.input}
                    keyboardType="phone-pad"
                  />
                  {!isWorkerFormValid && (
                    <Text style={styles.cvError}>Inserisci un numero di telefono valido.</Text>
                  )}
                </View>
              )}

              {cvCurrentStep === 'summary' && (
                <View style={styles.cvBox}>
                  <Text style={styles.label}>Presentazione</Text>
                  <TextInput
                    value={cvSummary}
                    onChangeText={setCvSummary}
                    placeholder="Breve descrizione di te, in 2-3 frasi."
                    style={[styles.input, styles.cvTextarea]}
                    multiline
                  />
                </View>
              )}

              {cvCurrentStep === 'skills' && (
                <View style={styles.cvBox}>
                  <TagInput
                    label="Competenze"
                    value={cvSkills}
                    onChange={setCvSkills}
                    placeholder="Es. Caffetteria, Cassa, Sala"
                    suggestions={SKILL_SUGGESTIONS}
                    popularCount={8}
                  />
                </View>
              )}

              {cvCurrentStep === 'titles' && (
                <View style={styles.cvBox}>
                  <TagInput
                    label="Certificazioni"
                    value={cvCerts}
                    onChange={setCvCerts}
                    placeholder="Es. HACCP, Sicurezza sul lavoro"
                    suggestions={CERTIFICATION_SUGGESTIONS}
                    popularCount={6}
                  />
                  <View style={{ height: 10 }} />
                  <TagInput
                    label="Titoli di studio"
                    value={cvDegrees}
                    onChange={setCvDegrees}
                    placeholder="Es. Diploma, Laurea Triennale"
                    suggestions={DEGREE_SUGGESTIONS}
                    popularCount={6}
                  />
                </View>
              )}

              {cvCurrentStep === 'experiences' && (
                <View style={styles.cvBox}>
                  <TagInput
                    label="Esperienze precedenti"
                    value={cvExperiences}
                    onChange={setCvExperiences}
                    placeholder="Es. Cameriere 2 anni, Barista 1 anno"
                    suggestions={EXPERIENCE_SUGGESTIONS}
                    popularCount={8}
                  />
                </View>
              )}

              {cvCurrentStep === 'review' && (
                <View style={styles.cvBox}>
                  <Text style={styles.cvReviewTitle}>Riepilogo</Text>
                  <Text style={styles.cvReviewItem}>Sesso: {cvSex ?? '—'}</Text>
                  <Text style={styles.cvReviewItem}>Telefono: {cvPhone || '—'}</Text>
                  <Text style={styles.cvReviewItem}>Presentazione: {cvSummary || '—'}</Text>
                  <Text style={styles.cvReviewItem}>Competenze: {cvSkills.join(', ') || '—'}</Text>
                  <Text style={styles.cvReviewItem}>Certificazioni: {cvCerts.join(', ') || '—'}</Text>
                  <Text style={styles.cvReviewItem}>Titoli: {cvDegrees.join(', ') || '—'}</Text>
                  <Text style={styles.cvReviewItem}>Esperienze: {cvExperiences.join(', ') || '—'}</Text>
                </View>
              )}

              <View style={styles.cvFooter}>
                <Pressable style={[styles.cvFooterButton, styles.cvSecondaryButton]} onPress={handleWorkerBack}>
                  <Text style={styles.cvSecondaryLabel}>{cvStepIndex === 0 ? 'Annulla' : 'Indietro'}</Text>
                </Pressable>
                <Pressable
                  style={[styles.cvFooterButton, cvCanProceed ? styles.cvPrimaryButton : styles.cvDisabledButton]}
                  onPress={() => {
                    if (!cvCanProceed) return;
                    if (cvStepIndex < cvSteps.length - 1) {
                      setCvStepIndex((i) => i + 1);
                    } else {
                      handleWorkerSubmit();
                    }
                  }}
                >
                  <Text style={styles.cvPrimaryLabel}>
                    {cvCurrentStep === 'review' ? 'Conferma profilo' : 'Continua'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.businessCard}>
              <Text style={styles.businessTitle}>Dettagli dell'attività</Text>
              <Text style={styles.businessSubtitle}>
                Inserisci le informazioni della tua attività prima di completare la registrazione da datore.
              </Text>

              <Text style={styles.label}>Tipologia</Text>
              <View style={styles.businessTypeRow}>
                {businessTypeOptions.map((option) => {
                  const active = businessType === option;
                  const label = option === 'cafe'
                    ? 'Cafè'
                    : option.charAt(0).toUpperCase() + option.slice(1);
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setBusinessType(option)}
                      style={[
                        styles.businessTypeButton,
                        active && styles.businessTypeButtonActive,
                        saving && styles.buttonDisabled,
                      ]}
                      disabled={saving}
                    >
                      <Text
                        style={[
                          styles.businessTypeButtonText,
                          active && styles.businessTypeButtonTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {businessType === 'altro' && (
                <>
                  <Text style={styles.label}>Specifica attività</Text>
                  <TextInput
                    value={businessOtherDetail}
                    onChangeText={setBusinessOtherDetail}
                    placeholder="Es. Gelateria"
                    style={styles.input}
                  />
                </>
              )}

              <Text style={styles.label}>Via/Strada/Piazza</Text>
              <TextInput
                value={businessStreet}
                onChangeText={setBusinessStreet}
                placeholder="Es. Via Roma"
                style={styles.input}
              />

              <View style={styles.inlineRow}>
                <View style={styles.inlineField}>
                  <Text style={styles.label}>Civico</Text>
                  <TextInput
                    value={businessNumber}
                    onChangeText={setBusinessNumber}
                    placeholder="Es. 25"
                    style={styles.input}
                  />
                </View>
                <View style={styles.inlineField}>
                  <Text style={styles.label}>Città</Text>
                  <TextInput
                    value={businessCity}
                    onChangeText={setBusinessCity}
                    placeholder="Es. Milano"
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.inlineRow}>
                <View style={styles.inlineField}>
                  <Text style={styles.label}>Provincia</Text>
                  <TextInput
                    value={businessProvince}
                    onChangeText={setBusinessProvince}
                    placeholder="Es. MI"
                    style={styles.input}
                  />
                </View>
                <View style={styles.inlineField}>
                  <Text style={styles.label}>CAP</Text>
                  <TextInput
                    value={businessPostalCode}
                    onChangeText={setBusinessPostalCode}
                    placeholder="Es. 20121"
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.businessActions}>
                <Pressable
                style={[styles.button, styles.employerButton, (!isBusinessFormValid || saving) && styles.buttonDisabled]}
                onPress={handleBusinessSubmit}
                disabled={!isBusinessFormValid || saving}
              >
                {saving ? (
                  <ActivityIndicator color={theme.colors.surface} />
                ) : (
                  <Text style={styles.buttonText}>Conferma profilo datore</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.button, styles.backButton]}
                onPress={handleBusinessBack}
                disabled={saving}
              >
                  <Ionicons name="arrow-back" size={18} color={theme.colors.primary} />
                  <Text style={styles.backButtonText}>Torna indietro</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (t: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: t.colors.background },
    container: { flex: 1, backgroundColor: t.colors.background },
    scrollContent: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 220 },
    header: { marginBottom: 24 },
    title: { fontSize: 26, fontWeight: '700', color: t.colors.textPrimary },
    subtitle: { fontSize: 16, color: t.colors.textSecondary, marginTop: 8, lineHeight: 22 },
    formCard: {
      backgroundColor: t.colors.surface,
      borderRadius: 20,
      padding: 20,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    cvCard: {
      marginTop: 24,
      backgroundColor: t.colors.surface,
      borderRadius: 20,
      padding: 20,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    cvHeader: { marginBottom: 16 },
    cvHeaderStep: { fontSize: 12, color: t.colors.muted },
    cvHeaderTitle: { marginTop: 2, fontSize: 18, fontWeight: '700', color: t.colors.textPrimary },
    cvStepperContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
    cvStepperItem: { alignItems: 'center' },
    cvStepCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cvStepCircleActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
    cvStepCircleCompleted: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
    cvStepperLabel: {
      fontSize: 11,
      color: t.colors.muted,
      marginTop: 6,
      width: 68,
      textAlign: 'center',
    },
    cvStepperLabelActive: { color: t.colors.textPrimary, fontWeight: '600' },
    cvStepperConnector: { height: 2, flex: 1, marginHorizontal: 6, backgroundColor: t.colors.border },
    cvStepperConnectorActive: { backgroundColor: t.colors.primary },
    cvBox: { marginTop: 12 },
    cvHint: { fontSize: 13, color: t.colors.textSecondary, marginBottom: 8 },
    cvHintSmall: { fontSize: 12, color: t.colors.muted, marginTop: -6 },
    cvTextarea: { minHeight: 90, textAlignVertical: 'top' },
    cvError: { marginTop: -6, color: t.colors.danger, fontSize: 12 },
    cvReviewTitle: { fontSize: 16, fontWeight: '700', color: t.colors.textPrimary, marginBottom: 8 },
    cvReviewItem: { fontSize: 14, color: t.colors.textPrimary, marginBottom: 4 },
    cvFooter: { flexDirection: 'row', gap: 12, marginTop: 16 },
    cvFooterButton: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    cvSecondaryButton: { backgroundColor: t.colors.card, borderColor: t.colors.border, borderWidth: 1 },
    cvSecondaryLabel: { fontSize: 15, fontWeight: '600', color: t.colors.textPrimary },
    cvPrimaryButton: { backgroundColor: t.colors.primary },
    cvDisabledButton: { backgroundColor: t.colors.muted, opacity: 0.7 },
    cvPrimaryLabel: { fontSize: 15, fontWeight: '600', color: t.colors.surface },
    formHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 12 },
    formIconWrapper: { backgroundColor: t.colors.border, borderRadius: 10, padding: 10 },
    formTitle: { fontSize: 18, fontWeight: '600', color: t.colors.textPrimary },
    label: { fontSize: 15, fontWeight: '600', color: t.colors.textPrimary, marginBottom: 6, marginTop: 10 },
    input: {
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
      color: t.colors.textPrimary,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
    },
    datePicker: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      marginTop: 4,
      gap: 12,
    },
    dateIcon: { marginRight: 2 },
    datePlaceholder: { fontSize: 15, color: t.colors.muted, flex: 1 },
    dateValue: { fontSize: 15, color: t.colors.textPrimary, flex: 1 },
    noticeBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.card,
      borderColor: t.colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      gap: 8,
      marginTop: 18,
    },
    noticeText: { fontSize: 13, color: t.colors.textPrimary, flex: 1, lineHeight: 18 },
    inlineRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
    inlineField: { flex: 1 },
    buttonDisabled: { opacity: 0.6 },
    businessCard: {
      marginTop: 24,
      backgroundColor: t.colors.surface,
      borderRadius: 20,
      padding: 20,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
      gap: 12,
    },
    businessTitle: { fontSize: 20, fontWeight: '700', color: t.colors.textPrimary },
    businessSubtitle: { fontSize: 14, color: t.colors.textSecondary, lineHeight: 20 },
    businessTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    businessTypeButton: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
    },
    businessTypeButtonActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
    businessTypeButtonText: { fontSize: 14, color: t.colors.textPrimary, fontWeight: '600' },
    businessTypeButtonTextActive: { color: t.colors.surface },
    businessActions: { marginTop: 20, gap: 12 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 32, gap: 14 },
    button: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    employerButton: { backgroundColor: t.colors.primary },
    workerButton: { backgroundColor: t.colors.success },
    buttonText: { color: t.colors.surface, fontSize: 16, fontWeight: '600' },
    backButton: { backgroundColor: t.colors.card, borderColor: t.colors.primary, borderWidth: 1 },
    backButtonText: { color: t.colors.primary, fontSize: 16, fontWeight: '600' },
  });

export default ConfiguratoreScreen;
