import { buildRotationAudit } from "../src/modules/rotation-audit.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const auxiliaries = [
  { id: "A", name: "Alice", active: true, status: "available", shift: "all", days: "all", night: true },
  { id: "B", name: "Bruno", active: true, status: "available", shift: "all", days: "all", night: true },
  { id: "C", name: "Camille", active: true, status: "available", shift: "all", days: "all", night: true },
];

const schedule = {
  5: {
    day: 5,
    morning: { worker: "A", workers: ["A"] },
    afternoon: { worker: "A", workers: ["A"] },
    night: { worker: "A", workers: ["A"] },
  },
  6: {
    day: 6,
    morning: { worker: "B", workers: ["B"] },
    afternoon: { worker: "B", workers: ["B"] },
    night: { worker: "B", workers: ["B"] },
  },
  7: {
    day: 7,
    morning: { worker: "C", workers: ["C"] },
    afternoon: { worker: "C", workers: ["C"] },
    night: { worker: "C", workers: ["C"] },
  },
};

const checks = buildRotationAudit({ year: 2026, month: 5, auxiliaries, schedule, rotationDays: 1 });
assert(!checks.some(item => item.level === "danger" && /vendredi|samedi|week-end/i.test(`${item.title} ${item.detail}`)), "Le week-end manuel ne doit pas devenir une erreur bloquante");
assert(checks.some(item => item.level === "info" && item.title === "Week-end manuel"), "La passation vendredi/samedi doit rester une simple info");
assert(checks.some(item => item.level === "info" && item.title === "Week-end separe"), "Le week-end separe doit rester une simple info");

console.log("Controle week-end manuel OK: aucune regle auto bloquante");
