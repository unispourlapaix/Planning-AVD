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
  return { active: true, status: "available", quota: DEFAULT_QUOTA, lead: false, coverage: false, night: false, days: "all", customDays: [0, 1, 2, 3, 4, 5, 6], shift: "all", ...aux };
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
  const leader = base.find(aux => aux.lead);
  const others = prioritizeRomain(base.filter(aux => aux.id !== leader?.id));
  const ordered = leader ? [...others, leader] : others;
  const available = ordered.filter(aux => canWorkShift(aux, shift, year, month, day)).filter(aux => !aux.lead || others.some(teammate => canWorkShift(teammate, shift, year, month, day)));
  if (!available.length) return null;
  const offset = (pointers["weekday-owner"] || 0) % available.length;
  const rotated = available.slice(offset).concat(available.slice(0, offset));
  const picked = rotated.find(aux => aux.id !== previous) || rotated[0];
  pointers["weekday-owner"] = (available.findIndex(aux => aux.id === picked.id) + 1) % available.length;
  return picked.id;
}
function pickWeekendOwner({ team, pointers, shift, year, month, day }) { return pickSequential({ ordered: team.filter(aux => !aux.lead && aux.shift !== "night"), pointers, key: "weekend-owner", shift, year, month, day }); }
function weekendOwnerTeam({ team, previousWorked, shift, year, month, day }) {
  const main = team.filter(aux => aux.shift !== "night" && canWorkShift(aux, shift, year, month, day));
  const teammates = main.filter(aux => !aux.lead), restedTeammates = teammates.filter(aux => !previousWorked.has(aux.id)), rested = main.filter(aux => !previousWorked.has(aux.id));
  return restedTeammates.length ? restedTeammates : teammates.length ? teammates : rested.length ? rested : main;
}
function orderedTeam(team, pointer, preferLeader, preferWeekendOnly) {
  const base = team.filter(aux => aux.active && aux.status !== "absent"), leader = preferLeader ? base.find(aux => aux.lead) : null;
  let ordered = base;
  if (preferWeekendOnly) ordered = [...base.filter(isWeekendOnly), ...base.filter(aux => !isWeekendOnly(aux))];
  else if (leader) { const others = base.filter(aux => aux.id !== leader.id); ordered = others.length ? [...others, leader] : [leader]; }
  if (!ordered.length) return [];
  const offset = pointer % ordered.length;
  return ordered.slice(offset).concat(ordered.slice(0, offset));
}
function pickWorker({ team, pointers, shift, year, month, day, previous, exclude = [], preferLeader = false, preferWeekendOnly = false }) {
  const key = preferWeekendOnly ? `weekend-${shift}` : shift, ordered = orderedTeam(team, pointers[key] || 0, preferLeader, preferWeekendOnly).filter(aux => canWorkShift(aux, shift, year, month, day));
  if (!ordered.length) return null;
  const blocked = new Set([previous, ...exclude].filter(Boolean)), candidates = ordered.filter(aux => !blocked.has(aux.id)), picked = candidates[0] || ordered[0], idx = ordered.findIndex(aux => aux.id === picked.id);
  pointers[key] = (idx >= 0 ? (pointers[key] || 0) + idx + 1 : (pointers[key] || 0) + 1) % ordered.length;
  return picked.id;
}
function shiftWorkers(entry) { return !entry ? [] : Array.isArray(entry.workers) ? entry.workers.filter(Boolean) : entry.worker ? [entry.worker] : []; }
function addShift(dayPlan, shift, worker, load, extras = [], primaryLoad = load) {
  const def = SHIFT_DEFS.find(item => item.id === shift), workers = [worker, ...extras].filter(Boolean);
  dayPlan[shift] = { worker, workers, hours: def?.hours || 0 };
  workers.forEach(id => { load[id] = (load[id] || 0) + (def?.hours || 0); });
  if (worker && primaryLoad !== load) primaryLoad[worker] = (primaryLoad[worker] || 0) + (def?.hours || 0);
}
function pickPreferredOrNext({ preferred, team, pointers, shift, year, month, day, previous, preferLeader = false, preferWeekendOnly = false }) {
  const aux = team.find(item => item.id === preferred);
  return aux && aux.id !== previous && canWorkShift(aux, shift, year, month, day) ? aux.id : pickWorker({ team, pointers, shift, year, month, day, previous, preferLeader, preferWeekendOnly });
}
function pickLeaderDouble({ primary, team, pointers, shift, year, month, day, weekend, dayDoubles }) {
  const primaryAux = team.find(aux => aux.id === primary);
  if (!primaryAux?.lead || weekend) return [];
  const saved = dayDoubles?.[primary], savedAux = team.find(aux => aux.id === saved?.worker);
  if (saved?.day >= day - 1 && savedAux && !savedAux.coverage && savedAux.shift !== "night" && canWorkShift(savedAux, shift, year, month, day)) { saved.day = day; return [savedAux.id]; }
  const teammates = prioritizeRomain(team.filter(aux => !aux.lead && !aux.coverage && aux.shift !== "night")), rotating = saved?.worker ? teammates.filter(aux => aux.id !== saved.worker) : teammates;
  const teammate = pickSequential({ ordered: rotating.length ? rotating : teammates, pointers, key: "leader-double", shift, year, month, day });
  if (teammate && dayDoubles) dayDoubles[primary] = { worker: teammate, day };
  return teammate ? [teammate] : [];
}
function pickCoverageDouble({ primary, team, shift, year, month, day, dayDoubles }) {
  const savedId = dayDoubles?.coverage?.[day], saved = team.find(aux => aux.id === savedId);
  if (saved && saved.id !== primary && (saved.coverage || saved.lead) && canWorkShift(saved, shift, year, month, day)) return [saved.id];
  const extraLoad = dayDoubles.extraLoad ||= {};
  const candidates = team.filter(aux => (aux.coverage || aux.lead) && aux.shift !== "night" && aux.id !== primary).filter(aux => canWorkShift(aux, shift, year, month, day)).sort((a, b) => (extraLoad[a.id] || 0) - (extraLoad[b.id] || 0));
  const teammate = candidates[0]?.id || null;
  if (teammate) { dayDoubles.coverage ||= {}; dayDoubles.coverage[day] = teammate; extraLoad[teammate] = (extraLoad[teammate] || 0) + 1; }
  return teammate ? [teammate] : [];
}
function dayExtras(options) { if (!options.primary) return []; const coverage = pickCoverageDouble(options); return coverage.length ? coverage : pickLeaderDouble(options); }
function pickNightOnlyDouble({ primary, team, pointers, year, month, day, weekend }) {
  if (team.find(aux => aux.id === primary)?.shift === "night") return [];
  const key = weekend ? "weekend-night-double" : "night-double", candidates = team.filter(aux => aux.shift === "night" && canWorkShift(aux, "night", year, month, day));
  const teammate = pickWorker({ team: candidates, pointers: { ...pointers, night: pointers[key] || 0 }, shift: "night", year, month, day, previous: primary, exclude: [primary] });
  if (!teammate) return [];
  const idx = candidates.findIndex(aux => aux.id === teammate);
  pointers[key] = (idx >= 0 ? idx + 1 : (pointers[key] || 0) + 1) % Math.max(1, candidates.length);
  return [teammate];
}
function nightExtras(options) {
  const nightOnly = pickNightOnlyDouble(options);
  if (nightOnly.length) return nightOnly;
  const saved = options.team.find(aux => aux.id === options.dayDoubles?.coverage?.[options.day]);
  return saved && saved.id !== options.primary && canWorkShift(saved, "night", options.year, options.month, options.day) ? [saved.id] : dayExtras({ ...options, shift: "night" });
}
function buildThreeDaySchedule({ year, month, auxiliaries }) {
  const team = auxiliaries.map(normalizeAuxiliary).filter(aux => aux.active), cycle = prioritizeRomain(team.filter(aux => aux.shift !== "night" && !isWeekendOnly(aux))), schedule = {}, blocks = [], load = Object.fromEntries(team.map(aux => [aux.id, 0])), primaryLoad = { ...load }, pointers = { morning: 0, afternoon: 0, night: 0, "night-double": 0, "weekend-night-double": 0 }, dayDoubles = {}, total = daysInMonth(year, month), first = dayIndex(year, month, 1);
  let previous = null;
  const owner = (day, shift) => { const index = dayIndex(year, month, day), week = Math.floor((first + day - 1) / 7), offset = index <= 2 ? 0 : index <= 4 ? 1 : 2, preferred = (week + offset) % Math.max(1, cycle.length), ordered = cycle.slice(preferred).concat(cycle.slice(0, preferred)); return ordered.find(aux => canWorkShift(aux, shift, year, month, day))?.id || pickWorker({ team, pointers, shift, year, month, day, previous: null }); };
  for (let day = 1; day <= total; day += 1) {
    const weekend = isWeekendDay(year, month, day), plan = { day, weekend }, morning = day === 1 ? null : canWorkShift(team.find(aux => aux.id === previous), "morning", year, month, day) ? previous : owner(day, "morning");
    addShift(plan, "morning", morning, load, dayExtras({ primary: morning, team, pointers, shift: "morning", year, month, day, weekend, dayDoubles }), primaryLoad);
    const afternoon = owner(day, "afternoon"); addShift(plan, "afternoon", afternoon, load, dayExtras({ primary: afternoon, team, pointers, shift: "afternoon", year, month, day, weekend, dayDoubles }), primaryLoad);
    const aux = team.find(item => item.id === afternoon), night = aux && canWorkShift(aux, "night", year, month, day) ? aux.id : owner(day, "night"); addShift(plan, "night", night, load, nightExtras({ primary: night, team, pointers, year, month, day, weekend, dayDoubles }), primaryLoad);
    previous = afternoon; schedule[day] = plan; SHIFT_DEFS.forEach(shift => shiftWorkers(plan[shift.id]).forEach(worker => blocks.push({ day, shift: shift.id, worker, hours: shift.hours })));
  }
  return { schedule, blocks, load };
}
function buildGeneric({ year, month, auxiliaries, rotationDays }) {
  const team = auxiliaries.map(normalizeAuxiliary).filter(aux => aux.active), schedule = {}, blocks = [], load = Object.fromEntries(team.map(aux => [aux.id, 0])), primaryLoad = { ...load }, pointers = { morning: 0, afternoon: 0, night: 0, "weekday-owner": 0, "weekend-owner": 0, "night-double": 0, "weekend-night-double": 0 }, dayDoubles = {}, total = daysInMonth(year, month), span = Math.max(1, Math.min(4, Number(rotationDays) || 1)), pattern = span === 1 ? [1] : [span - 1], starts = [], owners = {};
  let previous = null, weekendWorker = null, weekendKey = "", weekendHandover = null, previousWorked = new Set();
  for (let start = 1, i = 0; start <= total; i += 1) { const size = pattern[i % pattern.length], ownerDay = Array.from({ length: size }, (_, offset) => start + offset).find(day => day <= total && !isWeekendDay(year, month, day)), worker = ownerDay ? pickWeekdayOwner({ team, pointers, shift: "afternoon", year, month, day: ownerDay, previous }) || pickWorker({ team, pointers, shift: "afternoon", year, month, day: ownerDay, previous, preferLeader: true }) : previous; starts.push({ start, size }); owners[start] = worker; previous = worker; start += size; }
  for (let day = 1; day <= total; day += 1) {
    const weekend = isWeekendDay(year, month, day), index = dayIndex(year, month, day), plan = { day, weekend }, block = starts.find(item => item.start <= day && day < item.start + item.size), before = starts[starts.indexOf(block) - 1]; let worker = owners[block?.start], morning = day === block?.start && before ? owners[before.start] : worker;
    if (weekend) { const key = `${year}-${month}-${index === 5 ? day : day - 1}`; if (!weekendWorker || key !== weekendKey || !canWorkShift(team.find(aux => aux.id === weekendWorker), "morning", year, month, day)) { weekendKey = key; const available = index === 5 ? weekendOwnerTeam({ team, previousWorked, shift: "morning", year, month, day }) : team; weekendWorker = pickWeekendOwner({ team: available.length ? available : team, pointers, shift: "morning", year, month, day }); weekendHandover = weekendWorker; } morning = weekendWorker || morning; worker = weekendWorker || worker; } else { weekendWorker = null; weekendKey = ""; }
    if (index === 0) morning = weekendHandover || morning;
    const am = day === 1 ? null : pickPreferredOrNext({ preferred: morning, team, pointers, shift: "morning", year, month, day, previous: null, preferLeader: !weekend, preferWeekendOnly: weekend }); addShift(plan, "morning", am, load, dayExtras({ primary: am, team, pointers, shift: "morning", year, month, day, weekend, dayDoubles }), primaryLoad);
    const pm = pickPreferredOrNext({ preferred: worker, team, pointers, shift: "afternoon", year, month, day, previous: am === worker ? null : am, preferLeader: !weekend, preferWeekendOnly: weekend }); addShift(plan, "afternoon", pm, load, dayExtras({ primary: pm, team, pointers, shift: "afternoon", year, month, day, weekend, dayDoubles }), primaryLoad);
    const aux = team.find(item => item.id === pm), night = aux && canWorkShift(aux, "night", year, month, day) ? pm : pickPreferredOrNext({ preferred: worker, team, pointers, shift: "night", year, month, day, previous: am, preferWeekendOnly: weekend }); addShift(plan, "night", night, load, nightExtras({ primary: night, team, pointers, year, month, day, weekend, dayDoubles }), primaryLoad);
    schedule[day] = plan; const worked = new Set(); SHIFT_DEFS.forEach(shift => { shiftWorkers(plan[shift.id]).forEach(id => blocks.push({ day, shift: shift.id, worker: id, hours: shift.hours })); if (plan[shift.id]?.worker) worked.add(plan[shift.id].worker); }); previousWorked = worked; if (weekend && index === 6) weekendHandover = plan.afternoon?.worker || plan.morning?.worker || weekendHandover;
  }
  return { schedule, blocks, load };
}
export function buildSchedule({ year, month, auxiliaries, rotationDays = 1 }) { return Number(rotationDays) === 3 ? buildThreeDaySchedule({ year, month, auxiliaries }) : buildGeneric({ year, month, auxiliaries, rotationDays }); }
export function calculateHours(schedule, auxiliaries) {
  const hours = Object.fromEntries(auxiliaries.map(aux => [aux.id, { morning: 0, afternoon: 0, night: 0, total: 0, quota: Number(aux.quota) || DEFAULT_QUOTA }]));
  Object.values(schedule).forEach(day => SHIFT_DEFS.forEach(shift => shiftWorkers(day[shift.id]).forEach(worker => { if (!worker || !hours[worker]) return; hours[worker][shift.id] += shift.hours; hours[worker].total += shift.hours; })));
  return hours;
}
