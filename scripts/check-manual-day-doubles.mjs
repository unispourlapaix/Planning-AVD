import { calculateAssignedHours, calculatePerformedHours } from "../src/modules/hour-accounting.js";
import { applyManualAssignments, assignmentsFromSchedule, buildEmptySchedule } from "../src/modules/manual-schedule.js";
import { buildManualOverrideList } from "../src/modules/manual-overrides.js";
import { buildPersonalSharePayloads } from "../src/modules/storage.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const year = 2026;
const month = 5;
const auxiliaries = [
  { id: "A", name: "Alice", email: "alice@example.com", active: true, quota: 50 },
  { id: "B", name: "Bruno", email: "bruno@example.com", active: true, quota: 50 },
  { id: "C", name: "Camille", email: "camille@example.com", active: true, quota: 50 },
];
const overrides = {
  [`${year}-${month}-1-morning`]: ["A", "B"],
  [`${year}-${month}-1-afternoon`]: ["A", "C"],
  [`${year}-${month}-1-night`]: "A",
};

const schedule = applyManualAssignments({
  schedule: buildEmptySchedule({ year, month }),
  assignments: overrides,
  year,
  month,
});

assert(schedule[1].morning.worker === "A", "Le matin doit garder Alice en titulaire principal");
assert(schedule[1].morning.workers.join(",") === "A,B", "Le matin doit garder Alice + Bruno");
assert(schedule[1].afternoon.workers.join(",") === "A,C", "L'apres-midi doit garder Alice + Camille");

const exported = assignmentsFromSchedule({ schedule, year, month });
assert(Array.isArray(exported[`${year}-${month}-1-morning`]), "Un creneau avec doublon doit rester exporte en liste");

const assigned = calculateAssignedHours(schedule, auxiliaries);
assert(assigned.A.total === 24, `Alice doit avoir 24h attribuees, recu ${assigned.A.total}`);
assert(assigned.B.total === 7, `Bruno doit avoir 7h attribuees en doublon matin, recu ${assigned.B.total}`);
assert(assigned.C.total === 5, `Camille doit avoir 5h attribuees en doublon apres-midi, recu ${assigned.C.total}`);

const performedOpen = calculatePerformedHours(schedule, auxiliaries, { year, month, now: new Date(year, month, 2) });
assert(performedOpen.B.total === 0, "Le doublon reste en attente cote heures effectuees avant cloture du mois");

const performedClosed = calculatePerformedHours(schedule, auxiliaries, { year, month, now: new Date(year, month + 1, 1) });
assert(performedClosed.B.total === 7, "Le doublon matin est comptabilise a la cloture du mois");
assert(performedClosed.C.total === 5, "Le doublon apres-midi est comptabilise a la cloture du mois");

const manualList = buildManualOverrideList({ overrides, year, month, auxiliaries });
assert(manualList.find(item => item.shift === "morning")?.extraNames.includes("Bru"), "La liste manuelle doit afficher le doublon en 3 lettres");

const payloads = buildPersonalSharePayloads({ year, month, beneficiaryName: "Test", auxiliaries, schedule });
const bruno = payloads.find(item => item.email === "bruno@example.com")?.sharePayload;
assert(!bruno.entries.some(entry => entry.day === 1 && entry.shift === "morning"), "La vue auxiliaire ne doit pas exposer un doublon comme titulaire");

console.log("Controle doublons jour OK: titulaire + renforts jour, heures admin, vue auxiliaire propre");
