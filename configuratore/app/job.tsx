import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';

type ApplicantProfile = {
  profileId: string;
  nome: string;
  cognome: string;
  username?: string;
  email?: string;
  phoneNumber?: string;
  role?: string;
  cv?: {
    summary?: string;
    phone?: string;
    skills?: string[];
    certifications?: string[];
    degrees?: string[];
    experiences?: string[];
  };
};

const JobApplicantsPage: React.FC = () => {
  const router = useRouter();
  const { jobId: raw } = useLocalSearchParams<{ jobId?: string }>();
  const jobId = Array.isArray(raw) ? raw[0] : raw;

  const [loading, setLoading] = useState(true);
  const [jobTitle, setJobTitle] = useState<string>('Dettagli incarico');
  const [profiles, setProfiles] = useState<ApplicantProfile[]>([]);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const jobRef = doc(db, 'jobs', jobId);
    const unsub = onSnapshot(jobRef, async (snap) => {
      try {
        const data = snap.data() as Record<string, any> | undefined;
        if (data) {
          const categoria = (data?.tipo?.categoria ?? '') as string;
          const altro = (data?.tipo?.altroDettaglio ?? '') as string;
          const title = categoria === 'altro'
            ? (altro || 'Altro')
            : (typeof categoria === 'string' && categoria.length > 0
                ? categoria.charAt(0).toUpperCase() + categoria.slice(1)
                : 'Dettagli incarico');
          if (!cancelled) setJobTitle(title);
        }
        const ids = Array.isArray((data as any)?.applicants)
          ? ((data as any).applicants as unknown[]).filter((x) => typeof x === 'string') as string[]
          : [];

        if (ids.length === 0) {
          if (!cancelled) {
            setProfiles([]);
            setLoading(false);
          }
          return;
        }

        const docs = await Promise.all(
          ids.map(async (id) => {
            try {
              const pRef = doc(db, 'profiles', id);
              const pSnap = await getDoc(pRef);
              if (!pSnap.exists()) return null;
              const p = pSnap.data() as Record<string, any>;
              const nome = typeof p.nome === 'string' ? p.nome : (typeof p.name === 'string' ? p.name : '');
              const cognome = typeof p.cognome === 'string' ? p.cognome : (typeof p.surname === 'string' ? p.surname : '');
              const profile: ApplicantProfile = {
                profileId: String(p.profileId ?? id),
                nome,
                cognome,
                username: typeof p.username === 'string' ? p.username : undefined,
                email: typeof p.email === 'string' ? p.email : undefined,
                phoneNumber: typeof p.phoneNumber === 'string' ? p.phoneNumber : undefined,
                role: typeof p.role === 'string' ? p.role : undefined,
                cv: p.cv && typeof p.cv === 'object' ? (p.cv as ApplicantProfile['cv']) : undefined,
              };
              return profile;
            } catch {
              return null;
            }
          })
        );

        const valid = docs.filter((d): d is ApplicantProfile => !!d);
        if (!cancelled) {
          setProfiles(valid);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [jobId]);

  const headerTitle = useMemo(() => `Candidati — ${jobTitle}`, [jobTitle]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#0f172a" />
            <Text style={styles.backText}>Indietro</Text>
          </Pressable>
          <Text style={styles.title}>{headerTitle}</Text>
          <View style={{ width: 76 }} />
        </View>

        {loading ? (
          <View style={styles.cardCenter}>
            <ActivityIndicator color="#2563eb" />
          </View>
        ) : profiles.length === 0 ? (
          <View style={styles.cardCenter}>
            <Text style={styles.emptyText}>Nessuna candidatura al momento.</Text>
          </View>
        ) : (
          profiles.map((p) => {
            const fullName = `${p.nome} ${p.cognome}`.trim();
            const hasSkills = Array.isArray(p.cv?.skills) && (p.cv?.skills?.length ?? 0) > 0;
            const previewCert = Array.isArray(p.cv?.certifications) && p.cv!.certifications!.length > 0
              ? p.cv!.certifications![0]
              : null;
            const previewExp = Array.isArray(p.cv?.experiences) && p.cv!.experiences!.length > 0
              ? p.cv!.experiences![0]
              : null;
            return (
              <Pressable
                key={p.profileId}
                onPress={() => router.push(`/configuratore/applicant?profileId=${encodeURIComponent(p.profileId)}`)}
                style={({ pressed }) => [styles.applicantCard, pressed && styles.applicantCardPressed]}
              >
                <Text style={styles.applicantName}>{fullName || p.username || p.profileId}</Text>
                <Text style={styles.applicantMeta}>
                  {p.email ? p.email : 'Email non disponibile'} · {p.phoneNumber || p.cv?.phone || 'Tel. non disponibile'}
                </Text>
                {p.cv?.summary ? (
                  <Text style={styles.applicantSummary}>{p.cv.summary}</Text>
                ) : null}
                {hasSkills ? (
                  <Text style={styles.applicantSkills}>
                    Competenze: {(p.cv?.skills ?? []).slice(0, 6).join(', ')}
                  </Text>
                ) : null}
                {previewCert ? (
                  <Text style={styles.applicantMeta}>Certificazione: {previewCert}</Text>
                ) : null}
                {previewExp ? (
                  <Text style={styles.applicantMeta}>Esperienza: {previewExp}</Text>
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 80, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8 },
  backText: { fontSize: 14, color: '#0f172a', fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  cardCenter: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  emptyText: { fontSize: 14, color: '#64748b' },
  applicantCard: {
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, gap: 6,
  },
  applicantCardPressed: { transform: [{ scale: 0.98 }] },
  applicantName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  applicantMeta: { fontSize: 12, color: '#475569' },
  applicantSummary: { fontSize: 13, color: '#334155' },
  applicantSkills: { fontSize: 12, color: '#1e293b' },
});

export default JobApplicantsPage;

