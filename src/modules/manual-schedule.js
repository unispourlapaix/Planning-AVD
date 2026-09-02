import { SHIFT_DEFS } from "./constants.js?v=20260726-normal-slots";
import { daysInMonth } from "./dates.js";
import { defaultHoursForShift, normalizeSlotHour, shiftHourKey, shiftWorkerHourKey } from "./shift-hours.js?v=20260722-custom-hours";
import { compactManualWorkers, manualWorkerIds, primaryManualWorker } from "./manual-workers.js?v=20260726-empty-slot";

export const scheduleAssignmentKey = (year, month, day, shift) => `${year}-${month}-${day}-${shift}`;

const emptyShift = shift => ({ id: shift.id, worker: "", workers: [], hours: defaultHoursForShift(shift.id) });
const monthPrefix = (year, month) => `${year}-${month}-`;
const previousMonthOf = (year, month) => {
  const date = new Date(year, month - 1, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
};

const remapMonthKey = ({ key, sourceYear, sourceMonth, targetYear, targetMonth, maxDay }) => {
  const [baseKey, workerSuffix = ""] = String(key || "").split("::");
  const [rawYear, rawMonth, rawDay, shift] = baseKey.split("-");
  const day = Number(rawDay);
  if (Number(rawYear) !== sourceYear || Number(rawMonth) !== sourceMonth || !Number.isInteger(day) || day < 1 || day > maxDay || !shift) return "";
  const nextKey = scheduleAssignmentKey(targetYear, targetMonth, day, shift);
  return workerSuffix ? `${nextKey}::${workerSuffix}` : nextKey;
};

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
      const workerHours = Object.fromEntries(workers
        .map(id => [id, normalizeSlotHour(hourOverrides[shiftWorkerHourKey(year, month, day, shift.id, id)])])
        .filter(([, value]) => value !== null && value !== hours));
      return [shift.id, worker ? { ...base, worker, workers, hours, workerHours } : { ...emptyShift(shift), hours }];
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

export function copyPreviousMonthAssignments({ current = {}, year, month }) {
  const source = previousMonthOf(year, month);
  const maxDay = daysInMonth(year, month);
  const copied = Object.fromEntries(Object.entries(current)
    .map(([key, value]) => [remapMonthKey({
      key,
      sourceYear: source.year,
      sourceMonth: source.month,
      targetYear: year,
      targetMonth: month,
      maxDay,
    }), value])
    .filter(([key]) => key));
  return {
    current: {
      ...clearMonthAssignments({ current, year, month }),
      ...copied,
    },
    count: Object.keys(copied).length,
    sourceYear: source.year,
    sourceMonth: source.month,
  };
}
