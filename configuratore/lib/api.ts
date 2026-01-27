// configuratore/lib/api.ts
import { auth, db } from "./firebase";
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
  orderBy,
  onSnapshot,
  limit,
  runTransaction,
  writeBatch,
  deleteDoc,
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
    hireStatus: "open",
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
    hireStatus: "open",
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
    status: 'applied',
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

const deleteRefsInBatches = async (refs: Array<any>) => {
  const chunkSize = 400;
  for (let i = 0; i < refs.length; i += chunkSize) {
    const batch = writeBatch(db);
    refs.slice(i, i + chunkSize).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
};

const deleteQueryDocs = async (docs: Array<{ ref: any }>) => {
  if (docs.length === 0) return;
  await deleteRefsInBatches(docs.map((docSnap) => docSnap.ref));
};

export async function deleteJobAndRelated(jobId: string) {
  const uid = await ensureSignedIn();
  const jobRef = doc(db, 'jobs', jobId);
  const jobSnap = await getDoc(jobRef);
  if (!jobSnap.exists()) {
    throw new Error('Incarico non trovato');
  }

  const job = jobSnap.data() as Record<string, any>;
  const ownerUid = getJobOwnerUid(job);
  if (!ownerUid) {
    throw new Error('Incarico senza proprietario valido');
  }
  if (ownerUid !== uid) {
    throw new Error('Non autorizzato a eliminare questo incarico');
  }

  const applicationsSnap = await getDocs(
    query(collection(db, 'applications'), where('jobId', '==', jobId))
  );
  await deleteQueryDocs(applicationsSnap.docs);

  const hiresSnap = await getDocs(query(collection(db, 'hires'), where('jobId', '==', jobId)));
  await deleteQueryDocs(hiresSnap.docs);

  const chatsSnap = await getDocs(
    query(collection(db, 'chats'), where('assignmentId', '==', jobId))
  );
  for (const chatDoc of chatsSnap.docs) {
    const messagesSnap = await getDocs(collection(db, 'chats', chatDoc.id, 'messages'));
    await deleteQueryDocs(messagesSnap.docs);
    await deleteQueryDocs([chatDoc]);
  }

  await deleteDoc(jobRef);
}

// -----------------------
// Hires (employer <-> worker per job)
// -----------------------

export type HireStatus = 'proposed' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';

export type HireDocument = {
  id: string;
  jobId: string;
  applicationId?: string;
  employerUid: string;
  workerUid: string;
  employerProfileId?: string;
  workerProfileId?: string;
  chatId?: string | null;
  status: HireStatus;
  jobTitle?: string;
  jobDate?: string;
  jobStartTime?: string;
  jobEndTime?: string;
  jobLocationText?: string;
  jobPayAmount?: number;
  jobPayCurrency?: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export const getJobOwnerUid = (job: Record<string, any> | undefined | null): string | null => {
  if (!job || typeof job !== 'object') return null;
  const candidates = [
    job.ownerUid,
    job.employerUid,
    job.datoreUid,
    job.userId,
    job.createdByUid,
  ];
  for (const entry of candidates) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      return entry.trim();
    }
  }
  return null;
};

const buildJobTitle = (job: Record<string, any>) => {
  const cat = job?.tipo?.categoria;
  const altro = job?.tipo?.altroDettaglio;
  if (cat === 'altro') {
    return altro || 'Altro';
  }
  if (typeof cat === 'string' && cat.length > 0) {
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  }
  return 'Incarico';
};

const buildJobLocation = (job: Record<string, any>) => {
  const addr = job?.indirizzo;
  if (!addr || typeof addr !== 'object') return '';
  const via = typeof addr.via === 'string' ? addr.via : '';
  const civico = typeof addr.civico === 'string' ? addr.civico : '';
  const citta = typeof addr.citta === 'string' ? addr.citta : '';
  const provincia = typeof addr.provincia === 'string' ? addr.provincia : '';
  const cap = typeof addr.cap === 'string' ? addr.cap : '';
  return [via, civico, citta, provincia, cap].filter((v) => v).join(' ');
};

