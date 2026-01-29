// app/lib/firebase.ts
import { Platform } from "react-native";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  browserLocalPersistence,
  getAuth,
  initializeAuth,
  setPersistence,
  signInAnonymously,
} from "firebase/auth";
import { getReactNativePersistence } from "firebase/auth/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

export const auth =
  Platform.OS === "web"
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });

if (Platform.OS === "web") {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn("[AUTH] Failed to set web persistence", error);
  });
}

export const authReady = ensureAnonAuth();

// Assicurati di avere un uid anche in Release
export async function ensureAnonAuth(): Promise<string> {
  const u = auth.currentUser;
  if (u?.uid) return u.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

export async function ensureSignedIn(): Promise<string> {
  return ensureAnonAuth();
}
