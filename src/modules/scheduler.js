import { DEFAULT_QUOTA, SHIFT_DEFS } from "./constants.js?v=20260722-shift-7-5";
import { dayIndex, daysInMonth, isWeekendDay } from "./dates.js";
import { createHourAccount, creditScheduledHours } from "./hour-accounting.js?v=20260722-custom-hours";

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

function pickWeekdayOwner({ team, pointers, shift, year, month, day, previous = null }) {
  const base = team.filter(aux => aux.shift !== "night" && !isWeekendOnly(aux));
  const ordered = prioritizeRomain(base);
  const available = ordered.filter(aux => canWorkShift(aux, shift, year, month, day))
    .filter(aux => !aux.lead || ordered.some(teammate => teammate.id !== aux.id && canWorkShift(teammate, shift, year, month, day)));
  if (!available.length) return null;
  const offset = (pointers["weekday-owner"] || 0) % available.length;
  const rotated = available.slice(offset).concat(available.slice(0, offset));
  const picked = rotated.find(aux => aux.id !== previous) || rotated[0];
  const index = available.findIndex(aux => aux.id === picked.id);
  pointers["weekday-owner"] = (index + 1) % available.length;
  return picked.id;
}

function pickWeekendOwner({ team, pointers, shift, year, month, day }) {
  const weekendOnly = team.filter(aux => isWeekendOnly(aux) && aux.shift !== "night");
  const regulars = team.filter(aux => !isWeekendOnly(aux) && aux.shift !== "night");
  const teammates = [...weekendOnly, ...prioritizeRomain(regulars)];
  return pickSequential({ ordered: teammates, pointers, key: "weekend-owner", shift, year, month, day });
}

function weekendOwnerTeam({ team, previousWorked, shift, year, month, day }) {
  const canCover = aux => aux.shift !== "night" && canWorkShift(aux, shift, year, month, day);
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
    .filter(aux => canWorkShift(aux, shift, year, month, day));

  if (!ordered.length) return null;
  const blocked = new Set([previous, ...exclude].filter(Boolean));
  const candidates = ordered.filter(aux => !blocked.has(aux.id)) || ordered;
  const picked = candidates[0] || ordered[0];
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

function pickCoverageDouble({ primary, team, pointers, load, shift, year, month, day, dayDoubles }) {
  const savedId = dayDoubles?.coverage?.[day];
  const saved = team.find(aux => aux.id === savedId);
  if (saved && saved.id !== primary && saved.coverage && canWorkShift(saved, shift, year, month, day)) {
    return [saved.id];
  }
  const extraLoad = dayDoubles.extraLoad ||= {};
  const candidates = team
    .filter(aux => aux.coverage && aux.shift !== "night" && aux.id !== primary)
    .filter(aux => canWorkShift(aux, shift, year, month, day))
    .sort((a, b) => (extraLoad[a.id] || 0) - (extraLoad[b.id] || 0));
  const teammate = candidates[0]?.id || null;
  if (teammate && dayDoubles) {
    dayDoubles.coverage ||= {};
    dayDoubles.coverage[day] = teammate;
    extraLoad[teammate] = (extraLoad[teammate] || 0) + 1;
  }
  return teammate ? [teammate] : [];
}

function dayExtras({ primary, team, pointers, load, shift, year, month, day, weekend, dayDoubles }) {
  if (!primary) return [];
  const coverage = pickCoverageDouble({ primary, team, pointers, load, shift, year, month, day, dayDoubles });
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
    includeCoverage: true,
  });
  if (!teammate) return [];
  const idx = candidates.findIndex(aux => aux.id === teammate);
  pointers[key] = (idx >= 0 ? idx + 1 : (pointers[key] || 0) + 1) % Math.max(1, candidates.length);
  return [teammate];
}

function nightExtras({ primary, team, pointers, load, year, month, day, weekend, dayDoubles }) {
  const nightOnly = pickNightOnlyDouble({ primary, team, pointers, load, year, month, day, weekend });
  if (nightOnly.length) return nightOnly;
  const savedCoverageId = dayDoubles?.coverage?.[day];
  const savedCoverage = team.find(aux => aux.id === savedCoverageId);
  if (savedCoverage && savedCoverage.id !== primary && canWorkShift(savedCoverage, "night", year, month, day)) {
    return [savedCoverage.id];
  }
  return dayExtras({ primary, team, pointers, load, shift: "night", year, month, day, weekend, dayDoubles });
}

