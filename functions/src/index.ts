import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  flushDueQueues,
  handleNewJobCreated,
} from "./job-alerts/service";

initializeApp();

const resendApiKey = defineSecret("RESEND_API_KEY");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const sendResendTestEmail = onRequest(
  {
    invoker: "private",
    secrets: [resendApiKey],
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.set("Allow", "POST").status(405).json({
        ok: false,
        error: "Method not allowed",
      });
      return;
    }

    const recipient =
      typeof request.body?.to === "string" ? request.body.to.trim() : "";

    if (!emailPattern.test(recipient)) {
      response.status(400).json({
        ok: false,
        error: "A valid recipient email is required",
      });
      return;
    }

    try {
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey.value()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Jobly <notifications@notify.joblyapp.it>",
          to: [recipient],
          subject: "Jobly · Test notifiche email",
          text: "Ciao da Jobly! Questa email conferma che le notifiche email server-side funzionano correttamente.",
          html: `
            <div style="background:#f5f8ff;padding:32px;font-family:Arial,sans-serif;color:#172033">
              <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #dce6f8">
                <div style="font-size:24px;font-weight:700;color:#2563eb;margin-bottom:20px">Jobly</div>
                <h1 style="font-size:22px;margin:0 0 12px">Test notifiche email</h1>
                <p style="font-size:16px;line-height:1.6;margin:0;color:#475569">
                  Ciao da Jobly! Questa email conferma che le notifiche email server-side funzionano correttamente.
                </p>
              </div>
            </div>
          `,
        }),
      });

      if (!resendResponse.ok) {
        console.error("Resend test email request failed", resendResponse.status);
        response.status(502).json({
          ok: false,
          error: "Email provider rejected the request",
        });
        return;
      }

      const result = (await resendResponse.json()) as { id?: string };
      response.status(200).json({
        ok: true,
        messageId: result.id ?? null,
      });
    } catch (error) {
      console.error(
        "Resend test email request failed",
        error instanceof Error ? error.message : "Unknown error"
      );
      response.status(502).json({
        ok: false,
        error: "Unable to send test email",
      });
    }
  }
);

export const queueJobAlertsOnJobCreated = onDocumentCreated(
  {
    document: "jobs/{jobId}",
    region: "europe-west1",
    retry: true,
    secrets: [resendApiKey],
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (event) => {
    if (!event.data) return;
    await handleNewJobCreated(
      getFirestore(),
      event.params.jobId,
      event.data.data(),
      resendApiKey.value()
    );
  }
);

export const flushPendingJobAlertQueues = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "europe-west1",
    timeZone: "Europe/Rome",
    retryCount: 3,
    maxInstances: 1,
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: [resendApiKey],
  },
  async () => {
    await flushDueQueues(getFirestore(), resendApiKey.value());
  }
);
