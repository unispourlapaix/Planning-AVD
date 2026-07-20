import { buildSchedule as buildBaseSchedule, canWorkShift } from "./scheduler.js?base=20260628-split-day";
import { SHIFT_DEFS } from "./constants.js";
import { createHourAccount, creditScheduledHours } from "./hour-accounting.js";

export * from "./scheduler.js?base=20260628-split-day";

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
const weekdayShifts = ["morning", "afternoon"];
const canOpenWeekendNight = (aux, year, month, saturday) =>
  canWorkShift(aux, "night", year, month, saturday);
const roundHours = value => Math.round((Number(value) || 0) * 100) / 100;

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

const appendAccountingDouble = (entry, worker) => {
  if (!entry?.worker || !worker || entry.worker === worker) return false;
  const list = [entry.worker, ...workers(entry).slice(1)].filter(Boolean);
  if (list.includes(worker)) return false;
  entry.workers = [...list, worker];
  return true;
};

const fullMonthAccounts = ({ schedule, available }) => {
  const accounts = Object.fromEntries(available.map(aux => [aux.id, createHourAccount(aux)]));
  Object.values(schedule)
    .sort((a, b) => Number(a.day) - Number(b.day))
    .forEach(plan => {
      SHIFT_DEFS.forEach(shift => {
        [...new Set(workers(plan?.[shift.id]))].forEach(worker => {
          if (!worker || !accounts[worker]) return;
          creditScheduledHours({ account: accounts[worker], shift: shift.id, scheduledHours: shift.hours, day: plan.day });
        });
      });
    });
  return accounts;
};

const remainingQuota = account => Math.max(0, roundHours((account?.quota || 0) - (account?.total || 0)));

const findQuotaSlot = ({ schedule, aux, account, year, month }) => {
  const remaining = remainingQuota(account);
  const slots = [];
  Object.values(schedule).forEach(plan => {
    SHIFT_DEFS.forEach(shift => {
      const entry = plan?.[shift.id];
      if (!entry?.worker || workers(entry).includes(aux.id)) return;
      if (!canWorkShift(aux, shift.id, year, month, plan.day)) return;
      slots.push({
        day: Number(plan.day),
        shift,
        entry,
        score: (shift.hours <= remaining ? 0 : 100) + Math.abs(remaining - shift.hours),
      });
    });
  });
  return slots.sort((a, b) => a.score - b.score || b.day - a.day)[0] || null;
};

const balanceAccountingDoubles = ({ schedule, available, year, month }) => {
  const team = available.filter(aux => aux.active !== false && aux.status !== "absent");
  const accounts = fullMonthAccounts({ schedule, available: team });

  team
    .filter(aux => remainingQuota(accounts[aux.id]) > 0)
    .sort((a, b) => remainingQuota(accounts[b.id]) - remainingQuota(accounts[a.id]))
    .forEach(aux => {
      const account = accounts[aux.id];
      let guard = 0;
      while (remainingQuota(account) > 0 && guard < 80) {
        guard += 1;
        const slot = findQuotaSlot({ schedule, aux, account, year, month });
        if (!slot || !appendAccountingDouble(slot.entry, aux.id)) return;
        creditScheduledHours({ account, shift: slot.shift.id, scheduledHours: slot.shift.hours, day: slot.day });
      }
    });
};

const rebuildBlocksAndLoad = ({ schedule, available }) => {
  const load = Object.fromEntries(available.map(aux => [aux.id, 0]));
  const blocks = [];
  Object.values(schedule)
    .sort((a, b) => Number(a.day) - Number(b.day))
    .forEach(plan => {
      SHIFT_DEFS.forEach(shift => {
        workers(plan?.[shift.id]).forEach(worker => {
          if (!worker) return;
          blocks.push({ day: plan.day, shift: shift.id, worker, hours: shift.hours });
          load[worker] = (load[worker] || 0) + shift.hours;
        });
      });
    });
  return { blocks, load };
};

