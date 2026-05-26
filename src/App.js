import { DEFAULT_AUXILIARIES, DAYS_SHORT, MAX_AUXILIARIES, MONTHS, PALETTE, SHIFT_DEFS, SHIFT_LABEL } from "./modules/constants.js";
import { dayName, monthGrid, weekStarts } from "./modules/dates.js";
import { buildSchedule, calculateHours } from "./modules/scheduler.js";
import { initGoogleAuth, signInWithGoogle, signOut } from "./modules/auth.js";
import { defaultState, loadState, saveState } from "./modules/storage.js";
import { buildReportHtml } from "./modules/report.js";
import { Button, Checkbox, Field, h, Select, TextInput } from "./ui.js";

const { useEffect, useMemo, useState } = React;

const ROTATION_OPTIONS = [
  { value: 1, label: "Jour par jour", detail: "Matin, apres-midi et nuit recalcules chaque jour." },
  { value: 2, label: "Roulement 2 jours", detail: "La personne finit le matin, la suivante commence l'apres-midi." },
  { value: 3, label: "Roulement 3 jours", detail: "Bloc plus stable, toujours termine au matin." },
  { value: 4, label: "Roulement 4 jours", detail: "Longue presence, passage au suivant apres le matin." },
];
const SHIFT_COMPACT_LABEL = { morning: "AM", afternoon: "PM", night: "SR" };

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
const shiftWorkerIds = entry => Array.isArray(entry?.workers) ? entry.workers.filter(Boolean) : (entry?.worker ? [entry.worker] : []);

function TopBar({ authState, view, setView, year, month, setYear, setMonth, onLogin, onLogout, onReport }) {
  const moveMonth = delta => {
    const date = new Date(year, month + delta, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth());
  };

  const tabs = [
    ["month", "📅", "Mois"],
    ["week", "📋", "Semaine"],
    ["hours", "⏱", "Heures"],
    ["config", "⚙️", "Réglages"],
  ];

  return h("header", { className: "topbar" },
    h("div", { className: "title-row" },
      h("div", null, h("h1", null, "Planning-AVD"), h("div", { className: "muted" }, authState.user ? `Cloud actif : ${authState.user.email}` : "Sauvegarde locale, connexion Google disponible")),
      h("div", { className: "action-row" },
        h(Button, { onClick: onReport }, "📄 Rapport"),
        authState.user
          ? h(Button, { active: true, onClick: onLogout }, "Connecté")
          : h(Button, { onClick: onLogin }, "Connexion Google"),
      ),
    ),
    authState.error ? h("div", { className: "muted" }, authState.error) : null,
    h("div", { className: "month-row" },
      h(Button, { onClick: () => moveMonth(-1) }, "‹"),
      h("h2", { style: { margin: 0 } }, `${MONTHS[month]} ${year}`),
      h(Button, { onClick: () => moveMonth(1) }, "›"),
    ),
    h("nav", { className: "tabs" }, tabs.map(tab => h(Button, {
      key: tab[0],
      active: view === tab[0],
      className: "tab",
      onClick: () => setView(tab[0]),
    }, h("span", { className: "tab-icon" }, tab[1]), h("span", null, tab[2])))),
  );
}

function Summary({ auxiliaries, hours }) {
  return h("section", { className: "summary" }, auxiliaries.map((aux, index) => {
    const hData = hours[aux.id] || { total: 0, quota: aux.quota || 0 };
    const c = colorFor(index);
    return h("div", { className: "panel", key: aux.id },
      h("div", { className: "pill", style: { background: c.light, color: c.text } }, aux.lead ? "Chef" : "Auxiliaire", " · ", aux.name),
      h("div", { className: "muted", style: { marginTop: 8 } }, `${hData.total}h / ${hData.quota}h`),
      h("div", { className: "progress" }, h("span", { style: { width: `${Math.min(100, Math.round((hData.total / Math.max(1, hData.quota)) * 100))}%`, background: c.solid } })),
    );
  }));
}

function DayCard({ day, year, month, plan, auxiliaries }) {
  if (!day) return h("div", { className: "day-card empty" });
  return h("div", { className: "day-card" },
    h("div", { className: "day-head" }, h("span", null, day), h("span", null, dayName(year, month, day))),
    SHIFT_DEFS.map(shift => {
      const workers = shiftWorkerIds(plan?.[shift.id]);
      const worker = workers[0];
      const index = Math.max(0, auxiliaries.findIndex(aux => aux.id === worker));
      const c = colorFor(index);
      return h("div", { className: "slot", key: shift.id },
        h("span", { className: "slot-label", title: SHIFT_LABEL[shift.id] }, SHIFT_COMPACT_LABEL[shift.id] || SHIFT_LABEL[shift.id]),
        h("span", { className: "slot-name", style: { color: worker ? c.text : "#746d61" } }, workers.length ? workers.map(id => auxName(auxiliaries, id)).join(" + ") : "A definir"),
      );
    }),
  );
}

