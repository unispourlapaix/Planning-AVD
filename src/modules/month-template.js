import { SHIFT_DEFS } from "./constants.js";
import { daysInMonth } from "./dates.js";
import { copyPreviousMonthAssignments } from "./manual-schedule.js";
import { manualWorkerIds, compactManualWorkers, emptyManualSlot } from "./manual-workers.js";
import { defaultHoursForShift } from "./shift-hours.js";

export function copyMonthWithinQuotas({ year, month, overrides, hourOverrides, auxiliaries }) {
  const copied = copyPreviousMonthAssignments({ current: overrides, year, month });
  const assignments = copied.current;
  const hours = copyPreviousMonthAssignments({ current: hourOverrides, year, month }).current;
  const remaining = new Map(auxiliaries.filter(aux => aux.active !== false && !aux.removedFromGroup).map(aux => [aux.id, Math.max(0, Math.round((Number(aux.quota) || 0) * 100))]));
  let reduced = 0;
  for (let day = 1; day <= daysInMonth(year, month); day++) for (const slot of SHIFT_DEFS) {
    const key = `${year}-${month}-${day}-${slot.id}`;
    if (!(key in assignments)) continue;
    const retained = [];
    for (const worker of manualWorkerIds(assignments[key])) {
      const workerKey = `${key}::${worker}`;
      const requested = Math.max(0, Math.round(Number(hours[workerKey] ?? hours[key] ?? defaultHoursForShift(slot.id)) * 100));
      const allocated = Math.min(requested, remaining.get(worker) || 0);
      delete hours[workerKey];
      if (allocated < requested) reduced++;
      if (!allocated) continue;
      retained.push(worker);
      hours[workerKey] = allocated / 100;
      remaining.set(worker, remaining.get(worker) - allocated);
    }
    assignments[key] = retained.length ? compactManualWorkers(retained) : emptyManualSlot();
  }
  return { overrides: assignments, hourOverrides: hours, reduced, remaining, count: copied.count };
}
