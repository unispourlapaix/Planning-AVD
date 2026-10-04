import { SHIFT_DEFS } from "./constants.js";
import { manualWorkerIds } from "./manual-workers.js";
export function setNotPerformed({ assignments, year, month, day, shift, worker, absent }) {
  const next = { ...assignments };
  for (const slot of SHIFT_DEFS.filter(item => !shift || item.id === shift)) {
    const key = `${year}-${month}-${day}-${slot.id}`;
    const workers = manualWorkerIds(next[key]);
    if (!workers.includes(worker)) continue;
    const missing = new Set(next[key]?.notPerformed || []);
    if (absent) missing.add(worker); else missing.delete(worker);
    next[key] = { workers, notPerformed: [...missing].filter(id => workers.includes(id)) };
  }
  return next;
}
