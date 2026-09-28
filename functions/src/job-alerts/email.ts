import type { DocumentData } from "firebase-admin/firestore";

export type JobAlertEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailJob = {
  id: string;
  data: DocumentData;
};

const APP_URL = "https://joblyapp.it";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const textValue = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const getJobTitle = (job: DocumentData) => {
  const category = textValue(job.tipo?.categoria);
  const custom = textValue(job.tipo?.altroDettaglio);
  const rawTitle = category === "altro" ? custom || "Altro" : category;
  if (!rawTitle) return "Nuovo incarico";
  return rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
};

const getJobAddress = (job: DocumentData) => {
  const address = job.indirizzo ?? {};
  return [
    [textValue(address.via), textValue(address.civico)].filter(Boolean).join(" "),
    textValue(address.citta),
    textValue(address.provincia),
  ]
    .filter(Boolean)
    .join(", ");
};

const getJobDateTime = (job: DocumentData) => {
  const date = textValue(job.data) || textValue(job.jobDate);
  const start = textValue(job.oraInizio) || textValue(job.jobStartTime);
  const end = textValue(job.oraFine) || textValue(job.jobEndTime);
  const time = [start, end].filter(Boolean).join("–");
  return [date, time].filter(Boolean).join(" · ");
};

const getJobPay = (job: DocumentData) => {
  const pay = Number(job.compensoOrario);
  if (!Number.isFinite(pay) || pay <= 0) return "";
  return `${new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(pay)} / ora`;
};

const getJobLink = (jobId: string) =>
  `${APP_URL}/configuratore/job?jobId=${encodeURIComponent(jobId)}`;

export const buildJobAlertEmail = (
  recipient: string,
  jobs: EmailJob[]
): JobAlertEmailPayload => {
  const count = jobs.length;
  const subject = `Jobly · ${count} ${count === 1 ? "nuovo incarico compatibile" : "nuovi incarichi compatibili"}`;
  const cards = jobs
    .map(({ id, data }) => {
      const title = getJobTitle(data);
      const dateTime = getJobDateTime(data);
      const address = getJobAddress(data);
      const pay = getJobPay(data);
      const description = textValue(data.descrizione).slice(0, 240);
      const details = [dateTime, address, pay].filter(Boolean);
      return `
        <div style="border:1px solid #dce6f8;border-radius:14px;padding:20px;margin:0 0 16px;background:#ffffff">
          <h2 style="font-size:18px;line-height:1.35;margin:0 0 10px;color:#172033">${escapeHtml(title)}</h2>
          ${details.map((detail) => `<p style="margin:4px 0;color:#475569;font-size:14px;line-height:1.5">${escapeHtml(detail)}</p>`).join("")}
          ${description ? `<p style="margin:12px 0 0;color:#334155;font-size:14px;line-height:1.6">${escapeHtml(description)}</p>` : ""}
          <a href="${escapeHtml(getJobLink(id))}" style="display:inline-block;margin-top:16px;padding:10px 16px;border-radius:10px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px">Vedi incarico</a>
        </div>
      `;
    })
    .join("");
  const textJobs = jobs
    .map(({ id, data }, index) => {
      const details = [
        getJobDateTime(data),
        getJobAddress(data),
        getJobPay(data),
        textValue(data.descrizione).slice(0, 240),
      ].filter(Boolean);
      return `${index + 1}. ${getJobTitle(data)}\n${details.join("\n")}\n${getJobLink(id)}`;
    })
    .join("\n\n");

  return {
    to: recipient,
    subject,
    text: `Ciao,\n\nJobly ha trovato ${count} ${count === 1 ? "nuovo incarico compatibile" : "nuovi incarichi compatibili"} con la tua zona di lavoro.\n\n${textJobs}\n\nA presto,\nJobly`,
    html: `
      <!doctype html>
      <html lang="it">
        <body style="margin:0;padding:0;background:#f5f8ff;font-family:Arial,sans-serif;color:#172033">
          <div style="padding:24px 12px">
            <div style="max-width:620px;margin:0 auto">
              <div style="font-size:26px;font-weight:800;color:#2563eb;margin:0 0 20px">Jobly</div>
              <div style="background:#ffffff;border:1px solid #dce6f8;border-radius:18px;padding:24px;margin-bottom:18px">
                <h1 style="font-size:24px;line-height:1.3;margin:0 0 10px">${count === 1 ? "Un nuovo incarico per te" : `${count} nuovi incarichi per te`}</h1>
                <p style="font-size:16px;line-height:1.6;margin:0;color:#475569">Abbiamo trovato opportunità compatibili con la tua zona di lavoro e il raggio selezionato.</p>
              </div>
              ${cards}
              <p style="font-size:12px;line-height:1.5;color:#64748b;text-align:center;margin:20px 0">Ricevi questa email perché hai attivato gli avvisi lavoro via email su Jobly.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };
};
