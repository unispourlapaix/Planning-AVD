import { breakNoticeForSlot } from "./break-rules.js?v=20260722-custom-hours";

const LOCAL_KEY = "planning-avd-state-v2";
const ROTATION_REVISION = 1;
const monthKey = (year, month) => `${year}-${String(month + 1).padStart(2, "0")}`;
const cleanEmail = email => String(email || "").trim();
const normalizeEmail = email => String(email || "").trim().toLowerCase();
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const normalizeEmailCandidate = value => {
  const raw = cleanEmail(value);
  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();
  const match = [raw, decoded]
    .map(candidate => candidate.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0])
    .find(Boolean);
  return normalizeEmail(match || decoded || raw);
};
const firstValidEmail = (...values) =>
  values.map(normalizeEmailCandidate).find(value => EMAIL_PATTERN.test(value)) || "";
const emailProfileKey = value => {
  const email = firstValidEmail(value);
  if (!email) return "";
  const [local = "", domain = ""] = email.split("@");
  if (["gmail.com", "googlemail.com"].includes(domain)) {
    return `${local.split("+")[0].replaceAll(".", "")}@gmail.com`;
  }
  return email;
};
const encodedEmailKey = email => encodeURIComponent(cleanEmail(email));
const shareEmailKey = email => cleanEmail(email).replaceAll("/", "%2F");
const safeToken = value => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 28);
export const createBeneficiaryId = seed => {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 10)
    || Math.random().toString(36).slice(2, 12);
  return `ben-${safeToken(seed) || "beneficiaire"}-${Date.now().toString(36)}-${random}`;
};
const uniqueEmailKeys = email => {
  const raw = cleanEmail(email);
  const lower = normalizeEmail(email);
  return [...new Set([shareEmailKey(raw), shareEmailKey(lower), encodedEmailKey(raw), encodedEmailKey(lower)].filter(Boolean))];
};
const uniqueShareKeys = uniqueEmailKeys;
const timestampScore = value => {
  if (!value) return 0;
  if (Number.isFinite(value.seconds)) return Number(value.seconds);
  if (Number.isFinite(value._seconds)) return Number(value._seconds);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed / 1000 : 0;
};
const sortPersonalPlans = plans => [...plans].sort((a, b) =>
  timestampScore(b?.publishedAt || b?.updatedAt) - timestampScore(a?.publishedAt || a?.updatedAt)
  || String(b?.beneficiaryId || "").localeCompare(String(a?.beneficiaryId || ""))
  || String(a?.beneficiaryName || "").localeCompare(String(b?.beneficiaryName || "")));
const sortBeneficiaryAccess = items => [...items].sort((a, b) =>
  roleRank(a.role) - roleRank(b.role)
  || String(b.updatedAt?.seconds || b.updatedAt || "").localeCompare(String(a.updatedAt?.seconds || a.updatedAt || ""))
  || String(a.beneficiaryName || "").localeCompare(String(b.beneficiaryName || "")));
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
export const ensureBeneficiaryIdentity = state => {
  if (!state) return state;
  const beneficiaryId = String(state.beneficiaryId || "").trim();
  if (beneficiaryId) return state;
  return { ...state, beneficiaryId: createBeneficiaryId(state.beneficiaryName || "beneficiaire") };
};
const stripStateMeta = state => Object.fromEntries(Object.entries(state || {}).filter(([key]) => !key.startsWith("__")));
const withLoadMeta = (state, meta) => ({
  ...(state || {}),
  __cloud: meta,
});
const stateMonthKey = value => `${Number(value?.year) || new Date().getFullYear()}-${String((Number(value?.month) || 0) + 1).padStart(2, "0")}`;
const stateRestoreKey = value => `${String(value?.beneficiaryId || "legacy")}-${stateMonthKey(value)}`;
const hasAuxiliaries = state => Array.isArray(state?.auxiliaries) && state.auxiliaries.length > 0;
const hasIncompleteAuxiliaryEmail = state => Array.isArray(state?.auxiliaries)
  && state.auxiliaries.some(aux => aux?.active !== false && cleanEmail(aux.email) && !firstValidEmail(aux.email));
const beneficiaryRoot = (db, beneficiaryId) => db.collection("planning-avd-beneficiaries").doc(String(beneficiaryId || "").trim());
const userBeneficiaryRef = (db, user, beneficiaryId) =>
  db.collection("planning-avd-users").doc(user.uid).collection("beneficiaries").doc(String(beneficiaryId || "").trim());
const activityRef = (db, beneficiaryId) => beneficiaryRoot(db, beneficiaryId).collection("activity");
const beneficiaryMemberKey = email => normalizeEmail(email);
const buildBeneficiaryMember = ({ email, name = "", role = "auxiliary", active = true, updatedBy = "" }) => ({
  email: normalizeEmail(email),
  emailLower: normalizeEmail(email),
  name: String(name || email || "").trim(),
  role: normalizeAccessRole(role),
  active: active !== false,
  updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  updatedBy,
});
const buildSyncedAuxiliaryMember = ({ email, name = "", active = true, updatedBy = "", role = "" }) => {
  const payload = buildBeneficiaryMember({
    email,
    name,
    role: role || "auxiliary",
    active,
    updatedBy,
  });
  if (!role) delete payload.role;
  return payload;
};
const mergeSavedState = (local, cloud) => {
  if (!cloud) return local;
  if (!local) return cloud;
  return {
    ...local,
    ...cloud,
    auxiliaries: hasAuxiliaries(cloud) ? cloud.auxiliaries : local.auxiliaries,
    overrides: cloud.overrides && typeof cloud.overrides === "object" ? cloud.overrides : local.overrides,
    hourOverrides: cloud.hourOverrides && typeof cloud.hourOverrides === "object" ? cloud.hourOverrides : local.hourOverrides,
    dayOutings: cloud.dayOutings && typeof cloud.dayOutings === "object" ? cloud.dayOutings : local.dayOutings,
  };
};

