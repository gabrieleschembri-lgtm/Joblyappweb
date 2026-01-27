import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type FirestoreError,
  type DocumentData,
  type QuerySnapshot,
  type Query,
} from 'firebase/firestore';

import { authReady, db, ensureSignedIn } from '../lib/firebase';
import { createJobDocument, createJobApplication, getJobOwnerUid, upsertUserProfile } from '../lib/api';
import type { BusinessPayload } from '../lib/api';
import { isJobPast } from './job-time';

export type WorkerCV = {
  sex?: 'male' | 'female' | 'other';
  phone?: string;
  summary?: string;
  skills?: string[];
  certifications?: string[];
  degrees?: string[];
  experiences?: string[];
};

export type Profile = {
  role: 'datore' | 'lavoratore';
  nome: string;
  cognome: string;
  dataNascita: string;
  profileId: string;
  passwordHash: string;
  business?: (BusinessPayload & { updatedAt?: string });
  cv?: WorkerCV;
  username?: string;
  email?: string;
  phoneNumber?: string;
};

export type Incarico = {
  id: string;
  data: string;
  oraInizio: string;
  oraFine: string;
  indirizzo: {
    via: string;
    civico: string;
    citta: string;
    provincia: string;
    cap: string;
  };
  tipo: {
    categoria: 'bar' | 'pizzeria' | 'ristorante' | 'negozio' | 'magazzino' | 'altro';
    altroDettaglio?: string;
  };
  descrizione: string;
  createdAt: string;
  startAt?: string | number | Date;
  jobDate?: string | number | Date;
  compensoOrario: number;
  status?: string;
  ownerProfileId?: string;
  ownerUid?: string;
  location?: {
    lat: number;
    lng: number;
  };
};

export type ProfileContextValue = {
  profile: Profile | null;
  incarichi: Incarico[];
  availableJobs: Incarico[];
  loading: boolean;
  login: (profile: Profile) => Promise<void>;
  logout: () => Promise<void>;
  addIncarico: (incarico: Omit<Incarico, 'id' | 'createdAt'>) => Promise<Incarico>;
  refreshAvailableJobs: () => Promise<void>;
  applyToJob: (job: Incarico) => Promise<void>;
  updateCv: (cv: WorkerCV) => Promise<void>;
  updatePhone: (phoneNumber: string) => Promise<void>;
};

const STORAGE_KEY = 'jobly.profile';

