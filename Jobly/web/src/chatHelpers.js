import { doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'

const mapTimestamp = (value) => {
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    try {
      return value.toDate()
    } catch {
      return null
    }
  }
  return null
}

export async function mapChatDocToItem(profile, docSnap) {
  const data = docSnap.data() || {}
  const employerId = typeof data.employerId === 'string' ? data.employerId : ''
  const workerId = typeof data.workerId === 'string' ? data.workerId : ''
  const lastAt =
    mapTimestamp(data.updatedAt) ||
    mapTimestamp(data.lastMessageAt) ||
    mapTimestamp(data.createdAt) ||
    null

  const otherId = profile.role === 'datore' ? workerId || '' : employerId || ''

  let otherName = otherId || 'Utente'
  try {
    if (otherId) {
      const pSnap = await getDoc(doc(db, 'profiles', otherId))
      const p = pSnap.data() || {}
      const nome = typeof p.nome === 'string' ? p.nome : typeof p.name === 'string' ? p.name : ''
      const cognome = typeof p.cognome === 'string' ? p.cognome : typeof p.surname === 'string' ? p.surname : ''
      otherName = `${nome} ${cognome}`.trim() || otherId
    }
  } catch {
    // ignore name fetch errors
  }

  let assignmentTitle = typeof data.assignmentId === 'string' ? data.assignmentId : 'Incarico'
  try {
    if (typeof data.assignmentId === 'string' && data.assignmentId) {
      const jobSnap = await getDoc(doc(db, 'jobs', data.assignmentId))
      const job = jobSnap.data() || {}
      const cat = job?.tipo?.categoria
      const altro = job?.tipo?.altroDettaglio
      assignmentTitle =
        cat === 'altro'
          ? altro || 'Altro'
          : typeof cat === 'string'
            ? cat.charAt(0).toUpperCase() + cat.slice(1)
            : assignmentTitle
    }
  } catch {
    // ignore job fetch errors
  }

  const lastMessageRaw = typeof data.lastMessage === 'string' ? data.lastMessage : ''
  const lastMessage = lastMessageRaw.length > 160 ? `${lastMessageRaw.slice(0, 157)}...` : lastMessageRaw
  const lastOpened = mapTimestamp(profile.role === 'datore' ? data.lastOpenedAtByEmployer : data.lastOpenedAtByWorker)
  const lastSenderId = typeof data.lastSenderId === 'string' ? data.lastSenderId : null
  const isUnread = Boolean(
    lastAt &&
      lastSenderId &&
      lastSenderId !== profile.profileId &&
      (!lastOpened || lastAt.getTime() > lastOpened.getTime())
  )

  return {
    otherId: otherId || docSnap.id,
    id: docSnap.id,
    lastMessage,
    lastMessageAt: lastAt,
    lastSenderId,
    otherName,
    assignmentTitle,
    isUnread,
  }
}

export const groupChatItemsByCounterpart = (items) => {
  const grouped = new Map()
  items.forEach((item) => {
    const key = item.otherId || item.id
    const ts = item.lastMessageAt?.getTime?.() ?? 0
    const existing = grouped.get(key)
    const existingTs = existing?.lastMessageAt?.getTime?.() ?? 0
    if (!existing || ts >= existingTs) {
      grouped.set(key, item)
    }
  })
  return Array.from(grouped.values()).sort(
    (a, b) => (b.lastMessageAt?.getTime?.() ?? 0) - (a.lastMessageAt?.getTime?.() ?? 0)
  )
}