export async function createHireProposal({
  jobId,
  workerUid,
  applicationId,
  employerProfileId,
  workerProfileId,
}: {
  jobId: string;
  workerUid: string;
  applicationId?: string;
  employerProfileId?: string;
  workerProfileId?: string;
}) {
  const employerUid = await ensureSignedIn();
  console.log('[HIRE_DEBUG] createHireProposal auth.currentUser', auth.currentUser);
  console.log('[HIRE_DEBUG] createHireProposal auth.currentUser.uid', auth.currentUser?.uid);
  console.log('[HIRE_DEBUG] createHireProposal jobId', jobId);
  console.log('[HIRE_DEBUG] createHireProposal workerUid', workerUid);
  console.log('[HIRE_DEBUG] createHireProposal employerUid', employerUid);
  console.log('[HIRE_DEBUG] createHireProposal applicationId', applicationId ?? null);
  if (!workerUid) {
    console.log('[HIRE_DEBUG] createHireProposal not authorized: missing worker uid');
    throw new Error('Collaboratore non valido');
  }

  let chatId: string | null = null;
  if (employerProfileId && workerProfileId) {
    const chatsRef = collection(db, 'chats');
    const chatSnap = await getDocs(
      query(
        chatsRef,
        where('assignmentId', '==', jobId),
        where('employerId', '==', employerProfileId),
        where('workerId', '==', workerProfileId),
        limit(1)
      )
    );
    if (!chatSnap.empty) {
      chatId = chatSnap.docs[0].id;
    } else {
      const fallbackSnap = await getDocs(
        query(
          chatsRef,
          where('employerId', '==', employerProfileId),
          where('workerId', '==', workerProfileId),
          orderBy('updatedAt', 'desc'),
          limit(1)
        )
      );
      if (!fallbackSnap.empty) {
        chatId = fallbackSnap.docs[0].id;
      }
    }
  }

  const jobRef = doc(db, 'jobs', jobId);
  const hireRef = doc(collection(db, 'hires'));

  await runTransaction(db, async (tx) => {
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists()) {
      console.log('[HIRE_DEBUG] createHireProposal not authorized: job not found');
      throw new Error('Incarico non trovato');
    }
    const job = jobSnap.data() as Record<string, any>;
    const ownerUid = getJobOwnerUid(job);
    console.log('[HIRE_DEBUG] createHireProposal job owner fields', {
      ownerUid: job?.ownerUid,
      employerUid: job?.employerUid,
      datoreUid: job?.datoreUid,
      userId: job?.userId,
      createdByUid: job?.createdByUid,
    });
    if (!ownerUid) {
      console.log('[HIRE_DEBUG] createHireProposal not authorized: missing owner uid fields');
      throw new Error('Incarico senza proprietario valido');
    }
    if (ownerUid !== employerUid) {
      console.log('[HIRE_DEBUG] createHireProposal not authorized: owner mismatch', {
        ownerUid,
        authUid: employerUid,
      });
      throw new Error('Non autorizzato a proporre per questo incarico');
    }

    const currentStatus =
      typeof job.hireStatus === 'string' && job.hireStatus
        ? job.hireStatus
        : 'open';
    if (currentStatus !== 'open') {
      console.log('[HIRE_DEBUG] createHireProposal not authorized: hireStatus not open', currentStatus);
      throw new Error('Questo incarico ha gia una proposta attiva.');
    }

    const jobDate =
      typeof job.data === 'string'
        ? job.data
        : typeof job.jobDate === 'string'
          ? job.jobDate
          : '';
    const jobStartTime =
      typeof job.oraInizio === 'string'
        ? job.oraInizio
        : typeof job.jobStartTime === 'string'
          ? job.jobStartTime
          : '';
    const jobEndTime =
      typeof job.oraFine === 'string'
        ? job.oraFine
        : typeof job.jobEndTime === 'string'
          ? job.jobEndTime
          : '';

    tx.set(hireRef, {
      jobId,
      applicationId: applicationId ?? null,
      employerUid,
      workerUid,
      employerProfileId: employerProfileId ?? null,
      workerProfileId: workerProfileId ?? null,
      chatId,
      status: 'proposed',
      jobTitle: buildJobTitle(job),
      jobDate,
      jobStartTime,
      jobEndTime,
      jobLocationText: buildJobLocation(job),
      jobPayAmount:
        typeof job.compensoOrario === 'number'
          ? job.compensoOrario
          : Number(job.compensoOrario ?? 0),
      jobPayCurrency: 'EUR',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const jobUpdates: Record<string, any> = {
      hireStatus: 'proposed',
      activeHireId: hireRef.id,
      hiredWorkerUid: null,
      updatedAt: serverTimestamp(),
    };

    if (!job?.ownerUid && ownerUid) {
      console.log('[HIRE_DEBUG] createHireProposal normalizing ownerUid on job', ownerUid);
      jobUpdates.ownerUid = ownerUid;
    }

    tx.update(jobRef, jobUpdates);

    if (applicationId) {
      const appRef = doc(db, 'applications', applicationId);
      const appSnap = await tx.get(appRef);
      if (appSnap.exists()) {
        tx.update(appRef, {
          status: 'hiredProposed',
          hireId: hireRef.id,
          updatedAt: serverTimestamp(),
        });
      }
    }
  });

  console.log('[HIRE_DEBUG] createHireProposal success', {
    hireId: hireRef.id,
    jobId,
    workerUid,
    employerUid,
  });

  return hireRef;
}

export async function acceptHire(hireId: string) {
  const uid = await ensureSignedIn();
  console.log('[HIRE_DEBUG] acceptHire', { hireId, uid, authUser: auth.currentUser });
  const hireRef = doc(db, 'hires', hireId);

  await runTransaction(db, async (tx) => {
    const hireSnap = await tx.get(hireRef);
    if (!hireSnap.exists()) {
      throw new Error('Proposta non trovata');
    }
    const hire = hireSnap.data() as Record<string, any>;
    if (hire.workerUid && hire.workerUid !== uid) {
      console.log('[HIRE_DEBUG] acceptHire not authorized: worker mismatch', {
        uid,
        workerUid: hire.workerUid,
      });
      throw new Error('Non autorizzato a confermare questa proposta');
    }
    if (hire.status !== 'proposed') {
      console.log('[HIRE_DEBUG] acceptHire not authorized: status not proposed', hire.status);
      throw new Error('La proposta non e valida');
    }

    tx.update(hireRef, {
      status: 'confirmed',
      updatedAt: serverTimestamp(),
    });

    if (typeof hire.jobId === 'string') {
      const jobRef = doc(db, 'jobs', hire.jobId);
      tx.update(jobRef, {
        hireStatus: 'confirmed',
        activeHireId: hireId,
        hiredWorkerUid: hire.workerUid ?? null,
        updatedAt: serverTimestamp(),
      });
    }

    if (typeof hire.applicationId === 'string' && hire.applicationId) {
      const appRef = doc(db, 'applications', hire.applicationId);
      const appSnap = await tx.get(appRef);
      if (appSnap.exists()) {
        tx.update(appRef, {
          status: 'hiredConfirmed',
          updatedAt: serverTimestamp(),
        });
      }
    }
  });

  console.log('[HIRE_DEBUG] acceptHire success', { hireId, uid });
}

export async function rejectHire(hireId: string) {
  const uid = await ensureSignedIn();
  console.log('[HIRE_DEBUG] rejectHire', { hireId, uid, authUser: auth.currentUser });
  const hireRef = doc(db, 'hires', hireId);

  await runTransaction(db, async (tx) => {
    const hireSnap = await tx.get(hireRef);
    if (!hireSnap.exists()) {
      throw new Error('Proposta non trovata');
    }
    const hire = hireSnap.data() as Record<string, any>;
    if (hire.workerUid && hire.workerUid !== uid) {
      console.log('[HIRE_DEBUG] rejectHire not authorized: worker mismatch', {
        uid,
        workerUid: hire.workerUid,
      });
      throw new Error('Non autorizzato a rifiutare questa proposta');
    }
    if (hire.status !== 'proposed') {
      console.log('[HIRE_DEBUG] rejectHire not authorized: status not proposed', hire.status);
      throw new Error('La proposta non e valida');
    }

    tx.update(hireRef, {
      status: 'rejected',
      updatedAt: serverTimestamp(),
    });

    if (typeof hire.applicationId === 'string' && hire.applicationId) {
      const appRef = doc(db, 'applications', hire.applicationId);
      const appSnap = await tx.get(appRef);
      if (appSnap.exists()) {
        tx.update(appRef, {
          status: 'rejected',
          updatedAt: serverTimestamp(),
        });
      }
    }

    if (typeof hire.jobId === 'string') {
      const jobRef = doc(db, 'jobs', hire.jobId);
      const jobSnap = await tx.get(jobRef);
      const job = jobSnap.data() as Record<string, any> | undefined;
      if (!job || job.activeHireId === hireId) {
        tx.update(jobRef, {
          hireStatus: 'open',
          activeHireId: deleteField(),
          hiredWorkerUid: deleteField(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  });

  console.log('[HIRE_DEBUG] rejectHire success', { hireId, uid });
}

export async function completeHire(hireId: string) {
  const uid = await ensureSignedIn();
  console.log('[HIRE_DEBUG] completeHire', { hireId, uid, authUser: auth.currentUser });
  const hireRef = doc(db, 'hires', hireId);

  await runTransaction(db, async (tx) => {
    const hireSnap = await tx.get(hireRef);
    if (!hireSnap.exists()) {
      throw new Error('Assunzione non trovata');
    }
    const hire = hireSnap.data() as Record<string, any>;
    if (hire.employerUid && hire.employerUid !== uid) {
      console.log('[HIRE_DEBUG] completeHire not authorized: employer mismatch', {
        uid,
        employerUid: hire.employerUid,
      });
      throw new Error('Non autorizzato a completare questo incarico');
    }
    if (hire.status !== 'confirmed') {
      console.log('[HIRE_DEBUG] completeHire not authorized: status not confirmed', hire.status);
      throw new Error('L\'incarico non e in stato confermato');
    }

    tx.update(hireRef, {
      status: 'completed',
      updatedAt: serverTimestamp(),
    });

    if (typeof hire.jobId === 'string') {
      const jobRef = doc(db, 'jobs', hire.jobId);
      tx.update(jobRef, {
        hireStatus: 'completed',
        activeHireId: hireId,
        updatedAt: serverTimestamp(),
      });
    }
  });

  console.log('[HIRE_DEBUG] completeHire success', { hireId, uid });
}

// -----------------------
// Chats (employer <-> worker per assignment)
// -----------------------

export type ChatDocument = {
  id: string;
  assignmentId: string;
  employerId: string;
  workerId: string;
  lastMessage?: string;
  lastSenderId?: string;
  lastMessageAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: Date | null;
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

const mapChatDoc = (snap: any): ChatDocument => {
  const data = snap.data() ?? {};
  return {
    id: snap.id,
    assignmentId: data.assignmentId ?? '',
    employerId: data.employerId ?? '',
    workerId: data.workerId ?? '',
    lastMessage: data.lastMessage ?? '',
    lastSenderId: data.lastSenderId ?? '',
    lastMessageAt: mapTimestamp(data.lastMessageAt),
    createdAt: mapTimestamp(data.createdAt),
    updatedAt: mapTimestamp(data.updatedAt),
  };
};

export async function getOrCreateChat(
  assignmentId: string | undefined,
  employerId: string,
  workerId: string
): Promise<ChatDocument> {
  const chatsCol = collection(db, 'chats');
  const deterministicId = `${employerId}__${workerId}`;
  const deterministicRef = doc(chatsCol, deterministicId);
  const existingById = await getDoc(deterministicRef);
  if (existingById.exists()) {
    return mapChatDoc(existingById);
  }

  const existing = await getDocs(
    query(
      chatsCol,
      where('employerId', '==', employerId),
      where('workerId', '==', workerId),
      orderBy('updatedAt', 'desc'),
      limit(1)
    )
  );
  if (!existing.empty) {
    return mapChatDoc(existing.docs[0]);
  }

  await setDoc(deterministicRef, {
    assignmentId: assignmentId ?? '',
    employerId,
    workerId,
    lastMessage: '',
    lastSenderId: '',
    lastMessageAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const fresh = await getDoc(deterministicRef);
  return mapChatDoc(fresh);
}

export async function getOrCreatePairChat(
  employerId: string,
  workerId: string,
  assignmentId?: string
): Promise<ChatDocument> {
  return getOrCreateChat(assignmentId, employerId, workerId);
}

export async function sendMessage(chatId: string, senderId: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Message text cannot be empty');
  }
  const chatRef = doc(db, 'chats', chatId);
  const messagesCol = collection(chatRef, 'messages');

  await addDoc(messagesCol, {
    senderId,
    text: trimmed,
    createdAt: serverTimestamp(),
  });

  await updateDoc(chatRef, {
    lastMessage: trimmed,
    lastMessageAt: serverTimestamp(),
    lastSenderId: senderId,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToMessages(
  chatId: string,
  callback: (messages: ChatMessage[]) => void
) {
  const messagesCol = collection(db, 'chats', chatId, 'messages');
  const q = query(messagesCol, orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const mapped = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() ?? {};
        return {
          id: docSnap.id,
          senderId: data.senderId ?? '',
          text: data.text ?? '',
          createdAt: mapTimestamp(data.createdAt),
        } as ChatMessage;
      });
      callback(mapped);
    },
    (error) => {
      console.warn('subscribeToMessages error:', error);
      callback([]);
    }
  );
}

export async function markChatOpened(chatId: string, role: 'datore' | 'lavoratore') {
  const chatRef = doc(db, 'chats', chatId);
  const field =
    role === 'datore'
      ? 'lastOpenedAtByEmployer'
      : 'lastOpenedAtByWorker';
  try {
    await updateDoc(chatRef, { [field]: serverTimestamp() });
  } catch (e) {
    console.warn('Failed to mark chat opened', e);
  }
}
