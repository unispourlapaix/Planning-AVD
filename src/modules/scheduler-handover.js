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
  const schedule = result.schedule;
  const days = Object.keys(schedule).map(Number);
  const available = options.auxiliaries.filter(aux => aux.active !== false && aux.status !== "absent");
  const firstDay = days[0];
  const firstPlan = schedule[firstDay];
  if (firstPlan && !firstPlan.morning?.worker) {
    const afternoonWorker = firstPlan.afternoon?.worker;
    const afternoonAux = available.find(aux => aux.id === afternoonWorker);
    const fallback = available.find(aux => canWorkShift(aux, "morning", options.year, options.month, firstDay));
    const morningWorker = afternoonAux && canWorkShift(afternoonAux, "morning", options.year, options.month, firstDay)
      ? afternoonAux.id
      : fallback?.id;
    if (morningWorker) firstPlan.morning = withPrimary(firstPlan.morning, morningWorker);
  }
  const leader = available.find(aux => aux.lead);
  const others = available.filter(aux => aux.id !== leader?.id);
  const leaderIndex = Math.min(2, others.length);
  const weekendCycle = others.map(aux => aux.id);
  if (leader) weekendCycle.splice(leaderIndex, 0, leader.id);

  days.filter(day => new Date(options.year, options.month, day).getDay() === 6).forEach((day, index) => {
    const saturday = schedule[day];
    const sunday = schedule[day + 1];
    const weekendWorker = weekendCycle[index] || leader?.id || weekendCycle[index % weekendCycle.length];
    if (!weekendWorker || !sunday) return;
    saturday.afternoon = withPrimary(saturday.afternoon, weekendWorker);
    saturday.night = withPrimary(saturday.night, weekendWorker);
    sunday.morning = withPrimary(sunday.morning, weekendWorker);
  });

  days.forEach(day => {
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
