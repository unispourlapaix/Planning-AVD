const LOCAL_KEY = "planning-avd-state-v2";
const ROTATION_REVISION = 1;
const monthKey = (year, month) => `${year}-${String(month + 1).padStart(2, "0")}`;
const cleanEmail = email => String(email || "").trim();
const normalizeEmail = email => String(email || "").trim().toLowerCase();
const encodedEmailKey = email => encodeURIComponent(cleanEmail(email));
const shareEmailKey = email => cleanEmail(email).replaceAll("/", "%2F");
const uniqueEmailKeys = email => {
  const raw = cleanEmail(email);
  const lower = normalizeEmail(email);
  return [...new Set([shareEmailKey(raw), shareEmailKey(lower), encodedEmailKey(raw), encodedEmailKey(lower)].filter(Boolean))];
};
const uniqueShareKeys = uniqueEmailKeys;
const shiftWorkerIds = entry => Array.isArray(entry?.workers) ? entry.workers.filter(Boolean) : (entry?.worker ? [entry.worker] : []);
const primaryWorkerId = entry => shiftWorkerIds(entry)[0] || "";
const nearbyMonths = (year, month) => {
  const offsets = [0, ...Array.from({ length: 12 }, (_, index) => index + 1).flatMap(offset => [-offset, offset])];
  return offsets.map(offset => {
    const date = new Date(year, month + offset, 1);
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      id: monthKey(date.getFullYear(), date.getMonth()),
    };
  });
};
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
const stateMonthKey = value => `${Number(value?.year) || new Date().getFullYear()}-${String((Number(value?.month) || 0) + 1).padStart(2, "0")}`;
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
    beneficiaryName: "",
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
    const userRef = db.collection("planning-avd-users").doc(user.uid);
    const appRef = userRef.collection("app");
    const ref = appRef.doc("state");
    const currentSnap = await ref.get();
    const currentUpdatedAt = currentSnap.exists ? currentSnap.data()?.value?.updatedAt || "" : "";
    const expectedProvided = expectedUpdatedAt !== undefined;
    if (!force && currentSnap.exists && (!expectedProvided || currentUpdatedAt !== expectedUpdatedAt)) {
      return {
        local: true,
        cloud: false,
        reason: "conflict",
        error: "Une sauvegarde cloud plus récente existe. Rechargez avant de sauvegarder.",
        currentUpdatedAt,
      };
    }
    const currentValue = currentSnap.exists ? migrateState(currentSnap.data()?.value) : null;
    if (currentValue && hasAuxiliaries(currentValue)) {
      const restoreMonth = stateMonthKey(currentValue);
      const monthRestoreRef = userRef.collection("restore-months").doc(restoreMonth);
      const monthRestoreSnap = await monthRestoreRef.get();
      const restorePayload = {
        value: currentValue,
        month: restoreMonth,
        sourceUpdatedAt: currentUpdatedAt,
        savedAt: firebase.firestore.FieldValue.serverTimestamp(),
        savedBy: user.email || "",
      };
      if (!monthRestoreSnap.exists) {
        await Promise.all([
          appRef.doc("restore").set(restorePayload, { merge: true }),
          monthRestoreRef.set(restorePayload),
        ]);
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

export async function loadRestoreBackup({ db, user }) {
  if (!db || !user?.uid) throw new Error("Connexion admin necessaire.");
  const appRef = db.collection("planning-avd-users").doc(user.uid).collection("app");
  const [snap, stateSnap] = await Promise.all([
    appRef.doc("restore").get(),
    appRef.doc("state").get(),
  ]);
  if (!snap.exists || !snap.data()?.value) throw new Error("Aucune sauvegarde de restauration disponible.");
  return {
    value: migrateState(snap.data().value),
    month: snap.data()?.month || stateMonthKey(snap.data().value),
    sourceUpdatedAt: snap.data()?.sourceUpdatedAt || "",
    currentUpdatedAt: stateSnap.exists ? stateSnap.data()?.value?.updatedAt || "" : "",
  };
}

export async function isAdminUser({ db, user }) {
  if (!db || !user?.uid) return false;
  try {
    const uidSnap = await db.collection("planning-avd-admins").doc(user.uid).get();
    if (uidSnap.exists) return uidSnap.data()?.active !== false;
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

const ACCESS_ROLES = ["admin", "auxiliary", "viewer"];

const normalizeAccessRole = role => ACCESS_ROLES.includes(role) ? role : "auxiliary";

const roleRank = role => ({ owner: 0, admin: 1, auxiliary: 2, viewer: 3 }[role] ?? 4);

export async function getUserAccess({ db, user }) {
  if (!db || !user?.uid) return { isAdmin: false, role: "guest", canContribute: false, isMember: false };
  const admin = await isAdminUser({ db, user });
  if (admin) return { isAdmin: true, role: "admin", canContribute: true, isMember: true };
  const email = normalizeEmail(user.email);
  if (!email) return { isAdmin: false, role: "guest", canContribute: false, isMember: false };
  try {
    const snap = await db.collection("planning-avd-team-members").doc(email).get();
    if (!snap.exists || snap.data()?.active === false) {
      return { isAdmin: false, role: "guest", canContribute: false, isMember: false };
    }
    const role = normalizeAccessRole(snap.data()?.role);
    return { isAdmin: false, role, canContribute: role !== "viewer", isMember: true };
  } catch (error) {
    console.warn("Verification role utilisateur impossible.", error);
    return { isAdmin: false, role: "guest", canContribute: false, isMember: false };
  }
}

function normalizeMemberDoc(doc, source) {
  const data = doc.data() || {};
  const email = normalizeEmail(data.emailLower || data.email || doc.id);
  if (!email) return null;
  const role = source === "admin"
    ? (data.role === "owner" ? "owner" : "admin")
    : normalizeAccessRole(data.role);
  return {
    id: doc.id,
    email,
    name: String(data.name || data.displayName || data.email || email).trim(),
    role,
    active: data.active !== false,
    source,
    updatedBy: data.updatedBy || data.createdBy || "",
  };
}

function mergeAccessMembers(adminDocs, teamDocs) {
  const members = new Map();
  [...teamDocs, ...adminDocs].forEach(member => {
    if (!member?.email) return;
    const current = members.get(member.email);
    if (!current
      || (member.active && !current.active)
      || (member.active === current.active && roleRank(member.role) < roleRank(current.role))) {
      members.set(member.email, { ...current, ...member });
      return;
    }
    members.set(member.email, {
      ...current,
      active: current.active || member.active,
      name: current.name || member.name,
    });
  });
  return [...members.values()].sort((a, b) =>
    Number(b.active) - Number(a.active)
    || roleRank(a.role) - roleRank(b.role)
    || a.name.localeCompare(b.name));
}

export function subscribeAccessMembers({ db, user, onChange, onError }) {
  if (!db || !user?.uid) return () => {};
  let admins = [];
  let team = [];
  const emit = () => onChange?.(mergeAccessMembers(admins, team));
  const adminUnsubscribe = db.collection("planning-avd-admins").onSnapshot(snapshot => {
    admins = snapshot.docs.map(doc => normalizeMemberDoc(doc, "admin")).filter(Boolean);
    emit();
  }, error => onError?.(error));
  const teamUnsubscribe = db.collection("planning-avd-team-members").onSnapshot(snapshot => {
    team = snapshot.docs.map(doc => normalizeMemberDoc(doc, "team")).filter(Boolean);
    emit();
  }, error => onError?.(error));
  return () => {
    adminUnsubscribe();
    teamUnsubscribe();
  };
}

export async function grantMemberRole({ db, user, email, role = "auxiliary", name = "" }) {
  const clean = normalizeEmail(email);
  const cleanRole = normalizeAccessRole(role);
  const cleanName = String(name || "").trim().slice(0, 80);
  if (!db || !user?.uid) throw new Error("Connexion admin necessaire.");
  if (!clean || !clean.includes("@")) throw new Error("Email invalide.");
  if (clean === normalizeEmail(user.email) && cleanRole !== "admin") throw new Error("Votre propre acces administrateur reste protege.");
  const common = {
    email: clean,
    emailLower: clean,
    name: cleanName,
    role: cleanRole,
    active: true,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: normalizeEmail(user.email),
  };
  const writes = [
    db.collection("planning-avd-team-members").doc(clean).set({
      ...common,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: normalizeEmail(user.email),
    }, { merge: true }),
  ];
  if (cleanRole === "admin") {
    writes.push(db.collection("planning-avd-admins").doc(clean).set({
      ...common,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: normalizeEmail(user.email),
    }, { merge: true }));
  } else {
    writes.push(db.collection("planning-avd-admins").doc(clean).set({
      email: clean,
      emailLower: clean,
      active: false,
      role: "admin",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: normalizeEmail(user.email),
    }, { merge: true }));
  }
  await Promise.all(writes);
  return { email: clean, role: cleanRole };
}

export async function setMemberAccess({ db, user, email, role = "auxiliary", active = true }) {
  const clean = normalizeEmail(email);
  const cleanRole = normalizeAccessRole(role);
  if (!db || !user?.uid) throw new Error("Connexion admin necessaire.");
  if (!clean || !clean.includes("@")) throw new Error("Email invalide.");
  if (!active && clean === normalizeEmail(user.email)) throw new Error("Vous ne pouvez pas desactiver votre propre acces.");
  if (active) return grantMemberRole({ db, user, email: clean, role: cleanRole });
  const payload = {
    active: false,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: normalizeEmail(user.email),
  };
  await Promise.all([
    db.collection("planning-avd-team-members").doc(clean).set({ email: clean, emailLower: clean, ...payload }, { merge: true }),
    db.collection("planning-avd-admins").doc(clean).set({ email: clean, emailLower: clean, ...payload }, { merge: true }),
  ]);
  return { email: clean, role: cleanRole, active: false };
}

export async function grantAdminByEmail({ db, user, email }) {
  const result = await grantMemberRole({ db, user, email, role: "admin" });
  return result.email;
}

export function subscribePersonalPlanning({ db, user, year, month, onChange, onError }) {
  if (!db || !user?.email) return () => {};
  const rawEmail = cleanEmail(user.email);
  const monthId = monthKey(year, month);
  const shareKeys = uniqueShareKeys(rawEmail);
  const refs = shareKeys.map(key => db.collection("planning-avd-shares").doc(key).collection("months").doc(monthId));
  let directPending = refs.length;
  let active = true;
  let hasDirectPlanning = false;
  let nearbySearchStarted = false;
  const queryByEmail = async (field, value) => {
    if (!value) return null;
    try {
      const snapshot = await db.collectionGroup("months").where(field, "==", value).limit(12).get();
      return snapshot.docs
        .map(doc => doc.data())
        .find(item => Number.isInteger(item?.year) && Number.isInteger(item?.month)) || null;
    } catch (error) {
      console.warn("Recherche planning auxiliaire impossible.", error);
      return null;
    }
  };
  const startNearbyFallback = async () => {
    if (nearbySearchStarted || !active || hasDirectPlanning) return;
    nearbySearchStarted = true;
    for (const candidate of nearbyMonths(year, month).filter(item => item.id !== monthId)) {
      for (const key of shareKeys) {
        try {
          const snap = await db.collection("planning-avd-shares").doc(key).collection("months").doc(candidate.id).get();
          if (!active || hasDirectPlanning) return;
          if (snap.exists) {
            onChange?.(snap.data());
            return;
          }
        } catch {}
      }
    }
    const queried = await queryByEmail("email", normalizeEmail(rawEmail)) || await queryByEmail("emailOriginal", rawEmail);
    if (active && queried) {
      onChange?.(queried);
      return;
    }
    if (active && !hasDirectPlanning) onChange?.(null);
  };
  const directUnsubscribers = refs.map(ref => ref.onSnapshot(snap => {
      if (!active) return;
      directPending = Math.max(0, directPending - 1);
      if (snap.exists) {
        hasDirectPlanning = true;
        onChange?.(snap.data());
        return;
      }
      if (directPending === 0 && !hasDirectPlanning) startNearbyFallback();
    }, error => {
      console.warn("Lecture planning auxiliaire directe impossible.", error);
      directPending = Math.max(0, directPending - 1);
      if (directPending === 0 && !hasDirectPlanning) startNearbyFallback();
    }));
  return () => {
    active = false;
    directUnsubscribers.forEach(unsubscribe => unsubscribe());
  };
}

const changeRequestCollection = ({ db, email, year, month }) =>
  db.collection("planning-avd-change-requests").doc(encodedEmailKey(normalizeEmail(email))).collection("months").doc(monthKey(year, month)).collection("items");

const requestSnapshotList = snapshot => snapshot.docs
  .map(doc => ({ id: doc.id, ...doc.data() }))
  .sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || a.day - b.day || String(a.shift).localeCompare(String(b.shift)));

export function subscribePersonalChangeRequests({ db, user, year, month, onChange, onError }) {
  if (!db || !user?.email) return () => {};
  const email = cleanEmail(user.email);
  return changeRequestCollection({ db, email: user.email, year, month })
    .where("requesterEmail", "==", email)
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
  const email = cleanEmail(user.email);
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

export function buildPersonalSharePayloads({ year, month, beneficiaryName = "", auxiliaries, schedule, dayOutings = {}, publishedAt = null, publishedBy = "" }) {
  const active = auxiliaries.filter(aux => aux.active !== false && String(aux.email || "").trim());
  const findName = id => auxiliaries.find(aux => aux.id === id)?.name || "A definir";
  const outingPrefix = `${year}-${month}-`;
  const sharedDayOutings = Object.fromEntries(Object.entries(dayOutings && typeof dayOutings === "object" ? dayOutings : {})
    .filter(([key, items]) => key.startsWith(outingPrefix) && Array.isArray(items) && items.length));
  const team = active.map(aux => ({
    name: aux.name || "A definir",
  }));
  const calendar = Object.values(schedule).map(plan => ({
    day: plan.day,
    shifts: Object.fromEntries(["morning", "afternoon", "night"].map(shift => {
      const worker = primaryWorkerId(plan?.[shift]);
      return [shift, worker ? [findName(worker)] : []];
    })),
  }));
  return active.map(aux => {
    const entries = [];
    Object.values(schedule).forEach(plan => {
      ["morning", "afternoon", "night"].forEach(shift => {
        if (primaryWorkerId(plan?.[shift]) === aux.id) entries.push({ day: plan.day, shift });
      });
    });
    const rawEmail = cleanEmail(aux.email);
    const email = normalizeEmail(rawEmail);
    const readEmails = [...new Set([rawEmail, email].filter(Boolean))];
    const sharePayload = {
      email,
      emailOriginal: rawEmail,
      readEmails,
      name: aux.name,
      beneficiaryName: String(beneficiaryName || "").trim(),
      year,
      month,
      entries,
      calendar,
      team,
      dayOutings: sharedDayOutings,
      ...(publishedAt ? { publishedAt } : {}),
      publishedBy,
    };
    return { aux, rawEmail, email, sharePayload };
  });
}

export async function publishPersonalPlannings({ db, user, year, month, beneficiaryName = "", auxiliaries, schedule, dayOutings = {} }) {
  if (!db || !user?.uid) throw new Error("Connexion admin necessaire.");
  const payloads = buildPersonalSharePayloads({
    year,
    month,
    beneficiaryName,
    auxiliaries,
    schedule,
    dayOutings,
    publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
    publishedBy: user.email || "",
  });
  if (!payloads.length) throw new Error("Aucun email auxiliaire trouve. Ouvrez Reglages puis renseignez le champ Email des auxiliaires.");
  const batch = db.batch();
  auxiliaries
    .filter(aux => String(aux.email || "").trim())
    .forEach(aux => {
      const rawEmail = cleanEmail(aux.email);
      const email = normalizeEmail(rawEmail);
      uniqueEmailKeys(rawEmail).forEach(key => {
        const memberRef = db.collection("planning-avd-team-members").doc(key);
        batch.set(memberRef, {
          email: rawEmail,
          emailLower: email,
          name: aux.name,
          active: aux.active !== false,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: user.email || "",
        }, { merge: true });
      });
    });
  payloads.forEach(({ rawEmail, sharePayload }) => {
    uniqueShareKeys(rawEmail).forEach(key => {
      const ref = db.collection("planning-avd-shares").doc(key).collection("months").doc(monthKey(year, month));
      batch.set(ref, sharePayload);
    });
  });
  await batch.commit();
  return payloads.length;
}
