import { SHIFT_DEFS } from "./constants.js?v=20260726-normal-slots";
import { dayIndex, daysInMonth } from "./dates.js";
import { defaultHoursForShift, normalizeSlotHour, shiftHourKey, shiftWorkerHourKey } from "./shift-hours.js?v=20260722-custom-hours";
import { compactManualWorkers, manualWorkerIds, primaryManualWorker } from "./manual-workers.js?v=20260726-empty-slot";

export const scheduleAssignmentKey = (year, month, day, shift) => `${year}-${month}-${day}-${shift}`;

const emptyShift = shift => ({ id: shift.id, worker: "", workers: [], hours: defaultHoursForShift(shift.id) });
const monthPrefix = (year, month) => `${year}-${month}-`;
const previousMonthOf = (year, month) => {
  const date = new Date(year, month - 1, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
};

const parseMonthKey = key => {
  const [baseKey, workerSuffix = ""] = String(key || "").split("::");
  const [rawYear, rawMonth, rawDay, shift] = baseKey.split("-");
  return {
    year: Number(rawYear),
    month: Number(rawMonth),
    day: Number(rawDay),
    shift,
    workerSuffix,
  };
};

const monthDaysByWeekday = (year, month) => {
  const groups = Array.from({ length: 7 }, () => []);
  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    groups[dayIndex(year, month, day)].push(day);
  }
  return groups;
};

const targetToSourceDayMap = ({ sourceYear, sourceMonth, targetYear, targetMonth }) => {
  const sourceGroups = monthDaysByWeekday(sourceYear, sourceMonth);
  const targetGroups = monthDaysByWeekday(targetYear, targetMonth);
  const pairs = [];
  targetGroups.forEach((days, weekday) => {
    const sourceDays = sourceGroups[weekday] || [];
    days.forEach((targetDay, index) => {
      const sourceIndex = sourceDays.length > days.length && index === days.length - 1
        ? sourceDays.length - 1
        : Math.min(index, sourceDays.length - 1);
      const sourceDay = sourceDays[sourceIndex] || 0;
      if (sourceDay) pairs.push({ targetDay, sourceDay });
    });
  });
  return pairs;
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
  const sourceByDay = new Map();
  Object.entries(current).forEach(([key, value]) => {
    const parsed = parseMonthKey(key);
    if (parsed.year !== source.year || parsed.month !== source.month || !Number.isInteger(parsed.day) || !parsed.shift) return;
    const items = sourceByDay.get(parsed.day) || [];
    items.push({ ...parsed, value });
    sourceByDay.set(parsed.day, items);
  });
  const copiedEntries = targetToSourceDayMap({
    sourceYear: source.year,
    sourceMonth: source.month,
    targetYear: year,
    targetMonth: month,
  }).flatMap(({ targetDay, sourceDay }) => (sourceByDay.get(sourceDay) || []).map(item => {
    const nextKey = scheduleAssignmentKey(year, month, targetDay, item.shift);
    return [item.workerSuffix ? `${nextKey}::${item.workerSuffix}` : nextKey, item.value];
  }));
  const copied = Object.fromEntries(copiedEntries);
  return {
    current: {
      ...clearMonthAssignments({ current, year, month }),
      ...copied,
    },
    count: Object.keys(copied).length,
    sourceYear: source.year,
    sourceMonth: source.month,
    strategy: "weekday-position",
  };
}
