export const ownsAppCache = (name, scope) => name.startsWith("planning-avd-")
  || (name.startsWith("workbox-") && name.includes(scope));

export async function retireInstalledApp() {
  const scope = new URL(import.meta.env?.BASE_URL || "/Planning-AVD/", location.origin).href;
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter(registration => registration.scope === scope).map(async registration => {
      try { await registration.update(); } catch {}
      await registration.unregister();
    }));
  }
  if ("caches" in globalThis) {
    const names = await caches.keys();
    await Promise.all(names.filter(name => ownsAppCache(name, scope)).map(name => caches.delete(name)));
  }
}

export function showShortcutHelp() {
  alert("Planning-AVD s'utilise dans le navigateur.\n\nPour un raccourci : ajoutez cette page aux favoris, ou utilisez Ajouter à l'écran d'accueil dans le menu du navigateur. Si une option Ouvrir comme app est proposée, désactivez-la.\n\nAvant de supprimer une ancienne installation, vérifiez sa sauvegarde cloud ou exportez sa sauvegarde locale depuis Réglages.");
}
