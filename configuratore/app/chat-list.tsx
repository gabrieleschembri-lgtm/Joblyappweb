import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { db } from '../lib/firebase';
import { getOrCreatePairChat } from '../lib/api';
import { groupChatItemsByCounterpart, mapChatDocToItem, type ChatListItem } from './chat-helpers';
import { useProfile } from './profile-context';
import { useTheme, useThemedStyles } from './theme';

const ChatListScreen: React.FC = () => {
  const router = useRouter();
  const { profile } = useProfile();
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));
  const isWorker = profile?.role === 'lavoratore';

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ChatListItem[]>([]);

  const emptyCopy = useMemo(
    () =>
      isWorker
        ? {
            title: 'Nessuna conversazione',
            subtitle: 'Quando un datore ti contatta, vedrai qui i suoi messaggi.',
          }
        : {
            title: 'Ancora nessuna conversazione',
            subtitle: 'Scrivi o rispondi ai candidati per iniziare una chat.',
          },
    [isWorker]
  );

  useEffect(() => {
    if (!profile) {
      setItems([]);
      setLoading(false);
      return;
    }
    console.log('ChatList mounted for user', profile.profileId);
    setLoading(true);
    let cancelled = false;

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
          if (!cancelled) {
            const grouped = groupChatItemsByCounterpart(mapped);
            console.log(`Loaded ${grouped.length} chats for user ${profile.profileId}`);
            setItems(grouped);
          }
        } catch (err) {
          console.warn('Chat list mapping error', err);
          if (!cancelled) {
            setItems([]);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      },
      (error) => {
        console.warn('Chat list subscribe error', error);
        if (!cancelled) {
          setLoading(false);
          setItems([]);
        }
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [profile]);

  const handleOpenChat = useCallback(
    async (item: ChatListItem) => {
      if (!profile) return;
      try {
        const employerId = profile.role === 'datore' ? profile.profileId : item.otherId;
        const workerId = profile.role === 'lavoratore' ? profile.profileId : item.otherId;
        if (!employerId || !workerId) return;
        const chat = await getOrCreatePairChat(employerId, workerId);
        router.push({
          pathname: '/configuratore/chat/[chatId]',
          params: { chatId: chat.id, otherName: item.otherName },
        });
      } catch (e) {
        console.warn('Failed to open chat', e);
      }
    },
    [profile, router]
  );

  const renderItem = ({ item }: { item: ChatListItem }) => (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      onPress={() => handleOpenChat(item)}
    >
      <View style={styles.itemHeader}>
        <Text style={[styles.itemTitle, item.isUnread && styles.itemTitleUnread]}>
          {item.otherName}
        </Text>
        {item.lastMessageAt ? (
          <Text style={styles.itemTime}>
            {item.lastMessageAt.toLocaleString('it-IT', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
            })}
          </Text>
        ) : null}
      </View>
      <View style={styles.itemSubtitleRow}>
        <Text style={[styles.itemLast, item.isUnread && styles.itemLastUnread]}>
          {item.lastMessage || 'Nessun messaggio'}
        </Text>
        {item.isUnread ? <View style={styles.unreadDot} /> : null}
      </View>
    </Pressable>
  );

  const keyExtractor = (item: ChatListItem) => item.otherId || item.id;

  if (!profile) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.textPrimary} />
            <Text style={styles.backText}>Indietro</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Chat</Text>
          <View style={{ width: 70 }} />
        </View>
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-ellipses-outline" size={26} color={theme.colors.muted} />
            <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
            <Text style={styles.emptyText}>{emptyCopy.subtitle}</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const createStyles = (t: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: t.colors.background },
    container: { flex: 1, backgroundColor: t.colors.background, padding: 16, gap: 12 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { fontSize: 20, fontWeight: '700', color: t.colors.textPrimary },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8 },
    backText: { fontSize: 14, color: t.colors.textPrimary, fontWeight: '600' },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: t.colors.textPrimary },
    emptyText: { fontSize: 14, color: t.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
    listContent: { gap: 10, paddingBottom: 24 },
    item: {
      backgroundColor: t.colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    itemPressed: { transform: [{ scale: 0.98 }] },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    itemTitle: { fontSize: 16, fontWeight: '700', color: t.colors.textPrimary },
    itemTitleUnread: { fontWeight: '800', color: t.colors.textPrimary },
    itemTime: { fontSize: 12, color: t.colors.textSecondary },
    itemSubtitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    itemSubtitle: { fontSize: 13, color: t.colors.textSecondary, flex: 1 },
    itemLast: { fontSize: 13, color: t.colors.textPrimary, flex: 1 },
    itemLastUnread: { fontWeight: '700', color: t.colors.textPrimary },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.primary, marginLeft: 8 },
  });

export default ChatListScreen;
