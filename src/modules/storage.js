import { summarizeHours } from "./hour-accounting.js";

const LOCAL_KEY = "planning-avd-state-v2";
const ROTATION_REVISION = 1;
const monthKey = (year, month) => `${year}-${String(month + 1).padStart(2, "0")}`;
const normalizeEmail = email => String(email || "").trim().toLowerCase();
const encodedEmailKey = email => encodeURIComponent(normalizeEmail(email));
const shareEmailKey = email => normalizeEmail(email).replaceAll("/", "%2F");
const uniqueShareKeys = email => [...new Set([shareEmailKey(email), encodedEmailKey(email)].filter(Boolean))];
const shiftWorkerIds = entry => Array.isArray(entry?.workers) ? entry.workers.filter(Boolean) : (entry?.worker ? [entry.worker] : []);
const primaryWorkerId = entry => shiftWorkerIds(entry)[0] || "";
const displayHours = summarizeHours;
const migrateState = state => {
  if (!state || state.rotationRevision === ROTATION_REVISION) return state;
  return { ...state, overrides: {}, rotationRevision: ROTATION_REVISION };
};
const readLocalState = () => {
  try {
    return migrateState(JSON.parse(localStorage.getItem(LOCAL_KEY) || "null"));
  } catch {
    return null;
  }
};
const stripStateMeta = state => Object.fromEntries(Object.entries(state || {}).filter(([key]) => !key.startsWith("__")));
const withLoadMeta = (state, meta) => ({
  ...(state || {}),
  __cloud: meta,
});
const hasAuxiliaries = state => Array.isArray(state?.auxiliaries) && state.auxiliaries.length > 0;
const mergeSavedState = (local, cloud) => {
  if (!cloud) return local;
  if (!local) return cloud;
  return {
    ...local,
    ...cloud,
    auxiliaries: hasAuxiliaries(cloud) ? cloud.auxiliaries : local.auxiliaries,
    overrides: cloud.overrides && typeof cloud.overrides === "object" ? cloud.overrides : local.overrides,
    dayOutings: cloud.dayOutings && typeof cloud.dayOutings === "object" ? cloud.dayOutings : local.dayOutings,
  };
};

export const defaultState = () => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    view: "month",
    rotationDays: 1,
    auxiliaries: null,
    dayOutings: {},
    updatedAt: "",
  };
};

export async function loadState({ db, user }) {
  const local = readLocalState();
  if (!db || !user?.uid) return withLoadMeta(local, { ready: false, exists: false, source: local ? "local" : "empty", reason: "not-connected" });
  try {
    const snap = await db.collection("planning-avd-users").doc(user.uid).collection("app").doc("state").get();
    const cloud = snap.exists ? migrateState(snap.data().value) : null;
    return withLoadMeta(snap.exists ? mergeSavedState(local, cloud) : local, {
      ready: true,
      exists: snap.exists,
      source: snap.exists ? "cloud" : local ? "local" : "empty",
      updatedAt: cloud?.updatedAt || "",
    });
  } catch (error) {
    console.warn("Lecture cloud impossible, repli local.", error);
    return withLoadMeta(local, {
      ready: false,
      exists: false,
      source: local ? "local" : "empty",
      reason: "error",
      error: error.message || "Lecture cloud impossible",
    });
  }
}

export async function saveState({ db, user, state, expectedUpdatedAt, force = false }) {
  const value = { ...stripStateMeta(state), rotationRevision: ROTATION_REVISION, updatedAt: new Date().toISOString() };
  localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
  if (!db || !user?.uid) return { local: true, cloud: false, reason: "not-connected" };
  try {
    const ref = db.collection("planning-avd-users").doc(user.uid).collection("app").doc("state");
    if (!force) {
      const currentSnap = await ref.get();
      const currentUpdatedAt = currentSnap.exists ? currentSnap.data()?.value?.updatedAt || "" : "";
      const expectedProvided = expectedUpdatedAt !== undefined;
      if (currentSnap.exists && (!expectedProvided || currentUpdatedAt !== expectedUpdatedAt)) {
        return {
          local: true,
          cloud: false,
          reason: "conflict",
          error: "Une sauvegarde cloud plus récente existe. Rechargez avant de sauvegarder.",
          currentUpdatedAt,
        };
      }
    }
    await ref.set({
      value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: user.email || "",
    }, { merge: true });
    return { local: true, cloud: true, updatedAt: value.updatedAt };
  } catch (error) {
    console.warn("Sauvegarde cloud impossible, conservee en local.", error);
    return { local: true, cloud: false, reason: "error", error: error.message || "Sauvegarde cloud impossible" };
  }
}

