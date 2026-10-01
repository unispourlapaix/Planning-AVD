import assert from "node:assert/strict";
import { shiftTimeRange } from "../src/modules/shift-hours.js";
assert.equal(shiftTimeRange({ shift: "afternoon" }), "13:00–18:00");
const plan = { morning: { hours: 7, workers: ["A", "B"], workerHours: { A: 5, B: 8 } } };
assert.equal(shiftTimeRange({ plan, shift: "afternoon" }), "13:00–18:00");
assert.equal(shiftTimeRange({ plan: { morning: { hours: 7, worker: "A" } }, shift: "afternoon" }), "15:00–20:00");
assert.equal(shiftTimeRange({ plan: { morning: { hours: 5 }, afternoon: { hours: 7 } }, shift: "afternoon" }), "13:00–20:00");
assert.equal(shiftTimeRange({ plan, shift: "night" }), "20:00–08:00 (+1 j)");
console.log("Apres-midi : pause incluse, pas de decalage de fin, OK");
