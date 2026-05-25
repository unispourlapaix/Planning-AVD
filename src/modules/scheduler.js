import { DEFAULT_QUOTA, SHIFT_DEFS } from "./constants.js";
import { dayIndex, daysInMonth, isWeekendDay } from "./dates.js";

const dayAllowed = (rule, index) => {
  if (rule === "weekdays") return index >= 0 && index <= 4;
  if (rule === "weekend") return index === 5 || index === 6;
  if (rule === "saturday") return index === 5;
  if (rule === "sunday") return index === 6;
  return true;
};

export function normalizeAuxiliary(aux) {
  return {
    active: true,
    status: "available",
    quota: DEFAULT_QUOTA,
    lead: false,
    night: false,
    days: "all",
    customDays: [0, 1, 2, 3, 4, 5, 6],
    shift: "all",
    ...aux,
  };
}

export function canWorkDay(aux, year, month, day) {
  if (!aux) return false;
  const a = normalizeAuxiliary(aux);
  if (!a.active || a.status === "absent") return false;
  const index = dayIndex(year, month, day);
  if (a.days === "custom") return (a.customDays || []).includes(index);
  return dayAllowed(a.days, index);
}

export function canWorkShift(aux, shift, year, month, day) {
  if (!aux) return false;
  const a = normalizeAuxiliary(aux);
  if (!canWorkDay(a, year, month, day)) return false;
  if (shift === "night") return !!a.night || a.shift === "night";
  if (a.shift === "night") return false;
  if (a.shift === "morning") return shift === "morning";
  if (a.shift === "afternoon") return shift === "afternoon";
  return true;
}

const quota = aux => Math.max(1, Number(aux.quota) || DEFAULT_QUOTA);
const loadRatio = (aux, load) => (load[aux.id] || 0) / quota(aux);

function orderedTeam(team, pointer, preferLeader, preferWeekendOnly) {
  const base = team.filter(aux => aux.active && aux.status !== "absent");
  const leader = preferLeader ? base.find(aux => aux.lead) : null;
  let ordered = base;
  if (preferWeekendOnly) {
    ordered = [
      ...base.filter(aux => aux.days === "weekend" || aux.days === "saturday" || aux.days === "sunday"),
      ...base.filter(aux => !(aux.days === "weekend" || aux.days === "saturday" || aux.days === "sunday")),
    ];
  } else if (leader) {
    const others = base.filter(aux => aux.id !== leader.id);
    ordered = others.length ? others.flatMap(aux => [leader, aux]) : [leader];
  }
  if (!ordered.length) return [];
  const offset = pointer % ordered.length;
  return ordered.slice(offset).concat(ordered.slice(0, offset));
}

function pickWorker({ team, pointers, load, shift, year, month, day, previous, preferLeader = false, preferWeekendOnly = false }) {
  const key = preferWeekendOnly ? `weekend-${shift}` : shift;
  const ordered = orderedTeam(team, pointers[key] || 0, preferLeader, preferWeekendOnly)
    .filter(aux => canWorkShift(aux, shift, year, month, day));

  if (!ordered.length) return null;
  const candidates = ordered.filter(aux => aux.id !== previous) || ordered;
  const sorted = (candidates.length ? candidates : ordered).slice().sort((a, b) => {
    const aUnder = (load[a.id] || 0) < quota(a);
    const bUnder = (load[b.id] || 0) < quota(b);
    if (aUnder !== bUnder) return aUnder ? -1 : 1;
    return loadRatio(a, load) - loadRatio(b, load);
  });
  const picked = sorted[0] || ordered[0];
  const idx = ordered.findIndex(aux => aux.id === picked.id);
  pointers[key] = (idx >= 0 ? (pointers[key] || 0) + idx + 1 : (pointers[key] || 0) + 1) % ordered.length;
  return picked.id;
}

function addShift(dayPlan, shift, worker, load) {
  const def = SHIFT_DEFS.find(item => item.id === shift);
  dayPlan[shift] = { worker, hours: def?.hours || 0 };
  if (worker) load[worker] = (load[worker] || 0) + (def?.hours || 0);
}

export function buildSchedule({ year, month, auxiliaries }) {
  const team = auxiliaries.map(normalizeAuxiliary).filter(aux => aux.active);
  const schedule = {};
  const blocks = [];
  const load = Object.fromEntries(team.map(aux => [aux.id, 0]));
  const pointers = { morning: 0, afternoon: 0, night: 0, "weekend-morning": 0, "weekend-afternoon": 0, "weekend-night": 0 };
  let previousDayWorker = null;
  let weekendWorker = null;
  let weekendKey = "";

  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    const weekend = isWeekendDay(year, month, day);
    const key = `${year}-${month}-${dayIndex(year, month, day) === 5 ? day : day - 1}`;
    if (!weekend || key !== weekendKey) {
      weekendKey = key;
      weekendWorker = null;
    }

    const plan = { day, weekend };
    if (weekend && weekendWorker && canWorkShift(team.find(aux => aux.id === weekendWorker), "morning", year, month, day)) {
      addShift(plan, "morning", weekendWorker, load);
    } else {
      const worker = pickWorker({
        team, pointers, load, shift: "morning", year, month, day,
        previous: previousDayWorker,
        preferLeader: !weekend,
        preferWeekendOnly: weekend,
      });
      addShift(plan, "morning", worker, load);
      if (weekend) weekendWorker = worker;
    }

    const morningAux = team.find(aux => aux.id === plan.morning?.worker);
    const afternoonWorker = morningAux && canWorkShift(morningAux, "afternoon", year, month, day)
      ? morningAux.id
      : pickWorker({
          team, pointers, load, shift: "afternoon", year, month, day,
          previous: plan.morning?.worker,
          preferLeader: !weekend,
          preferWeekendOnly: weekend,
        });
    addShift(plan, "afternoon", afternoonWorker, load);

    const afternoonAux = team.find(aux => aux.id === afternoonWorker);
    const nightWorker = afternoonAux && canWorkShift(afternoonAux, "night", year, month, day)
      ? afternoonAux.id
      : pickWorker({
          team, pointers, load, shift: "night", year, month, day,
          previous: plan.morning?.worker,
          preferLeader: false,
          preferWeekendOnly: weekend,
        });
    addShift(plan, "night", nightWorker, load);

    previousDayWorker = plan.afternoon?.worker || plan.morning?.worker || previousDayWorker;
    schedule[day] = plan;
    SHIFT_DEFS.forEach(shift => {
      blocks.push({ day, shift: shift.id, worker: plan[shift.id]?.worker || "", hours: shift.hours });
    });
  }

  return { schedule, blocks, load };
}

export function calculateHours(schedule, auxiliaries) {
  const hours = Object.fromEntries(auxiliaries.map(aux => [aux.id, {
    morning: 0,
    afternoon: 0,
    night: 0,
    total: 0,
    quota: Number(aux.quota) || DEFAULT_QUOTA,
  }]));

  Object.values(schedule).forEach(day => {
    SHIFT_DEFS.forEach(shift => {
      const worker = day[shift.id]?.worker;
      if (!worker || !hours[worker]) return;
      hours[worker][shift.id] += shift.hours;
      hours[worker].total += shift.hours;
    });
  });

  return hours;
}
