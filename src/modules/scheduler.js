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
    coverage: false,
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
  if (shift === "night") return a.shift === "all" || a.shift === "night" || !!a.night;
  if (a.shift === "night") return false;
  if (a.shift === "morning") return shift === "morning";
  if (a.shift === "afternoon") return shift === "afternoon";
  return true;
}

const quota = aux => Math.max(1, Number(aux.quota) || DEFAULT_QUOTA);
const loadRatio = (aux, load) => (load[aux.id] || 0) / quota(aux);
const isWeekendOnly = aux => aux.days === "weekend" || aux.days === "saturday" || aux.days === "sunday";
const prioritizeRomain = team => team.slice().sort((a, b) => Number(/^romain\b/i.test(b.name || "")) - Number(/^romain\b/i.test(a.name || "")));

function pickSequential({ ordered, pointers, key, shift, year, month, day }) {
  const available = ordered.filter(aux => canWorkShift(aux, shift, year, month, day));
  if (!available.length) return null;
  const offset = (pointers[key] || 0) % available.length;
  const picked = available[offset];
  pointers[key] = (offset + 1) % available.length;
  return picked.id;
}

function pickWeekdayOwner({ team, pointers, shift, year, month, day }) {
  const base = team.filter(aux => !aux.coverage && aux.shift !== "night" && !isWeekendOnly(aux));
  const leader = base.find(aux => aux.lead);
  const others = prioritizeRomain(base.filter(aux => aux.id !== leader?.id));
  const ordered = leader ? [...others, leader] : others;
  return pickSequential({ ordered, pointers, key: "weekday-owner", shift, year, month, day });
}

function pickWeekendOwner({ team, pointers, shift, year, month, day }) {
  const teammates = team.filter(aux => !aux.coverage && !aux.lead && aux.shift !== "night");
  const ordered = teammates.some(aux => canWorkShift(aux, shift, year, month, day))
    ? teammates
    : team.filter(aux => !aux.coverage && aux.shift !== "night");
  return pickSequential({ ordered, pointers, key: "weekend-owner", shift, year, month, day });
}

function weekendOwnerTeam({ team, previousWorked, shift, year, month, day }) {
  const canCover = aux => !aux.coverage && aux.shift !== "night" && canWorkShift(aux, shift, year, month, day);
  const main = team.filter(canCover);
  const teammates = main.filter(aux => !aux.lead);
  const restedTeammates = teammates.filter(aux => !previousWorked.has(aux.id));
  const rested = main.filter(aux => !previousWorked.has(aux.id));
  return restedTeammates.length ? restedTeammates : teammates.length ? teammates : rested.length ? rested : main;
}

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
    ordered = others.length ? [...others, leader] : [leader];
  }
  if (!ordered.length) return [];
  const offset = pointer % ordered.length;
  return ordered.slice(offset).concat(ordered.slice(0, offset));
}

