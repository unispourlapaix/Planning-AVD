import { shiftDisplayLabel } from "../src/modules/shift-labels.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const schedule = {
  1: {
    day: 1,
    morning: { worker: "A", workers: ["A"] },
    afternoon: { worker: "A", workers: ["A"] },
    night: { worker: "A", workers: ["A"] },
  },
  2: {
    day: 2,
    morning: { worker: "B", workers: ["B"] },
    afternoon: { worker: "B", workers: ["B"] },
    night: { worker: "", workers: [] },
  },
  3: {
    day: 3,
    morning: { worker: "C", workers: ["C"] },
    afternoon: { worker: "", workers: [] },
    night: { worker: "D", workers: ["D"] },
  },
  4: {
    day: 4,
    morning: { worker: "E", workers: ["E"] },
    afternoon: { worker: "", workers: [] },
    night: { worker: "", workers: [] },
  },
};

assert(
  shiftDisplayLabel({ shift: "morning", schedule, day: 1, worker: "A" }) === "Matin 7h30-19h30",
  "Un jour complet sans veille doit rester 7h30-19h30",
);
assert(
  shiftDisplayLabel({ shift: "morning", schedule, day: 2, worker: "B" }) === "Matin 11h-23h",
  "Un jour complet apres veille doit rester 11h-23h",
);
assert(
  shiftDisplayLabel({ shift: "morning", schedule, day: 3, worker: "C" }) === "Matin 7h30-14h30",
  "Un demi-matin sans veille doit passer a 7h30-14h30",
);
assert(
  shiftDisplayLabel({ shift: "morning", schedule, day: 4, worker: "E" }) === "Matin 11h-18h",
  "Un demi-matin apres veille doit passer a 11h-18h",
);
assert(
  shiftDisplayLabel({ shift: "afternoon" }) === "Après-midi 5h",
  "L'apres-midi doit afficher 5h",
);

console.log("Controle libelles OK: matin 7h et apres-midi 5h");
