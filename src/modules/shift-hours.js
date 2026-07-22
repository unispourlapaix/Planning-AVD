import { SHIFT_DEFS } from "./constants.js?v=20260722-shift-7-5";

const roundHours = value => Math.round((Number(value) || 0) * 100) / 100;

export const shiftHourKey = (year, month, day, shift) => `${year}-${month}-${day}-${shift}`;

export const defaultHoursForShift = shift => {
  const id = typeof shift === "string" ? shift : shift?.id;
  return Number(SHIFT_DEFS.find(item => item.id === id)?.hours) || 0;
};

export const normalizeSlotHour = value => {
  const normalized = typeof value === "string" ? value.replace(",", ".").trim() : value;
  if (normalized === "" || normalized === null || normalized === undefined) return null;
  const hours = Number(normalized);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) return null;
  return roundHours(hours);
};

export const slotHours = (entry, shift) => {
  const custom = normalizeSlotHour(entry?.hours);
  return custom === null ? defaultHoursForShift(shift) : custom;
};

export const hasCustomSlotHours = (entry, shift) => {
  const custom = normalizeSlotHour(entry?.hours);
  return custom !== null && custom !== defaultHoursForShift(shift);
};

export const normalizeHourOverrides = value => Object.fromEntries(Object.entries(value && typeof value === "object" ? value : {})
  .map(([key, hours]) => [key, normalizeSlotHour(hours)])
  .filter(([, hours]) => hours !== null));
