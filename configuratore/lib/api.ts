// configuratore/lib/api.ts
import { db } from "./firebase";
import { ensureSignedIn } from "./firebase";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  query,
  where,
  deleteField,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";

type AuthenticateProfileInput = {
  nome?: string;
  cognome?: string;
  dataNascita?: string;
  username?: string;
  email?: string;
  password: string;
};

type AuthenticatedProfile = {
  role: "datore" | "lavoratore";
  nome: string;
  cognome: string;
  dataNascita: string;
  profileId: string;
  passwordHash: string;
  business?: BusinessPayload & { updatedAt?: string };
  cv?: WorkerCV;
  username?: string;
  email?: string;
};

export type BusinessPayload = {
  type: 'bar' | 'ristorante' | 'cafe' | 'altro';
  otherDetail?: string;
  address: {
    street: string;
    number: string;
    city: string;
    province: string;
    postalCode: string;
  };
};

type WorkerCV = {
  sex?: 'male' | 'female' | 'other';
  phone?: string;
  summary?: string;
  skills?: string[];
  certifications?: string[];
  degrees?: string[];
  experiences?: string[];
};

const normalizeValue = (input: string): string =>
  input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

const computeProfileId = ({
  nome,
  cognome,
  dataNascita,
}: {
  nome: string;
  cognome: string;
  dataNascita: string;
}) =>
  `${normalizeValue(nome)}-${normalizeValue(cognome)}-${dataNascita.replace(/-/g, "")}`;

const normalizeUsername = (value: string): string =>
  value
    .trim()
    .toLowerCase();

const hashPassword = (password: string): string => {
  let hash = 5381;
  for (let i = 0; i < password.length; i += 1) {
    hash = (hash * 33) ^ password.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

const timingSafeEquals = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

const buildAuthError = (code: string, message: string) => {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
};

const normalizeBusinessInput = (value: unknown): BusinessPayload | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const typeRaw = candidate.type;
  if (
    typeRaw !== 'bar' &&
    typeRaw !== 'ristorante' &&
    typeRaw !== 'cafe' &&
    typeRaw !== 'altro'
  ) {
    return null;
  }

  const addressRaw = (candidate.address ?? {}) as Record<string, unknown>;
  const address = {
    street: typeof addressRaw.street === 'string' ? addressRaw.street.trim() : '',
    number: typeof addressRaw.number === 'string' ? addressRaw.number.trim() : '',
    city: typeof addressRaw.city === 'string' ? addressRaw.city.trim() : '',
    province: typeof addressRaw.province === 'string' ? addressRaw.province.trim() : '',
    postalCode:
      typeof addressRaw.postalCode === 'string'
        ? addressRaw.postalCode.trim()
        : '',
  };

  if (Object.values(address).some((entry) => entry.length === 0)) {
    return null;
  }

  const otherDetailTrimmed =
    typeof candidate.otherDetail === 'string' ? candidate.otherDetail.trim() : '';

  return {
    type: typeRaw,
    ...(typeRaw === 'altro' && otherDetailTrimmed.length > 0
      ? { otherDetail: otherDetailTrimmed }
      : {}),
    address,
  };
};

const mapBusinessFromFirestore = (value: unknown):
  | (BusinessPayload & { updatedAt?: string })
  | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const type = candidate.type;
  if (
    type !== 'bar' &&
    type !== 'ristorante' &&
    type !== 'cafe' &&
    type !== 'altro'
  ) {
    return undefined;
  }

  const addressRaw = (candidate.address ?? {}) as Record<string, unknown>;
  const address = {
    street: typeof addressRaw.street === 'string' ? addressRaw.street : '',
    number: typeof addressRaw.number === 'string' ? addressRaw.number : '',
    city: typeof addressRaw.city === 'string' ? addressRaw.city : '',
    province: typeof addressRaw.province === 'string' ? addressRaw.province : '',
    postalCode:
      typeof addressRaw.postalCode === 'string' ? addressRaw.postalCode : '',
  };

  const updatedAtRaw = candidate.updatedAt as unknown;
  let updatedAt: string | undefined;
  if (
    updatedAtRaw &&
    typeof updatedAtRaw === 'object' &&
    typeof (updatedAtRaw as { toDate?: () => Date }).toDate === 'function'
  ) {
    updatedAt = (updatedAtRaw as { toDate: () => Date }).toDate().toISOString();
  } else if (typeof updatedAtRaw === 'string') {
    updatedAt = updatedAtRaw;
  }

  const otherDetail =
    type === 'altro' && typeof candidate.otherDetail === 'string'
      ? candidate.otherDetail
      : undefined;

  return {
    type,
    ...(otherDetail ? { otherDetail } : {}),
    address,
    updatedAt,
  };
};

