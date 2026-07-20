import { SHIFT_DEFS } from "./constants.js";
import { buildSchedule } from "./scheduler-handover.js?v=20260720-hour-quota";
import { calculatePerformedHours } from "./hour-accounting.js";
import { isAdminUser, loadState } from "./storage.js?v=20260702-login-refresh";
import { sharePlanningByEmail } from "./planning-share.js?v=20260720-morning-rule";

const LOCAL_KEY = "planning-avd-state-v2";
const lineIcon = path => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"></path></svg>`;
const overrideKey = (year, month, day, shift) => `${year}-${month}-${day}-${shift}`;
const applyOverrides = ({ schedule, overrides = {}, year, month }) => Object.fromEntries(
  Object.entries(schedule).map(([day, plan]) => [day, {
    ...plan,
    ...Object.fromEntries(SHIFT_DEFS.map(shift => {
      const worker = overrides[overrideKey(year, month, day, shift.id)];
      return [shift.id, worker ? { ...plan[shift.id], worker, workers: [worker] } : plan[shift.id]];
    })),
  }]),
);

const waitForActions = () => new Promise(resolve => {
  const find = () => {
    const actions = document.querySelector(".action-row");
    if (actions) resolve(actions);
    else setTimeout(find, 120);
  };
  find();
});

const renameSaveButton = actions => {
  const saveButton = [...actions.querySelectorAll("button")]
    .find(item => item.textContent.includes("Publier"));
  if (saveButton) saveButton.innerHTML = `${lineIcon("M7 18a4 4 0 0 1 .7-7.9A6 6 0 0 1 19 12a3 3 0 0 1 0 6H7ZM10 15l2 2 4-5")}<span>Sauvegarder</span>`;
};

const waitForFirebase = () => new Promise(resolve => {
  const find = () => {
    if (globalThis.firebase?.auth && globalThis.firebase?.firestore) resolve();
    else setTimeout(find, 120);
  };
  find();
});

const emailCount = state => (state?.auxiliaries || [])
  .filter(aux => aux?.active !== false)
  .map(aux => String(aux.email || "").trim())
  .filter(Boolean)
  .length;

const scoreState = state => {
  if (!state || !Array.isArray(state.auxiliaries)) return -1;
  return emailCount(state) * 1000 + state.auxiliaries.length;
};

const bestPlanningSource = (...states) => states
  .filter(Boolean)
  .sort((a, b) => scoreState(b) - scoreState(a))[0] || null;

export async function initPlanningShareButton() {
  const initialActions = await waitForActions();
  renameSaveButton(initialActions);
  new MutationObserver(() => renameSaveButton(initialActions))
    .observe(initialActions, { childList: true, subtree: true, characterData: true });
  await waitForFirebase();
  const auth = firebase.auth();
  const db = firebase.firestore();

  auth.onAuthStateChanged(async user => {
    document.getElementById("planning-share-button")?.remove();
    if (!user?.uid) return;
    const isAdmin = await isAdminUser({ db, user });
    if (!isAdmin) return;

    const actions = await waitForActions();
    if (document.getElementById("planning-share-button")) return;
    renameSaveButton(actions);
    const button = document.createElement("button");
    button.id = "planning-share-button";
    button.className = "btn active icon-only menu-icon has-tooltip";
    button.title = "Partager planning / Share schedule";
    button.setAttribute("aria-label", "Partager planning");
    button.dataset.tooltip = "Partager planning / Share schedule";
    button.dataset.action = "share-planning";
    button.innerHTML = lineIcon("M4 6h16v12H4V6ZM4 7l8 6 8-6");
    button.addEventListener("click", async () => {
      try {
        const current = globalThis.__planningAvdCurrentState || null;
        const saved = await loadState({ db, user });
        if (!current && saved?.__cloud?.ready === false) throw new Error("Lecture cloud bloquée : rechargez l'app avant de partager.");
        const local = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
        const source = bestPlanningSource(current, saved, local);
        const auxiliaries = (source?.auxiliaries || []).filter(aux => aux.active !== false);
        if (!auxiliaries.length) throw new Error("Ajoutez les auxiliaires dans Reglages.");
        if (!emailCount({ auxiliaries })) throw new Error("Aucun email auxiliaire trouve. Ouvrez Reglages puis renseignez le champ Email des auxiliaires.");
        const year = source.year;
        const month = source.month;
        const planning = buildSchedule({ year, month, auxiliaries, rotationDays: source.rotationDays });
        const schedule = applyOverrides({ schedule: planning.schedule, overrides: source.overrides, year, month });
        const hours = calculatePerformedHours(schedule, auxiliaries, { year, month });
        await sharePlanningByEmail({ db, user, year, month, beneficiaryId: source.beneficiaryId || "", beneficiaryName: source.beneficiaryName || "", auxiliaries, schedule, hours, dayOutings: source.dayOutings || {} });
      } catch (error) {
        alert(`Partage impossible : ${error.message}`);
      }
    });
    actions.prepend(button);
  });
}
