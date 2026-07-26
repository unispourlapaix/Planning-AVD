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
  shiftDisplayLabel({ shift: "morning", schedule, day: 1, worker: "A" }) === "Matin",
  "Le matin doit rester un creneau simple",
);
assert(
  shiftDisplayLabel({ shift: "morning", schedule, day: 2, worker: "B" }) === "Matin",
  "Le matin apres veille doit rester un creneau simple",
);
assert(
  shiftDisplayLabel({ shift: "morning", schedule, day: 3, worker: "C" }) === "Matin",
  "Le demi-matin doit rester un creneau simple",
);
assert(
  shiftDisplayLabel({ shift: "morning", schedule, day: 4, worker: "E" }) === "Matin",
  "Le demi-matin apres veille doit rester un creneau simple",
);
assert(
  shiftDisplayLabel({ shift: "afternoon" }) === "Après-midi",
  "L'apres-midi doit rester un creneau simple",
);
assert(
  shiftDisplayLabel({ shift: "night" }) === "Soir",
  "Le soir doit rester un creneau simple",
);

console.log("Controle libelles OK: creneaux simples matin, apres-midi, soir");
