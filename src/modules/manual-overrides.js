import { MONTHS, SHIFT_LABEL } from "./constants.js?v=20260726-normal-slots";
import { defaultHoursForShift, normalizeSlotHour } from "./shift-hours.js?v=20260722-custom-hours";
import { isManualEmptySlot, manualWorkerIds } from "./manual-workers.js?v=20260726-empty-slot";

export const manualOverrideKey = (year, month, day, shift) => `${year}-${month}-${day}-${shift}`;

export function parseManualOverrideKey(key) {
  const [rawYear, rawMonth, rawDay, shift] = String(key || "").split("-");
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || !shift) return null;
  return { year, month, day, shift };
}

export function buildManualOverrideList({ overrides = {}, hourOverrides = {}, year, month, auxiliaries = [] }) {
  const names = Object.fromEntries(auxiliaries.map(aux => [aux.id, aux.name || "A definir"]));
  const shortName = id => String(names[id] || "A definir").trim().slice(0, 3);
  const hasWorkerHours = key => Object.keys(hourOverrides || {}).some(itemKey => itemKey.startsWith(`${key}::`));
  return Object.entries(overrides)
    .map(([key, value]) => {
      const parsed = parseManualOverrideKey(key);
      const empty = isManualEmptySlot(value);
      const workers = manualWorkerIds(value);
      const worker = workers[0] || "";
      if (!parsed || parsed.year !== year || parsed.month !== month || (!worker && !empty)) return null;
      const extras = workers.slice(1);
      return {
        key,
        day: parsed.day,
        shift: parsed.shift,
        shiftLabel: SHIFT_LABEL[parsed.shift] || parsed.shift,
        monthLabel: MONTHS[month],
        worker,
        workerName: empty ? "Créneau vidé" : names[worker] || "A definir",
        empty,
        extraWorkers: extras,
        extraNames: extras.map(shortName),
        customHours: normalizeSlotHour(hourOverrides[key]) ?? (hasWorkerHours(key) ? "par auxiliaire" : null),
        defaultHours: defaultHoursForShift(parsed.shift),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.day - b.day || a.shiftLabel.localeCompare(b.shiftLabel));
}
