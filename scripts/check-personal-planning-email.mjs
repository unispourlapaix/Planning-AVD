import assert from "node:assert/strict";
import { buildPersonalPlanningEmail, buildPlanningEml } from "../src/modules/personal-planning-email.js";
const auxiliary = { id: "A", name: "Camille <test>", email: "camille@example.test", quota: 10 };
const other = { id: "B", name: "Alex", email: "private@example.test", quota: 151 };
const options = { year: 2028, month: 1, auxiliary, auxiliaries: [auxiliary, other], startTime: "11:00", beneficiaryName: "Dossier <test>", appUrl: "https://example.test/Planning-AVD/", schedule: {
  1: { day: 1, morning: { worker: "A", workers: ["A"], hours: 7 }, afternoon: { worker: "B", workers: ["B"], hours: 5 }, night: { worker: "A", workers: ["A"], hours: 2 } },
  29: { day: 29, morning: { worker: "B", workers: ["B", "A"], hours: 7, workerHours: { A: 3 } } },
} };
const result = buildPersonalPlanningEmail(options);
assert.equal(result.total, 12, "Count all actual assigned durations, including individual overrides");
assert.equal(result.difference, 2, "Never cap the total at quota");
assert.equal(result.rows.length, 3);
assert.ok(result.text.includes("Mardi 29/02/2028"));
assert.equal(result.rows[0].range, "11:00–18:00");
assert.equal(result.rows[1].range, "23:00–01:00 (+1 j)");
assert.ok(result.html.includes("#e0f1ff") && result.html.includes("#f1f2f3"));
assert.ok(!result.html.includes("Camille <test>"));
assert.ok(!result.html.includes(other.email));
assert.ok(!result.text.includes("151"));
const empty = buildPersonalPlanningEmail({ ...options, schedule: {} });
assert.equal(empty.total, 0);
assert.equal(empty.difference, -10);
assert.ok(empty.text.includes("Aucun créneau"));
assert.throws(() => buildPersonalPlanningEmail({ ...options, startTime: "99:99" }));
const eml = buildPlanningEml({ ...result, email: auxiliary.email });
assert.ok(eml.includes("To: camille@example.test\r\n"));
assert.ok(eml.includes("Content-Type: text/html"));
assert.ok(eml.includes("Content-Type: text/plain"));
assert.ok(!eml.includes("Bcc:"));
assert.throws(() => buildPlanningEml({ ...result, email: "x@test.fr\r\nBcc: other@test.fr" }));
console.log("Personal email OK: dates, chosen start, midnight, custom durations, quota difference, colors, privacy and EML.");
