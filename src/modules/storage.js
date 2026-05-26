const LOCAL_KEY = "planning-avd-state-v2";

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
  const local = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
  if (!db || !user?.uid) return local;
  try {
    const snap = await db.collection("planning-avd-users").doc(user.uid).collection("app").doc("state").get();
    return snap.exists ? snap.data().value : local;
  } catch (error) {
    console.warn("Lecture cloud impossible, repli local.", error);
    return local;
  }
}

export async function saveState({ db, user, state }) {
  const value = { ...state, updatedAt: new Date().toISOString() };
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
