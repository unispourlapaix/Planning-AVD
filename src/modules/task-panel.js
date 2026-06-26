import React from "react";
import { Button, h, Select, TextInput } from "../ui.js";
import {
  buildGoogleCalendarUrl,
  createTask,
  deleteTask,
  setTaskCompleted,
  subscribeTasks,
  taskScheduleLabel,
} from "./tasks.js?v=20260626-task-calendar";

const { useEffect, useState } = React;

const PRIORITY_LABELS = {
  normal: "Normale",
  important: "Importante",
  urgent: "Urgente",
};

const SCHEDULE_LABELS = {
  none: "Sans creneau",
  "month-start": "Debut du mois",
  "month-end": "Fin du mois",
  day: "Jour",
  datetime: "Jour + heure",
  range: "Periode",
};

const pad = value => String(value).padStart(2, "0");

const openExternalUrl = url => {
  if (!url) return;
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) window.location.href = url;
};

function monthDateValue(year, month, day = 1) {
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function normalizeWorkers({ auxiliaries = [], user, isAdmin }) {
  const workers = auxiliaries
    .map((aux, index) => ({
      key: String(aux.email || aux.id || aux.name || `aux-${index}`).toLowerCase(),
      name: String(aux.name || aux.email || `Auxiliaire ${index + 1}`).trim(),
      email: String(aux.email || "").trim().toLowerCase(),
    }))
    .filter(worker => worker.name);
  if (!workers.length || !isAdmin) {
    const email = String(user?.email || "").trim().toLowerCase();
    const name = String(user?.displayName || user?.email || "").trim();
    if (email && !workers.some(worker => worker.email === email)) {
      workers.unshift({ key: `self-${email}`, name, email });
    }
  }
  return workers;
}

export function TaskPanel({ authState, isAdmin = false, auxiliaries = [], year, month, beneficiaryId = "", canContribute = true }) {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("normal");
  const [assignedKey, setAssignedKey] = useState("");
  const [scheduleMode, setScheduleMode] = useState("none");
  const [taskDate, setTaskDate] = useState(() => monthDateValue(year, month));
  const [taskTime, setTaskTime] = useState("09:00");
  const [taskEndDate, setTaskEndDate] = useState(() => monthDateValue(year, month));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authState.db || !authState.user) {
      setTasks([]);
      return;
    }
    setError("");
    return subscribeTasks({
      db: authState.db,
      user: authState.user,
      beneficiaryId,
      onChange: setTasks,
      onError: nextError => setError(`Liste indisponible : ${nextError.message}`),
    });
  }, [authState.db, authState.user, beneficiaryId]);

  useEffect(() => {
    const nextDate = monthDateValue(year, month);
    setTaskDate(current => current || nextDate);
    setTaskEndDate(current => current || nextDate);
  }, [year, month]);

  if (!authState.user) return null;

  const workerOptions = normalizeWorkers({ auxiliaries, user: authState.user, isAdmin });
  const selectedWorker = workerOptions.find(worker => worker.key === assignedKey) || null;
  const showDate = ["day", "datetime", "range"].includes(scheduleMode);
  const showTime = scheduleMode === "datetime";
  const showEndDate = scheduleMode === "range";

  const addTask = async () => {
    if (!canContribute || !title.trim() || saving) return;
    setSaving(true);
    try {
      await createTask({
        db: authState.db,
        user: authState.user,
        beneficiaryId,
        title,
        priority,
        assignedName: selectedWorker?.name || "",
        assignedEmail: selectedWorker?.email || "",
        scheduleMode,
        date: taskDate,
        time: taskTime,
        endDate: taskEndDate,
      });
      setTitle("");
      setPriority("normal");
      setAssignedKey("");
      setScheduleMode("none");
    } catch (nextError) {
      setError(`Ajout impossible : ${nextError.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = async task => {
    if (!canContribute) return;
    try {
      await setTaskCompleted({ db: authState.db, user: authState.user, task, completed: !task.completed });
    } catch (nextError) {
      setError(`Modification impossible : ${nextError.message}`);
    }
  };

  const removeTask = async task => {
    if (!isAdmin || !window.confirm(`Supprimer la tache "${task.title}" ?`)) return;
    try {
      await deleteTask({ db: authState.db, user: authState.user, task });
    } catch (nextError) {
      setError(`Suppression impossible : ${nextError.message}`);
    }
  };

  return h("section", { className: "panel task-panel" },
    h("div", { className: "title-row" },
      h("div", null,
        h("h3", null, "Taches a faire"),
        h("div", { className: "muted" }, canContribute
          ? `${tasks.filter(task => !task.completed).length} restante(s) · attribution, creneau et export Google Agenda.`
          : `${tasks.filter(task => !task.completed).length} restante(s) · consultation seule.`),
      ),
    ),
    canContribute ? h("div", { className: "task-form" },
      h(TextInput, {
        value: title,
        maxLength: 160,
        placeholder: "Ajouter une tache...",
        onChange: setTitle,
        onKeyDown: event => {
          if (event.key === "Enter") addTask();
        },
      }),
      h(Select, { value: assignedKey, onChange: setAssignedKey, title: "Auxiliaire" },
        h("option", { value: "" }, "Pour qui ?"),
        workerOptions.map(worker => h("option", { key: worker.key, value: worker.key }, worker.name)),
      ),
      h(Select, { value: priority, onChange: setPriority, title: "Priorite" },
        h("option", { value: "normal" }, "Normale"),
        h("option", { value: "important" }, "Importante"),
        h("option", { value: "urgent" }, "Urgente"),
      ),
      h(Select, { value: scheduleMode, onChange: setScheduleMode, title: "Creneau" },
        Object.entries(SCHEDULE_LABELS).map(([value, label]) => h("option", { key: value, value }, label)),
      ),
      showDate ? h(TextInput, {
        type: "date",
        className: "task-date-input",
        value: taskDate,
        onChange: value => {
          setTaskDate(value);
          setTaskEndDate(current => current || value);
        },
        title: "Jour",
      }) : null,
      showTime ? h(TextInput, {
        type: "time",
        className: "task-time-input",
        value: taskTime,
        onChange: setTaskTime,
        title: "Heure",
      }) : null,
      showEndDate ? h(TextInput, {
        type: "date",
        className: "task-date-input",
        value: taskEndDate,
        onChange: setTaskEndDate,
        title: "Fin",
      }) : null,
      h(Button, { active: true, disabled: saving || !title.trim(), onClick: addTask }, saving ? "Ajout..." : "Ajouter"),
    ) : null,
    error ? h("div", { className: "task-error" }, error) : null,
    tasks.length
      ? h("div", { className: "task-list" }, tasks.map(task => {
          const calendarUrl = buildGoogleCalendarUrl(task, { year, month });
          const meta = [
            task.assignedName ? `Pour ${task.assignedName}` : "",
            taskScheduleLabel(task, { year, month }),
            `Ajoutee par ${task.createdByName || task.createdByEmail || "un auxiliaire"}`,
          ].filter(Boolean).join(" · ");
          return h("article", {
            key: task.id,
            className: `task-item priority-${task.priority || "normal"}${task.completed ? " completed" : ""}`,
          },
          h("label", { className: "task-check" },
            h("input", { type: "checkbox", checked: !!task.completed, disabled: !canContribute, onChange: () => toggleTask(task) }),
            h("span", { className: "task-main" },
              h("b", null, task.title),
              h("small", null, meta),
            ),
          ),
          h("div", { className: "task-actions" },
            h("span", { className: `task-priority ${task.priority || "normal"}` }, PRIORITY_LABELS[task.priority] || PRIORITY_LABELS.normal),
            calendarUrl ? h(Button, {
              className: "task-calendar-link",
              title: "Exporter vers Google Agenda",
              onClick: () => openExternalUrl(calendarUrl),
            }, "Agenda") : null,
            isAdmin ? h(Button, { className: "task-delete", title: "Supprimer la tache", onClick: () => removeTask(task) }, "Supprimer") : null,
          ),
        );
      }))
      : h("div", { className: "task-empty" }, "Aucune tache pour le moment."),
  );
}
