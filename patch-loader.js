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
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        reject(new Error(url + " introuvable (" + xhr.status + ")"));
      }
    };
    xhr.onerror = () => reject(new Error(url + " inaccessible"));
    xhr.send();
  });

  try {
    let code = await loadText("https://raw.githubusercontent.com/unispourlapaix/Planning-AVD/main/browser-loader.js?v=20260525-menu-labels");
    code = code.replace(
      'const response = await fetch("./planning-avd.jsx", { cache: "no-cache" });',
      'const response = await fetch("https://raw.githubusercontent.com/unispourlapaix/Planning-AVD/main/planning-avd.jsx?v=20260525-menu-labels", { cache: "no-cache" });'
    );
    (0, eval)(code + "\n//# sourceURL=browser-loader.safe.js");
  } catch (error) {
    fail(error);
  }
})();
