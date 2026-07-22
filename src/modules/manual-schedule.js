import { SHIFT_DEFS } from "./constants.js?v=20260722-shift-7-5";
import { daysInMonth } from "./dates.js";
import { defaultHoursForShift, normalizeSlotHour, shiftHourKey } from "./shift-hours.js?v=20260722-custom-hours";

export const scheduleAssignmentKey = (year, month, day, shift) => `${year}-${month}-${day}-${shift}`;

const emptyShift = shift => ({ id: shift.id, worker: "", workers: [], hours: defaultHoursForShift(shift.id) });
const primaryWorker = entry => Array.isArray(entry?.workers) ? entry.workers.filter(Boolean)[0] || "" : entry?.worker || "";
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
      const worker = assignments[scheduleAssignmentKey(year, month, day, shift.id)] || "";
      const base = plan?.[shift.id] || emptyShift(shift);
      const customHours = normalizeSlotHour(hourOverrides[shiftHourKey(year, month, day, shift.id)]);
      const hours = customHours === null ? defaultHoursForShift(shift.id) : customHours;
      return [shift.id, worker ? { ...base, worker, workers: [worker], hours } : { ...emptyShift(shift), hours }];
    })),
  }]));
}

export function assignmentsFromSchedule({ schedule = {}, year, month }) {
  const assignments = {};
  Object.values(schedule).forEach(plan => {
    SHIFT_DEFS.forEach(shift => {
      const worker = primaryWorker(plan?.[shift.id]);
      if (worker) assignments[scheduleAssignmentKey(year, month, plan.day, shift.id)] = worker;
    });
  });
  return assignments;
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
