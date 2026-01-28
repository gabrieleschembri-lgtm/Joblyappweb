import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { db, ensureSignedIn } from './firebase'

const normalizeValue = (input) => {
  if (typeof input !== 'string') return ''
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

const normalizeUsername = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '')

const hashPassword = (password) => {
  let hash = 5381
  for (let i = 0; i < password.length; i += 1) {
    hash = (hash * 33) ^ password.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

const timingSafeEquals = (a, b) => {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

const buildAuthError = (code, message) => {
  const error = new Error(message)
  error.code = code
  return error
}

const mapProfile = (data, fallback, fallbackId) => {
  const role = data.role === 'lavoratore' ? 'lavoratore' : 'datore'
  const nome = typeof data.nome === 'string' ? data.nome : typeof data.name === 'string' ? data.name : fallback?.nome || ''
  const cognome =
    typeof data.cognome === 'string' ? data.cognome : typeof data.surname === 'string' ? data.surname : fallback?.cognome || ''
  const dataNascita =
    typeof data.dataNascita === 'string' ? data.dataNascita : typeof data.birthDate === 'string' ? data.birthDate : fallback?.dataNascita || ''
  const profileId = typeof data.profileId === 'string' && data.profileId.trim().length > 0 ? data.profileId : fallbackId
  const passwordHash =
    typeof data.passwordHash === 'string' && data.passwordHash.trim().length > 0
      ? data.passwordHash
      : fallback?.passwordHash || ''

  return {
    role,
    nome,
    cognome,
    dataNascita,
    profileId,
    passwordHash,
    ...(data.business ? { business: data.business } : {}),
    ...(data.cv ? { cv: data.cv } : {}),
    ...(typeof data.username === 'string' && data.username.trim().length > 0 ? { username: data.username } : {}),
    ...(typeof data.email === 'string' && data.email.trim().length > 0 ? { email: data.email } : {}),
  }
}

export async function getProfileByEmail(email) {
  await ensureSignedIn()
  const normalizedEmail = normalizeValue(email)
  const profilesRef = collection(db, 'profiles')
  const matches = await getDocs(query(profilesRef, where('emailLower', '==', normalizedEmail)))
  if (matches.empty) {
    throw buildAuthError('auth/profile-not-found', "Profilo non trovato per l'email inserita.")
  }
  const docSnap = matches.docs[0]
  const data = docSnap.data() || {}
  return mapProfile(data, { email }, docSnap.id)
}

export async function authenticateProfile(payload) {
  await ensureSignedIn()

  const normalizedName = payload.nome ? normalizeValue(payload.nome) : ''
  const normalizedSurname = payload.cognome ? normalizeValue(payload.cognome) : ''

  let profileSnap = null

  if (payload.username && payload.username.trim().length > 0) {
    const usernameLower = normalizeUsername(payload.username)
    const profilesRef = collection(db, 'profiles')
    const matches = await getDocs(query(profilesRef, where('usernameLower', '==', usernameLower)))
    if (matches.empty) {
      throw buildAuthError('auth/profile-not-found', "Profilo non trovato con l'username inserito.")
    }
    profileSnap = { data: () => matches.docs[0].data(), id: matches.docs[0].id }
  } else if (payload.nome && payload.cognome) {
    const profilesRef = collection(db, 'profiles')
    let candidates = await getDocs(
      query(profilesRef, where('searchName', '==', normalizedName), where('searchSurname', '==', normalizedSurname))
    )
    let docs = candidates.docs
    if (candidates.empty) {
      const nameSnapshot = await getDocs(query(profilesRef, where('name', '==', payload.nome)))
      docs = nameSnapshot.docs.filter((docSnap) => {
        const docData = docSnap.data() || {}
        return normalizeValue(docData.surname || '') === normalizedSurname
      })
      if (docs.length === 0) {
        const surnameSnapshot = await getDocs(query(profilesRef, where('surname', '==', payload.cognome)))
        docs = surnameSnapshot.docs.filter((docSnap) => {
          const docData = docSnap.data() || {}
          return normalizeValue(docData.name || '') === normalizedName
        })
      }
      if (docs.length === 0) {
        throw buildAuthError('auth/profile-not-found', 'Profilo non trovato con i dati inseriti.')
      }
    }

    const candidateHash = hashPassword(payload.password)
    const matchingDoc = docs.find((docSnap) => {
      const docData = docSnap.data() || {}
      const storedHash =
        typeof docData.passwordHash === 'string' && docData.passwordHash.trim().length > 0 ? docData.passwordHash : null
      const storedPassword =
        typeof docData.password === 'string' && docData.password.trim().length > 0 ? docData.password : null

      if (storedHash) {
        return timingSafeEquals(storedHash, candidateHash) || timingSafeEquals(storedHash, payload.password)
      }
      if (storedPassword) {
        return timingSafeEquals(storedPassword, payload.password)
      }
      return false
    })

    if (!matchingDoc) {
      throw buildAuthError('auth/invalid-password', 'La password non e` corretta.')
    }

    profileSnap = { data: () => matchingDoc.data(), id: matchingDoc.id }
  } else {
    throw buildAuthError('auth/invalid-input', 'Compila almeno username o nome e cognome.')
  }

  const resolvedProfileId = profileSnap.id
  const profileRef = doc(db, 'profiles', resolvedProfileId)
  const data = profileSnap.data() || {}

  const storedHash =
    typeof data.passwordHash === 'string' && data.passwordHash.trim().length > 0 ? data.passwordHash : null
  const storedPassword =
    typeof data.password === 'string' && data.password.trim().length > 0 ? data.password : null
  const candidateHash = hashPassword(payload.password)

  if (storedHash) {
    const matches = timingSafeEquals(storedHash, candidateHash) || timingSafeEquals(storedHash, payload.password)
    if (!matches) {
      throw buildAuthError('auth/invalid-password', 'La password non e` corretta.')
    }
  } else if (storedPassword) {
    if (!timingSafeEquals(storedPassword, payload.password)) {
      throw buildAuthError('auth/invalid-password', 'La password non e` corretta.')
    }
  }

  const safeProfileId =
    typeof data.profileId === 'string' && data.profileId.trim().length > 0 ? data.profileId : resolvedProfileId

  if (!storedHash) {
    await setDoc(profileRef, { passwordHash: candidateHash, profileId: safeProfileId }, { merge: true })
  }

  return mapProfile(data, payload, safeProfileId)
}