export async function ensureBeneficiaryGroup({ db, user, state }) {
  const identified = ensureBeneficiaryIdentity(state);
  const beneficiaryId = String(identified?.beneficiaryId || "").trim();
  const beneficiaryName = String(identified.beneficiaryName || "").trim();
  const adminEmail = normalizeEmail(user?.email);
  if (!db || !beneficiaryId || !adminEmail) return;
  const root = beneficiaryRoot(db, beneficiaryId);
  const activeAuxiliaries = (Array.isArray(identified.auxiliaries) ? identified.auxiliaries : [])
    .map(aux => ({ ...aux, email: firstValidEmail(aux.email) }))
    .filter(aux => aux.email);
  const batch = db.batch();
  batch.set(root, {
    beneficiaryId,
    beneficiaryName,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: adminEmail,
  }, { merge: true });
  batch.set(root.collection("members").doc(beneficiaryMemberKey(adminEmail)), buildBeneficiaryMember({
    email: adminEmail,
    name: String(user.displayName || adminEmail).trim(),
    role: "admin",
    active: true,
    updatedBy: adminEmail,
  }), { merge: true });
  activeAuxiliaries
    .forEach(aux => {
      const email = beneficiaryMemberKey(aux.email);
      const accessRole = email === adminEmail ? "admin" : "";
      batch.set(root.collection("members").doc(email), buildSyncedAuxiliaryMember({
        email,
        name: aux.name || email,
        role: accessRole,
        active: aux.active !== false,
        updatedBy: adminEmail,
      }), { merge: true });
      const sharePayload = {
        beneficiaryId,
        beneficiaryName,
        email,
        emailOriginal: email,
        readEmails: [email],
        active: aux.active !== false,
        deleted: false,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: adminEmail,
      };
      if (accessRole) sharePayload.role = accessRole;
      batch.set(db.collection("planning-avd-shares").doc(email).collection("beneficiaries").doc(beneficiaryId), sharePayload, { merge: true });
    });
  await batch.commit();
}

export const defaultState = () => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    view: "month",
    rotationDays: 1,
    beneficiaryId: createBeneficiaryId("beneficiaire"),
    beneficiaryName: "",
    auxiliaries: null,
    hourOverrides: {},
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
    const merged = ensureBeneficiaryIdentity(snap.exists ? mergeSavedState(local, cloud) : local);
    return withLoadMeta(merged, {
      ready: true,
      exists: snap.exists,
      source: snap.exists ? "cloud" : local ? "local" : "empty",
      updatedAt: merged?.updatedAt || cloud?.updatedAt || "",
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
  const value = { ...ensureBeneficiaryIdentity(stripStateMeta(state)), rotationRevision: ROTATION_REVISION, updatedAt: new Date().toISOString() };
  localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
  if (!db || !user?.uid) return { local: true, cloud: false, reason: "not-connected" };
  if (hasIncompleteAuxiliaryEmail(value)) {
    return { local: true, cloud: false, reason: "pending-email", error: "Un email auxiliaire est en cours de saisie." };
  }
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
      const restoreMonth = stateRestoreKey(currentValue);
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
    await userBeneficiaryRef(db, user, value.beneficiaryId).set({
      beneficiaryId: value.beneficiaryId,
      beneficiaryName: String(value.beneficiaryName || "").trim(),
      value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: user.email || "",
    }, { merge: true });
    await beneficiaryRoot(db, value.beneficiaryId).set({
      beneficiaryId: value.beneficiaryId,
      beneficiaryName: String(value.beneficiaryName || "").trim(),
      value,
      latestSavedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: user.email || "",
    }, { merge: true });
    await ensureBeneficiaryGroup({ db, user, state: value });
    await addBeneficiaryActivity({
      db,
      beneficiaryId: value.beneficiaryId,
      type: "save",
      user,
      detail: `${stateMonthKey(value)} · ${value.auxiliaries?.filter?.(aux => aux.active !== false).length || 0} auxiliaire(s)`,
    });
    return { local: true, cloud: true, updatedAt: value.updatedAt };
  } catch (error) {
    console.warn("Sauvegarde cloud impossible, conservee en local.", error);
    return { local: true, cloud: false, reason: "error", error: error.message || "Sauvegarde cloud impossible" };
  }
}

const beneficiaryOptionFromDoc = doc => {
  const data = doc.data() || {};
  const value = data.value || {};
  return {
    id: doc.id,
    beneficiaryId: data.beneficiaryId || value.beneficiaryId || doc.id,
    beneficiaryName: String(data.beneficiaryName || value.beneficiaryName || "Bénéficiaire sans nom").trim(),
    year: Number.isInteger(value.year) ? value.year : null,
    month: Number.isInteger(value.month) ? value.month : null,
    role: data.role || "",
    active: data.active !== false,
    updatedAt: data.updatedAt || value.updatedAt || null,
  };
};

const mergeBeneficiaryOptions = items => {
  const byId = new Map();
  items
    .filter(item => item?.beneficiaryId && item.active !== false)
    .forEach(item => {
      const current = byId.get(item.beneficiaryId);
      if (!current || timestampScore(item.updatedAt) > timestampScore(current.updatedAt)) {
        byId.set(item.beneficiaryId, item);
      }
    });
  return [...byId.values()].sort((a, b) =>
    timestampScore(b.updatedAt) - timestampScore(a.updatedAt)
    || String(a.beneficiaryName || "").localeCompare(String(b.beneficiaryName || "")));
};

export function subscribeUserBeneficiaries({ db, user, onChange, onError }) {
  if (!db || !user?.uid) return () => {};
  const sharedBuckets = new Map();
  const buckets = { user: [] };
  const emit = () => onChange?.(mergeBeneficiaryOptions([...buckets.user, ...[...sharedBuckets.values()].flat()]));
  const unsubscribers = [
    db.collection("planning-avd-users").doc(user.uid).collection("beneficiaries")
      .orderBy("updatedAt", "desc")
      .limit(80)
      .onSnapshot(snapshot => {
        buckets.user = snapshot.docs.map(beneficiaryOptionFromDoc);
        emit();
      }, error => onError?.(error)),
  ];
  const shareKeys = uniqueShareKeys(user.email);
  shareKeys.forEach(key => {
    unsubscribers.push(db.collection("planning-avd-shares").doc(key).collection("beneficiaries")
      .limit(80)
      .onSnapshot(snapshot => {
        sharedBuckets.set(key, snapshot.docs.map(beneficiaryOptionFromDoc));
        emit();
      }, error => onError?.(error)));
  });
  return () => unsubscribers.forEach(unsubscribe => unsubscribe());
}

export async function loadBeneficiaryState({ db, user, beneficiaryId }) {
  const safeBeneficiaryId = String(beneficiaryId || "").trim();
  if (!db || !user?.uid || !safeBeneficiaryId) throw new Error("Bénéficiaire introuvable.");
  const snap = await userBeneficiaryRef(db, user, safeBeneficiaryId).get();
  if (snap.exists && snap.data()?.value) return ensureBeneficiaryIdentity(migrateState(snap.data().value));
  const sharedSnap = await beneficiaryRoot(db, safeBeneficiaryId).get();
  if (sharedSnap.exists && sharedSnap.data()?.value) return ensureBeneficiaryIdentity(migrateState(sharedSnap.data().value));
  throw new Error("Sauvegarde bénéficiaire introuvable.");
}

const emptyDashboard = () => ({
  beneficiary: null,
  members: [],
  activity: [],
  openTasks: 0,
  totalTasks: 0,
});

const activityLabels = {
  save: "Sauvegarde cloud",
  publish: "Planning transmis",
};