function MonthView({ year, month, schedule, auxiliaries }) {
  return h("section", { className: "layout" },
    h("div", { className: "calendar" },
      DAYS_SHORT.map((day, index) => h("div", { key: `d-${index}`, className: "dow" }, day)),
      monthGrid(year, month).map((day, index) => h(DayCard, { key: `${day || "empty"}-${index}`, day, year, month, plan: day ? schedule[day] : null, auxiliaries })),
    ),
  );
}

function WeekView({ year, month, schedule, auxiliaries }) {
  return h("section", { className: "week-grid" }, weekStarts(year, month).map(start => {
    const days = Array.from({ length: 7 }, (_, i) => start + i).filter(day => schedule[day]);
    return h("div", { className: "panel", key: start },
      h("h3", null, `Semaine du ${start} ${MONTHS[month]}`),
      h("div", { className: "week-days" }, days.map(day => h(DayCard, { key: day, day, year, month, plan: schedule[day], auxiliaries }))),
    );
  }));
}

function HoursView({ auxiliaries, hours }) {
  return h("section", { className: "hours-grid" },
    h("div", { className: "panel" },
      h("h3", null, "Planning technique comptable"),
      h("p", { className: "muted" }, "Les heures sont reparties automatiquement sur les jours travailles : 6h matin, 6h apres-midi, 12h nuit. Le moteur respecte les options activees sur chaque auxiliaire et garde le tour a tour."),
    ),
    auxiliaries.map((aux, index) => {
      const hData = hours[aux.id] || {};
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
          h("span", null, `En pause : ${Math.round(((hData.quota || aux.quota) - (hData.total || 0)) * 100) / 100}h`),
        ),
      );
    }),
  );
}

function ConfigView({ auxiliaries, setAuxiliaries, rotationDays, setRotationDays }) {
  const patchAux = (id, patch) => setAuxiliaries(list => list.map(aux => aux.id === id ? { ...aux, ...patch } : aux));
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
        h(Field, { label: "Creneaux autorises" }, h(Select, { value: aux.shift, onChange: value => patchAux(aux.id, { shift: value }) },
          h("option", { value: "all" }, "Jour et nuit"),
          h("option", { value: "morning" }, "Matin seulement"),
          h("option", { value: "afternoon" }, "Soir seulement"),
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
      h(Checkbox, { checked: aux.lead, onChange: value => patchAux(aux.id, { lead: value }), label: "Chef d'equipe prioritaire en semaine" }),
      h(Checkbox, { checked: aux.night || aux.shift === "all", onChange: value => patchAux(aux.id, { night: value }), label: aux.shift === "all" ? "Nuit incluse avec Jour et nuit" : "Peut faire la surveillance de nuit 12h" }),
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

  useEffect(() => {
    initGoogleAuth(next => setAuthState(next)).catch(error => setAuthState({ user: null, auth: null, db: null, ready: true, error: error.message }));
  }, []);

  useEffect(() => {
    if (!authState.ready || stateLoaded) return;
    loadState({ db: authState.db, user: authState.user }).then(saved => {
      if (saved?.year) setYear(saved.year);
      if (Number.isInteger(saved?.month)) setMonth(saved.month);
      if (saved?.view) setView(saved.view);
      if ([1, 2, 3, 4].includes(Number(saved?.rotationDays))) setRotationDays(Number(saved.rotationDays));
      if (saved?.auxiliaries || saved?.names) setAuxiliaries(normalizeAuxiliaries(saved));
      setStateLoaded(true);
    });
  }, [authState.ready, authState.user, stateLoaded]);

  useEffect(() => {
    if (!stateLoaded) return;
    const id = setTimeout(() => saveState({
      db: authState.db,
      user: authState.user,
      state: { year, month, view, rotationDays, auxiliaries },
    }), 450);
    return () => clearTimeout(id);
  }, [stateLoaded, authState.user, authState.db, year, month, view, rotationDays, auxiliaries]);

  const activeAux = useMemo(() => auxiliaries.filter(aux => aux.active), [auxiliaries]);
  const planning = useMemo(() => buildSchedule({ year, month, auxiliaries: activeAux, rotationDays }), [year, month, activeAux, rotationDays]);
  const hours = useMemo(() => calculateHours(planning.schedule, auxiliaries), [planning.schedule, auxiliaries]);

  const openReport = () => {
    const html = buildReportHtml({ year, month, auxiliaries: activeAux, schedule: planning.schedule, hours });
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  return h("main", { className: "app" },
    h(TopBar, {
      authState,
      view,
      setView,
      year,
      month,
      setYear,
      setMonth,
      onLogin: () => signInWithGoogle(authState.auth).catch(error => alert(error.message)),
      onLogout: () => signOut(authState.auth),
      onReport: openReport,
    }),
    h("div", { className: "layout" },
      h(Summary, { auxiliaries: activeAux, hours }),
      view === "month" ? h(MonthView, { year, month, schedule: planning.schedule, auxiliaries }) : null,
      view === "week" ? h(WeekView, { year, month, schedule: planning.schedule, auxiliaries }) : null,
      view === "hours" ? h(HoursView, { auxiliaries: activeAux, hours }) : null,
      view === "config" ? h(ConfigView, { auxiliaries, setAuxiliaries, rotationDays, setRotationDays }) : null,
    ),
  );
}
