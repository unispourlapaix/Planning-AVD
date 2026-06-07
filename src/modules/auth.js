const CDN = "https://www.gstatic.com/firebasejs/10.14.1";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some(script => script.src === src)) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Chargement impossible: ${src}`));
    document.head.appendChild(script);
  });
}

export async function initGoogleAuth(onChange) {
  const cfg = window.PLANNING_AVD_AUTH || {};
  const firebaseConfig = cfg.firebaseConfig || {};
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    onChange?.({ user: null, auth: null, db: null, ready: true, error: "Firebase non configure" });
    return { auth: null, db: null };
  }

  await loadScript(`${CDN}/firebase-app-compat.js`);
  await loadScript(`${CDN}/firebase-auth-compat.js`);
  await loadScript(`${CDN}/firebase-firestore-compat.js`);

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  auth.useDeviceLanguage();

  auth.onAuthStateChanged(user => {
    const email = String(user?.email || "").toLowerCase();
    const allowed = Array.isArray(cfg.allowedEmails) ? cfg.allowedEmails.map(item => String(item).toLowerCase()) : [];
    const blocked = !!email && allowed.length > 0 && !allowed.includes(email);
    onChange?.({ user: blocked ? null : user, auth, db, ready: true, error: blocked ? "Email non autorise" : "" });
    if (blocked) auth.signOut();
  });

  return { auth, db };
}

export async function signInWithGoogle(auth) {
  if (!auth || !window.firebase) throw new Error("Connexion non disponible");
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await auth.signInWithPopup(provider);
}

export async function signOut(auth) {
  if (auth) await auth.signOut();
}
