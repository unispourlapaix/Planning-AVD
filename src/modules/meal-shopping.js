import { WEEKLY_SHOPPING } from "./meal-planning.js";

const cache = new Map();
const weekKey = week => week[0]?.dateKey || "unknown-week";
const localKey = week => `planning-avd-shopping-${weekKey(week)}`;

const emptyState = () => ({ checked: {}, customItems: [] });
const normalizeState = value => ({
  checked: value?.checked && typeof value.checked === "object" ? value.checked : {},
  customItems: Array.isArray(value?.customItems) ? value.customItems.filter(item => item?.id && item?.text) : [],
});

const readLocal = week => {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(localKey(week)) || "null"));
  } catch {
    return emptyState();
  }
};

const saveLocal = (week, state) => {
  const normalized = normalizeState(state);
  cache.set(weekKey(week), normalized);
  localStorage.setItem(localKey(week), JSON.stringify(normalized));
  return normalized;
};

const currentState = week => cache.get(weekKey(week)) || saveLocal(week, readLocal(week));
const cloudRef = (db, week) => db.collection("planning-avd-shopping").doc(weekKey(week));

export function shoppingItems(week, state = currentState(week)) {
  const base = WEEKLY_SHOPPING.flatMap((group, groupIndex) => group.items.map((text, itemIndex) => ({
    id: `base-${groupIndex}-${itemIndex}`,
    category: group.category,
    text,
    custom: false,
  })));
  return [...base, ...state.customItems.map(item => ({ ...item, category: item.category || "Ajouts", custom: true }))]
    .map(item => ({ ...item, checked: !!state.checked[item.id] }));
}

export function subscribeShopping({ db, user, week, onChange, onError }) {
  const local = currentState(week);
  onChange?.(local);
  if (!db || !user?.uid) return () => {};
  return cloudRef(db, week).onSnapshot(snapshot => {
    if (!snapshot.exists) return;
    onChange?.(saveLocal(week, snapshot.data()));
  }, error => onError?.(error));
}

export async function setShoppingChecked({ db, user, week, itemId, checked }) {
  const local = currentState(week);
  const next = saveLocal(week, { ...local, checked: { ...local.checked, [itemId]: !!checked } });
  if (!db || !user?.uid) return next;
  await db.runTransaction(async transaction => {
    const ref = cloudRef(db, week);
    const snapshot = await transaction.get(ref);
    const remote = normalizeState(snapshot.exists ? snapshot.data() : next);
    transaction.set(ref, {
      checked: { ...remote.checked, [itemId]: !!checked },
      customItems: remote.customItems,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: user.email || "",
    }, { merge: true });
  });
  return next;
}

export async function addShoppingItem({ db, user, week, text }) {
  const cleanText = String(text || "").trim().slice(0, 120);
  if (!cleanText) throw new Error("Ecrivez un article.");
  const item = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: cleanText,
    category: "Ajouts",
    createdBy: user?.email || "",
  };
  const local = currentState(week);
  const next = saveLocal(week, { ...local, customItems: [...local.customItems, item] });
  if (!db || !user?.uid) return next;
  await db.runTransaction(async transaction => {
    const ref = cloudRef(db, week);
    const snapshot = await transaction.get(ref);
    const remote = normalizeState(snapshot.exists ? snapshot.data() : local);
    transaction.set(ref, {
      checked: remote.checked,
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
      ...items.filter(item => item.category === category).map(item => `${item.checked ? "[x]" : "[ ]"} ${item.text}`),
      "",
    ]),
  ].join("\n");
}
