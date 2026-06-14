import { DEFAULT_QUOTA, SHIFT_DEFS } from "./constants.js";

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