const finalizeSchedule = ({ result, available, year, month }) => {
  balanceAccountingDoubles({ schedule: result.schedule, available, year, month });
  return { ...result, ...rebuildBlocksAndLoad({ schedule: result.schedule, available }) };
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
  && canWorkShift(aux, "afternoon", year, month, saturday + 1)
  && canOpenWeekendNight(aux, year, month, saturday);

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

const protectMondaySplitDay = ({ schedule, days, available, weekdayCycle, year, month }) => {
  days.forEach(day => {
    const sunday = schedule[day];
    const monday = schedule[day + 1];
    if (!sunday || !monday || new Date(year, month, day).getDay() !== 0) return;
    const weekendWorker = sunday.night?.worker || sunday.afternoon?.worker || sunday.morning?.worker;
    if (!weekendWorker) return;

    const mondayDay = day + 1;
    const currentDayWorker = monday.afternoon?.worker || monday.morning?.worker;
    const currentAux = available.find(aux => aux.id === currentDayWorker);
    const keepCurrent = currentDayWorker
      && currentDayWorker !== weekendWorker
      && canWorkShift(currentAux, "morning", year, month, mondayDay)
      && canWorkShift(currentAux, "afternoon", year, month, mondayDay);
    const dayWorker = keepCurrent ? currentDayWorker : pickCycleWorker({
      cycle: weekdayCycle,
      available,
      offset: days.indexOf(mondayDay) + 1,
      avoid: [weekendWorker],
      predicate: aux => aux.id !== weekendWorker
        && canWorkShift(aux, "morning", year, month, mondayDay)
        && canWorkShift(aux, "afternoon", year, month, mondayDay),
    });
    if (dayWorker) {
      monday.morning = withPrimary(monday.morning, dayWorker);
      monday.afternoon = withPrimary(monday.afternoon, dayWorker);
    }

    const currentNight = monday.night?.worker;
    const currentNightAux = available.find(aux => aux.id === currentNight);
    const nightAllowed = currentNight
      && currentNight !== weekendWorker
      && currentNight !== dayWorker
      && canWorkShift(currentNightAux, "night", year, month, mondayDay);
    if (nightAllowed) return;
    const nightCycle = available.map(aux => aux.id);
    const nightWorker = pickCycleWorker({
      cycle: nightCycle,
      available,
      offset: days.indexOf(mondayDay) + 2,
      avoid: [weekendWorker, dayWorker],
      predicate: aux => aux.id !== weekendWorker && aux.id !== dayWorker && canWorkShift(aux, "night", year, month, mondayDay),
    }) || pickCycleWorker({
      cycle: nightCycle,
      available,
      offset: days.indexOf(mondayDay) + 2,
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
  if (!friday) return;

  const avoid = [weekendWorker];
  const weekendAux = available.find(aux => aux.id === weekendWorker);
  const hasWeekendWorkerInWeekdayShift = weekdayShifts.some(shift => friday[shift]?.worker === weekendWorker);
  const thursdayRelief = thursday && hasWeekendWorkerInWeekdayShift
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

  weekdayShifts.forEach(shift => {
    if (friday[shift]?.worker !== weekendWorker) return;
    const relief = (thursdayRelief && canWorkShift(available.find(aux => aux.id === thursdayRelief), shift, year, month, fridayDay))
      ? thursdayRelief
      : pickWeekdayRelief({ available, weekdayCycle, year, month, day: fridayDay, shift, avoid, offset });
    if (relief) friday[shift] = withPrimary(friday[shift], relief);
  });

  // The weekend starts on Friday evening: its owner takes SR before Saturday morning.
  if (canOpenWeekendNight(weekendAux, year, month, saturday)) {
    friday.night = withPrimary(friday.night, weekendWorker);
  }
};

export function buildSchedule(options) {
  const result = buildBaseSchedule(options);
  const splitDayMode = options.rotationDays === "split-day";
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
      predicate: aux => canWorkShift(aux, "morning", options.year, options.month, day)
        && canWorkShift(aux, "afternoon", options.year, options.month, day)
        && canWorkShift(aux, "morning", options.year, options.month, day + 1)
        && canOpenWeekendNight(aux, options.year, options.month, day),
    });
    if (!weekendWorker || !sunday) return;
    previousWeekendWorker = weekendWorker;
    if (canWorkShift(available.find(aux => aux.id === weekendWorker), "morning", options.year, options.month, day)) {
      saturday.morning = withPrimary(saturday.morning, weekendWorker);
    }
    setAfternoonAndNight({ plan: saturday, worker: weekendWorker, available, year: options.year, month: options.month, day });
    sunday.morning = withPrimary(sunday.morning, weekendWorker);
    if (splitDayMode) {
      const friday = schedule[day - 1];
      const weekendAux = available.find(aux => aux.id === weekendWorker);
      if (friday && canOpenWeekendNight(weekendAux, options.year, options.month, day)) {
        if (friday.morning?.worker === weekendWorker || friday.afternoon?.worker === weekendWorker) {
          const fridayDayWorker = pickCycleWorker({
            cycle: weekdayCycle,
            available,
            offset: index + 1,
            avoid: [weekendWorker],
            predicate: aux => aux.id !== weekendWorker
              && canWorkShift(aux, "morning", options.year, options.month, day - 1)
              && canWorkShift(aux, "afternoon", options.year, options.month, day - 1),
          });
          if (fridayDayWorker) {
            friday.morning = withPrimary(friday.morning, fridayDayWorker);
            friday.afternoon = withPrimary(friday.afternoon, fridayDayWorker);
          }
        }
        friday.night = withPrimary(friday.night, weekendWorker);
      }
    }
    if (!splitDayMode) {
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
    }
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
  if (splitDayMode) {
    protectMondaySplitDay({ schedule, days, available, weekdayCycle, year: options.year, month: options.month });
  } else {
    protectMondayAfterWeekend({ schedule, days, available, weekdayCycle, year: options.year, month: options.month });
  }
  if (!splitDayMode) applyNightToNextMorning({ schedule, days, available, year: options.year, month: options.month });
  return finalizeSchedule({ result, available, year: options.year, month: options.month });
}
