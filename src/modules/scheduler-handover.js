import { buildSchedule as buildBaseSchedule, canWorkShift } from "./scheduler.js?base=20260607-weekend-one";

export * from "./scheduler.js?base=20260607-weekend-one";

const workers = entry => Array.isArray(entry?.workers) ? entry.workers.filter(Boolean) : (entry?.worker ? [entry.worker] : []);
const withPrimary = (entry, worker) => ({
  ...entry,
  worker,
  workers: [worker, ...workers(entry).slice(1).filter(id => id !== worker)],
});

const rotate = (items, offset) => items.slice(offset).concat(items.slice(0, offset));
const dayPrimary = aux => aux.shift !== "night";
const weekendOnly = aux => aux.days === "weekend" || aux.days === "saturday" || aux.days === "sunday";
const canHoldDay = (aux, year, month, day) =>
  canWorkShift(aux, "morning", year, month, day) || canWorkShift(aux, "afternoon", year, month, day);
const primaryShifts = ["morning", "afternoon", "night"];

const pickCycleWorker = ({ cycle, available, offset = 0, avoid = [], predicate }) => {
  const avoidSet = new Set(avoid.filter(Boolean));
  const ordered = rotate(cycle, offset).map(id => available.find(aux => aux.id === id)).filter(Boolean);
  const matches = ordered.filter(predicate);
  return (matches.find(aux => !avoidSet.has(aux.id)) || matches[0])?.id || null;
};

const setAfternoonAndNight = ({ plan, worker, available, year, month, day }) => {
  if (!plan || !worker) return;
  plan.afternoon = withPrimary(plan.afternoon, worker);
  const aux = available.find(item => item.id === worker);
  if (canWorkShift(aux, "night", year, month, day)) {
    plan.night = withPrimary(plan.night, worker);
    return;
  }
  const nightFallback = available.find(item => item.id !== worker && canWorkShift(item, "night", year, month, day));
  if (nightFallback) plan.night = withPrimary(plan.night, nightFallback.id);
};

const weekendFullPredicate = ({ year, month, saturday }) => aux =>
  canWorkShift(aux, "morning", year, month, saturday)
  && canWorkShift(aux, "afternoon", year, month, saturday)
  && canWorkShift(aux, "night", year, month, saturday)
  && canWorkShift(aux, "morning", year, month, saturday + 1)
  && canWorkShift(aux, "afternoon", year, month, saturday + 1)
  && canWorkShift(aux, "night", year, month, saturday + 1);

const weekendBasicPredicate = ({ year, month, saturday }) => aux =>
  canWorkShift(aux, "morning", year, month, saturday)
  && canWorkShift(aux, "afternoon", year, month, saturday)
  && canWorkShift(aux, "morning", year, month, saturday + 1)
  && canWorkShift(aux, "afternoon", year, month, saturday + 1);

const applyNightToNextMorning = ({ schedule, days, available, year, month }) => {
  days.forEach(day => {
    const next = schedule[day + 1];
    const nightWorker = schedule[day]?.night?.worker;
    if (!next || !nightWorker) return;
    if (new Date(year, month, day + 1).getDay() === 6 && next.morning?.worker) return;
    const aux = available.find(item => item.id === nightWorker);
    const closesNight = aux && canWorkShift(aux, "night", year, month, day);
    if (canWorkShift(aux, "morning", year, month, day + 1) || closesNight) {
      next.morning = withPrimary(next.morning, nightWorker);
    }
  });
};

const protectMondayAfterWeekend = ({ schedule, days, available, weekdayCycle, year, month }) => {
  days.forEach(day => {
    const sunday = schedule[day];
    const monday = schedule[day + 1];
    if (!sunday || !monday || new Date(year, month, day).getDay() !== 0) return;
    const weekendWorker = sunday.night?.worker || sunday.afternoon?.worker || sunday.morning?.worker;
    if (!weekendWorker) return;

    const mondayDay = day + 1;
    const plannedAfternoon = monday.afternoon?.worker;
    const plannedAux = available.find(aux => aux.id === plannedAfternoon);
    const afternoonWorker = plannedAfternoon && plannedAfternoon !== weekendWorker && canWorkShift(plannedAux, "afternoon", year, month, mondayDay)
      ? plannedAfternoon
      : pickCycleWorker({
          cycle: weekdayCycle,
          available,
          offset: days.indexOf(mondayDay) + 1,
          avoid: [weekendWorker],
          predicate: aux => aux.id !== weekendWorker && canWorkShift(aux, "afternoon", year, month, mondayDay),
        });
    if (!afternoonWorker) return;
    monday.afternoon = withPrimary(monday.afternoon, afternoonWorker);

    const afternoonAux = available.find(aux => aux.id === afternoonWorker);
    if (canWorkShift(afternoonAux, "night", year, month, mondayDay)) {
      monday.night = withPrimary(monday.night, afternoonWorker);
      return;
    }
    const plannedNight = monday.night?.worker;
    const plannedNightAux = available.find(aux => aux.id === plannedNight);
    if (plannedNight && plannedNight !== weekendWorker && canWorkShift(plannedNightAux, "night", year, month, mondayDay)) return;
    const nightWorker = pickCycleWorker({
      cycle: weekdayCycle,
      available,
      offset: days.indexOf(mondayDay) + 1,
      avoid: [weekendWorker],
      predicate: aux => aux.id !== weekendWorker && canWorkShift(aux, "night", year, month, mondayDay),
    });
    if (nightWorker) monday.night = withPrimary(monday.night, nightWorker);
  });
};

const pickWeekdayRelief = ({ available, weekdayCycle, year, month, day, shift, avoid = [], offset = 0 }) =>
  pickCycleWorker({
    cycle: weekdayCycle,
    available,
    offset,
    avoid,
    predicate: aux => !avoid.includes(aux.id) && canWorkShift(aux, shift, year, month, day),
  });

