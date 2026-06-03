import React from "react";
import ReactDOM from "react-dom/client";
import { initVisualShiftLabels } from "./modules/visual-shift-labels.js?v=20260602-module-1-stacked-week-fix";
import { initPlanningShareButton } from "./modules/share-button.js?v=20260602-module-2-share";
import { initPersonalTeamCalendar } from "./modules/personal-team-calendar.js?v=20260603-personal-fallback";
import { initPwaInstall } from "./modules/pwa-install.js?v=20260602-module-4-install-safe";
import { initMobileManualErgonomics } from "./modules/mobile-manual-ergonomics.js?v=20260602-module-10-action-row";
import { initSettingsTools } from "./modules/settings-tools.js?v=20260602-module-9-settings-only";

globalThis.React = React;
globalThis.ReactDOM = ReactDOM;

const [{ default: App }, { h }] = await Promise.all([
  import("./App.js?v=20260601-restored-valid"),
  import("./ui.js"),
]);
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(h(App));
initVisualShiftLabels();
initPlanningShareButton();
initPersonalTeamCalendar();
initPwaInstall();
initMobileManualErgonomics();
initSettingsTools();
