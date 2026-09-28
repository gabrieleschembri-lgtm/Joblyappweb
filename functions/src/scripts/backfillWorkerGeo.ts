import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { backfillWorkerGeoIndex } from "../migrations/backfillWorkerGeo";

const EXPECTED_PROJECT_ID = "jobly-4608c";

const readArgument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

async function main() {
  const projectId = readArgument("--project");
  const writeChanges = process.argv.includes("--write");
  const confirmation = readArgument("--confirm");

  if (projectId !== EXPECTED_PROJECT_ID) {
    throw new Error(`Pass --project ${EXPECTED_PROJECT_ID} explicitly.`);
  }
  if (writeChanges && confirmation !== EXPECTED_PROJECT_ID) {
    throw new Error(
      `Production writes require --confirm ${EXPECTED_PROJECT_ID}.`
    );
  }

  initializeApp({
    credential: applicationDefault(),
    projectId,
  });

  const result = await backfillWorkerGeoIndex(getFirestore(), writeChanges);
  console.log(
    JSON.stringify(
      {
        mode: writeChanges ? "write" : "dry-run",
        projectId,
        ...result,
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Migration failed");
  process.exitCode = 1;
});
