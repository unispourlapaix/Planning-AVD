export async function requestCalendarLandscape(doc = document, orientation = screen.orientation) {
  if (!orientation?.lock) return false;
  let enteredFullscreen = false;
  try {
    if (!doc.fullscreenElement && doc.documentElement.requestFullscreen) {
      await doc.documentElement.requestFullscreen();
      enteredFullscreen = true;
    }
    await orientation.lock("landscape");
    return true;
  } catch {
    if (enteredFullscreen && doc.fullscreenElement) await doc.exitFullscreen().catch(() => {});
    return false;
  }
}
export async function openCalendarLandscape() {
  if (document.fullscreenElement) {
    screen.orientation?.unlock?.();
    await document.exitFullscreen().catch(() => {});
    return;
  }
  if (!await requestCalendarLandscape()) window.alert("Tournez votre téléphone en paysage. Si nécessaire, activez la rotation automatique dans les réglages du téléphone. Le calendrier peut aussi défiler horizontalement.");
}