type StoredPayload = {
  profile: Profile | null;
  incarichi: Incarico[];
  availableJobs?: Incarico[];
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

const mapSnapshotToIncarichi = (
  snapshot: QuerySnapshot<DocumentData>
): Incarico[] =>
  snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data();

      const normalizeDateValue = (value: unknown): string | number | Date | null => {
        if (!value) return null;
        if (value instanceof Date) return value;
        if (typeof value === 'number' || typeof value === 'string') return value;
        if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
          try {
            return (value as { toDate: () => Date }).toDate();
          } catch {
            return null;
          }
        }
        return null;
      };

      const rawData =
        typeof data.data === 'string'
          ? data.data
          : typeof data.date === 'string'
            ? data.date
            : typeof data.jobDate === 'string'
              ? data.jobDate
              : null;
      const rawOraInizio =
        typeof data.oraInizio === 'string'
          ? data.oraInizio
          : typeof data.startTime === 'string'
            ? data.startTime
            : typeof data.jobStartTime === 'string'
              ? data.jobStartTime
              : typeof data.time === 'string'
                ? data.time
                : null;
      const rawOraFine =
        typeof data.oraFine === 'string'
          ? data.oraFine
          : typeof data.endTime === 'string'
            ? data.endTime
            : typeof data.jobEndTime === 'string'
              ? data.jobEndTime
              : null;

      const normalizedStartAt = normalizeDateValue(
        (data as Record<string, unknown>).startAt ?? (data as Record<string, unknown>).startDate
      );
      const normalizedJobDate = normalizeDateValue(
        (data as Record<string, unknown>).jobDate
      );

      const safeData =
        rawData && rawData.trim().length > 0 ? rawData.trim() : 'Data da definire';
      const safeOraInizio =
        rawOraInizio && rawOraInizio.trim().length > 0 ? rawOraInizio.trim() : 'Da definire';
      const safeOraFine =
        rawOraFine && rawOraFine.trim().length > 0 ? rawOraFine.trim() : safeOraInizio;

      const indirizzo = (data.indirizzo ?? {}) as Record<string, unknown>;
      const tipo = (data.tipo ?? {}) as Record<string, unknown>;

      const createdAt = data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : typeof data.createdAt === 'string'
          ? data.createdAt
          : new Date().toISOString();

      const categoriaRaw = typeof tipo['categoria'] === 'string' ? tipo['categoria'] : 'altro';
      const categoria =
        categoriaRaw === 'bar' ||
        categoriaRaw === 'pizzeria' ||
        categoriaRaw === 'ristorante' ||
        categoriaRaw === 'negozio' ||
        categoriaRaw === 'magazzino' ||
        categoriaRaw === 'altro'
          ? categoriaRaw
          : 'altro';

      const ownerProfileId =
        typeof data.ownerProfileId === 'string' ? data.ownerProfileId : undefined;
      const ownerUid = typeof data.ownerUid === 'string' ? data.ownerUid : undefined;

      const locationRaw = (data.location ?? {}) as Record<string, unknown>;
      const lat = typeof locationRaw.lat === 'number' ? locationRaw.lat : undefined;
      const lng = typeof locationRaw.lng === 'number' ? locationRaw.lng : undefined;

      return {
        id: docSnap.id,
        data: safeData,
        oraInizio: safeOraInizio,
        oraFine: safeOraFine,
        indirizzo: {
          via: typeof indirizzo['via'] === 'string' ? (indirizzo['via'] as string) : '',
          civico: typeof indirizzo['civico'] === 'string' ? (indirizzo['civico'] as string) : '',
          citta: typeof indirizzo['citta'] === 'string' ? (indirizzo['citta'] as string) : '',
          provincia:
            typeof indirizzo['provincia'] === 'string' ? (indirizzo['provincia'] as string) : '',
          cap: typeof indirizzo['cap'] === 'string' ? (indirizzo['cap'] as string) : '',
        },
        tipo: {
          categoria,
          altroDettaglio:
            typeof tipo['altroDettaglio'] === 'string'
              ? (tipo['altroDettaglio'] as string)
              : undefined,
        },
        descrizione: typeof data.descrizione === 'string' ? data.descrizione : '',
        compensoOrario:
          typeof data.compensoOrario === 'number'
            ? data.compensoOrario
            : Number(data.compensoOrario ?? 0),
        status: typeof data.status === 'string' ? (data.status as string) : undefined,
        createdAt,
        ownerProfileId,
        ownerUid,
        startAt: normalizedStartAt ?? undefined,
        jobDate: normalizedJobDate ?? undefined,
        location:
          typeof lat === 'number' && typeof lng === 'number'
            ? {
                lat,
                lng,
              }
            : undefined,
      } satisfies Incarico;
    })
    .filter((entry): entry is Incarico => entry !== null);

const sanitizeTipoForFirestore = (tipo: Incarico['tipo']) =>
  tipo.categoria === 'altro'
    ? {
        categoria: 'altro' as const,
        altroDettaglio: (tipo.altroDettaglio ?? '').trim(),
      }
    : {
        categoria: tipo.categoria,
      };

const normalizeStoredIncarichi = (maybeList: unknown): Incarico[] => {
  if (!Array.isArray(maybeList)) {
    return [];
  }

  return (maybeList as Incarico[]).map((item) => {
    const rawValue =
      typeof item.compensoOrario === 'number'
        ? item.compensoOrario
        : Number((item as unknown as { compensoOrario?: unknown }).compensoOrario ?? 0);
    const safeValue = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 0;

    return {
      ...item,
      compensoOrario: safeValue,
    };
  });
};

const filterUpcomingJobs = (jobs: Incarico[], now: Date = new Date()): Incarico[] =>
  jobs.filter((job) => !isJobPast(job as Record<string, any>, now));

