import { doc, getDoc, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';

import { db } from '../lib/firebase';
import type { Profile } from './profile-context';

export type ChatListItem = {
  otherId: string;
  id: string;
  lastMessage: string;
  lastMessageAt: Date | null;
  lastSenderId: string | null;
  otherName: string;
  assignmentTitle: string;
  isUnread: boolean;
};

const mapTimestamp = (value: unknown): Date | null => {
  if (value && typeof value === 'object' && typeof (value as any).toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
};

export async function mapChatDocToItem(
  profile: Profile,
  docSnap: QueryDocumentSnapshot<DocumentData>
): Promise<ChatListItem> {
  const data = docSnap.data() ?? {};
  const employerId = typeof data.employerId === 'string' ? data.employerId : '';
  const workerId = typeof data.workerId === 'string' ? data.workerId : '';
  const lastAt =
    mapTimestamp(data.updatedAt) ??
    mapTimestamp(data.lastMessageAt) ??
    mapTimestamp(data.createdAt) ??
    null;

  const otherId =
    profile.role === 'datore'
      ? (workerId || '')
      : (employerId || '');

  let otherName = otherId || 'Utente';
  try {
    if (otherId) {
      const pSnap = await getDoc(doc(db, 'profiles', otherId));
      const p = pSnap.data() as Record<string, unknown> | undefined;
      if (p) {
        const nome = typeof p.nome === 'string' ? p.nome : (typeof (p as any).name === 'string' ? (p as any).name : '');
        const cognome = typeof p.cognome === 'string' ? p.cognome : (typeof (p as any).surname === 'string' ? (p as any).surname : '');
        otherName = `${nome ?? ''} ${cognome ?? ''}`.trim() || otherId;
      }
    }
  } catch {
    // ignore name fetch errors
  }

  let assignmentTitle = typeof data.assignmentId === 'string' ? data.assignmentId : 'Incarico';
  try {
    if (typeof data.assignmentId === 'string' && data.assignmentId) {
      const jobSnap = await getDoc(doc(db, 'jobs', data.assignmentId));
      const job = jobSnap.data() as Record<string, any> | undefined;
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

  const lastMessageRaw = typeof data.lastMessage === 'string' ? data.lastMessage : '';
  const lastMessage = lastMessageRaw.length > 160 ? `${lastMessageRaw.slice(0, 157)}...` : lastMessageRaw;
  const lastOpened = mapTimestamp(
    profile.role === 'datore' ? data.lastOpenedAtByEmployer : data.lastOpenedAtByWorker
  );
  const lastSenderId = typeof data.lastSenderId === 'string' ? data.lastSenderId : null;
  const isUnread = Boolean(
    lastAt &&
      lastSenderId &&
      lastSenderId !== profile.profileId &&
      (!lastOpened || lastAt.getTime() > lastOpened.getTime())
  );

  return {
    otherId: otherId || docSnap.id,
    id: docSnap.id,
    lastMessage,
    lastMessageAt: lastAt,
    lastSenderId,
    otherName,
    assignmentTitle,
    isUnread,
  };
}

export const groupChatItemsByCounterpart = (items: ChatListItem[]): ChatListItem[] => {
  const grouped = new Map<string, ChatListItem>();
  items.forEach((item) => {
    const key = item.otherId || item.id;
    const ts = item.lastMessageAt?.getTime() ?? 0;
    const existing = grouped.get(key);
    const existingTs = existing?.lastMessageAt?.getTime() ?? 0;
    if (!existing || ts >= existingTs) {
      grouped.set(key, item);
    }
  });
  return Array.from(grouped.values()).sort(
    (a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0)
  );
};
