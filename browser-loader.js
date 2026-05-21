(async () => {
  const root = document.getElementById("root");
  const cfg = window.PLANNING_AVD_AUTH || {};
  const authKey = "planning-avd-code-session";
  const auth = { isConnected: false, until: 0 };
  window.PlanningAVDAuth = auth;

  const fail = error => {
    console.error(error);
    root.innerHTML = '<div style="font:16px system-ui;padding:24px;color:#7a1d1d">Impossible de charger Planning-AVD. Rechargez la page dans un instant.</div>';
  };

  const hashText = async text => {
    const bytes = new TextEncoder().encode(String(text || ""));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const sessionMinutes = () => Number(cfg.sessionMinutes || 480);
  const readSession = () => {
    const until = Number(localStorage.getItem(authKey) || 0);
    auth.until = until;
    auth.isConnected = until > Date.now();
    if (!auth.isConnected) localStorage.removeItem(authKey);
  };
  const openSession = () => {
    const until = Date.now() + sessionMinutes() * 60 * 1000;
    localStorage.setItem(authKey, String(until));
    auth.until = until;
    auth.isConnected = true;
  };
  const closeSession = () => {
    localStorage.removeItem(authKey);
    auth.until = 0;
    auth.isConnected = false;
  };

  const validateCode = async code => {
    if (!cfg.codeHash) throw new Error("Code non configure dans auth-config.js.");
    return (await hashText(code.trim())) === String(cfg.codeHash).toLowerCase();
  };

  const mountAuthBar = () => {
    const bar = document.createElement("div");
    bar.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:1000;font:700 13px Nunito,system-ui,sans-serif";
    const render = () => {
      readSession();
      bar.innerHTML = auth.isConnected
        ? '<button style="border:0;border-radius:999px;padding:10px 13px;background:#68C49A;color:white;font-weight:900;box-shadow:0 8px 24px rgba(40,90,120,.22)">Connecte · verrouiller</button>'
        : '<button style="border:0;border-radius:999px;padding:10px 13px;background:#294C69;color:white;font-weight:900;box-shadow:0 8px 24px rgba(40,90,120,.22)">Connexion code</button>';
    };
    bar.onclick = async () => {
      readSession();
      if (auth.isConnected) {
        closeSession();
        location.reload();
        return;
      }
      const code = prompt("Code de connexion Planning-AVD");
      if (!code) return;
      try {
        if (!(await validateCode(code))) return alert("Code incorrect.");
        openSession();
        location.reload();
      } catch (error) {
        alert(error.message);
      }
    };
    render();
    document.body.appendChild(bar);
  };

  const codeOnlyConfigView = `function ConfigView() {
    const connected = !!window.PlanningAVDAuth?.isConnected;
    return <div className="su" style={{display:"grid",gap:10}}>
      <div style={{...card,padding:12}}><b style={{color:"#31556F"}}>Statuts</b>{TIDS.map(p=><div key={p} style={{display:"flex",alignItems:"center",gap:8,marginTop:9}}><Av t={p} st={stat[p]} names={names} priv={priv}/><span style={{flex:1,fontWeight:900,color:PAL[pidIx(p)].text}}>{pName(names,p,priv)}</span>{Object.keys(STATUTS).map(s=><button key={s} onClick={()=>setStat(x=>({...x,[p]:s}))} style={btn(stat[p]===s,PAL[pidIx(p)].solid)}>{s==="dispo"?"✅":s==="absent"?"🚫":"🔄"}</button>)}</div>)}</div>
      <div style={{...card,padding:12}}><b style={{color:"#31556F"}}>Rotation + noms prives</b><p style={{fontSize:12,color:"#667F94",margin:"6px 0"}}>Code requis pour afficher ou modifier les noms.</p><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,margin:"8px 0 12px"}}>{TIDS.map((p,i)=><button key={p} onClick={()=>setSWI(i)} style={btn(swi===i,PAL[i].solid)}><Av t={p} sz={25} names={names} priv={priv}/></button>)}</div>{connected ? TIDS.map(p=><input key={p} value={names[p]||""} onChange={e=>setNames(x=>({...x,[p]:e.target.value}))} placeholder={NDEF[p]} style={{width:"100%",boxSizing:"border-box",marginTop:7,padding:10,borderRadius:12,border:"1px solid #D6E7F5"}} />) : TIDS.map(p=><div key={p} style={{...btn(false),width:"100%",marginTop:7,textAlign:"left"}}>🔒 {pName(names,p,false)}</div>)}</div>
      <div style={{...card,padding:12}}><b style={{color:"#31556F"}}>Connexion</b><p style={{fontSize:13,color:"#667F94",margin:"7px 0 0"}}>{connected ? "Session code active." : "Utilisez le bouton Connexion code en bas de l'ecran."}</p></div>
    </div>;
  }

  function DayModal`;

  try {
    readSession();
    mountAuthBar();

    if (!window.React || !window.ReactDOM || !window.Babel) {
      throw new Error("React ou Babel n'est pas charge.");
    }

    const response = await fetch("./planning-avd.jsx", { cache: "no-cache" });
    if (!response.ok) throw new Error(`planning-avd.jsx introuvable (${response.status})`);

    let source = await response.text();
    source = source
      .replace(/^import\s+\{[^}]+\}\s+from\s+["']react["'];\s*/m, "const { useState, useMemo, useEffect, useCallback } = React;\n")
      .replace("export default function App()", "function App()")
      .replace("const priv = adminSess;", "const priv = !!window.PlanningAVDAuth?.isConnected;")
      .replace("const withAdmin = (title,fn,force=false) => { if (adminSess && !force) fn(); else setAdminMod({title,fn}); };", "const withAdmin = (title,fn,force=false) => { if (window.PlanningAVDAuth?.isConnected) fn(); else alert('Code requis.'); };")
      .replace(/function ConfigView\(\) \{[\s\S]*?\n  function DayModal/, codeOnlyConfigView);

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
