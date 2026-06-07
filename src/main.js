import React from "react";
import ReactDOM from "react-dom/client";
import { initVisualShiftLabels } from "./modules/visual-shift-labels.js?v=20260603-shift-times";
import { initPlanningShareButton } from "./modules/share-button.js?v=20260607-weekend-one";
import { initPersonalTeamCalendar } from "./modules/personal-team-calendar.js?v=20260607-personal-clean";
import { initMobileManualErgonomics } from "./modules/mobile-manual-ergonomics.js?v=20260607-topbar-settings";
import { initPersonalMobileView } from "./modules/personal-mobile-view.js?v=20260607-personal-clean";
import { initSettingsTools } from "./modules/settings-tools.js?v=20260607-topbar-settings";
import { initTopbarSettingsNav } from "./modules/topbar-settings-nav.js?v=20260607-topbar-settings";
import { initPwaInstall } from "./modules/pwa-install.js?v=20260606-direct-sw";
import { initPrivateDisplay } from "./modules/private-display.js?v=20260606-private-display";

globalThis.React = React;
globalThis.ReactDOM = ReactDOM;

const nativeAlert = window.alert.bind(window);
window.alert = message => nativeAlert(String(message)
  .replace("Planning publié", "Planning sauvegardé")
  .replace("Publication impossible", "Sauvegarde impossible"));

const [{ default: App }, { h }] = await Promise.all([
  import("./App.js?v=20260607-topbar-settings"),
  import("./ui.js"),
]);
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(h(App));
initPwaInstall();
initVisualShiftLabels();
initPlanningShareButton();
initPersonalTeamCalendar();
initMobileManualErgonomics();
initPersonalMobileView();
initSettingsTools();
initTopbarSettingsNav();
initPrivateDisplay();
