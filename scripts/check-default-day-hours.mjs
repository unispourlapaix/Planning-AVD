import assert from "node:assert/strict";
import { defaultHoursForShift, slotWorkerHours, shiftTimeRange } from "../src/modules/shift-hours.js";
import { buildEmptySchedule } from "../src/modules/manual-schedule.js";
assert.equal(defaultHoursForShift("morning"), 5);
assert.equal(defaultHoursForShift("afternoon"), 5);
assert.equal(defaultHoursForShift("bedtime"), 2);
assert.equal(defaultHoursForShift("night"), 12);
for (const startTime of ["07:30", "08:00", "11:00"]) {
  assert.equal(shiftTimeRange({ shift: "night", startTime }), "20:00–08:00 (+1 j)");
}
assert.equal(shiftTimeRange({ shift: "night", worker: "A", plan: { night: { workerHours: { A: 10 } } } }), "20:00–06:00 (+1 j)");
assert.equal(buildEmptySchedule({ year: 2026, month: 8 })[1].morning.hours, 5);
assert.equal(slotWorkerHours({ hours: 7 }, "morning", "A"), 7);
assert.equal(slotWorkerHours({ workerHours: { A: 4 } }, "morning", "A"), 4);
console.log("Defaults 5 h / 5 h, custom durations preserved: OK");