function pickWorker({ team, pointers, load, shift, year, month, day, previous, exclude = [], preferLeader = false, preferWeekendOnly = false, includeCoverage = false }) {
  const key = preferWeekendOnly ? `weekend-${shift}` : shift;
  const ordered = orderedTeam(team, pointers[key] || 0, preferLeader, preferWeekendOnly)
    .filter(aux => includeCoverage || !aux.coverage)
    .filter(aux => canWorkShift(aux, shift, year, month, day));

  if (!ordered.length) return null;
  const blocked = new Set([previous, ...exclude].filter(Boolean));
  const candidates = ordered.filter(aux => !blocked.has(aux.id)) || ordered;
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

function shiftWorkers(entry) {
  if (!entry) return [];
  if (Array.isArray(entry.workers)) return entry.workers.filter(Boolean);
  return entry.worker ? [entry.worker] : [];
}

function addShift(dayPlan, shift, worker, load, extras = [], primaryLoad = load) {
  const def = SHIFT_DEFS.find(item => item.id === shift);
  const workers = [worker, ...extras].filter(Boolean);
  dayPlan[shift] = { worker, workers, hours: def?.hours || 0 };
  workers.forEach(id => {
    load[id] = (load[id] || 0) + (def?.hours || 0);
  });
  if (worker && primaryLoad !== load) {
    primaryLoad[worker] = (primaryLoad[worker] || 0) + (def?.hours || 0);
  }
}

function pickPreferredOrNext({ preferred, team, pointers, load, shift, year, month, day, previous, preferLeader = false, preferWeekendOnly = false }) {
  const preferredAux = team.find(aux => aux.id === preferred);
  if (preferredAux && preferredAux.id !== previous && canWorkShift(preferredAux, shift, year, month, day)) return preferredAux.id;
  return pickWorker({ team, pointers, load, shift, year, month, day, previous, preferLeader, preferWeekendOnly });
}

function pickLeaderDouble({ primary, team, pointers, load, shift, year, month, day, weekend, dayDoubles }) {
  const primaryAux = team.find(aux => aux.id === primary);
  if (!primaryAux?.lead || weekend) return [];
  const saved = dayDoubles?.[primary];
  const savedAux = team.find(aux => aux.id === saved?.worker);
  if (saved?.day >= day - 1 && savedAux && !savedAux.coverage && savedAux.shift !== "night" && canWorkShift(savedAux, shift, year, month, day)) {
    saved.day = day;
    return [savedAux.id];
  }
  const teammates = prioritizeRomain(team.filter(aux => !aux.lead && !aux.coverage && aux.shift !== "night"));
  const rotatingTeammates = saved?.worker ? teammates.filter(aux => aux.id !== saved.worker) : teammates;
  const teammate = pickSequential({
    ordered: rotatingTeammates.length ? rotatingTeammates : teammates,
    pointers,
    key: "leader-double",
    shift,
    year,
    month,
    day,
  });
  if (teammate && dayDoubles) dayDoubles[primary] = { worker: teammate, day };
  return teammate ? [teammate] : [];
}

function pickCoverageDouble({ primary, team, pointers, load, shift, year, month, day }) {
  const candidates = team.filter(aux => aux.coverage && aux.id !== primary && (load[aux.id] || 0) < quota(aux));
  const teammate = pickWorker({
    team: candidates,
    pointers,
    load,
    shift,
    year,
    month,
    day,
    previous: primary,
    exclude: [primary],
    preferLeader: false,
    preferWeekendOnly: false,
    includeCoverage: true,
  });
  return teammate ? [teammate] : [];
}

function dayExtras({ primary, team, pointers, load, shift, year, month, day, weekend, dayDoubles }) {
  const coverage = pickCoverageDouble({ primary, team, pointers, load, shift, year, month, day });
  if (coverage.length) return coverage;
  return pickLeaderDouble({ primary, team, pointers, load, shift, year, month, day, weekend, dayDoubles });
}

function pickNightOnlyDouble({ primary, team, pointers, load, year, month, day, weekend }) {
  const primaryAux = team.find(aux => aux.id === primary);
  if (primaryAux?.shift === "night") return [];
  const key = weekend ? "weekend-night-double" : "night-double";
  const candidates = team.filter(aux => aux.shift === "night" && canWorkShift(aux, "night", year, month, day));
  const teammate = pickWorker({
    team: candidates,
    pointers: { ...pointers, night: pointers[key] || 0 },
    load,
    shift: "night",
    year,
    month,
    day,
    previous: primary,
    exclude: [primary],
    preferLeader: false,
    preferWeekendOnly: false,
  });
  if (!teammate) return [];
  const idx = candidates.findIndex(aux => aux.id === teammate);
  pointers[key] = (idx >= 0 ? idx + 1 : (pointers[key] || 0) + 1) % Math.max(1, candidates.length);
  return [teammate];
}

function nightExtras({ primary, team, pointers, load, year, month, day, weekend, dayDoubles }) {
  const nightOnly = pickNightOnlyDouble({ primary, team, pointers, load, year, month, day, weekend });
  if (nightOnly.length) return nightOnly;
  return dayExtras({ primary, team, pointers, load, shift: "night", year, month, day, weekend, dayDoubles });
}

function buildDailySchedule({ year, month, auxiliaries, initialWeekendRest = [] }) {
  const team = auxiliaries.map(normalizeAuxiliary).filter(aux => aux.active);
  const schedule = {};
  const blocks = [];
  const load = Object.fromEntries(team.map(aux => [aux.id, 0]));
  const primaryLoad = Object.fromEntries(team.map(aux => [aux.id, 0]));
  const pointers = { morning: 0, afternoon: 0, night: 0, "weekday-owner": 0, "weekend-owner": 0, "night-double": 0, "weekend-morning": 0, "weekend-afternoon": 0, "weekend-night": 0, "weekend-night-double": 0 };
  let previousDayWorker = null;
  let weekendWorker = null;
  let weekendHandover = initialWeekendRest[0] || null;
  const leaderDoubles = {};
  let weekendKey = "";
  let previousWorked = new Set(initialWeekendRest);

  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    const weekend = isWeekendDay(year, month, day);
    const index = dayIndex(year, month, day);
    const availableTeam = index === 0 ? team.filter(aux => !previousWorked.has(aux.id)) : team;
    const morningTeam = index === 0 ? team : availableTeam;
    const mondayHandover = index === 0 ? weekendHandover : null;
    const key = `${year}-${month}-${dayIndex(year, month, day) === 5 ? day : day - 1}`;
    if (!weekend || key !== weekendKey) {
      weekendKey = key;
      weekendWorker = null;
    }

    const plan = { day, weekend };
    const dayDoubles = leaderDoubles;
    if (weekend && weekendWorker && canWorkShift(morningTeam.find(aux => aux.id === weekendWorker), "morning", year, month, day)) {
      addShift(plan, "morning", weekendWorker, load, dayExtras({ primary: weekendWorker, team: morningTeam, pointers, load, shift: "morning", year, month, day, weekend, dayDoubles }), primaryLoad);
    } else {
      const eligibleWeekendTeam = weekend && index === 5
        ? weekendOwnerTeam({ team: morningTeam, previousWorked, shift: "morning", year, month, day })
        : morningTeam;
      const worker = mondayHandover || (weekend
        ? pickWeekendOwner({ team: eligibleWeekendTeam, pointers, shift: "morning", year, month, day })
        : pickWeekdayOwner({ team: morningTeam, pointers, shift: "morning", year, month, day }))
        || pickWorker({
          team: morningTeam, pointers, load: primaryLoad, shift: "morning", year, month, day,
          previous: previousDayWorker,
          preferLeader: !weekend,
          preferWeekendOnly: weekend,
        });
      addShift(plan, "morning", worker, load, dayExtras({ primary: worker, team: morningTeam, pointers, load, shift: "morning", year, month, day, weekend, dayDoubles }), primaryLoad);
      if (weekend) {
        weekendWorker = worker;
        weekendHandover = worker;
      }
    }

    const morningAux = availableTeam.find(aux => aux.id === plan.morning?.worker);
    const afternoonWorker = morningAux && canWorkShift(morningAux, "afternoon", year, month, day)
      ? morningAux.id
      : pickWorker({
          team: availableTeam, pointers, load: primaryLoad, shift: "afternoon", year, month, day,
          previous: plan.morning?.worker,
          preferLeader: !weekend,
          preferWeekendOnly: weekend,
        });
    addShift(plan, "afternoon", afternoonWorker, load, dayExtras({ primary: afternoonWorker, team: availableTeam, pointers, load, shift: "afternoon", year, month, day, weekend, dayDoubles }), primaryLoad);

    const afternoonAux = availableTeam.find(aux => aux.id === afternoonWorker);
    const nightWorker = afternoonAux && canWorkShift(afternoonAux, "night", year, month, day)
      ? afternoonAux.id
      : pickWorker({
          team: availableTeam, pointers, load: primaryLoad, shift: "night", year, month, day,
          previous: plan.morning?.worker,
          preferLeader: false,
          preferWeekendOnly: weekend,
        });
    addShift(plan, "night", nightWorker, load, nightExtras({ primary: nightWorker, team: availableTeam, pointers, load, year, month, day, weekend, dayDoubles }), primaryLoad);

    previousDayWorker = plan.afternoon?.worker || plan.morning?.worker || previousDayWorker;
    schedule[day] = plan;
    const workedToday = new Set();
    SHIFT_DEFS.forEach(shift => {
      shiftWorkers(plan[shift.id]).forEach(worker => {
        blocks.push({ day, shift: shift.id, worker, hours: shift.hours });
      });
      if (plan[shift.id]?.worker) workedToday.add(plan[shift.id].worker);
    });
    previousWorked = workedToday;
    if (weekend && index === 6) weekendHandover = plan.afternoon?.worker || plan.morning?.worker || weekendHandover;
  }

  return { schedule, blocks, load };
}

