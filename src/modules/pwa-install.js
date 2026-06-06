const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isiOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isFirefox = () => /firefox|fxios/i.test(navigator.userAgent);
const isAndroid = () => /android/i.test(navigator.userAgent);
const isEdge = () => /edg\//i.test(navigator.userAgent);
const needsManualInstall = () => isiOS() || isFirefox();
const installLabel = () => needsManualInstall() ? "Ajouter" : "Installer l'app";
const INSTALL_RELOAD_KEY = "planning-avd-edge-app-install-reload";
const CONTROL_RELOAD_KEY = "planning-avd-edge-app-controlled";

const getAppScope = () => {
  const currentUrl = new URL(window.location.href);
  if (currentUrl.pathname === "/Planning-AVD" || currentUrl.pathname.startsWith("/Planning-AVD/")) {
    return new URL("/Planning-AVD/", currentUrl.origin);
  }
  return new URL("./", currentUrl.href);
};

const installHelp = () => {
  const message = isiOS()
    ? "Installation iPhone/iPad : ouvrez le bouton Partager, puis Ajouter à l'écran d'accueil."
    : isFirefox() && isAndroid()
      ? "Firefox Android : ouvrez le menu du navigateur, puis Ajouter à l'écran d'accueil."
      : isFirefox()
        ? "Firefox ordinateur ne propose pas l'installation automatique comme Chrome ou Edge. Gardez l'onglet ouvert ou créez un raccourci depuis le navigateur."
      : isEdge()
        ? "Planning-AVD est pret comme app. Edge bloque seulement le bouton automatique ici : ouvrez le menu Edge, puis Applications, puis Installer Planning-AVD. Si Edge ecrit Installer ce site comme une application, c'est bien l'app Planning-AVD."
      : isAndroid()
        ? "Si le bouton automatique ne s'ouvre pas encore, rechargez la page puis ouvrez le menu du navigateur et choisissez Installer l'application."
        : "Si le bouton automatique ne s'ouvre pas encore, ouvrez le menu du navigateur puis choisissez Installer Planning-AVD.";
  alert(message);
};

const wait = timeout => new Promise(resolve => setTimeout(resolve, timeout));

const getInstallPrompt = () => window.__planningAvdInstallPrompt || null;

const reloadOnceForInstall = button => {
  try {
    if (sessionStorage.getItem(INSTALL_RELOAD_KEY) === "done") return false;
    sessionStorage.setItem(INSTALL_RELOAD_KEY, "done");
  } catch {
    return false;
  }
  button.disabled = true;
  button.textContent = "Activation";
  window.location.reload();
  return true;
};

const reloadOnceAfterControl = async () => {
  if (!("serviceWorker" in navigator) || navigator.serviceWorker.controller) return;
  try {
    if (sessionStorage.getItem(CONTROL_RELOAD_KEY) === "done") return;
    sessionStorage.setItem(CONTROL_RELOAD_KEY, "done");
    await Promise.race([navigator.serviceWorker.ready, wait(2200)]);
    if (!navigator.serviceWorker.controller) window.location.reload();
  } catch {}
};

const notifyUpdateReady = registration => {
  const updateServiceWorker = () => {
    if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  };
  window.dispatchEvent(new CustomEvent("planning-avd-update-ready", { detail: { updateServiceWorker } }));
};

const watchServiceWorkerUpdate = registration => {
  if (registration.waiting) notifyUpdateReady(registration);
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) notifyUpdateReady(registration);
      if (worker.state === "activated") window.dispatchEvent(new Event("planning-avd-offline-ready"));
    });
  });
};

const setButtonReady = button => {
  button.classList.add("is-ready");
  button.title = "Installer Planning-AVD sur cet appareil";
};

const setButtonWaiting = button => {
  if (needsManualInstall()) return;
  button.classList.remove("is-ready");
  button.title = "Edge peut demander une installation manuelle si le bouton natif n'est pas disponible";
};

export function initPwaInstall() {
  if ("serviceWorker" in navigator) {
    const appScope = getAppScope();
    const serviceWorkerUrl = new URL("sw.js", appScope);
    // [ID-PWA-04] This uses a real browser URL so GitHub Pages can load source files safely.
    navigator.serviceWorker
      .register(serviceWorkerUrl.href, { scope: appScope.pathname, updateViaCache: "none" })
      .then(registration => {
        watchServiceWorkerUpdate(registration);
        return registration.update().catch(() => {}).finally(reloadOnceAfterControl);
      })
      .catch(() => {});
  }

  let installPrompt = getInstallPrompt();
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    window.__planningAvdInstallPrompt = event;
    try {
      sessionStorage.removeItem(INSTALL_RELOAD_KEY);
      sessionStorage.removeItem(CONTROL_RELOAD_KEY);
    } catch {}
    document.querySelectorAll(".pwa-install-button").forEach(setButtonReady);
  });
  window.addEventListener("planning-avd-install-ready", () => {
    installPrompt = getInstallPrompt();
    document.querySelectorAll(".pwa-install-button").forEach(setButtonReady);
  });

  const addButton = () => {
    if (isStandalone() || document.querySelector(".pwa-install-button")) return;
    const actionRow = document.querySelector(".topbar .action-row");
    if (!actionRow) return;
    const button = document.createElement("button");
    button.className = "btn pwa-install-button";
    button.type = "button";
    button.textContent = installLabel();
    button.title = needsManualInstall() ? "Voir comment ajouter Planning-AVD" : "Installer Planning-AVD sur cet appareil";
    if (installPrompt || getInstallPrompt()) setButtonReady(button);
    else setButtonWaiting(button);
    button.addEventListener("click", async () => {
      if (isStandalone()) return button.remove();
      if (needsManualInstall()) return installHelp();
      if (!installPrompt) installPrompt = getInstallPrompt();
      if (!installPrompt && navigator.serviceWorker?.ready) {
        button.disabled = true;
        button.textContent = "Préparation";
        await Promise.race([navigator.serviceWorker.ready, wait(1800)]).catch(() => {});
        if (!navigator.serviceWorker.controller && reloadOnceForInstall(button)) return;
        installPrompt = getInstallPrompt();
        button.disabled = false;
        button.textContent = installLabel();
      }
      if (!installPrompt && reloadOnceForInstall(button)) return;
      if (!installPrompt) return installHelp();
      await installPrompt.prompt();
      await installPrompt.userChoice.catch(() => {});
      if (window.__planningAvdInstallPrompt === installPrompt) window.__planningAvdInstallPrompt = null;
      installPrompt = null;
      if (isStandalone()) button.remove();
    });
    actionRow.appendChild(button);
  };

  setTimeout(addButton, 0);
  setTimeout(addButton, 1200);
  window.addEventListener("appinstalled", () => document.querySelector(".pwa-install-button")?.remove());
}
