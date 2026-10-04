const cleanWorkerId = value => String(value || "").trim();
const EMPTY_SLOT_MARKER = "__planning_avd_empty_slot__";

export const emptyManualSlot = () => ({ marker: EMPTY_SLOT_MARKER });

export const isManualEmptySlot = value =>
  value === EMPTY_SLOT_MARKER
  || value?.marker === EMPTY_SLOT_MARKER
  || value?.empty === true;

export const manualWorkerIds = value => {
  if (isManualEmptySlot(value)) return [];
  const raw = Array.isArray(value)
    ? value
    : Array.isArray(value?.workers)
    ? value.workers
    : value?.worker
    ? [value.worker, ...(Array.isArray(value.extraWorkers) ? value.extraWorkers : [])]
    : [value];
  return [...new Set(raw.map(cleanWorkerId).filter(Boolean))];
};

export const compactManualWorkers = value => {
  const workers = manualWorkerIds(value);
  if (!workers.length) return "";
  return workers.length === 1 ? workers[0] : workers;
};

export const primaryManualWorker = value => manualWorkerIds(value)[0] || "";

export const setManualPrimaryWorker = (value, worker) => {
  const primary = cleanWorkerId(worker);
  if (!primary) return "";
  const extras = isManualEmptySlot(value) ? [] : manualWorkerIds(value).filter(id => id !== primary);
  const workers = [primary, ...extras];
  return value?.notPerformed ? { workers, notPerformed: value.notPerformed.filter(id => workers.includes(id)) } : compactManualWorkers(workers);
};

export const toggleManualDoubleWorker = (value, worker) => {
  const target = cleanWorkerId(worker);
  const workers = manualWorkerIds(value);
  const primary = workers[0] || "";
  if (!target || !primary || target === primary) return compactManualWorkers(workers);
  const extras = workers.slice(1);
  const nextExtras = extras.includes(target)
    ? extras.filter(id => id !== target)
    : [...extras, target];
  const next = [primary, ...nextExtras];
  return value?.notPerformed ? { workers: next, notPerformed: value.notPerformed.filter(id => next.includes(id)) } : compactManualWorkers(next);
};