const asStringArray = (v: unknown): string[] | undefined => {
  if (Array.isArray(v)) {
    return v.map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter((s) => s.length > 0);
  }
  if (typeof v === 'string') {
    return v
      .split(/\n|,/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return undefined;
};

const mapCvFromFirestore = (value: unknown): WorkerCV | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const cv = value as Record<string, unknown>;
  const sexRaw = typeof cv.sex === 'string' ? cv.sex : undefined;
  const sex = sexRaw === 'male' || sexRaw === 'female' || sexRaw === 'other' ? sexRaw : undefined;
  const phone = typeof cv.phone === 'string' ? cv.phone : undefined;
  const summary = typeof cv.summary === 'string' ? cv.summary : undefined;
  const skills = asStringArray(cv.skills);
  const certifications = asStringArray(cv.certifications);
  const degrees = asStringArray(cv.degrees);
  const experiences = asStringArray(cv.experiences);
  return {
    ...(sex ? { sex } : {}),
    ...(phone ? { phone } : {}),
    ...(summary ? { summary } : {}),
    ...(skills ? { skills } : {}),
    ...(certifications ? { certifications } : {}),
    ...(degrees ? { degrees } : {}),
    ...(experiences ? { experiences } : {}),
  };
};

export async function authenticateProfile(
  payload: AuthenticateProfileInput
): Promise<{ profile: AuthenticatedProfile }> {
  await ensureSignedIn();

  const normalizedName = payload.nome ? normalizeValue(payload.nome) : '';
  const normalizedSurname = payload.cognome ? normalizeValue(payload.cognome) : '';
  const normalizedEmail = payload.email ? normalizeValue(payload.email) : '';

  let profileSnap: { data: () => any; id: string } | null = null;

  // Login via email (preferred if provided)
  if (payload.email && payload.email.trim().length > 0) {
    const profilesRef = collection(db, "profiles");
    const matches = await getDocs(query(profilesRef, where("emailLower", "==", normalizedEmail)));
    if (matches.empty) {
      throw buildAuthError("auth/profile-not-found", "Profilo non trovato per l'email inserita.");
    }
    const docSnap = matches.docs[0];
    profileSnap = { data: () => docSnap.data(), id: docSnap.id };
  } else if (payload.username && payload.username.trim().length > 0) {
    const usernameLower = normalizeUsername(payload.username);
    const profilesRef = collection(db, "profiles");
    const matches = await getDocs(query(profilesRef, where("usernameLower", "==", usernameLower)));
    if (matches.empty) {
      throw buildAuthError("auth/profile-not-found", "Profilo non trovato con l'username inserito.");
    }
    // Username is unique -> first doc is the user
    const docSnap = matches.docs[0];
    profileSnap = { data: () => docSnap.data(), id: docSnap.id };
  } else if (payload.dataNascita && payload.nome && payload.cognome) {
    const profileId = computeProfileId({
      nome: payload.nome,
      cognome: payload.cognome,
      dataNascita: payload.dataNascita,
    });
    const profileRef = doc(db, "profiles", profileId);
    const snapshot = await getDoc(profileRef);
    if (!snapshot.exists()) {
      throw buildAuthError(
        "auth/profile-not-found",
        "Profilo non trovato con i dati inseriti."
      );
    }
    profileSnap = { data: () => snapshot.data(), id: snapshot.id };
  } else {
    const profilesRef = collection(db, "profiles");
    let candidates = await getDocs(
      query(
        profilesRef,
        where("searchName", "==", normalizedName),
        where("searchSurname", "==", normalizedSurname)
      )
    );

    let docs = candidates.docs;

    if (candidates.empty) {
      const nameSnapshot = await getDocs(query(profilesRef, where("name", "==", payload.nome)));
      docs = nameSnapshot.docs.filter((docSnap) => {
        const docData = docSnap.data() ?? {};
        return normalizeValue(docData.surname ?? '') === normalizedSurname;
      });

      if (docs.length === 0) {
        const surnameSnapshot = await getDocs(query(profilesRef, where("surname", "==", payload.cognome)));
        docs = surnameSnapshot.docs.filter((docSnap) => {
          const docData = docSnap.data() ?? {};
          return normalizeValue(docData.name ?? '') === normalizedName;
        });
      }

      if (docs.length === 0) {
        throw buildAuthError(
          "auth/profile-not-found",
          "Profilo non trovato con i dati inseriti."
        );
      }
    }

    const candidateHash = hashPassword(payload.password);
    const matchingDoc = docs.find((docSnap) => {
      const docData = docSnap.data() ?? {};
      const storedHash =
        typeof docData.passwordHash === "string" && docData.passwordHash.trim().length > 0
          ? docData.passwordHash
          : null;
      const storedPassword =
        typeof docData.password === "string" && docData.password.trim().length > 0
          ? docData.password
          : null;

      if (storedHash) {
        return (
          timingSafeEquals(storedHash, candidateHash) ||
          timingSafeEquals(storedHash, payload.password)
        );
      }

      if (storedPassword) {
        return timingSafeEquals(storedPassword, payload.password);
      }

      return false;
    });

    if (!matchingDoc) {
      throw buildAuthError("auth/invalid-password", "La password non è corretta.");
    }

    profileSnap = {
      data: () => matchingDoc.data(),
      id: matchingDoc.id,
    };
  }

  const resolvedProfileId = profileSnap.id;
  const profileRef = doc(db, "profiles", resolvedProfileId);

  const data = profileSnap.data() ?? {};
  const storedHash =
    typeof data.passwordHash === "string" && data.passwordHash.trim().length > 0
      ? data.passwordHash
      : null;
  const storedPassword =
    typeof data.password === "string" && data.password.trim().length > 0
      ? data.password
      : null;

  const candidateHash = hashPassword(payload.password);

  if (storedHash) {
    const matches =
      timingSafeEquals(storedHash, candidateHash) ||
      timingSafeEquals(storedHash, payload.password);
    if (!matches) {
      throw buildAuthError(
        "auth/invalid-password",
        "La password non è corretta."
      );
    }
  } else if (storedPassword) {
    if (!timingSafeEquals(storedPassword, payload.password)) {
      throw buildAuthError(
        "auth/invalid-password",
        "La password non è corretta."
      );
    }
  }

  const safeProfileId =
    typeof data.profileId === "string" && data.profileId.trim().length > 0
      ? data.profileId
      : resolvedProfileId;

  if (!storedHash) {
    await setDoc(
      profileRef,
      {
        passwordHash: candidateHash,
        profileId: safeProfileId,
      },
      { merge: true }
    );
  }

  const role = data.role === "lavoratore" ? "lavoratore" : "datore";
  const business = mapBusinessFromFirestore(data.business);
  const cv = mapCvFromFirestore(data.cv);
  
  return {
    profile: {
      role,
      nome: typeof data.name === "string" ? data.name : (payload.nome ?? ''),
      cognome:
        typeof data.surname === "string" ? data.surname : (payload.cognome ?? ''),
      dataNascita:
        typeof data.birthDate === "string"
          ? data.birthDate
          : (payload.dataNascita ?? ''),
      profileId: safeProfileId,
      passwordHash: storedHash ?? candidateHash,
      ...(business ? { business } : {}),
      ...(cv ? { cv } : {}),
      ...(typeof data.username === 'string' && data.username.trim().length > 0
        ? { username: data.username }
        : {}),
      ...(typeof data.email === 'string' && data.email.trim().length > 0
        ? { email: data.email }
        : {}),
    },
  };
}

/**
 * Salva una "entry" di test proveniente dalla pagina index.
 * Scrive nella collezione "indexEntries".
 */
export async function saveIndexEntry(data: Record<string, any>) {
  const uid = await ensureSignedIn();
  const col = collection(db, "indexEntries");
  return addDoc(col, {
    uid,
    ...data,
    createdAt: serverTimestamp(),
  });
}

/**
 * Crea/aggiorna il profilo utente in users/{uid}.
 */
export async function upsertUserProfile(data: Record<string, any>) {
  const uid = await ensureSignedIn();
  const nome = typeof data.name === "string" ? data.name : data.nome;
  const cognome =
    typeof data.surname === "string" ? data.surname : data.cognome;
  const email = typeof data.email === 'string' ? data.email.trim() : undefined;
  const birthDate =
    typeof data.birthDate === "string" ? data.birthDate : data.dataNascita;
  const role = data.role === "lavoratore" ? "lavoratore" : "datore";
  const usernameRaw = typeof data.username === 'string' ? data.username : undefined;
  const username = usernameRaw ? usernameRaw.trim() : undefined;
  const phoneNumberRaw = typeof data.phoneNumber === 'string' ? data.phoneNumber.trim() : undefined;

  if (!nome || !cognome || !birthDate) {
    throw new Error("Missing profile fields: nome, cognome o dataNascita");
  }
  if (!username || username.length < 3) {
    const err = new Error('Username mancante o troppo corto (min 3)') as Error & { code?: string };
    err.code = 'profile/username-required';
    throw err;
  }
  const usernameLower = normalizeUsername(username);

  const profileId = computeProfileId({
    nome,
    cognome,
    dataNascita: birthDate,
  });
  const normalizedNome = normalizeValue(nome);
  const normalizedCognome = normalizeValue(cognome);
  const normalizedEmail = email ? normalizeValue(email) : undefined;

  const rawPassword =
    typeof data.password === "string" && data.password.trim().length >= 6
      ? data.password.trim()
      : undefined;
  const existingHash =
    typeof data.passwordHash === "string" && data.passwordHash.trim().length > 0
      ? data.passwordHash.trim()
      : undefined;
  const passwordHash = rawPassword ? hashPassword(rawPassword) : existingHash;

  const { password: _ignoredPassword, business: rawBusiness, profileId: explicitProfileId, ...rest } = data;

  const normalizedBusiness =
    role === 'datore' ? normalizeBusinessInput(rawBusiness) : null;

  if (role === 'datore' && !normalizedBusiness) {
    throw new Error('Dati attività mancanti o non validi');
  }

  // Enforce unique username
  const profilesRef = collection(db, 'profiles');
  const sameUsername = await getDocs(query(profilesRef, where('usernameLower', '==', usernameLower)));
  if (!sameUsername.empty) {
    // If updating an existing profile, allow same doc; otherwise block
    const first = sameUsername.docs[0];
    const existingId = first.id;
    if (typeof explicitProfileId !== 'string' || existingId !== explicitProfileId) {
      const err = new Error('Username già in uso') as Error & { code?: string };
      err.code = 'profile/username-taken';
      throw err;
    }
  }

  // Choose a unique profileId
  const ensureUniqueId = async (base: string): Promise<string> => {
    let id = base;
    let i = 2;
    while (true) {
      const ref = doc(db, 'profiles', id);
      const snap = await getDoc(ref);
      if (!snap.exists() || (typeof explicitProfileId === 'string' && explicitProfileId === id)) {
        return id;
      }
      id = `${base}-${i}`;
      i += 1;
    }
  };

  const finalProfileId = await ensureUniqueId(
    typeof explicitProfileId === 'string' && explicitProfileId.trim().length > 0
      ? explicitProfileId.trim()
      : profileId
  );
  const profileRef = doc(db, "profiles", finalProfileId);

  const payload: Record<string, unknown> = {
    ...rest,
    uid,
    profileId: finalProfileId,
    nome,
    cognome,
    dataNascita: birthDate,
    role,
    searchName: normalizedNome,
    searchSurname: normalizedCognome,
    ...(email ? { email, emailLower: normalizedEmail } : {}),
    ...(passwordHash ? { passwordHash } : {}),
    username,
    usernameLower,
    ...(phoneNumberRaw ? { phoneNumber: phoneNumberRaw } : {}),
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  if (normalizedBusiness) {
    payload.business = {
      ...normalizedBusiness,
      updatedAt: serverTimestamp(),
    };
  } else if (role !== 'datore') {
    payload.business = deleteField();
  }

  await setDoc(profileRef, payload, { merge: true });

  return profileRef;
}

/**
 * Crea/aggiorna i dati dell'attività del datore sotto users/{uid}.business
 */
export async function upsertUserBusiness(business: Record<string, any>) {
  const uid = await ensureSignedIn();
  const profileId = typeof business.profileId === "string" ? business.profileId.trim() : '';
  if (!profileId) {
    throw new Error('profileId mancante per aggiornare il business');
  }

  const normalizedBusiness = normalizeBusinessInput(business);
  if (!normalizedBusiness) {
    throw new Error('Dati attività mancanti o non validi');
  }

  const profileRef = doc(db, "profiles", profileId);
  await setDoc(
    profileRef,
    {
      uid,
      business: {
        ...normalizedBusiness,
        updatedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return profileRef;
}

/**
 * Crea un annuncio in jobs (usato dal datore)
 */
export async function createJobPosting(job: Record<string, any>) {
  const uid = await ensureSignedIn();
  const col = collection(db, "jobs");
  const docRef = await addDoc(col, {
    ownerUid: uid,
    status: "open",
    ...job,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef;
}

export async function createJobDocument({
  ownerProfileId,
  payload,
}: {
  ownerProfileId: string;
  payload: Record<string, any>;
}) {
  const uid = await ensureSignedIn();
  const col = collection(db, "jobs");
  return addDoc(col, {
    ownerUid: uid,
    ownerProfileId,
    status: "open",
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function createJobApplication({
  jobId,
  ownerProfileId,
  ownerUid,
  applicantProfileId,
  jobSnapshot,
}: {
  jobId: string;
  ownerProfileId: string | null;
  ownerUid: string | null;
  applicantProfileId: string;
  jobSnapshot: Record<string, any>;
}) {
  const applicantUid = await ensureSignedIn();
  const col = collection(db, "applications");

  const appRef = await addDoc(col, {
    jobId,
    ownerProfileId: ownerProfileId ?? null,
    ownerUid: ownerUid ?? null,
    applicantUid,
    applicantProfileId,
    status: 'pending',
    jobSnapshot,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Also append applicant to the job's applicants list for quick lookup in employer panel
  try {
    const jobRef = doc(db, 'jobs', jobId);
    await updateDoc(jobRef, {
      applicants: arrayUnion(applicantProfileId),
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // Non-blocking: application doc was created; log but don't throw
    console.warn('Failed to update job applicants array:', e);
  }

  return appRef;
}
