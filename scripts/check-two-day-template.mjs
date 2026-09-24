import assert from "node:assert/strict";
import { buildSchedule } from "../src/modules/scheduler-handover.js";
import { TWO_DAY_MODE } from "../src/modules/two-day-template.js";
import { applyManualAssignments, assignmentsFromSchedule, buildEmptySchedule } from "../src/modules/manual-schedule.js";

const team = Array.from({ length: 6 }, (_, i) => ({ id: `A${i}`, active: true, shift: "all", days: "all", templateWeekendPhase: i % 3 }));
for (const [year, month] of [[2026, 0], [2026, 1], [2028, 1], [2026, 7], [2026, 11]]) {
  const result = buildSchedule({ year, month, auxiliaries: team, rotationDays: TWO_DAY_MODE });
  const persisted = applyManualAssignments({ schedule: buildEmptySchedule({ year, month }), assignments: assignmentsFromSchedule({ ...result, year, month }), hourOverrides: result.hourOverrides, year, month });
  assert.equal(Object.keys(result.schedule).length, new Date(year, month + 1, 0).getDate());
  for (const plan of Object.values(result.schedule)) {
    assert.equal(plan.morning.worker, plan.afternoon.worker);
    assert.equal(plan.morning.hours + plan.afternoon.hours, 12);
    assert.equal(persisted[plan.day].bedtime.hours, 2, "Bedtime must stay 2h after applying and restoring the example");
    assert.equal(persisted[plan.day].night.hours, 12);
    if (plan.bedtime.worker) assert.notEqual(plan.bedtime.worker, plan.morning.worker);
    const weekday = new Date(year, month, plan.day).getDay();
    if ([1, 4, 6].includes(weekday) && result.schedule[plan.day + 1]) {
      assert.equal(plan.morning.worker, result.schedule[plan.day + 1].morning.worker, "Two-day block must remain intact");
    }
    if (weekday === 6 && result.schedule[plan.day + 21]) {
      assert.equal(team.find(aux => aux.id === plan.morning.worker).templateWeekendPhase, team.find(aux => aux.id === result.schedule[plan.day + 21].morning.worker).templateWeekendPhase, "Weekend group repeats every three weeks");
    }
    if (plan.bedtime.worker && result.schedule[plan.day + 1]) {
      assert.notEqual(plan.bedtime.worker, result.schedule[plan.day + 1].morning.worker, "No 10h rest between bedtime and next morning");
    }
  }
}
const excluded = buildSchedule({ year: 2026, month: 8, rotationDays: TWO_DAY_MODE, auxiliaries: team.map(aux => ({ ...aux, templatePlaceHours: false })) });
assert.ok(excluded.warnings.length);
assert.ok(Object.values(excluded.schedule).every(day => !day.morning.worker && !day.night.worker));
const custom = buildSchedule({ year: 2026, month: 8, rotationDays: TWO_DAY_MODE, auxiliaries: team.map(aux => ({ ...aux, templateMorningHours: 6, templateAfternoonHours: 4 })) });
assert.ok(Object.values(custom.schedule).every(day => day.morning.hours === 6 && day.afternoon.hours === 4));
const noEvening = buildSchedule({ year: 2026, month: 8, rotationDays: TWO_DAY_MODE, auxiliaries: team.map(aux => ({ ...aux, shift: "day", night: false })) });
assert.ok(Object.values(noEvening.schedule).every(day => !day.night.worker));
const duties = new Map(team.map(aux => [aux.id, []]));
for (const month of [7, 8, 9]) {
  const { schedule } = buildSchedule({ year: 2026, month, auxiliaries: team, rotationDays: TWO_DAY_MODE });
  for (const day of Object.values(schedule)) {
    const base = Date.UTC(2026, month, day.day) / 3600000;
    if (day.morning.worker) duties.get(day.morning.worker).push([base + 7.5, base + 19.5]);
    if (day.bedtime.worker) duties.get(day.bedtime.worker).push([base + 19.5, base + 21.5]);
  }
}
for (const entries of duties.values()) {
  entries.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < entries.length; i++) assert.ok(entries[i][0] - entries[i - 1][1] >= 11, "11h reserved rest also across month boundaries");
  for (let weekStart = Date.UTC(2026, 8, 7) / 3600000; weekStart < Date.UTC(2026, 8, 28) / 3600000; weekStart += 168) {
    const weekly = entries.filter(([start]) => start >= weekStart && start < weekStart + 168);
    assert.ok(weekly.reduce((sum, [start, end]) => sum + end - start, 0) <= 48);
    let cursor = weekStart;
    let gap = 0;
    for (const [start, end] of weekly) { gap = Math.max(gap, start - cursor); cursor = end; }
    assert.ok(Math.max(gap, weekStart + 168 - cursor) >= 35, "35h weekly rest must remain after adding bedtime duties");
  }
}
console.log("Two-day template OK: blocks, weekends, leap year, independent bedtime, persisted hours and preferences.");
