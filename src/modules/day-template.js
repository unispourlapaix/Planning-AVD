export const DAY_TEMPLATE = [
  { id: "morning", label: "Matin", hours: 5 },
  { id: "afternoon", label: "Après-midi", hours: 5 },
  { id: "bedtime", label: "Mise au lit", hours: 2 },
];

export function applyDayTemplate({ year, month, day, workers, overrides = {}, hourOverrides = {} }) {
  if (!DAY_TEMPLATE.every(slot => typeof workers[slot.id] === "string" && workers[slot.id].trim())) throw new Error("Choisissez les trois intervenants.");
  const assignments = { ...overrides };
  const hours = { ...hourOverrides };
  for (const slot of DAY_TEMPLATE) {
    const key = `${year}-${month}-${day}-${slot.id}`;
    assignments[key] = workers[slot.id];
    // Remove old individual durations and reinforcements only on the replaced slots.
    for (const hourKey of Object.keys(hours)) if (hourKey === key || hourKey.startsWith(`${key}::`)) delete hours[hourKey];
    hours[key] = slot.hours;
  }
  return { overrides: assignments, hourOverrides: hours };
}
