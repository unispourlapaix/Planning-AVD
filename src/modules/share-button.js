import { SHIFT_DEFS } from "./constants.js";
import { buildSchedule, calculateHours } from "./scheduler-handover.js?v=20260601-saturday-morning";
import { loadState } from "./storage.js";
import { sharePlanningByEmail } from "./planning-share.js?v=20260602-gmail-tab";

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

export function initPlanningShareButton() {
  if (!globalThis.firebase?.auth || !globalThis.firebase?.firestore) return;
  const auth = firebase.auth();
  const db = firebase.firestore();

  auth.onAuthStateChanged(async user => {
    document.getElementById("planning-share-button")?.remove();
    if (!user?.uid) return;
    const admin = await db.collection("planning-avd-admins").doc(user.uid).get().catch(() => null);
    if (!admin?.exists) return;

    const actions = await waitForActions();
    if (document.getElementById("planning-share-button")) return;
    const button = document.createElement("button");
    button.id = "planning-share-button";
    button.className = "btn active";
    button.textContent = "✉ Partager planning";
    button.addEventListener("click", async () => {
      try {
        const saved = await loadState({ db, user });
        const auxiliaries = (saved?.auxiliaries || []).filter(aux => aux.active !== false);
        if (!auxiliaries.length) throw new Error("Ajoutez les auxiliaires dans Reglages.");
        const year = saved.year;
        const month = saved.month;
        const planning = buildSchedule({ year, month, auxiliaries, rotationDays: saved.rotationDays });
        const schedule = applyOverrides({ schedule: planning.schedule, overrides: saved.overrides, year, month });
        const hours = calculateHours(schedule, auxiliaries);
        await sharePlanningByEmail({ db, user, year, month, auxiliaries, schedule, hours });
      } catch (error) {
        alert(`Partage impossible : ${error.message}`);
      }
    });
    actions.prepend(button);
  });
}