function buildBlockSchedule({ year, month, auxiliaries, rotationDays, initialWeekendRest = [] }) {
  const team = auxiliaries.map(normalizeAuxiliary).filter(aux => aux.active);
  const schedule = {};
  const blocks = [];
  const load = Object.fromEntries(team.map(aux => [aux.id, 0]));
  const primaryLoad = Object.fromEntries(team.map(aux => [aux.id, 0]));
  const pointers = { morning: 0, afternoon: 0, night: 0, "weekday-owner": 0, "weekend-owner": 0, "night-double": 0, "weekend-morning": 0, "weekend-afternoon": 0, "weekend-night": 0, "weekend-night-double": 0 };
  const totalDays = daysInMonth(year, month);
  const span = Math.min(4, Math.max(2, Number(rotationDays) || 2));
  const servicePattern = span === 3 ? [3, 2, 2] : [span - 1];
  const blockStarts = [];
  const ownerByStart = {};
  let previousOwner = null;
  let weekendWorker = null;
  let weekendHandover = initialWeekendRest[0] || null;
  const leaderDoubles = {};
  let weekendKey = "";
  let previousWorked = new Set(initialWeekendRest);

  let start = 1;
  let patternIndex = 0;
  while (start <= totalDays) {
    const serviceDays = servicePattern[patternIndex % servicePattern.length];
    const weekend = isWeekendDay(year, month, start);
    const owner = weekend
      ? previousOwner
      : pickWeekdayOwner({ team, pointers, shift: "afternoon", year, month, day: start })
        || pickWorker({
          team,
          pointers,
          load: primaryLoad,
          shift: "afternoon",
          year,
          month,
          day: start,
          previous: previousOwner,
          preferLeader: true,
          preferWeekendOnly: false,
        });
    blockStarts.push({ start, serviceDays });
    ownerByStart[start] = owner;
    previousOwner = owner;
    start += serviceDays;
    patternIndex += 1;
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const weekend = isWeekendDay(year, month, day);
    const index = dayIndex(year, month, day);
    const availableTeam = index === 0 ? team.filter(aux => !previousWorked.has(aux.id)) : team;
    const morningTeam = index === 0 ? team : availableTeam;
    const mondayHandover = index === 0 ? weekendHandover : null;
    const plan = { day, weekend };
    const dayDoubles = leaderDoubles;
    const serviceIndex = blockStarts.findIndex(block => block.start <= day && day < block.start + block.serviceDays);
    const serviceBlock = blockStarts[serviceIndex];
    const previousBlock = blockStarts[serviceIndex - 1];
    let serviceOwner = ownerByStart[serviceBlock?.start];
    let morningOwner = day === serviceBlock?.start && previousBlock
      ? ownerByStart[previousBlock.start]
      : serviceOwner;
    if (weekend) {
      const key = `${year}-${month}-${dayIndex(year, month, day) === 5 ? day : day - 1}`;
      const weekendAux = availableTeam.find(aux => aux.id === weekendWorker);
      if (!weekendWorker || key !== weekendKey || !canWorkShift(weekendAux, "morning", year, month, day)) {
        weekendKey = key;
        const weekendTeam = index === 5
          ? weekendOwnerTeam({ team: availableTeam, previousWorked, shift: "morning", year, month, day })
          : availableTeam;
        weekendWorker = pickWeekendOwner({ team: weekendTeam.length ? weekendTeam : availableTeam, pointers, shift: "morning", year, month, day });
        weekendHandover = weekendWorker;
      }
      morningOwner = weekendWorker || morningOwner;
      serviceOwner = weekendWorker || serviceOwner;
    } else {
      weekendWorker = null;
      weekendKey = "";
    }
    morningOwner = mondayHandover || morningOwner;

    const morningWorker = mondayHandover || pickPreferredOrNext({
      preferred: morningOwner,
      team: morningTeam,
      pointers,
      load: primaryLoad,
      shift: "morning",
      year,
      month,
      day,
      previous: null,
      preferLeader: !weekend,
      preferWeekendOnly: weekend,
    });
    addShift(plan, "morning", morningWorker, load, dayExtras({ primary: morningWorker, team: morningTeam, pointers, load, shift: "morning", year, month, day, weekend, dayDoubles }), primaryLoad);

    const afternoonWorker = pickPreferredOrNext({
      preferred: serviceOwner,
      team: availableTeam,
      pointers,
      load: primaryLoad,
      shift: "afternoon",
      year,
      month,
      day,
      previous: plan.morning?.worker === serviceOwner ? null : plan.morning?.worker,
      preferLeader: !weekend,
      preferWeekendOnly: weekend,
    });
    addShift(plan, "afternoon", afternoonWorker, load, dayExtras({ primary: afternoonWorker, team: availableTeam, pointers, load, shift: "afternoon", year, month, day, weekend, dayDoubles }), primaryLoad);

    const afternoonAux = availableTeam.find(aux => aux.id === afternoonWorker);
    const nightWorker = afternoonAux && canWorkShift(afternoonAux, "night", year, month, day)
      ? afternoonAux.id
      : pickPreferredOrNext({
          preferred: serviceOwner,
          team: availableTeam,
          pointers,
          load: primaryLoad,
          shift: "night",
          year,
          month,
          day,
          previous: plan.morning?.worker,
          preferLeader: false,
          preferWeekendOnly: weekend,
        });
    addShift(plan, "night", nightWorker, load, nightExtras({ primary: nightWorker, team: availableTeam, pointers, load, year, month, day, weekend, dayDoubles }), primaryLoad);

    schedule[day] = plan;
    const workedToday = new Set();
    SHIFT_DEFS.forEach(shift => {
      shiftWorkers(plan[shift.id]).forEach(worker => {
        blocks.push({ day, shift: shift.id, worker, hours: shift.hours });
      });
      if (plan[shift.id]?.worker) workedToday.add(plan[shift.id].worker);
    });
    previousWorked = workedToday;
    if (weekend && index === 6) weekendHandover = plan.afternoon?.worker || plan.morning?.worker || weekendHandover;
  }

  return { schedule, blocks, load };
}

