import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { db } from '../lib/firebase';
import { groupChatItemsByCounterpart, mapChatDocToItem } from './chat-helpers';
import { useProfile } from './profile-context';

export const useUnreadConversations = (): number => {
  const { profile } = useProfile();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!profile) {
      setCount(0);
      return;
    }
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
            const unread = grouped.filter((item) => item.isUnread).length;
            setCount(unread);
          }
        } catch (err) {
          console.warn('Unread conversations calc error', err);
          if (!cancelled) setCount(0);
        }
      },
      (error) => {
        console.warn('Unread conversations subscribe error', error);
        if (!cancelled) setCount(0);
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [profile]);

  return count;
};
