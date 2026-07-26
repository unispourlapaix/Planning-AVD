import { applyManualAssignments, buildEmptySchedule, removeAutomaticNightMorningAssignments } from "../src/modules/manual-schedule.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const year = 2026;
const month = 5;
const auxiliaries = [
  { id: "A", name: "Alice", active: true, status: "available", shift: "all", days: "all", night: true, quota: 151 },
  { id: "B", name: "Bruno", active: true, status: "available", shift: "all", days: "all", night: true, quota: 151 },
];

const manual = applyManualAssignments({
  schedule: buildEmptySchedule({ year, month }),
  assignments: {
    [`${year}-${month}-1-night`]: "A",
  },
  year,
  month,
});

assert(manual[1].night.worker === "A", "Le soir saisi doit rester place");
assert(!manual[2].morning.worker, "Le matin suivant ne doit pas etre rempli automatiquement en manuel");

const cleaned = removeAutomaticNightMorningAssignments({
  assignments: {
    [`${year}-${month}-1-night`]: "A",
    [`${year}-${month}-2-morning`]: "A",
    [`${year}-${month}-5-night`]: "B",
    [`${year}-${month}-6-morning`]: "B",
  },
  year,
  month,
});
assert(!cleaned[`${year}-${month}-2-morning`], "Le matin de semaine recopie depuis le soir doit etre retire");
assert(!cleaned[`${year}-${month}-6-morning`], "Le matin du samedi recopie depuis le vendredi soir doit aussi etre retire");

console.log("Controle manuel OK: pas de recopie automatique soir vers matin");