export async function isAdminUser({ db, user }) {
  if (!db || !user?.uid) return false;
  try {
    const uidSnap = await db.collection("planning-avd-admins").doc(user.uid).get();
    if (uidSnap.exists) return true;
    const email = normalizeEmail(user.email);
    if (!email) return false;
    const emailIdSnap = await db.collection("planning-avd-admins").doc(email).get();
    if (emailIdSnap.exists && emailIdSnap.data()?.active !== false) return true;
    const legacySnap = await db.collection("planning-avd-admins").where("email", "==", email).limit(1).get();
    if (!legacySnap.empty) return legacySnap.docs.some(doc => doc.data()?.active !== false);
    const emailSnap = await db.collection("planning-avd-admin-emails").doc(email).get();
    return emailSnap.exists && emailSnap.data()?.active !== false;
  } catch (error) {
    console.warn("Verification admin impossible.", error);
    return false;
  }
}

export async function grantAdminByEmail({ db, user, email }) {
  const cleanEmail = normalizeEmail(email);
  if (!db || !user?.uid) throw new Error("Connexion admin necessaire.");
  if (!cleanEmail || !cleanEmail.includes("@")) throw new Error("Email administrateur invalide.");
  await db.collection("planning-avd-admins").doc(cleanEmail).set({
    email: cleanEmail,
    active: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: normalizeEmail(user.email),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return cleanEmail;
}

export function subscribePersonalPlanning({ db, user, year, month, onChange, onError }) {
  if (!db || !user?.email) return () => {};
  const email = normalizeEmail(user.email);
  const monthId = monthKey(year, month);
  const refs = uniqueShareKeys(email).map(key => db.collection("planning-avd-shares").doc(key).collection("months").doc(monthId));
  let directPending = refs.length;
  let queryUnsubscribe = null;
  let active = true;
  let hasDirectPlanning = false;
  const stopQuery = () => {
    queryUnsubscribe?.();
    queryUnsubscribe = null;
  };
  const startQueryFallback = () => {
    if (queryUnsubscribe || !active || hasDirectPlanning) return;
    queryUnsubscribe = db.collectionGroup("months")
      .where("email", "==", email)
      .where("year", "==", year)
      .where("month", "==", month)
      .limit(1)
      .onSnapshot(snapshot => {
        if (!active) return;
        onChange?.(snapshot.empty ? null : snapshot.docs[0].data());
      }, error => {
        console.warn("Recherche planning auxiliaire impossible.", error);
        if (active) onChange?.(null);
        onError?.(error);
      });
  };
  const directUnsubscribers = refs.map(ref => ref.onSnapshot(snap => {
      if (!active) return;
      directPending = Math.max(0, directPending - 1);
      if (snap.exists) {
        hasDirectPlanning = true;
        stopQuery();
        onChange?.(snap.data());
        return;
      }
      if (directPending === 0 && !hasDirectPlanning) startQueryFallback();
    }, error => {
      console.warn("Lecture planning auxiliaire directe impossible.", error);
      directPending = Math.max(0, directPending - 1);
      if (directPending === 0 && !hasDirectPlanning) startQueryFallback();
    }));
  return () => {
    active = false;
    directUnsubscribers.forEach(unsubscribe => unsubscribe());
    stopQuery();
  };
}

const changeRequestCollection = ({ db, email, year, month }) =>
  db.collection("planning-avd-change-requests").doc(encodedEmailKey(email)).collection("months").doc(monthKey(year, month)).collection("items");

const requestSnapshotList = snapshot => snapshot.docs
  .map(doc => ({ id: doc.id, ...doc.data() }))
  .sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || a.day - b.day || String(a.shift).localeCompare(String(b.shift)));

export function subscribePersonalChangeRequests({ db, user, year, month, onChange, onError }) {
  if (!db || !user?.email) return () => {};
  return changeRequestCollection({ db, email: user.email, year, month })
    .onSnapshot(snapshot => onChange?.(requestSnapshotList(snapshot)), error => onError?.(error));
}

export function subscribeAdminChangeRequests({ db, auxiliaries, year, month, onChange, onError }) {
  if (!db) return () => {};
  const emails = [...new Set(auxiliaries.map(aux => String(aux.email || "").trim().toLowerCase()).filter(Boolean))];
  if (!emails.length) {
    onChange?.([]);
    return () => {};
  }
  const buckets = new Map();
  const emit = () => onChange?.([...buckets.values()].flat().sort((a, b) =>
    (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1)
    || a.day - b.day
    || String(a.shift).localeCompare(String(b.shift))));
  const unsubscribers = emails.map(email => changeRequestCollection({ db, email, year, month })
    .onSnapshot(snapshot => {
      buckets.set(email, requestSnapshotList(snapshot));
      emit();
    }, error => onError?.(error)));
  return () => unsubscribers.forEach(unsubscribe => unsubscribe());
}

export async function createPlanningChangeRequest({ db, user, planning, year, month, day, shift, targetEmail, targetName, message }) {
  if (!db || !user?.email) throw new Error("Connexion necessaire.");
  const email = String(user.email).trim().toLowerCase();
  const ref = changeRequestCollection({ db, email, year, month }).doc();
  await ref.set({
    requesterEmail: email,
    requesterName: planning?.name || user.displayName || email,
    year,
    month,
    period: monthKey(year, month),
    day,
    shift,
    targetEmail: String(targetEmail || "").trim().toLowerCase(),
    targetName: String(targetName || "").trim(),
    message: String(message || "").trim(),
    status: "pending",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

export async function resolvePlanningChangeRequest({ db, user, request, status, workerId, workerName }) {
  if (!db || !user?.uid) throw new Error("Connexion admin necessaire.");
  if (!request?.requesterEmail || !request?.id) throw new Error("Demande introuvable.");
  await changeRequestCollection({ db, email: request.requesterEmail, year: request.year, month: request.month }).doc(request.id).set({
    status,
    resolvedWorkerId: workerId || "",
    resolvedWorkerName: workerName || "",
    resolvedBy: user.email || "",
    resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function publishPersonalPlannings({ db, user, year, month, auxiliaries, schedule, hours, dayOutings = {} }) {
  if (!db || !user?.uid) throw new Error("Connexion admin necessaire.");
  const active = auxiliaries.filter(aux => aux.active && String(aux.email || "").trim());
  if (!active.length) throw new Error("Ajoutez au moins un email auxiliaire dans Reglages.");
  const batch = db.batch();
  const findName = id => auxiliaries.find(aux => aux.id === id)?.name || "A definir";
  const outingPrefix = `${year}-${month}-`;
  const sharedDayOutings = Object.fromEntries(Object.entries(dayOutings && typeof dayOutings === "object" ? dayOutings : {})
    .filter(([key, items]) => key.startsWith(outingPrefix) && Array.isArray(items) && items.length));
  auxiliaries
    .filter(aux => String(aux.email || "").trim())
    .forEach(aux => {
      const email = String(aux.email).trim().toLowerCase();
      const memberRef = db.collection("planning-avd-team-members").doc(email);
      batch.set(memberRef, {
        email,
        name: aux.name,
        active: aux.active !== false,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: user.email || "",
      }, { merge: true });
    });
  const team = active.map(aux => ({
    name: aux.name || "A definir",
    email: String(aux.email || "").trim().toLowerCase(),
  }));
  const calendar = Object.values(schedule).map(plan => ({
    day: plan.day,
    shifts: Object.fromEntries(["morning", "afternoon", "night"].map(shift => {
      const worker = primaryWorkerId(plan?.[shift]);
      return [shift, worker ? [findName(worker)] : []];
    })),
  }));
  active.forEach(aux => {
    const entries = [];
    Object.values(schedule).forEach(plan => {
      ["morning", "afternoon", "night"].forEach(shift => {
        if (primaryWorkerId(plan?.[shift]) === aux.id) entries.push({ day: plan.day, shift });
      });
    });
    const email = String(aux.email).trim().toLowerCase();
    const sharePayload = {
      email,
      name: aux.name,
      year,
      month,
      entries,
      calendar,
      team,
      dayOutings: sharedDayOutings,
      hours: displayHours(hours[aux.id], aux.quota),
      publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
      publishedBy: user.email || "",
    };
    uniqueShareKeys(email).forEach(key => {
      const ref = db.collection("planning-avd-shares").doc(key).collection("months").doc(monthKey(year, month));
      batch.set(ref, sharePayload);
    });
  });
  await batch.commit();
  return active.length;
}
