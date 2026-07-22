import { DEFAULT_QUOTA, SHIFT_DEFS } from "./constants.js?v=20260722-shift-7-5";
import { daysInMonth } from "./dates.js";
import { slotHours } from "./shift-hours.js?v=20260722-custom-hours";

const roundHours = value => Math.round((Number(value) || 0) * 100) / 100;

export const quotaFor = auxiliary => {
  const quota = Number(auxiliary?.quota);
  return Number.isFinite(quota) && quota > 0 ? quota : DEFAULT_QUOTA;
};

export const createHourAccount = auxiliary => ({
  morning: 0,
  afternoon: 0,
  night: 0,
  total: 0,
  quota: quotaFor(auxiliary),
  pause: quotaFor(auxiliary),
  daily: {},
  reachedOnDay: null,
});

export const creditScheduledHours = ({ account, shift, scheduledHours, day }) => {
  if (!account || !SHIFT_DEFS.some(item => item.id === shift)) return 0;
  const remaining = Math.max(0, roundHours(account.quota - account.total));
  const credited = Math.min(Math.max(0, Number(scheduledHours) || 0), remaining);
  if (!credited) return 0;

  account[shift] = roundHours(account[shift] + credited);
  account.total = roundHours(account.total + credited);
  account.pause = Math.max(0, roundHours(account.quota - account.total));
  account.daily[day] = roundHours((account.daily[day] || 0) + credited);
  if (account.total >= account.quota && account.reachedOnDay === null) account.reachedOnDay = Number(day);
  return credited;
};

export const summarizeHours = (raw = {}, fallbackQuota = 0) => {
  const quotaValue = Number(raw.quota ?? fallbackQuota);
  const quota = Number.isFinite(quotaValue) && quotaValue > 0 ? quotaValue : DEFAULT_QUOTA;
  const summary = { morning: 0, afternoon: 0, night: 0 };
  let remaining = quota;

  SHIFT_DEFS.forEach(shift => {
    const credited = Math.min(Math.max(0, Number(raw[shift.id]) || 0), remaining);
    summary[shift.id] = roundHours(credited);
    remaining = roundHours(remaining - credited);
  });

  const total = roundHours(quota - remaining);
  return {
    ...raw,
    ...summary,
    total,
    quota,
    pause: Math.max(0, roundHours(quota - total)),
  };
};

const shiftWorkerIds = entry =>
  Array.isArray(entry?.workers) ? entry.workers.filter(Boolean) : (entry?.worker ? [entry.worker] : []);

export function calculateAssignedHours(schedule, auxiliaries) {
  const hours = Object.fromEntries(auxiliaries.map(aux => [aux.id, {
    morning: 0,
    afternoon: 0,
    night: 0,
    total: 0,
    quota: quotaFor(aux),
    pause: quotaFor(aux),
    over: 0,
    daily: {},
  }]));

  Object.entries(schedule || {}).forEach(([dayValue, plan]) => {
    const day = Number(dayValue);
    SHIFT_DEFS.forEach(shift => {
      shiftWorkerIds(plan?.[shift.id]).forEach(worker => {
        if (!worker || !hours[worker]) return;
        const scheduled = slotHours(plan?.[shift.id], shift.id);
        hours[worker][shift.id] = roundHours(hours[worker][shift.id] + scheduled);
        hours[worker].total = roundHours(hours[worker].total + scheduled);
        hours[worker].daily[day] = roundHours((hours[worker].daily[day] || 0) + scheduled);
      });
    });
  });

  Object.values(hours).forEach(account => {
    account.pause = Math.max(0, roundHours(account.quota - account.total));
    account.over = Math.max(0, roundHours(account.total - account.quota));
  });

  return hours;
}

export function accountingPeriodState({ year, month, now = new Date() }) {
  const monthStart = new Date(year, month, 1);
  const nextMonthStart = new Date(year, month + 1, 1);
  const totalDays = daysInMonth(year, month);

  if (now < monthStart) return { completedThrough: 0, monthClosed: false };
  if (now >= nextMonthStart) return { completedThrough: totalDays, monthClosed: true };
  return {
    completedThrough: Math.max(0, Math.min(totalDays, now.getDate() - 1)),
    monthClosed: false,
  };
}

export function calculatePerformedHours(schedule, auxiliaries, { year, month, now = new Date() }) {
  const period = accountingPeriodState({ year, month, now });
  const hours = Object.fromEntries(auxiliaries.map(aux => [aux.id, {
    ...createHourAccount(aux),
    completedThrough: period.completedThrough,
    monthClosed: period.monthClosed,
  }]));

  Object.entries(schedule).forEach(([dayValue, plan]) => {
    const day = Number(dayValue);
    if (!day || day > period.completedThrough) return;

    SHIFT_DEFS.forEach(shift => {
      shiftWorkerIds(plan?.[shift.id]).forEach((worker, workerIndex) => {
        // Secondary workers are completion hours confirmed when the month is closed.
        if (workerIndex > 0 && !period.monthClosed) return;
        if (!worker || !hours[worker]) return;
        creditScheduledHours({ account: hours[worker], shift: shift.id, scheduledHours: slotHours(plan?.[shift.id], shift.id), day });
      });
    });
  });

  return hours;
}
