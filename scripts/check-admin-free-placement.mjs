import { buildRotationAudit } from "../src/modules/rotation-audit.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const auxiliaries = [
  {
    id: "A",
    name: "Alice",
    active: true,
    shift: "morning",
    days: "weekdays",
    night: false,
    customDays: [0, 1, 2, 3, 4],
  },
];

const schedule = {
  1: {
    day: 1,
    morning: { worker: "A", workers: ["A"] },
    afternoon: { worker: "A", workers: ["A"] },
    night: { worker: "A", workers: ["A"] },
  },
};

const checks = buildRotationAudit({ year: 2026, month: 5, auxiliaries, schedule, rotationDays: 1 });
const preference = checks.find(item => item.title === "Hors preferences auxiliaires");
assert(preference?.level === "warning", "Le placement hors options doit etre un avertissement");
assert(!checks.some(item => item.title === "Options auxiliaires non respectees" || item.level === "danger" && item.detail.includes("Alice")), "Le placement manuel hors options ne doit pas bloquer l'admin");

console.log("Controle placement libre OK: hors options signale sans blocage");
