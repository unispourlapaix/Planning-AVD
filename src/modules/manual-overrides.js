import { MONTHS, SHIFT_LABEL } from "./constants.js";

export const manualOverrideKey = (year, month, day, shift) => `${year}-${month}-${day}-${shift}`;

export function parseManualOverrideKey(key) {
  const [rawYear, rawMonth, rawDay, shift] = String(key || "").split("-");
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || !shift) return null;
  return { year, month, day, shift };
}

export function buildManualOverrideList({ overrides = {}, year, month, auxiliaries = [] }) {
  const names = Object.fromEntries(auxiliaries.map(aux => [aux.id, aux.name || "A definir"]));
  return Object.entries(overrides)
    .map(([key, worker]) => {
      const parsed = parseManualOverrideKey(key);
      if (!parsed || parsed.year !== year || parsed.month !== month || !worker) return null;
      return {
        key,
        day: parsed.day,
        shift: parsed.shift,
        shiftLabel: SHIFT_LABEL[parsed.shift] || parsed.shift,
        monthLabel: MONTHS[month],
        worker,
        workerName: names[worker] || "A definir",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.day - b.day || a.shiftLabel.localeCompare(b.shiftLabel));
}
