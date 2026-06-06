import React from "react";

const DISMISSED_KEY = "planning-avd-install-dismissed";

export default function InstallBanner() {
  const [installEvent, setInstallEvent] = React.useState(null);
  const [showInstall, setShowInstall] = React.useState(false);
  const [updateReady, setUpdateReady] = React.useState(false);
  const [updateServiceWorker, setUpdateServiceWorker] = React.useState(null);

  React.useEffect(() => {
    // [ID-PWA-03] The install prompt can only be opened after the browser gives this event.
    const dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    const onInstallPrompt = event => {
      event.preventDefault();
      if (dismissed) return;
      setInstallEvent(event);
      setShowInstall(true);
    };
    const onAppInstalled = () => {
      setShowInstall(false);
      setInstallEvent(null);
      localStorage.removeItem(DISMISSED_KEY);
    };
    const onUpdateReady = event => {
      setUpdateServiceWorker(() => event.detail?.updateServiceWorker || null);
      setUpdateReady(true);
    };

    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("planning-avd-update-ready", onUpdateReady);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("planning-avd-update-ready", onUpdateReady);
    };
  }, []);

  const dismissInstall = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShowInstall(false);
    setInstallEvent(null);
  };

  const installApp = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice.catch(() => ({ outcome: "dismissed" }));
    if (choice.outcome !== "accepted") localStorage.setItem(DISMISSED_KEY, "1");
    setShowInstall(false);
    setInstallEvent(null);
  };

  const refreshApp = () => {
    if (updateServiceWorker) updateServiceWorker(true);
    else window.location.reload();
  };

  if (!showInstall && !updateReady) return null;

  return (
    <section className="install-banner" aria-live="polite">
      <div>
        <strong>{updateReady ? "Nouvelle version disponible" : "Installer Planning-AVD"}</strong>
        <span>{updateReady ? "Rechargez pour utiliser la derniere version." : "Ajoutez l'application sur cet appareil."}</span>
      </div>
      <div className="install-banner-actions">
        {updateReady ? (
          <button className="btn active" type="button" onClick={refreshApp}>Mettre a jour</button>
        ) : (
          <button className="btn active" type="button" onClick={installApp}>Installer l'application</button>
        )}
        {!updateReady ? <button className="btn" type="button" onClick={dismissInstall}>Plus tard</button> : null}
      </div>
    </section>
  );
}
