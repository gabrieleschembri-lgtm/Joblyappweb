import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useProfile, type WorkerCV } from './profile-context';
import TagInput from '../components/tag-input';
import { SKILL_SUGGESTIONS, CERTIFICATION_SUGGESTIONS, DEGREE_SUGGESTIONS, EXPERIENCE_SUGGESTIONS } from '../data/cv-templates';
import { useTheme, useThemedStyles } from './theme';

type CvStepKey = 'base' | 'summary' | 'skills' | 'titles' | 'experiences' | 'review';
const cvSteps: CvStepKey[] = ['base', 'summary', 'skills', 'titles', 'experiences', 'review'];
const cvStepMeta: Record<CvStepKey, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  base: { label: 'Base', icon: 'person-outline' },
  summary: { label: 'Profilo', icon: 'document-text-outline' },
  skills: { label: 'Competenze', icon: 'star-outline' },
  titles: { label: 'Titoli', icon: 'school-outline' },
  experiences: { label: 'Esperienze', icon: 'briefcase-outline' },
  review: { label: 'Riepilogo', icon: 'checkmark-done-outline' },
};

const CurriculumScreen: React.FC = () => {
  const router = useRouter();
  const { profile, loading, updateCv } = useProfile();
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));

  const [stepIndex, setStepIndex] = useState(0);
  const step = cvSteps[stepIndex];

  const [sex, setSex] = useState<WorkerCV['sex']>('other');
  const [phone, setPhone] = useState('');
  const [summary, setSummary] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [certs, setCerts] = useState<string[]>([]);
  const [degrees, setDegrees] = useState<string[]>([]);
  const [experiences, setExperiences] = useState<string[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace('/configuratore/landing');
      return;
    }
    if (profile.role !== 'lavoratore') {
      router.replace(`/configuratore/${profile.role}`);
      return;
    }
    const cv = profile.cv ?? {};
    setSex((cv.sex as any) ?? 'other');
    setPhone(cv.phone ?? '');
    setSummary(cv.summary ?? '');
    setSkills(cv.skills ?? []);
    setCerts(cv.certifications ?? []);
    setDegrees(cv.degrees ?? []);
    setExperiences(cv.experiences ?? []);
  }, [loading, profile, router]);

  const canProceed = useMemo(() => {
    if (step === 'base') return (phone?.trim().length ?? 0) >= 6;
    return true;
  }, [phone, step]);

  const headerText = useMemo(() => {
    switch (step) {
      case 'base': return 'Informazioni di base';
      case 'summary': return 'Presentazione personale';
      case 'skills': return 'Le tue competenze';
      case 'titles': return 'Titoli di studio e certificazioni';
      case 'experiences': return 'Esperienze lavorative';
      case 'review': return 'Riepilogo Curriculum';
      default: return '';
    }
  }, [step]);

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex((i) => Math.max(0, i - 1));
    } else {
      router.back();
    }
  };

  const handleSave = useCallback(async () => {
    if (!profile) return;
    try {
      await updateCv({
        sex,
        phone: phone.trim(),
        summary: summary.trim(),
        skills,
        certifications: certs,
        degrees,
        experiences,
      });
      Alert.alert('Salvato', 'Curriculum aggiornato correttamente.', [
        { text: 'OK', onPress: () => router.replace('/configuratore/settings') },
      ]);
    } catch (e) {
      Alert.alert('Errore', 'Impossibile salvare il curriculum in questo momento.');
    }
  }, [certs, degrees, experiences, phone, profile, router, sex, skills, summary, updateCv]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <Pressable onPress={handleBack} accessibilityRole="button">
            <Ionicons name="chevron-back" size={26} color={theme.colors.textPrimary} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.stepIndicator}>Passo {stepIndex + 1} di {cvSteps.length}</Text>
            <Text style={styles.stepTitle}>{headerText}</Text>
          </View>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.stepperContainer}>
          {cvSteps.map((key, index) => {
            const meta = cvStepMeta[key];
            const isActive = index === stepIndex;
            const isCompleted = index < stepIndex;
            return (
              <React.Fragment key={key}>
                <View style={styles.stepperItem}>
                  <View style={[styles.stepCircle, isActive && styles.stepCircleActive, isCompleted && styles.stepCircleCompleted]}>
                      {isCompleted ? (
                      <Ionicons name="checkmark" size={16} color={theme.colors.surface} />
                    ) : (
                      <Ionicons name={meta.icon} size={16} color={isActive ? theme.colors.surface : theme.colors.muted} />
                    )}
                  </View>
                </View>
                {index < cvSteps.length - 1 && (
                  <View style={[styles.stepperConnector, index < stepIndex && styles.stepperConnectorActive]} />
                )}
              </React.Fragment>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'base' && (
            <View style={styles.card}>
              <Text style={styles.hint}>Queste informazioni aiutano i datori a contattarti.</Text>
              <Text style={styles.label}>Sesso</Text>
              <View style={styles.typeRow}>
                {([
                  { key: 'male', label: 'Uomo' },
                  { key: 'female', label: 'Donna' },
                  { key: 'other', label: 'Altro' },
                ] as const).map((opt) => {
                  const active = sex === opt.key;
                  return (
                    <Pressable key={opt.key} onPress={() => setSex(opt.key)} style={[styles.typeChip, active && styles.typeChipActive]}>
                      <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Telefono</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="Es. +39 333 1234567"
                style={styles.input}
                keyboardType="phone-pad"
              />
              {(phone.trim().length < 6) && (
                <Text style={styles.error}>Inserisci un numero di telefono valido.</Text>
              )}
            </View>
          )}

          {step === 'summary' && (
            <View style={styles.card}>
              <Text style={styles.label}>Presentazione</Text>
              <TextInput
                value={summary}
                onChangeText={setSummary}
                placeholder="Breve descrizione di te, in 2-3 frasi."
                style={[styles.input, { minHeight: 100 }]}
                multiline
              />
            </View>
          )}

          {step === 'skills' && (
            <View style={[styles.card, styles.iconSection]}>
              <Text style={styles.sectionTitle}>Competenze</Text>
              <View style={styles.iconRow}>
                <Ionicons name="star" size={22} color={theme.colors.primary} />
                <Ionicons name="hammer" size={22} color={theme.colors.primary} />
                <Ionicons name="flash" size={22} color={theme.colors.primary} />
              </View>
              <TagInput
                label=""
                value={skills}
                onChange={setSkills}
                placeholder="Es. Caffetteria, Cassa, Sala"
                suggestions={SKILL_SUGGESTIONS}
                popularCount={8}
              />
            </View>
          )}

          {step === 'titles' && (
            <View style={[styles.card, styles.iconSection]}>
              <Text style={styles.sectionTitle}>Certificazioni e titoli</Text>
              <View style={styles.iconRow}>
                <Ionicons name="ribbon" size={22} color={theme.colors.primary} />
                <Ionicons name="school" size={22} color={theme.colors.primary} />
              </View>
              <TagInput
                label=""
                value={certs}
                onChange={setCerts}
                placeholder="Es. HACCP, Sicurezza sul lavoro"
                suggestions={CERTIFICATION_SUGGESTIONS}
                popularCount={6}
              />
              <View style={{ height: 12 }} />
              <TagInput
                label=""
                value={degrees}
                onChange={setDegrees}
                placeholder="Es. Diploma, Laurea Triennale"
                suggestions={DEGREE_SUGGESTIONS}
                popularCount={6}
              />
            </View>
          )}

          {step === 'experiences' && (
            <View style={[styles.card, styles.iconSection]}>
              <Text style={styles.sectionTitle}>Esperienze</Text>
              <View style={styles.iconRow}>
                <Ionicons name="briefcase" size={22} color={theme.colors.primary} />
                <Ionicons name="rocket" size={22} color={theme.colors.primary} />
              </View>
              <TagInput
                label=""
                value={experiences}
                onChange={setExperiences}
                placeholder="Es. Cameriere 2 anni, Barista 1 anno"
                suggestions={EXPERIENCE_SUGGESTIONS}
                popularCount={8}
              />
            </View>
          )}

          {step === 'review' && (
            <View style={styles.card}>
              <Text style={styles.reviewTitle}>Riepilogo</Text>
              <Text style={styles.reviewItem}>Sesso: {sex ?? '—'}</Text>
              <Text style={styles.reviewItem}>Telefono: {phone || '—'}</Text>
              <Text style={styles.reviewItem}>Presentazione: {summary || '—'}</Text>
              <Text style={styles.reviewItem}>Competenze: {skills.join(', ') || '—'}</Text>
              <Text style={styles.reviewItem}>Certificazioni: {certs.join(', ') || '—'}</Text>
              <Text style={styles.reviewItem}>Titoli: {degrees.join(', ') || '—'}</Text>
              <Text style={styles.reviewItem}>Esperienze: {experiences.join(', ') || '—'}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={[styles.footerButton, styles.secondaryButton]} onPress={handleBack} accessibilityRole="button">
            <Text style={styles.secondaryLabel}>{stepIndex === 0 ? 'Annulla' : 'Indietro'}</Text>
          </Pressable>
          <Pressable
            style={[styles.footerButton, canProceed ? styles.primaryButton : styles.disabledButton]}
            onPress={() => {
              if (!canProceed) return;
              if (stepIndex < cvSteps.length - 1) setStepIndex((i) => i + 1);
              else handleSave();
            }}
            accessibilityRole="button"
          >
            <Text style={styles.primaryLabel}>{step === 'review' ? 'Salva' : 'Continua'}</Text>
          </Pressable>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (t: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: t.colors.background },
    container: { flex: 1, backgroundColor: t.colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    headerInfo: { flex: 1 },
    stepIndicator: { fontSize: 12, color: t.colors.muted },
    stepTitle: { fontSize: 18, fontWeight: '700', color: t.colors.textPrimary },
    stepperContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
    stepperItem: { alignItems: 'center', flex: 1, minWidth: 72 },
    stepCircle: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.surface, alignItems: 'center', justifyContent: 'center' },
    stepCircleActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
    stepCircleCompleted: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
    stepperLabel: { display: 'none' },
    stepperLabelActive: { display: 'none' },
    stepperConnector: { height: 2, flex: 1, backgroundColor: t.colors.border },
    stepperConnectorActive: { backgroundColor: t.colors.primary },
    scrollContent: { padding: 16, paddingBottom: 220, gap: 16 },
    card: { backgroundColor: t.colors.surface, borderRadius: 18, padding: 16, gap: 12, borderWidth: 1, borderColor: t.colors.border },
    hint: { fontSize: 13, color: t.colors.textSecondary },
    label: { fontSize: 15, fontWeight: '600', color: t.colors.textPrimary },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: t.colors.textPrimary, marginBottom: 6 },
    iconSection: {
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    iconRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
      paddingVertical: 6,
      marginBottom: 6,
    },
    input: { borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: t.colors.textPrimary },
    typeRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    typeChip: { borderWidth: 1, borderColor: t.colors.border, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: t.colors.surface },
    typeChipActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
    typeLabel: { color: t.colors.primary, fontSize: 14, fontWeight: '600' },
    typeLabelActive: { color: t.colors.surface },
    error: { marginTop: -4, color: t.colors.danger, fontSize: 12 },
    reviewTitle: { fontSize: 16, fontWeight: '700', color: t.colors.textPrimary },
    reviewItem: { fontSize: 14, color: t.colors.textPrimary },
    footer: { position: 'absolute', bottom: 24, left: 16, right: 16, flexDirection: 'row', gap: 12 },
    footerButton: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    secondaryButton: { backgroundColor: t.colors.card, borderWidth: 1, borderColor: t.colors.border },
    secondaryLabel: { fontSize: 15, fontWeight: '600', color: t.colors.textPrimary },
    primaryButton: { backgroundColor: t.colors.primary },
    disabledButton: { backgroundColor: t.colors.muted, opacity: 0.7 },
    primaryLabel: { fontSize: 15, fontWeight: '600', color: t.colors.surface },
  });

export default CurriculumScreen;