function buildThreeDaySchedule({ year, month, auxiliaries }) {
  const team = auxiliaries.map(normalizeAuxiliary).filter(aux => aux.active);
  const cycle = prioritizeRomain(team.filter(aux => aux.shift !== "night" && !isWeekendOnly(aux)));
  const schedule = {};
  const blocks = [];
  const load = Object.fromEntries(team.map(aux => [aux.id, 0]));
  const primaryLoad = Object.fromEntries(team.map(aux => [aux.id, 0]));
  const pointers = { morning: 0, afternoon: 0, night: 0, "night-double": 0, "weekend-night-double": 0 };
  const dayDoubles = {};
  const totalDays = daysInMonth(year, month);
  const firstDayIndex = dayIndex(year, month, 1);
  let previousAfternoon = null;

  const cycleOwner = (day, shift) => {
    const index = dayIndex(year, month, day);
    const week = Math.floor((firstDayIndex + day - 1) / 7);
    const offset = index <= 2 ? 0 : index <= 4 ? 1 : 2;
    const preferredIndex = (week + offset) % Math.max(1, cycle.length);
    const ordered = cycle.slice(preferredIndex).concat(cycle.slice(0, preferredIndex));
    return ordered.find(aux => canWorkShift(aux, shift, year, month, day))?.id
      || pickWorker({ team, pointers, shift, year, month, day, previous: null });
  };

  for (let day = 1; day <= totalDays; day += 1) {
    const weekend = isWeekendDay(year, month, day);
    const plan = { day, weekend };
    const morningWorker = canWorkShift(team.find(aux => aux.id === previousAfternoon), "morning", year, month, day)
      ? previousAfternoon
      : cycleOwner(day, "morning");
    addShift(plan, "morning", morningWorker, load, dayExtras({ primary: morningWorker, team, pointers, load, shift: "morning", year, month, day, weekend, dayDoubles }), primaryLoad);

    const nextDayStartsTonight = dayIndex(year, month, day) === 6 && day < totalDays;
    const afternoonWorker = cycleOwner(nextDayStartsTonight ? day + 1 : day, "afternoon");
    addShift(plan, "afternoon", afternoonWorker, load, dayExtras({ primary: afternoonWorker, team, pointers, load, shift: "afternoon", year, month, day, weekend, dayDoubles }), primaryLoad);

    const afternoonAux = team.find(aux => aux.id === afternoonWorker);
    const nightWorker = afternoonAux && canWorkShift(afternoonAux, "night", year, month, day)
      ? afternoonAux.id
      : cycleOwner(day, "night");
    addShift(plan, "night", nightWorker, load, nightExtras({ primary: nightWorker, team, pointers, load, year, month, day, weekend, dayDoubles }), primaryLoad);

    previousAfternoon = afternoonWorker;
    schedule[day] = plan;
    SHIFT_DEFS.forEach(shift => {
      shiftWorkers(plan[shift.id]).forEach(worker => blocks.push({ day, shift: shift.id, worker, hours: shift.hours }));
    });
  }

  return { schedule, blocks, load };
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
    const availableTeam = team;
    const morningTeam = team;
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
        : pickPreferredOrNext({
            preferred: previousDayWorker,
            team: morningTeam,
            pointers,
            load: primaryLoad,
            shift: "morning",
            year,
            month,
            day,
            previous: null,
            preferLeader: true,
            preferWeekendOnly: false,
          }))
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

    const afternoonWorker = weekend
      ? pickPreferredOrNext({
          preferred: weekendWorker || plan.morning?.worker,
          team: availableTeam,
          pointers,
          load: primaryLoad,
          shift: "afternoon",
          year,
          month,
          day,
          previous: null,
          preferLeader: false,
          preferWeekendOnly: true,
        })
      : pickWeekdayOwner({ team: availableTeam, pointers, shift: "afternoon", year, month, day, previous: previousDayWorker })
        || pickWorker({
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

function pickFullDayWorker({ team, pointers, load, year, month, day, previous = null, weekend = false }) {
  const candidates = team
    .filter(aux => aux.shift !== "night")
    .filter(aux => canWorkShift(aux, "morning", year, month, day) && canWorkShift(aux, "afternoon", year, month, day));
  const owner = pickWeekdayOwner({ team: candidates, pointers, shift: "morning", year, month, day, previous })
    || pickWorker({
      team: candidates.length ? candidates : team,
      pointers,
      load,
      shift: "morning",
      year,
      month,
      day,
      previous,
      preferLeader: !weekend,
      preferWeekendOnly: weekend,
    });
  return owner;
}

function pickEveningWorker({ team, pointers, load, year, month, day, dayWorker, weekend = false }) {
  const canCoverNight = team.filter(aux => canWorkShift(aux, "night", year, month, day));
  const picked = pickWorker({
    team: canCoverNight.length ? canCoverNight : team,
    pointers,
    load,
    shift: "night",
    year,
    month,
    day,
    previous: dayWorker,
    exclude: [dayWorker],
    preferLeader: false,
    preferWeekendOnly: weekend,
  });
  if (picked) return picked;
  const dayAux = team.find(aux => aux.id === dayWorker);
  return canWorkShift(dayAux, "night", year, month, day) ? dayWorker : null;
}

function buildSplitDaySchedule({ year, month, auxiliaries }) {
  const team = auxiliaries.map(normalizeAuxiliary).filter(aux => aux.active);
  const schedule = {};
  const blocks = [];
  const load = Object.fromEntries(team.map(aux => [aux.id, 0]));
  const primaryLoad = Object.fromEntries(team.map(aux => [aux.id, 0]));
  const pointers = { morning: 0, afternoon: 0, night: 0, "weekday-owner": 0, "weekend-owner": 0, "leader-double": 0, "night-double": 0, "weekend-night-double": 0 };
  const leaderDoubles = {};
  let previousDayWorker = null;

  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    const weekend = isWeekendDay(year, month, day);
    const plan = { day, weekend };
    const dayDoubles = leaderDoubles;
    const dayWorker = pickFullDayWorker({
      team,
      pointers,
      load: primaryLoad,
      year,
      month,
      day,
      previous: previousDayWorker,
      weekend,
    });
    const morningWorker = pickPreferredOrNext({
      preferred: dayWorker,
      team,
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
    addShift(plan, "morning", morningWorker, load, dayExtras({ primary: morningWorker, team, pointers, load, shift: "morning", year, month, day, weekend, dayDoubles }), primaryLoad);

    const afternoonWorker = pickPreferredOrNext({
      preferred: dayWorker || morningWorker,
      team,
      pointers,
      load: primaryLoad,
      shift: "afternoon",
      year,
      month,
      day,
      previous: null,
      preferLeader: !weekend,
      preferWeekendOnly: weekend,
    });
    addShift(plan, "afternoon", afternoonWorker, load, dayExtras({ primary: afternoonWorker, team, pointers, load, shift: "afternoon", year, month, day, weekend, dayDoubles }), primaryLoad);

    const eveningWorker = pickEveningWorker({
      team,
      pointers,
      load: primaryLoad,
      year,
      month,
      day,
      dayWorker: afternoonWorker || morningWorker,
      weekend,
    });
    addShift(plan, "night", eveningWorker, load, nightExtras({ primary: eveningWorker, team, pointers, load, year, month, day, weekend, dayDoubles }), primaryLoad);

    previousDayWorker = afternoonWorker || morningWorker || previousDayWorker;
    schedule[day] = plan;
    SHIFT_DEFS.forEach(shift => {
      shiftWorkers(plan[shift.id]).forEach(worker => {
        blocks.push({ day, shift: shift.id, worker, hours: shift.hours });
      });
    });
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
  const servicePattern = span === 3 ? [3, 2, 2] : [span];
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
    const ownerDay = Array.from({ length: serviceDays }, (_, offset) => start + offset)
      .find(day => day <= totalDays && !isWeekendDay(year, month, day));
    const owner = ownerDay
      ? pickWeekdayOwner({ team, pointers, shift: "afternoon", year, month, day: ownerDay, previous: previousOwner })
        || pickWorker({
          team,
          pointers,
          load: primaryLoad,
          shift: "afternoon",
          year,
          month,
          day: ownerDay,
          previous: previousOwner,
          preferLeader: true,
          preferWeekendOnly: false,
        })
      : previousOwner;
    blockStarts.push({ start, serviceDays });
    ownerByStart[start] = owner;
    previousOwner = owner;
    start += serviceDays;
    patternIndex += 1;
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const weekend = isWeekendDay(year, month, day);
    const index = dayIndex(year, month, day);
    const availableTeam = team;
    const morningTeam = team;
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

export function buildSchedule({ year, month, auxiliaries, rotationDays = 1 }) {
  if (rotationDays === "split-day") return buildSplitDaySchedule({ year, month, auxiliaries });
  const days = Number(rotationDays) || 1;
  if (days >= 2) return buildBlockSchedule({ year, month, auxiliaries, rotationDays: days });
  return buildDailySchedule({ year, month, auxiliaries });
}

export function calculateHours(schedule, auxiliaries) {
  const hours = Object.fromEntries(auxiliaries.map(aux => [aux.id, createHourAccount(aux)]));
  const orderedDays = Object.values(schedule).sort((a, b) => Number(a.day) - Number(b.day));

  orderedDays.forEach(day => {
    SHIFT_DEFS.forEach(shift => {
      [...new Set(shiftWorkers(day[shift.id]))].forEach(worker => {
        if (!worker || !hours[worker]) return;
        creditScheduledHours({
          account: hours[worker],
          shift: shift.id,
          scheduledHours: shift.hours,
          day: day.day,
        });
      });
    });
  });

  return hours;
}
