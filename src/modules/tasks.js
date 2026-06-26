const taskCollection = db => db.collection("planning-avd-tasks");

const priorityRank = { urgent: 0, important: 1, normal: 2 };
const allowedPriorities = ["normal", "important", "urgent"];
const allowedScheduleModes = ["none", "month-start", "month-end", "day", "datetime", "range"];

const pad = value => String(value).padStart(2, "0");
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const cleanText = (value, max = 160) => String(value || "").trim().slice(0, max);
const cleanEmail = value => String(value || "").trim().toLowerCase().slice(0, 120);

function parseDateKey(value) {
  const match = String(value || "").match(datePattern);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

function dateKeyFromParts(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function dateKeyForMonthDay(year, zeroBasedMonth, day) {
  return dateKeyFromParts(year, zeroBasedMonth + 1, day);
}

function addDays(dateKey, days) {
  const parts = parseDateKey(dateKey);
  if (!parts) return "";
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return dateKeyFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function addMinutes(dateKey, time, minutes) {
  const parts = parseDateKey(dateKey);
  const cleanTime = timePattern.test(time) ? time : "09:00";
  if (!parts) return { date: "", time: cleanTime };
  const [hour, minute] = cleanTime.split(":").map(Number);
  const date = new Date(parts.year, parts.month - 1, parts.day, hour, minute + minutes, 0);
  return {
    date: dateKeyFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate()),
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function compactDate(dateKey) {
  return String(dateKey || "").replaceAll("-", "");
}

function compactDateTime(dateKey, time) {
  return `${compactDate(dateKey)}T${String(time || "09:00").replace(":", "")}00`;
}

function prettyDate(dateKey) {
  const parts = parseDateKey(dateKey);
  if (!parts) return "";
  return `${pad(parts.day)}/${pad(parts.month)}/${parts.year}`;
}

function currentMonthFallback(options = {}) {
  const now = new Date();
  return {
    year: Number.isInteger(options.year) ? options.year : now.getFullYear(),
    month: Number.isInteger(options.month) ? options.month : now.getMonth(),
  };
}

function scheduleSortValue(task) {
  const mode = task.scheduleMode || "none";
  if (mode === "month-start") return "0000-00-01";
  if (mode === "month-end") return "9998-12-31";
  return task.scheduleDate || "9999-99-99";
}

const sortTasks = tasks => tasks.sort((a, b) =>
  Number(a.completed) - Number(b.completed)
  || (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2)
  || scheduleSortValue(a).localeCompare(scheduleSortValue(b))
  || Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0));

export function normalizeTaskSchedule({ scheduleMode = "none", date = "", time = "", endDate = "" } = {}) {
  const mode = allowedScheduleModes.includes(scheduleMode) ? scheduleMode : "none";
  const cleanDate = parseDateKey(date) ? date : "";
  const cleanEndDate = parseDateKey(endDate) ? endDate : "";
  const cleanTime = timePattern.test(time) ? time : "09:00";

  if (mode === "month-start" || mode === "month-end") {
    return { scheduleMode: mode, scheduleDate: "", scheduleTime: "", scheduleEndDate: "" };
  }
  if (mode === "day") {
    return cleanDate
      ? { scheduleMode: mode, scheduleDate: cleanDate, scheduleTime: "", scheduleEndDate: "" }
      : { scheduleMode: "none", scheduleDate: "", scheduleTime: "", scheduleEndDate: "" };
  }
  if (mode === "datetime") {
    return cleanDate
      ? { scheduleMode: mode, scheduleDate: cleanDate, scheduleTime: cleanTime, scheduleEndDate: "" }
      : { scheduleMode: "none", scheduleDate: "", scheduleTime: "", scheduleEndDate: "" };
  }
  if (mode === "range") {
    return cleanDate
      ? { scheduleMode: mode, scheduleDate: cleanDate, scheduleTime: "", scheduleEndDate: cleanEndDate || cleanDate }
      : { scheduleMode: "none", scheduleDate: "", scheduleTime: "", scheduleEndDate: "" };
  }
  return { scheduleMode: "none", scheduleDate: "", scheduleTime: "", scheduleEndDate: "" };
}

export function resolveTaskCalendarSlot(task, options = {}) {
  const { year, month } = currentMonthFallback(options);
  const mode = task?.scheduleMode || "none";
  if (mode === "month-start") {
    const date = dateKeyForMonthDay(year, month, 1);
    return { label: `Debut du mois · ${prettyDate(date)}`, googleDates: `${compactDate(date)}/${compactDate(addDays(date, 1))}` };
  }
  if (mode === "month-end") {
    const day = new Date(year, month + 1, 0).getDate();
    const date = dateKeyForMonthDay(year, month, day);
    return { label: `Fin du mois · ${prettyDate(date)}`, googleDates: `${compactDate(date)}/${compactDate(addDays(date, 1))}` };
  }
  if (mode === "day" && parseDateKey(task.scheduleDate)) {
    return {
      label: `Jour · ${prettyDate(task.scheduleDate)}`,
      googleDates: `${compactDate(task.scheduleDate)}/${compactDate(addDays(task.scheduleDate, 1))}`,
    };
  }
  if (mode === "datetime" && parseDateKey(task.scheduleDate)) {
    const startTime = timePattern.test(task.scheduleTime) ? task.scheduleTime : "09:00";
    const end = addMinutes(task.scheduleDate, startTime, 60);
    return {
      label: `${prettyDate(task.scheduleDate)} · ${startTime}`,
      googleDates: `${compactDateTime(task.scheduleDate, startTime)}/${compactDateTime(end.date, end.time)}`,
    };
  }
  if (mode === "range" && parseDateKey(task.scheduleDate)) {
    const endDate = parseDateKey(task.scheduleEndDate) ? task.scheduleEndDate : task.scheduleDate;
    return {
      label: `${prettyDate(task.scheduleDate)} -> ${prettyDate(endDate)}`,
      googleDates: `${compactDate(task.scheduleDate)}/${compactDate(addDays(endDate, 1))}`,
    };
  }
  return null;
}

export function taskScheduleLabel(task, options = {}) {
  return resolveTaskCalendarSlot(task, options)?.label || "";
}

export function buildGoogleCalendarUrl(task, options = {}) {
  const slot = resolveTaskCalendarSlot(task, options);
  if (!slot) return "";
  const title = cleanText(task?.title, 120) || "Tache Planning-AVD";
  const details = [
    task?.assignedName ? `Auxiliaire : ${task.assignedName}` : "",
    task?.priority ? `Priorite : ${task.priority}` : "",
    task?.createdByName || task?.createdByEmail ? `Ajoutee par : ${task.createdByName || task.createdByEmail}` : "",
  ].filter(Boolean).join("\n");
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", title);
  url.searchParams.set("dates", slot.googleDates);
  if (details) url.searchParams.set("details", details);
  return url.toString();
}

export function subscribeTasks({ db, user, onChange, onError }) {
  if (!db || !user?.uid) return () => {};
  return taskCollection(db)
    .orderBy("createdAt", "desc")
    .limit(200)
    .onSnapshot(snapshot => {
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      onChange?.(sortTasks(tasks));
    }, error => onError?.(error));
}

export async function createTask({
  db,
  user,
  title,
  priority,
  assignedName = "",
  assignedEmail = "",
  scheduleMode = "none",
  date = "",
  time = "",
  endDate = "",
}) {
  const cleanTitle = cleanText(title, 160);
  if (!db || !user?.uid || !user?.email) throw new Error("Connexion necessaire.");
  if (!cleanTitle) throw new Error("Ecrivez la tache a ajouter.");
  const cleanPriority = allowedPriorities.includes(priority) ? priority : "normal";
  const requestedSchedule = allowedScheduleModes.includes(scheduleMode) ? scheduleMode : "none";
  const schedule = normalizeTaskSchedule({ scheduleMode: requestedSchedule, date, time, endDate });
  if (requestedSchedule !== "none" && schedule.scheduleMode === "none") throw new Error("Choisissez une date valide pour le creneau.");

  await taskCollection(db).add({
    title: cleanTitle,
    priority: cleanPriority,
    assignedName: cleanText(assignedName, 80),
    assignedEmail: cleanEmail(assignedEmail),
    ...schedule,
    completed: false,
    createdByUid: user.uid,
    createdByEmail: String(user.email).trim().toLowerCase(),
    createdByName: String(user.displayName || user.email).trim(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

export async function setTaskCompleted({ db, user, task, completed }) {
  if (!db || !user?.uid || !task?.id) throw new Error("Tache introuvable.");
  await taskCollection(db).doc(task.id).update({
    completed: !!completed,
    completedBy: String(user.email || "").trim().toLowerCase(),
    completedAt: completed ? firebase.firestore.FieldValue.serverTimestamp() : null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

export async function deleteTask({ db, user, task }) {
  if (!db || !user?.uid || !task?.id) throw new Error("Tache introuvable.");
  await taskCollection(db).doc(task.id).delete();
}
