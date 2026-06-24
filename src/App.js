import React from "react";
import { DEFAULT_AUXILIARIES, DAYS_SHORT, MAX_AUXILIARIES, MONTHS, PALETTE, SHIFT_DEFS, SHIFT_LABEL } from "./modules/constants.js";
import { dayName, monthGrid, weekStarts } from "./modules/dates.js";
import { buildSchedule, canWorkShift } from "./modules/scheduler-handover.js?v=20260607-weekend-one";
import { initGoogleAuth, signInWithGoogle, signOut } from "./modules/auth.js";
import {
  createPlanningChangeRequest,
  defaultState,
  grantAdminByEmail,
  isAdminUser,
  loadState,
  publishPersonalPlannings,
  resolvePlanningChangeRequest,
  saveState,
  subscribeAdminChangeRequests,
  subscribePersonalChangeRequests,
  subscribePersonalPlanning,
} from "./modules/storage.js?v=20260624-admin-email-field";
import { buildCleanPlanningHtml } from "./modules/clean-planning.js";
import { buildManualOverrideList, manualOverrideKey } from "./modules/manual-overrides.js";
import { buildReportHtml } from "./modules/report.js";
import { buildRotationAudit } from "./modules/rotation-audit.js";
import { calculatePerformedHours, summarizeHours } from "./modules/hour-accounting.js";
import { mealForDate, mealWeekForDate, shoppingListText, WEEKLY_SHOPPING } from "./modules/meal-planning.js";
import { TaskPanel } from "./modules/task-panel.js";
import { Button, Checkbox, Field, h, Select, TextInput } from "./ui.js";

const { useEffect, useMemo, useState } = React;

