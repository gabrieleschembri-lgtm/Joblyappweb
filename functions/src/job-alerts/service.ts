import { createHash, randomUUID } from "node:crypto";
import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type Firestore,
} from "firebase-admin/firestore";
import {
  WORKER_RADIUS_BUCKETS,
  getDistanceKm,
  getGeohashQueryBounds,
  isValidGeoCoordinates,
  type WorkerRadiusKm,
} from "../geospatial";
import {
  buildJobAlertEmail,
  type EmailJob,
  type JobAlertEmailPayload,
} from "./email";

const QUEUE_COLLECTION = "workerJobAlertQueues";
const NOTIFICATIONS_COLLECTION = "notifications";
const JOBS_PER_EMAIL = 3;
const LEASE_MS = 5 * 60 * 1000;
export const QUEUE_MAX_AGE_MS = 59 * 60 * 1000;
const QUEUE_QUERY_LIMIT = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const getWorkerNotificationEmail = (profile: DocumentData) => {
  const value =
    profile.isGuest === true ? profile.demoNotificationEmail : profile.email;
  const email = typeof value === "string" ? value.trim() : "";
  return EMAIL_PATTERN.test(email) ? email : null;
};

type WorkerRecipient = {
  profileId: string;
};

type ActiveBatch = {
  id: string;
  jobIds: string[];
  leaseUntil: Timestamp;
  prepared: boolean;
  emailPayload: JobAlertEmailPayload | null;
  deliverableJobIds: string[];
  skippedJobIds: string[];
  skipReason: string | null;
};

type ClaimResult = {
  queueId: string;
  batch: ActiveBatch;
};

const queueRefFor = (firestore: Firestore, profileId: string) =>
  firestore.collection(QUEUE_COLLECTION).doc(profileId);

const notificationRefFor = (
  firestore: Firestore,
  profileId: string,
  jobId: string
) =>
  queueRefFor(firestore, profileId).collection(NOTIFICATIONS_COLLECTION).doc(jobId);

const stringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const timestampValue = (value: unknown) =>
  value instanceof Timestamp ? value : null;

const parseActiveBatch = (value: unknown): ActiveBatch | null => {
  if (!value || typeof value !== "object") return null;
  const data = value as DocumentData;
  const id = typeof data.id === "string" ? data.id : "";
  const jobIds = stringArray(data.jobIds);
  const leaseUntil = timestampValue(data.leaseUntil);
  if (!id || jobIds.length === 0 || !leaseUntil) return null;
  const rawPayload = data.emailPayload;
  const emailPayload =
    rawPayload &&
    typeof rawPayload.to === "string" &&
    typeof rawPayload.subject === "string" &&
    typeof rawPayload.html === "string" &&
    typeof rawPayload.text === "string"
      ? (rawPayload as JobAlertEmailPayload)
      : null;
  return {
    id,
    jobIds,
    leaseUntil,
    prepared: data.prepared === true,
    emailPayload,
    deliverableJobIds: stringArray(data.deliverableJobIds),
    skippedJobIds: stringArray(data.skippedJobIds),
    skipReason: typeof data.skipReason === "string" ? data.skipReason : null,
  };
};

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "number" || typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

