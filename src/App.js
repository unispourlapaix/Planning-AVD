import React from "react";
import { DEFAULT_AUXILIARIES, DAYS_SHORT, MAX_AUXILIARIES, MONTHS, PALETTE, SHIFT_DEFS, SHIFT_LABEL } from "./modules/constants.js";
import { dayName, monthGrid, weekStarts } from "./modules/dates.js";
import { buildSchedule, canWorkShift } from "./modules/scheduler-handover.js?v=20260628-split-day";
import { initGoogleAuth, signInWithGoogle, signOut } from "./modules/auth.js?v=20260628-mobile-google";
import {
  createPlanningChangeRequest,
  createNewBeneficiaryAdmin,
  createBeneficiaryId,
  defaultState,
  deleteMemberAccess,
  ensureBeneficiaryIdentity,
  ensureBeneficiaryGroup,
  loadBeneficiaryState,
  grantMemberRole,
  loadRestoreBackup,
  loadState,
  publishPersonalPlannings,
  requestAccessRole,
  repairBeneficiaryMembers,
  resolveAccessRequest,
  resolvePlanningChangeRequest,
  saveState,
  setMemberAccess,
  subscribeAdminChangeRequests,
  subscribeAccessRequests,
  subscribeOwnAccessRequest,
  subscribeAccessMembers,
  subscribeBeneficiaryDashboard,
  subscribeUserBeneficiaries,
  subscribeUserAccess,
  subscribePersonalChangeRequests,
  subscribePersonalPlanning,
} from "./modules/storage.js?v=20260702-admin-sticky";
import { buildCleanPlanningHtml } from "./modules/clean-planning.js";
import { buildManualOverrideList, manualOverrideKey } from "./modules/manual-overrides.js";
import { buildReportHtml } from "./modules/report.js";
import { buildRotationAudit } from "./modules/rotation-audit.js";
import { calculatePerformedHours, summarizeHours } from "./modules/hour-accounting.js";
import { mealForDate, mealWeekForDate, shoppingListText, WEEKLY_SHOPPING } from "./modules/meal-planning.js";
import { TaskPanel } from "./modules/task-panel.js?v=20260627-beneficiary-scope";
import { Button, Checkbox, Field, h, Select, TextInput } from "./ui.js?v=20260702-member-actions";

const { useEffect, useMemo, useRef, useState } = React;

const ROTATION_OPTIONS = [
  { value: 1, label: "Jour par jour", detail: "Matin, apres-midi et nuit recalcules chaque jour." },
  { value: "split-day", label: "Journée + soir", detail: "Même auxiliaire matin/apres-midi, puis un autre le soir." },
  { value: 2, label: "Roulement 2 jours", detail: "La personne finit le matin, la suivante commence l'apres-midi." },
  { value: 3, label: "Roulement 3 jours", detail: "Bloc plus stable, toujours termine au matin." },
  { value: 4, label: "Roulement 4 jours", detail: "Longue presence, passage au suivant apres le matin." },
];
const normalizeRotationMode = value => {
  if (value === "split-day") return "split-day";
  const number = Number(value);
  return [1, 2, 3, 4].includes(number) ? number : 1;
};
const SHIFT_COMPACT_LABEL = { morning: "AM", afternoon: "PM", night: "SR" };
const PLANNING_TEXT_COLORS = ["#5689C9", "#D46AA8", "#5BA58D", "#9274C9", "#CF7B6D", "#4C9EA8", "#BA72B4", "#7D9B55"];
const UI_TEXT = {
  "action.print": { fr: "Imprimer", en: "Print" },
  "action.report": { fr: "Rapport", en: "Report" },
  "action.backup": { fr: "Sauvegarde", en: "Backup" },
  "action.restore": { fr: "Restaurer", en: "Restore" },
  "action.restoreCloud": { fr: "Secours cloud", en: "Cloud restore" },
  "action.publish": { fr: "Sauvegarder cloud", en: "Save cloud" },
  "action.login": { fr: "Connexion", en: "Sign in" },
  "action.loginPending": { fr: "Connexion en cours", en: "Signing in" },
  "action.logout": { fr: "Déconnexion", en: "Sign out" },
  "month.previous": { fr: "Mois précédent", en: "Previous month" },
  "month.next": { fr: "Mois suivant", en: "Next month" },
  "view.month": { fr: "Mois", en: "Month" },
  "view.week": { fr: "Semaine", en: "Week" },
  "view.life": { fr: "Repas et tâches", en: "Meals and tasks" },
  "view.hours": { fr: "Heures", en: "Hours" },
  "view.settings": { fr: "Réglages", en: "Settings" },
};
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
  login: [
    "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4",
    "M10 17l5-5-5-5M15 12H3",
    "M8 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 12a6 6 0 0 1 10-4.5",
  ],
  logout: [
    "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",
    "M14 17l5-5-5-5M19 12H8",
    "M16 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM10 21a6 6 0 0 1 10-4.5",
  ],
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
const uiLanguage = () => {
  let saved = "";
  try {
    saved = localStorage.getItem("planning-avd-language") || "";
  } catch {}
  const lang = String(saved || document.documentElement.lang || navigator.language || "fr").toLowerCase();
  return lang.startsWith("en") ? "en" : "fr";
};
const uiLabel = key => UI_TEXT[key]?.[uiLanguage()] || UI_TEXT[key]?.fr || key;
const uiHint = key => {
  const item = UI_TEXT[key] || {};
  return [item.fr, item.en].filter(Boolean).join(" / ") || key;
};
const tooltipAttrs = (key, className = "", attrs = {}) => ({
  ...attrs,
  className: `${className} has-tooltip`.trim(),
  title: uiHint(key),
  "aria-label": uiLabel(key),
  "data-tooltip": uiHint(key),
  "data-ui-key": key,
});
function MenuIconButton({ icon, textKey, className = "", action, view, ...props }) {
  const attrs = {
    ...(action ? { "data-action": action } : {}),
    ...(view ? { "data-view": view } : {}),
  };
  return h(Button, { ...tooltipAttrs(textKey, `icon-only menu-icon ${className}`, attrs), ...props }, h(Icon, { name: icon }));
}
function MenuTabButton({ icon, textKey, view, active, onClick }) {
  return h(Button, {
    ...tooltipAttrs(textKey, "tab icon-tab", { "data-view": view, "data-action": `view-${view}` }),
    active,
    onClick,
  }, h(Icon, { name: icon }));
}

function DayActivityButton({ year, month, day, onOpen }) {
  const meal = mealForDate(year, month, day);
  return h("button", {
    className: "day-activity-btn",
    type: "button",
    title: `Activités du jour : repas, courses et détails. Repas : ${meal.title}`,
    onClick: () => onOpen?.({ year, month, day }),
  }, h("span", { className: "activity-plus" }, "+"), h("span", null, "Détail"));
}

function MealPlannerModal({ selectedDate, onClose, dayOutings = {}, onDayOutingsChange }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [outingInput, setOutingInput] = useState("");
  const week = selectedDate ? mealWeekForDate(selectedDate.year, selectedDate.month, selectedDate.day) : [];
  useEffect(() => {
    if (!selectedDate || !week.length) return;
    const selectedKey = `${selectedDate.year}-${selectedDate.month}-${selectedDate.day}`;
    setSelectedIndex(Math.max(0, week.findIndex(item => item.dateKey === selectedKey)));
  }, [selectedDate?.year, selectedDate?.month, selectedDate?.day]);
  const meal = week[selectedIndex] || week[0] || null;
  const outingKey = meal?.dateKey || "";
  useEffect(() => {
    if (!outingKey) return;
    setOutingInput("");
  }, [outingKey]);
  if (!selectedDate || !meal) return null;
  const outings = Array.isArray(dayOutings?.[outingKey]) ? dayOutings[outingKey] : [];
  const canEditOutings = typeof onDayOutingsChange === "function";
  const copyShopping = async () => {
    await navigator.clipboard?.writeText(shoppingListText(week));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const setSavedOutings = next => {
    if (outingKey) onDayOutingsChange?.(outingKey, next);
  };
  const addOuting = () => {
    const title = outingInput.trim();
    if (!title || !canEditOutings) return;
    setSavedOutings([...outings, { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, title }]);
    setOutingInput("");
  };
  const removeOuting = id => setSavedOutings(outings.filter(item => item.id !== id));

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
          h("section", { className: "day-outings" },
            h("div", { className: "title-row" },
              h("div", null,
                h("h4", null, "Sorties du jour"),
                h("div", { className: "muted" }, "Rendez-vous, promenade, courses rapides ou activité à prévoir."),
              ),
            ),
            canEditOutings ? h("div", { className: "outing-form" },
                h("input", {
                  value: outingInput,
                  onChange: event => setOutingInput(event.target.value),
                  onKeyDown: event => { if (event.key === "Enter") addOuting(); },
                  placeholder: "Ajouter une sortie",
                }),
                h(Button, { active: true, onClick: addOuting }, "+"),
              ) : null,
            outings.length
              ? h("ul", { className: `outing-list${canEditOutings ? "" : " readonly"}` }, outings.map(item => h("li", { key: item.id },
                  h("span", null, item.title),
                  canEditOutings ? h(Button, { className: "outing-remove", title: "Retirer", onClick: () => removeOuting(item.id) }, "x") : null,
                )))
              : h("div", { className: "muted" }, "Aucune sortie notée pour ce jour."),
          ),
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
const timestampToDate = value => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000);
  if (Number.isFinite(value._seconds)) return new Date(value._seconds * 1000);
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};
const formatDashboardDate = value => {
  const date = timestampToDate(value);
  return date ? date.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Pas encore";
};
const normalizeDayOutings = value => Object.fromEntries(Object.entries(value && typeof value === "object" ? value : {})
  .map(([key, items]) => [key, (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const title = typeof item === "string" ? item : item?.title;
      return {
        id: String(item?.id || `${key}-${index}`),
        title: String(title || "").trim(),
      };
    })
    .filter(item => item.title)])
  .filter(([, items]) => items.length));
const stateSignature = state => JSON.stringify(state);
const ADMIN_ROLE_TIMEOUT_MS = 4500;
const normalizeTypedEmail = value => String(value || "").trim().toLowerCase();
const hasIncompleteAuxEmail = auxiliaries => (Array.isArray(auxiliaries) ? auxiliaries : [])
  .some(aux => aux?.active !== false && normalizeTypedEmail(aux.email) && !MEMBER_EMAIL_PATTERN.test(normalizeTypedEmail(aux.email)));
const firstIncompleteAuxEmail = auxiliaries => (Array.isArray(auxiliaries) ? auxiliaries : [])
  .find(aux => aux?.active !== false && normalizeTypedEmail(aux.email) && !MEMBER_EMAIL_PATTERN.test(normalizeTypedEmail(aux.email)));
