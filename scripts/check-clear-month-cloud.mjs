import { markMonthCleared, mergePlanningStateForCloudLoad } from "../src/modules/storage.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const localClearedAt = "2026-09-12T09:30:00.000Z";
const local = {
  year: 2026,
  month: 5,
  beneficiaryId: "ben-test",
  auxiliaries: [{ id: "A", name: "Alice", active: true }],
  overrides: {
    "2026-4-1-morning": "A",
  },
  hourOverrides: {},
  clearedMonths: markMonthCleared({ year: 2026, month: 5, clearedAt: localClearedAt }),
  updatedAt: localClearedAt,
};

const olderCloud = {
  ...local,
  overrides: {
    "2026-4-1-morning": "A",
    "2026-5-3-morning": "A",
    "2026-5-3-afternoon": "A",
  },
  hourOverrides: {
    "2026-5-3-morning": 7,
    "2026-4-1-morning": 7,
  },
  clearedMonths: {},
  updatedAt: "2026-09-12T09:00:00.000Z",
};

const merged = mergePlanningStateForCloudLoad({ local, cloud: olderCloud });
assert(!merged.overrides["2026-5-3-morning"], "Le vieux cloud ne doit pas remettre le matin du mois vidé");
assert(!merged.overrides["2026-5-3-afternoon"], "Le vieux cloud ne doit pas remettre l'après-midi du mois vidé");
assert(!merged.hourOverrides["2026-5-3-morning"], "Les heures du mois vidé doivent aussi être retirées");
assert(merged.overrides["2026-4-1-morning"] === "A", "Les autres mois doivent rester intacts");
assert(merged.hourOverrides["2026-4-1-morning"] === 7, "Les heures des autres mois doivent rester intactes");
assert(merged.clearedMonths["2026-06"] === localClearedAt, "La marque de vidage doit rester dans l'état");

const localWithNewSlotAfterClear = {
  ...local,
  overrides: {
    ...local.overrides,
    "2026-5-4-morning": "M",
  },
  hourOverrides: {
    "2026-5-4-morning": 7,
  },
  updatedAt: "2026-09-12T09:45:00.000Z",
};
const mergedWithNewSlot = mergePlanningStateForCloudLoad({ local: localWithNewSlotAfterClear, cloud: olderCloud });
assert(mergedWithNewSlot.overrides["2026-5-4-morning"] === "M", "Un creneau remis apres vidage doit rester apres actualisation");
assert(mergedWithNewSlot.hourOverrides["2026-5-4-morning"] === 7, "Les heures du creneau remis apres vidage doivent rester");
assert(!mergedWithNewSlot.overrides["2026-5-3-morning"], "Le vieux cloud ne doit pas revenir quand un nouveau creneau est ajoute apres vidage");

const localNewerDraft = {
  ...olderCloud,
  overrides: {
    "2026-5-3-morning": "M",
  },
  hourOverrides: {
    "2026-5-3-morning": 7,
  },
  clearedMonths: {},
  updatedAt: "2026-09-12T09:45:00.000Z",
};
const mergedLocalDraft = mergePlanningStateForCloudLoad({ local: localNewerDraft, cloud: olderCloud });
assert(mergedLocalDraft.overrides["2026-5-3-morning"] === "M", "Un brouillon local plus recent doit gagner sur un cloud ancien");

const newerCloud = {
  ...olderCloud,
  updatedAt: "2026-09-12T10:00:00.000Z",
};
const mergedNewer = mergePlanningStateForCloudLoad({ local, cloud: newerCloud });
assert(mergedNewer.overrides["2026-5-3-morning"] === "A", "Un cloud plus récent que le vidage local doit rester prioritaire");

console.log("Controle vidage cloud OK: mois vidé mémorisé sans casser les autres mois");
