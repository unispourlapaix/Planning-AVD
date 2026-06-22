import React from "react";
import { Button, h, Select, TextInput } from "../ui.js";
import { createTask, deleteTask, setTaskCompleted, subscribeTasks } from "./tasks.js";

const { useEffect, useState } = React;

const PRIORITY_LABELS = {
  normal: "Normale",
  important: "Importante",
  urgent: "Urgente",
};

export function TaskPanel({ authState, isAdmin = false }) {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("normal");
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
      onChange: setTasks,
      onError: nextError => setError(`Liste indisponible : ${nextError.message}`),
    });
  }, [authState.db, authState.user]);

  if (!authState.user) return null;

  const addTask = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await createTask({ db: authState.db, user: authState.user, title, priority });
      setTitle("");
      setPriority("normal");
    } catch (nextError) {
      setError(`Ajout impossible : ${nextError.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = async task => {
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
        h("div", { className: "muted" }, `${tasks.filter(task => !task.completed).length} restante(s) · chacun peut ajouter, seul l'admin supprime.`),
      ),
    ),
    h("div", { className: "task-form" },
      h(TextInput, {
        value: title,
        maxLength: 160,
        placeholder: "Ajouter une tache...",
        onChange: setTitle,
        onKeyDown: event => {
          if (event.key === "Enter") addTask();
        },
      }),
      h(Select, { value: priority, onChange: setPriority, title: "Priorite" },
        h("option", { value: "normal" }, "Normale"),
        h("option", { value: "important" }, "Importante"),
        h("option", { value: "urgent" }, "Urgente"),
      ),
      h(Button, { active: true, disabled: saving || !title.trim(), onClick: addTask }, saving ? "Ajout..." : "Ajouter"),
    ),
    error ? h("div", { className: "task-error" }, error) : null,
    tasks.length
      ? h("div", { className: "task-list" }, tasks.map(task => h("article", {
          key: task.id,
          className: `task-item priority-${task.priority || "normal"}${task.completed ? " completed" : ""}`,
        },
        h("label", { className: "task-check" },
          h("input", { type: "checkbox", checked: !!task.completed, onChange: () => toggleTask(task) }),
          h("span", { className: "task-main" },
            h("b", null, task.title),
            h("small", null, `Ajoutee par ${task.createdByName || task.createdByEmail || "un auxiliaire"}`),
          ),
        ),
        h("span", { className: `task-priority ${task.priority || "normal"}` }, PRIORITY_LABELS[task.priority] || PRIORITY_LABELS.normal),
        isAdmin ? h(Button, { className: "task-delete", title: "Supprimer la tache", onClick: () => removeTask(task) }, "Supprimer") : null,
      )))
      : h("div", { className: "task-empty" }, "Aucune tache pour le moment."),
  );
}
