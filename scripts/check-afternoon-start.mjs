import assert from "node:assert/strict";
import { shiftTimeRange } from "../src/modules/shift-hours.js";
assert.equal(shiftTimeRange({ shift: "afternoon" }), "13:30–18:30");
const plan = { morning: { hours: 7, workers: ["A", "B"], workerHours: { A: 5, B: 8 } } };
assert.equal(shiftTimeRange({ plan, shift: "afternoon" }), "13:30–18:30");
assert.equal(shiftTimeRange({ plan: { morning: { hours: 7, worker: "A" } }, shift: "afternoon" }), "15:30–20:30");
assert.equal(shiftTimeRange({ plan, shift: "night" }), "20:00–08:00 (+1 j)");
console.log("Apres-midi : heures du titulaire + pause de 30 min, OK");
