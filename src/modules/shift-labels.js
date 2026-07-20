const FALLBACK_LABELS = {
  morning: "Matin 7h30",
  afternoon: "Après-midi 17h",
  night: "Soir",
};

export const primaryShiftWorkerId = entry => {
  if (Array.isArray(entry?.workers)) return entry.workers.filter(Boolean)[0] || "";
  return entry?.worker || "";
};

const firstSharedName = entry => {
  if (Array.isArray(entry)) return String(entry.filter(Boolean)[0] || "").trim();
  if (Array.isArray(entry?.workers)) return String(entry.workers.filter(Boolean)[0] || "").trim();
  if (Array.isArray(entry?.names)) return String(entry.names.filter(Boolean)[0] || "").trim();
  return String(entry?.worker || entry?.name || "").trim();
};

export const hasNightHandover = ({ schedule = {}, day }) => {
  if (Number(day) <= 1) return false;
  return !!primaryShiftWorkerId(schedule?.[Number(day) - 1]?.night);
};

export const hasPersonalNightHandover = ({ entriesByDay = {}, day }) => {
  if (Number(day) <= 1) return false;
  const previousEntries = entriesByDay[Number(day) - 1] || [];
  const currentEntries = entriesByDay[Number(day)] || [];
  return currentEntries.some(entry => entry.shift === "morning")
    && previousEntries.some(entry => entry.shift === "night");
};

export const hasSharedNightHandover = ({ calendarByDay = {}, day, name }) => {
  if (Number(day) <= 1) return false;
  const currentName = String(name || firstSharedName(calendarByDay?.[day]?.shifts?.morning) || "").trim();
  return !!currentName && !!firstSharedName(calendarByDay?.[Number(day) - 1]?.shifts?.night);
};

export const shiftDisplayLabel = ({ shift, schedule, entriesByDay, calendarByDay, day, worker, name } = {}) => {
  if (shift === "morning") {
    const lateStart = hasNightHandover({ schedule, day, worker })
      || hasPersonalNightHandover({ entriesByDay, day })
      || hasSharedNightHandover({ calendarByDay, day, name });
    return lateStart ? "Matin 11h" : "Matin 7h30";
  }
  return FALLBACK_LABELS[shift] || shift;
};
