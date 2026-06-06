import { MONTHS, SHIFT_DEFS, SHIFT_LABEL } from "./constants.js";
import { dayIndex, daysInMonth } from "./dates.js";
import { canWorkShift } from "./scheduler-handover.js";

const workers = entry => Array.isArray(entry?.workers) ? entry.workers.filter(Boolean) : (entry?.worker ? [entry.worker] : []);
const primary = entry => workers(entry)[0] || "";

const auxName = (auxiliaries, id) => auxiliaries.find(aux => aux.id === id)?.name || "A definir";
const compactDays = days => days.slice(0, 4).join(", ") + (days.length > 4 ? ` +${days.length - 4}` : "");

export function buildRotationAudit({ year, month, auxiliaries = [], schedule = {}, rotationDays = 1 }) {
  const active = auxiliaries.filter(aux => aux.active !== false && aux.status !== "absent");
  const byId = Object.fromEntries(active.map(aux => [aux.id, aux]));
  const totalDays = daysInMonth(year, month);
  const checks = [];
  const seen = new Set();

  const add = (level, title, detail, key = `${level}-${title}-${detail}`) => {
    if (seen.has(key)) return;
    seen.add(key);
    checks.push({ level, title, detail });
  };

  const undefinedSlots = [];
  const invalidSlots = [];
  const nightCount = Object.fromEntries(active.map(aux => [aux.id, 0]));
  const mainCount = Object.fromEntries(active.map(aux => [aux.id, 0]));
  const weekendOwnerCount = Object.fromEntries(active.map(aux => [aux.id, 0]));
  const weekendOwners = [];

  for (let day = 1; day <= totalDays; day += 1) {
    const plan = schedule[day] || {};
    SHIFT_DEFS.forEach(shift => {
      const ids = workers(plan[shift.id]);
      if (!ids.length) undefinedSlots.push(`${day} ${SHIFT_LABEL[shift.id]}`);
      ids.forEach(id => {
        const aux = byId[id];
        if (!aux || !canWorkShift(aux, shift.id, year, month, day)) {
          invalidSlots.push(`${day} ${SHIFT_LABEL[shift.id]} : ${auxName(auxiliaries, id)}`);
        }
      });
    });

    workers(plan.night).forEach(id => { if (nightCount[id] !== undefined) nightCount[id] += 1; });
    const owner = primary(plan.afternoon) || primary(plan.morning);
    if (owner && mainCount[owner] !== undefined) mainCount[owner] += 1;

    if (dayIndex(year, month, day) === 5) {
      const sunday = schedule[day + 1] || {};
      const weekendOwner = primary(plan.afternoon) || primary(sunday.morning) || primary(plan.morning);
      if (weekendOwner) {
        weekendOwners.push({ day, owner: weekendOwner });
        if (weekendOwnerCount[weekendOwner] !== undefined) weekendOwnerCount[weekendOwner] += 1;
      }
    }
  }

  if (undefinedSlots.length) {
    add("danger", "Creneaux a definir", `${undefinedSlots.length} creneau(x) sans auxiliaire : ${compactDays(undefinedSlots)}.`);
  }

  if (invalidSlots.length) {
    add("danger", "Options auxiliaires non respectees", `${compactDays(invalidSlots)}.`);
  }

  active
    .filter(aux => aux.shift === "night")
    .filter(aux => (nightCount[aux.id] || 0) === 0)
    .forEach(aux => add("warning", "Nuit non placee", `${aux.name} est note(e) nuits seulement mais n'a aucune surveillance de nuit ce mois.`));

  weekendOwners.forEach((item, index) => {
    const previous = weekendOwners[index - 1];
    if (previous?.owner === item.owner) {
      add("warning", "Week-end repete", `${auxName(auxiliaries, item.owner)} est place(e) deux week-ends de suite (${previous.day} et ${item.day} ${MONTHS[month]}).`);
    }
  });

  active
    .filter(aux => aux.shift !== "night")
    .filter(aux => weekendOwners.some(({ day }) =>
      canWorkShift(aux, "afternoon", year, month, day) || canWorkShift(aux, "morning", year, month, day + 1)))
    .filter(aux => (weekendOwnerCount[aux.id] || 0) === 0)
    .forEach(aux => add("info", "Week-end absent du tour", `${aux.name} peut faire un week-end mais n'en a pas encore dans ${MONTHS[month]}.`));

  const maxStreak = Math.max(2, Number(rotationDays) || 1);
  let currentOwner = "";
  let streakStart = 0;
  let streak = 0;
  for (let day = 1; day <= totalDays + 1; day += 1) {
    const owner = day <= totalDays ? (primary(schedule[day]?.afternoon) || primary(schedule[day]?.morning)) : "";
    if (owner && owner === currentOwner) {
      streak += 1;
      continue;
    }
    if (currentOwner && streak > maxStreak) {
      add("warning", "Tour trop long", `${auxName(auxiliaries, currentOwner)} revient ${streak} jours de suite du ${streakStart} au ${streakStart + streak - 1}.`);
    }
    currentOwner = owner;
    streakStart = day;
    streak = owner ? 1 : 0;
  }

  const fairTeam = active.filter(aux => aux.shift !== "night" && !aux.coverage);
  if (fairTeam.length >= 2) {
    const values = fairTeam.map(aux => ({ aux, total: mainCount[aux.id] || 0 }));
    const max = values.reduce((a, b) => (b.total > a.total ? b : a), values[0]);
    const min = values.reduce((a, b) => (b.total < a.total ? b : a), values[0]);
    if (max.total - min.total >= 4) {
      add("info", "Repartition a surveiller", `${max.aux.name} a ${max.total} jours principaux, ${min.aux.name} en a ${min.total}.`);
    }
  }

  if (!checks.length) {
    return [{ level: "ok", title: "Roulement coherent", detail: "Aucun point bloquant detecte sur le mois affiche." }];
  }
  return checks;
}
