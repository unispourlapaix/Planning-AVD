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
      .replace("export default function App()", "function App()")
      .replace(
        '<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginTop:10}}>{[["month","📅"],["week","📋"],["hours","⏱"],["config","⚙️"]].map(x=><button key={x[0]} onClick={()=>setView(x[0])} style={btn(view===x[0],"#7BAFD4")}>{x[1]}</button>)}</div>',
        '<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginTop:10}}>{[["month","📅","Mois"],["week","📋","Semaine"],["hours","⏱","Heures"],["config","⚙️","Réglages"]].map(x=><button key={x[0]} onClick={()=>setView(x[0])} style={{...btn(view===x[0],"#7BAFD4"),minHeight:52,display:"grid",placeItems:"center",lineHeight:1.05}}><span style={{fontSize:17}}>{x[1]}</span><span style={{fontSize:11}}>{x[2]}</span></button>)}</div>'
      )
      .replace(
        '<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}><span style={{fontSize:12,color:"#657C91"}}>Initiales et noms masques hors session connectee.</span><button onClick={()=>setEmailMod(true)} style={btn(true,"#7BAFD4")}>📧</button></div>',
        '<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginTop:10}}><span style={{fontSize:12,color:"#657C91"}}>Vue mensuelle</span><button onClick={()=>setEmailMod(true)} style={btn(true,"#7BAFD4")}>📧 Envoyer</button></div>'
      )
      .replace(
        '<button onClick={()=>setEmailMod(true)} style={btn(true,"#7BAFD4")}>📧 Email / Imprimer</button>',
        '<button onClick={()=>setEmailMod(true)} style={btn(true,"#7BAFD4")}>📧 Envoyer ou imprimer</button>'
      )
      .replace(
        '<button title="Vue annuelle" onClick={()=>setYearMod(true)} style={btn(false)}>📅</button><button title="Rapport" onClick={()=>setPdfMod(true)} style={btn(false)}>📄</button>',
        '<button title="Vue annuelle" onClick={()=>setYearMod(true)} style={btn(false)}>📅 Année</button><button title="Rapport" onClick={()=>setPdfMod(true)} style={btn(false)}>📄 Rapport</button>'
      );

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
