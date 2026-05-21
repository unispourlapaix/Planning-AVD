(async () => {
  const root = document.getElementById("root");
  const cfg = window.PLANNING_AVD_AUTH || {};
  const auth = { email: "", name: "", isConnected: false };
  window.PlanningAVDAuth = auth;

  const fail = error => {
    console.error(error);
    root.innerHTML = '<div style="font:16px system-ui;padding:24px;color:#7a1d1d">Impossible de charger Planning-AVD. Rechargez la page dans un instant.</div>';
  };

  const loadScript = src => new Promise((resolve, reject) => {
    if ([...document.scripts].some(s => s.src === src)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Chargement impossible: ${src}`));
    document.head.appendChild(s);
  });

  const allowed = email => {
    const list = Array.isArray(cfg.allowedEmails) ? cfg.allowedEmails.map(x => String(x).toLowerCase().trim()).filter(Boolean) : [];
    return !list.length || list.includes(String(email || "").toLowerCase().trim());
  };

  const firebaseReady = () => {
    const c = cfg.firebaseConfig || {};
    return !!(c.apiKey && c.authDomain && c.projectId && c.appId);
  };

  const initFirebase = async () => {
    if (!firebaseReady()) return null;
    await loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js");
    if (!firebase.apps.length) firebase.initializeApp(cfg.firebaseConfig);
    const fa = firebase.auth();
    fa.useDeviceLanguage();
    return fa;
  };

  const updateAuth = user => {
    auth.email = user?.email || "";
    auth.name = user?.displayName || "";
    auth.isConnected = !!auth.email && allowed(auth.email);
  };

  const signInGoogle = async fa => {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await fa.signInWithPopup(provider);
    updateAuth(result.user);
    if (!auth.isConnected) {
      await fa.signOut();
      updateAuth(null);
      throw new Error("Ce compte Google n'est pas autorise.");
    }
  };

  const mountAuthBar = fa => {
    const bar = document.createElement("div");
    bar.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:1000;font:700 13px Nunito,system-ui,sans-serif";
    const render = () => {
      bar.innerHTML = auth.isConnected
        ? `<button style="border:0;border-radius:999px;padding:10px 13px;background:#68C49A;color:white;font-weight:900;box-shadow:0 8px 24px rgba(40,90,120,.22)">Google : ${auth.email} · sortir</button>`
        : '<button style="border:0;border-radius:999px;padding:10px 13px;background:#294C69;color:white;font-weight:900;box-shadow:0 8px 24px rgba(40,90,120,.22)">Connexion Google</button>';
    };
    bar.onclick = async () => {
      if (!fa) return alert("Google/Firebase n'est pas encore configure dans auth-config.js.");
      if (auth.isConnected) {
        await fa.signOut();
        updateAuth(null);
        location.reload();
        return;
      }
      try {
        await signInGoogle(fa);
        location.reload();
      } catch (error) {
        alert(error.message);
      }
    };
    render();
    document.body.appendChild(bar);
    return render;
  };

  const googleConfigView = `function ConfigView() {
    const connected = !!window.PlanningAVDAuth?.isConnected;
    return <div className="su" style={{display:"grid",gap:10}}>
      <div style={{...card,padding:12}}><b style={{color:"#31556F"}}>Statuts</b>{TIDS.map(p=><div key={p} style={{display:"flex",alignItems:"center",gap:8,marginTop:9}}><Av t={p} st={stat[p]} names={names} priv={priv}/><span style={{flex:1,fontWeight:900,color:PAL[pidIx(p)].text}}>{pName(names,p,priv)}</span>{Object.keys(STATUTS).map(s=><button key={s} onClick={()=>setStat(x=>({...x,[p]:s}))} style={btn(stat[p]===s,PAL[pidIx(p)].solid)}>{s==="dispo"?"✅":s==="absent"?"🚫":"🔄"}</button>)}</div>)}</div>
      <div style={{...card,padding:12}}><b style={{color:"#31556F"}}>Rotation + noms prives</b><p style={{fontSize:12,color:"#667F94",margin:"6px 0"}}>Connexion Google requise pour afficher ou modifier les noms.</p><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,margin:"8px 0 12px"}}>{TIDS.map((p,i)=><button key={p} onClick={()=>setSWI(i)} style={btn(swi===i,PAL[i].solid)}><Av t={p} sz={25} names={names} priv={priv}/></button>)}</div>{connected ? TIDS.map(p=><input key={p} value={names[p]||""} onChange={e=>setNames(x=>({...x,[p]:e.target.value}))} placeholder={NDEF[p]} style={{width:"100%",boxSizing:"border-box",marginTop:7,padding:10,borderRadius:12,border:"1px solid #D6E7F5"}} />) : TIDS.map(p=><div key={p} style={{...btn(false),width:"100%",marginTop:7,textAlign:"left"}}>🔒 {pName(names,p,false)}</div>)}</div>
      <div style={{...card,padding:12}}><b style={{color:"#31556F"}}>Connexion</b><p style={{fontSize:13,color:"#667F94",margin:"7px 0 0"}}>{connected ? "Compte Google connecte : "+window.PlanningAVDAuth.email : "Utilisez le bouton Connexion Google en bas de l'ecran."}</p></div>
    </div>;
  }

  function DayModal`;

  try {
    const fa = await initFirebase();
    const renderAuth = mountAuthBar(fa);
    if (fa) fa.onAuthStateChanged(user => { updateAuth(user); renderAuth(); });

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
      .replace("const withAdmin = (title,fn,force=false) => { if (adminSess && !force) fn(); else setAdminMod({title,fn}); };", "const withAdmin = (title,fn,force=false) => { if (window.PlanningAVDAuth?.isConnected) fn(); else alert('Connexion Google requise.'); };")
      .replace(/function ConfigView\(\) \{[\s\S]*?\n  function DayModal/, googleConfigView);

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
