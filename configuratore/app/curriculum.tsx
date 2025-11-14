import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useProfile, type WorkerCV } from './profile-context';
import TagInput from '../components/tag-input';
import { SKILL_SUGGESTIONS, CERTIFICATION_SUGGESTIONS, DEGREE_SUGGESTIONS, EXPERIENCE_SUGGESTIONS } from '../data/cv-templates';

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
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} accessibilityRole="button">
            <Ionicons name="chevron-back" size={26} color="#0f172a" />
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
                      <Ionicons name="checkmark" size={16} color="#ffffff" />
                    ) : (
                      <Ionicons name={meta.icon} size={16} color={isActive ? '#ffffff' : '#64748b'} />
                    )}
                  </View>
                  <Text style={[styles.stepperLabel, (isActive || isCompleted) && styles.stepperLabelActive]}>{meta.label}</Text>
                </View>
                {index < cvSteps.length - 1 && (
                  <View style={[styles.stepperConnector, index < stepIndex && styles.stepperConnectorActive]} />
                )}
              </React.Fragment>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
            <View style={styles.card}>
              <TagInput
                label="Competenze"
                value={skills}
                onChange={setSkills}
                placeholder="Es. Caffetteria, Cassa, Sala"
                suggestions={SKILL_SUGGESTIONS}
                popularCount={8}
              />
            </View>
          )}

          {step === 'titles' && (
            <View style={styles.card}>
              <TagInput
                label="Certificazioni"
                value={certs}
                onChange={setCerts}
                placeholder="Es. HACCP, Sicurezza sul lavoro"
                suggestions={CERTIFICATION_SUGGESTIONS}
                popularCount={6}
              />
              <View style={{ height: 12 }} />
              <TagInput
                label="Titoli di studio"
                value={degrees}
                onChange={setDegrees}
                placeholder="Es. Diploma, Laurea Triennale"
                suggestions={DEGREE_SUGGESTIONS}
                popularCount={6}
              />
            </View>
          )}

          {step === 'experiences' && (
            <View style={styles.card}>
              <TagInput
                label="Esperienze precedenti"
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

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  headerInfo: { flex: 1 },
  stepIndicator: { fontSize: 12, color: '#64748b' },
  stepTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  stepperContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  stepperItem: { alignItems: 'center' },
  stepCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#cbd5f5', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  stepCircleCompleted: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  stepperLabel: { fontSize: 11, color: '#64748b', marginTop: 6, width: 68, textAlign: 'center' },
  stepperLabelActive: { color: '#0f172a', fontWeight: '600' },
  stepperConnector: { height: 2, flex: 1, marginHorizontal: 6, backgroundColor: '#e2e8f0' },
  stepperConnectorActive: { backgroundColor: '#2563eb' },
  scrollContent: { padding: 16, paddingBottom: 120, gap: 16 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 10, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  hint: { fontSize: 13, color: '#475569' },
  label: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  typeRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  typeChip: { borderWidth: 1, borderColor: '#cbd5f5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  typeChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typeLabel: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  typeLabelActive: { color: '#fff' },
  error: { marginTop: -4, color: '#ef4444', fontSize: 12 },
  reviewTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  reviewItem: { fontSize: 14, color: '#1e293b' },
  footer: { position: 'absolute', bottom: 24, left: 24, right: 24, flexDirection: 'row', gap: 16 },
  footerButton: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { backgroundColor: '#e2e8f0' },
  secondaryLabel: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  primaryButton: { backgroundColor: '#2563eb' },
  disabledButton: { backgroundColor: '#93c5fd', opacity: 0.7 },
  primaryLabel: { fontSize: 15, fontWeight: '600', color: '#fff' },
});

export default CurriculumScreen;
