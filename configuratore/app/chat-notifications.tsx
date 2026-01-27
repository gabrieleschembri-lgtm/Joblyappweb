import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, Vibration } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { db } from '../lib/firebase';
import { groupChatItemsByCounterpart, mapChatDocToItem } from './chat-helpers';
import { useProfile } from './profile-context';
import { useTheme, useThemedStyles } from './theme';

type Notification = {
  chatId: string;
  senderName: string;
  message: string;
};

type ChatNotificationContextValue = {
  activeChatId: string | null;
  setActiveChatId: (chatId: string | null) => void;
};

const ChatNotificationContext = createContext<ChatNotificationContextValue | undefined>(undefined);

export const ChatNotificationProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useProfile();
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [banner, setBanner] = useState<Notification | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!profile) {
      setBanner(null);
      lastSeenRef.current = new Map();
      initializedRef.current = false;
      return;
    }

    const chatsRef = collection(db, 'chats');
    const field = profile.role === 'datore' ? 'employerId' : 'workerId';
    const q = query(chatsRef, where(field, '==', profile.profileId), orderBy('updatedAt', 'desc'));

    const unsub = onSnapshot(
      q,
      async (snap) => {
        try {
          const mapped = await Promise.all(
            snap.docs.map((docSnap) => mapChatDocToItem(profile, docSnap))
          );
          const grouped = groupChatItemsByCounterpart(mapped);

          if (!initializedRef.current) {
            const seed = new Map<string, number>();
            grouped.forEach((item) => {
              const ts = item.lastMessageAt?.getTime();
              if (ts) seed.set(item.otherId || item.id, ts);
            });
            lastSeenRef.current = seed;
            initializedRef.current = true;
            return;
          }

          let latest: Notification | null = null;
          const nextSeen = new Map(lastSeenRef.current);

          grouped.forEach((item) => {
            const key = item.otherId || item.id;
            const ts = item.lastMessageAt?.getTime();
            if (!ts) return;
            const prev = lastSeenRef.current.get(key) ?? 0;
            nextSeen.set(key, ts);
            if (
              ts > prev &&
              item.lastSenderId &&
              item.lastSenderId !== profile.profileId &&
              item.id !== activeChatId
            ) {
              latest = {
                chatId: item.id,
                senderName: item.otherName || 'Nuovo messaggio',
                message: item.lastMessage || 'Nuovo messaggio',
              };
            }
          });

          lastSeenRef.current = nextSeen;

          if (latest) {
            if (timerRef.current) clearTimeout(timerRef.current);
            setBanner(latest);
            Vibration.vibrate(200);
            timerRef.current = setTimeout(() => setBanner(null), 2500);
          }
        } catch (err) {
          console.warn('chat notifications error', err);
        }
      },
      (error) => {
        console.warn('chat notifications subscribe error', error);
      }
    );

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [profile, activeChatId]);

  const handleBannerPress = useCallback(() => {
    if (!banner) return;
    const target = `/configuratore/chat/${encodeURIComponent(banner.chatId)}`;
    if (pathname !== target) {
      router.push({
        pathname: '/configuratore/chat/[chatId]',
        params: { chatId: banner.chatId, otherName: banner.senderName },
      });
    }
    setBanner(null);
  }, [banner, pathname, router]);

  return (
    <ChatNotificationContext.Provider value={{ activeChatId, setActiveChatId }}>
      {children}
      {banner ? (
        <Pressable style={[styles.banner, { paddingTop: insets.top + 8 }]} onPress={handleBannerPress}>
          <View style={styles.bannerTextBlock}>
            <Text style={styles.bannerSender}>{banner.senderName}</Text>
            <Text style={styles.bannerMessage}>{banner.message}</Text>
          </View>
        </Pressable>
      ) : null}
    </ChatNotificationContext.Provider>
  );
};

export const useChatNotifications = () => {
  const ctx = useContext(ChatNotificationContext);
  if (!ctx) throw new Error('useChatNotifications must be used within ChatNotificationProvider');
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
    bannerSender: { fontSize: 14, fontWeight: '700', color: t.colors.textPrimary },
    bannerMessage: { fontSize: 13, color: t.colors.textSecondary },
  });
