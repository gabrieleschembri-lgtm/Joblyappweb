import { initializeApp, getApps } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyC0anHGQ6rfEn7TuD_V8R7sia9nZsbAxIg',
  authDomain: 'jobly-4608c.firebaseapp.com',
  projectId: 'jobly-4608c',
  storageBucket: 'jobly-4608c.firebasestorage.app',
  messagingSenderId: '540406329601',
  appId: '1:540406329601:web:ced6e2551e8bef2d1a2b00',
}

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

export const ensureSignedIn = async () => {
  if (auth.currentUser?.uid) {
    return auth.currentUser.uid
  }
  const cred = await signInAnonymously(auth)
  return cred.user.uid
}

if (import.meta?.env?.DEV) {
  console.log('[WEB_DEBUG] firebase init ok')
}
