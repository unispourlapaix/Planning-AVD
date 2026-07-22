import { breakNoticeForSlot, personalBreakNoticeForSlot } from "../src/modules/break-rules.js";

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
    morning: { worker: "A", workers: ["A"] },
    afternoon: { worker: "B", workers: ["B"] },
    night: { worker: "B", workers: ["B"] },
  },
  3: {
    day: 3,
    morning: { worker: "C", workers: ["C"] },
    afternoon: { worker: "", workers: [] },
    night: { worker: "", workers: [] },
  },
};

assert(
  breakNoticeForSlot({ shift: "morning", schedule, day: 1, worker: "A" })?.label === "Pause 30 min",
  "Une journee matin+apres-midi doit notifier une pause de 30 min",
);
assert(
  breakNoticeForSlot({ shift: "night", schedule, day: 1, worker: "A" })?.label === "Repos à prévoir",
  "Une nuit doit annoncer le repos du lendemain",
);
assert(
  breakNoticeForSlot({ shift: "morning", schedule, day: 2, worker: "A" })?.label === "Repos conseillé",
  "Le lendemain d'une nuit doit annoncer le repos conseille",
);
assert(
  breakNoticeForSlot({ shift: "morning", schedule, day: 2, worker: "A" })?.blocking === false,
  "Le repos apres nuit doit rester une annonce non bloquante",
);
assert(
  breakNoticeForSlot({ shift: "morning", schedule, day: 3, worker: "C" })?.label === "Pause 20 min",
  "Un matin seul de 7h doit notifier une pause de 20 min",
);

const personalEntriesByDay = {
  1: [{ day: 1, shift: "morning" }, { day: 1, shift: "afternoon" }, { day: 1, shift: "night" }],
  2: [{ day: 2, shift: "morning" }],
  3: [{ day: 3, shift: "morning" }],
};

assert(
  personalBreakNoticeForSlot({ shift: "morning", entriesByDay: personalEntriesByDay, day: 1 })?.label === "Pause 30 min",
  "La vue auxiliaire doit notifier la pause de journee",
);
assert(
  personalBreakNoticeForSlot({ shift: "morning", entriesByDay: personalEntriesByDay, day: 2 })?.label === "Repos conseillé",
  "La vue auxiliaire doit annoncer le repos apres nuit",
);
assert(
  personalBreakNoticeForSlot({ shift: "morning", entriesByDay: personalEntriesByDay, day: 2 })?.blocking === false,
  "La vue auxiliaire doit garder le repos apres nuit non bloquant",
);
assert(
  personalBreakNoticeForSlot({ shift: "morning", entriesByDay: personalEntriesByDay, day: 3 })?.label === "Pause 20 min",
  "La vue auxiliaire doit notifier la pause du matin",
);

console.log("Controle pauses OK: pause matin, journee complete et repos apres nuit en annonce");
