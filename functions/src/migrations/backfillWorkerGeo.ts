import {
  FieldPath,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
  type UpdateData,
} from "firebase-admin/firestore";
import {
  calculateLocationGeohash,
  isValidGeoCoordinates,
} from "../geospatial";

const PAGE_SIZE = 250;

export type WorkerGeoBackfillResult = {
  profilesRead: number;
  profilesWithValidLocation: number;
  geohashesAdded: number;
  emailAlertDefaultsAdded: number;
  profilesWritten: number;
};

const hasOwn = (value: DocumentData, field: string) =>
  Object.prototype.hasOwnProperty.call(value, field);

export async function backfillWorkerGeoIndex(
  firestore: Firestore,
  writeChanges: boolean
): Promise<WorkerGeoBackfillResult> {
  const result: WorkerGeoBackfillResult = {
    profilesRead: 0,
    profilesWithValidLocation: 0,
    geohashesAdded: 0,
    emailAlertDefaultsAdded: 0,
    profilesWritten: 0,
  };
  const bulkWriter = writeChanges ? firestore.bulkWriter() : null;
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined;

  while (true) {
    let profilesQuery = firestore
      .collection("profiles")
      .where("role", "==", "lavoratore")
      .orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE);

    if (cursor) {
      profilesQuery = profilesQuery.startAfter(cursor);
    }

    const snapshot = await profilesQuery.get();
    if (snapshot.empty) break;

    for (const profile of snapshot.docs) {
      result.profilesRead += 1;
      const data = profile.data();
      const location = data.workPreferences?.location as DocumentData | undefined;
      const updates: UpdateData<DocumentData> = {};
      const latitude = location?.latitude;
      const longitude = location?.longitude;

      if (isValidGeoCoordinates(latitude, longitude)) {
        result.profilesWithValidLocation += 1;
        if (typeof location?.geohash !== "string" || location.geohash.trim() === "") {
          updates["workPreferences.location.geohash"] = calculateLocationGeohash(
            latitude,
            longitude
          );
          result.geohashesAdded += 1;
        }
        if (!hasOwn(data, "emailJobAlerts")) {
          updates.emailJobAlerts = false;
          result.emailAlertDefaultsAdded += 1;
        }
      }

      if (Object.keys(updates).length > 0) {
        result.profilesWritten += 1;
        if (bulkWriter) {
          bulkWriter.update(profile.ref, updates);
        }
      }
    }

    cursor = snapshot.docs.at(-1);
    if (snapshot.size < PAGE_SIZE) break;
  }

  if (bulkWriter) {
    await bulkWriter.close();
  }

  return result;
}