const openHtmlDocument = ({ html, fileName, blockedMessage }) => {
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    return true;
  }
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  alert(blockedMessage);
  return false;
};

function TopBar({ authState, sessionRole, isAdmin, roleReady, cloudStatus, view, setView, year, month, setYear, setMonth, beneficiaryName, loginPending = false, onLogin, onLogout, onCleanView, onReport, onShareBackup, onRestoreBackup, onRestoreCloudBackup, onPublish }) {
  const disconnected = !authState.user;
  const moveMonth = delta => {
    const date = new Date(year, month + delta, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth());
  };
  const statusKind = cloudStatus?.kind || (authState.user ? "idle" : "local");
  const statusText = cloudStatus?.text || (authState.user ? "Cloud pret" : "Local uniquement");
  const roleKind = !authState.user ? "local" : !roleReady ? "saving" : isAdmin ? "saved" : "local";
  const roleText = !authState.user
    ? "Non connecté"
    : !roleReady
      ? "Rôle..."
      : isAdmin
        ? "Administrateur"
        : sessionRole?.role === "viewer"
          ? ACCESS_ROLE_LABELS.viewer
          : "Auxiliaire";

  const tabs = [
    ["week", "week", "view.week"],
    ["life", "meal", "view.life"],
    ["hours", "clock", "view.hours"],
    ["config", "settings", "view.settings"],
  ];

  return h("header", { className: `topbar${disconnected ? " disconnected" : ""}` },
    h("div", { className: "title-row" },
      h("div", null,
        h("h1", null, "Planning-AVD"),
        h("div", { className: "cloud-line" },
          h("span", { className: `role-pill ${roleKind}` }, roleText),
          h("span", { className: `cloud-status ${statusKind}` }, statusText),
          beneficiaryName ? h("span", { className: "muted" }, `Bénéficiaire : ${beneficiaryName}`) : null,
          h("span", { className: "muted" }, authState.user ? authState.user.email : "Connexion Google disponible"),
        ),
      ),
      h("div", { className: "action-row" },
        h(MenuIconButton, { icon: "print", textKey: "action.print", action: "print", onClick: onCleanView }),
        h(MenuIconButton, { icon: "file", textKey: "action.report", action: "report", onClick: onReport }),
        h(MenuIconButton, { icon: "save", textKey: "action.backup", action: "backup", onClick: onShareBackup }),
        h(MenuIconButton, { icon: "restore", textKey: "action.restore", action: "restore", onClick: onRestoreBackup }),
        authState.user && isAdmin ? h(MenuIconButton, { icon: "restore", textKey: "action.restoreCloud", action: "restore-cloud", onClick: onRestoreCloudBackup }) : null,
        authState.user && isAdmin ? h(MenuIconButton, { icon: "cloud", textKey: "action.publish", action: "publish", active: true, onClick: onPublish }) : null,
        authState.user
          ? h(MenuIconButton, { icon: "logout", textKey: "action.logout", action: "logout", active: true, onClick: onLogout })
          : h(MenuIconButton, { icon: "login", textKey: loginPending ? "action.loginPending" : "action.login", action: "login", onClick: onLogin, disabled: loginPending }),
      ),
    ),
    disconnected ? h("div", { className: "offline-notice" },
      h(Icon, { name: "login" }),
      h("span", null, loginPending ? "Connexion Google en cours..." : "Vous êtes déconnecté : les données cloud et les partages sont grisés jusqu'à la connexion."),
    ) : null,
    authState.error ? h("div", { className: "muted" }, authState.error) : null,
    h("div", { className: "month-row" },
      h(MenuIconButton, { icon: "chevronLeft", textKey: "month.previous", className: "month-nav-btn", action: "month-previous", onClick: () => moveMonth(-1) }),
      h("h2", { style: { margin: 0 } }, h(Button, { ...tooltipAttrs("view.month", "month-title-btn", { "data-view": "month", "data-action": "view-month" }), active: view === "month", onClick: () => setView("month") }, h(IconLabel, { icon: "calendar", label: `${MONTHS[month]} ${year}` }))),
      h(MenuIconButton, { icon: "chevronRight", textKey: "month.next", className: "month-nav-btn", action: "month-next", onClick: () => moveMonth(1) }),
    ),
    h("nav", { className: "tabs" }, tabs.map(tab => h(MenuTabButton, {
      key: tab[0],
      view: tab[0],
      icon: tab[1],
      textKey: tab[2],
      active: view === tab[0],
      onClick: () => setView(tab[0]),
    }))),
  );
}

