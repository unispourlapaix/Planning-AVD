const CDN = "https://www.gstatic.com/firebasejs/10.14.1";
const REDIRECT_ERROR_KEY = "planning-avd-google-redirect-error";
const REDIRECT_PENDING_KEY = "planning-avd-google-redirect-pending";
const DESKTOP_POPUP_TIMEOUT_MS = 12000;
const MOBILE_POPUP_TIMEOUT_MS = 60000;
const REDIRECT_RESULT_TIMEOUT_MS = 5000;

const isStandaloneApp = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches
  || window.navigator.standalone === true;

const shouldFallbackToRedirect = error => {
  const code = String(error?.code || "");
  return [
    "auth/cancelled-popup-request",
    "auth/operation-not-supported-in-this-environment",
    "auth/popup-blocked",
    "auth/popup-closed-by-user",
    "auth/popup-timeout",
  ].includes(code);
};

const isMobileLike = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");

const popupTimeout = () => new Promise((_, reject) => {
  window.setTimeout(() => {
    const error = new Error("La fenêtre Google semble bloquée. Passage en redirection.");
    error.code = "auth/popup-timeout";
    reject(error);
  }, isStandaloneApp() || isMobileLike() ? MOBILE_POPUP_TIMEOUT_MS : DESKTOP_POPUP_TIMEOUT_MS);
});
const redirectResultTimeout = () => new Promise(resolve => window.setTimeout(resolve, REDIRECT_RESULT_TIMEOUT_MS));
const readRedirectError = () => {
  try {
    return sessionStorage.getItem(REDIRECT_ERROR_KEY) || "";
  } catch {
    return "";
  }
};
const writeRedirectError = message => {
  try {
    sessionStorage.setItem(REDIRECT_ERROR_KEY, message);
  } catch {}
};
const clearRedirectError = () => {
  try {
    sessionStorage.removeItem(REDIRECT_ERROR_KEY);
  } catch {}
};
const markRedirectPending = () => {
  try {
    sessionStorage.setItem(REDIRECT_PENDING_KEY, "1");
  } catch {}
};
const clearRedirectPending = () => {
  try {
    sessionStorage.removeItem(REDIRECT_PENDING_KEY);
  } catch {}
};

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
  await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
  if (!window.__planningAvdFirestoreSettingsApplied) {
    window.__planningAvdFirestoreSettingsApplied = true;
    try {
      db.settings({ experimentalAutoDetectLongPolling: true, merge: true });
    } catch {}
  }

  let redirectError = readRedirectError();
  let lastUser = null;
  const emitAuthState = user => {
    lastUser = user || null;
    if (user) {
      redirectError = "";
      clearRedirectError();
      clearRedirectPending();
    }
    const email = String(user?.email || "").toLowerCase();
    const allowed = Array.isArray(cfg.allowedEmails) ? cfg.allowedEmails.map(item => String(item).toLowerCase()) : [];
    const blocked = cfg.restrictSignIn === true && !!email && allowed.length > 0 && !allowed.includes(email);
    onChange?.({ user: blocked ? null : user, auth, db, ready: true, error: blocked ? "Email non autorise" : user ? "" : redirectError });
    if (blocked) auth.signOut();
  };

  Promise.race([auth.getRedirectResult(), redirectResultTimeout()])
    .then(result => {
      if (result?.user) {
        redirectError = "";
        clearRedirectError();
      }
      clearRedirectPending();
      emitAuthState(auth.currentUser || result?.user || lastUser);
    })
    .catch(error => {
      redirectError = error?.message || "Connexion Google interrompue.";
      writeRedirectError(redirectError);
      clearRedirectPending();
      emitAuthState(lastUser);
    });

  auth.onAuthStateChanged(emitAuthState);

  return { auth, db };
}

export async function signInWithGoogle(auth) {
  if (!auth || !window.firebase) throw new Error("Connexion non disponible");
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await Promise.race([auth.signInWithPopup(provider), popupTimeout()]);
  } catch (error) {
    if (!shouldFallbackToRedirect(error)) throw error;
    clearRedirectError();
    markRedirectPending();
    await auth.signInWithRedirect(provider);
  }
}

export async function signOut(auth) {
  if (!auth) {
    window.location.reload();
    return;
  }
  await auth.signOut();
  setTimeout(() => {
    if (auth.currentUser) window.location.reload();
  }, 350);
}

