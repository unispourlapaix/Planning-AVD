import { WEEKLY_SHOPPING } from "./meal-planning.js";

const cache = new Map();
const weekKey = week => week[0]?.dateKey || "unknown-week";
const cleanBeneficiaryId = value => String(value || "").trim();
const cacheKey = (week, beneficiaryId = "") => `${cleanBeneficiaryId(beneficiaryId) || "local"}-${weekKey(week)}`;
const localKey = (week, beneficiaryId = "") => `planning-avd-shopping-${cacheKey(week, beneficiaryId)}`;

const emptyState = () => ({ checked: {}, checkedMeta: {}, customItems: [] });
const normalizeState = value => ({
  checked: value?.checked && typeof value.checked === "object" ? value.checked : {},
  checkedMeta: value?.checkedMeta && typeof value.checkedMeta === "object" ? value.checkedMeta : {},
  customItems: Array.isArray(value?.customItems) ? value.customItems.filter(item => item?.id && item?.text) : [],
});
const actorName = user => String(user?.displayName || user?.email || "Equipe").trim();
const actorEmail = user => String(user?.email || "").trim().toLowerCase();
const checkedMetaFor = user => ({
  name: actorName(user),
  email: actorEmail(user),
  at: new Date().toISOString(),
});
const removeKey = (source, key) => {
  const next = { ...(source || {}) };
  delete next[key];
  return next;
};

const readLocal = (week, beneficiaryId = "") => {
  if (!cleanBeneficiaryId(beneficiaryId)) return emptyState();
  try {
    return normalizeState(JSON.parse(localStorage.getItem(localKey(week, beneficiaryId)) || "null"));
  } catch {
    return emptyState();
  }
};

const saveLocal = (week, state, beneficiaryId = "") => {
  const normalized = normalizeState(state);
  if (!cleanBeneficiaryId(beneficiaryId)) return normalized;
  cache.set(cacheKey(week, beneficiaryId), normalized);
  localStorage.setItem(localKey(week, beneficiaryId), JSON.stringify(normalized));
  return normalized;
};

const currentState = (week, beneficiaryId = "") => {
  if (!cleanBeneficiaryId(beneficiaryId)) return emptyState();
  return cache.get(cacheKey(week, beneficiaryId)) || saveLocal(week, readLocal(week, beneficiaryId), beneficiaryId);
};
const cloudRef = (db, beneficiaryId, week) => {
  const safeBeneficiaryId = cleanBeneficiaryId(beneficiaryId);
  if (!safeBeneficiaryId) return null;
  return db.collection("planning-avd-beneficiaries").doc(safeBeneficiaryId).collection("shopping").doc(weekKey(week));
};

export function shoppingItems(week, state = currentState(week)) {
  const base = WEEKLY_SHOPPING.flatMap((group, groupIndex) => group.items.map((text, itemIndex) => ({
    id: `base-${groupIndex}-${itemIndex}`,
    category: group.category,
    text,
    custom: false,
  })));
  return [...base, ...state.customItems.map(item => ({ ...item, category: item.category || "Ajouts", custom: true }))]
    .map(item => {
      const meta = state.checkedMeta?.[item.id] || {};
      const checked = !!state.checked[item.id];
      return {
        ...item,
        checked,
        checkedBy: checked ? String(meta.name || meta.email || "").trim() : "",
        checkedByEmail: checked ? String(meta.email || "").trim() : "",
        checkedAt: checked ? String(meta.at || "").trim() : "",
      };
    });
}

export function subscribeShopping({ db, user, beneficiaryId = "", week, onChange, onError }) {
  if (!cleanBeneficiaryId(beneficiaryId)) {
    onChange?.(emptyState());
    return () => {};
  }
  const local = currentState(week, beneficiaryId);
  onChange?.(local);
  const ref = cloudRef(db, beneficiaryId, week);
  if (!db || !user?.uid || !ref) return () => {};
  return ref.onSnapshot(snapshot => {
    if (!snapshot.exists) return;
    onChange?.(saveLocal(week, snapshot.data(), beneficiaryId));
  }, error => onError?.(error));
}

export async function setShoppingChecked({ db, user, beneficiaryId = "", week, itemId, checked }) {
  if (!cleanBeneficiaryId(beneficiaryId)) throw new Error("Bénéficiaire non identifié.");
  const local = currentState(week, beneficiaryId);
  const localMeta = checked ? { ...local.checkedMeta, [itemId]: checkedMetaFor(user) } : removeKey(local.checkedMeta, itemId);
  const next = saveLocal(week, { ...local, checked: { ...local.checked, [itemId]: !!checked }, checkedMeta: localMeta }, beneficiaryId);
  const ref = cloudRef(db, beneficiaryId, week);
  if (!db || !user?.uid || !ref) return next;
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const remote = normalizeState(snapshot.exists ? snapshot.data() : next);
    const remoteMeta = checked ? { ...remote.checkedMeta, [itemId]: checkedMetaFor(user) } : removeKey(remote.checkedMeta, itemId);
    transaction.set(ref, {
      beneficiaryId: cleanBeneficiaryId(beneficiaryId),
      weekId: weekKey(week),
      checked: { ...remote.checked, [itemId]: !!checked },
      checkedMeta: remoteMeta,
      customItems: remote.customItems,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: user.email || "",
    }, { merge: true });
  });
  return next;
}

export async function addShoppingItem({ db, user, beneficiaryId = "", week, text }) {
  const cleanText = String(text || "").trim().slice(0, 120);
  if (!cleanBeneficiaryId(beneficiaryId)) throw new Error("Bénéficiaire non identifié.");
  if (!cleanText) throw new Error("Ecrivez un article.");
  const item = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: cleanText,
    category: "Ajouts",
    createdBy: user?.email || "",
  };
  const local = currentState(week, beneficiaryId);
  const next = saveLocal(week, { ...local, customItems: [...local.customItems, item] }, beneficiaryId);
  const ref = cloudRef(db, beneficiaryId, week);
  if (!db || !user?.uid || !ref) return next;
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const remote = normalizeState(snapshot.exists ? snapshot.data() : local);
    transaction.set(ref, {
      beneficiaryId: cleanBeneficiaryId(beneficiaryId),
      weekId: weekKey(week),
      checked: remote.checked,
      checkedMeta: remote.checkedMeta,
      customItems: [...remote.customItems, item],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: user.email || "",
    }, { merge: true });
  });
  return next;
}

export function shoppingListText(week, state = currentState(week)) {
  const items = shoppingItems(week, state);
  const categories = [...new Set(items.map(item => item.category))];
  return [
    `Courses - semaine du ${week[0].day}/${week[0].month + 1}/${week[0].year}`,
    "",
    ...categories.flatMap(category => [
      category,
      ...items.filter(item => item.category === category).map(item => `${item.checked ? "[x]" : "[ ]"} ${item.text}${item.checkedBy ? ` - coché par ${item.checkedBy}` : ""}`),
      "",
    ]),
  ].join("\n");
}
