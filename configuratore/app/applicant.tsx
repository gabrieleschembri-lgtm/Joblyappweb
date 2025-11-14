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
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
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

const ApplicantScreen: React.FC = () => {
  const router = useRouter();
  const { profileId: rawParam } = useLocalSearchParams<{ profileId?: string }>();
  const profileId = Array.isArray(rawParam) ? rawParam[0] : rawParam;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<ApplicantProfile | null>(null);

  useEffect(() => {
    if (!profileId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const ref = doc(db, 'profiles', profileId);
    const unsub = onSnapshot(ref, async (snap) => {
      try {
        if (!snap.exists()) {
          // try once via getDoc in case of permission delay
          const fallback = await getDoc(ref);
          if (!fallback.exists()) {
            if (!cancelled) {
              setNotFound(true);
              setLoading(false);
            }
            return;
          }
          const data = fallback.data() as Record<string, any>;
          if (!cancelled) {
            setProfile(mapProfile(data, profileId));
            setLoading(false);
          }
          return;
        }
        const data = snap.data() as Record<string, any>;
        if (!cancelled) {
          setProfile(mapProfile(data, profileId));
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      }
    }, () => {
      // ignore errors; show basic state
      if (!cancelled) {
        setLoading(false);
      }
    });
    return () => { cancelled = true; unsub(); };
  }, [profileId]);

  const fullName = useMemo(() => {
    if (!profile) return '';
    const base = `${profile.nome ?? ''} ${profile.cognome ?? ''}`.trim();
    return base.length > 0 ? base : (profile.username ?? profile.profileId);
  }, [profile]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#0f172a" />
            <Text style={styles.backText}>Indietro</Text>
          </Pressable>
          <Text style={styles.title}>Profilo candidato</Text>
          <View style={{ width: 76 }} />
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color="#2563eb" />
          </View>
        ) : notFound || !profile ? (
          <View style={styles.centerBox}>
            <Text style={styles.emptyText}>Profilo non trovato.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.nameRow}>
              <Ionicons name="person-circle-outline" size={48} color="#2563eb" />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{fullName}</Text>
                {profile.username ? (
                  <Text style={styles.username}>@{profile.username}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={18} color="#2563eb" />
              <Text style={styles.infoText}>{profile.email ?? 'Email non disponibile'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color="#16a34a" />
              <Text style={styles.infoText}>{profile.phoneNumber ?? profile.cv?.phone ?? 'Telefono non disponibile'}</Text>
            </View>
            {profile.role ? (
              <View style={styles.infoRow}>
                <Ionicons name="briefcase-outline" size={18} color="#475569" />
                <Text style={styles.infoText}>Ruolo: {profile.role}</Text>
              </View>
            ) : null}

            {profile.cv?.summary ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Presentazione</Text>
                <Text style={styles.sectionBody}>{profile.cv.summary}</Text>
              </View>
            ) : null}

            {Array.isArray(profile.cv?.skills) && profile.cv!.skills!.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Competenze</Text>
                <Text style={styles.sectionBody}>{profile.cv!.skills!.join(', ')}</Text>
              </View>
            ) : null}

            {Array.isArray(profile.cv?.certifications) && profile.cv!.certifications!.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Certificazioni</Text>
                <Text style={styles.sectionBody}>{profile.cv!.certifications!.join('\n')}</Text>
              </View>
            ) : null}

            {Array.isArray(profile.cv?.degrees) && profile.cv!.degrees!.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Titoli di studio</Text>
                <Text style={styles.sectionBody}>{profile.cv!.degrees!.join('\n')}</Text>
              </View>
            ) : null}

            {Array.isArray(profile.cv?.experiences) && profile.cv!.experiences!.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Esperienze</Text>
                <Text style={styles.sectionBody}>{profile.cv!.experiences!.join('\n')}</Text>
              </View>
            ) : null}

          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

function mapProfile(p: Record<string, any>, id: string): ApplicantProfile {
  const nome = typeof p.nome === 'string' ? p.nome : (typeof p.name === 'string' ? p.name : '');
  const cognome = typeof p.cognome === 'string' ? p.cognome : (typeof p.surname === 'string' ? p.surname : '');
  return {
    profileId: String(p.profileId ?? id),
    nome,
    cognome,
    username: typeof p.username === 'string' ? p.username : undefined,
    email: typeof p.email === 'string' ? p.email : undefined,
    phoneNumber: typeof p.phoneNumber === 'string' ? p.phoneNumber : undefined,
    role: typeof p.role === 'string' ? p.role : undefined,
    cv: p.cv && typeof p.cv === 'object' ? (p.cv as ApplicantProfile['cv']) : undefined,
  };
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 80, paddingTop: 20, gap: 16 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8,
  },
  backText: { fontSize: 14, color: '#0f172a', fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  centerBox: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 24, alignItems: 'center',
    justifyContent: 'center', shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  emptyText: { fontSize: 14, color: '#64748b' },
  card: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 18, gap: 12, shadowColor: '#0f172a',
    shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  username: { fontSize: 13, color: '#475569' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 14, color: '#1e293b', flex: 1 },
  section: { gap: 6, marginTop: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  sectionBody: { fontSize: 14, color: '#334155', lineHeight: 20 },
});

export default ApplicantScreen;

