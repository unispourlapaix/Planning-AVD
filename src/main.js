import React from "react";
import ReactDOM from "react-dom/client";
import { initPlanningShareButton } from "./modules/share-button.js?v=20260602-save-label-live";
import { initPersonalTeamCalendar } from "./modules/personal-team-calendar.js?v=20260602";
import { initVisualShiftLabels } from "./modules/visual-shift-labels.js?v=20260602-three-letter-doubles-loop-fix";
import { initPwaInstall } from "./modules/pwa-install.js?v=20260602";

globalThis.React = React;
globalThis.ReactDOM = ReactDOM;

const [{ default: App }, { h }] = await Promise.all([
  import("./App.js?v=20260601-restored-valid"),
  import("./ui.js"),
]);
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(h(App));
initPlanningShareButton();
initPersonalTeamCalendar();
initVisualShiftLabels();
initPwaInstall();