function previousWeekendRest({ year, month, auxiliaries, rotationDays }) {
  if (dayIndex(year, month, 1) !== 0) return [];
  const previousDate = new Date(year, month, 0);
  const previousYear = previousDate.getFullYear();
  const previousMonth = previousDate.getMonth();
  const previousTotal = daysInMonth(previousYear, previousMonth);
  const previous = Number(rotationDays) >= 2
    ? buildBlockSchedule({ year: previousYear, month: previousMonth, auxiliaries, rotationDays })
    : buildDailySchedule({ year: previousYear, month: previousMonth, auxiliaries });
  const rest = new Set();
  [previousTotal].forEach(day => {
    SHIFT_DEFS.forEach(shift => {
      const worker = previous.schedule[day]?.[shift.id]?.worker;
      if (worker) rest.add(worker);
    });
  });
  return [...rest];
}

export function buildSchedule({ year, month, auxiliaries, rotationDays = 1 }) {
  const days = Number(rotationDays) || 1;
  const initialWeekendRest = previousWeekendRest({ year, month, auxiliaries, rotationDays: days });
  if (days >= 2) return buildBlockSchedule({ year, month, auxiliaries, rotationDays: days, initialWeekendRest });
  return buildDailySchedule({ year, month, auxiliaries, initialWeekendRest });
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
      shiftWorkers(day[shift.id]).forEach(worker => {
        if (!worker || !hours[worker]) return;
        hours[worker][shift.id] += shift.hours;
        hours[worker].total += shift.hours;
      });
    });
  });

  return hours;
}
