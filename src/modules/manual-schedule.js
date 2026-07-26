import { SHIFT_DEFS } from "./constants.js?v=20260726-normal-slots";
import { daysInMonth } from "./dates.js";
import { defaultHoursForShift, normalizeSlotHour, shiftHourKey } from "./shift-hours.js?v=20260722-custom-hours";
import { compactManualWorkers, manualWorkerIds, primaryManualWorker } from "./manual-workers.js?v=20260724-day-doubles";

export const scheduleAssignmentKey = (year, month, day, shift) => `${year}-${month}-${day}-${shift}`;

const emptyShift = shift => ({ id: shift.id, worker: "", workers: [], hours: defaultHoursForShift(shift.id) });
const monthPrefix = (year, month) => `${year}-${month}-`;

export function buildEmptySchedule({ year, month }) {
  return Object.fromEntries(Array.from({ length: daysInMonth(year, month) }, (_, index) => {
    const day = index + 1;
    return [day, {
      day,
      ...Object.fromEntries(SHIFT_DEFS.map(shift => [shift.id, emptyShift(shift)])),
    }];
  }));
}

export function applyManualAssignments({ schedule, assignments = {}, hourOverrides = {}, year, month }) {
  return Object.fromEntries(Object.entries(schedule || {}).map(([day, plan]) => [day, {
    ...plan,
    ...Object.fromEntries(SHIFT_DEFS.map(shift => {
      const workers = manualWorkerIds(assignments[scheduleAssignmentKey(year, month, day, shift.id)]);
      const worker = workers[0] || "";
      const base = plan?.[shift.id] || emptyShift(shift);
      const customHours = normalizeSlotHour(hourOverrides[shiftHourKey(year, month, day, shift.id)]);
      const hours = customHours === null ? defaultHoursForShift(shift.id) : customHours;
      return [shift.id, worker ? { ...base, worker, workers, hours } : { ...emptyShift(shift), hours }];
    })),
  }]));
}

export function assignmentsFromSchedule({ schedule = {}, year, month }) {
  const assignments = {};
  Object.values(schedule).forEach(plan => {
    SHIFT_DEFS.forEach(shift => {
      const workers = manualWorkerIds(plan?.[shift.id]);
      if (primaryManualWorker(workers)) assignments[scheduleAssignmentKey(year, month, plan.day, shift.id)] = compactManualWorkers(workers);
    });
  });
  return assignments;
}

export function removeAutomaticNightMorningAssignments({ assignments = {}, year, month }) {
  const next = { ...assignments };
  Object.keys(assignments).forEach(key => {
    const [rawYear, rawMonth, rawDay, shift] = key.split("-");
    const day = Number(rawDay);
    if (Number(rawYear) !== year || Number(rawMonth) !== month || shift !== "morning" || day <= 1) return;
    const previousNightKey = scheduleAssignmentKey(year, month, day - 1, "night");
    const morningPrimary = primaryManualWorker(assignments[key]);
    const previousNightPrimary = primaryManualWorker(assignments[previousNightKey]);
    if (morningPrimary && morningPrimary === previousNightPrimary) delete next[key];
  });
  return next;
}

export function replaceMonthAssignments({ current = {}, next = {}, year, month }) {
  const prefix = monthPrefix(year, month);
  return {
    ...Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(prefix))),
    ...next,
  };
}

export function clearMonthAssignments({ current = {}, year, month }) {
  const prefix = monthPrefix(year, month);
  return Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(prefix)));
}