const geocodeAddress = async (
  address: string
): Promise<{ lat: number; lng: number } | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=it`,
      {
        headers: {
          'User-Agent': 'JoblyApp/1.0 (support@jobly.placeholder)',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Geocode status ${response.status}`);
    }

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const { lat, lon } = data[0] as { lat?: string; lon?: string };
    const parsedLat = Number(lat);
    const parsedLng = Number(lon);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      return null;
    }

    return { lat: parsedLat, lng: parsedLng };
  } catch (error) {
    console.warn('Failed to geocode address:', error);
    return null;
  }
};

const isProfile = (value: unknown): value is Profile => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Profile>;
  return (
    (candidate?.role === 'datore' || candidate?.role === 'lavoratore') &&
    typeof candidate.nome === 'string' &&
    typeof candidate.cognome === 'string' &&
    typeof candidate.dataNascita === 'string' &&
    typeof candidate.profileId === 'string' &&
    typeof candidate.passwordHash === 'string'
  );
};

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [incarichi, setIncarichi] = useState<Incarico[]>([]);
  const [availableJobs, setAvailableJobs] = useState<Incarico[]>([]);
  const [loading, setLoading] = useState(true);
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([]);
  const appliedJobIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    void ensureSignedIn().catch((error) => {
      console.warn('Failed to ensure auth session:', error);
    });
  }, []);

  useEffect(() => {
    appliedJobIdsRef.current = new Set(appliedJobIds);
  }, [appliedJobIds]);

  useEffect(() => {
    setAvailableJobs((current) =>
      current.map((job) => {
        if (appliedJobIds.includes(job.id)) {
          return { ...job, status: 'applied' as const };
        }
        if (job.status === 'applied') {
          return { ...job, status: 'open' };
        }
        return job;
      })
    );
  }, [appliedJobIds]);

  const persistState = useCallback(
    async ({
      profile: nextProfile,
      myIncarichi,
      available,
    }: {
      profile: Profile | null;
      myIncarichi: Incarico[];
      available: Incarico[];
    }) => {
      const payload: StoredPayload = {
        profile: nextProfile,
        incarichi: myIncarichi,
        availableJobs: available,
      };
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (error) {
        console.warn('Failed to persist profile payload:', error);
      }
    },
    []
  );

  const fetchJobsForProfile = useCallback(
    async (ownerProfileId: string): Promise<Incarico[]> => {
      try {
        await authReady;
      } catch (error) {
        console.warn('Auth not ready when loading jobs:', error);
      }

      const jobsRef = collection(db, 'jobs');

      try {
        let snapshot = await getDocs(
          query(jobsRef, where('ownerProfileId', '==', ownerProfileId), orderBy('createdAt', 'desc'))
        );

        const jobs = filterUpcomingJobs(mapSnapshotToIncarichi(snapshot));

        if (jobs.length === 0 && snapshot.empty) {
          return jobs;
        }

        return jobs;
      } catch (queryError) {
        const firestoreError = queryError as FirestoreError;
        if (firestoreError?.code === 'failed-precondition') {
          console.warn(
            'Missing index for jobs query, falling back without Firestore ordering. Consider adding a composite index for ownerProfileId+createdAt.'
          );

          try {
            const fallbackSnapshot = await getDocs(
              query(jobsRef, where('ownerProfileId', '==', ownerProfileId))
            );

            const fallbackJobs = filterUpcomingJobs(
              mapSnapshotToIncarichi(fallbackSnapshot).sort((a, b) => {
                const left = Date.parse(b.createdAt);
                const right = Date.parse(a.createdAt);
                if (!Number.isFinite(left) && !Number.isFinite(right)) {
                  return 0;
                }
                if (!Number.isFinite(left)) {
                  return 1;
                }
                if (!Number.isFinite(right)) {
                  return -1;
                }
                return left - right;
              })
            );

            return fallbackJobs;
          } catch (fallbackError) {
            console.warn('Fallback jobs query failed:', fallbackError);
            return [];
          }
        }

        console.warn('Failed to load jobs from Firestore:', queryError);
        return [];
      }
    },
    []
  );

  const fetchAllJobs = useCallback(async (): Promise<Incarico[]> => {
    try {
      await authReady;
    } catch (error) {
      console.warn('Auth not ready when loading available jobs:', error);
    }

    const jobsRef = collection(db, 'jobs');

    try {
      const snapshot = await getDocs(query(jobsRef, orderBy('createdAt', 'desc')));
      return filterUpcomingJobs(mapSnapshotToIncarichi(snapshot));
    } catch (queryError) {
      const firestoreError = queryError as FirestoreError;
      if (firestoreError?.code === 'failed-precondition') {
        console.warn(
          'Missing index for jobs listing, falling back without Firestore ordering.'
        );

        try {
          const fallbackSnapshot = await getDocs(jobsRef);
          return filterUpcomingJobs(
            mapSnapshotToIncarichi(fallbackSnapshot).sort((a, b) => {
              const left = Date.parse(b.createdAt);
              const right = Date.parse(a.createdAt);
              if (!Number.isFinite(left) && !Number.isFinite(right)) {
                return 0;
              }
              if (!Number.isFinite(left)) {
                return 1;
              }
              if (!Number.isFinite(right)) {
                return -1;
              }
              return left - right;
            })
          );
        } catch (fallbackError) {
          console.warn('Fallback available jobs query failed:', fallbackError);
          return [];
        }
      }

      console.warn('Failed to load available jobs from Firestore:', queryError);
      return [];
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!stored) {
          return;
        }
        const parsed = JSON.parse(stored) as unknown;
        if (parsed && typeof parsed === 'object') {
          const candidate = parsed as Partial<StoredPayload>;
          if (
            candidate.profile !== undefined ||
            candidate.incarichi !== undefined ||
            candidate.availableJobs !== undefined
          ) {
            if (candidate.profile && isProfile(candidate.profile)) {
              setProfile(candidate.profile);
            } else {
              setProfile(candidate.profile ?? null);
            }

            const normalizedIncarichi = filterUpcomingJobs(
              normalizeStoredIncarichi(candidate.incarichi)
            );
            const normalizedAvailable = filterUpcomingJobs(
              normalizeStoredIncarichi(candidate.availableJobs)
            );
            setIncarichi(normalizedIncarichi);
            setAvailableJobs(normalizedAvailable);
            setAppliedJobIds(
              normalizedAvailable
                .filter((job) => job.status === 'applied')
                .map((job) => job.id)
            );
            return;
          }
          if (isProfile(parsed)) {
            setProfile(parsed);
            setIncarichi([]);
            setAvailableJobs([]);
            return;
          }
        }
      } catch (error) {
        console.warn('Failed to load stored profile payload:', error);
      } finally {
        setLoading(false);
      }
    };

    void bootstrap().finally(() => {
      setLoading(false);
    });
  }, []);

  const login = useCallback(
    async (nextProfile: Profile) => {
      try {
        await authReady;
      } catch (error) {
        console.warn('Auth not ready:', error);
      }

      let syncedIncarichi: Incarico[] = [];
      if (nextProfile.role === 'datore') {
        syncedIncarichi = await fetchJobsForProfile(nextProfile.profileId);
      }

      const visibleJobs = await fetchAllJobs();
      const now = new Date();
      const filteredIncarichi = filterUpcomingJobs(syncedIncarichi, now);
      const filteredVisible = filterUpcomingJobs(visibleJobs, now);

      const enrichedJobs = filteredVisible.map((job) =>
        appliedJobIdsRef.current.has(job.id)
          ? { ...job, status: 'applied' as const }
          : job
      );

      setProfile(nextProfile);
      setIncarichi(filteredIncarichi);
      setAvailableJobs(enrichedJobs);
      setAppliedJobIds(
        enrichedJobs
          .filter((job) => job.status === 'applied')
          .map((job) => job.id)
      );
      await persistState({
        profile: nextProfile,
        myIncarichi: filteredIncarichi,
        available: enrichedJobs,
      });
    },
    [fetchJobsForProfile, fetchAllJobs, persistState]
  );

  const logout = useCallback(async () => {
    setProfile(null);
    setIncarichi([]);
    setAvailableJobs([]);
    setAppliedJobIds([]);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear profile payload:', error);
    }
  }, []);

  useEffect(() => {
    if (loading || !profile || profile.role !== 'datore') {
      return undefined;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    let ownerUid = '';
    const normalizedJobs = new Set<string>();

    const startSubscription = async () => {
      try {
        await authReady;
        ownerUid = await ensureSignedIn();
      } catch (error) {
        console.warn('Auth not ready for datore jobs subscription:', error);
      }

      if (cancelled) {
        return;
      }

      const jobsRef = collection(db, 'jobs');
      const orderedQuery = query(
        jobsRef,
        where('ownerProfileId', '==', profile.profileId),
        orderBy('createdAt', 'desc')
      );

      const attach = (
        targetQuery: Query<DocumentData>,
        shouldSortFallback = false
      ): (() => void) =>
        onSnapshot(
          targetQuery,
          (snapshot) => {
            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data() ?? {};
              const existingOwner = typeof data.ownerUid === 'string' ? data.ownerUid : '';
              if (!existingOwner && ownerUid) {
                const detected = getJobOwnerUid(data);
                if (detected && detected === ownerUid && !normalizedJobs.has(docSnap.id)) {
                  normalizedJobs.add(docSnap.id);
                  updateDoc(docSnap.ref, {
                    ownerUid: ownerUid,
                    updatedAt: serverTimestamp(),
                  }).catch((error) => {
                    console.warn('Failed to normalize ownerUid on job', docSnap.id, error);
                  });
                }
              }
            });
            const jobs = shouldSortFallback
              ? mapSnapshotToIncarichi(snapshot).sort((a, b) => {
                  const left = Date.parse(b.createdAt);
                  const right = Date.parse(a.createdAt);
                  return Number.isFinite(left) && Number.isFinite(right) ? left - right : 0;
                })
              : mapSnapshotToIncarichi(snapshot);
            setIncarichi(filterUpcomingJobs(jobs));
          },
          (error) => {
            const firestoreError = error as FirestoreError;
            if (firestoreError.code === 'failed-precondition') {
              console.warn(
                'Missing index for jobs owner subscription. Falling back without Firestore ordering.'
              );
              unsubscribe?.();
              unsubscribe = attach(
                query(jobsRef, where('ownerProfileId', '==', profile.profileId)),
                true
              );
            } else if (!cancelled) {
              console.warn('Failed to subscribe to datore jobs:', error);
            }
          }
        );

      unsubscribe = attach(orderedQuery);
    };

    void startSubscription();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [loading, profile]);

  useEffect(() => {
    if (loading || !profile) {
      return undefined;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const startSubscription = async () => {
      try {
        await authReady;
      } catch (error) {
        console.warn('Auth not ready for available jobs subscription:', error);
      }

      if (cancelled) {
        return;
      }

      const jobsRef = collection(db, 'jobs');
      const orderedQuery = query(jobsRef, orderBy('createdAt', 'desc'));

      const attach = (
        targetQuery: Query<DocumentData>,
        shouldSortFallback = false
      ): (() => void) =>
        onSnapshot(
          targetQuery,
          (snapshot) => {
            const jobs = shouldSortFallback
              ? mapSnapshotToIncarichi(snapshot).sort((a, b) => {
                  const left = Date.parse(b.createdAt);
                  const right = Date.parse(a.createdAt);
                  return Number.isFinite(left) && Number.isFinite(right) ? left - right : 0;
                })
              : mapSnapshotToIncarichi(snapshot);
            const upcomingJobs = filterUpcomingJobs(jobs);
            const enrichedJobs = upcomingJobs.map((job) =>
              appliedJobIdsRef.current.has(job.id)
                ? { ...job, status: 'applied' as const }
                : job
            );
            setAvailableJobs(enrichedJobs);
          },
          (error) => {
            const firestoreError = error as FirestoreError;
            if (firestoreError.code === 'failed-precondition') {
              console.warn(
                'Missing index for jobs listing subscription. Falling back without Firestore ordering.'
              );
              unsubscribe?.();
              unsubscribe = attach(query(jobsRef), true);
            } else if (!cancelled) {
              console.warn('Failed to subscribe to available jobs:', error);
            }
          }
        );

      unsubscribe = attach(orderedQuery);
    };

    void startSubscription();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [loading, profile]);

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    const interval = setInterval(() => {
      const now = new Date();
      setIncarichi((current) => {
        const filtered = filterUpcomingJobs(current, now);
        return filtered.length === current.length ? current : filtered;
      });
      setAvailableJobs((current) => {
        const filtered = filterUpcomingJobs(current, now);
        if (filtered.length !== current.length) {
          const allowedIds = new Set(filtered.map((job) => job.id));
          setAppliedJobIds((prev) => prev.filter((id) => allowedIds.has(id)));
        }
        return filtered.length === current.length ? current : filtered;
      });
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (loading || !profile) {
      return;
    }

    void persistState({
      profile,
      myIncarichi: profile.role === 'datore' ? incarichi : [],
      available: availableJobs,
    });
  }, [loading, profile, incarichi, availableJobs, persistState]);

  const refreshAvailableJobs = useCallback(async () => {
    const jobs = await fetchAllJobs();
    const now = new Date();
    const upcoming = filterUpcomingJobs(jobs, now);
    const enriched = upcoming.map((job) =>
      appliedJobIdsRef.current.has(job.id)
        ? { ...job, status: 'applied' as const }
        : job
    );
    setAvailableJobs(enriched);
    await persistState({
      profile,
      myIncarichi: profile?.role === 'datore' ? incarichi : [],
      available: enriched,
    });
  }, [fetchAllJobs, profile, incarichi, persistState]);

  const addIncarico = useCallback(
    async (incaricoInput: Omit<Incarico, 'id' | 'createdAt'>) => {
      const createdAtIso = new Date().toISOString();
      let generatedId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const tipoNormalizzato =
        sanitizeTipoForFirestore(incaricoInput.tipo);

      let resolvedLocation: { lat: number; lng: number } | null = null;
      const { via, civico, citta, provincia, cap } = incaricoInput.indirizzo;
      const addressPieces = [
        via?.trim(),
        civico?.trim(),
        citta?.trim(),
        (provincia ?? '').trim(),
        (cap ?? '').trim(),
      ].filter((piece) => piece && piece.length > 0);

      if (!('location' in incaricoInput) || !incaricoInput.location) {
        if (profile?.role === 'datore' && addressPieces.length >= 3) {
        const addressString = addressPieces.join(', ');
        resolvedLocation = await geocodeAddress(addressString);
        }
      } else {
        resolvedLocation = incaricoInput.location;
      }

      const safeIncaricoBase: Omit<Incarico, 'id' | 'createdAt'> = {
        ...incaricoInput,
        tipo: tipoNormalizzato,
      };

      const safeIncarico: Omit<Incarico, 'id' | 'createdAt'> = resolvedLocation
        ? {
            ...safeIncaricoBase,
            location: resolvedLocation,
          }
        : safeIncaricoBase;

      const payloadForFirestore = {
        ...safeIncarico,
        status: 'open',
      };

      if (profile?.role === 'datore') {
        try {
          const docRef = await createJobDocument({
            ownerProfileId: profile.profileId,
            payload: payloadForFirestore,
          });
          generatedId = docRef.id;
        } catch (error) {
          console.warn('Failed to create job document:', error);
        }
      }

      const newIncarico: Incarico = {
        ...safeIncarico,
        status: 'open',
        ownerProfileId: profile?.profileId,
        id: generatedId,
        createdAt: createdAtIso,
      };
      const updatedIncarichi = filterUpcomingJobs([newIncarico, ...incarichi]);
      const filteredAvailable = filterUpcomingJobs(
        availableJobs.filter((job) => job.id !== newIncarico.id)
      );
      const updatedAvailable = [newIncarico, ...filteredAvailable];

      setIncarichi(updatedIncarichi);
      setAvailableJobs(updatedAvailable);

      await persistState({
        profile,
        myIncarichi: updatedIncarichi,
        available: updatedAvailable,
      });

      return newIncarico;
    },
    [availableJobs, incarichi, persistState, profile]
  );

  const applyToJob = useCallback(
    async (job: Incarico) => {
      if (!profile || profile.role !== 'lavoratore') {
        throw new Error('Solo i lavoratori possono candidarsi agli incarichi.');
      }

      if (appliedJobIds.includes(job.id)) {
        return;
      }

     try {
        await createJobApplication({
          jobId: job.id,
          ownerProfileId: job.ownerProfileId ?? null,
          ownerUid: job.ownerUid ?? null,
          applicantProfileId: profile.profileId,
          jobSnapshot: {
            data: job.data,
            oraInizio: job.oraInizio,
            oraFine: job.oraFine,
            indirizzo: job.indirizzo,
            tipo: sanitizeTipoForFirestore(job.tipo),
            descrizione: job.descrizione,
            compensoOrario: job.compensoOrario,
            status: job.status ?? 'open',
            createdAt: job.createdAt ?? new Date().toISOString(),
          },
        });

        const nextAppliedIds = appliedJobIds.includes(job.id)
          ? appliedJobIds
          : [...appliedJobIds, job.id];

        const nextAvailableJobs = availableJobs.map((item) =>
          item.id === job.id ? { ...item, status: 'applied' as const } : item
        );

        setAppliedJobIds(nextAppliedIds);
        setAvailableJobs(nextAvailableJobs);

        await persistState({
          profile,
          myIncarichi: profile.role === 'datore' ? incarichi : [],
          available: nextAvailableJobs,
        });
      } catch (error) {
        console.warn('Failed to create job application:', error);
        throw error;
      }
    },
    [profile, appliedJobIds, availableJobs, persistState, incarichi]
  );

  const value = useMemo(
    () => ({
      profile,
      incarichi,
      availableJobs,
      loading,
      login,
      logout,
      addIncarico,
      refreshAvailableJobs,
      applyToJob,
      updateCv: async (cv: WorkerCV) => {
        if (!profile) throw new Error('Profilo non disponibile');
        await upsertUserProfile({
          name: profile.nome,
          surname: profile.cognome,
          birthDate: profile.dataNascita,
          role: profile.role,
          passwordHash: profile.passwordHash,
          username: profile.username ?? undefined,
          profileId: profile.profileId,
          cv,
        });
        const nextProfile = { ...profile, cv } as Profile;
        setProfile(nextProfile);
        await persistState({
          profile: nextProfile,
          myIncarichi: profile.role === 'datore' ? incarichi : [],
          available: availableJobs,
        });
      },
      updatePhone: async (phoneNumber: string) => {
        if (!profile) throw new Error('Profilo non disponibile');
        const sanitized = phoneNumber.trim();
        if (!sanitized.startsWith('+') || sanitized.length < 7) {
          throw new Error('Numero di telefono non valido');
        }
        await upsertUserProfile({
          name: profile.nome,
          surname: profile.cognome,
          birthDate: profile.dataNascita,
          role: profile.role,
          passwordHash: profile.passwordHash,
          username: profile.username ?? undefined,
          profileId: profile.profileId,
          phoneNumber: sanitized,
        });
        const nextProfile = { ...profile, phoneNumber: sanitized } as Profile;
        setProfile(nextProfile);
        await persistState({
          profile: nextProfile,
          myIncarichi: profile.role === 'datore' ? incarichi : [],
          available: availableJobs,
        });
      },
    }),
    [
      profile,
      incarichi,
      availableJobs,
      loading,
      login,
      logout,
      addIncarico,
      refreshAvailableJobs,
      applyToJob,
      persistState,
    ]
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context) return context;
  // Return a safe fallback to avoid crashes during transient unmounts
  return {
    profile: null,
    incarichi: [],
    availableJobs: [],
    loading: true,
    login: async () => {},
    logout: async () => {},
    addIncarico: async () => Promise.reject(new Error('Profile provider not ready')),
    refreshAvailableJobs: async () => {},
    applyToJob: async () => {},
    updateCv: async () => {},
    updatePhone: async () => {},
  } satisfies ProfileContextValue;
};
