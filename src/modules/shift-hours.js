import { SHIFT_DEFS } from "./constants.js?v=20260726-normal-slots";

const roundHours = value => Math.round((Number(value) || 0) * 100) / 100;

export const shiftHourKey = (year, month, day, shift) => `${year}-${month}-${day}-${shift}`;
export const shiftWorkerHourKey = (year, month, day, shift, worker) =>
  `${shiftHourKey(year, month, day, shift)}::${String(worker || "").trim()}`;

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

export const slotWorkerHours = (entry, shift, worker) => {
  const inherited = slotHours(entry, shift);
  const custom = normalizeSlotHour(entry?.workerHours?.[worker]);
  return custom === null ? inherited : custom;
};

export const hasCustomSlotHours = (entry, shift) => {
  const custom = normalizeSlotHour(entry?.hours);
  if (custom !== null && custom !== defaultHoursForShift(shift)) return true;
  return Object.values(entry?.workerHours || {})
    .some(hours => normalizeSlotHour(hours) !== null && normalizeSlotHour(hours) !== slotHours(entry, shift));
};

export const hasCustomWorkerHours = (entry, shift, worker) => {
  const custom = normalizeSlotHour(entry?.workerHours?.[worker]);
  return custom !== null && custom !== slotHours(entry, shift);
};

export const normalizeHourOverrides = value => Object.fromEntries(Object.entries(value && typeof value === "object" ? value : {})
  .map(([key, hours]) => [key, normalizeSlotHour(hours)])
  .filter(([, hours]) => hours !== null));

export function shiftTimeRange({ plan = {}, shift, worker, startTime = "08:00" }) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) throw new Error("Heure de début invalide (HH:MM).");
  const [hour, minute] = startTime.split(":").map(Number);
  let start = hour * 60 + minute;
  for (const definition of SHIFT_DEFS) {
    if (definition.id === shift) break;
    if (definition.id !== "bedtime") start += Math.round(slotHours(plan[definition.id], definition.id) * 60);
  }
  const hours = worker ? slotWorkerHours(plan[shift], shift, worker) : slotHours(plan[shift], shift);
  const clock = minutes => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}${minutes >= 1440 ? ` (+${Math.floor(minutes / 1440)} j)` : ""}`;
  return `${clock(start)}–${clock(start + Math.round(hours * 60))}`;
}