const getJobStartDate = (job: DocumentData): Date | null => {
  const direct =
    toDate(job.startAt) ?? toDate(job.startDate) ?? toDate(job.jobDate);
  if (direct) return direct;
  const rawDate =
    typeof job.data === "string"
      ? job.data.trim()
      : typeof job.date === "string"
        ? job.date.trim()
        : "";
  if (!rawDate) return null;
  const slashMatch = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(rawDate);
  const isoDate = slashMatch
    ? `${slashMatch[3]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[1].padStart(2, "0")}`
    : /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : "";
  if (!isoDate) return null;
  const rawTime =
    typeof job.oraInizio === "string"
      ? job.oraInizio.trim()
      : typeof job.jobStartTime === "string"
        ? job.jobStartTime.trim()
        : "23:59";
  const normalizedTime = /^\d{1,2}:\d{2}$/.test(rawTime)
    ? rawTime.padStart(5, "0")
    : "23:59";
  const parsed = new Date(`${isoDate}T${normalizedTime}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isJobAvailable = (job: DocumentData, now = new Date()) => {
  if (job.status !== "open") return false;
  if (typeof job.hireStatus === "string" && job.hireStatus !== "open") {
    return false;
  }
  if (
    job.active === false ||
    job.isActive === false ||
    job.enabled === false ||
    job.deleted === true ||
    job.isDeleted === true ||
    job.deletedAt ||
    job.closedAt ||
    job.cancelledAt
  ) {
    return false;
  }
  const start = getJobStartDate(job);
  return !start || start.getTime() >= now.getTime();
};

const getJobLocation = (job: DocumentData) => {
  const latitude = job.location?.lat;
  const longitude = job.location?.lng;
  return isValidGeoCoordinates(latitude, longitude)
    ? { latitude, longitude }
    : null;
};

export const isWorkerWithinRadius = (
  workerLatitude: number,
  workerLongitude: number,
  jobLatitude: number,
  jobLongitude: number,
  radiusKm: WorkerRadiusKm
) =>
  getDistanceKm(
    workerLatitude,
    workerLongitude,
    jobLatitude,
    jobLongitude
  ) <= radiusKm;

export async function findCompatibleWorkers(
  firestore: Firestore,
  job: DocumentData
): Promise<WorkerRecipient[]> {
  const location = getJobLocation(job);
  if (!location) return [];
  const matches = new Map<string, WorkerRecipient>();

  for (const radiusKm of WORKER_RADIUS_BUCKETS) {
    const bounds = getGeohashQueryBounds(
      location.latitude,
      location.longitude,
      radiusKm
    );
    const snapshots = await Promise.all(
      bounds.map(([start, end]) =>
        firestore
          .collection("profiles")
          .where("role", "==", "lavoratore")
          .where("emailJobAlerts", "==", true)
          .where("workPreferences.radiusKm", "==", radiusKm)
          .orderBy("workPreferences.location.geohash")
          .startAt(start)
          .endAt(end)
          .get()
      )
    );

    for (const snapshot of snapshots) {
      for (const profile of snapshot.docs) {
        if (matches.has(profile.id)) continue;
        const data = profile.data();
        const workerLatitude = data.workPreferences?.location?.latitude;
        const workerLongitude = data.workPreferences?.location?.longitude;
        if (
          !isValidGeoCoordinates(workerLatitude, workerLongitude) ||
          !getWorkerNotificationEmail(data)
        ) {
          continue;
        }
        if (
          isWorkerWithinRadius(
            workerLatitude,
            workerLongitude,
            location.latitude,
            location.longitude,
            radiusKm
          )
        ) {
          matches.set(profile.id, { profileId: profile.id });
        }
      }
    }
  }

  return [...matches.values()];
}

async function enqueueJob(
  firestore: Firestore,
  profileId: string,
  jobId: string
) {
  const queueRef = queueRefFor(firestore, profileId);
  const notificationRef = notificationRefFor(firestore, profileId, jobId);
  return firestore.runTransaction(async (transaction) => {
    const [queueSnapshot, notificationSnapshot] = await Promise.all([
      transaction.get(queueRef),
      transaction.get(notificationRef),
    ]);
    if (notificationSnapshot.exists) return false;
    const pendingJobIds = stringArray(queueSnapshot.data()?.pendingJobIds);
    if (pendingJobIds.includes(jobId)) return false;
    const nextPendingJobIds = [...pendingJobIds, jobId];
    transaction.create(notificationRef, {
      jobId,
      status: "pending",
      queuedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(
      queueRef,
      {
        workerProfileId: profileId,
        pendingJobIds: nextPendingJobIds,
        ...(pendingJobIds.length === 0
          ? { firstQueuedAt: FieldValue.serverTimestamp() }
          : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return nextPendingJobIds.length >= JOBS_PER_EMAIL;
  });
}

async function claimBatch(
  firestore: Firestore,
  profileId: string
): Promise<ClaimResult | null> {
  const queueRef = queueRefFor(firestore, profileId);
  const proposedBatchId = randomUUID();
  const now = Timestamp.now();
  const leaseUntil = Timestamp.fromMillis(now.toMillis() + LEASE_MS);

  return firestore.runTransaction(async (transaction) => {
    const queueSnapshot = await transaction.get(queueRef);
    if (!queueSnapshot.exists) return null;
    const queue = queueSnapshot.data() ?? {};
    const activeBatch = parseActiveBatch(queue.activeBatch);
    if (activeBatch) {
      if (activeBatch.leaseUntil.toMillis() > now.toMillis()) return null;
      transaction.update(queueRef, {
        "activeBatch.leaseUntil": leaseUntil,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return {
        queueId: profileId,
        batch: { ...activeBatch, leaseUntil },
      };
    }

    const pendingJobIds = stringArray(queue.pendingJobIds);
    if (pendingJobIds.length === 0) return null;
    const jobIds = pendingJobIds.slice(0, JOBS_PER_EMAIL);
    const remainingJobIds = pendingJobIds.slice(JOBS_PER_EMAIL);
    const nextBatch: ActiveBatch = {
      id: proposedBatchId,
      jobIds,
      leaseUntil,
      prepared: false,
      emailPayload: null,
      deliverableJobIds: [],
      skippedJobIds: [],
      skipReason: null,
    };
    transaction.update(queueRef, {
      pendingJobIds: remainingJobIds,
      activeBatch: {
        id: proposedBatchId,
        jobIds,
        claimedAt: FieldValue.serverTimestamp(),
        leaseUntil,
        prepared: false,
      },
      firstQueuedAt:
        remainingJobIds.length > 0
          ? FieldValue.serverTimestamp()
          : FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { queueId: profileId, batch: nextBatch };
  });
}

async function prepareBatch(
  firestore: Firestore,
  claim: ClaimResult
): Promise<ActiveBatch | null> {
  if (claim.batch.prepared) return claim.batch;
  const profileRef = firestore.collection("profiles").doc(claim.queueId);
  const jobRefs = claim.batch.jobIds.map((jobId) =>
    firestore.collection("jobs").doc(jobId)
  );
  const [profileSnapshot, jobSnapshots] = await Promise.all([
    profileRef.get(),
    firestore.getAll(...jobRefs),
  ]);
  const profile = profileSnapshot.data();
  const email = profile ? getWorkerNotificationEmail(profile) : null;
  const workerEligible =
    profileSnapshot.exists &&
    profile?.role === "lavoratore" &&
    profile?.emailJobAlerts === true &&
    email !== null;
  const availableJobs: EmailJob[] = [];
  const skippedJobIds: string[] = [];

  for (const jobSnapshot of jobSnapshots) {
    const data = jobSnapshot.data();
    if (workerEligible && jobSnapshot.exists && data && isJobAvailable(data)) {
      availableJobs.push({ id: jobSnapshot.id, data });
    } else {
      skippedJobIds.push(jobSnapshot.id);
    }
  }

  const emailPayload =
    workerEligible && availableJobs.length > 0
      ? buildJobAlertEmail(email, availableJobs)
      : null;
  const queueRef = queueRefFor(firestore, claim.queueId);
  const leaseUntil = Timestamp.fromMillis(Date.now() + LEASE_MS);

  return firestore.runTransaction(async (transaction) => {
    const queueSnapshot = await transaction.get(queueRef);
    const currentBatch = parseActiveBatch(queueSnapshot.data()?.activeBatch);
    if (!currentBatch || currentBatch.id !== claim.batch.id) return null;
    if (currentBatch.prepared) return currentBatch;
    transaction.update(queueRef, {
      "activeBatch.prepared": true,
      "activeBatch.emailPayload": emailPayload,
      "activeBatch.deliverableJobIds": availableJobs.map((job) => job.id),
      "activeBatch.skippedJobIds": skippedJobIds,
      "activeBatch.skipReason": workerEligible ? "job-unavailable" : "worker-ineligible",
      "activeBatch.leaseUntil": leaseUntil,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      ...currentBatch,
      prepared: true,
      emailPayload,
      deliverableJobIds: availableJobs.map((job) => job.id),
      skippedJobIds,
      skipReason: workerEligible ? "job-unavailable" : "worker-ineligible",
      leaseUntil,
    };
  });
}

const resendIdempotencyKey = (profileId: string, batchId: string) =>
  `jobly-alert-${createHash("sha256")
    .update(`${profileId}:${batchId}`)
    .digest("hex")}`;

async function sendEmail(
  apiKey: string,
  profileId: string,
  batchId: string,
  payload: JobAlertEmailPayload
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": resendIdempotencyKey(profileId, batchId),
    },
    body: JSON.stringify({
      from: "Jobly <notifications@notify.joblyapp.it>",
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend rejected a job-alert email (${response.status})`);
  }
  const result = (await response.json()) as { id?: string };
  return result.id ?? null;
}

