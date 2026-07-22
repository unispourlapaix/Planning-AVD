import { calculateAssignedHours } from "../src/modules/hour-accounting.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const auxiliaries = [
  { id: "A", name: "Alice", quota: 18 },
  { id: "B", name: "Bruno", quota: 12 },
];

const schedule = {
  1: {
    day: 1,
    morning: { worker: "A", workers: ["A"] },
    afternoon: { worker: "A", workers: ["A"] },
    night: { worker: "B", workers: ["B"] },
  },
  2: {
    day: 2,
    morning: { worker: "A", workers: ["A"] },
    afternoon: { worker: "", workers: [] },
    night: { worker: "A", workers: ["A"] },
  },
};

const hours = calculateAssignedHours(schedule, auxiliaries);

assert(hours.A.total === 31, `Alice doit avoir 31h attribuees, recu ${hours.A.total}`);
assert(hours.A.pause === 0, `Alice ne doit plus avoir de reste, recu ${hours.A.pause}`);
assert(hours.A.over === 13, `Alice doit avoir 13h de depassement, recu ${hours.A.over}`);
assert(hours.B.total === 12, `Bruno doit avoir 12h attribuees, recu ${hours.B.total}`);
assert(hours.B.pause === 0, `Bruno doit etre au quota, recu ${hours.B.pause}`);
assert(hours.B.over === 0, `Bruno ne doit pas depasser, recu ${hours.B.over}`);

console.log("Controle attribution OK: attribue, reste et depassement");