function ChangeRequestModal({ edit, planning, authState, onClose, onSubmit, saving }) {
  const [targetKey, setTargetKey] = useState("");
  const [message, setMessage] = useState("");
  if (!edit) return null;
  const userEmail = String(authState.user?.email || "").toLowerCase();
  const personalName = String(planning?.name || "").trim().toLowerCase();
  const team = (planning?.team || []).filter(member =>
    String(member.email || "").toLowerCase() !== userEmail
    && String(member.name || "").trim().toLowerCase() !== personalName);
  const targetKeyFor = (member, index) => String(member.email || member.name || `member-${index}`);
  const target = team.find((member, index) => targetKeyFor(member, index) === targetKey);
  return h("div", { className: "modal-backdrop", onClick: onClose },
    h("section", { className: "slot-editor change-request-modal", onClick: event => event.stopPropagation() },
      h("div", { className: "title-row" },
        h("div", null,
          h("h3", null, "Demande d'échange"),
          h("div", { className: "muted" }, `${SHIFT_LABEL[edit.shift]} · ${edit.day} ${MONTHS[edit.month]}`),
        ),
        h(Button, { className: "icon-btn", title: "Fermer", onClick: onClose }, h(Icon, { name: "close" })),
      ),
      h(Field, { label: "Proposer un échange avec" }, h(Select, { value: targetKey, onChange: setTargetKey },
        h("option", { value: "" }, "À définir par l'admin"),
        team.map((member, index) => h("option", { key: targetKeyFor(member, index), value: targetKeyFor(member, index) }, member.name || member.email)),
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
          onClick: () => onSubmit({ targetEmail: target?.email || "", targetName: target?.name || "", message }),
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

function PersonalDayCard({ day, entries, year, month, requestBySlot, onOpenMeal, onRequestChange, canRequest = true, currentWeek = false }) {
  const hasPresence = entries.length > 0;
  const today = new Date();
  const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === Number(day);
  return h("div", { className: `day-card personal-day${dayTone(year, month, day)}${hasPresence ? " presence-day" : " rest-day"}${isToday ? " today" : ""}${currentWeek ? " current-week-day" : ""}` },
    h("div", { className: "day-head" }, h("span", null, day)),
    SHIFT_DEFS.map(shift => {
      const entry = entries.find(item => item.shift === shift.id);
      const request = requestBySlot?.[requestSlotKey(day, shift.id)];
      const content = [
        h("span", { className: "slot-label", key: "label" }, SHIFT_COMPACT_LABEL[shift.id]),
        h("span", { key: "text" }, entry ? SHIFT_LABEL[shift.id] : "Repos"),
        request ? h("span", { key: "request", className: `request-badge ${request.status || "pending"}` }, requestStatusLabel(request.status)) : null,
      ];
      if (entry && canRequest) return h("button", {
        className: `personal-slot scheduled requestable-slot ${request ? "has-request" : ""}`,
        key: shift.id,
        title: request ? "Demande déjà envoyée" : "Demander un échange",
        disabled: request?.status === "pending",
        onClick: () => onRequestChange({ year, month, day, shift: shift.id }),
      }, content);
      return h("div", { className: `personal-slot${entry ? " scheduled" : ""}`, key: shift.id },
        h("span", { className: "slot-label" }, SHIFT_COMPACT_LABEL[shift.id]),
        h("span", null, entry ? SHIFT_LABEL[shift.id] : "Repos"),
      );
    }),
    h(DayActivityButton, { year, month, day, onOpen: onOpenMeal }),
  );
}

function PersonalView({ authState, sessionRole, year, month, setYear, setMonth, planning, access = [], selectedBeneficiaryId = "", onSelectBeneficiary, error, onLogout }) {
  const [personalView, setPersonalView] = useState("week");
  const [mealDate, setMealDate] = useState(null);
  const [requestEdit, setRequestEdit] = useState(null);
  const [requestSaving, setRequestSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [changeRequests, setChangeRequests] = useState([]);
  const [changeRequestError, setChangeRequestError] = useState("");
  const canContribute = sessionRole?.canContribute !== false;
  const personalRoleText = sessionRole?.role === "viewer" ? ACCESS_ROLE_LABELS.viewer : "Auxiliaire";
  const activeAccess = access.filter(item => item.active !== false);
  const selectedAccess = activeAccess.find(item => item.beneficiaryId === selectedBeneficiaryId) || null;
  const selectedId = selectedBeneficiaryId || planning?.beneficiaryId || activeAccess[0]?.beneficiaryId || "";
  const visiblePlanning = !selectedId || String(planning?.beneficiaryId || "") === selectedId ? planning : null;
  const primaryAccess = selectedAccess || activeAccess.find(item => item.beneficiaryId === visiblePlanning?.beneficiaryId) || activeAccess[0] || null;
  const accessBeneficiaryId = selectedId || visiblePlanning?.beneficiaryId || primaryAccess?.beneficiaryId || "";
  const accessBeneficiaryName = primaryAccess?.beneficiaryName || visiblePlanning?.beneficiaryName || "";
  useEffect(() => {
    const openLife = () => setPersonalView("life");
    window.addEventListener("planning-avd-open-life", openLife);
    return () => window.removeEventListener("planning-avd-open-life", openLife);
  }, []);
  useEffect(() => {
    if (!visiblePlanning && !accessBeneficiaryId) return;
    window.__planningAvdCurrentState = {
      ...(window.__planningAvdCurrentState || {}),
      year,
      month,
      beneficiaryId: accessBeneficiaryId,
      beneficiaryName: accessBeneficiaryName,
      personal: true,
    };
  }, [visiblePlanning, year, month, accessBeneficiaryId, accessBeneficiaryName]);
  useEffect(() => {
    const openMeal = event => setMealDate(event.detail);
    const requestChange = event => {
      if (!canContribute) return;
      const detail = event.detail || {};
      if (!detail.day || !detail.shift) return;
      setRequestEdit({
        year,
        month,
        day: Number(detail.day),
        shift: detail.shift,
      });
    };
    window.addEventListener("planning-avd-open-meal", openMeal);
    window.addEventListener("planning-avd-request-change", requestChange);
    return () => {
      window.removeEventListener("planning-avd-open-meal", openMeal);
      window.removeEventListener("planning-avd-request-change", requestChange);
    };
  }, [year, month, canContribute]);
  useEffect(() => {
    if (!authState.db || !authState.user || !canContribute || !accessBeneficiaryId) {
      setChangeRequests([]);
      return;
    }
    setChangeRequestError("");
    return subscribePersonalChangeRequests({
      db: authState.db,
      user: authState.user,
      year,
      month,
      beneficiaryId: accessBeneficiaryId,
      onChange: setChangeRequests,
      onError: error => setChangeRequestError(`Demandes indisponibles : ${error.message}`),
    });
  }, [authState.db, authState.user, year, month, accessBeneficiaryId, canContribute]);
  const moveMonth = delta => {
    const date = new Date(year, month + delta, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth());
  };
  const byDay = Object.fromEntries(Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => [index + 1, []]));
  (visiblePlanning?.entries || []).forEach(entry => { if (byDay[entry.day]) byDay[entry.day].push(entry); });
  const workedDays = Object.entries(byDay).filter(([, entries]) => entries.length);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const weekGroups = weekStarts(year, month).map(start => Array.from({ length: 7 }, (_, index) => start + index).filter(item => byDay[item]));
  const currentWeekIndex = isCurrentMonth ? weekGroups.findIndex(days => days.includes(today.getDate())) : -1;
  const orderedWeekGroups = currentWeekIndex > -1
    ? [...weekGroups.slice(currentWeekIndex), ...weekGroups.slice(0, currentWeekIndex)]
    : weekGroups;
  const requestBySlot = Object.fromEntries(changeRequests.map(request => [requestSlotKey(request.day, request.shift), request]));
  const beneficiaryLabel = accessBeneficiaryName ? `Bénéficiaire : ${accessBeneficiaryName}` : "Planning personnel transmis par votre administrateur.";
  const pendingMessage = activeAccess.length
    ? "Votre accès au bénéficiaire est actif. Le planning du mois n'a pas encore été transmis."
    : "Votre administrateur n'a pas encore transmis de planning pour ce mois.";
  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await onLogout?.();
    } catch (error) {
      alert(`Déconnexion impossible : ${error.message}`);
      setLoggingOut(false);
    }
  };
  const sendChangeRequest = async ({ targetEmail, targetName, message }) => {
    if (!requestEdit) return;
    if (!canContribute) return alert("Votre acces est en lecture seule.");
    setRequestSaving(true);
    try {
      await createPlanningChangeRequest({
        db: authState.db,
        user: authState.user,
        planning: visiblePlanning,
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
  return h("main", { className: `app personal-app${personalView === "life" ? " life-view" : ""}` },
    h("header", { className: "topbar" },
      h("div", { className: "title-row" },
        h("div", null,
          h("h1", null, "Mon planning"),
          h("div", { className: "cloud-line" },
            h("span", { className: "role-pill local" }, personalRoleText),
            h("span", { className: `cloud-status ${visiblePlanning || activeAccess.length ? "saved" : "saving"}` }, visiblePlanning ? "Planning reçu" : activeAccess.length ? "Accès actif" : "En attente"),
            h("span", { className: "muted" }, authState.user?.email || ""),
          ),
        ),
        h("div", { className: "action-row" },
          h(MenuIconButton, { icon: "print", textKey: "action.print", action: "print", onClick: () => window.print() }),
          h(MenuIconButton, { icon: "logout", textKey: "action.logout", action: "logout", active: true, onClick: logout, disabled: loggingOut }),
        ),
      ),
      h("div", { className: "month-row" },
        h(MenuIconButton, { icon: "chevronLeft", textKey: "month.previous", className: "month-nav-btn", action: "month-previous", onClick: () => moveMonth(-1) }),
        h("h2", { style: { margin: 0 } }, h(Button, { ...tooltipAttrs("view.month", "month-title-btn", { "data-view": "month", "data-action": "view-month" }), active: personalView === "month", onClick: () => setPersonalView("month") }, h(IconLabel, { icon: "calendar", label: `${MONTHS[month]} ${year}` }))),
        h(MenuIconButton, { icon: "chevronRight", textKey: "month.next", className: "month-nav-btn", action: "month-next", onClick: () => moveMonth(1) }),
      ),
      h("nav", { className: "tabs personal-tabs" },
        h(MenuTabButton, { active: personalView === "week", view: "week", icon: "week", textKey: "view.week", onClick: () => setPersonalView("week") }),
        h(MenuTabButton, { active: personalView === "month", view: "month", icon: "calendar", textKey: "view.month", onClick: () => setPersonalView("month") }),
        h(MenuTabButton, { active: personalView === "life", view: "life", icon: "meal", textKey: "view.life", onClick: () => setPersonalView("life") }),
      ),
    ),
    h("section", { className: "layout" },
      error ? h("div", { className: "panel muted" }, error) : null,
      activeAccess.length > 1 ? h("div", { className: "panel personal-beneficiary-picker" },
        h("div", null,
          h("h3", null, "Bénéficiaire"),
          h("div", { className: "muted" }, "Choisir le dossier à afficher."),
        ),
        h(Select, { value: accessBeneficiaryId, onChange: value => onSelectBeneficiary?.(value) },
          activeAccess.map(item => h("option", { key: item.beneficiaryId, value: item.beneficiaryId }, item.beneficiaryName || "Bénéficiaire sans nom")),
        ),
      ) : null,
      personalView === "life" && accessBeneficiaryId ? h(TaskPanel, { authState, auxiliaries: visiblePlanning?.team || [], year, month, beneficiaryId: accessBeneficiaryId, canContribute }) : null,
      personalView !== "life" && visiblePlanning
        ? h("div", { className: "panel personal-summary" },
            h("div", null, h("h3", null, visiblePlanning.name || "Mon planning"), h("div", { className: "muted" }, beneficiaryLabel)),
          )
        : null,
      personalView !== "life" && !visiblePlanning
        ? h("div", { className: "panel personal-empty-panel" },
            h("h3", null, "Planning en attente"),
            h("div", { className: "muted" }, error || pendingMessage),
            activeAccess.length ? h("div", { className: "personal-access-list" }, activeAccess.map(item => h("article", { key: item.beneficiaryId || item.id },
              h("b", null, item.beneficiaryName || "Bénéficiaire sans nom"),
              h("small", null, ACCESS_ROLE_LABELS[item.role] || item.role || "Accès actif"),
            ))) : null,
            h("div", { className: "personal-empty-actions" },
              h(Button, { active: true, onClick: logout, disabled: loggingOut }, h(IconLabel, { icon: "logout", label: loggingOut ? "Sortie..." : "Se déconnecter" })),
            ),
          )
        : null,
      personalView !== "life" && canContribute ? h(PersonalChangeRequestsPanel, { requests: changeRequests, error: changeRequestError }) : null,
      visiblePlanning && personalView === "week"
        ? h("div", { className: "week-grid" }, orderedWeekGroups.map(days => {
            const currentWeek = isCurrentMonth && days.includes(today.getDate());
            return h("section", { className: `panel personal-week-panel${currentWeek ? " current-week" : ""}`, key: days.join("-") },
              h("h3", null, currentWeek ? `Semaine actuelle · ${days[0]} ${MONTHS[month]}` : `Semaine du ${days[0]} ${MONTHS[month]}`),
              h("div", { className: "week-days" }, days.map(day => h(PersonalDayCard, { key: day, day, entries: byDay[day], year, month, requestBySlot, onOpenMeal: setMealDate, onRequestChange: setRequestEdit, canRequest: canContribute, currentWeek }))),
            );
          }))
        : null,
      visiblePlanning && personalView === "month"
        ? h("div", { className: "personal-month" }, workedDays.map(([day, entries]) => h(PersonalDayCard, { key: day, day, entries, year, month, requestBySlot, onOpenMeal: setMealDate, onRequestChange: setRequestEdit, canRequest: canContribute })))
        : null,
    ),
    h(ChangeRequestModal, { edit: requestEdit, planning: visiblePlanning, authState, onClose: () => setRequestEdit(null), onSubmit: sendChangeRequest, saving: requestSaving }),
    h(MealPlannerModal, { selectedDate: mealDate, onClose: () => setMealDate(null), dayOutings: visiblePlanning?.dayOutings || {} }),
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
  const active = auxiliaries.filter(aux => aux.active !== false);
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
    h(DayActivityButton, { year, month, day, onOpen: onOpenMeal }),
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
  const available = auxiliaries.filter(aux => aux.active !== false && canWorkShift(aux, edit.shift, year, month, edit.day));
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

const ACCESS_ROLE_LABELS = {
  owner: "Proprietaire",
  admin: "Administrateur",
  auxiliary: "Auxiliaire",
  viewer: "Bénéficiaire lecture seule",
};
const ACCESS_MEMBER_FILTERS = [
  { id: "all", label: "Tous" },
  { id: "admin", label: "Admins" },
  { id: "auxiliary", label: "Auxiliaires" },
  { id: "viewer", label: "Lecture" },
  { id: "inactive", label: "Inactifs" },
];
const MEMBER_EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const normalizeBeneficiaryLabel = value => String(value || "")
  .trim()
  .toLocaleLowerCase("fr")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

const FIRST_ROLE_CHOICES = [
  {
    role: "auxiliary",
    title: "Auxiliaire",
    detail: "Je dois consulter mon planning, mes tâches et faire des demandes d'échange.",
  },
  {
    role: "viewer",
    title: ACCESS_ROLE_LABELS.viewer,
    detail: "Je veux consulter le planning du bénéficiaire sans modifier l'organisation.",
  },
  {
    role: "admin",
    title: "Administrateur",
    detail: "Je crée ou gère le planning d'un bénéficiaire et les auxiliaires affectés.",
  },
];

function FirstConnectionPanel({ authState, onLogout }) {
  const [role, setRole] = useState("auxiliary");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [message, setMessage] = useState("");
  const [request, setRequest] = useState(null);
  const [saving, setSaving] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [error, setError] = useState("");
  const selected = FIRST_ROLE_CHOICES.find(choice => choice.role === role) || FIRST_ROLE_CHOICES[0];
  const adminMode = role === "admin";

  useEffect(() => {
    if (!authState.db || !authState.user) {
      setRequest(null);
      return;
    }
    setError("");
    return subscribeOwnAccessRequest({
      db: authState.db,
      user: authState.user,
      onChange: setRequest,
      onError: error => setError(`Demande d'accès indisponible : ${error.message}`),
    });
  }, [authState.db, authState.user]);

  const submit = async () => {
    if (adminMode) return becomeNewBeneficiaryAdmin();
    if (saving) return;
    setSaving(true);
    try {
      await requestAccessRole({ db: authState.db, user: authState.user, role, beneficiaryName, message });
      setMessage("");
      setError("");
      alert(`Demande envoyée : ${selected.title}.`);
    } catch (error) {
      setError(`Demande impossible : ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const becomeNewBeneficiaryAdmin = async () => {
    if (creatingAdmin) return;
    if (!beneficiaryName.trim()) {
      setError("Indiquez d'abord le nom du nouveau bénéficiaire.");
      return;
    }
    const ok = window.confirm(`Créer un nouveau bénéficiaire "${beneficiaryName.trim()}" et devenir administrateur ?`);
    if (!ok) return;
    setCreatingAdmin(true);
    try {
      await createNewBeneficiaryAdmin({ db: authState.db, user: authState.user, beneficiaryName });
      alert("Nouvel espace bénéficiaire créé. L'application va se recharger en mode administrateur.");
      window.location.reload();
    } catch (error) {
      setError(`Création admin impossible : ${error.message}`);
    } finally {
      setCreatingAdmin(false);
    }
  };

  const statusText = request?.status === "approved"
    ? "Accès validé : rechargez l'application pour entrer."
    : request?.status === "rejected"
      ? "Demande refusée : vous pouvez corriger le rôle ou le message puis renvoyer."
      : request?.status === "pending"
        ? "Demande envoyée : un administrateur doit valider l'accès."
        : adminMode
          ? "Indiquez le bénéficiaire pour créer immédiatement votre espace administrateur."
          : "Choisissez votre rôle de connexion.";

  return h("main", { className: "app first-role-app" },
    h("section", { className: "panel first-role-panel" },
      h("div", { className: "title-row" },
        h("div", null,
          h("h1", null, "Première connexion"),
          h("div", { className: "muted" }, authState.user?.email || ""),
        ),
        h(Button, { onClick: onLogout }, h(IconLabel, { icon: "logout", label: "Sortir" })),
      ),
      h("div", { className: "first-role-status" }, statusText),
      h("h3", null, "Vous vous connectez pour :"),
      h("div", { className: "first-role-grid" }, FIRST_ROLE_CHOICES.map(choice => h(Button, {
        key: choice.role,
        active: role === choice.role,
        className: "first-role-choice",
        onClick: () => setRole(choice.role),
      },
        h("b", null, choice.title),
        h("small", null, choice.detail),
      ))),
      h("div", { className: "form-grid" },
        h(Field, { label: "Bénéficiaire concerné" }, h(TextInput, {
          value: beneficiaryName,
          onChange: setBeneficiaryName,
          placeholder: "Ex : Payet Emmanuel",
        })),
        adminMode ? null : h(Field, { label: "Message pour l'administrateur" }, h(TextInput, {
          value: message,
          onChange: setMessage,
          placeholder: "Ex : nouvelle auxiliaire, famille, second admin...",
        })),
      ),
      error ? h("div", { className: "task-error" }, error) : null,
      h("div", { className: "request-actions" },
        h(Button, { active: true, disabled: saving || creatingAdmin, onClick: submit }, adminMode ? creatingAdmin ? "Création..." : "Créer l'espace admin" : saving ? "Envoi..." : "Envoyer la demande"),
        request?.status === "approved" ? h(Button, { onClick: () => window.location.reload() }, "Recharger") : null,
      ),
      adminMode ? null : h("div", { className: "new-beneficiary-admin-banner" },
        h("div", null,
          h("b", null, "Nouveau bénéficiaire ?"),
          h("small", null, "Créez un nouvel accompagnement et devenez son administrateur."),
        ),
        h(Button, { active: true, disabled: creatingAdmin, onClick: becomeNewBeneficiaryAdmin }, creatingAdmin ? "Création..." : "Devenir admin d'un nouveau bénéficiaire"),
      ),
    ),
  );
}

function GroupDashboard({ dashboard, beneficiaryName, pendingExchangeCount = 0 }) {
  const members = dashboard?.members || [];
  const activeMembers = members.filter(member => member.active !== false);
  const adminCount = activeMembers.filter(member => ["admin", "owner"].includes(member.role)).length;
  const auxiliaryCount = activeMembers.filter(member => member.role === "auxiliary").length;
  const viewerCount = activeMembers.filter(member => member.role === "viewer").length;
  const beneficiary = dashboard?.beneficiary || {};
  const activity = dashboard?.activity || [];
  const cards = [
    { label: "Admins", value: adminCount, detail: "gestion du dossier" },
    { label: "Auxiliaires", value: auxiliaryCount, detail: `${viewerCount} lecture seule` },
    { label: "Tâches ouvertes", value: dashboard?.openTasks || 0, detail: `${dashboard?.totalTasks || 0} au total` },
    { label: "Échanges", value: pendingExchangeCount, detail: "demandes en attente" },
  ];
  return h("section", { className: "panel group-dashboard" },
    h("div", { className: "title-row" },
      h("div", null,
        h("h3", null, "Tableau du groupe"),
        h("div", { className: "muted" }, beneficiaryName ? `Bénéficiaire : ${beneficiaryName}` : "Vue du dossier bénéficiaire actif."),
      ),
      h("span", { className: "role-pill saved" }, `${activeMembers.length} actif(s)`),
    ),
    h("div", { className: "group-dashboard-grid" }, cards.map(card => h("article", { key: card.label, className: "group-dashboard-card" },
      h("strong", null, card.value),
      h("span", null, card.label),
      h("small", null, card.detail),
    ))),
    h("div", { className: "group-dashboard-timeline" },
      h("div", null,
        h("span", null, "Dernière sauvegarde"),
        h("b", null, formatDashboardDate(beneficiary.latestSavedAt || beneficiary.updatedAt)),
      ),
      h("div", null,
        h("span", null, "Planning transmis"),
        h("b", null, beneficiary.latestPublishedAt ? `${formatDashboardDate(beneficiary.latestPublishedAt)} · ${beneficiary.latestPublishedPeriod || ""}` : "Pas encore"),
      ),
    ),
    h("div", { className: "group-activity" },
      h("div", { className: "title-row" },
        h("div", null,
          h("h3", null, "Historique récent"),
          h("div", { className: "muted" }, "Dernières actions visibles du dossier."),
        ),
      ),
      activity.length
        ? h("div", { className: "group-activity-list" }, activity.map(item => h("article", { key: item.id, className: `group-activity-item ${item.type || "info"}` },
            h("div", null,
              h("b", null, item.label || "Action"),
              h("small", null, [
                formatDashboardDate(item.createdAt),
                item.actorName || item.actorEmail || "",
                item.detail || "",
              ].filter(Boolean).join(" · ")),
            ),
          )))
        : h("div", { className: "muted" }, "L'historique se remplira aux prochaines sauvegardes et transmissions."),
    ),
  );
}

function AdminAccessPanel({ authState, isAdmin, globalAdmin = false, beneficiaryId, beneficiaryName, onSaveMember, onSetMemberAccess, onDeleteMember, onRepairMembers, onResolveAccessRequest }) {
  const [members, setMembers] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("auxiliary");
  const [saving, setSaving] = useState(false);
  const [repairingMembers, setRepairingMembers] = useState(false);
  const [memberBusy, setMemberBusy] = useState("");
  const [accessError, setAccessError] = useState("");
  const [memberFilter, setMemberFilter] = useState("all");
  const connectedEmail = authState.user?.email || "";

  useEffect(() => {
    if (!authState.db || !authState.user || !isAdmin) {
      setMembers([]);
      return;
    }
    setAccessError("");
    return subscribeAccessMembers({
      db: authState.db,
      user: authState.user,
      beneficiaryId,
      onChange: setMembers,
      onError: error => setAccessError(`Liste des acces indisponible : ${error.message}`),
    });
  }, [authState.db, authState.user, isAdmin, beneficiaryId]);

  useEffect(() => {
    if (!authState.db || !authState.user || !isAdmin || !globalAdmin) {
      setAccessRequests([]);
      return;
    }
    return subscribeAccessRequests({
      db: authState.db,
      user: authState.user,
      onChange: setAccessRequests,
      onError: error => setAccessError(`Demandes de connexion indisponibles : ${error.message}`),
    });
  }, [authState.db, authState.user, isAdmin, globalAdmin]);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await onSaveMember({ email, name, role });
      setEmail("");
      setName("");
      setRole("auxiliary");
      alert(`${result.email} est maintenant ${ACCESS_ROLE_LABELS[result.role] || "membre"}. La personne devra se connecter ou recharger l'app.`);
    } catch (error) {
      alert(`Invitation impossible : ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleAccess = async member => {
    const memberEmail = String(member.email || "").trim().toLowerCase();
    if (!MEMBER_EMAIL_PATTERN.test(memberEmail)) {
      alert("Cet acces n'a pas d'email valide. Réinvitez la personne avec son adresse complete.");
      return;
    }
    const nextActive = !member.active;
    const label = nextActive ? "reactiver" : "desactiver";
    if (!nextActive && !window.confirm(`Desactiver l'acces de ${member.name || member.email} ?`)) return;
    setMemberBusy(memberEmail);
    try {
      await onSetMemberAccess({
        email: memberEmail,
        role: member.role === "owner" ? "admin" : member.role,
        active: nextActive,
      });
    } catch (error) {
      alert(`Impossible de ${label} cet acces : ${error.message}`);
    } finally {
      setMemberBusy("");
    }
  };

  const deleteAccess = async member => {
    const memberEmail = String(member.email || "").trim().toLowerCase();
    if (!MEMBER_EMAIL_PATTERN.test(memberEmail)) {
      alert("Cet acces n'a pas d'email valide. Réinvitez la personne avec son adresse complete.");
      return;
    }
    if (!window.confirm(`Supprimer ${member.name || member.email} de ce bénéficiaire ?`)) return;
    setMemberBusy(memberEmail);
    try {
      await onDeleteMember({ email: memberEmail });
      alert(`${memberEmail} a été retiré du groupe.`);
    } catch (error) {
      alert(`Suppression impossible : ${error.message}`);
    } finally {
      setMemberBusy("");
    }
  };

  const answerRequest = async (request, status) => {
    try {
      await onResolveAccessRequest({ request, status });
      alert(status === "approved" ? `${request.email} est validé.` : `${request.email} est refusé.`);
    } catch (error) {
      alert(`Réponse impossible : ${error.message}`);
    }
  };
  const repairMembers = async () => {
    if (repairingMembers || !onRepairMembers) return;
    setRepairingMembers(true);
    try {
      const result = await onRepairMembers();
      alert(result.removed
        ? `Doublons fusionnés : ${result.removed} fiche(s) retirée(s).`
        : "Aucun doublon trouvé dans ce groupe.");
    } catch (error) {
      alert(`Fusion impossible : ${error.message}`);
    } finally {
      setRepairingMembers(false);
    }
  };
  const memberCounts = {
    all: members.length,
    admin: members.filter(member => ["admin", "owner"].includes(member.role) && member.active !== false).length,
    auxiliary: members.filter(member => member.role === "auxiliary" && member.active !== false).length,
    viewer: members.filter(member => member.role === "viewer" && member.active !== false).length,
    inactive: members.filter(member => member.active === false).length,
  };
  const filteredMembers = members.filter(member => {
    if (memberFilter === "all") return true;
    if (memberFilter === "inactive") return member.active === false;
    if (member.active === false) return false;
    if (memberFilter === "admin") return ["admin", "owner"].includes(member.role);
    return member.role === memberFilter;
  });
  const currentBeneficiaryLabel = normalizeBeneficiaryLabel(beneficiaryName);
  const visibleAccessRequests = accessRequests.filter(request => {
    const requestBeneficiaryLabel = normalizeBeneficiaryLabel(request.beneficiaryName);
    return !currentBeneficiaryLabel || !requestBeneficiaryLabel || requestBeneficiaryLabel === currentBeneficiaryLabel;
  });

  return h("section", { className: "panel admin-access-panel" },
    h("div", { className: "title-row" },
      h("div", null,
        h("h3", null, "Membres et roles"),
        h("div", { className: "muted" }, connectedEmail ? `Groupe ${beneficiaryName || "bénéficiaire"} · ${connectedEmail}` : "Connexion Google nécessaire."),
      ),
      h("span", { className: `role-pill ${isAdmin ? "saved" : "local"}` }, isAdmin ? "Administrateur" : "Auxiliaire"),
    ),
    isAdmin
      ? h(React.Fragment, null,
          h("div", { className: "admin-form access-form" },
            h(Field, { label: "Email utilisateur" }, h(TextInput, {
              type: "email",
              value: email,
              onChange: setEmail,
              placeholder: "adresse@email.com",
            })),
            h(Field, { label: "Nom affiche" }, h(TextInput, {
              value: name,
              onChange: setName,
              placeholder: "Prenom ou equipe",
            })),
            h(Field, { label: "Role" }, h(Select, { value: role, onChange: setRole },
              h("option", { value: "auxiliary" }, ACCESS_ROLE_LABELS.auxiliary),
              h("option", { value: "admin" }, ACCESS_ROLE_LABELS.admin),
              h("option", { value: "viewer" }, ACCESS_ROLE_LABELS.viewer),
            )),
            h(Button, { active: true, disabled: saving || !email.trim(), onClick: submit }, saving ? "Ajout..." : "Inviter"),
            h("div", { className: "muted access-help" }, "Admin : réglages et sauvegarde. Auxiliaire : planning, tâches et demandes. Lecture seule : consultation protégée."),
          ),
          accessError ? h("div", { className: "task-error" }, accessError) : null,
          h("div", { className: "access-member-tabs" }, ACCESS_MEMBER_FILTERS.map(filter => h(Button, {
            key: filter.id,
            active: memberFilter === filter.id,
            disabled: memberCounts[filter.id] === 0 && memberFilter !== filter.id,
            onClick: () => setMemberFilter(filter.id),
          }, `${filter.label} ${memberCounts[filter.id]}`)),
          h(Button, { disabled: repairingMembers, onClick: repairMembers }, repairingMembers ? "Fusion..." : "Fusionner doublons")),
          h("div", { className: "access-member-list" }, filteredMembers.length
            ? filteredMembers.map(member => {
                const isSelf = String(member.email || "").toLowerCase() === String(connectedEmail || "").toLowerCase();
                const rowBusy = memberBusy === String(member.email || "").toLowerCase();
                return h("article", { key: member.email, className: `access-member ${member.active ? "active" : "inactive"}` },
                  h("div", null,
                    h("b", null, member.name || member.email),
                    h("small", null, member.email),
                  ),
                  h("span", { className: `role-pill ${member.role === "admin" || member.role === "owner" ? "saved" : member.role === "viewer" ? "saving" : "local"}` }, ACCESS_ROLE_LABELS[member.role] || member.role),
                  h(Checkbox, {
                    checked: member.active,
                    disabled: isSelf || member.role === "owner" || rowBusy,
                    onChange: () => toggleAccess(member),
                    label: member.active ? "Actif" : "Désactivé",
                  }),
                  h(Button, {
                    className: "danger-btn",
                    disabled: isSelf || member.role === "owner" || rowBusy,
                    title: isSelf ? "Votre propre acces reste protege" : "Supprimer du groupe",
                    onClick: () => deleteAccess(member),
                  }, rowBusy ? "..." : "Supprimer"),
                );
              })
            : h("div", { className: "muted" }, members.length ? "Aucun membre dans cet onglet." : "Aucun membre charge pour le moment.")),
          h("div", { className: "access-request-list" },
            h("div", { className: "title-row" },
              h("div", null,
                h("h3", null, "Demandes de première connexion"),
                h("div", { className: "muted" }, `${visibleAccessRequests.filter(item => item.status === "pending").length} en attente pour ce groupe.`),
              ),
            ),
            globalAdmin && visibleAccessRequests.length
              ? visibleAccessRequests.slice(0, 12).map(request => {
                  const pending = request.status === "pending";
                  return h("article", { key: request.id || request.email, className: `access-request ${request.status || "pending"}` },
                    h("div", null,
                      h("b", null, request.name || request.email),
                      h("small", null, [
                        request.email,
                        ACCESS_ROLE_LABELS[request.role] || request.role,
                        request.beneficiaryName ? `Bénéficiaire : ${request.beneficiaryName}` : "",
                      ].filter(Boolean).join(" · ")),
                      request.message ? h("em", null, request.message) : null,
                    ),
                    h("span", { className: `cloud-status ${pending ? "saving" : request.status === "approved" ? "saved" : "local"}` }, pending ? "En attente" : request.status === "approved" ? "Validée" : "Refusée"),
                    pending ? h("div", { className: "request-admin-actions" },
                      h(Button, { active: true, onClick: () => answerRequest(request, "approved") }, "Valider"),
                      h(Button, { onClick: () => answerRequest(request, "rejected") }, "Refuser"),
                    ) : null,
                  );
                })
              : h("div", { className: "muted" }, globalAdmin ? "Aucune demande de première connexion." : "Invitez directement les membres de ce bénéficiaire avec leur email."),
          ),
        )
      : h("div", { className: "muted" }, "Mode auxiliaire : accès au planning personnel, demandes d'échange, tâches et courses. Demandez à un administrateur d'ajouter votre email pour gérer l'app."),
  );
}

function ConfigView({ beneficiaryId, beneficiaryName, beneficiaryOptions = [], onSelectBeneficiary, onCreateBeneficiary, beneficiarySwitching = false, setBeneficiaryName, auxiliaries, setAuxiliaries, rotationDays, setRotationDays }) {
  const beneficiaryChoices = [
    ...beneficiaryOptions,
    ...(beneficiaryId && !beneficiaryOptions.some(item => item.beneficiaryId === beneficiaryId)
      ? [{ beneficiaryId, beneficiaryName: beneficiaryName || "Bénéficiaire actuel" }]
      : []),
  ];
  const [emailDrafts, setEmailDrafts] = useState(() =>
    Object.fromEntries(auxiliaries.map(aux => [aux.id, String(aux.email || "")])));
  const emailStateKey = auxiliaries.map(aux => `${aux.id}:${aux.email || ""}`).join("|");
  useEffect(() => {
    setEmailDrafts(Object.fromEntries(auxiliaries.map(aux => [aux.id, String(aux.email || "")])));
  }, [emailStateKey]);
  const patchAux = (id, patch) => setAuxiliaries(list => list.map(aux => ({
    ...aux,
    ...(patch.lead === true && aux.id !== id ? { lead: false } : {}),
    ...(aux.id === id ? patch : {}),
  })));
  const commitAuxEmail = id => {
    const value = String(emailDrafts[id] ?? "").trim();
    patchAux(id, { email: value });
    setEmailDrafts(current => ({ ...current, [id]: value }));
  };
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
    h("div", { className: "panel beneficiary-panel" },
      h("div", { className: "title-row" },
        h("div", null,
          h("h3", null, "Bénéficiaire"),
          h("div", { className: "muted" }, "Personne accompagnée par ce planning."),
        ),
      ),
      h("div", { className: "form-grid" },
        h(Field, { label: "Dossier actif" }, h(Select, {
          value: beneficiaryId,
          disabled: beneficiarySwitching,
          onChange: value => onSelectBeneficiary?.(value),
        },
          beneficiaryChoices.map(item => h("option", {
            key: item.beneficiaryId,
            value: item.beneficiaryId,
          }, item.beneficiaryName || "Bénéficiaire sans nom")),
        )),
        h(Field, { label: "Nouveau dossier" }, h(Button, {
          active: true,
          disabled: beneficiarySwitching,
          onClick: onCreateBeneficiary,
        }, "+ Créer")),
      ),
      h(Field, { label: "Nom du bénéficiaire" }, h(TextInput, {
        value: beneficiaryName,
        onChange: setBeneficiaryName,
        placeholder: "Ex : Payet Emmanuel",
      })),
      h("div", { className: "muted beneficiary-id" }, `Identifiant unique : ${beneficiaryId || "création en cours"}`),
    ),
      h("div", { className: "panel" },
      h("div", { className: "title-row" },
        h("div", null,
          h("h3", null, "Roulement"),
          h("div", { className: "muted" }, "Choisir la logique de tour. En journée + soir, matin et apres-midi restent ensemble."),
        ),
      ),
      h("div", { className: "rotation-options" }, ROTATION_OPTIONS.map(option => h(Button, {
        key: option.value,
        active: normalizeRotationMode(rotationDays) === option.value,
        onClick: () => setRotationDays(option.value),
      }, h("span", null, option.label), h("small", null, option.detail)))),
    ),
    h("div", { className: "panel title-row" },
      h("div", null,
        h("h3", null, "Auxiliaires affectés"),
        h("div", { className: "muted" }, `${auxiliaries.filter(aux => aux.active !== false).length}/${auxiliaries.length} affecté(s) au bénéficiaire, maximum ${MAX_AUXILIARIES}`),
      ),
      h(Button, { onClick: addAux }, "+ Ajouter"),
    ),
    h("div", { className: "aux-grid" }, auxiliaries.map((aux, index) => h("div", { className: "aux-card", key: aux.id },
      h("div", { className: "title-row" },
        h("b", { style: { color: colorFor(index).text } }, aux.name || aux.id),
        h(Checkbox, { checked: aux.active, onChange: value => patchAux(aux.id, { active: value }), label: "Affecté" }),
      ),
      h("div", { className: "form-grid" },
        h(Field, { label: "Prenom complet" }, h(TextInput, { value: aux.name, onChange: value => patchAux(aux.id, { name: value }) })),
        h(Field, { label: "Email" }, h(TextInput, {
          type: "email",
          value: emailDrafts[aux.id] ?? aux.email,
          onChange: value => setEmailDrafts(current => ({ ...current, [aux.id]: value })),
          onBlur: () => commitAuxEmail(aux.id),
          onKeyDown: event => {
            if (event.key === "Enter") event.currentTarget.blur();
          },
        })),
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
  const [loginPending, setLoginPending] = useState(false);
  const [year, setYear] = useState(defaultState().year);
  const [month, setMonth] = useState(defaultState().month);
  const [view, setView] = useState("month");
  const [rotationDays, setRotationDays] = useState(defaultState().rotationDays);
  const [beneficiaryId, setBeneficiaryId] = useState(defaultState().beneficiaryId);
  const [beneficiaryName, setBeneficiaryName] = useState(defaultState().beneficiaryName);
  const [auxiliaries, setAuxiliaries] = useState(cloneDefaultAux);
  const [overrides, setOverrides] = useState({});
  const [dayOutings, setDayOutings] = useState({});
  const [slotEdit, setSlotEdit] = useState(null);
  const [mealDate, setMealDate] = useState(null);
  const [sessionRole, setSessionRole] = useState({ ready: true, isAdmin: false, role: "guest", canContribute: false, isMember: false, globalAdmin: false });
  const [personalPlanning, setPersonalPlanning] = useState(null);
  const [personalAccess, setPersonalAccess] = useState([]);
  const [personalBeneficiaryId, setPersonalBeneficiaryId] = useState("");
  const [personalError, setPersonalError] = useState("");
  const [adminChangeRequests, setAdminChangeRequests] = useState([]);
  const [adminChangeError, setAdminChangeError] = useState("");
  const [beneficiaryGroupReady, setBeneficiaryGroupReady] = useState(true);
  const [beneficiaryOptions, setBeneficiaryOptions] = useState([]);
  const [beneficiarySwitching, setBeneficiarySwitching] = useState(false);
  const [groupDashboard, setGroupDashboard] = useState(null);
  const [cloudStatus, setCloudStatus] = useState({ kind: "local", text: "Local uniquement" });
  const [accountingNow, setAccountingNow] = useState(() => new Date());
  const cloudBaseUpdatedAtRef = useRef(undefined);
  const cloudWriteReadyRef = useRef(false);
  const lastSavedSignatureRef = useRef("");
  const beneficiaryGroupSignatureRef = useRef("");
  const setCloudResult = result => {
    if (result?.cloud) {
      setCloudStatus({ kind: "saved", text: `Cloud sauvegardé ${formatCloudTime()}` });
      return;
    }
    if (result?.reason === "conflict") {
      setCloudStatus({ kind: "error", text: "Cloud plus récent" });
      return;
    }
    if (result?.reason === "not-connected") {
      setCloudStatus({ kind: "local", text: "Local enregistré" });
      return;
    }
    if (result?.reason === "pending-email") {
      setCloudStatus({ kind: "local", text: "Email à terminer" });
      return;
    }
    setCloudStatus({ kind: "error", text: "Cloud non sauvegardé" });
  };

  useEffect(() => {
    initGoogleAuth(next => setAuthState(next)).catch(error => setAuthState({ user: null, auth: null, db: null, ready: true, error: error.message }));
  }, []);

  useEffect(() => {
    if (authState.ready && authState.user) setLoginPending(false);
  }, [authState.ready, authState.user]);

  useEffect(() => {
    const openLife = () => setView("life");
    window.addEventListener("planning-avd-open-life", openLife);
    return () => window.removeEventListener("planning-avd-open-life", openLife);
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
      setSessionRole({ ready: true, isAdmin: false, role: "guest", canContribute: false, isMember: false, globalAdmin: false });
      return;
    }
    let active = true;
    let settled = false;
    setSessionRole({ ready: false, isAdmin: false, role: "guest", canContribute: false, isMember: false, globalAdmin: false });
    const unsubscribe = subscribeUserAccess({
      db: authState.db,
      user: authState.user,
      onChange: access => {
        settled = true;
        if (active) setSessionRole({ ready: true, ...access });
      },
      onError: error => console.warn("Role utilisateur indisponible.", error),
    });
    const timeout = setTimeout(() => {
      if (active && !settled) setSessionRole({ ready: true, isAdmin: false, role: "guest", canContribute: false, isMember: false, globalAdmin: false });
    }, ADMIN_ROLE_TIMEOUT_MS);
    return () => {
      active = false;
      clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [authState.ready, authState.user, authState.db]);

  const firstConnectionMode = !!authState.user && sessionRole.ready && !sessionRole.isAdmin && !sessionRole.isMember;
  const personalMode = !!authState.user && sessionRole.ready && !sessionRole.isAdmin && sessionRole.isMember;

  const activeAux = useMemo(() => auxiliaries.filter(aux => aux.active !== false), [auxiliaries]);

  useEffect(() => {
    if (!authState.db || !authState.user || !sessionRole.ready || !sessionRole.isAdmin) {
      setBeneficiaryOptions([]);
      return;
    }
    return subscribeUserBeneficiaries({
      db: authState.db,
      user: authState.user,
      onChange: setBeneficiaryOptions,
      onError: error => console.warn("Liste des bénéficiaires indisponible.", error),
    });
  }, [authState.db, authState.user, sessionRole.ready, sessionRole.isAdmin]);

  useEffect(() => {
    if (!authState.db || !authState.user || !sessionRole.ready || !sessionRole.isAdmin || !beneficiaryGroupReady || !beneficiaryId) {
      setGroupDashboard(null);
      return;
    }
    return subscribeBeneficiaryDashboard({
      db: authState.db,
      user: authState.user,
      beneficiaryId,
      onChange: setGroupDashboard,
      onError: error => console.warn("Tableau de bord groupe indisponible.", error),
    });
  }, [authState.db, authState.user, sessionRole.ready, sessionRole.isAdmin, beneficiaryGroupReady, beneficiaryId]);

  useEffect(() => {
    if (!personalMode) {
      setPersonalPlanning(null);
      setPersonalAccess([]);
      setPersonalBeneficiaryId("");
      return;
    }
    setPersonalError("");
    setPersonalPlanning(null);
    return subscribePersonalPlanning({
      db: authState.db,
      user: authState.user,
      year,
      month,
      beneficiaryId: personalBeneficiaryId,
      onAccess: setPersonalAccess,
      onChange: planning => {
        setPersonalPlanning(planning);
        if (planning && Number.isInteger(planning.year) && Number.isInteger(planning.month) && (planning.year !== year || planning.month !== month)) {
          setYear(planning.year);
          setMonth(planning.month);
        }
      },
      onError: error => setPersonalError(`Lecture du planning impossible : ${error.message}`),
    });
  }, [personalMode, authState.db, authState.user, year, month, personalBeneficiaryId]);

  useEffect(() => {
    if (!personalMode) return;
    const ids = personalAccess
      .filter(item => item.active !== false && item.beneficiaryId)
      .map(item => item.beneficiaryId);
    if (!ids.length) return;
    setPersonalBeneficiaryId(current => ids.includes(current) ? current : ids[0]);
  }, [personalMode, personalAccess]);

  useEffect(() => {
    if (!stateLoaded || !authState.db || !authState.user || !sessionRole.ready || !sessionRole.isAdmin || !beneficiaryId) {
      setBeneficiaryGroupReady(true);
      return;
    }
    if (hasIncompleteAuxEmail(activeAux)) {
      setBeneficiaryGroupReady(true);
      return;
    }
    const signature = stateSignature({
      beneficiaryId,
      beneficiaryName,
      auxiliaries: activeAux.map(aux => ({
        id: aux.id,
        name: aux.name,
        email: aux.email,
        active: aux.active !== false,
      })),
    });
    if (signature === beneficiaryGroupSignatureRef.current) {
      setBeneficiaryGroupReady(true);
      return;
    }
    let active = true;
    setBeneficiaryGroupReady(false);
    ensureBeneficiaryGroup({
      db: authState.db,
      user: authState.user,
      state: { beneficiaryId, beneficiaryName, auxiliaries: activeAux },
    }).then(() => {
      beneficiaryGroupSignatureRef.current = signature;
    }).catch(error => {
      console.warn("Synchronisation groupe bénéficiaire impossible.", error);
    }).finally(() => {
      if (active) setBeneficiaryGroupReady(true);
    });
    return () => { active = false; };
  }, [stateLoaded, authState.db, authState.user, sessionRole.ready, sessionRole.isAdmin, beneficiaryId, beneficiaryName, activeAux]);

  useEffect(() => {
    if (!authState.db || !authState.user || !sessionRole.ready || !sessionRole.isAdmin || !beneficiaryGroupReady) {
      setAdminChangeRequests([]);
      return;
    }
    setAdminChangeError("");
    return subscribeAdminChangeRequests({
      db: authState.db,
      auxiliaries: activeAux,
      beneficiaryId,
      year,
      month,
      onChange: setAdminChangeRequests,
      onError: error => setAdminChangeError(`Demandes indisponibles : ${error.message}`),
    });
  }, [authState.db, authState.user, sessionRole.ready, sessionRole.isAdmin, beneficiaryGroupReady, activeAux, beneficiaryId, year, month]);

  useEffect(() => {
    const personalAccessItem = personalAccess.find(item => item.beneficiaryId === personalBeneficiaryId)
      || personalAccess.find(item => item.beneficiaryId === personalPlanning?.beneficiaryId)
      || personalAccess[0]
      || null;
    const activeBeneficiaryId = personalMode
      ? String(personalBeneficiaryId || personalPlanning?.beneficiaryId || personalAccessItem?.beneficiaryId || "").trim()
      : beneficiaryId;
    const activeBeneficiaryName = personalMode
      ? String(personalAccessItem?.beneficiaryName || personalPlanning?.beneficiaryName || "").trim()
      : beneficiaryName;
    window.__planningAvdCurrentState = {
      year,
      month,
      view,
      rotationDays,
      beneficiaryId: activeBeneficiaryId,
      beneficiaryName: activeBeneficiaryName,
      auxiliaries,
      overrides,
      dayOutings: personalMode ? personalPlanning?.dayOutings || {} : dayOutings,
      personal: personalMode,
    };
  }, [year, month, view, rotationDays, beneficiaryId, beneficiaryName, auxiliaries, overrides, dayOutings, personalMode, personalBeneficiaryId, personalPlanning, personalAccess]);

  useEffect(() => {
    if (!authState.ready || stateLoaded) return;
    loadState({ db: authState.db, user: authState.user }).then(saved => {
      const identifiedSaved = saved ? ensureBeneficiaryIdentity(saved) : null;
      const nextState = {
        year: identifiedSaved?.year || year,
        month: Number.isInteger(identifiedSaved?.month) ? identifiedSaved.month : month,
        view: identifiedSaved?.view || view,
        rotationDays: normalizeRotationMode(identifiedSaved?.rotationDays ?? rotationDays),
        beneficiaryId: String(identifiedSaved?.beneficiaryId || beneficiaryId).trim(),
        beneficiaryName: String(identifiedSaved?.beneficiaryName || "").trim(),
        auxiliaries: identifiedSaved?.auxiliaries || identifiedSaved?.names ? normalizeAuxiliaries(identifiedSaved) : auxiliaries,
        overrides: identifiedSaved?.overrides && typeof identifiedSaved.overrides === "object" ? identifiedSaved.overrides : overrides,
        dayOutings: identifiedSaved?.dayOutings && typeof identifiedSaved.dayOutings === "object" ? normalizeDayOutings(identifiedSaved.dayOutings) : dayOutings,
      };
      const cloudMeta = saved?.__cloud || {};
      cloudWriteReadyRef.current = !authState.user || cloudMeta.ready === true;
      cloudBaseUpdatedAtRef.current = authState.user && cloudMeta.ready === true ? cloudMeta.updatedAt || "" : undefined;
      lastSavedSignatureRef.current = stateSignature(nextState);
      if (authState.user && cloudMeta.ready === false) {
        setCloudStatus({ kind: "error", text: "Lecture cloud bloquée" });
      } else if (authState.user && cloudMeta.ready === true && cloudMeta.exists) {
        setCloudStatus({ kind: "saved", text: "Cloud chargé" });
      } else if (authState.user && cloudMeta.ready === true && !cloudMeta.exists) {
        setCloudStatus({ kind: "local", text: "Aucune sauvegarde cloud" });
      }
      setYear(nextState.year);
      setMonth(nextState.month);
      setView(nextState.view);
      setRotationDays(nextState.rotationDays);
      setBeneficiaryId(nextState.beneficiaryId);
      setBeneficiaryName(nextState.beneficiaryName);
      setAuxiliaries(nextState.auxiliaries);
      setOverrides(nextState.overrides);
      setDayOutings(nextState.dayOutings);
      setStateLoaded(true);
    });
  }, [authState.ready, authState.user, stateLoaded]);

  useEffect(() => {
    if (!stateLoaded) return;
    if (authState.user && !sessionRole.ready) {
      setCloudStatus({ kind: "saving", text: "Vérification du compte..." });
      return;
    }
    if (authState.user && !sessionRole.isAdmin) {
      setCloudStatus({ kind: "local", text: "Mode auxiliaire" });
      return;
    }
    const currentState = { year, month, view, rotationDays, beneficiaryId, beneficiaryName, auxiliaries, overrides, dayOutings };
    const signature = stateSignature(currentState);
    if (signature === lastSavedSignatureRef.current) return;
    if (hasIncompleteAuxEmail(auxiliaries)) {
      setCloudStatus({ kind: "local", text: "Email à terminer" });
      const id = setTimeout(() => saveState({
        db: null,
        user: null,
        state: currentState,
      }).then(() => {
        lastSavedSignatureRef.current = signature;
      }), 450);
      return () => clearTimeout(id);
    }
    if (authState.user && !cloudWriteReadyRef.current) {
      setCloudStatus({ kind: "error", text: "Cloud protégé : rechargez" });
      return;
    }
    setCloudStatus({ kind: authState.user ? "saving" : "local", text: authState.user ? "Sauvegarde cloud..." : "Local enregistré" });
    const id = setTimeout(() => saveState({
      db: authState.db,
      user: authState.user,
      state: currentState,
      expectedUpdatedAt: authState.user ? cloudBaseUpdatedAtRef.current : undefined,
    }).then(result => {
      setCloudResult(result);
      if (result?.cloud) cloudBaseUpdatedAtRef.current = result.updatedAt || cloudBaseUpdatedAtRef.current;
      if (result?.cloud || result?.reason === "not-connected") lastSavedSignatureRef.current = signature;
    }), 450);
    return () => clearTimeout(id);
  }, [stateLoaded, authState.user, authState.db, sessionRole.ready, sessionRole.isAdmin, year, month, view, rotationDays, beneficiaryId, beneficiaryName, auxiliaries, overrides, dayOutings]);

  const planning = useMemo(() => buildSchedule({ year, month, auxiliaries: activeAux, rotationDays }), [year, month, activeAux, rotationDays]);
  const schedule = useMemo(() => applyOverrides({ schedule: planning.schedule, overrides, year, month }), [planning.schedule, overrides, year, month]);
  const hours = useMemo(
    () => calculatePerformedHours(schedule, auxiliaries, { year, month, now: accountingNow }),
    [schedule, auxiliaries, year, month, accountingNow],
  );
  const rotationChecks = useMemo(() => buildRotationAudit({ year, month, auxiliaries: activeAux, schedule, hours, rotationDays }), [year, month, activeAux, schedule, hours, rotationDays]);
  const manualOverrides = useMemo(() => buildManualOverrideList({ overrides, year, month, auxiliaries }), [overrides, year, month, auxiliaries]);
  const planningView = ["month", "week", "hours"].includes(view);
  const requireSafeCloudWrite = () => {
    if (!authState.user || cloudWriteReadyRef.current) return true;
    alert("Sauvegarde bloquée par sécurité : cet appareil n'a pas réussi à lire le cloud. Rechargez l'app avant de sauvegarder.");
    setCloudStatus({ kind: "error", text: "Cloud protégé : rechargez" });
    return false;
  };
  const saveStateWithOverwriteOption = async currentState => {
    const baseResult = await saveState({
      db: authState.db,
      user: authState.user,
      state: currentState,
      expectedUpdatedAt: authState.user ? cloudBaseUpdatedAtRef.current : undefined,
    });
    if (baseResult?.reason !== "conflict") return baseResult;
    const overwrite = window.confirm([
      "Une version cloud plus récente existe.",
      "",
      "Voulez-vous écraser le cloud avec la version affichée sur cet appareil ?",
      "À utiliser seulement si cette version est la bonne.",
    ].join("\n"));
    if (!overwrite) return { ...baseResult, reason: "overwrite-cancelled", error: "Écrasement cloud annulé." };
    setCloudStatus({ kind: "saving", text: "Écrasement cloud..." });
    const forcedResult = await saveState({
      db: authState.db,
      user: authState.user,
      state: currentState,
      force: true,
    });
    return forcedResult?.cloud ? { ...forcedResult, forced: true } : forcedResult;
  };
  const updateDayOutings = (key, items) => setDayOutings(current => {
    const cleaned = normalizeDayOutings({ [key]: items })[key] || [];
    const next = { ...current };
    if (cleaned.length) next[key] = cleaned;
    else delete next[key];
    return next;
  });

  const openReport = () => {
    const html = buildReportHtml({ year, month, beneficiaryName, auxiliaries: activeAux, schedule, hours });
    openHtmlDocument({
      html,
      fileName: `rapport-planning-avd-${year}-${String(month + 1).padStart(2, "0")}.html`,
      blockedMessage: "Le navigateur a bloqué l'ouverture du rapport. Je l'ai téléchargé à la place.",
    });
  };

  const openCleanView = () => {
    const html = buildCleanPlanningHtml({ year, month, beneficiaryName, auxiliaries: activeAux, schedule });
    openHtmlDocument({
      html,
      fileName: `planning-avd-impression-${year}-${String(month + 1).padStart(2, "0")}.html`,
      blockedMessage: "Le navigateur a bloqué l'ouverture de la vue imprimée. Je l'ai téléchargée à la place.",
    });
  };

  const publishPlanning = async () => {
    if (!requireSafeCloudWrite()) return;
    if (!activeAux.some(aux => String(aux.email || "").trim())) {
      alert("Sauvegarde bloquée : ajoutez au moins un email auxiliaire avant de transmettre le planning.");
      return;
    }
    const incompleteEmailAux = firstIncompleteAuxEmail(activeAux);
    if (incompleteEmailAux) {
      alert(`Sauvegarde bloquée : terminez l'email de ${incompleteEmailAux.name || "cet auxiliaire"} avant de transmettre le planning.`);
      return;
    }
    try {
      setCloudStatus({ kind: "saving", text: "Sauvegarde cloud..." });
      const currentState = { year, month, view, rotationDays, beneficiaryId, beneficiaryName, auxiliaries, overrides, dayOutings };
      const signature = stateSignature(currentState);
      const cloudResult = await saveStateWithOverwriteOption(currentState);
      setCloudResult(cloudResult);
      if (!cloudResult?.cloud) {
        alert(cloudResult?.reason === "overwrite-cancelled"
          ? "Sauvegarde annulée : la version cloud a été conservée."
          : cloudResult?.reason === "conflict"
          ? "Sauvegarde bloquée : une version cloud plus récente existe. Rechargez l'app avant de republier."
          : `Sauvegarde cloud impossible : ${cloudResult?.error || "réessayez plus tard."}`);
        return;
      }
      cloudBaseUpdatedAtRef.current = cloudResult.updatedAt || cloudBaseUpdatedAtRef.current;
      lastSavedSignatureRef.current = signature;
      const count = await publishPersonalPlannings({ db: authState.db, user: authState.user, year, month, beneficiaryId, beneficiaryName, auxiliaries: activeAux, schedule, hours, dayOutings });
      alert(`Planning sauvegardé pour ${count} auxiliaire(s). ${cloudResult?.forced ? "Cloud écrasé volontairement." : "Sauvegarde cloud à jour."}`);
    } catch (error) {
      alert(`Sauvegarde impossible : ${error.message}`);
    }
  };

  const saveAccessMember = async ({ email, name, role }) => {
    return grantMemberRole({ db: authState.db, user: authState.user, email, name, role, beneficiaryId, beneficiaryName });
  };

  const changeMemberAccess = async ({ email, role, active }) => {
    return setMemberAccess({ db: authState.db, user: authState.user, email, role, active, beneficiaryId, beneficiaryName });
  };

  const removeAccessMember = async ({ email }) => {
    return deleteMemberAccess({ db: authState.db, user: authState.user, email, beneficiaryId, beneficiaryName });
  };

  const repairAccessMembers = async () => {
    return repairBeneficiaryMembers({ db: authState.db, user: authState.user, beneficiaryId });
  };

  const answerAccessRequest = async ({ request, status }) => {
    return resolveAccessRequest({ db: authState.db, user: authState.user, request, status, beneficiaryId, beneficiaryName });
  };

  const approveChangeRequest = async (request, workerId) => {
    if (!requireSafeCloudWrite()) return;
    const worker = activeAux.find(aux => aux.id === workerId);
    if (!worker) return alert("Choisissez l'auxiliaire qui reprend le créneau.");
    try {
      const key = overrideKey(request.year, request.month, request.day, request.shift);
      const nextOverrides = { ...overrides, [key]: worker.id };
      const nextSchedule = applyOverrides({ schedule: planning.schedule, overrides: nextOverrides, year, month });
      const nextHours = calculatePerformedHours(nextSchedule, auxiliaries, { year, month, now: accountingNow });
      const nextState = { year, month, view, rotationDays, beneficiaryId, beneficiaryName, auxiliaries, overrides: nextOverrides, dayOutings };
      const signature = stateSignature(nextState);
      const cloudResult = await saveState({
        db: authState.db,
        user: authState.user,
        state: nextState,
        expectedUpdatedAt: authState.user ? cloudBaseUpdatedAtRef.current : undefined,
      });
      setCloudResult(cloudResult);
      if (!cloudResult?.cloud) {
        alert(cloudResult?.reason === "conflict"
          ? "Validation bloquée : une version cloud plus récente existe. Rechargez l'app avant de valider."
          : `Validation bloquée : ${cloudResult?.error || "cloud non sauvegardé."}`);
        return;
      }
      cloudBaseUpdatedAtRef.current = cloudResult.updatedAt || cloudBaseUpdatedAtRef.current;
      lastSavedSignatureRef.current = signature;
      setOverrides(nextOverrides);
      await publishPersonalPlannings({ db: authState.db, user: authState.user, year, month, beneficiaryId, beneficiaryName, auxiliaries: activeAux, schedule: nextSchedule, hours: nextHours, dayOutings });
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

  const applyRestoredPlanningState = next => {
    if (!next || !Array.isArray(next.auxiliaries)) throw new Error("Format de sauvegarde incomplet.");
    const identifiedNext = ensureBeneficiaryIdentity({
      ...next,
      beneficiaryName: String(next.beneficiaryName || beneficiaryName || "").trim(),
    });
    const nextYear = Number(next.year);
    const nextMonth = Number(next.month);
    const nextRotation = normalizeRotationMode(next.rotationDays);
    if (!Number.isInteger(nextYear) || !Number.isInteger(nextMonth) || nextMonth < 0 || nextMonth > 11) {
      throw new Error("Mois ou annee invalide.");
    }
    const restoredState = {
      year: nextYear,
      month: nextMonth,
      view: ["month", "week", "hours", "config"].includes(next.view) ? next.view : "month",
      rotationDays: nextRotation,
      beneficiaryId: identifiedNext.beneficiaryId,
      beneficiaryName: String(identifiedNext.beneficiaryName || "").trim(),
      auxiliaries: normalizeAuxiliaries({ auxiliaries: next.auxiliaries }),
      overrides: next.overrides && typeof next.overrides === "object" ? next.overrides : {},
      dayOutings: normalizeDayOutings(next.dayOutings),
    };
    setYear(restoredState.year);
    setMonth(restoredState.month);
    setView(restoredState.view);
    setRotationDays(restoredState.rotationDays);
    setBeneficiaryId(restoredState.beneficiaryId);
    setBeneficiaryName(restoredState.beneficiaryName);
    setAuxiliaries(restoredState.auxiliaries);
    setOverrides(restoredState.overrides);
    setDayOutings(restoredState.dayOutings);
    return restoredState;
  };

  const selectBeneficiary = async nextBeneficiaryId => {
    const cleanId = String(nextBeneficiaryId || "").trim();
    if (!cleanId || cleanId === beneficiaryId || beneficiarySwitching) return;
    setBeneficiarySwitching(true);
    try {
      const next = await loadBeneficiaryState({ db: authState.db, user: authState.user, beneficiaryId: cleanId });
      const restored = applyRestoredPlanningState(next);
      beneficiaryGroupSignatureRef.current = "";
      lastSavedSignatureRef.current = "";
      setCloudStatus({ kind: "saving", text: `Dossier ${restored.beneficiaryName || "bénéficiaire"} chargé` });
    } catch (error) {
      alert(`Changement de bénéficiaire impossible : ${error.message}`);
    } finally {
      setBeneficiarySwitching(false);
    }
  };

  const createBeneficiary = () => {
    if (beneficiarySwitching) return;
    const name = window.prompt("Nom du nouveau bénéficiaire ?");
    const cleanName = String(name || "").trim();
    if (!cleanName) return;
    const now = new Date();
    const next = {
      ...defaultState(),
      year: now.getFullYear(),
      month: now.getMonth(),
      view: "config",
      beneficiaryId: createBeneficiaryId(cleanName),
      beneficiaryName: cleanName,
      auxiliaries: cloneDefaultAux(),
      overrides: {},
      dayOutings: {},
    };
    applyRestoredPlanningState(next);
    beneficiaryGroupSignatureRef.current = "";
    lastSavedSignatureRef.current = "";
    setCloudStatus({ kind: "saving", text: "Nouveau dossier créé" });
  };

  const shareBackup = async () => {
    const backup = {
      app: "Planning-AVD",
      version: 1,
      exportedAt: new Date().toISOString(),
      state: { year, month, view, rotationDays, beneficiaryId, beneficiaryName, auxiliaries, overrides, dayOutings },
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
      applyRestoredPlanningState(next);
      alert("Sauvegarde restauree. Elle sera aussi sauvegardee dans le cloud si vous etes connecte.");
    } catch (error) {
      alert(`Sauvegarde impossible a restaurer : ${error.message}`);
    }
  };

  const restoreCloudBackup = async () => {
    if (!authState.user || !sessionRole.isAdmin) return alert("Connexion administrateur necessaire.");
    if (!window.confirm("Restaurer la sauvegarde de secours du debut du mois ? La version actuelle sera gardee en secours si elle n'a pas deja ete archivee ce mois-ci.")) return;
    try {
      const backup = await loadRestoreBackup({ db: authState.db, user: authState.user });
      const restored = applyRestoredPlanningState(backup.value);
      cloudWriteReadyRef.current = true;
      cloudBaseUpdatedAtRef.current = backup.currentUpdatedAt || cloudBaseUpdatedAtRef.current;
      setCloudStatus({ kind: "saving", text: "Secours restauré" });
      alert(`Sauvegarde de secours restauree : ${MONTHS[restored.month]} ${restored.year}. Elle va redevenir la sauvegarde cloud active.`);
    } catch (error) {
      alert(`Restauration secours impossible : ${error.message}`);
    }
  };

  const startLogin = async () => {
    if (loginPending) return;
    setLoginPending(true);
    try {
      await signInWithGoogle(authState.auth);
    } catch (error) {
      alert(`Connexion impossible : ${error.message}`);
    } finally {
      window.setTimeout(() => setLoginPending(false), 800);
    }
  };

  if (firstConnectionMode) return h(FirstConnectionPanel, { authState, onLogout: () => signOut(authState.auth) });
  if (personalMode) return h(PersonalView, { authState, sessionRole, year, month, setYear, setMonth, planning: personalPlanning, access: personalAccess, selectedBeneficiaryId: personalBeneficiaryId, onSelectBeneficiary: setPersonalBeneficiaryId, error: personalError, onLogout: () => signOut(authState.auth) });

  return h("main", { className: `app${view === "life" ? " life-view" : ""}${!authState.user ? " disconnected-app" : ""}` },
    h(TopBar, {
      authState,
      sessionRole,
      isAdmin: sessionRole.isAdmin,
      roleReady: sessionRole.ready,
      cloudStatus,
      view,
      setView,
      year,
      month,
      beneficiaryName,
      loginPending,
      setYear,
      setMonth,
      onLogin: startLogin,
      onLogout: () => signOut(authState.auth),
      onCleanView: openCleanView,
      onReport: openReport,
      onShareBackup: shareBackup,
      onRestoreBackup: restoreBackup,
      onRestoreCloudBackup: restoreCloudBackup,
      onPublish: publishPlanning,
    }),
    h("div", { className: "layout" },
      view === "life" ? h(TaskPanel, { authState, isAdmin: sessionRole.isAdmin, auxiliaries: activeAux, year, month, beneficiaryId }) : null,
      planningView ? h(Summary, { auxiliaries: activeAux, hours }) : null,
      planningView ? h(RotationAudit, { checks: rotationChecks }) : null,
      planningView ? h(AdminChangeRequestsPanel, { requests: adminChangeRequests, error: adminChangeError, auxiliaries: activeAux, onApprove: approveChangeRequest, onReject: rejectChangeRequest }) : null,
      planningView ? h(ManualOverridesPanel, { items: manualOverrides, onReset: key => setOverrides(current => { const next = { ...current }; delete next[key]; return next; }) }) : null,
      view === "month" ? h(MonthView, { year, month, schedule, auxiliaries, overrides, onEditSlot: setSlotEdit, onOpenMeal: setMealDate }) : null,
      view === "week" ? h(WeekView, { year, month, schedule, auxiliaries, overrides, onEditSlot: setSlotEdit, onOpenMeal: setMealDate }) : null,
      view === "hours" ? h(HoursView, { auxiliaries: activeAux, hours }) : null,
      view === "config" ? h(GroupDashboard, { dashboard: groupDashboard, beneficiaryName, pendingExchangeCount: adminChangeRequests.filter(request => request.status === "pending").length }) : null,
      view === "config" ? h(AdminAccessPanel, { authState, isAdmin: sessionRole.isAdmin, globalAdmin: sessionRole.globalAdmin, beneficiaryId, beneficiaryName, onSaveMember: saveAccessMember, onSetMemberAccess: changeMemberAccess, onDeleteMember: removeAccessMember, onRepairMembers: repairAccessMembers, onResolveAccessRequest: answerAccessRequest }) : null,
      view === "config" ? h(ConfigView, { beneficiaryId, beneficiaryName, beneficiaryOptions, beneficiarySwitching, onSelectBeneficiary: selectBeneficiary, onCreateBeneficiary: createBeneficiary, setBeneficiaryName, auxiliaries, setAuxiliaries, rotationDays, setRotationDays }) : null,
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
    h(MealPlannerModal, { selectedDate: mealDate, onClose: () => setMealDate(null), dayOutings, onDayOutingsChange: updateDayOutings }),
  );
}