const balanceThursdayBeforeWeekend = ({ schedule, saturday, weekendWorker, available, weekdayCycle, year, month, offset }) => {
  if (!weekendWorker) return;
  const fridayDay = saturday - 1;
  const thursdayDay = saturday - 2;
  const friday = schedule[fridayDay];
  const thursday = schedule[thursdayDay];
  if (!friday || !primaryShifts.some(shift => friday[shift]?.worker === weekendWorker)) return;

  const avoid = [weekendWorker];
  const thursdayRelief = thursday
    ? pickCycleWorker({
        cycle: weekdayCycle,
        available,
        offset,
        avoid,
        predicate: aux => aux.id !== weekendWorker
          && canWorkShift(aux, "afternoon", year, month, thursdayDay)
          && canWorkShift(aux, "morning", year, month, fridayDay),
      })
    : null;

  if (thursdayRelief && friday.morning?.worker === weekendWorker) {
    thursday.afternoon = withPrimary(thursday.afternoon, thursdayRelief);
    const reliefAux = available.find(aux => aux.id === thursdayRelief);
    if (canWorkShift(reliefAux, "night", year, month, thursdayDay)) {
      thursday.night = withPrimary(thursday.night, thursdayRelief);
    }
    friday.morning = withPrimary(friday.morning, thursdayRelief);
  }

  primaryShifts.forEach(shift => {
    if (friday[shift]?.worker !== weekendWorker) return;
    const relief = (thursdayRelief && canWorkShift(available.find(aux => aux.id === thursdayRelief), shift, year, month, fridayDay))
      ? thursdayRelief
      : pickWeekdayRelief({ available, weekdayCycle, year, month, day: fridayDay, shift, avoid, offset });
    if (relief) friday[shift] = withPrimary(friday[shift], relief);
  });
};

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
  const others = available.filter(aux => aux.id !== leader?.id && dayPrimary(aux));
  const leaderIndex = Math.min(2, others.length);
  const weekendCycle = others.map(aux => aux.id);
  if (leader && dayPrimary(leader)) weekendCycle.splice(leaderIndex, 0, leader.id);
  const weekdayCycle = available.filter(aux => dayPrimary(aux) && !weekendOnly(aux)).map(aux => aux.id);
  let previousWeekendWorker = "";

  days.filter(day => new Date(options.year, options.month, day).getDay() === 6).forEach((day, index) => {
    const saturday = schedule[day];
    const sunday = schedule[day + 1];
    const weekendAvoid = [previousWeekendWorker];
    const weekendWorker = pickCycleWorker({
      cycle: weekendCycle,
      available,
      offset: index,
      avoid: weekendAvoid,
      predicate: weekendFullPredicate({ year: options.year, month: options.month, saturday: day }),
    }) || pickCycleWorker({
      cycle: weekendCycle,
      available,
      offset: index,
      avoid: weekendAvoid,
      predicate: weekendBasicPredicate({ year: options.year, month: options.month, saturday: day }),
    }) || pickCycleWorker({
      cycle: weekendCycle,
      available,
      offset: index,
      avoid: weekendAvoid,
      predicate: aux => canWorkShift(aux, "afternoon", options.year, options.month, day)
        && canWorkShift(aux, "morning", options.year, options.month, day + 1),
    });
    if (!weekendWorker || !sunday) return;
    previousWeekendWorker = weekendWorker;
    if (canWorkShift(available.find(aux => aux.id === weekendWorker), "morning", options.year, options.month, day)) {
      saturday.morning = withPrimary(saturday.morning, weekendWorker);
    }
    setAfternoonAndNight({ plan: saturday, worker: weekendWorker, available, year: options.year, month: options.month, day });
    sunday.morning = withPrimary(sunday.morning, weekendWorker);
    balanceThursdayBeforeWeekend({
      schedule,
      saturday: day,
      weekendWorker,
      available,
      weekdayCycle,
      year: options.year,
      month: options.month,
      offset: index + 1,
    });
  });

  days.forEach(day => {
    const sunday = schedule[day];
    const monday = schedule[day + 1];
    if (!sunday || !monday || new Date(options.year, options.month, day).getDay() !== 0) return;
    const weekendWorker = sunday.morning?.worker || schedule[day - 1]?.afternoon?.worker || "";
    const plannedWorker = monday.afternoon?.worker;
    const handoverWorker = pickCycleWorker({
      cycle: weekendCycle,
      available,
      offset: days.indexOf(day) + 1,
      avoid: [weekendWorker],
      predicate: aux => canHoldDay(aux, options.year, options.month, day + 1)
        && canWorkShift(aux, "afternoon", options.year, options.month, day)
        && canWorkShift(aux, "afternoon", options.year, options.month, day + 1),
    }) || plannedWorker;
    const weekendAux = options.auxiliaries.find(item => item.id === weekendWorker);
    const closesWeekend = weekendWorker
      && canWorkShift(weekendAux, "afternoon", options.year, options.month, day)
      && canWorkShift(weekendAux, "night", options.year, options.month, day);
    const closingWorker = closesWeekend ? weekendWorker : handoverWorker;
    const closingAux = options.auxiliaries.find(item => item.id === closingWorker);
    if (!closingWorker || !canWorkShift(closingAux, "afternoon", options.year, options.month, day)) return;
    setAfternoonAndNight({ plan: sunday, worker: closingWorker, available, year: options.year, month: options.month, day });
  });
  protectMondayAfterWeekend({ schedule, days, available, weekdayCycle, year: options.year, month: options.month });
  applyNightToNextMorning({ schedule, days, available, year: options.year, month: options.month });
  return result;
}
