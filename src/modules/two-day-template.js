import { buildEmptySchedule } from "./manual-schedule.js";
import { canWorkShift } from "./scheduler.js";

export const TWO_DAY_MODE = "two-day-weekend-third";
const DAY = 86400000;
// A fixed Monday keeps the three-week cycle continuous across month boundaries.
const ANCHOR = Date.UTC(2026, 0, 5);
const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;
const duration = (value, fallback, max) => Number.isFinite(Number(value)) && value !== "" && value != null
  ? Math.max(0, Math.min(max, Number(value))) : fallback;

export function twoDayHours(aux) {
  const morning = duration(aux.templateMorningHours, 7, 12);
  return { morning, afternoon: duration(aux.templateAfternoonHours, 5, 12 - morning), night: 2 };
}

export function buildTwoDayTemplate({ year, month, auxiliaries = [] }) {
  const team = auxiliaries.filter(aux => aux.active !== false && aux.status !== "absent" && aux.templatePlaceHours !== false);
  const phase = aux => [0, 1, 2].includes(Number(aux.templateWeekendPhase)) && aux.templateWeekendPhase != null
    ? Number(aux.templateWeekendPhase) : team.indexOf(aux) % 3;
  const schedule = buildEmptySchedule({ year, month });
  const start = Date.UTC(year, month, 1);
  const end = Date.UTC(year, month + 1, 1);
  const firstWeek = Math.floor((start - ANCHOR) / (7 * DAY));
  const lastWeek = Math.floor((end - 1 - ANCHOR) / (7 * DAY));
  const plans = new Map();
  const work = new Map(team.map(aux => [aux.id, []]));
  const available = (aux, shift, stamp) => {
    const date = new Date(stamp);
    return canWorkShift(aux, shift, date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  };
  const add = (aux, stamp, shift, hours, startHour) => {
    if (!aux || !hours) return;
    const plan = plans.get(stamp) || {};
    plan[shift] = { id: shift, worker: aux.id, workers: [aux.id], hours };
    plans.set(stamp, plan);
    work.get(aux.id).push({ start: stamp / DAY * 24 + startHour, end: stamp / DAY * 24 + startHour + hours });
  };
  // Complete surrounding weeks are generated before cropping to the displayed month.
  for (let week = firstWeek - 1; week <= lastWeek + 1; week += 1) {
    const monday = ANCHOR + week * 7 * DAY;
    for (const [days, group] of [[[0, 1], 1], [[2], 0], [[3, 4], 2], [[5, 6], 0]]) {
      const candidates = team.filter(aux => phase(aux) === mod(week + group, 3))
        .filter(aux => days.every(day => ["morning", "afternoon"].every(shift => available(aux, shift, monday + day * DAY))));
      const owner = candidates[mod(Math.floor(week / 3), candidates.length)];
      if (!owner) continue;
      const hours = twoDayHours(owner);
      for (const day of days) {
        add(owner, monday + day * DAY, "morning", hours.morning, 7.5);
        add(owner, monday + day * DAY, "afternoon", hours.afternoon, 7.5 + hours.morning);
      }
    }
  }
  const canAddBedtime = (aux, stamp) => {
    const from = stamp / DAY * 24 + 19.5;
    const to = from + 2;
    const entries = work.get(aux.id);
    // This template reserves 11h between duties and a 35h weekly rest window.
    if (entries.some(item => from < item.end + 11 && to > item.start - 11)) return false;
    const week = Math.floor((stamp - ANCHOR) / (7 * DAY));
    const weekStart = (ANCHOR / DAY + week * 7) * 24;
    const weekly = [...entries, { start: from, end: to }].filter(item => item.start >= weekStart && item.start < weekStart + 168).sort((a, b) => a.start - b.start);
    if (weekly.reduce((sum, item) => sum + item.end - item.start, 0) > 48) return false;
    let cursor = weekStart;
    let gap = 0;
    for (const item of weekly) { gap = Math.max(gap, item.start - cursor); cursor = Math.max(cursor, item.end); }
    return Math.max(gap, weekStart + 168 - cursor) >= 35;
  };
  for (let stamp = ANCHOR + firstWeek * 7 * DAY; stamp < ANCHOR + (lastWeek + 1) * 7 * DAY; stamp += DAY) {
    const week = Math.floor((stamp - ANCHOR) / (7 * DAY));
    const weekday = mod((stamp - ANCHOR) / DAY, 7);
    const owner = plans.get(stamp)?.morning?.worker;
    const candidates = team.filter(aux => aux.id !== owner && available(aux, "bedtime", stamp))
      .filter(aux => weekday < 5 || phase(aux) === mod(week, 3))
      .filter(aux => canAddBedtime(aux, stamp))
      .sort((a, b) => work.get(a.id).length - work.get(b.id).length || a.id.localeCompare(b.id));
    add(candidates[0], stamp, "bedtime", 2, 19.5);
  }
  const hourOverrides = {};
  let missing = 0;
  for (const plan of Object.values(schedule)) {
    const generated = plans.get(Date.UTC(year, month, plan.day)) || {};
    for (const shift of ["morning", "afternoon", "bedtime"]) {
      plan[shift] = generated[shift] || plan[shift];
      hourOverrides[`${year}-${month}-${plan.day}-${shift}`] = plan[shift].hours;
      if (!plan[shift].worker) missing += 1;
    }
  }
  return { schedule, hourOverrides, blocks: [], load: {}, warnings: missing ? [`${missing} créneau(x) à compléter : disponibilités, repos ou week-end sur trois incompatibles.`] : [] };
}
