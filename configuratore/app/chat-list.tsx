import React, { useEffect, useMemo, useState } from 'react';
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
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  getDoc,
  doc,
} from 'firebase/firestore';

import { db } from '../lib/firebase';
import { useProfile } from './profile-context';
import { useTheme, useThemedStyles } from './theme';

type ChatListItem = {
  id: string;
  lastMessage: string;
  lastMessageAt: Date | null;
  otherName: string;
  assignmentTitle: string;
};

const ChatListScreen: React.FC = () => {
  const router = useRouter();
  const { profile } = useProfile();
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ChatListItem[]>([]);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
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
            snap.docs.map(async (docSnap) => {
              const data = docSnap.data() ?? {};
              const lastAt =
                data.updatedAt?.toDate?.() ??
                data.lastMessageAt?.toDate?.() ??
                null;
              const otherId =
                profile.role === 'datore' ? data.workerId : data.employerId;
              let otherName = otherId || 'Utente';
              try {
                if (otherId) {
                  const pSnap = await getDoc(doc(db, 'profiles', otherId));
                  const p = pSnap.data() as any;
                  if (p) {
                    const nome = typeof p.nome === 'string' ? p.nome : (typeof p.name === 'string' ? p.name : '');
                    const cognome = typeof p.cognome === 'string' ? p.cognome : (typeof p.surname === 'string' ? p.surname : '');
                    otherName = `${nome} ${cognome}`.trim() || otherId;
                  }
                }
              } catch {
                // ignore name fetch errors
              }
              let assignmentTitle = data.assignmentId || 'Incarico';
              try {
                if (data.assignmentId) {
                  const jobSnap = await getDoc(doc(db, 'jobs', data.assignmentId));
                  const job = jobSnap.data() as any;
                  const cat = job?.tipo?.categoria;
                  const altro = job?.tipo?.altroDettaglio;
                  assignmentTitle =
                    cat === 'altro'
                      ? (altro || 'Altro')
                      : typeof cat === 'string'
                        ? cat.charAt(0).toUpperCase() + cat.slice(1)
                        : assignmentTitle;
                }
              } catch {
                // ignore job fetch errors
              }
              return {
                id: docSnap.id,
                lastMessage: data.lastMessage ?? '',
                lastMessageAt: lastAt,
                otherName,
                assignmentTitle,
              } as ChatListItem;
            })
          );
          setItems(mapped);
        } catch (err) {
          console.warn('Chat list mapping error', err);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.warn('Chat list subscribe error', error);
        setLoading(false);
        setItems([]);
      }
    );

    return () => unsub();
  }, [profile]);

  const renderItem = ({ item }: { item: ChatListItem }) => (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      onPress={() => router.push(`/configuratore/chat/${encodeURIComponent(item.id)}`)}
    >
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle}>{item.otherName}</Text>
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
      <Text style={styles.itemSubtitle}>{item.assignmentTitle}</Text>
      {item.lastMessage ? (
        <Text style={styles.itemLast}>{item.lastMessage}</Text>
      ) : (
        <Text style={styles.itemLastMuted}>Nessun messaggio</Text>
      )}
    </Pressable>
  );

  const keyExtractor = (item: ChatListItem) => item.id;

  if (!profile) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Chat</Text>
        </View>
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.loader}>
            <Text style={styles.emptyText}>Nessuna chat disponibile.</Text>
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
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontSize: 14, color: t.colors.textSecondary },
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
    itemTime: { fontSize: 12, color: t.colors.textSecondary },
    itemSubtitle: { fontSize: 13, color: t.colors.textSecondary, marginTop: 4 },
    itemLast: { fontSize: 13, color: t.colors.textPrimary, marginTop: 4 },
    itemLastMuted: { fontSize: 13, color: t.colors.muted, marginTop: 4 },
  });

export default ChatListScreen;
