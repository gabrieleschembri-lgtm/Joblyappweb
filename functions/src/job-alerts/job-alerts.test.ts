import assert from "node:assert/strict";
import test from "node:test";
import { buildJobAlertEmail } from "./email";
import { isJobAvailable, isWorkerWithinRadius } from "./service";

test("exact distance matching respects the worker radius", () => {
  assert.equal(isWorkerWithinRadius(45.4642, 9.19, 45.47, 9.2, 10), true);
  assert.equal(isWorkerWithinRadius(45.4642, 9.19, 46.0664, 11.1258, 10), false);
});

test("job availability rejects closed, hired, inactive, and past jobs", () => {
  const futureJob = { status: "open", hireStatus: "open", data: "31/12/2099", oraInizio: "12:00" };
  assert.equal(isJobAvailable(futureJob), true);
  assert.equal(isJobAvailable({ ...futureJob, status: "closed" }), false);
  assert.equal(isJobAvailable({ ...futureJob, hireStatus: "confirmed" }), false);
  assert.equal(isJobAvailable({ ...futureJob, isActive: false }), false);
  assert.equal(
    isJobAvailable({ status: "open", data: "01/01/2020", oraInizio: "12:00" }),
    false
  );
});

test("email output is branded, linked, plain-text capable, and escaped", () => {
  const email = buildJobAlertEmail("worker@example.com", [
    {
      id: "job/one",
      data: {
        tipo: { categoria: "altro", altroDettaglio: "Bar <script>" },
        data: "31/12/2099",
        oraInizio: "12:00",
        oraFine: "16:00",
        indirizzo: { citta: "Milano" },
        compensoOrario: 12,
      },
    },
  ]);
  assert.match(email.subject, /1 nuovo incarico/);
  assert.match(email.html, /Jobly/);
  assert.match(email.html, /Bar &lt;script&gt;/);
  assert.doesNotMatch(email.html, /Bar <script>/);
  assert.match(email.html, /jobId=job%2Fone/);
  assert.match(email.text, /https:\/\/joblyapp\.it/);
});
