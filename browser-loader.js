(async () => {
  const root = document.getElementById("root");

  const fail = error => {
    console.error(error);
    if (root) {
      root.innerHTML = '<div style="font:16px system-ui;padding:24px;color:#7a1d1d;white-space:pre-wrap">Impossible de charger Planning-AVD.\n' + String(error && (error.stack || error.message) || error) + '</div>';
    }
  };

  const loadText = url => new Promise((resolve, reject) => {
    if (window.fetch) {
      fetch(url, { cache: "no-cache" })
        .then(response => response.ok ? response.text() : Promise.reject(new Error(url + " introuvable (" + response.status + ")")))
        .then(resolve, reject);
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
      else reject(new Error(url + " introuvable (" + xhr.status + ")"));
    };
    xhr.onerror = () => reject(new Error(url + " inaccessible"));
    xhr.send();
  });

  try {
    if (!window.React || !window.ReactDOM || !window.Babel) {
      throw new Error("React ou Babel n'est pas charge.");
    }

    if (!window.storage) {
      window.storage = {
        async get(key) {
          const raw = localStorage.getItem(key);
          return raw == null ? null : { value: raw };
        },
        async set(key, value) {
          localStorage.setItem(key, value);
        },
      };
    }

    const response = await fetch("./planning-avd.jsx", { cache: "no-cache" });
    if (!response.ok) throw new Error("planning-avd.jsx introuvable (" + response.status + ")");

    let source = await response.text();
    source = "const { useState, useMemo, useEffect, useCallback } = React;\n" + source
      .replace(/^import[^\n]*(?:\r?\n|$)/gm, "")
      .replace("export default function App()", "function App()");

    source += "\nReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));";

    const compiled = Babel.transform(source, {
      presets: [["react", { runtime: "classic" }]],
      sourceType: "script",
    }).code;

    new Function("React", "ReactDOM", compiled)(window.React, window.ReactDOM);
  } catch (error) {
    fail(error);
  }
})();
