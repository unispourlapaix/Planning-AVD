import React from "react";
import ReactDOM from "react-dom/client";

globalThis.React = React;
globalThis.ReactDOM = ReactDOM;

const [{ default: App }, { h }] = await Promise.all([
  import("./App.js?v=20260601-share-planning"),
  import("./ui.js"),
]);
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(h(App));
