import { calculateAssignedHours, calculatePerformedHours } from "../src/modules/hour-accounting.js";
import { applyManualAssignments, buildEmptySchedule } from "../src/modules/manual-schedule.js";
import { shiftWorkerHourKey, slotWorkerHours } from "../src/modules/shift-hours.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const year = 2026;
const month = 5;
const auxiliaries = [
  { id: "A", name: "Alice", active: true, quota: 50 },
  { id: "B", name: "Bruno", active: true, quota: 50 },
];
const overrides = {
  [`${year}-${month}-1-morning`]: ["A", "B"],
};
const hourOverrides = {
  [shiftWorkerHourKey(year, month, 1, "morning", "A")]: 6,
  [shiftWorkerHourKey(year, month, 1, "morning", "B")]: 2,
};

const schedule = applyManualAssignments({
  schedule: buildEmptySchedule({ year, month }),
  assignments: overrides,
  hourOverrides,
  year,
  month,
});

assert(slotWorkerHours(schedule[1].morning, "morning", "A") === 6, "Alice doit garder 6h sur sa pastille");
assert(slotWorkerHours(schedule[1].morning, "morning", "B") === 2, "Bruno doit garder 2h sur sa pastille");

const assigned = calculateAssignedHours(schedule, auxiliaries);
assert(assigned.A.total === 6, `Alice doit avoir 6h attribuees, recu ${assigned.A.total}`);
assert(assigned.B.total === 2, `Bruno doit avoir 2h attribuees, recu ${assigned.B.total}`);

const performedOpen = calculatePerformedHours(schedule, auxiliaries, { year, month, now: new Date(year, month, 2) });
assert(performedOpen.A.total === 6, `Alice titulaire doit avoir 6h effectuees, recu ${performedOpen.A.total}`);
assert(performedOpen.B.total === 0, "Le renfort reste en attente avant cloture du mois");

const performedClosed = calculatePerformedHours(schedule, auxiliaries, { year, month, now: new Date(year, month + 1, 1) });
assert(performedClosed.B.total === 2, `Bruno renfort doit avoir 2h a la cloture, recu ${performedClosed.B.total}`);

console.log("Controle heures par pastille OK: titulaire et renfort ont chacun leur duree");