async function addBeneficiaryActivity({ db, beneficiaryId, type, user, detail = "" }) {
  const safeBeneficiaryId = String(beneficiaryId || "").trim();
  if (!db || !safeBeneficiaryId || !user?.uid) return;
  try {
    await activityRef(db, safeBeneficiaryId).add({
      beneficiaryId: safeBeneficiaryId,
      type,
      label: activityLabels[type] || "Action",
      detail: String(detail || "").trim(),
      actorEmail: normalizeEmail(user.email),
      actorName: String(user.displayName || user.email || "").trim(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.warn("Historique cloud impossible.", error);
  }
}

export function subscribeBeneficiaryDashboard({ db, user, beneficiaryId = "", onChange, onError }) {
  const safeBeneficiaryId = String(beneficiaryId || "").trim();
  if (!db || !user?.uid || !safeBeneficiaryId) {
    onChange?.(emptyDashboard());
    return () => {};
  }
  const dashboard = emptyDashboard();
  const emit = () => onChange?.({ ...dashboard, members: [...dashboard.members], activity: [...dashboard.activity] });
  const root = beneficiaryRoot(db, safeBeneficiaryId);
  const unsubscribers = [
    root.onSnapshot(snapshot => {
      dashboard.beneficiary = snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
      emit();
    }, error => onError?.(error)),
    root.collection("members").onSnapshot(snapshot => {
      dashboard.members = mergeAccessMembers([], snapshot.docs.map(doc => normalizeMemberDoc(doc, "team")).filter(Boolean));
      emit();
    }, error => onError?.(error)),
    root.collection("tasks").limit(200).onSnapshot(snapshot => {
      const tasks = snapshot.docs.map(doc => doc.data() || {});
      dashboard.totalTasks = tasks.length;
      dashboard.openTasks = tasks.filter(task => task.completed !== true).length;
      emit();
    }, error => onError?.(error)),
    root.collection("activity").orderBy("createdAt", "desc").limit(30).onSnapshot(snapshot => {
      dashboard.activity = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      emit();
    }, error => onError?.(error)),
  ];
  return () => unsubscribers.forEach(unsubscribe => unsubscribe());
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
    try {
      const legacySnap = await db.collection("planning-avd-admins").where("email", "==", email).limit(1).get();
      if (!legacySnap.empty) return legacySnap.docs.some(doc => doc.data()?.active !== false);
    } catch (error) {
      console.warn("Recherche admin historique ignoree.", error);
    }
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

const accessFromSnapshots = ({ uidAdmin, emailAdmin, adminEmail, bootstrapAdmin, teamMember, beneficiaryShares }) => {
  const globalAdmin = [uidAdmin, emailAdmin, adminEmail].some(snapshot => snapshot?.exists && snapshot.data()?.active !== false);
  if (globalAdmin) return { isAdmin: true, role: "admin", canContribute: true, isMember: true, globalAdmin: true };
  const beneficiaryAdmin = bootstrapAdmin?.exists && bootstrapAdmin.data()?.active !== false;
  if (beneficiaryAdmin) return { isAdmin: true, role: "admin", canContribute: true, isMember: true, globalAdmin: false };
  const shareRoles = (beneficiaryShares?.docs || [])
    .map(doc => normalizeAccessRole(doc.data()?.role))
    .filter((role, index) => (beneficiaryShares.docs[index].data()?.active !== false) && ACCESS_ROLES.includes(role));
  if (shareRoles.includes("admin")) return { isAdmin: true, role: "admin", canContribute: true, isMember: true, globalAdmin: false };
  if (shareRoles.length) {
    const role = shareRoles.sort((a, b) => roleRank(a) - roleRank(b))[0];
    return { isAdmin: false, role, canContribute: role !== "viewer", isMember: true, globalAdmin: false };
  }
  if (!teamMember?.exists || teamMember.data()?.active === false) {
    return { isAdmin: false, role: "guest", canContribute: false, isMember: false, globalAdmin: false };
  }
  const role = normalizeAccessRole(teamMember.data()?.role);
  return { isAdmin: false, role, canContribute: role !== "viewer", isMember: true, globalAdmin: false };
};

export function subscribeUserAccess({ db, user, onChange, onError }) {
  if (!db || !user?.uid) {
    onChange?.({ isAdmin: false, role: "guest", canContribute: false, isMember: false, globalAdmin: false });
    return () => {};
  }
  const email = normalizeEmail(user.email);
  const shareKeys = uniqueShareKeys(user.email);
  const shareDocsByKey = new Map();
  const snapshots = { uidAdmin: null, emailAdmin: null, adminEmail: null, bootstrapAdmin: null, teamMember: null, beneficiaryShares: { docs: [] } };
  const expected = email ? 5 + shareKeys.length : 1;
  let received = 0;
  let active = true;
  const emptySnapshot = { exists: false, data: () => ({}) };
  const emit = () => {
    if (!active || received < expected) return;
    onChange?.(accessFromSnapshots(snapshots));
  };
  const mergeShareDocs = () => {
    snapshots.beneficiaryShares = { docs: [...shareDocsByKey.values()].flat() };
  };
  const listen = (key, ref, applySnapshot = snapshot => { snapshots[key] = snapshot; }) => {
    let seen = false;
    return ref.onSnapshot(snapshot => {
      if (!seen) {
        seen = true;
        received += 1;
      }
      applySnapshot(snapshot);
      emit();
    }, error => {
      if (!seen) {
        seen = true;
        received += 1;
      }
      if (key.startsWith("beneficiaryShares:")) {
        shareDocsByKey.set(key, []);
        mergeShareDocs();
      } else {
        snapshots[key] = emptySnapshot;
      }
      onError?.(error);
      emit();
    });
  };
  const unsubscribers = [listen("uidAdmin", db.collection("planning-avd-admins").doc(user.uid))];
  if (email) {
    unsubscribers.push(
      listen("emailAdmin", db.collection("planning-avd-admins").doc(email)),
      listen("adminEmail", db.collection("planning-avd-admin-emails").doc(email)),
      listen("bootstrapAdmin", db.collection("planning-avd-admin-bootstraps").doc(email)),
      listen("teamMember", db.collection("planning-avd-team-members").doc(email)),
      ...shareKeys.map(key => listen(`beneficiaryShares:${key}`, db.collection("planning-avd-shares").doc(key).collection("beneficiaries").limit(20), snapshot => {
        shareDocsByKey.set(`beneficiaryShares:${key}`, snapshot.docs);
        mergeShareDocs();
      })),
    );
  }
  return () => {
    active = false;
    unsubscribers.forEach(unsubscribe => unsubscribe());
  };
}

export async function getUserAccess({ db, user }) {
  if (!db || !user?.uid) return { isAdmin: false, role: "guest", canContribute: false, isMember: false, globalAdmin: false };
  const admin = await isAdminUser({ db, user });
  if (admin) return { isAdmin: true, role: "admin", canContribute: true, isMember: true, globalAdmin: true };
  const email = normalizeEmail(user.email);
  if (!email) return { isAdmin: false, role: "guest", canContribute: false, isMember: false, globalAdmin: false };
  try {
    const bootstrapSnap = await db.collection("planning-avd-admin-bootstraps").doc(email).get();
    if (bootstrapSnap.exists && bootstrapSnap.data()?.active !== false) {
      return { isAdmin: true, role: "admin", canContribute: true, isMember: true, globalAdmin: false };
    }
    const shareSnaps = await Promise.all(uniqueShareKeys(user.email)
      .map(key => db.collection("planning-avd-shares").doc(key).collection("beneficiaries").limit(20).get().catch(() => null)));
    const shareDocs = shareSnaps.flatMap(snapshot => snapshot?.docs || []);
    const shareRoles = shareDocs
      .map(doc => normalizeAccessRole(doc.data()?.role))
      .filter((role, index) => (shareDocs[index].data()?.active !== false) && ACCESS_ROLES.includes(role));
    if (shareRoles.includes("admin")) return { isAdmin: true, role: "admin", canContribute: true, isMember: true, globalAdmin: false };
    if (shareRoles.length) {
      const role = shareRoles.sort((a, b) => roleRank(a) - roleRank(b))[0];
      return { isAdmin: false, role, canContribute: role !== "viewer", isMember: true, globalAdmin: false };
    }
    const snap = await db.collection("planning-avd-team-members").doc(email).get();
    if (!snap.exists || snap.data()?.active === false) {
      return { isAdmin: false, role: "guest", canContribute: false, isMember: false, globalAdmin: false };
    }
    const role = normalizeAccessRole(snap.data()?.role);
    return { isAdmin: false, role, canContribute: role !== "viewer", isMember: true, globalAdmin: false };
  } catch (error) {
    console.warn("Verification role utilisateur impossible.", error);
    return { isAdmin: false, role: "guest", canContribute: false, isMember: false, globalAdmin: false };
  }
}

export function subscribeOwnAccessRequest({ db, user, onChange, onError }) {
  const email = normalizeEmail(user?.email);
  if (!db || !email) return () => {};
  return db.collection("planning-avd-access-requests").doc(email)
    .onSnapshot(snapshot => onChange?.(snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null), error => onError?.(error));
}

export function subscribeAccessRequests({ db, user, onChange, onError }) {
  if (!db || !user?.uid) return () => {};
  return db.collection("planning-avd-access-requests")
    .orderBy("updatedAt", "desc")
    .limit(80)
    .onSnapshot(snapshot => {
      const requests = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1)
          || String(b.updatedAt?.seconds || "").localeCompare(String(a.updatedAt?.seconds || "")));
      onChange?.(requests);
    }, error => onError?.(error));
}

export async function requestAccessRole({ db, user, role = "auxiliary", beneficiaryName = "", message = "" }) {
  const email = normalizeEmail(user?.email);
  const cleanRole = normalizeAccessRole(role);
  if (!db || !user?.uid || !email) throw new Error("Connexion necessaire.");
  await db.collection("planning-avd-access-requests").doc(email).set({
    email,
    name: String(user.displayName || email).trim(),
    role: cleanRole,
    beneficiaryName: String(beneficiaryName || "").trim().slice(0, 120),
    message: String(message || "").trim().slice(0, 500),
    status: "pending",
    userUid: user.uid,
    requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { email, role: cleanRole };
}

export async function createNewBeneficiaryAdmin({ db, user, beneficiaryName = "" }) {
  const email = normalizeEmail(user?.email);
  const cleanBeneficiary = String(beneficiaryName || "").trim().slice(0, 120);
  if (!db || !user?.uid || !email) throw new Error("Connexion necessaire.");
  if (!cleanBeneficiary) throw new Error("Indiquez le nom du bénéficiaire.");
  const beneficiaryId = createBeneficiaryId(cleanBeneficiary);

  await db.collection("planning-avd-admin-bootstraps").doc(email).set({
    email,
    emailLower: email,
    name: String(user.displayName || email).trim(),
    role: "admin",
    active: true,
    beneficiaryId,
    beneficiaryName: cleanBeneficiary,
    createdByUid: user.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const value = {
    ...defaultState(),
    beneficiaryId,
    beneficiaryName: cleanBeneficiary,
    updatedAt: new Date().toISOString(),
  };
  const batch = db.batch();
  const root = beneficiaryRoot(db, beneficiaryId);
  batch.set(root, {
    beneficiaryId,
    beneficiaryName: cleanBeneficiary,
    value,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: email,
  }, { merge: true });
  batch.set(root.collection("members").doc(beneficiaryMemberKey(email)), buildBeneficiaryMember({
    email,
    name: String(user.displayName || email).trim(),
    role: "admin",
    active: true,
    updatedBy: email,
  }), { merge: true });
  batch.set(db.collection("planning-avd-users").doc(user.uid).collection("app").doc("state"), {
    value,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: email,
  }, { merge: true });
  batch.set(userBeneficiaryRef(db, user, beneficiaryId), {
    beneficiaryId,
    beneficiaryName: cleanBeneficiary,
    value,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: email,
  }, { merge: true });
  await batch.commit();
  localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
  return { email, beneficiaryId, beneficiaryName: cleanBeneficiary, role: "admin" };
}

function normalizeMemberDoc(doc, source) {
  const data = doc.data() || {};
  const email = firstValidEmail(data.emailLower, data.email, doc.id);
  if (!email) return null;
  const profileKey = emailProfileKey(email);
  if (!profileKey) return null;
  const role = source === "admin"
    ? (data.role === "owner" ? "owner" : "admin")
    : normalizeAccessRole(data.role);
  const displayName = String(data.name || data.displayName || "").trim();
  return {
    id: doc.id,
    email,
    profileKey,
    name: displayName || email,
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
    const profileKey = member.profileKey || emailProfileKey(member.email);
    if (!profileKey) return;
    const current = members.get(profileKey);
    if (!current
      || (member.active && !current.active)
      || (member.active === current.active && roleRank(member.role) < roleRank(current.role))) {
      members.set(profileKey, { ...current, ...member, profileKey });
      return;
    }
    members.set(profileKey, {
      ...current,
      active: current.active || member.active,
      name: current.name || member.name,
      profileKey,
    });
  });
  return [...members.values()].sort((a, b) =>
    Number(b.active) - Number(a.active)
    || roleRank(a.role) - roleRank(b.role)
    || a.name.localeCompare(b.name));
}

const emailQualityScore = email => {
  const clean = firstValidEmail(email);
  if (!clean) return 0;
  const [local = "", domain = ""] = clean.split("@");
  return (local.includes("+") ? 0 : 2)
    + (domain === "gmail.com" ? 2 : 0)
    + (clean.includes("%40") ? 0 : 1);
};

function memberRecordFromDoc(doc) {
  const data = doc.data() || {};
  const email = firstValidEmail(data.emailLower, data.email, doc.id);
  const profileKey = emailProfileKey(email || doc.id);
  if (!email || !profileKey) return null;
  const role = data.role === "owner" ? "owner" : normalizeAccessRole(data.role);
  const name = String(data.name || data.displayName || "").trim();
  return {
    ref: doc.ref,
    id: doc.id,
    data,
    email,
    profileKey,
    name,
    role,
    active: data.active !== false,
    score: timestampScore(data.updatedAt || data.createdAt),
  };
}

function choosePreferredMember(records) {
  return [...records].sort((a, b) =>
    Number(b.active) - Number(a.active)
    || roleRank(a.role) - roleRank(b.role)
    || emailQualityScore(b.email) - emailQualityScore(a.email)
    || Number(b.id === b.email) - Number(a.id === a.email)
    || b.score - a.score
    || String(a.email).localeCompare(String(b.email)))[0];
}

function mergedMemberPayload(records, preferred, updatedBy) {
  const activeRecords = records.filter(record => record.active);
  const roleSource = activeRecords.length ? activeRecords : records;
  const role = [...roleSource].sort((a, b) => roleRank(a.role) - roleRank(b.role))[0]?.role || preferred.role;
  const name = [...records]
    .map(record => record.name)
    .filter(value => value && !EMAIL_PATTERN.test(normalizeEmailCandidate(value)))
    .sort((a, b) => b.length - a.length)[0] || preferred.name || preferred.email;
  const payload = buildBeneficiaryMember({
    email: preferred.email,
    name,
    role: role === "owner" ? "admin" : role,
    active: records.some(record => record.active),
    updatedBy,
  });
  if (role === "owner") payload.role = "owner";
  return payload;
}

export async function repairBeneficiaryMembers({ db, user, beneficiaryId = "" }) {
  const safeBeneficiaryId = String(beneficiaryId || "").trim();
  const updatedBy = normalizeEmail(user?.email);
  if (!db || !user?.uid) throw new Error("Connexion admin necessaire.");
  if (!safeBeneficiaryId) throw new Error("Bénéficiaire non identifié.");
  const collection = beneficiaryRoot(db, safeBeneficiaryId).collection("members");
  const snapshot = await collection.get();
  const groups = new Map();
  snapshot.docs
    .map(memberRecordFromDoc)
    .filter(Boolean)
    .forEach(record => {
      const items = groups.get(record.profileKey) || [];
      items.push(record);
      groups.set(record.profileKey, items);
    });

  const operations = [];
  let merged = 0;
  let removed = 0;
  groups.forEach(records => {
    const preferred = records.find(record => record.email === updatedBy) || choosePreferredMember(records);
    const canonicalId = beneficiaryMemberKey(preferred.email);
    const canonicalRecord = records.find(record => record.id === canonicalId);
    const duplicateRecords = records.filter(record => record.id !== canonicalId
      && (!EMAIL_PATTERN.test(normalizeEmailCandidate(record.id))
        || firstValidEmail(record.data.emailLower, record.data.email) === preferred.email));
    const canonicalDirty = !canonicalRecord
      || firstValidEmail(canonicalRecord.data.emailLower) !== preferred.email
      || firstValidEmail(canonicalRecord.data.email) !== preferred.email
      || canonicalRecord.profileKey !== preferred.profileKey;
    if (!canonicalDirty && !duplicateRecords.length) return;
    const payload = mergedMemberPayload(records, preferred, updatedBy);
    operations.push(batch => batch.set(collection.doc(canonicalId), payload, { merge: true }));
    duplicateRecords.forEach(record => {
      operations.push(batch => batch.delete(record.ref));
      removed += 1;
    });
    merged += 1;
  });

  for (let index = 0; index < operations.length; index += 450) {
    const batch = db.batch();
    operations.slice(index, index + 450).forEach(operation => operation(batch));
    await batch.commit();
  }
  return { scanned: snapshot.size, merged, removed };
}

export function subscribeAccessMembers({ db, user, beneficiaryId = "", onChange, onError }) {
  if (!db || !user?.uid) return () => {};
  const safeBeneficiaryId = String(beneficiaryId || "").trim();
  if (!safeBeneficiaryId) {
    onChange?.([]);
    return () => {};
  }
  return beneficiaryRoot(db, safeBeneficiaryId).collection("members").onSnapshot(snapshot => {
    onChange?.(mergeAccessMembers([], snapshot.docs.map(doc => normalizeMemberDoc(doc, "team")).filter(Boolean)));
  }, error => onError?.(error));
}

export async function grantMemberRole({ db, user, email, role = "auxiliary", name = "", beneficiaryId = "", beneficiaryName = "" }) {
  const clean = firstValidEmail(email);
  const cleanRole = normalizeAccessRole(role);
  const cleanName = String(name || "").trim().slice(0, 80);
  const safeBeneficiaryId = String(beneficiaryId || "").trim();
  const adminEmail = normalizeEmail(user?.email);
  if (!db || !user?.uid) throw new Error("Connexion admin necessaire.");
  if (!clean) throw new Error("Email invalide.");
  if (clean === adminEmail && cleanRole !== "admin") throw new Error("Votre propre acces administrateur reste protege.");
  const canWriteGlobalAccess = await isAdminUser({ db, user });
  const existingAdmin = cleanRole === "admin" || !canWriteGlobalAccess
    ? null
    : await db.collection("planning-avd-admins").doc(clean).get().catch(() => null);
  const targetIsActiveAdmin = !!existingAdmin?.exists && existingAdmin.data()?.active !== false;
  const effectiveRole = targetIsActiveAdmin ? "admin" : cleanRole;
  const common = {
    email: clean,
    emailLower: clean,
    name: cleanName,
    role: effectiveRole,
    active: true,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: adminEmail,
  };
  const writes = [];
  if (canWriteGlobalAccess) {
    writes.push(db.collection("planning-avd-team-members").doc(clean).set({
      ...common,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: adminEmail,
    }, { merge: true }));
  }
  if (safeBeneficiaryId) {
    writes.push(
      beneficiaryRoot(db, safeBeneficiaryId).set({
        beneficiaryId: safeBeneficiaryId,
        beneficiaryName: String(beneficiaryName || "").trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: adminEmail,
      }, { merge: true }),
      beneficiaryRoot(db, safeBeneficiaryId).collection("members").doc(beneficiaryMemberKey(clean)).set(buildBeneficiaryMember({
        email: clean,
        name: cleanName || clean,
        role: effectiveRole,
        active: true,
        updatedBy: adminEmail,
      }), { merge: true }),
      db.collection("planning-avd-shares").doc(clean).collection("beneficiaries").doc(safeBeneficiaryId).set({
        beneficiaryId: safeBeneficiaryId,
        beneficiaryName: String(beneficiaryName || "").trim(),
        email: clean,
        emailOriginal: clean,
        readEmails: [clean],
        role: effectiveRole,
        active: true,
        deleted: false,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: adminEmail,
      }, { merge: true }),
    );
  }
  if (canWriteGlobalAccess) {
    if (effectiveRole === "admin") {
      writes.push(db.collection("planning-avd-admins").doc(clean).set({
        ...common,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: adminEmail,
      }, { merge: true }));
    } else {
      writes.push(db.collection("planning-avd-admins").doc(clean).set({
        email: clean,
        emailLower: clean,
        active: false,
        role: "admin",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: adminEmail,
      }, { merge: true }));
    }
  }
  if (!writes.length) throw new Error("Aucun bénéficiaire actif pour ajouter ce membre.");
  await Promise.all(writes);
  if (safeBeneficiaryId) {
    await repairBeneficiaryMembers({ db, user, beneficiaryId: safeBeneficiaryId })
      .catch(error => console.warn("Fusion des membres ignoree.", error));
  }
  return { email: clean, role: effectiveRole, requestedRole: cleanRole };
}

export async function setMemberAccess({ db, user, email, role = "auxiliary", active = true, beneficiaryId = "", beneficiaryName = "" }) {
  const clean = firstValidEmail(email);
  const cleanRole = normalizeAccessRole(role);
  const safeBeneficiaryId = String(beneficiaryId || "").trim();
  if (!db || !user?.uid) throw new Error("Connexion admin necessaire.");
  if (!clean) throw new Error("Email invalide.");
  if (!active && clean === normalizeEmail(user.email)) throw new Error("Vous ne pouvez pas desactiver votre propre acces.");
  if (active) return grantMemberRole({ db, user, email: clean, role: cleanRole, beneficiaryId: safeBeneficiaryId, beneficiaryName });
  const payload = {
    active: false,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: normalizeEmail(user.email),
  };
  if (safeBeneficiaryId) {
    const batch = db.batch();
    batch.set(beneficiaryRoot(db, safeBeneficiaryId).collection("members").doc(beneficiaryMemberKey(clean)), {
      email: clean,
      emailLower: clean,
      role: cleanRole,
      ...payload,
    }, { merge: true });
    batch.set(db.collection("planning-avd-shares").doc(clean).collection("beneficiaries").doc(safeBeneficiaryId), {
      beneficiaryId: safeBeneficiaryId,
      beneficiaryName: String(beneficiaryName || "").trim(),
      email: clean,
      emailOriginal: clean,
      readEmails: [clean],
      role: cleanRole,
      ...payload,
    }, { merge: true });
    await batch.commit();
    return { email: clean, role: cleanRole, active: false };
  }
  await Promise.all([
    db.collection("planning-avd-team-members").doc(clean).set({ email: clean, emailLower: clean, ...payload }, { merge: true }),
    db.collection("planning-avd-admins").doc(clean).set({ email: clean, emailLower: clean, ...payload }, { merge: true }),
  ]);
  return { email: clean, role: cleanRole, active: false };
}

export async function deleteMemberAccess({ db, user, email, beneficiaryId = "", beneficiaryName = "" }) {
  const clean = firstValidEmail(email);
  const safeBeneficiaryId = String(beneficiaryId || "").trim();
  const adminEmail = normalizeEmail(user?.email);
  if (!db || !user?.uid) throw new Error("Connexion admin necessaire.");
  if (!clean) throw new Error("Email invalide.");
  if (clean === adminEmail) throw new Error("Vous ne pouvez pas supprimer votre propre acces.");
  if (!safeBeneficiaryId) throw new Error("Bénéficiaire non identifié.");
  const payload = {
    beneficiaryId: safeBeneficiaryId,
    beneficiaryName: String(beneficiaryName || "").trim(),
    email: clean,
    emailOriginal: clean,
    readEmails: [clean],
    active: false,
    deleted: true,
    deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: adminEmail,
  };
  const batch = db.batch();
  batch.delete(beneficiaryRoot(db, safeBeneficiaryId).collection("members").doc(beneficiaryMemberKey(clean)));
  batch.set(db.collection("planning-avd-shares").doc(clean).collection("beneficiaries").doc(safeBeneficiaryId), payload, { merge: true });
  await batch.commit();
  return { email: clean, deleted: true };
}

export async function resolveAccessRequest({ db, user, request, status, beneficiaryId = "", beneficiaryName = "" }) {
  const email = firstValidEmail(request?.email, request?.id);
  const cleanStatus = status === "approved" ? "approved" : "rejected";
  if (!db || !user?.uid) throw new Error("Connexion admin necessaire.");
  if (!email) throw new Error("Demande introuvable.");
  if (cleanStatus === "approved") {
    await grantMemberRole({
      db,
      user,
      email,
      role: normalizeAccessRole(request.role),
      name: request.name || email,
      beneficiaryId,
      beneficiaryName,
    });
  }
  await db.collection("planning-avd-access-requests").doc(email).set({
    status: cleanStatus,
    resolvedBy: normalizeEmail(user.email),
    resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { email, status: cleanStatus };
}

export async function grantAdminByEmail({ db, user, email }) {
  const result = await grantMemberRole({ db, user, email, role: "admin" });
  return result.email;
}

export function subscribePersonalPlanning({ db, user, year, month, beneficiaryId = "", onChange, onAccess, onError }) {
  if (!db || !user?.email) {
    onAccess?.([]);
    return () => {};
  }
  const rawEmail = cleanEmail(user.email);
  const email = normalizeEmail(rawEmail);
  const monthId = monthKey(year, month);
  const selectedBeneficiaryId = String(beneficiaryId || "").trim();
  const shareKeys = uniqueShareKeys(rawEmail);
  const plans = new Map();
  const monthUnsubscribers = new Map();
  const accessByKey = new Map();
  let beneficiaryPending = shareKeys.length;
  let monthPending = 0;
  let active = true;
  let nearbySearchStarted = false;
  const planMatchesSelection = plan => !selectedBeneficiaryId || String(plan?.beneficiaryId || "") === selectedBeneficiaryId;
  const visiblePlans = () => sortPersonalPlans([...plans.values()].filter(planMatchesSelection));
  const emitBestPlan = () => {
    if (!active) return null;
    const best = visiblePlans()[0] || null;
    onChange?.(best);
    return best;
  };
  const maybeStartFallback = () => {
    if (!active || visiblePlans().length || beneficiaryPending > 0 || monthPending > 0) return;
    startNearbyFallback();
  };
  const setPlan = (key, value) => {
    if (!active) return;
    if (value) plans.set(key, value);
    else plans.delete(key);
    if (!emitBestPlan()) maybeStartFallback();
  };
  const emitAccess = () => {
    if (!active) return;
    const merged = new Map();
    [...accessByKey.values()].flat().forEach(item => {
      if (!item?.beneficiaryId || item.active === false) return;
      const current = merged.get(item.beneficiaryId);
      if (!current || roleRank(item.role) < roleRank(current.role)) merged.set(item.beneficiaryId, item);
    });
    onAccess?.(sortBeneficiaryAccess([...merged.values()]));
  };
  const queryByEmail = async (field, value) => {
    if (!value) return null;
    try {
      const snapshot = await db.collectionGroup("months").where(field, "==", value).limit(12).get();
      const activePlans = await Promise.all(snapshot.docs.map(async doc => {
        const shareSnap = await doc.ref.parent.parent.get().catch(() => null);
        if (shareSnap?.exists && shareSnap.data()?.active === false) return null;
        return doc.data();
      }));
      return sortPersonalPlans(activePlans
        .filter(item => item && Number.isInteger(item?.year) && Number.isInteger(item?.month) && planMatchesSelection(item)))[0] || null;
    } catch (error) {
      console.warn("Recherche planning auxiliaire impossible.", error);
      return null;
    }
  };
  const readShareMonthPlans = async (key, candidateId) => {
    const results = [];
    try {
      const beneficiaries = await db.collection("planning-avd-shares").doc(key).collection("beneficiaries").get();
      const monthReads = beneficiaries.docs
        .filter(doc => doc.data()?.active !== false)
        .map(doc => doc.ref.collection("months").doc(candidateId).get());
      const monthSnaps = await Promise.all(monthReads);
      monthSnaps.forEach(snap => { if (snap.exists) results.push(snap.data()); });
    } catch {}
    return sortPersonalPlans(results.filter(planMatchesSelection));
  };
  const startNearbyFallback = async () => {
    if (nearbySearchStarted || !active || visiblePlans().length) return;
    nearbySearchStarted = true;
    for (const candidate of nearbyMonths(year, month).filter(item => item.id !== monthId)) {
      for (const key of shareKeys) {
        const candidates = await readShareMonthPlans(key, candidate.id);
        if (!active || visiblePlans().length) return;
        if (candidates[0]) {
          onChange?.(candidates[0]);
          return;
        }
      }
    }
    const queried = await queryByEmail("email", email) || await queryByEmail("emailOriginal", rawEmail);
    if (active && queried) {
      onChange?.(queried);
      return;
    }
    if (active && !visiblePlans().length) onChange?.(null);
  };
  const beneficiaryUnsubscribers = shareKeys.map(key => {
    let firstSnapshot = true;
    return db.collection("planning-avd-shares").doc(key).collection("beneficiaries").onSnapshot(snapshot => {
      if (!active) return;
      if (firstSnapshot) {
        firstSnapshot = false;
        beneficiaryPending = Math.max(0, beneficiaryPending - 1);
      }
      accessByKey.set(key, snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data(), beneficiaryId: doc.data()?.beneficiaryId || doc.id }))
        .filter(item => item.active !== false));
      emitAccess();
      const prefix = `${key}:`;
      const currentKeys = new Set();
      snapshot.docs.forEach(doc => {
        if (doc.data()?.active === false) return;
        const mapKey = `${prefix}${doc.id}:${monthId}`;
        currentKeys.add(mapKey);
        if (monthUnsubscribers.has(mapKey)) return;
        const entry = { seen: false, planKey: `beneficiary:${mapKey}`, unsubscribe: null };
        monthPending += 1;
        entry.unsubscribe = doc.ref.collection("months").doc(monthId).onSnapshot(monthSnap => {
          if (!active) return;
          if (!entry.seen) {
            entry.seen = true;
            monthPending = Math.max(0, monthPending - 1);
          }
          setPlan(entry.planKey, monthSnap.exists ? monthSnap.data() : null);
          maybeStartFallback();
        }, error => {
          console.warn("Lecture planning auxiliaire par bénéficiaire impossible.", error);
          if (!entry.seen) {
            entry.seen = true;
            monthPending = Math.max(0, monthPending - 1);
          }
          if (!isPermissionError(error) && !visiblePlans().length) onError?.(error);
          maybeStartFallback();
        });
        monthUnsubscribers.set(mapKey, entry);
      });
      [...monthUnsubscribers.entries()]
        .filter(([mapKey]) => mapKey.startsWith(prefix) && !currentKeys.has(mapKey))
        .forEach(([mapKey, entry]) => {
          entry.unsubscribe?.();
          if (!entry.seen) monthPending = Math.max(0, monthPending - 1);
          plans.delete(entry.planKey);
          monthUnsubscribers.delete(mapKey);
        });
      if (!emitBestPlan()) maybeStartFallback();
    }, error => {
      console.warn("Lecture liste bénéficiaires auxiliaire impossible.", error);
      if (firstSnapshot) {
        firstSnapshot = false;
        beneficiaryPending = Math.max(0, beneficiaryPending - 1);
      }
      accessByKey.delete(key);
      emitAccess();
      if (!isPermissionError(error) && !visiblePlans().length) onError?.(error);
      maybeStartFallback();
    });
  });
  return () => {
    active = false;
    beneficiaryUnsubscribers.forEach(unsubscribe => unsubscribe());
    monthUnsubscribers.forEach(entry => entry.unsubscribe?.());
  };
}

const changeRequestCollection = ({ db, email, year, month, beneficiaryId = "" }) => {
  const root = db.collection("planning-avd-change-requests").doc(encodedEmailKey(normalizeEmail(email)));
  const safeBeneficiaryId = String(beneficiaryId || "").trim();
  if (safeBeneficiaryId) {
    return root.collection("beneficiaries").doc(safeBeneficiaryId).collection("months").doc(monthKey(year, month)).collection("items");
  }
  return null;
};

const changeRequestCollections = ({ db, email, year, month, beneficiaryId = "" }) => [
  changeRequestCollection({ db, email, year, month, beneficiaryId }),
].filter(Boolean);

const requestSnapshotList = snapshot => snapshot.docs
  .map(doc => ({ id: doc.id, ...doc.data() }))
  .sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || a.day - b.day || String(a.shift).localeCompare(String(b.shift)));
const isPermissionError = error => {
  const text = [
    error?.code,
    error?.name,
    error?.message,
    error?.toString?.(),
  ].filter(Boolean).join(" ").toLowerCase();
  return text.includes("permission")
    || text.includes("permission-denied")
    || text.includes("insufficient")
    || text.includes("missing or insufficient");
};

export function subscribePersonalChangeRequests({ db, user, year, month, beneficiaryId = "", onChange, onError }) {
  if (!db || !user?.email) return () => {};
  if (!String(beneficiaryId || "").trim()) {
    onChange?.([]);
    return () => {};
  }
  const email = cleanEmail(user.email);
  const buckets = new Map();
  const emit = () => onChange?.([...buckets.values()].flat().sort((a, b) =>
    (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1)
    || a.day - b.day
    || String(a.shift).localeCompare(String(b.shift))));
  const unsubscribers = changeRequestCollections({ db, email: user.email, year, month, beneficiaryId })
    .map((collection, index) => collection
      .where("requesterEmail", "==", email)
      .onSnapshot(snapshot => {
        buckets.set(index, requestSnapshotList(snapshot));
        emit();
      }, error => {
        buckets.delete(index);
        emit();
        if (!isPermissionError(error)) {
          console.warn("Lecture demande d'échange auxiliaire ignorée.", error);
          onError?.(error);
        }
      }));
  return () => unsubscribers.forEach(unsubscribe => unsubscribe());
}

export function subscribeAdminChangeRequests({ db, auxiliaries, year, month, beneficiaryId = "", onChange, onError }) {
  if (!db) return () => {};
  if (!String(beneficiaryId || "").trim()) {
    onChange?.([]);
    return () => {};
  }
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
  const unsubscribers = emails.flatMap(email => changeRequestCollections({ db, email, year, month, beneficiaryId })
    .map((collection, index) => collection.onSnapshot(snapshot => {
      buckets.set(`${email}:${index}`, requestSnapshotList(snapshot));
      emit();
    }, error => {
      buckets.delete(`${email}:${index}`);
      emit();
      if (!isPermissionError(error)) {
        console.warn("Lecture demande d'échange admin ignorée.", error);
        onError?.(error);
      }
    })));
  return () => unsubscribers.forEach(unsubscribe => unsubscribe());
}

export async function createPlanningChangeRequest({ db, user, planning, year, month, day, shift, targetEmail, targetName, message }) {
  if (!db || !user?.email) throw new Error("Connexion necessaire.");
  const email = cleanEmail(user.email);
  const beneficiaryId = String(planning?.beneficiaryId || "").trim();
  const collection = changeRequestCollection({ db, email, year, month, beneficiaryId });
  if (!collection) throw new Error("Bénéficiaire non identifié.");
  await collection.doc().set({
    beneficiaryId,
    beneficiaryName: String(planning?.beneficiaryName || "").trim(),
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
  const ref = changeRequestCollection({ db, email: request.requesterEmail, year: request.year, month: request.month, beneficiaryId: request.beneficiaryId });
  if (!ref) throw new Error("Bénéficiaire non identifié.");
  await ref.doc(request.id).set({
    status,
    resolvedWorkerId: workerId || "",
    resolvedWorkerName: workerName || "",
    resolvedBy: user.email || "",
    resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

export function buildPersonalSharePayloads({ year, month, beneficiaryId = "", beneficiaryName = "", auxiliaries, schedule, dayOutings = {}, publishedAt = null, publishedBy = "" }) {
  const safeBeneficiaryId = String(beneficiaryId || createBeneficiaryId(beneficiaryName || "beneficiaire")).trim();
  const active = auxiliaries
    .map(aux => ({ ...aux, email: firstValidEmail(aux.email) }))
    .filter(aux => aux.active !== false && aux.email);
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
        if (primaryWorkerId(plan?.[shift]) === aux.id) {
          const notice = breakNoticeForSlot({ shift, schedule, day: plan.day, worker: aux.id });
          entries.push({ day: plan.day, shift, ...(notice ? { notice } : {}) });
        }
      });
    });
    const rawEmail = cleanEmail(aux.email);
    const email = firstValidEmail(rawEmail);
    const readEmails = [...new Set([rawEmail, email].filter(Boolean))];
    const sharePayload = {
      email,
      emailOriginal: rawEmail,
      readEmails,
      name: aux.name,
      beneficiaryId: safeBeneficiaryId,
      beneficiaryName: String(beneficiaryName || "").trim(),
      year,
      month,
      period: monthKey(year, month),
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

export async function publishPersonalPlannings({ db, user, year, month, beneficiaryId = "", beneficiaryName = "", auxiliaries, schedule, dayOutings = {} }) {
  if (!db || !user?.uid) throw new Error("Connexion admin necessaire.");
  const safeBeneficiaryId = String(beneficiaryId || createBeneficiaryId(beneficiaryName || "beneficiaire")).trim();
  const payloads = buildPersonalSharePayloads({
    year,
    month,
    beneficiaryId: safeBeneficiaryId,
    beneficiaryName,
    auxiliaries,
    schedule,
    dayOutings,
    publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
    publishedBy: user.email || "",
  });
  if (!payloads.length) throw new Error("Aucun email auxiliaire trouve. Ouvrez Reglages puis renseignez le champ Email des auxiliaires.");
  const adminEmail = normalizeEmail(user.email);
  const batch = db.batch();
  const beneficiaryRef = beneficiaryRoot(db, safeBeneficiaryId);
  batch.set(beneficiaryRef, {
    beneficiaryId: safeBeneficiaryId,
    beneficiaryName: String(beneficiaryName || "").trim(),
    latestPublishedAt: firebase.firestore.FieldValue.serverTimestamp(),
    latestPublishedPeriod: monthKey(year, month),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: adminEmail,
  }, { merge: true });
  if (adminEmail) {
    batch.set(beneficiaryRef.collection("members").doc(beneficiaryMemberKey(adminEmail)), buildBeneficiaryMember({
      email: adminEmail,
      name: user.displayName || adminEmail,
      role: "admin",
      active: true,
      updatedBy: adminEmail,
    }), { merge: true });
  }
  auxiliaries
    .filter(aux => firstValidEmail(aux.email))
    .forEach(aux => {
      const rawEmail = firstValidEmail(aux.email);
      const email = rawEmail;
      const accessRole = email === adminEmail ? "admin" : "";
      batch.set(beneficiaryRef.collection("members").doc(beneficiaryMemberKey(email)), buildSyncedAuxiliaryMember({
        email,
        name: aux.name || email,
        role: accessRole,
        active: aux.active !== false,
        updatedBy: adminEmail,
      }), { merge: true });
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
      const beneficiaryRef = db.collection("planning-avd-shares").doc(key).collection("beneficiaries").doc(safeBeneficiaryId);
      const accessRole = sharePayload.email === adminEmail ? "admin" : "";
      const accessPayload = {
        beneficiaryId: safeBeneficiaryId,
        beneficiaryName: sharePayload.beneficiaryName,
        email: sharePayload.email,
        emailOriginal: sharePayload.emailOriginal,
        readEmails: sharePayload.readEmails,
        active: true,
        deleted: false,
        latestPeriod: monthKey(year, month),
        latestPublishedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: user.email || "",
      };
      if (accessRole) accessPayload.role = accessRole;
      batch.set(beneficiaryRef, accessPayload, { merge: true });
      batch.set(beneficiaryRef.collection("months").doc(monthKey(year, month)), sharePayload);
    });
  });
  await batch.commit();
  await repairBeneficiaryMembers({ db, user, beneficiaryId: safeBeneficiaryId })
    .catch(error => console.warn("Fusion des membres ignoree.", error));
  await addBeneficiaryActivity({
    db,
    beneficiaryId: safeBeneficiaryId,
    type: "publish",
    user,
    detail: `${monthKey(year, month)} · ${payloads.length} auxiliaire(s)`,
  });
  return payloads.length;
}
