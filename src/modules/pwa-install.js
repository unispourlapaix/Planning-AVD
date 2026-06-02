const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

const installHelp = () => {
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  alert(isiOS
    ? "Pour installer Planning-AVD : ouvrez le menu Partager puis choisissez Ajouter à l'écran d'accueil."
    : "Pour installer Planning-AVD : ouvrez le menu du navigateur puis choisissez Installer ou Ajouter à l'écran d'accueil.");
};

export function initPwaInstall() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {}));
  }

  let installPrompt = null;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
  });

  const addButton = () => {
    if (isStandalone() || document.querySelector(".pwa-install-button")) return;
    const actionRow = document.querySelector(".topbar .action-row");
    if (!actionRow) return;
    const button = document.createElement("button");
    button.className = "btn pwa-install-button";
    button.type = "button";
    button.textContent = "Installer";
    button.title = "Installer Planning-AVD sur cet appareil";
    button.addEventListener("click", async () => {
      if (!installPrompt) return installHelp();
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      if (isStandalone()) button.remove();
    });
    actionRow.appendChild(button);
  };

  addButton();
  new MutationObserver(addButton).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("appinstalled", () => document.querySelector(".pwa-install-button")?.remove());
}
