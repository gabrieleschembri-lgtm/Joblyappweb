import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, Vibration } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { db, ensureSignedIn } from '../lib/firebase';
import { useProfile } from './profile-context';
import { useThemedStyles } from './theme';

type HireBanner = {
  hireId: string;
  employerName: string;
  chatId?: string | null;
};

type HireNotificationContextValue = {
  lastNotifiedHireId: string | null;
};

const HireNotificationContext = createContext<HireNotificationContextValue | undefined>(undefined);

export const HireNotificationProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useProfile();
  const styles = useThemedStyles((t) => createStyles(t));
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const [banner, setBanner] = useState<HireBanner | null>(null);
  const [lastNotifiedHireId, setLastNotifiedHireId] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const lastNotifiedRef = useRef<string | null>(null);
  const nameCacheRef = useRef<Map<string, string>>(new Map());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!profile || profile.role !== 'lavoratore') {
      setBanner(null);
      setLastNotifiedHireId(null);
      lastSeenRef.current = new Map();
      lastNotifiedRef.current = null;
      nameCacheRef.current = new Map();
      initializedRef.current = false;
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const start = async () => {
      try {
        const uid = await ensureSignedIn();
        if (cancelled) return;

        const hiresRef = collection(db, 'hires');
        const q = query(
          hiresRef,
          where('workerUid', '==', uid),
          where('status', '==', 'proposed'),
          orderBy('updatedAt', 'desc')
        );

        unsubscribe = onSnapshot(
          q,
          async (snap) => {
            if (!snap) return;

            if (!initializedRef.current) {
              const seed = new Map<string, number>();
              snap.docs.forEach((docSnap) => {
                const data = docSnap.data() ?? {};
                const ts = data.updatedAt?.toDate?.() ?? data.createdAt?.toDate?.() ?? null;
                if (ts instanceof Date) seed.set(docSnap.id, ts.getTime());
              });
              lastSeenRef.current = seed;
              initializedRef.current = true;
              return;
            }

            const isOnProposals = pathname?.includes('/configuratore/proposte');
            let latest: HireBanner | null = null;
            const nextSeen = new Map(lastSeenRef.current);

            for (const docSnap of snap.docs) {
              const data = docSnap.data() ?? {};
              const ts = data.updatedAt?.toDate?.() ?? data.createdAt?.toDate?.() ?? null;
              const time = ts instanceof Date ? ts.getTime() : 0;
              const prev = lastSeenRef.current.get(docSnap.id) ?? 0;
              nextSeen.set(docSnap.id, time);

              if (time <= prev) continue;

              const chatId = typeof data.chatId === 'string' ? data.chatId : null;
              const isOnChat = chatId
                ? pathname?.startsWith('/configuratore/chat/') && pathname?.includes(chatId)
                : false;

              if (isOnProposals || isOnChat) {
                continue;
              }

              let employerName = '';
              const employerProfileId = typeof data.employerProfileId === 'string' ? data.employerProfileId : '';
              if (employerProfileId) {
                const cached = nameCacheRef.current.get(employerProfileId);
                if (cached) {
                  employerName = cached;
                } else {
                  try {
                    const snapProfile = await getDoc(doc(db, 'profiles', employerProfileId));
                    const pdata = snapProfile.data() as Record<string, any> | undefined;
                    const nome = typeof pdata?.nome === 'string' ? pdata.nome : (typeof pdata?.name === 'string' ? pdata.name : '');
                    const cognome = typeof pdata?.cognome === 'string' ? pdata.cognome : (typeof pdata?.surname === 'string' ? pdata.surname : '');
                    employerName = `${nome} ${cognome}`.trim();
                    if (employerName) {
                      nameCacheRef.current.set(employerProfileId, employerName);
                    }
                  } catch {
                    // ignore profile lookup errors
                  }
                }
              }

              latest = {
                hireId: docSnap.id,
                employerName: employerName || 'Un datore',
                chatId,
              };
            }

            lastSeenRef.current = nextSeen;

            if (latest && latest.hireId !== lastNotifiedRef.current) {
              if (timerRef.current) clearTimeout(timerRef.current);
              setBanner(latest);
              setLastNotifiedHireId(latest.hireId);
              lastNotifiedRef.current = latest.hireId;
              Vibration.vibrate(200);
              timerRef.current = setTimeout(() => setBanner(null), 3000);
            }
          },
          (error) => {
            const code = (error as { code?: string }).code;
            if (code === 'failed-precondition') {
              console.warn('[HIRE_DEBUG] Missing index for hire notifications:', (error as Error).message);
            } else {
              console.warn('[HIRE_DEBUG] Hire notifications error:', error);
            }
          }
        );
      } catch (error) {
        console.warn('[HIRE_DEBUG] Hire notifications auth error:', error);
      }
    };

    void start();

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [profile, pathname]);

  const handleBannerPress = useCallback(() => {
    if (!banner) return;
    router.push('/configuratore/proposte');
    setBanner(null);
  }, [banner, router]);

  return (
    <HireNotificationContext.Provider value={{ lastNotifiedHireId }}>
      {children}
      {banner ? (
        <Pressable style={[styles.banner, { paddingTop: insets.top + 8 }]} onPress={handleBannerPress}>
          <View style={styles.bannerTextBlock}>
            <Text style={styles.bannerTitle}>
              {banner.employerName} ti ha scelto per un incarico
            </Text>
            <Text style={styles.bannerMessage}>Apri le proposte per rispondere.</Text>
          </View>
        </Pressable>
      ) : null}
    </HireNotificationContext.Provider>
  );
};

export const useHireNotifications = () => {
  const ctx = useContext(HireNotificationContext);
  if (!ctx) throw new Error('useHireNotifications must be used within HireNotificationProvider');
  return ctx;
};

const createStyles = (t: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    banner: {
      position: 'absolute',
      left: 12,
      right: 12,
      top: 0,
      borderRadius: 12,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      paddingHorizontal: 14,
      paddingBottom: 12,
      paddingTop: 10,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
      gap: 4,
    },
    bannerTextBlock: { gap: 4 },
    bannerTitle: { fontSize: 14, fontWeight: '700', color: t.colors.textPrimary },
    bannerMessage: { fontSize: 13, color: t.colors.textSecondary },
  });
