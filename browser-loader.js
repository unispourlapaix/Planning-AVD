(async () => {
  const root = document.getElementById("root");
  const cfg = window.PLANNING_AVD_AUTH || {};
  const auth = { email: "", isConnected: false };
  window.PlanningAVDAuth = auth;

  const fail = error => {
    console.error(error);
    root.innerHTML = '<div style="font:16px system-ui;padding:24px;color:#7a1d1d">Impossible de charger Planning-AVD. Rechargez la page dans un instant.</div>';
  };

  const loadScript = src => new Promise((resolve, reject) => {
    if ([...document.scripts].some(s => s.src === src)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Chargement impossible: ${src}`));
    document.head.appendChild(s);
  });

  const allowed = email => {
    const list = Array.isArray(cfg.allowedEmails) ? cfg.allowedEmails.map(x => String(x).toLowerCase().trim()).filter(Boolean) : [];
    return !list.length || list.includes(String(email || "").toLowerCase().trim());
  };

  const firebaseReady = () => {
    const c = cfg.firebaseConfig || {};
    return !!(c.apiKey && c.authDomain && c.projectId && c.appId);
  };

  const initFirebase = async () => {
    if (!firebaseReady()) return null;
    await loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js");
    if (!firebase.apps.length) firebase.initializeApp(cfg.firebaseConfig);
    const fa = firebase.auth();
    fa.useDeviceLanguage();
    return fa;
  };

  const updateAuth = user => {
    auth.email = user?.email || "";
    auth.isConnected = !!auth.email && allowed(auth.email);
  };

  const actionCodeSettings = () => ({
    url: window.location.origin + window.location.pathname,
    handleCodeInApp: true,
  });

  const sendMagicLink = async (fa, email) => {
    const clean = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error("Email invalide.");
    if (!allowed(clean)) throw new Error("Email non autorise.");
    await fa.sendSignInLinkToEmail(clean, actionCodeSettings());
    localStorage.setItem("planning-avd-email-for-link", clean);
  };

  const finishEmailLink = async fa => {
    if (!fa || !fa.isSignInWithEmailLink(window.location.href)) return;
    let email = localStorage.getItem("planning-avd-email-for-link") || "";
    if (!email) email = prompt("Confirmez votre email pour terminer la connexion") || "";
    const result = await fa.signInWithEmailLink(email, window.location.href);
    localStorage.removeItem("planning-avd-email-for-link");
    updateAuth(result.user);
    history.replaceState(null, document.title, window.location.origin + window.location.pathname);
  };

  const mountAuthBar = fa => {
    const bar = document.createElement("div");
    bar.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:1000;font:700 13px Nunito,system-ui,sans-serif";
    const render = () => {
      bar.innerHTML = auth.isConnected
        ? `<button style="border:0;border-radius:999px;padding:10px 13px;background:#68C49A;color:white;font-weight:900;box-shadow:0 8px 24px rgba(40,90,120,.22)">Connecte : ${auth.email} · sortir</button>`
        : '<button style="border:0;border-radius:999px;padding:10px 13px;background:#294C69;color:white;font-weight:900;box-shadow:0 8px 24px rgba(40,90,120,.22)">Connexion email</button>';
    };
    bar.onclick = async () => {
      if (!fa) return alert("Firebase Auth n'est pas encore configure dans auth-config.js.");
      if (auth.isConnected) {
        await fa.signOut();
        updateAuth(null);
        location.reload();
        return;
      }
      const email = prompt("Email autorise pour Planning-AVD");
      if (!email) return;
      try {
        await sendMagicLink(fa, email);
        alert("Lien de connexion envoye. Ouvrez l'email sur cet appareil.");
      } catch (error) {
        alert(error.message);
      }
    };
    render();
    document.body.appendChild(bar);
    return render;
  };

  try {
    const fa = await initFirebase();
    if (fa) await finishEmailLink(fa);
    const renderAuth = mountAuthBar(fa);
    if (fa) fa.onAuthStateChanged(user => { updateAuth(user); renderAuth(); });

    if (!window.React || !window.ReactDOM || !window.Babel) {
      throw new Error("React ou Babel n'est pas charge.");
    }

    const response = await fetch("./planning-avd.jsx", { cache: "no-cache" });
    if (!response.ok) throw new Error(`planning-avd.jsx introuvable (${response.status})`);

    let source = await response.text();
    source = source
      .replace(/^import\s+\{[^}]+\}\s+from\s+["']react["'];\s*/m, "const { useState, useMemo, useEffect, useCallback } = React;\n")
      .replace("export default function App()", "function App()")
      .replace("const priv = adminSess;", "const priv = adminSess || !!window.PlanningAVDAuth?.isConnected;");

    source += "\nReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));";

    const compiled = Babel.transform(source, {
      presets: [["react", { runtime: "classic" }]],
      sourceType: "script",
    }).code;

    new Function("React", "ReactDOM", compiled)(window.React, window.ReactDOM);
  } catch (error) {
    fail(error);
  }
})();
