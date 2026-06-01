import { buildSchedule as buildBaseSchedule, canWorkShift } from "./scheduler.js?base=20260601";

export * from "./scheduler.js?base=20260601";

const workers = entry => Array.isArray(entry?.workers) ? entry.workers.filter(Boolean) : (entry?.worker ? [entry.worker] : []);
const withPrimary = (entry, worker) => ({
  ...entry,
  worker,
  workers: [worker, ...workers(entry).slice(1).filter(id => id !== worker)],
});

export function buildSchedule(options) {
  const result = buildBaseSchedule(options);
  if (Number(options.rotationDays) !== 3) return result;

  const schedule = result.schedule;
  Object.keys(schedule).map(Number).forEach(day => {
    const sunday = schedule[day];
    const monday = schedule[day + 1];
    if (!sunday || !monday || new Date(options.year, options.month, day).getDay() !== 0) return;
    const nextWorker = monday.afternoon?.worker;
    const aux = options.auxiliaries.find(item => item.id === nextWorker);
    if (!nextWorker || !canWorkShift(aux, "afternoon", options.year, options.month, day + 1)) return;
    sunday.afternoon = withPrimary(sunday.afternoon, nextWorker);
    if (canWorkShift(aux, "night", options.year, options.month, day + 1)) sunday.night = withPrimary(sunday.night, nextWorker);
    monday.morning = withPrimary(monday.morning, nextWorker);
  });
  return result;
}
