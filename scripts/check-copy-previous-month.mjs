import { copyPreviousMonthAssignments } from "../src/modules/manual-schedule.js";
import { shiftWorkerHourKey } from "../src/modules/shift-hours.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const juneToJulyOverrides = {
  "2026-5-3-morning": ["A", "B"],
  "2026-5-30-night": "C",
  "2026-5-26-afternoon": "D",
  "2026-6-1-morning": "X",
};
const juneToJulyHours = {
  [shiftWorkerHourKey(2026, 5, 3, "morning", "A")]: 6,
  [shiftWorkerHourKey(2026, 5, 3, "morning", "B")]: 2,
  "2026-6-1-morning::X": 9,
};

const copiedOverrides = copyPreviousMonthAssignments({ current: juneToJulyOverrides, year: 2026, month: 6 });
assert(copiedOverrides.count === 4, `Quatre créneaux doivent être copiés, reçu ${copiedOverrides.count}`);
assert(Array.isArray(copiedOverrides.current["2026-6-1-morning"]), "Le 1 juillet doit reprendre le 1er mercredi du mois précédent");
assert(copiedOverrides.current["2026-6-1-morning"].join(",") === "A,B", "Le mercredi repris doit garder l'ordre titulaire + renfort");
assert(copiedOverrides.current["2026-6-28-night"] === "C", "Le dernier mardi de juillet doit reprendre le dernier mardi de juin");
assert(copiedOverrides.current["2026-6-24-afternoon"] === "D", "Le 4e vendredi de juillet doit reprendre le 4e vendredi de juin");
assert(copiedOverrides.current["2026-6-31-afternoon"] === "D", "Le 5e vendredi sans équivalent doit reprendre le dernier vendredi disponible");
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
assert(marchToApril.current["2026-3-27-morning"] === "A", "Le dernier lundi d'avril doit reprendre le dernier lundi de mars");

console.log("Controle reprise mois précédent OK: créneaux, heures par pastille et fins de mois");