async function releaseBatch(
  firestore: Firestore,
  profileId: string,
  batchId: string
) {
  const queueRef = queueRefFor(firestore, profileId);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(queueRef);
    const activeBatch = parseActiveBatch(snapshot.data()?.activeBatch);
    if (!activeBatch || activeBatch.id !== batchId) return;
    transaction.update(queueRef, {
      "activeBatch.leaseUntil": Timestamp.fromMillis(Date.now() - 1),
      "activeBatch.lastErrorAt": FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

async function finalizeBatch(
  firestore: Firestore,
  profileId: string,
  batch: ActiveBatch,
  resendMessageId: string | null
) {
  const queueRef = queueRefFor(firestore, profileId);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(queueRef);
    const activeBatch = parseActiveBatch(snapshot.data()?.activeBatch);
    if (!activeBatch || activeBatch.id !== batch.id) return false;
    const deliverable = new Set(activeBatch.deliverableJobIds);
    for (const jobId of activeBatch.jobIds) {
      transaction.set(
        notificationRefFor(firestore, profileId, jobId),
        deliverable.has(jobId)
          ? {
              status: "sent",
              batchId: activeBatch.id,
              resendMessageId,
              sentAt: FieldValue.serverTimestamp(),
            }
          : {
              status: "skipped",
              batchId: activeBatch.id,
              reason: activeBatch.skipReason ?? "job-unavailable",
              skippedAt: FieldValue.serverTimestamp(),
            },
        { merge: true }
      );
    }
    const pendingJobIds = stringArray(snapshot.data()?.pendingJobIds);
    transaction.update(queueRef, {
      activeBatch: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return pendingJobIds.length >= JOBS_PER_EMAIL;
  });
}

export async function processWorkerQueue(
  firestore: Firestore,
  profileId: string,
  resendApiKey: string
) {
  for (let batchNumber = 0; batchNumber < 20; batchNumber += 1) {
    const claim = await claimBatch(firestore, profileId);
    if (!claim) return;
    const batch = await prepareBatch(firestore, claim);
    if (!batch) return;
    let resendMessageId: string | null = null;
    if (batch.emailPayload) {
      try {
        resendMessageId = await sendEmail(
          resendApiKey,
          profileId,
          batch.id,
          batch.emailPayload
        );
      } catch (error) {
        await releaseBatch(firestore, profileId, batch.id);
        throw error;
      }
    }
    const shouldContinue = await finalizeBatch(
      firestore,
      profileId,
      batch,
      resendMessageId
    );
    if (!shouldContinue) return;
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>
) {
  const queue = [...items];
  const workers = Array.from(
    { length: Math.min(concurrency, queue.length) },
    async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item !== undefined) await task(item);
      }
    }
  );
  await Promise.all(workers);
}

export async function handleNewJobCreated(
  firestore: Firestore,
  jobId: string,
  job: DocumentData,
  resendApiKey: string
) {
  if (!isJobAvailable(job) || !getJobLocation(job)) return;
  const workers = await findCompatibleWorkers(firestore, job);
  const queuesToFlush: string[] = [];
  await runWithConcurrency(workers, 10, async (worker) => {
    if (await enqueueJob(firestore, worker.profileId, jobId)) {
      queuesToFlush.push(worker.profileId);
    }
  });
  await runWithConcurrency([...new Set(queuesToFlush)], 5, async (profileId) => {
    await processWorkerQueue(firestore, profileId, resendApiKey);
  });
}

export async function flushDueQueues(
  firestore: Firestore,
  resendApiKey: string,
  now = Timestamp.now()
) {
  const queues = firestore.collection(QUEUE_COLLECTION);
  const cutoff = Timestamp.fromMillis(now.toMillis() - QUEUE_MAX_AGE_MS);
  const [duePending, expiredActive] = await Promise.all([
    queues.where("firstQueuedAt", "<=", cutoff).limit(QUEUE_QUERY_LIMIT).get(),
    queues
      .where("activeBatch.leaseUntil", "<=", now)
      .limit(QUEUE_QUERY_LIMIT)
      .get(),
  ]);
  const profileIds = [
    ...new Set([
      ...duePending.docs.map((document) => document.id),
      ...expiredActive.docs.map((document) => document.id),
    ]),
  ];
  const errors: Error[] = [];
  await runWithConcurrency(profileIds, 5, async (profileId) => {
    try {
      await processWorkerQueue(firestore, profileId, resendApiKey);
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error("Queue flush failed"));
    }
  });
  if (errors.length > 0) {
    throw new Error(`${errors.length} job-alert queue flushes failed`);
  }
}
