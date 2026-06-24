import { SHIFT_DEFS } from "./constants.js";
import { buildSchedule } from "./scheduler-handover.js?v=20260614-meals-quota";
import { calculatePerformedHours } from "./hour-accounting.js";
import { isAdminUser, loadState } from "./storage.js?v=20260624-personal-planning";
import { sharePlanningByEmail } from "./planning-share.js?v=20260624-personal-planning";

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
    button.className = "btn active";
    button.innerHTML = `${lineIcon("M4 6h16v12H4V6ZM4 7l8 6 8-6")}<span>Partager planning</span>`;
    button.addEventListener("click", async () => {
      try {
        const local = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
        const saved = local?.auxiliaries?.length ? local : await loadState({ db, user });
        const auxiliaries = (saved?.auxiliaries || []).filter(aux => aux.active !== false);
        if (!auxiliaries.length) throw new Error("Ajoutez les auxiliaires dans Reglages.");
        const year = saved.year;
        const month = saved.month;
        const planning = buildSchedule({ year, month, auxiliaries, rotationDays: saved.rotationDays });
        const schedule = applyOverrides({ schedule: planning.schedule, overrides: saved.overrides, year, month });
        const hours = calculatePerformedHours(schedule, auxiliaries, { year, month });
        await sharePlanningByEmail({ db, user, year, month, auxiliaries, schedule, hours, dayOutings: saved.dayOutings || {} });
      } catch (error) {
        alert(`Partage impossible : ${error.message}`);
      }
    });
    actions.prepend(button);
  });
}
