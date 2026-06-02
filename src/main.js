import React from "react";
import ReactDOM from "react-dom/client";
import { initVisualShiftLabels } from "./modules/visual-shift-labels.js?v=20260602-module-1-stacked";
import { initPlanningShareButton } from "./modules/share-button.js?v=20260602-module-2-share";

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
