import { slotHours } from "./shift-hours.js?v=20260722-custom-hours";

const shiftWorkerIds = entry =>
  Array.isArray(entry?.workers) ? entry.workers.filter(Boolean) : (entry?.worker ? [entry.worker] : []);

const primaryWorker = entry => shiftWorkerIds(entry)[0] || "";

const hasShift = ({ entriesByDay = {}, day, shift }) =>
  (entriesByDay[Number(day)] || []).some(entry => entry.shift === shift);

const personalEntryForShift = ({ entriesByDay = {}, day, shift }) =>
  (entriesByDay[Number(day)] || []).find(entry => entry.shift === shift) || null;

const hadPersonalNightBefore = ({ entriesByDay = {}, day }) =>
  Number(day) > 1 && hasShift({ entriesByDay, day: Number(day) - 1, shift: "night" });

const hadWorkerNightBefore = ({ schedule = {}, day, worker }) =>
  Number(day) > 1 && !!worker && shiftWorkerIds(schedule?.[Number(day) - 1]?.night).includes(worker);

const sameWorkerContinuesDay = ({ schedule = {}, day, worker }) =>
  !!worker && primaryWorker(schedule?.[Number(day)]?.afternoon) === worker;

const pauseNoticeForHours = totalHours => {
  if (totalHours >= 12) return {
    type: "pause",
    label: "Pause 30 min",
    blocking: false,
    title: "Journée de 12h : pause de journée à prévoir.",
  };
  if (totalHours > 6) return {
    type: "pause",
    label: "Pause 20 min",
    blocking: false,
    title: "Plus de 6h de travail : pause minimale à prévoir.",
  };
  return null;
};

export function breakNoticeForSlot({ shift, schedule = {}, day, worker } = {}) {
  if (!worker) return null;
  if (hadWorkerNightBefore({ schedule, day, worker })) {
    return {
      type: "rest",
      label: "Repos conseillé",
      blocking: false,
      title: "Annonce uniquement : repos conseillé après surveillance de nuit, placement admin autorisé.",
    };
  }
  if (shift === "morning") {
    const fullDay = sameWorkerContinuesDay({ schedule, day, worker });
    const morningHours = slotHours(schedule?.[Number(day)]?.morning, "morning");
    const afternoonHours = fullDay ? slotHours(schedule?.[Number(day)]?.afternoon, "afternoon") : 0;
    return pauseNoticeForHours(morningHours + afternoonHours);
  }
  if (shift === "night") {
    return {
      type: "rest",
      label: "Repos à prévoir",
      blocking: false,
      title: "Annonce uniquement : prévoir le repos après la nuit, sans bloquer l'admin.",
    };
  }
  if (shift === "afternoon") {
    return pauseNoticeForHours(slotHours(schedule?.[Number(day)]?.afternoon, "afternoon"));
  }
  return null;
}

export function personalBreakNoticeForSlot({ shift, entriesByDay = {}, day } = {}) {
  const entry = personalEntryForShift({ entriesByDay, day, shift });
  if (!entry) return null;
  if (entry.notice) return entry.notice;
  if (hadPersonalNightBefore({ entriesByDay, day })) {
    return {
      type: "rest",
      label: "Repos conseillé",
      blocking: false,
      title: "Annonce uniquement : repos conseillé après surveillance de nuit.",
    };
  }
  if (shift === "morning") {
    const fullDay = hasShift({ entriesByDay, day, shift: "afternoon" });
    return {
      type: "pause",
      label: fullDay ? "Pause 30 min" : "Pause 20 min",
      blocking: false,
      title: fullDay
        ? "Journée complète : pause de journée à prévoir."
        : "Créneau du matin : pause à prévoir si le créneau dépasse 6h.",
    };
  }
  if (shift === "night") {
    return {
      type: "rest",
      label: "Repos à prévoir",
      blocking: false,
      title: "Annonce uniquement : prévoir le repos après la nuit.",
    };
  }
  return null;
}
