import { calculateAssignedHours, calculatePerformedHours } from "../src/modules/hour-accounting.js";
import { applyManualAssignments, buildEmptySchedule } from "../src/modules/manual-schedule.js";
import { buildReportHtml } from "../src/modules/report.js";
import { buildPersonalSharePayloads } from "../src/modules/storage.js";
import { breakNoticeForSlot } from "../src/modules/break-rules.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const year = 2026;
const month = 5;
const auxiliaries = [
  { id: "A", name: "Alice", email: "alice@example.com", active: true, quota: 20 },
  { id: "B", name: "Bruno", email: "bruno@example.com", active: true, quota: 20 },
];
const overrides = {
  [`${year}-${month}-1-morning`]: "A",
  [`${year}-${month}-1-afternoon`]: "A",
  [`${year}-${month}-1-night`]: "B",
  [`${year}-${month}-2-afternoon`]: "A",
};
const hourOverrides = {
  [`${year}-${month}-1-morning`]: 6,
  [`${year}-${month}-1-afternoon`]: 4.5,
  [`${year}-${month}-2-afternoon`]: 7,
};

const schedule = applyManualAssignments({
  schedule: buildEmptySchedule({ year, month }),
  assignments: overrides,
  hourOverrides,
  year,
  month,
});

const assigned = calculateAssignedHours(schedule, auxiliaries);
assert(schedule[1].afternoon.hours === 4.5, `Le créneau du 1 apres-midi doit garder 4.5h, recu ${schedule[1].afternoon.hours}`);
assert(assigned.A.morning === 6, `Matin custom attendu 6h, recu ${assigned.A.morning}`);
assert(assigned.A.afternoon === 11.5, `Apres-midi custom cumule attendu 11.5h, recu ${assigned.A.afternoon}`);
assert(assigned.A.total === 17.5, `Total custom attendu 17.5h, recu ${assigned.A.total}`);
assert(assigned.B.total === 12, `Nuit par defaut attendue 12h, recu ${assigned.B.total}`);
assert(
  breakNoticeForSlot({ shift: "afternoon", schedule, day: 2, worker: "A" })?.label === "Pause 20 min",
  "Un apres-midi custom de plus de 6h doit annoncer une pause",
);

const performed = calculatePerformedHours(schedule, auxiliaries, { year, month, now: new Date(year, month + 1, 1) });
assert(performed.A.total === 17.5, `Effectue custom attendu 17.5h, recu ${performed.A.total}`);

const report = buildReportHtml({ year, month, beneficiaryName: "Test", auxiliaries, schedule, hours: performed });
assert(report.includes("6h"), "Le rapport doit afficher les 6h du matin");
assert(report.includes("4.5h"), "Le rapport doit afficher les 4.5h de l'apres-midi");

const payloads = buildPersonalSharePayloads({ year, month, beneficiaryName: "Test", auxiliaries, schedule });
payloads.forEach(({ sharePayload }) => {
  assert(!("hours" in sharePayload), "La vue auxiliaire ne doit pas recevoir un champ hours");
  assert(!sharePayload.entries.some(entry => "hours" in entry), "Les creneaux auxiliaires ne doivent pas exposer les heures");
});

console.log("Controle heures custom OK: creneaux modifiables, compteurs justes, auxiliaires sans heures");
