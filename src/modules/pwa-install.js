const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isiOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isFirefox = () => /firefox|fxios/i.test(navigator.userAgent);
const isAndroid = () => /android/i.test(navigator.userAgent);
const needsManualInstall = () => isiOS() || isFirefox();
const installLabel = () => needsManualInstall() ? "Ajouter" : "Installer";

const installHelp = () => {
  const message = isiOS()
    ? "Installation iPhone/iPad : ouvrez le bouton Partager, puis Ajouter à l'écran d'accueil."
    : isFirefox() && isAndroid()
      ? "Firefox Android : ouvrez le menu du navigateur, puis Ajouter à l'écran d'accueil."
      : isFirefox()
        ? "Firefox ordinateur ne propose pas l'installation automatique comme Chrome ou Edge. Gardez l'onglet ouvert ou créez un raccourci depuis le navigateur."
      : isAndroid()
        ? "Si le bouton automatique ne s'ouvre pas encore, rechargez la page puis ouvrez le menu du navigateur et choisissez Installer l'application."
        : "Si le bouton automatique ne s'ouvre pas encore, ouvrez le menu du navigateur puis choisissez Installer Planning-AVD.";
  alert(message);
};

const wait = timeout => new Promise(resolve => setTimeout(resolve, timeout));

const getInstallPrompt = () => window.__planningAvdInstallPrompt || null;

const setButtonReady = button => {
  button.classList.add("is-ready");
  button.title = "Installer Planning-AVD sur cet appareil";
};

export function initPwaInstall() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js", { scope: "./", updateViaCache: "none" })
      .then(registration => registration.update().catch(() => {}))
      .catch(() => {});
  }

  let installPrompt = getInstallPrompt();
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    window.__planningAvdInstallPrompt = event;
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
    button.addEventListener("click", async () => {
      if (isStandalone()) return button.remove();
      if (needsManualInstall()) return installHelp();
      if (!installPrompt) installPrompt = getInstallPrompt();
      if (!installPrompt && navigator.serviceWorker?.ready) {
        button.disabled = true;
        button.textContent = "Préparation";
        await Promise.race([navigator.serviceWorker.ready, wait(1800)]).catch(() => {});
        installPrompt = getInstallPrompt();
        button.disabled = false;
        button.textContent = installLabel();
      }
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
