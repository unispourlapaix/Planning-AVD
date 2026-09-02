import { copyPreviousMonthAssignments } from "../src/modules/manual-schedule.js";
import { shiftWorkerHourKey } from "../src/modules/shift-hours.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const juneToJulyOverrides = {
  "2026-5-1-morning": ["A", "B"],
  "2026-5-30-night": "C",
  "2026-6-1-morning": "X",
};
const juneToJulyHours = {
  [shiftWorkerHourKey(2026, 5, 1, "morning", "A")]: 6,
  [shiftWorkerHourKey(2026, 5, 1, "morning", "B")]: 2,
  "2026-6-1-morning::X": 9,
};

const copiedOverrides = copyPreviousMonthAssignments({ current: juneToJulyOverrides, year: 2026, month: 6 });
assert(copiedOverrides.count === 2, `Deux créneaux doivent être copiés, reçu ${copiedOverrides.count}`);
assert(Array.isArray(copiedOverrides.current["2026-6-1-morning"]), "Le 1 juillet doit recevoir Alice + Bruno");
assert(copiedOverrides.current["2026-6-1-morning"].join(",") === "A,B", "Le 1 juillet doit garder l'ordre titulaire + renfort");
assert(copiedOverrides.current["2026-6-30-night"] === "C", "Le 30 juillet doit recevoir le soir du 30 juin");
assert(copiedOverrides.current["2026-6-1-morning"] !== "X", "Le mois cible doit être remplacé");

const copiedHours = copyPreviousMonthAssignments({ current: juneToJulyHours, year: 2026, month: 6 });
assert(copiedHours.current[shiftWorkerHourKey(2026, 6, 1, "morning", "A")] === 6, "L'heure titulaire doit être copiée");
assert(copiedHours.current[shiftWorkerHourKey(2026, 6, 1, "morning", "B")] === 2, "L'heure renfort doit être copiée");
assert(!copiedHours.current["2026-6-1-morning::X"], "Les anciennes heures du mois cible doivent être retirées");

const marchToApril = copyPreviousMonthAssignments({
  current: {
    "2026-2-30-morning": "A",
    "2026-2-31-night": "B",
  },
  year: 2026,
  month: 3,
});
assert(!marchToApril.current["2026-3-31-night"], "Le 31 ne doit pas être créé dans un mois de 30 jours");
assert(marchToApril.current["2026-3-30-morning"] === "A", "Le 30 doit être copié");

console.log("Controle reprise mois précédent OK: créneaux, heures par pastille et fins de mois");
