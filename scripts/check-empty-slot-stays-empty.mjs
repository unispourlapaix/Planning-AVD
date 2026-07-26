import { applyManualAssignments, buildEmptySchedule } from "../src/modules/manual-schedule.js";
import { buildManualOverrideList } from "../src/modules/manual-overrides.js";
import { emptyManualSlot, isManualEmptySlot, setManualPrimaryWorker } from "../src/modules/manual-workers.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const year = 2026;
const month = 5;
const auxiliaries = [
  { id: "A", name: "Alice", active: true, quota: 151 },
  { id: "B", name: "Bruno", active: true, quota: 151 },
];
const key = `${year}-${month}-3-morning`;
const overrides = {
  [key]: emptyManualSlot(),
  [`${year}-${month}-3-afternoon`]: "B",
};

const schedule = applyManualAssignments({
  schedule: buildEmptySchedule({ year, month }),
  assignments: overrides,
  year,
  month,
});

assert(isManualEmptySlot(overrides[key]), "Le vidage doit etre marque explicitement");
assert(!schedule[3].morning.worker, "Le creneau vide ne doit pas revenir dans le planning");
assert(schedule[3].afternoon.worker === "B", "Les autres creneaux restent affectes");

const list = buildManualOverrideList({ overrides, year, month, auxiliaries });
const emptyItem = list.find(item => item.key === key);
assert(emptyItem?.empty === true, "Le panneau manuel doit montrer le creneau vide");
assert(emptyItem?.workerName === "Créneau vidé", "Le libelle du creneau vide doit etre clair");

const reassigned = setManualPrimaryWorker(overrides[key], "A");
assert(reassigned === "A", "Rechoisir un titulaire doit remplacer le marqueur vide");

console.log("Controle creneau vide OK: le vidage reste memorise");
