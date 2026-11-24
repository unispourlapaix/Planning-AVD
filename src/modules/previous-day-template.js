import { SHIFT_DEFS } from "./constants.js";
import { targetToSourceDayMap } from "./manual-schedule.js";
import { manualWorkerIds, emptyManualSlot, compactManualWorkers } from "./manual-workers.js";
export function previousDayTemplate({ year, month, day, overrides = {}, hourOverrides = {} }) {
  const previous = new Date(year, month - 1, 1);
  const sourceYear = previous.getFullYear(), sourceMonth = previous.getMonth();
  const sourceDay = targetToSourceDayMap({ sourceYear, sourceMonth, targetYear: year, targetMonth: month }).find(item => item.targetDay === day)?.sourceDay;
  const slots = SHIFT_DEFS.map(slot => {
    const key = `${sourceYear}-${sourceMonth}-${sourceDay}-${slot.id}`;
    return { ...slot, hours: hourOverrides[key] ?? slot.hours, workers: manualWorkerIds(overrides[key]).map(id => ({ id, hours: hourOverrides[`${key}::${id}`] ?? hourOverrides[key] ?? slot.hours })) };
  });
  return { sourceYear, sourceMonth, sourceDay, slots, found: slots.some(slot => slot.workers.length) };
}
export function applyPreviousDay({ year, month, day, slots, overrides, hourOverrides }) {
  const next = { ...overrides }, hours = { ...hourOverrides };
  for (const slot of slots) {
    const key = `${year}-${month}-${day}-${slot.id}`;
    const workers = slot.workers.filter(worker => worker.id);
    if (new Set(workers.map(worker => worker.id)).size !== workers.length) throw new Error("Auxiliaire en doublon sur un créneau.");
    next[key] = workers.length ? compactManualWorkers(workers.map(worker => worker.id)) : emptyManualSlot();
    for (const entry of Object.keys(hours)) if (entry === key || entry.startsWith(`${key}::`)) delete hours[entry];
    hours[key] = slot.hours;
    workers.forEach(worker => { hours[`${key}::${worker.id}`] = worker.hours; });
  }
  return { overrides: next, hourOverrides: hours };
}
