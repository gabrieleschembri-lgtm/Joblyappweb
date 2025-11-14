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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import TagInput from '../components/tag-input';
import { SKILL_SUGGESTIONS, CERTIFICATION_SUGGESTIONS, DEGREE_SUGGESTIONS, EXPERIENCE_SUGGESTIONS } from '../data/cv-templates';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

import { useProfile } from './profile-context';

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

const formatDate = (date: Date | null) => {
  if (!date) return 'Seleziona data';
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const day = String(normalized.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ConfiguratoreScreen: React.FC = () => {
  const router = useRouter();
  const { mode: modeParamRaw } = useLocalSearchParams<{ mode?: string }>();
  const modeParam = Array.isArray(modeParamRaw) ? modeParamRaw[0] : modeParamRaw;
  const forceReconfigure = modeParam === 'switch';
  const { login, profile, loading } = useProfile();

  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [username, setUsername] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [isPickerVisible, setPickerVisible] = useState(false);
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
  const cvStepMeta: Record<CvStepKey, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
    base: { label: 'Base', icon: 'person-outline' },
    summary: { label: 'Profilo', icon: 'document-text-outline' },
    skills: { label: 'Competenze', icon: 'star-outline' },
    titles: { label: 'Titoli', icon: 'school-outline' },
    experiences: { label: 'Esperienze', icon: 'briefcase-outline' },
    review: { label: 'Riepilogo', icon: 'checkmark-done-outline' },
  };
  const cvCurrentStep = cvSteps[cvStepIndex];
  const cvCanProceed = useMemo(() => {
    if (cvCurrentStep === 'base') return isWorkerFormValid;
    return true;
  }, [cvCurrentStep, isWorkerFormValid]);
  const cvHeaderLabel = useMemo(() => {
    switch (cvCurrentStep) {
      case 'base': return 'Informazioni di base';
      case 'summary': return 'Presentazione personale';
      case 'skills': return 'Le tue competenze';
      case 'titles': return 'Titoli di studio e certificazioni';
      case 'experiences': return 'Esperienze lavorative';
      case 'review': return 'Riepilogo Curriculum';
      default: return '';
    }
  }, [cvCurrentStep]);

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
      !!birthDate &&
      password.trim().length >= 6 &&
      confirmPassword.trim().length >= 6 &&
      password === confirmPassword,
    [nome, cognome, username, birthDate, password, confirmPassword]
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
          const normalized = new Date(year, month - 1, day);
          setBirthDate(normalized);
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
      setBirthDate(null);
      setPassword('');
      setConfirmPassword('');
      resetBusinessForm();
    }
  }, [forceReconfigure, profile, resetBusinessForm]);

  const completeRegistration = useCallback(
    async (role: Role, businessDetails?: BusinessDetails, workerCv?: WorkerCV) => {
      if (!birthDate) {
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
        dataNascita: formatDate(birthDate),
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
    [birthDate, nome, cognome, password, login, resetBusinessForm, router, saving]
  );

  const handlePersonalRolePress = useCallback(
    (role: Role) => {
      if (!isFormValid || !birthDate) {
        Alert.alert(
          'Errore',
          'Compila tutti i campi, seleziona la data e inserisci una password di almeno 6 caratteri uguale in entrambi i campi.'
        );
        return;
      }

      if (!isAdult(birthDate)) {
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
      birthDate,
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

  if (profile) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
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
                <MaterialIcons name="badge" size={22} color="#0f172a" />
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

            <Text style={styles.label}>Data di nascita</Text>
            <Pressable
              style={styles.datePicker}
              onPress={() => setPickerVisible(true)}
              accessibilityRole="button"
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color="#2563eb"
                style={styles.dateIcon}
              />
              <Text
                style={birthDate ? styles.dateValue : styles.datePlaceholder}
              >
                {formatDate(birthDate)}
              </Text>
              <Ionicons
                name="chevron-down"
                size={18}
                color="#64748b"
              />
            </Pressable>

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
                color="#2563eb"
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
                <MaterialIcons name="work-outline" size={20} color="#ffffff" />
                <Text style={styles.buttonText}>Datore</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.workerButton, saving && styles.buttonDisabled]}
                onPress={() => handlePersonalRolePress('lavoratore')}
                disabled={saving}
              >
                <Ionicons name="people-outline" size={20} color="#ffffff" />
                <Text style={styles.buttonText}>Lavoratore</Text>
              </Pressable>
            </View>
          ) : currentStep === 'workerCv' ? (
            <View style={styles.cvCard}>
              <View style={styles.cvHeader}>
                <Text style={styles.cvHeaderStep}>Passo {cvStepIndex + 1} di {cvSteps.length}</Text>
                <Text style={styles.cvHeaderTitle}>{cvHeaderLabel}</Text>
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
                            <Ionicons name="checkmark" size={14} color="#ffffff" />
                          ) : (
                            <Ionicons name={meta.icon} size={14} color={isActive ? '#ffffff' : '#64748b'} />
                          )}
                        </View>
                        <Text style={[styles.cvStepperLabel, (isActive || isCompleted) && styles.cvStepperLabelActive]}>{meta.label}</Text>
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
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.buttonText}>Conferma profilo datore</Text>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.button, styles.backButton]}
                  onPress={handleBusinessBack}
                  disabled={saving}
                >
                  <Ionicons name="arrow-back" size={18} color="#1d4ed8" />
                  <Text style={styles.backButtonText}>Torna indietro</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>

        <DateTimePickerModal
          isVisible={isPickerVisible}
          mode="date"
          maximumDate={new Date()}
          onConfirm={(date) => {
            setPickerVisible(false);
            const normalized = new Date(
              date.getFullYear(),
              date.getMonth(),
              date.getDate(),
              0,
              0,
              0,
              0
            );
            setBirthDate(normalized);
          }}
          onCancel={() => setPickerVisible(false)}
        />
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
    paddingBottom: 48,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    marginTop: 8,
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  // CV wizard styling
  cvCard: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cvHeader: {
    marginBottom: 16,
  },
  cvHeaderStep: {
    fontSize: 12,
    color: '#64748b',
  },
  cvHeaderTitle: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  cvStepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  cvStepperItem: {
    alignItems: 'center',
  },
  cvStepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cvStepCircleActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  cvStepCircleCompleted: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  cvStepperLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 6,
    width: 68,
    textAlign: 'center',
  },
  cvStepperLabelActive: {
    color: '#0f172a',
    fontWeight: '600',
  },
  cvStepperConnector: {
    height: 2,
    flex: 1,
    marginHorizontal: 6,
    backgroundColor: '#e2e8f0',
  },
  cvStepperConnectorActive: {
    backgroundColor: '#2563eb',
  },
  cvBox: {
    marginTop: 12,
  },
  cvHint: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 8,
  },
  cvHintSmall: {
    fontSize: 12,
    color: '#64748b',
    marginTop: -6,
  },
  cvTextarea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  cvError: {
    marginTop: -6,
    color: '#ef4444',
    fontSize: 12,
  },
  cvReviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  cvReviewItem: {
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 4,
  },
  cvFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cvFooterButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cvSecondaryButton: {
    backgroundColor: '#e2e8f0',
  },
  cvSecondaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  cvPrimaryButton: {
    backgroundColor: '#2563eb',
  },
  cvDisabledButton: {
    backgroundColor: '#93c5fd',
    opacity: 0.7,
  },
  cvPrimaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12,
  },
  formIconWrapper: {
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 4,
    gap: 12,
  },
  dateIcon: {
    marginRight: 2,
  },
  datePlaceholder: {
    fontSize: 15,
    color: '#94a3b8',
    flex: 1,
  },
  dateValue: {
    fontSize: 15,
    color: '#0f172a',
    flex: 1,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginTop: 18,
  },
  noticeText: {
    fontSize: 13,
    color: '#1e293b',
    flex: 1,
    lineHeight: 18,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  inlineField: {
    flex: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  businessCard: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    gap: 12,
  },
  businessTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  businessSubtitle: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  businessTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  businessTypeButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    backgroundColor: '#f8fafc',
  },
  businessTypeButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  businessTypeButtonText: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
  businessTypeButtonTextActive: {
    color: '#ffffff',
  },
  businessActions: {
    marginTop: 20,
    gap: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
    gap: 14,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  employerButton: {
    backgroundColor: '#2563eb',
  },
  workerButton: {
    backgroundColor: '#10b981',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#e0e7ff',
  },
  backButtonText: {
    color: '#1d4ed8',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ConfiguratoreScreen;
