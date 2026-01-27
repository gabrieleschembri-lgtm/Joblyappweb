import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth, db, ensureSignedIn } from '../lib/firebase';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, query, where } from 'firebase/firestore';
import { useTheme, useThemedStyles } from './theme';
import { createHireProposal, deleteJobAndRelated, getJobOwnerUid, getOrCreateChat } from '../lib/api';
import { useProfile } from './profile-context';

type ApplicantProfile = {
  profileId: string;
  uid?: string;
  applicationId?: string;
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
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));
  const { profile } = useProfile();

  const [loading, setLoading] = useState(true);
  const [jobTitle, setJobTitle] = useState<string>('Dettagli incarico');
  const [profiles, setProfiles] = useState<ApplicantProfile[]>([]);
  const [ownerProfileId, setOwnerProfileId] = useState<string | null>(null);
  const [hireStatus, setHireStatus] = useState<string>('open');
  const [hireSubmittingId, setHireSubmittingId] = useState<string | null>(null);
  const [jobOwnerUid, setJobOwnerUid] = useState<string | null>(null);
  const [jobOwnerFields, setJobOwnerFields] = useState<Record<string, string | null>>({});
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

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
        const ownerFields = {
          ownerUid: typeof (data as any)?.ownerUid === 'string' ? (data as any).ownerUid : null,
          employerUid: typeof (data as any)?.employerUid === 'string' ? (data as any).employerUid : null,
          datoreUid: typeof (data as any)?.datoreUid === 'string' ? (data as any).datoreUid : null,
          userId: typeof (data as any)?.userId === 'string' ? (data as any).userId : null,
          createdByUid: typeof (data as any)?.createdByUid === 'string' ? (data as any).createdByUid : null,
        };
        const ids = Array.isArray((data as any)?.applicants)
          ? ((data as any).applicants as unknown[]).filter((x) => typeof x === 'string') as string[]
          : [];
        const ownerPid = typeof (data as any)?.ownerProfileId === 'string' ? (data as any).ownerProfileId : null;
        const hireState = typeof (data as any)?.hireStatus === 'string' ? (data as any).hireStatus : 'open';
        if (!cancelled) {
          setOwnerProfileId(ownerPid);
          setHireStatus(hireState);
          setJobOwnerFields(ownerFields);
          setJobOwnerUid(getJobOwnerUid(data ?? undefined));
        }

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
              let applicationId: string | undefined;
              let applicantUid: string | undefined;
              try {
                const appSnap = await getDocs(
                  query(
                    collection(db, 'applications'),
                    where('jobId', '==', jobId),
                    where('applicantProfileId', '==', id),
                    limit(1)
                  )
                );
                if (!appSnap.empty) {
                  const docSnap = appSnap.docs[0];
                  applicationId = docSnap.id;
                  const appData = docSnap.data() as Record<string, any>;
                  if (typeof appData.applicantUid === 'string') {
                    applicantUid = appData.applicantUid;
                  }
                }
              } catch {
                // ignore application lookup errors
              }
              const profile: ApplicantProfile = {
                profileId: String(p.profileId ?? id),
                uid: applicantUid ?? (typeof p.uid === 'string' ? p.uid : undefined),
                applicationId,
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

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (!profile || profile.role !== 'datore' || !jobOwnerUid) {
        if (!cancelled) setCanDelete(false);
        return;
      }
      try {
        const uid = await ensureSignedIn();
        if (!cancelled) setCanDelete(uid === jobOwnerUid);
      } catch {
        if (!cancelled) setCanDelete(false);
      }
    };
    void resolve();
    return () => { cancelled = true; };
  }, [profile, jobOwnerUid]);

  const headerTitle = useMemo(() => `Candidati — ${jobTitle}`, [jobTitle]);

  const handleOpenChat = useCallback(
    async (workerProfileId?: string, otherName?: string) => {
      if (!profile || !jobId) return;
      try {
        const employerId = profile.role === 'datore' ? profile.profileId : ownerProfileId;
        const workerId = profile.role === 'lavoratore' ? profile.profileId : workerProfileId;
        if (!employerId || !workerId) {
          console.warn('Missing employer/worker id for chat', { employerId, workerId });
          return;
        }
        const chat = await getOrCreateChat(jobId, employerId, workerId);
        router.push({
          pathname: '/configuratore/chat/[chatId]',
          params: otherName ? { chatId: chat.id, otherName } : { chatId: chat.id },
        });
      } catch (e) {
        console.warn('Failed to start chat', e);
      }
    },
    [jobId, ownerProfileId, profile, router]
  );

  const handleHire = useCallback(
    async (candidate: ApplicantProfile) => {
      if (!profile || !jobId) return;
      const authUid = await ensureSignedIn();
      console.log('[HIRE_DEBUG] Assumi pressed', {
        jobId,
        authUser: auth.currentUser,
        authUid: auth.currentUser?.uid,
        ensureUid: authUid,
        ownerFields: jobOwnerFields,
        resolvedOwnerUid: jobOwnerUid,
        candidateUid: candidate.uid,
        candidateProfileId: candidate.profileId,
      });
      if (jobOwnerUid && authUid !== jobOwnerUid) {
        console.log('[HIRE_DEBUG] Assumi not authorized: owner mismatch', {
          authUid,
          jobOwnerUid,
        });
        Alert.alert('Non autorizzato', 'Non sei il proprietario di questo incarico.');
        return;
      }
      if (hireStatus !== 'open') {
        console.log('[HIRE_DEBUG] Assumi not authorized: hireStatus not open', hireStatus);
        Alert.alert('Assunzione già avviata', 'Questo incarico ha già una proposta o un incarico attivo.');
        return;
      }
      if (!candidate.uid) {
        console.log('[HIRE_DEBUG] Assumi not authorized: missing candidate uid');
        Alert.alert('Errore', 'Impossibile trovare l’utente selezionato.');
        return;
      }
      if (hireSubmittingId) return;
      setHireSubmittingId(candidate.profileId);
      try {
        await createHireProposal({
          jobId,
          workerUid: candidate.uid,
          applicationId: candidate.applicationId,
          employerProfileId: profile.profileId,
          workerProfileId: candidate.profileId,
        });
        Alert.alert('Proposta inviata', `Hai inviato una proposta a ${candidate.nome} ${candidate.cognome}.`);
      } catch (e) {
        const message =
          (e as Error)?.message ?? 'Non è stato possibile inviare la proposta. Riprova.';
        Alert.alert('Errore', message);
      } finally {
        setHireSubmittingId(null);
      }
    },
    [profile, jobId, hireStatus, hireSubmittingId, jobOwnerUid, jobOwnerFields]
  );

  const handleDeleteJob = useCallback(() => {
    if (!jobId || deleteSubmitting || !canDelete) return;
    Alert.alert(
      'Elimina incarico',
      'Sei sicuro? Questa azione è irreversibile.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleteSubmitting(true);
              await deleteJobAndRelated(jobId);
              Alert.alert('Incarico eliminato', 'L’incarico e i dati collegati sono stati rimossi.');
              router.back();
            } catch (e) {
              Alert.alert('Errore', (e as Error)?.message ?? "Non e' stato possibile eliminare l'incarico.");
            } finally {
              setDeleteSubmitting(false);
            }
          },
        },
      ]
    );
  }, [jobId, deleteSubmitting, canDelete, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.textPrimary} />
            <Text style={styles.backText}>Indietro</Text>
          </Pressable>
          <Text style={styles.title}>{headerTitle}</Text>
          <Pressable
            style={styles.headerAction}
            onPress={() => handleOpenChat()}
            accessibilityRole="button"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.colors.textPrimary} />
          </Pressable>
        </View>
        {canDelete ? (
          <Pressable
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.deleteButtonPressed,
              deleteSubmitting && styles.deleteButtonDisabled,
            ]}
            onPress={handleDeleteJob}
            disabled={deleteSubmitting}
          >
            <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
            <Text style={styles.deleteButtonText}>
              {deleteSubmitting ? 'Eliminazione in corso...' : 'Elimina incarico'}
            </Text>
          </Pressable>
        ) : null}

        {loading ? (
          <View style={styles.cardCenter}>
            <ActivityIndicator color={theme.colors.primary} />
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
              <View key={p.profileId} style={styles.applicantCard}>
                <Pressable
                  onPress={() => router.push(`/configuratore/applicant?profileId=${encodeURIComponent(p.profileId)}`)}
                  style={({ pressed }) => [styles.applicantMain, pressed && styles.applicantCardPressed]}
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
                {profile?.role === 'datore' && (
                  <View style={styles.applicantActions}>
                    <Pressable
                      style={styles.chatButton}
                      onPress={() => handleOpenChat(p.profileId, fullName || p.username || p.profileId)}
                      accessibilityRole="button"
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.surface} />
                      <Text style={styles.chatButtonText}>Chat</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.hireButton,
                        (hireStatus !== 'open' || hireSubmittingId === p.profileId) && styles.hireButtonDisabled,
                      ]}
                      onPress={() => handleHire(p)}
                      accessibilityRole="button"
                      disabled={hireStatus !== 'open' || hireSubmittingId === p.profileId}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.surface} />
                      <Text style={styles.chatButtonText}>
                        {hireStatus === 'proposed'
                          ? 'Proposta inviata'
                          : hireStatus === 'confirmed' || hireStatus === 'completed'
                            ? 'Assunto'
                            : 'Assumi'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}

        {profile?.role === 'lavoratore' && ownerProfileId && (
          <Pressable style={styles.workerChatButton} onPress={() => handleOpenChat()}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.surface} />
            <Text style={styles.workerChatText}>Chatta con il datore</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (t: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: t.colors.background },
    content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 80, gap: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8 },
    backText: { fontSize: 14, color: t.colors.textPrimary, fontWeight: '600' },
    title: { fontSize: 18, fontWeight: '700', color: t.colors.textPrimary },
    cardCenter: {
      backgroundColor: t.colors.surface, borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center',
      shadowColor: t.colors.shadow, shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
    },
    emptyText: { fontSize: 14, color: t.colors.textSecondary },
    applicantCard: {
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 12,
      padding: 12,
      gap: 8,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    applicantMain: { gap: 4 },
    applicantCardPressed: { transform: [{ scale: 0.98 }] },
    applicantName: { fontSize: 15, fontWeight: '700', color: t.colors.textPrimary },
    applicantMeta: { fontSize: 12, color: t.colors.textSecondary },
    applicantSummary: { fontSize: 13, color: t.colors.textSecondary },
    applicantSkills: { fontSize: 12, color: t.colors.textPrimary },
    applicantActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6, gap: 10 },
    chatButton: {
      backgroundColor: t.colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    hireButton: {
      backgroundColor: t.colors.success,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    hireButtonDisabled: {
      opacity: 0.6,
    },
    chatButtonText: { color: t.colors.surface, fontWeight: '700', fontSize: 14 },
    workerChatButton: {
      marginTop: 12,
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: t.colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    workerChatText: { color: t.colors.surface, fontWeight: '700', fontSize: 15 },
    headerAction: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.danger,
    },
    deleteButtonPressed: {
      opacity: 0.7,
    },
    deleteButtonDisabled: {
      opacity: 0.5,
    },
    deleteButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: t.colors.danger,
    },
  });

export default JobApplicantsPage;
