// app/lib/firebase.ts
import { Platform } from "react-native";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import * as FirebaseAuth from "firebase/auth";
import type { Persistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const {
  browserLocalPersistence,
  getAuth,
  initializeAuth,
  setPersistence,
  signInAnonymously,
  signOut,
} = FirebaseAuth;

const getReactNativePersistence = (
  FirebaseAuth as typeof FirebaseAuth & {
    getReactNativePersistence(storage: typeof AsyncStorage): Persistence;
  }
).getReactNativePersistence;

// ⬇️ Incolla qui la config Web presa da Firebase Console (Project settings → Web app)
export const firebaseConfig = {
  apiKey: "AIzaSyC0anHGQ6rfEn7TuD_V8R7sia9nZsbAxIg",
  authDomain: "jobly-4608c.firebaseapp.com",
  projectId: "jobly-4608c",
  storageBucket: "jobly-4608c.firebasestorage.app",
  messagingSenderId: "540406329601",
  appId: "1:540406329601:web:ced6e2551e8bef2d1a2b00",
};

export const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

export const db = getFirestore(app);

let authInstance: ReturnType<typeof getAuth>;

if (Platform.OS === "web") {
  authInstance = getAuth(app);
} else {
  try {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    authInstance = getAuth(app);
  }
}

export const auth = authInstance;

if (Platform.OS === "web") {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn("[AUTH] Failed to set web persistence", error);
  });
}

const canStartAuth = Platform.OS !== "web" || typeof window !== "undefined";

export const authReady = canStartAuth ? ensureAnonAuth() : Promise.resolve("");

// Assicurati di avere un uid anche in Release
export async function ensureAnonAuth(): Promise<string> {
  const u = auth.currentUser;
  if (u?.uid) return u.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

export async function ensureAnonymousAuth(): Promise<string> {
  const currentUser = auth.currentUser;
  if (currentUser?.isAnonymous && currentUser.uid) {
    return currentUser.uid;
  }
  if (currentUser) {
    await signOut(auth);
  }
  const credential = await signInAnonymously(auth);
  return credential.user.uid;
}

export async function ensureSignedIn(): Promise<string> {
  return ensureAnonAuth();
}
