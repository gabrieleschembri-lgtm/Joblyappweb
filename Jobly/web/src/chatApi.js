import { addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
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

const mapChatDoc = (snap) => {
  const data = snap.data() || {}
  return {
    id: snap.id,
    assignmentId: data.assignmentId || '',
    employerId: data.employerId || '',
    workerId: data.workerId || '',
    lastMessage: data.lastMessage || '',
    lastSenderId: data.lastSenderId || '',
    lastMessageAt: mapTimestamp(data.lastMessageAt),
    createdAt: mapTimestamp(data.createdAt),
    updatedAt: mapTimestamp(data.updatedAt),
  }
}

export async function getOrCreateChat(assignmentId, employerId, workerId) {
  const chatsCol = collection(db, 'chats')
  const deterministicId = `${employerId}__${workerId}`
  const deterministicRef = doc(chatsCol, deterministicId)
  const existingById = await getDoc(deterministicRef)
  if (existingById.exists()) {
    return mapChatDoc(existingById)
  }

  const existing = await getDocs(
    query(
      chatsCol,
      where('employerId', '==', employerId),
      where('workerId', '==', workerId),
      orderBy('updatedAt', 'desc'),
      limit(1)
    )
  )
  if (!existing.empty) {
    return mapChatDoc(existing.docs[0])
  }

  await setDoc(deterministicRef, {
    assignmentId: assignmentId || '',
    employerId,
    workerId,
    lastMessage: '',
    lastSenderId: '',
    lastMessageAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  const fresh = await getDoc(deterministicRef)
  return mapChatDoc(fresh)
}

export async function getOrCreatePairChat(employerId, workerId, assignmentId) {
  return getOrCreateChat(assignmentId, employerId, workerId)
}

export async function sendMessage(chatId, senderId, text) {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('Message text cannot be empty')
  }
  const chatRef = doc(db, 'chats', chatId)
  const messagesCol = collection(chatRef, 'messages')

  await addDoc(messagesCol, {
    senderId,
    text: trimmed,
    createdAt: serverTimestamp(),
  })

  await updateDoc(chatRef, {
    lastMessage: trimmed,
    lastMessageAt: serverTimestamp(),
    lastSenderId: senderId,
    updatedAt: serverTimestamp(),
  })
}

export function subscribeToMessages(chatId, callback) {
  const messagesCol = collection(db, 'chats', chatId, 'messages')
  const q = query(messagesCol, orderBy('createdAt', 'asc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const mapped = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() || {}
        return {
          id: docSnap.id,
          senderId: data.senderId || '',
          text: data.text || '',
          createdAt: mapTimestamp(data.createdAt),
        }
      })
      callback(mapped)
    },
    (error) => {
      console.warn('subscribeToMessages error:', error)
      callback([])
    }
  )
}

export async function markChatOpened(chatId, role) {
  const chatRef = doc(db, 'chats', chatId)
  const field = role === 'datore' ? 'lastOpenedAtByEmployer' : 'lastOpenedAtByWorker'
  try {
    await updateDoc(chatRef, { [field]: serverTimestamp() })
  } catch (error) {
    console.warn('Failed to mark chat opened', error)
  }
}
