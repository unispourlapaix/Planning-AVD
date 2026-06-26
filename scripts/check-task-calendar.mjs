import {
  buildGoogleCalendarUrl,
  normalizeTaskSchedule,
  taskScheduleLabel,
} from "../src/modules/tasks.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const baseTask = {
  title: "Courses pharmacie",
  priority: "important",
  assignedName: "Sarah",
  createdByName: "Admin",
};

const urlFor = task => buildGoogleCalendarUrl(task, { year: 2026, month: 5 });

const startMonth = urlFor({ ...baseTask, scheduleMode: "month-start" });
assert(startMonth.includes("dates=20260601%2F20260602"), "Debut du mois incorrect dans Google Agenda");

const endMonth = urlFor({ ...baseTask, scheduleMode: "month-end" });
assert(endMonth.includes("dates=20260630%2F20260701"), "Fin du mois incorrecte dans Google Agenda");

const day = urlFor({ ...baseTask, scheduleMode: "day", scheduleDate: "2026-06-12" });
assert(day.includes("dates=20260612%2F20260613"), "Jour simple incorrect dans Google Agenda");

const datetime = urlFor({ ...baseTask, scheduleMode: "datetime", scheduleDate: "2026-06-12", scheduleTime: "17:30" });
assert(datetime.includes("dates=20260612T173000%2F20260612T183000"), "Jour + heure incorrect dans Google Agenda");

const range = urlFor({ ...baseTask, scheduleMode: "range", scheduleDate: "2026-06-03", scheduleEndDate: "2026-06-05" });
assert(range.includes("dates=20260603%2F20260606"), "Periode incorrecte dans Google Agenda");

const normalized = normalizeTaskSchedule({ scheduleMode: "datetime", date: "2026-06-01", time: "25:99" });
assert(normalized.scheduleTime === "09:00", "Heure invalide non normalisee");
assert(taskScheduleLabel({ ...baseTask, ...normalized }, { year: 2026, month: 5 }).includes("09:00"), "Libelle horaire absent");

console.log("Controle taches OK: attribution et export Google Agenda coherents");
