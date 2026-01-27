import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { subscribeToMessages, sendMessage, markChatOpened, type ChatMessage } from '../../../configuratore/lib/api';
import { db } from '../../../configuratore/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useProfile } from '../../../configuratore/app/profile-context';
import { useTheme, useThemedStyles } from '../../../configuratore/app/theme';
import { useChatNotifications } from '../../../configuratore/app/chat-notifications';

const ChatScreen: React.FC = () => {
  const router = useRouter();
  const { chatId: raw } = useLocalSearchParams<{ chatId?: string }>();
  const chatId = Array.isArray(raw) ? raw[0] : raw;
  const { profile } = useProfile();
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const { setActiveChatId } = useChatNotifications();

  useEffect(() => {
    if (!chatId) return;
    const unsub = subscribeToMessages(chatId, (docs) => {
      setMessages(docs);
      setLoading(false);
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
    });
    return () => unsub();
  }, [chatId]);

  useEffect(() => {
    let cancelled = false;
    const loadOther = async () => {
      if (!chatId || !profile) return;
      try {
        const snap = await getDoc(doc(db, 'chats', chatId));
        const data = snap.data() ?? {};
        const otherId = profile.role === 'datore' ? data.workerId : data.employerId;
        if (typeof otherId === 'string' && otherId) {
          const pSnap = await getDoc(doc(db, 'profiles', otherId));
          const p = pSnap.data() as Record<string, any> | undefined;
          if (!cancelled && p) {
            const nome = typeof p.nome === 'string' ? p.nome : (typeof p.name === 'string' ? p.name : '');
            const cognome = typeof p.cognome === 'string' ? p.cognome : (typeof p.surname === 'string' ? p.surname : '');
            const full = `${nome} ${cognome}`.trim();
            const resolved = full || otherId;
            router.setParams({ otherName: resolved });
          }
        }
      } catch {
        // ignore
      }
    };
    void loadOther();
    return () => {
      cancelled = true;
    };
  }, [chatId, profile]);

  const handleSend = async () => {
    if (!chatId || !profile) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    try {
      setInput('');
      await sendMessage(chatId, profile.profileId, trimmed);
    } catch (e) {
      console.warn('sendMessage failed', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!chatId || !profile) return;
      markChatOpened(chatId, profile.role);
      setActiveChatId(chatId);
      return () => setActiveChatId(null);
    }, [chatId, profile, setActiveChatId])
  );

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isMine = profile?.profileId === item.senderId;
    return (
      <View
        style={[
          styles.bubbleRow,
          isMine ? styles.bubbleRowRight : styles.bubbleRowLeft,
        ]}
      >
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isMine ? theme.colors.primary : theme.colors.card,
            },
            isMine && styles.bubbleMine,
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              { color: isMine ? theme.colors.surface : theme.colors.textPrimary },
            ]}
          >
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  const keyExtractor = (item: ChatMessage) => item.id;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <View style={styles.listWrapper}>
          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />
          )}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Scrivi un messaggio"
            placeholderTextColor={theme.colors.muted}
            multiline
          />
          <Pressable
            style={[styles.sendBtn, { backgroundColor: theme.colors.primary }]}
            onPress={handleSend}
            accessibilityRole="button"
          >
            <Ionicons name="send" size={18} color={theme.colors.surface} />
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
    listWrapper: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    bubbleRow: { flexDirection: 'row', marginVertical: 2 },
    bubbleRowLeft: { justifyContent: 'flex-start' },
    bubbleRowRight: { justifyContent: 'flex-end' },
    bubble: {
      maxWidth: '78%',
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    bubbleMine: {
      borderColor: t.colors.primary,
    },
    bubbleText: { fontSize: 15 },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
      backgroundColor: t.colors.surface,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    textInput: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
      color: t.colors.textPrimary,
      fontSize: 15,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export default ChatScreen;