const ROTATION_OPTIONS = [
  { value: 1, label: "Jour par jour", detail: "Matin, apres-midi et nuit recalcules chaque jour." },
  { value: 2, label: "Roulement 2 jours", detail: "La personne finit le matin, la suivante commence l'apres-midi." },
  { value: 3, label: "Roulement 3 jours", detail: "Bloc plus stable, toujours termine au matin." },
  { value: 4, label: "Roulement 4 jours", detail: "Longue presence, passage au suivant apres le matin." },
];
const SHIFT_COMPACT_LABEL = { morning: "AM", afternoon: "PM", night: "SR" };
const PLANNING_TEXT_COLORS = ["#5689C9", "#D46AA8", "#5BA58D", "#9274C9", "#CF7B6D", "#4C9EA8", "#BA72B4", "#7D9B55"];
const ICON_PATHS = {
  calendar: ["M7 3v4M17 3v4M4 9h16M6 5h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z"],
  week: ["M4 5h16M4 12h16M4 19h16M8 5v14M16 5v14"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2"],
  settings: ["M4 7h10M18 7h2M4 17h2M10 17h10M8 14v6M16 4v6"],
  file: ["M6 3h8l4 4v14H6V3ZM14 3v5h5M8 13h8M8 17h6"],
  sparkles: ["M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15ZM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7L5 14Z"],
  save: ["M5 4h12l2 2v14H5V4ZM8 4v6h8V4M8 20v-6h8v6"],
  restore: ["M4 7v6h6M5 13a7 7 0 1 0 2-7"],
  cloud: ["M7 18a4 4 0 0 1 .7-7.9A6 6 0 0 1 19 12a3 3 0 0 1 0 6H7ZM10 15l2 2 4-5"],
  login: ["M10 17l5-5-5-5M15 12H3M21 5v14"],
  logout: ["M14 17l5-5-5-5M19 12H7M3 5v14"],
  print: ["M7 8V3h10v5M7 17H5a3 3 0 0 1 0-6h14a3 3 0 0 1 0 6h-2M7 14h10v7H7v-7Z"],
  meal: ["M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M15 3v18M15 3c4 2 5 8 0 11"],
  copy: ["M9 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2M5 7h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"],
  chevronLeft: ["M15 6l-6 6 6 6"],
  chevronRight: ["M9 6l6 6-6 6"],
  close: ["M6 6l12 12M18 6L6 18"],
};
const dayTone = (year, month, day) => {
  const index = new Date(year, month, day).getDay();
  return index === 6 ? " saturday" : index === 0 ? " sunday" : "";
};
function Icon({ name }) {
  return h("svg", {
    className: "icon",
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
  }, (ICON_PATHS[name] || []).map((d, index) => h("path", { key: index, d })));
}
function IconLabel({ icon, label }) {
  return h(React.Fragment, null, h(Icon, { name: icon }), h("span", null, label));
}

function MealTag({ year, month, day, onOpen }) {
  const meal = mealForDate(year, month, day);
  return h("button", {
    className: "meal-tag",
    type: "button",
    title: `Repas : ${meal.title}`,
    onClick: () => onOpen?.({ year, month, day }),
  }, h(Icon, { name: "meal" }), h("span", null, meal.short));
}

function MealPlannerModal({ selectedDate, onClose }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const week = selectedDate ? mealWeekForDate(selectedDate.year, selectedDate.month, selectedDate.day) : [];
  useEffect(() => {
    if (!selectedDate || !week.length) return;
    const selectedKey = `${selectedDate.year}-${selectedDate.month}-${selectedDate.day}`;
    setSelectedIndex(Math.max(0, week.findIndex(item => item.dateKey === selectedKey)));
  }, [selectedDate?.year, selectedDate?.month, selectedDate?.day]);
  if (!selectedDate) return null;
  const meal = week[selectedIndex] || week[0];
  const copyShopping = async () => {
    await navigator.clipboard?.writeText(shoppingListText(week));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return h("div", { className: "modal-backdrop", onClick: onClose },
    h("section", { className: "meal-planner", onClick: event => event.stopPropagation() },
      h("div", { className: "title-row" },
        h("div", null,
          h("h3", null, "Repas et courses de la semaine"),
          h("div", { className: "muted" }, "Rotation sur 7 jours · quantites pour environ 4 personnes"),
        ),
        h(Button, { className: "icon-btn", title: "Fermer", onClick: onClose }, h(Icon, { name: "close" })),
      ),
      h("div", { className: "meal-week-tabs" }, week.map((item, index) => h("button", {
        className: `meal-day-tab${index === selectedIndex ? " active" : ""}`,
        key: item.dateKey,
        onClick: () => setSelectedIndex(index),
      }, h("b", null, item.dayName.slice(0, 3)), h("span", null, item.short)))),
      h("div", { className: "meal-planner-grid" },
        h("article", { className: "recipe-card" },
          h("div", { className: "recipe-date" }, `${meal.dayName} ${meal.day}/${meal.month + 1}`),
          h("h3", null, meal.title),
          h("h4", null, "Ingredients"),
          h("ul", null, meal.ingredients.map(item => h("li", { key: item }, item))),
          h("h4", null, "Recette"),
          h("ol", null, meal.steps.map(item => h("li", { key: item }, item))),
        ),
        h("aside", { className: "shopping-card" },
          h("div", { className: "title-row" },
            h("h3", null, "Courses de la semaine"),
            h(Button, { onClick: copyShopping }, h(IconLabel, { icon: "copy", label: copied ? "Copiee" : "Copier" })),
          ),
          h("div", { className: "shopping-groups" }, WEEKLY_SHOPPING.map(group => h("section", { key: group.category },
            h("h4", null, group.category),
            h("ul", null, group.items.map(item => h("li", { key: item }, item))),
          ))),
        ),
      ),
    ),
  );
}

const cloneDefaultAux = () => DEFAULT_AUXILIARIES.map(aux => ({ ...aux, customDays: [...aux.customDays] }));
const normalizeAuxiliaries = (saved) => {
  const defaults = cloneDefaultAux();
  if (Array.isArray(saved?.auxiliaries)) {
    return saved.auxiliaries.map((aux, index) => {
      const base = defaults[index] || {
        ...defaults[0],
        id: aux?.id || `P${index + 1}`,
        name: `Auxiliaire ${index + 1}`,
        lead: false,
        night: false,
      };
      return {
        ...base,
        ...aux,
        id: aux?.id || base.id,
        name: (aux?.name || saved?.names?.[aux?.id] || base.name || `Auxiliaire ${index + 1}`).trim(),
        active: aux?.active !== false,
        coverage: aux?.coverage ?? /^marie\b/i.test(aux?.name || ""),
        customDays: Array.isArray(aux?.customDays) ? aux.customDays : base.customDays,
      };
    });
  }
  if (saved?.names && typeof saved.names === "object") {
    return defaults.map(aux => ({ ...aux, name: saved.names[aux.id] || aux.name }));
  }
  return defaults;
};
const colorFor = index => PALETTE[index % PALETTE.length];
const auxName = (auxiliaries, id) => {
  const index = auxiliaries.findIndex(aux => aux.id === id);
  const aux = auxiliaries[index];
  return aux?.name || `Auxiliaire ${index >= 0 ? index + 1 : ""}`.trim() || "A definir";
};
const planningNames = (auxiliaries, ids) => ids
  .map((id, index) => {
    const name = auxName(auxiliaries, id);
    return index === 0 ? name : name.trim().charAt(0).toUpperCase();
  })
  .join(" + ");
const shiftWorkerIds = entry => Array.isArray(entry?.workers) ? entry.workers.filter(Boolean) : (entry?.worker ? [entry.worker] : []);
const displayHours = summarizeHours;
const overrideKey = manualOverrideKey;
const requestSlotKey = (day, shift) => `${day}-${shift}`;
const requestStatusLabel = status => ({
  pending: "En attente",
  approved: "Validée",
  rejected: "Refusée",
}[status] || "Demande");
const applyOverrides = ({ schedule, overrides, year, month }) => Object.fromEntries(Object.entries(schedule).map(([day, plan]) => [
  day,
  {
    ...plan,
    ...Object.fromEntries(SHIFT_DEFS.map(shift => {
      const worker = overrides[overrideKey(year, month, day, shift.id)];
      return [shift.id, worker ? { ...plan[shift.id], worker, workers: [worker] } : plan[shift.id]];
    })),
  },
]));
const extractBackupJson = text => {
  const raw = String(text || "").trim();
  const match = raw.match(/----- DEBUT SAUVEGARDE PLANNING-AVD -----(.*?)----- FIN SAUVEGARDE PLANNING-AVD -----/s);
  return (match ? match[1] : raw).trim();
};
const formatCloudTime = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

function TopBar({ authState, isAdmin, roleReady, cloudStatus, view, setView, year, month, setYear, setMonth, onLogin, onLogout, onCleanView, onReport, onShareBackup, onRestoreBackup, onPublish }) {
  const moveMonth = delta => {
    const date = new Date(year, month + delta, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth());
  };
  const statusKind = cloudStatus?.kind || (authState.user ? "idle" : "local");
  const statusText = cloudStatus?.text || (authState.user ? "Cloud pret" : "Local uniquement");
  const roleKind = !authState.user ? "local" : !roleReady ? "saving" : isAdmin ? "saved" : "local";
  const roleText = !authState.user ? "Non connecté" : !roleReady ? "Rôle..." : isAdmin ? "Administrateur" : "Auxiliaire";

  const tabs = [
    ["week", "week", "Semaine"],
    ["hours", "clock", "Heures"],
    ["config", "settings", "Réglages"],
  ];

  return h("header", { className: "topbar" },
    h("div", { className: "title-row" },
      h("div", null,
        h("h1", null, "Planning-AVD"),
        h("div", { className: "cloud-line" },
          h("span", { className: `role-pill ${roleKind}` }, roleText),
          h("span", { className: `cloud-status ${statusKind}` }, statusText),
          h("span", { className: "muted" }, authState.user ? authState.user.email : "Connexion Google disponible"),
        ),
      ),
      h("div", { className: "action-row" },
        h(Button, { onClick: onCleanView }, h(IconLabel, { icon: "sparkles", label: "Vue propre" })),
        h(Button, { onClick: onReport }, h(IconLabel, { icon: "file", label: "Rapport" })),
        h(Button, { onClick: onShareBackup }, h(IconLabel, { icon: "save", label: "Sauvegarde" })),
        h(Button, { onClick: onRestoreBackup }, h(IconLabel, { icon: "restore", label: "Restaurer" })),
        authState.user && isAdmin ? h(Button, { active: true, onClick: onPublish }, h(IconLabel, { icon: "cloud", label: "Sauvegarder" })) : null,
        authState.user
          ? h(Button, { active: true, onClick: onLogout }, h(IconLabel, { icon: "logout", label: "Connecté" }))
          : h(Button, { onClick: onLogin }, h(IconLabel, { icon: "login", label: "Connexion Google" })),
      ),
    ),
    authState.error ? h("div", { className: "muted" }, authState.error) : null,
    h("div", { className: "month-row" },
      h(Button, { className: "icon-only", onClick: () => moveMonth(-1), title: "Mois precedent" }, h(Icon, { name: "chevronLeft" })),
      h("h2", { style: { margin: 0 } }, h(Button, { active: view === "month", className: "month-title-btn", onClick: () => setView("month"), title: "Vue mensuelle" }, h(IconLabel, { icon: "calendar", label: `${MONTHS[month]} ${year}` }))),
      h(Button, { className: "icon-only", onClick: () => moveMonth(1), title: "Mois suivant" }, h(Icon, { name: "chevronRight" })),
    ),
    h("nav", { className: "tabs" }, tabs.map(tab => h(Button, {
      key: tab[0],
      active: view === tab[0],
      className: "tab",
      onClick: () => setView(tab[0]),
    }, h(Icon, { name: tab[1] }), h("span", null, tab[2])))),
  );
}

function ChangeRequestModal({ edit, planning, authState, onClose, onSubmit, saving }) {
  const [targetEmail, setTargetEmail] = useState("");
  const [message, setMessage] = useState("");
  if (!edit) return null;
  const userEmail = String(authState.user?.email || "").toLowerCase();
  const team = (planning?.team || []).filter(member => String(member.email || "").toLowerCase() !== userEmail);
  const target = team.find(member => member.email === targetEmail);
  return h("div", { className: "modal-backdrop", onClick: onClose },
    h("section", { className: "slot-editor change-request-modal", onClick: event => event.stopPropagation() },
      h("div", { className: "title-row" },
        h("div", null,
          h("h3", null, "Demande d'échange"),
          h("div", { className: "muted" }, `${SHIFT_LABEL[edit.shift]} · ${edit.day} ${MONTHS[edit.month]}`),
        ),
        h(Button, { className: "icon-btn", title: "Fermer", onClick: onClose }, h(Icon, { name: "close" })),
      ),
      h(Field, { label: "Proposer un échange avec" }, h(Select, { value: targetEmail, onChange: setTargetEmail },
        h("option", { value: "" }, "À définir par l'admin"),
        team.map(member => h("option", { key: member.email || member.name, value: member.email }, member.name || member.email)),
      )),
      h(Field, { label: "Message pour l'admin" }, h("textarea", {
        value: message,
        onChange: event => setMessage(event.target.value),
        placeholder: "Exemple : je peux échanger avec Sarah, ou je ne peux pas faire ce soir.",
        rows: 4,
      })),
      h("div", { className: "request-actions" },
        h(Button, { onClick: onClose }, "Annuler"),
        h(Button, {
          active: true,
          disabled: saving,
          onClick: () => onSubmit({ targetEmail, targetName: target?.name || "", message }),
        }, saving ? "Envoi..." : "Envoyer la demande"),
      ),
    ),
  );
}

function PersonalChangeRequestsPanel({ requests, error }) {
  if (!requests.length && !error) return null;
  const visible = requests.slice(0, 5);
  return h("section", { className: "panel request-panel" },
    h("div", { className: "title-row" },
      h("div", null,
        h("h3", null, "Mes demandes"),
        h("div", { className: "muted" }, error || `${requests.length} demande(s) pour ce mois.`),
      ),
    ),
    h("div", { className: "request-list" }, visible.map(request => h("div", { key: request.id, className: `request-item ${request.status || "pending"}` },
      h("span", { className: "manual-chip" }, `${request.day} ${MONTHS[request.month]}`),
      h("span", null,
        h("b", null, SHIFT_LABEL[request.shift] || request.shift),
        h("small", null, `${requestStatusLabel(request.status)}${request.targetName ? ` · ${request.targetName}` : ""}`),
      ),
    ))),
  );
}

function PersonalDayCard({ day, entries, year, month, requestBySlot, onOpenMeal, onRequestChange }) {
  return h("div", { className: `day-card personal-day${dayTone(year, month, day)}` },
    h("div", { className: "day-head" }, h("span", null, day)),
    SHIFT_DEFS.map(shift => {
      const entry = entries.find(item => item.shift === shift.id);
      const request = requestBySlot?.[requestSlotKey(day, shift.id)];
      const content = [
        h("span", { className: "slot-label", key: "label" }, SHIFT_COMPACT_LABEL[shift.id]),
        h("span", { key: "text" }, entry ? SHIFT_LABEL[shift.id] : "Repos"),
        request ? h("span", { key: "request", className: `request-badge ${request.status || "pending"}` }, requestStatusLabel(request.status)) : null,
      ];
      return entry ? h("button", {
        className: `personal-slot scheduled requestable-slot ${request ? "has-request" : ""}`,
        key: shift.id,
        title: request ? "Demande déjà envoyée" : "Demander un échange",
        disabled: request?.status === "pending",
        onClick: () => onRequestChange({ year, month, day, shift: shift.id }),
      }, content) : h("div", { className: "personal-slot", key: shift.id },
        h("span", { className: "slot-label" }, SHIFT_COMPACT_LABEL[shift.id]),
        h("span", null, "Repos"),
      );
    }),
    h(MealTag, { year, month, day, onOpen: onOpenMeal }),
  );
}

function PersonalView({ authState, year, month, setYear, setMonth, planning, error, onLogout }) {
  const [personalView, setPersonalView] = useState("week");
  const [mealDate, setMealDate] = useState(null);
  const [requestEdit, setRequestEdit] = useState(null);
  const [requestSaving, setRequestSaving] = useState(false);
  const [changeRequests, setChangeRequests] = useState([]);
  const [changeRequestError, setChangeRequestError] = useState("");
  useEffect(() => {
    const openMeal = event => setMealDate(event.detail);
    window.addEventListener("planning-avd-open-meal", openMeal);
    return () => window.removeEventListener("planning-avd-open-meal", openMeal);
  }, []);
  useEffect(() => {
    if (!authState.db || !authState.user) return;
    setChangeRequestError("");
    return subscribePersonalChangeRequests({
      db: authState.db,
      user: authState.user,
      year,
      month,
      onChange: setChangeRequests,
      onError: error => setChangeRequestError(`Demandes indisponibles : ${error.message}`),
    });
  }, [authState.db, authState.user, year, month]);
  const moveMonth = delta => {
    const date = new Date(year, month + delta, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth());
  };
  const byDay = Object.fromEntries(Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => [index + 1, []]));
  (planning?.entries || []).forEach(entry => { if (byDay[entry.day]) byDay[entry.day].push(entry); });
  const workedDays = Object.entries(byDay).filter(([, entries]) => entries.length);
  const weekGroups = [];
  for (let day = 1; day <= Object.keys(byDay).length; day += 7) weekGroups.push(Array.from({ length: 7 }, (_, index) => day + index).filter(item => byDay[item]));
  const requestBySlot = Object.fromEntries(changeRequests.map(request => [requestSlotKey(request.day, request.shift), request]));
  const sendChangeRequest = async ({ targetEmail, targetName, message }) => {
    if (!requestEdit) return;
    setRequestSaving(true);
    try {
      await createPlanningChangeRequest({
        db: authState.db,
        user: authState.user,
        planning,
        year: requestEdit.year,
        month: requestEdit.month,
        day: requestEdit.day,
        shift: requestEdit.shift,
        targetEmail,
        targetName,
        message,
      });
      setRequestEdit(null);
    } catch (error) {
      alert(`Demande impossible : ${error.message}`);
    } finally {
      setRequestSaving(false);
    }
  };
  return h("main", { className: "app personal-app" },
    h("header", { className: "topbar" },
      h("div", { className: "title-row" },
        h("div", null,
          h("h1", null, "Mon planning"),
          h("div", { className: "cloud-line" },
            h("span", { className: "role-pill local" }, "Auxiliaire"),
            h("span", { className: `cloud-status ${planning ? "saved" : "saving"}` }, planning ? "Planning reçu" : "En attente"),
            h("span", { className: "muted" }, authState.user?.email || ""),
          ),
        ),
        h("div", { className: "action-row" },
          h(Button, { onClick: () => window.print() }, h(IconLabel, { icon: "print", label: "Imprimer" })),
          h(Button, { onClick: onLogout }, h(IconLabel, { icon: "logout", label: "Sortir" })),
        ),
      ),
      h("div", { className: "month-row" },
        h(Button, { className: "icon-only", onClick: () => moveMonth(-1), title: "Mois precedent" }, h(Icon, { name: "chevronLeft" })),
        h("h2", { style: { margin: 0 } }, h(Button, { active: personalView === "month", className: "month-title-btn", onClick: () => setPersonalView("month"), title: "Vue mensuelle" }, h(IconLabel, { icon: "calendar", label: `${MONTHS[month]} ${year}` }))),
        h(Button, { className: "icon-only", onClick: () => moveMonth(1), title: "Mois suivant" }, h(Icon, { name: "chevronRight" })),
      ),
      h("nav", { className: "tabs personal-tabs" },
        h(Button, { active: personalView === "week", className: "tab", onClick: () => setPersonalView("week") }, h(IconLabel, { icon: "week", label: "Semaines" })),
        h(Button, { active: personalView === "month", className: "tab", onClick: () => setPersonalView("month") }, h(IconLabel, { icon: "calendar", label: "Mois" })),
      ),
    ),
    h("section", { className: "layout" },
      error ? h("div", { className: "panel muted" }, error) : null,
      h(TaskPanel, { authState }),
      planning
        ? h("div", { className: "panel personal-summary" },
            h("div", null, h("h3", null, planning.name || "Mon planning"), h("div", { className: "muted" }, "Planning personnel transmis par votre administrateur.")),
          )
        : h("div", { className: "panel" }, h("h3", null, "Planning en attente"), h("div", { className: "muted" }, "Votre administrateur n'a pas encore transmis de planning pour ce mois.")),
      h(PersonalChangeRequestsPanel, { requests: changeRequests, error: changeRequestError }),
      planning && personalView === "week"
        ? h("div", { className: "week-grid" }, weekGroups.map((days, index) => h("section", { className: "panel", key: index },
            h("h3", null, `Semaine du ${days[0]} ${MONTHS[month]}`),
            h("div", { className: "week-days" }, days.map(day => h(PersonalDayCard, { key: day, day, entries: byDay[day], year, month, requestBySlot, onOpenMeal: setMealDate, onRequestChange: setRequestEdit }))),
          )))
        : null,
      planning && personalView === "month"
        ? h("div", { className: "personal-month" }, workedDays.map(([day, entries]) => h(PersonalDayCard, { key: day, day, entries, year, month, requestBySlot, onOpenMeal: setMealDate, onRequestChange: setRequestEdit })))
        : null,
    ),
    h(ChangeRequestModal, { edit: requestEdit, planning, authState, onClose: () => setRequestEdit(null), onSubmit: sendChangeRequest, saving: requestSaving }),
    h(MealPlannerModal, { selectedDate: mealDate, onClose: () => setMealDate(null) }),
  );
}

function Summary({ auxiliaries, hours }) {
  return h("section", { className: "summary" }, auxiliaries.map((aux, index) => {
    const hData = displayHours(hours[aux.id], aux.quota);
    const c = colorFor(index);
    return h("div", { className: "panel", key: aux.id },
      h("div", { className: "pill", style: { background: c.light, color: c.text } }, aux.lead ? "Chef" : "Auxiliaire", " · ", aux.name),
      h("div", { className: "muted", style: { marginTop: 8 } }, `${hData.total}h effectuees / ${hData.quota}h`),
      h("div", { className: "progress" }, h("span", { style: { width: `${Math.min(100, Math.round((hData.total / Math.max(1, hData.quota)) * 100))}%`, background: c.solid } })),
    );
  }));
}

function RotationAudit({ checks }) {
  const visible = checks.slice(0, 6);
  const critical = checks.filter(item => item.level === "danger").length;
  const title = critical ? `${critical} point(s) a corriger` : checks[0]?.level === "ok" ? "Roulement coherent" : "Controle du roulement";
  return h("section", { className: "panel audit-panel" },
    h("div", { className: "title-row" },
      h("div", null,
        h("h3", null, "Verification du roulement"),
        h("div", { className: "muted" }, title),
      ),
    ),
    h("div", { className: "audit-list" }, visible.map((item, index) => h("div", { key: `${item.title}-${index}`, className: `audit-item ${item.level}` },
      h("span", { className: "audit-dot" }),
      h("span", null, h("b", null, item.title), h("small", null, item.detail)),
    ))),
    checks.length > visible.length ? h("div", { className: "muted", style: { marginTop: 8 } }, `${checks.length - visible.length} autre(s) point(s) detecte(s).`) : null,
  );
}

function ManualOverridesPanel({ items, onReset }) {
  if (!items.length) return null;
  const visible = items.slice(0, 8);
  return h("section", { className: "panel manual-panel" },
    h("div", { className: "title-row" },
      h("div", null,
        h("h3", null, "Modifications manuelles"),
        h("div", { className: "muted" }, `${items.length} creneau(x) ajuste(s) a la main ce mois-ci.`),
      ),
    ),
    h("div", { className: "manual-list" }, visible.map(item => h("div", { key: item.key, className: "manual-item" },
      h("span", { className: "manual-chip" }, `${item.day} ${item.monthLabel}`),
      h("span", null, h("b", null, item.shiftLabel), h("small", null, item.workerName)),
      h(Button, { onClick: () => onReset(item.key) }, "Auto"),
    ))),
    items.length > visible.length ? h("div", { className: "muted", style: { marginTop: 8 } }, `${items.length - visible.length} autre(s) modification(s).`) : null,
  );
}

function AdminChangeRequestsPanel({ requests, error, auxiliaries, onApprove, onReject }) {
  const [choices, setChoices] = useState({});
  if (!requests.length && !error) return null;
  const active = auxiliaries.filter(aux => aux.active);
  const defaultWorker = request => active.find(aux => String(aux.email || "").toLowerCase() === String(request.targetEmail || "").toLowerCase())
    || active.find(aux => String(aux.name || "").trim().toLowerCase() === String(request.targetName || "").trim().toLowerCase())
    || null;
  return h("section", { className: "panel request-panel admin-request-panel" },
    h("div", { className: "title-row" },
      h("div", null,
        h("h3", null, "Demandes d'échange"),
        h("div", { className: "muted" }, error || `${requests.filter(request => request.status === "pending").length} demande(s) en attente.`),
      ),
    ),
    h("div", { className: "request-list" }, requests.slice(0, 8).map(request => {
      const suggested = defaultWorker(request);
      const selected = choices[request.id] ?? suggested?.id ?? "";
      const pending = request.status === "pending";
      return h("div", { key: request.id, className: `request-item ${request.status || "pending"}` },
        h("span", { className: "manual-chip" }, `${request.day} ${MONTHS[request.month]}`),
        h("span", null,
          h("b", null, `${request.requesterName || request.requesterEmail} · ${SHIFT_LABEL[request.shift] || request.shift}`),
          h("small", null, `${requestStatusLabel(request.status)}${request.targetName ? ` · propose ${request.targetName}` : ""}`),
          request.message ? h("em", null, request.message) : null,
        ),
        pending ? h("div", { className: "request-admin-actions" },
          h(Select, { value: selected, onChange: value => setChoices(current => ({ ...current, [request.id]: value })) },
            h("option", { value: "" }, "Choisir"),
            active.map(aux => h("option", { key: aux.id, value: aux.id }, aux.name || aux.email || aux.id)),
          ),
          h(Button, { active: true, onClick: () => onApprove(request, selected) }, "Valider"),
          h(Button, { onClick: () => onReject(request) }, "Refuser"),
        ) : h("span", { className: "request-resolved" }, request.resolvedWorkerName || requestStatusLabel(request.status)),
      );
    })),
    requests.length > 8 ? h("div", { className: "muted", style: { marginTop: 8 } }, `${requests.length - 8} autre(s) demande(s).`) : null,
  );
}

function DayCard({ day, year, month, plan, auxiliaries, overrides, onEditSlot, onOpenMeal }) {
  if (!day) return h("div", { className: "day-card empty" });
  return h("div", { className: `day-card${dayTone(year, month, day)}` },
    h("div", { className: "day-head" }, h("span", null, day), h("span", null, dayName(year, month, day))),
    SHIFT_DEFS.map(shift => {
      const workers = shiftWorkerIds(plan?.[shift.id]);
      const worker = workers[0];
      const index = Math.max(0, auxiliaries.findIndex(aux => aux.id === worker));
      const c = colorFor(index);
      const manual = !!overrides?.[overrideKey(year, month, day, shift.id)];
      return h("button", {
        className: `slot editable-slot${manual ? " manual-slot" : ""}`,
        key: shift.id,
        title: manual ? "Modification manuelle" : SHIFT_LABEL[shift.id],
        onClick: () => onEditSlot({ day, shift: shift.id }),
      },
        h("span", { className: "slot-label", title: SHIFT_LABEL[shift.id] }, SHIFT_COMPACT_LABEL[shift.id] || SHIFT_LABEL[shift.id]),
        h("span", { className: "slot-content" },
          h("span", { className: "slot-name", style: { color: worker ? PLANNING_TEXT_COLORS[index % PLANNING_TEXT_COLORS.length] : "#746d61" } }, workers.length ? planningNames(auxiliaries, workers) : "A definir"),
          manual ? h("span", { className: "manual-badge" }, "Mod.") : null,
        ),
      );
    }),
    h(MealTag, { year, month, day, onOpen: onOpenMeal }),
  );
}

function MonthView({ year, month, schedule, auxiliaries, overrides, onEditSlot, onOpenMeal }) {
  return h("section", { className: "layout" },
    h("div", { className: "calendar" },
      DAYS_SHORT.map((day, index) => h("div", { key: `d-${index}`, className: `dow${index === 5 ? " saturday" : index === 6 ? " sunday" : ""}` }, day)),
      monthGrid(year, month).map((day, index) => h(DayCard, { key: `${day || "empty"}-${index}`, day, year, month, plan: day ? schedule[day] : null, auxiliaries, overrides, onEditSlot, onOpenMeal })),
    ),
  );
}

function WeekView({ year, month, schedule, auxiliaries, overrides, onEditSlot, onOpenMeal }) {
  return h("section", { className: "week-grid" }, weekStarts(year, month).map(start => {
    const days = Array.from({ length: 7 }, (_, i) => start + i).filter(day => schedule[day]);
    return h("div", { className: "panel", key: start },
      h("h3", null, `Semaine du ${start} ${MONTHS[month]}`),
      h("div", { className: "week-days" }, days.map(day => h(DayCard, { key: day, day, year, month, plan: schedule[day], auxiliaries, overrides, onEditSlot, onOpenMeal }))),
    );
  }));
}

function HoursView({ auxiliaries, hours }) {
  return h("section", { className: "hours-grid" },
    h("div", { className: "panel" },
      h("h3", null, "Heures reellement effectuees"),
      h("p", { className: "muted" }, "Le compteur commence a 0. Une journee est ajoutee seulement lorsqu'elle est terminee. Les doublons de comblage sont confirmes a la cloture du mois."),
    ),
    auxiliaries.map((aux, index) => {
      const hData = displayHours(hours[aux.id], aux.quota);
      const c = colorFor(index);
      return h("div", { className: "panel", key: aux.id },
        h("div", { className: "title-row" },
          h("b", { style: { color: c.text } }, aux.name),
          h("b", null, `${hData.total || 0}h / ${hData.quota || aux.quota}h`),
        ),
        h("div", { className: "summary", style: { marginTop: 8 } },
          h("span", null, `Matin : ${hData.morning || 0}h`),
          h("span", null, `Apres-midi : ${hData.afternoon || 0}h`),
          h("span", null, `Nuit : ${hData.night || 0}h`),
          h("span", null, `En pause : ${hData.pause}h`),
        ),
      );
    }),
  );
}

function SlotEditor({ edit, year, month, auxiliaries, schedule, overrides, onChoose, onReset, onClose }) {
  if (!edit) return null;
  const key = overrideKey(year, month, edit.day, edit.shift);
  const current = schedule[edit.day]?.[edit.shift]?.worker;
  const available = auxiliaries.filter(aux => aux.active && canWorkShift(aux, edit.shift, year, month, edit.day));
  return h("div", { className: "modal-backdrop", onClick: onClose },
    h("section", { className: "slot-editor", onClick: event => event.stopPropagation() },
      h("div", { className: "title-row" },
        h("div", null,
          h("h3", null, `${SHIFT_LABEL[edit.shift]} · ${edit.day} ${MONTHS[month]}`),
          h("div", { className: "muted" }, "Choisir l'intervenant pour ce créneau."),
        ),
        h(Button, { className: "icon-btn", title: "Fermer", onClick: onClose }, h(Icon, { name: "close" })),
      ),
      h("div", { className: "worker-options" }, available.map((aux, index) => h(Button, {
        key: aux.id,
        active: current === aux.id,
        onClick: () => onChoose(key, aux.id),
      }, h("span", { className: "worker-dot", style: { background: colorFor(index).solid } }), aux.name))),
      overrides[key] ? h(Button, { onClick: () => onReset(key) }, "↺ Revenir au roulement automatique") : null,
    ),
  );
}

function AdminAccessPanel({ authState, isAdmin, onGrantAdmin }) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const connectedEmail = authState.user?.email || "";
  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const cleanEmail = await onGrantAdmin(email);
      setEmail("");
      alert(`${cleanEmail} est maintenant administrateur. La personne devra se reconnecter ou recharger l'app.`);
    } catch (error) {
      alert(`Ajout administrateur impossible : ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return h("section", { className: "panel admin-access-panel" },
    h("div", { className: "title-row" },
      h("div", null,
        h("h3", null, "Accès et rôles"),
        h("div", { className: "muted" }, connectedEmail ? `Connecté : ${connectedEmail}` : "Connexion Google nécessaire."),
      ),
      h("span", { className: `role-pill ${isAdmin ? "saved" : "local"}` }, isAdmin ? "Administrateur" : "Auxiliaire"),
    ),
    isAdmin
      ? h("div", { className: "admin-form" },
          h(Field, { label: "Ajouter un administrateur par email" }, h(TextInput, {
            type: "email",
            value: email,
            onChange: setEmail,
            placeholder: "adresse@email.com",
          })),
          h(Button, { active: true, disabled: saving || !email.trim(), onClick: submit }, saving ? "Ajout..." : "Ajouter admin"),
          h("div", { className: "muted" }, "L'email ajouté pourra gérer la configuration, sauvegarder le cloud et transmettre les plannings."),
        )
      : h("div", { className: "muted" }, "Mode auxiliaire : accès au planning personnel, demandes d'échange, tâches et courses. Demandez à un administrateur d'ajouter votre email pour gérer l'app."),
  );
}

function ConfigView({ auxiliaries, setAuxiliaries, rotationDays, setRotationDays }) {
  const patchAux = (id, patch) => setAuxiliaries(list => list.map(aux => ({
    ...aux,
    ...(patch.lead === true && aux.id !== id ? { lead: false } : {}),
    ...(aux.id === id ? patch : {}),
  })));
  const addAux = () => setAuxiliaries(list => {
    if (list.length >= MAX_AUXILIARIES) return list;
    const id = `P${list.length + 1}`;
    return [...list, {
      ...DEFAULT_AUXILIARIES[0],
      id,
      name: `Auxiliaire ${list.length + 1}`,
      email: "",
      phone: "",
      address: "",
      lead: false,
      night: false,
      quota: 72,
      customDays: [0, 1, 2, 3, 4, 5, 6],
    }];
  });
  return h("section", { className: "layout" },
    h("div", { className: "panel" },
      h("div", { className: "title-row" },
        h("div", null,
          h("h3", null, "Roulement"),
          h("div", { className: "muted" }, "Choisir la duree du tour. En 2, 3 ou 4 jours, le tour se termine toujours le matin."),
        ),
      ),
      h("div", { className: "rotation-options" }, ROTATION_OPTIONS.map(option => h(Button, {
        key: option.value,
        active: Number(rotationDays) === option.value,
        onClick: () => setRotationDays(option.value),
      }, h("span", null, option.label), h("small", null, option.detail)))),
    ),
    h("div", { className: "panel title-row" },
      h("div", null, h("h3", null, "Configuration equipe"), h("div", { className: "muted" }, `${auxiliaries.length} auxiliaire(s), maximum ${MAX_AUXILIARIES}`)),
      h(Button, { onClick: addAux }, "+ Ajouter"),
    ),
    h("div", { className: "aux-grid" }, auxiliaries.map((aux, index) => h("div", { className: "aux-card", key: aux.id },
      h("div", { className: "title-row" },
        h("b", { style: { color: colorFor(index).text } }, aux.name || aux.id),
        h(Checkbox, { checked: aux.active, onChange: value => patchAux(aux.id, { active: value }), label: "Actif" }),
      ),
      h("div", { className: "form-grid" },
        h(Field, { label: "Prenom complet" }, h(TextInput, { value: aux.name, onChange: value => patchAux(aux.id, { name: value }) })),
        h(Field, { label: "Email" }, h(TextInput, { type: "email", value: aux.email, onChange: value => patchAux(aux.id, { email: value }) })),
        h(Field, { label: "Telephone" }, h(TextInput, { value: aux.phone, onChange: value => patchAux(aux.id, { phone: value }) })),
        h(Field, { label: "Quota mensuel" }, h(TextInput, { type: "number", value: aux.quota, onChange: value => patchAux(aux.id, { quota: Number(value) || 0 }) })),
      ),
      h(Field, { label: "Adresse complete" }, h("textarea", { value: aux.address || "", onChange: event => patchAux(aux.id, { address: event.target.value }), rows: 2 })),
      h("div", { className: "form-grid" },
        h(Field, { label: "Jours autorises" }, h(Select, { value: aux.days, onChange: value => patchAux(aux.id, { days: value }) },
          h("option", { value: "all" }, "Tous les jours"),
          h("option", { value: "weekdays" }, "Semaine seulement"),
          h("option", { value: "weekend" }, "Week-end seulement"),
          h("option", { value: "saturday" }, "Samedi seulement"),
          h("option", { value: "sunday" }, "Dimanche seulement"),
          h("option", { value: "custom" }, "Jours precis"),
        )),
        h(Field, { label: "Mode de travail" }, h(Select, { value: aux.shift, onChange: value => patchAux(aux.id, { shift: value, night: value === "all" || value === "night" }) },
          h("option", { value: "all" }, "Jour et nuit"),
          h("option", { value: "day" }, "Jour seulement"),
          h("option", { value: "morning" }, "Matin"),
          h("option", { value: "afternoon" }, "Soir"),
          h("option", { value: "night" }, "Nuits seulement"),
        )),
      ),
      aux.days === "custom" ? h("div", { className: "tabs" }, DAYS_SHORT.map((label, dayIndex) => {
        const checked = (aux.customDays || []).includes(dayIndex);
        return h(Button, {
          key: label + dayIndex,
          active: checked,
          onClick: () => patchAux(aux.id, { customDays: checked ? aux.customDays.filter(item => item !== dayIndex) : [...(aux.customDays || []), dayIndex] }),
        }, label);
      })) : null,
      h(Checkbox, { checked: aux.lead, onChange: value => patchAux(aux.id, { lead: value }), label: "Chef d'equipe : doublon pendant son tour" }),
      h(Checkbox, { checked: !!aux.coverage, onChange: value => patchAux(aux.id, { coverage: value }), label: "Comblage en doublon" }),
      aux.shift === "all"
        ? h("div", { className: "muted" }, "Jour et nuit : surveillance de nuit incluse.")
        : h(Checkbox, { checked: aux.night, onChange: value => patchAux(aux.id, { night: value }), label: "Peut faire la surveillance de nuit 12h" }),
    ))),
  );
}

export default function App() {
  const [stateLoaded, setStateLoaded] = useState(false);
  const [authState, setAuthState] = useState({ user: null, auth: null, db: null, ready: false, error: "" });
  const [year, setYear] = useState(defaultState().year);
  const [month, setMonth] = useState(defaultState().month);
  const [view, setView] = useState("month");
  const [rotationDays, setRotationDays] = useState(defaultState().rotationDays);
  const [auxiliaries, setAuxiliaries] = useState(cloneDefaultAux);
  const [overrides, setOverrides] = useState({});
  const [slotEdit, setSlotEdit] = useState(null);
  const [mealDate, setMealDate] = useState(null);
  const [sessionRole, setSessionRole] = useState({ ready: true, isAdmin: false });
  const [personalPlanning, setPersonalPlanning] = useState(null);
  const [personalError, setPersonalError] = useState("");
  const [adminChangeRequests, setAdminChangeRequests] = useState([]);
  const [adminChangeError, setAdminChangeError] = useState("");
  const [cloudStatus, setCloudStatus] = useState({ kind: "local", text: "Local uniquement" });
  const [accountingNow, setAccountingNow] = useState(() => new Date());
  const setCloudResult = result => {
    if (result?.cloud) {
      setCloudStatus({ kind: "saved", text: `Cloud sauvegardé ${formatCloudTime()}` });
      return;
    }
    if (result?.reason === "not-connected") {
      setCloudStatus({ kind: "local", text: "Local enregistré" });
      return;
    }
    setCloudStatus({ kind: "error", text: "Cloud non sauvegardé" });
  };

  useEffect(() => {
    initGoogleAuth(next => setAuthState(next)).catch(error => setAuthState({ user: null, auth: null, db: null, ready: true, error: error.message }));
  }, []);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
    const id = setTimeout(() => setAccountingNow(new Date()), Math.max(1000, nextMidnight.getTime() - now.getTime()));
    return () => clearTimeout(id);
  }, [accountingNow]);

  useEffect(() => {
    if (!authState.ready) return;
    if (!authState.user) {
      setSessionRole({ ready: true, isAdmin: false });
      return;
    }
    setSessionRole({ ready: false, isAdmin: false });
    isAdminUser({ db: authState.db, user: authState.user })
      .then(isAdmin => setSessionRole({ ready: true, isAdmin }))
      .catch(() => setSessionRole({ ready: true, isAdmin: false }));
  }, [authState.ready, authState.user, authState.db]);

  const personalMode = !!authState.user && sessionRole.ready && !sessionRole.isAdmin;

  const activeAux = useMemo(() => auxiliaries.filter(aux => aux.active), [auxiliaries]);

  useEffect(() => {
    if (!personalMode) return;
    setPersonalError("");
    return subscribePersonalPlanning({
      db: authState.db,
      user: authState.user,
      year,
      month,
      onChange: setPersonalPlanning,
      onError: error => setPersonalError(`Lecture du planning impossible : ${error.message}`),
    });
  }, [personalMode, authState.db, authState.user, year, month]);

  useEffect(() => {
    if (!authState.db || !authState.user || !sessionRole.ready || !sessionRole.isAdmin) {
      setAdminChangeRequests([]);
      return;
    }
    setAdminChangeError("");
    return subscribeAdminChangeRequests({
      db: authState.db,
      auxiliaries: activeAux,
      year,
      month,
      onChange: setAdminChangeRequests,
      onError: error => setAdminChangeError(`Demandes indisponibles : ${error.message}`),
    });
  }, [authState.db, authState.user, sessionRole.ready, sessionRole.isAdmin, activeAux, year, month]);

  useEffect(() => {
    if (!authState.ready || stateLoaded) return;
    loadState({ db: authState.db, user: authState.user }).then(saved => {
      if (saved?.year) setYear(saved.year);
      if (Number.isInteger(saved?.month)) setMonth(saved.month);
      if (saved?.view) setView(saved.view);
      if ([1, 2, 3, 4].includes(Number(saved?.rotationDays))) setRotationDays(Number(saved.rotationDays));
      if (saved?.auxiliaries || saved?.names) setAuxiliaries(normalizeAuxiliaries(saved));
      if (saved?.overrides && typeof saved.overrides === "object") setOverrides(saved.overrides);
      setStateLoaded(true);
    });
  }, [authState.ready, authState.user, stateLoaded]);

  useEffect(() => {
    if (!stateLoaded) return;
    if (authState.user && !sessionRole.ready) {
      setCloudStatus({ kind: "saving", text: "Vérification admin" });
      return;
    }
    if (authState.user && !sessionRole.isAdmin) {
      setCloudStatus({ kind: "error", text: "Admin non reconnu" });
      return;
    }
    setCloudStatus({ kind: authState.user ? "saving" : "local", text: authState.user ? "Sauvegarde cloud..." : "Local enregistré" });
    const id = setTimeout(() => saveState({
      db: authState.db,
      user: authState.user,
      state: { year, month, view, rotationDays, auxiliaries, overrides },
    }).then(setCloudResult), 450);
    return () => clearTimeout(id);
  }, [stateLoaded, authState.user, authState.db, sessionRole.ready, sessionRole.isAdmin, year, month, view, rotationDays, auxiliaries, overrides]);

  const planning = useMemo(() => buildSchedule({ year, month, auxiliaries: activeAux, rotationDays }), [year, month, activeAux, rotationDays]);
  const schedule = useMemo(() => applyOverrides({ schedule: planning.schedule, overrides, year, month }), [planning.schedule, overrides, year, month]);
  const hours = useMemo(
    () => calculatePerformedHours(schedule, auxiliaries, { year, month, now: accountingNow }),
    [schedule, auxiliaries, year, month, accountingNow],
  );
  const rotationChecks = useMemo(() => buildRotationAudit({ year, month, auxiliaries: activeAux, schedule, hours, rotationDays }), [year, month, activeAux, schedule, hours, rotationDays]);
  const manualOverrides = useMemo(() => buildManualOverrideList({ overrides, year, month, auxiliaries }), [overrides, year, month, auxiliaries]);

  const openReport = () => {
    const html = buildReportHtml({ year, month, auxiliaries: activeAux, schedule, hours });
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  const openCleanView = () => {
    const html = buildCleanPlanningHtml({ year, month, auxiliaries: activeAux, schedule });
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  const publishPlanning = async () => {
    try {
      setCloudStatus({ kind: "saving", text: "Sauvegarde cloud..." });
      const cloudResult = await saveState({
        db: authState.db,
        user: authState.user,
        state: { year, month, view, rotationDays, auxiliaries, overrides },
      });
      setCloudResult(cloudResult);
      const count = await publishPersonalPlannings({ db: authState.db, user: authState.user, year, month, auxiliaries: activeAux, schedule, hours });
      alert(`Planning sauvegardé pour ${count} auxiliaire(s). ${cloudResult?.cloud ? "Sauvegarde cloud à jour." : "Configuration conservée en local seulement."}`);
    } catch (error) {
      alert(`Sauvegarde impossible : ${error.message}`);
    }
  };

  const addAdminEmail = async email => {
    const cleanEmail = await grantAdminByEmail({ db: authState.db, user: authState.user, email });
    return cleanEmail;
  };

  const approveChangeRequest = async (request, workerId) => {
    const worker = activeAux.find(aux => aux.id === workerId);
    if (!worker) return alert("Choisissez l'auxiliaire qui reprend le créneau.");
    try {
      const key = overrideKey(request.year, request.month, request.day, request.shift);
      const nextOverrides = { ...overrides, [key]: worker.id };
      const nextSchedule = applyOverrides({ schedule: planning.schedule, overrides: nextOverrides, year, month });
      const nextHours = calculatePerformedHours(nextSchedule, auxiliaries, { year, month, now: accountingNow });
      setOverrides(nextOverrides);
      await saveState({
        db: authState.db,
        user: authState.user,
        state: { year, month, view, rotationDays, auxiliaries, overrides: nextOverrides },
      });
      await publishPersonalPlannings({ db: authState.db, user: authState.user, year, month, auxiliaries: activeAux, schedule: nextSchedule, hours: nextHours });
      await resolvePlanningChangeRequest({
        db: authState.db,
        user: authState.user,
        request,
        status: "approved",
        workerId: worker.id,
        workerName: worker.name,
      });
    } catch (error) {
      alert(`Validation impossible : ${error.message}`);
    }
  };

  const rejectChangeRequest = async request => {
    try {
      await resolvePlanningChangeRequest({ db: authState.db, user: authState.user, request, status: "rejected" });
    } catch (error) {
      alert(`Refus impossible : ${error.message}`);
    }
  };

  const shareBackup = async () => {
    const backup = {
      app: "Planning-AVD",
      version: 1,
      exportedAt: new Date().toISOString(),
      state: { year, month, view, rotationDays, auxiliaries, overrides },
    };
    const content = JSON.stringify(backup, null, 2);
    const fileName = `planning-avd-sauvegarde-${year}-${String(month + 1).padStart(2, "0")}.json`;
    const subject = `Sauvegarde Planning-AVD - ${MONTHS[month]} ${year}`;
    const fullBody = [
      "Bonjour,",
      "",
      "Voici la sauvegarde complete Planning-AVD.",
      "Conserver tout le bloc ci-dessous pour pouvoir la restaurer.",
      "",
      "----- DEBUT SAUVEGARDE PLANNING-AVD -----",
      content,
      "----- FIN SAUVEGARDE PLANNING-AVD -----",
    ].join("\n");
    await navigator.clipboard?.writeText(content).catch(() => {});
    if (fullBody.length > 14000) {
      const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent("Bonjour,\n\nLa sauvegarde complete Planning-AVD a ete copiee dans le presse-papiers et telechargee en fichier JSON. Ajoutez le fichier au mail ou collez le contenu du presse-papiers.\n\nFichier : " + fileName)}`;
      return;
    }
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;
  };

  const restoreBackup = () => {
    const input = window.prompt("Collez ici la sauvegarde Planning-AVD recue par email.");
    if (!input) return;
    try {
      const backup = JSON.parse(extractBackupJson(input));
      const next = backup?.state || backup;
      if (!next || !Array.isArray(next.auxiliaries)) throw new Error("Format de sauvegarde incomplet.");
      const nextYear = Number(next.year);
      const nextMonth = Number(next.month);
      const nextRotation = Number(next.rotationDays);
      if (!Number.isInteger(nextYear) || !Number.isInteger(nextMonth) || nextMonth < 0 || nextMonth > 11) {
        throw new Error("Mois ou annee invalide.");
      }
      setYear(nextYear);
      setMonth(nextMonth);
      setView(["month", "week", "hours", "config"].includes(next.view) ? next.view : "month");
      setRotationDays([1, 2, 3, 4].includes(nextRotation) ? nextRotation : 1);
      setAuxiliaries(normalizeAuxiliaries({ auxiliaries: next.auxiliaries }));
      setOverrides(next.overrides && typeof next.overrides === "object" ? next.overrides : {});
      alert("Sauvegarde restauree. Elle sera aussi sauvegardee dans le cloud si vous etes connecte.");
    } catch (error) {
      alert(`Sauvegarde impossible a restaurer : ${error.message}`);
    }
  };

  if (personalMode) return h(PersonalView, { authState, year, month, setYear, setMonth, planning: personalPlanning, error: personalError, onLogout: () => signOut(authState.auth) });

  return h("main", { className: "app" },
    h(TopBar, {
      authState,
      isAdmin: sessionRole.isAdmin,
      roleReady: sessionRole.ready,
      cloudStatus,
      view,
      setView,
      year,
      month,
      setYear,
      setMonth,
      onLogin: () => signInWithGoogle(authState.auth).catch(error => alert(error.message)),
      onLogout: () => signOut(authState.auth),
      onCleanView: openCleanView,
      onReport: openReport,
      onShareBackup: shareBackup,
      onRestoreBackup: restoreBackup,
      onPublish: publishPlanning,
    }),
    h("div", { className: "layout" },
      h(TaskPanel, { authState, isAdmin: sessionRole.isAdmin }),
      h(Summary, { auxiliaries: activeAux, hours }),
      h(RotationAudit, { checks: rotationChecks }),
      h(AdminChangeRequestsPanel, { requests: adminChangeRequests, error: adminChangeError, auxiliaries: activeAux, onApprove: approveChangeRequest, onReject: rejectChangeRequest }),
      h(ManualOverridesPanel, { items: manualOverrides, onReset: key => setOverrides(current => { const next = { ...current }; delete next[key]; return next; }) }),
      view === "month" ? h(MonthView, { year, month, schedule, auxiliaries, overrides, onEditSlot: setSlotEdit, onOpenMeal: setMealDate }) : null,
      view === "week" ? h(WeekView, { year, month, schedule, auxiliaries, overrides, onEditSlot: setSlotEdit, onOpenMeal: setMealDate }) : null,
      view === "hours" ? h(HoursView, { auxiliaries: activeAux, hours }) : null,
      view === "config" ? h(AdminAccessPanel, { authState, isAdmin: sessionRole.isAdmin, onGrantAdmin: addAdminEmail }) : null,
      view === "config" ? h(ConfigView, { auxiliaries, setAuxiliaries, rotationDays, setRotationDays }) : null,
    ),
    h(SlotEditor, {
      edit: slotEdit,
      year,
      month,
      auxiliaries,
      schedule,
      overrides,
      onChoose: (key, worker) => { setOverrides(current => ({ ...current, [key]: worker })); setSlotEdit(null); },
      onReset: key => { setOverrides(current => { const next = { ...current }; delete next[key]; return next; }); setSlotEdit(null); },
      onClose: () => setSlotEdit(null),
    }),
    h(MealPlannerModal, { selectedDate: mealDate, onClose: () => setMealDate(null) }),
  );
}
