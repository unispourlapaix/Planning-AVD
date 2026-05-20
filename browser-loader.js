(async () => {
  const root = document.getElementById("root");
  const cfg = window.PLANNING_AVD_AUTH || {};
  const authKey = "planning-avd-auth-session";
  const auth = {
    session: null,
    email: "",
    isConnected: false,
  };
  window.PlanningAVDAuth = auth;

  const fail = error => {
    console.error(error);
    root.innerHTML = '<div style="font:16px system-ui;padding:24px;color:#7a1d1d">Impossible de charger Planning-AVD. Rechargez la page dans un instant.</div>';
  };

  const allowed = email => {
    const list = Array.isArray(cfg.allowedEmails) ? cfg.allowedEmails.map(x => String(x).toLowerCase().trim()).filter(Boolean) : [];
    return !list.length || list.includes(String(email || "").toLowerCase().trim());
  };

  const saveSession = session => {
    auth.session = session;
    auth.email = session?.user?.email || session?.email || "";
    auth.isConnected = !!auth.email && allowed(auth.email);
    localStorage.setItem(authKey, JSON.stringify(session));
  };

  const clearSession = () => {
    auth.session = null;
    auth.email = "";
    auth.isConnected = false;
    localStorage.removeItem(authKey);
  };

  const api = async (path, options = {}) => {
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error("Connexion email non configuree.");
    const response = await fetch(`${cfg.supabaseUrl.replace(/\/$/, "")}${path}`, {
      ...options,
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${options.token || cfg.supabaseAnonKey}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) throw new Error(data?.msg || data?.message || `Erreur ${response.status}`);
    return data;
  };

  const loadStoredSession = async () => {
    try {
      const stored = JSON.parse(localStorage.getItem(authKey) || "null");
      if (!stored) return;
      if (stored.expires_at && stored.expires_at * 1000 < Date.now() + 60000 && stored.refresh_token) {
        const refreshed = await api("/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          body: JSON.stringify({ refresh_token: stored.refresh_token })
        });
        saveSession(refreshed);
        return;
      }
      saveSession(stored);
    } catch {
      clearSession();
    }
  };

  const consumeMagicLink = async () => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (!accessToken) return;
    const user = await api("/auth/v1/user", { token: accessToken });
    saveSession({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: Number(hash.get("expires_at") || 0),
      user
    });
    history.replaceState(null, document.title, window.location.pathname + window.location.search);
  };

  const sendMagicLink = async email => {
    const clean = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error("Email invalide.");
    if (!allowed(clean)) throw new Error("Email non autorise.");
    const redirect = window.location.origin + window.location.pathname;
    await api(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirect)}`, {
      method: "POST",
      body: JSON.stringify({ email: clean, create_user: false })
    });
  };

  const mountAuthBar = () => {
    const bar = document.createElement("div");
    bar.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:1000;font:700 13px Nunito,system-ui,sans-serif";
    const render = () => {
      bar.innerHTML = auth.isConnected
        ? `<button style="border:0;border-radius:999px;padding:10px 13px;background:#68C49A;color:white;font-weight:900;box-shadow:0 8px 24px rgba(40,90,120,.22)">Connecte : ${auth.email} · sortir</button>`
        : '<button style="border:0;border-radius:999px;padding:10px 13px;background:#294C69;color:white;font-weight:900;box-shadow:0 8px 24px rgba(40,90,120,.22)">Connexion email</button>';
    };
    bar.onclick = async () => {
      if (auth.isConnected) {
        clearSession();
        location.reload();
        return;
      }
      const email = prompt("Email autorise pour Planning-AVD");
      if (!email) return;
      try {
        await sendMagicLink(email);
        alert("Lien de connexion envoye. Ouvrez l'email sur cet appareil.");
      } catch (error) {
        alert(error.message);
      }
    };
    render();
    document.body.appendChild(bar);
  };

  try {
    await consumeMagicLink();
    await loadStoredSession();
    mountAuthBar();

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
