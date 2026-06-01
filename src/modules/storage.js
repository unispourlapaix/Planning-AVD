const LOCAL_KEY = "planning-avd-state-v2";
const ROTATION_REVISION = 1;
const monthKey = (year, month) => `${year}-${String(month + 1).padStart(2, "0")}`;
const emailKey = email => encodeURIComponent(String(email || "").trim().toLowerCase());
const migrateState = state => {
  if (!state || state.rotationRevision === ROTATION_REVISION) return state;
  return { ...state, overrides: {}, rotationRevision: ROTATION_REVISION };
};

export const defaultState = () => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    view: "month",
    rotationDays: 1,
    auxiliaries: null,
    updatedAt: "",
  };
};

export async function loadState({ db, user }) {
  const local = migrateState(JSON.parse(localStorage.getItem(LOCAL_KEY) || "null"));
  if (!db || !user?.uid) return local;
  try {
    const snap = await db.collection("planning-avd-users").doc(user.uid).collection("app").doc("state").get();
    return snap.exists ? migrateState(snap.data().value) : local;
  } catch (error) {
    console.warn("Lecture cloud impossible, repli local.", error);
    return local;
  }
}

export async function saveState({ db, user, state }) {
  const value = { ...state, rotationRevision: ROTATION_REVISION, updatedAt: new Date().toISOString() };
  localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
  if (!db || !user?.uid) return;
  try {
    await db.collection("planning-avd-users").doc(user.uid).collection("app").doc("state").set({
      value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: user.email || "",
    }, { merge: true });
  } catch (error) {
    console.warn("Sauvegarde cloud impossible, conservee en local.", error);
  }
}

export async function isAdminUser({ db, user }) {
  if (!db || !user?.uid) return false;
  try {
    const snap = await db.collection("planning-avd-admins").doc(user.uid).get();
    return snap.exists;
  } catch (error) {
    console.warn("Verification admin impossible.", error);
    return false;
  }
}

export function subscribePersonalPlanning({ db, user, year, month, onChange, onError }) {
  if (!db || !user?.email) return () => {};
  return db.collection("planning-avd-shares").doc(emailKey(user.email)).collection("months").doc(monthKey(year, month))
    .onSnapshot(snap => onChange?.(snap.exists ? snap.data() : null), error => onError?.(error));
}

export async function publishPersonalPlannings({ db, user, year, month, auxiliaries, schedule, hours }) {
  if (!db || !user?.uid) throw new Error("Connexion admin necessaire.");
  const active = auxiliaries.filter(aux => aux.active && String(aux.email || "").trim());
  if (!active.length) throw new Error("Ajoutez au moins un email auxiliaire dans Reglages.");
  const batch = db.batch();
  active.forEach(aux => {
    const entries = [];
    Object.values(schedule).forEach(plan => {
      ["morning", "afternoon", "night"].forEach(shift => {
        const workers = Array.isArray(plan?.[shift]?.workers) ? plan[shift].workers : [plan?.[shift]?.worker];
        if (workers.filter(Boolean).includes(aux.id)) entries.push({ day: plan.day, shift, hours: plan[shift]?.hours || 0 });
      });
    });
    const email = String(aux.email).trim().toLowerCase();
    const ref = db.collection("planning-avd-shares").doc(emailKey(email)).collection("months").doc(monthKey(year, month));
    batch.set(ref, {
      email,
      name: aux.name,
      year,
      month,
      entries,
      hours: hours[aux.id] || { morning: 0, afternoon: 0, night: 0, total: 0, quota: Number(aux.quota) || 0 },
      publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
      publishedBy: user.email || "",
    });
  });
  await batch.commit();
  return active.length;
}
