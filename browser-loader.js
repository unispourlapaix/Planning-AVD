(async () => {
  const root = document.getElementById("root");
  const cfg = window.PLANNING_AVD_AUTH || {};
  const auth = { uid: "", email: "", name: "", isConnected: false };
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

  const updateAuth = user => {
    auth.uid = user?.uid || "";
    auth.email = user?.email || "";
    auth.name = user?.displayName || "";
    auth.isConnected = !!auth.email && allowed(auth.email);
  };

  const firstAuthState = fa => new Promise(resolve => {
    let done = false;
    const timeout = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(fa.currentUser || null);
      }
    }, 1800);
    const unsub = fa.onAuthStateChanged(user => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      unsub();
      resolve(user || null);
    });
  });

  const initFirebase = async () => {
    if (!firebaseReady()) return { authService: null, db: null };
    await loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js");
    if (!firebase.apps.length) firebase.initializeApp(cfg.firebaseConfig);
    const authService = firebase.auth();
    authService.useDeviceLanguage();
    const user = await firstAuthState(authService);
    updateAuth(user);
    const db = firebase.firestore();
    return { authService, db };
  };

  const storageKey = key => String(key || "").replace(/[/.#[\]]/g, "_");

  const mountCloudStorage = db => {
    const localGet = key => {
      const raw = localStorage.getItem(key);
      return raw == null ? null : { value: raw };
    };
    const localSet = (key, value) => localStorage.setItem(key, value);

    window.storage = {
      async get(key) {
        if (!auth.isConnected || !auth.uid || !db) return localGet(key);
        try {
          const snap = await db.collection("planning-avd-users").doc(auth.uid).collection("storage").doc(storageKey(key)).get();
          return snap.exists ? { value: snap.data().value } : localGet(key);
        } catch (error) {
          console.warn("Lecture cloud impossible, repli local.", error);
          return localGet(key);
        }
      },
      async set(key, value) {
        localSet(key, value);
        if (!auth.isConnected || !auth.uid || !db) return;
        try {
          await db.collection("planning-avd-users").doc(auth.uid).collection("storage").doc(storageKey(key)).set({
            key,
            value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: auth.email,
          }, { merge: true });
        } catch (error) {
          console.warn("Sauvegarde cloud impossible, conservee en local.", error);
        }
      },
    };
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
        ? `<button style="border:0;border-radius:999px;padding:10px 13px;background:#68C49A;color:white;font-weight:900;box-shadow:0 8px 24px rgba(40,90,120,.22)">Cloud actif : ${auth.email} · sortir</button>`
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
      <div style={{...card,padding:12}}><b style={{color:"#31556F"}}>Statuts</b>{TIDS.map(p=><div key={p} style={{display:"flex",alignItems:"center",gap:8,marginTop:9}}><Av t={p} st={stat[p]} names={names} priv={priv}/><span style={{flex:1,fontWeight:900,color:PAL[pidIx(p)].text}}>{pName(names,p,priv)}</span>{Object.keys(STATUTS).map(s=><button key={s} onClick={()=>setStat(x=>({...x,[p]:s}))} style={btn(stat[p]===s,PAL[pidIx(p)].solid)}>{s==="dispo"?"OK":s==="absent"?"Absent":"Rempl."}</button>)}</div>)}</div>
      <div style={{...card,padding:12}}><b style={{color:"#31556F"}}>Roulement</b><p style={{fontSize:12,color:"#667F94",margin:"6px 0"}}>Choisissez la logique du planning mensuel.</p><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}><button onClick={()=>setSchedRule("blocks")} style={btn(schedRule==="blocks","#8B9A7A")}>Blocs standard</button><button onClick={()=>setSchedRule("twoDayRest")} style={btn(schedRule==="twoDayRest","#8B9A7A")}>2 jours + repos</button></div>{schedRule==="twoDayRest"&&<><p style={{fontSize:12,color:"#667F94",margin:"10px 0 6px"}}>Repos semaine 1</p><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>{TIDS.map((p,i)=><button key={p} onClick={()=>setRestStart(i)} style={btn(restStart===i,PAL[i].solid)}>{pName(names,p,priv)}</button>)}</div></>}</div>
      <div style={{...card,padding:12}}><b style={{color:"#31556F"}}>Equipe</b><p style={{fontSize:12,color:"#667F94",margin:"6px 0"}}>Ajustez l'ordre de depart et les libelles affiches.</p><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,margin:"8px 0 12px"}}>{TIDS.map((p,i)=><button key={p} onClick={()=>setSWI(i)} style={btn(swi===i,PAL[i].solid)}><Av t={p} sz={25} names={names} priv={priv}/></button>)}</div>{connected ? TIDS.map(p=><input key={p} defaultValue={names[p]||""} onBlur={e=>setNames(x=>({...x,[p]:e.target.value}))} placeholder={NDEF[p]} style={{width:"100%",boxSizing:"border-box",marginTop:7,padding:10,borderRadius:12,border:"1px solid #D6E7F5"}} />) : TIDS.map(p=><div key={p} style={{...btn(false),width:"100%",marginTop:7,textAlign:"left"}}>{pName(names,p,false)}</div>)}</div>
      <div style={{...card,padding:12}}><b style={{color:"#31556F"}}>Coordonnees</b><p style={{fontSize:12,color:"#667F94",margin:"6px 0"}}>Completez les informations utiles pour l'envoi et le suivi.</p>{connected ? TIDS.map(p=>{ const c=auxContacts[p]||{}; return <div key={p} style={{marginTop:10,padding:10,border:"1px solid #E5DED2",borderRadius:14,background:"#FFFDF8"}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{...btn(true,PAL[pidIx(p)].solid),width:32,height:32,padding:0}}>+</span><b style={{color:PAL[pidIx(p)].text}}>{pName(names,p,priv)}</b></div><input defaultValue={names[p]||""} onBlur={e=>setNames(x=>({...x,[p]:e.target.value}))} placeholder={NDEF[p]} style={{width:"100%",boxSizing:"border-box",marginTop:6,padding:10,borderRadius:12,border:"1px solid #E5DED2"}} /><input type="email" defaultValue={c.email||""} onBlur={e=>setAuxContacts(x=>({...x,[p]:{...(x[p]||{}),email:e.target.value.trim()}}))} placeholder="Email" style={{width:"100%",boxSizing:"border-box",marginTop:7,padding:10,borderRadius:12,border:"1px solid #E5DED2"}} /><input type="tel" defaultValue={c.tel||""} onBlur={e=>setAuxContacts(x=>({...x,[p]:{...(x[p]||{}),tel:e.target.value}}))} placeholder="Telephone" style={{width:"100%",boxSizing:"border-box",marginTop:7,padding:10,borderRadius:12,border:"1px solid #E5DED2"}} /><textarea defaultValue={c.address||""} onBlur={e=>setAuxContacts(x=>({...x,[p]:{...(x[p]||{}),address:e.target.value}}))} placeholder="Adresse complete" style={{width:"100%",boxSizing:"border-box",minHeight:58,marginTop:7,padding:10,borderRadius:12,border:"1px solid #E5DED2"}} /></div>; }) : <div style={{...btn(false),width:"100%",textAlign:"left"}}>Connexion Google requise</div>}</div>
      <div style={{...card,padding:12}}><b style={{color:"#31556F"}}>Sauvegarde</b><p style={{fontSize:13,color:"#667F94",margin:"7px 0 0"}}>{connected ? "Synchronisation active : "+window.PlanningAVDAuth.email : "Connexion Google pour synchroniser."}</p></div>
    </div>;
  }

  function DayModal`;

  try {
    const { authService, db } = await initFirebase();
    mountCloudStorage(db);
    const renderAuth = mountAuthBar(authService);
    if (authService) authService.onAuthStateChanged(user => { updateAuth(user); renderAuth(); });

    if (!window.React || !window.ReactDOM || !window.Babel) {
      throw new Error("React ou Babel n'est pas charge.");
    }

    const response = await fetch("./planning-avd.jsx", { cache: "no-cache" });
    if (!response.ok) throw new Error(`planning-avd.jsx introuvable (${response.status})`);

    let source = await response.text();
    const schedulingSource = `// == MODULE SCH-001 == Scheduler multi-regles
const buildBlockSched = (y,m,startWeIdx,blkOverrides={},names=NDEF,statuts={},inheritWeWorker=null) => {
  const blks = getBlocks(y,m).map(b => ({...b, workerId:null, cross:false}));
  const weTeam = ["P1","P2","P3","P4"], wdTeam = ["P1","P2","P3"];
  let weIdx = startWeIdx || 0, wdIdx = 0, prevWe = null, prevWd = null, dup = 0;
  const usable = p => statuts[p] !== "absent";
  blks.forEach(b => {
    if (b.type !== "we") return;
    if (blkOverrides[b.idx]) { b.workerId = blkOverrides[b.idx]; if (usable(b.workerId)) weIdx = (weTeam.indexOf(b.workerId)+1+weTeam.length)%weTeam.length; prevWe = b.workerId; return; }
    if (inheritWeWorker && b.start === 1 && dowD(y,m,1) >= 5) { b.workerId = inheritWeWorker; b.cross = true; prevWe = b.workerId; return; }
    for (let k=0;k<weTeam.length;k++) { const p = weTeam[(weIdx+k)%weTeam.length]; if (usable(p)) { b.workerId = p; weIdx = (weIdx+k+1)%weTeam.length; prevWe = p; return; } }
    b.workerId = weTeam[weIdx]; prevWe = b.workerId;
  });
  blks.forEach((b,i) => {
    if (b.type !== "wd") return;
    if (blkOverrides[b.idx] && blkOverrides[b.idx] !== WE_ONLY) { b.workerId = blkOverrides[b.idx]; wdIdx = (wdTeam.indexOf(b.workerId)+1+wdTeam.length)%wdTeam.length; prevWd = b.workerId; return; }
    const sameWeekWE = blks.find(x => x.type === "we" && x.start > b.start && x.start <= b.end + 3)?.workerId;
    const prevBlockWe = [...blks].slice(0,i).reverse().find(x => x.type === "we")?.workerId || prevWe;
    const hardAvoid = new Set([sameWeekWE,prevBlockWe].filter(Boolean));
    const legal = p => usable(p) && !hardAvoid.has(p);
    let pick = null, off = 0;
    for (let k=0;k<wdTeam.length;k++) { const p = wdTeam[(wdIdx+k)%wdTeam.length]; if (legal(p)) { pick = p; off = k; break; } }
    if (!pick && dup < 1) { pick = wdTeam[wdIdx]; dup += 1; off = 0; }
    if (!pick) { pick = wdTeam.find(p => usable(p) && p !== prevWd) || wdTeam.find(p => p !== prevWd) || wdTeam[wdIdx]; dup = 0; off = Math.max(0,wdTeam.indexOf(pick)-wdIdx); }
    if (pick === prevWd) dup += 1; else dup = 0;
    b.workerId = pick; wdIdx = (wdIdx+off+1)%wdTeam.length; prevWd = pick;
  });
  const sched = {};
  blks.forEach(b => { for(let d=b.start; d<=b.end; d++) sched[d] = {worker:b.workerId,bi:b.idx,bt:b.type,bs:b.start,be:b.end,cross:b.cross}; });
  return { sched, blks };
};

const buildTwoDayRestSched = (y,m,startIdx=0,blkOverrides={},names=NDEF,statuts={},restStart=0) => {
  const n = dim(y,m), team = ["P1","P2","P3","P4"], blks = [];
  const usable = p => statuts[p] !== "absent";
  const restWeek = p => ((team.indexOf(p) - restStart + team.length) % team.length) + 1;
  const weekOf = d => Math.min(4, Math.floor((d-1)/7)+1);
  let idx = 0, rot = startIdx || 0, prev = null;
  for (let d=1; d<=n; d+=2) {
    const b = { type:"two", start:d, end:Math.min(n,d+1), idx:idx++, workerId:null, cross:false };
    if (blkOverrides[b.idx]) b.workerId = blkOverrides[b.idx];
    if (!b.workerId) {
      for (let k=0;k<team.length;k++) {
        const p = team[(rot+k)%team.length];
        const inRest = restWeek(p) === weekOf(b.start) || restWeek(p) === weekOf(b.end);
        if (usable(p) && !inRest && p !== prev) { b.workerId = p; rot = (rot+k+1)%team.length; break; }
      }
    }
    if (!b.workerId) {
      for (let k=0;k<team.length;k++) { const p = team[(rot+k)%team.length]; if (usable(p) && p !== prev) { b.workerId = p; rot = (rot+k+1)%team.length; break; } }
    }
    b.workerId = b.workerId || team[rot%team.length];
    prev = b.workerId;
    blks.push(b);
  }
  const sched = {};
  blks.forEach(b => { for(let d=b.start; d<=b.end; d++) sched[d] = {worker:b.workerId,bi:b.idx,bt:b.type,bs:b.start,be:b.end,cross:false}; });
  return { sched, blks };
};

const buildSched = (y,m,startWeIdx,blkOverrides={},names=NDEF,statuts={},inheritWeWorker=null,rule="blocks",restStart=0) => {
  if (rule === "twoDayRest") return buildTwoDayRestSched(y,m,startWeIdx,blkOverrides,names,statuts,restStart);
  return buildBlockSched(y,m,startWeIdx,blkOverrides,names,statuts,inheritWeWorker);
};

// == MODULE STO-001`;
    source = source
      .replace(/^import\s+\{[^}]+\}\s+from\s+["']react["'];\s*/m, "const { useState, useMemo, useEffect, useCallback } = React;\n")
      .replace(/^import\s+.*?;\s*/gm, "")
      .replace(/const SUPABASE_URL[\s\S]*?const supabase = [^\n]+;\s*/m, "const ALLOWED_EMAILS = [];\nconst supabase = null;\n")
      .replace(/\/\/ ══ MODULE SCH-001[\s\S]*?\/\/ ══ MODULE STO-001/, schedulingSource)
      .replace("const BBtxt = t => t === \"wd\" ? \"Lun-Jeu\" : \"Ven-Dim\";", "const BBtxt = t => t === \"two\" ? \"2 jours\" : t === \"wd\" ? \"Lun-Jeu\" : \"Ven-Dim\";")
      .replace("export default function App()", "function App()")
      .replace("const card = {background:\"rgba(255,255,255,.9)\",border:\"1px solid rgba(180,210,235,.72)\",borderRadius:18,boxShadow:\"0 2px 14px rgba(90,150,210,.06)\"};", "const card = {background:\"rgba(255,255,255,.94)\",border:\"1px solid rgba(221,214,202,.9)\",borderRadius:16,boxShadow:\"0 10px 28px rgba(70,58,40,.06)\"};")
      .replace("const btn = (on, c=\"#7BAFD4\") => ({padding:\"9px 11px\",borderRadius:14,background:on?c:\"rgba(255,255,255,.75)\",color:on?\"white\":\"#35546F\",border:`1px solid ${on?c:\"#D6E7F5\"}`,fontWeight:900});", "const btn = (on, c=\"#8B9A7A\") => ({padding:\"10px 12px\",borderRadius:12,background:on?c:\"#FFFDF8\",color:on?\"white\":\"#4F5D4A\",border:`1px solid ${on?c:\"#E5DED2\"}`,fontWeight:900,boxShadow:on?\"0 8px 18px rgba(80,90,65,.16)\":\"0 3px 10px rgba(80,70,50,.04)\",display:\"inline-flex\",alignItems:\"center\",justifyContent:\"center\",gap:6});")
      .replace("return <div style={{position:\"sticky\",top:0,zIndex:10,backdropFilter:\"blur(18px)\",background:\"rgba(250,253,255,.78)\",borderBottom:\"1px solid rgba(190,215,235,.6)\",padding:\"10px 12px 9px\"}}>", "return <div style={{position:\"sticky\",top:0,zIndex:10,backdropFilter:\"blur(18px)\",background:\"rgba(250,247,240,.88)\",borderBottom:\"1px solid rgba(226,218,204,.9)\",padding:\"10px 12px 9px\"}}>")
      .replace("<b style={{fontSize:20,color:\"#264A69\"}}>🗓 Planning-AVD</b>", "<b style={{fontSize:20,color:\"#3F4A3A\",letterSpacing:0}}>Planning-AVD</b>")
      .replace("<div style={{display:\"flex\",gap:7}}><button title=\"Vue annuelle\" onClick={()=>setYearMod(true)} style={btn(false)}>📅</button><button title=\"Rapport\" onClick={()=>setPdfMod(true)} style={btn(false)}>📄</button></div>", "<div style={{display:\"flex\",gap:7}}><button title=\"Vue annuelle\" onClick={()=>setYearMod(true)} style={btn(false)}>📅 Annee</button><button title=\"Rapport\" onClick={()=>setPdfMod(true)} style={btn(false)}>📄 Rapport</button></div>")
      .replace("<div style={{display:\"flex\",gap:7}}><button title={priv?`Connecte : ${authEmail||\"admin\"}`:\"Connexion email\"} onClick={()=>priv?signOut():setLoginMod(true)} style={btn(priv,\"#68C49A\")}>{priv?\"🔓\":\"🔐\"}</button><button title=\"Vue annuelle\" onClick={()=>setYearMod(true)} style={btn(false)}>📅</button><button title=\"Rapport\" onClick={()=>setPdfMod(true)} style={btn(false)}>📄</button></div>", "<div style={{display:\"flex\",gap:7}}><button title={priv?`Connecte : ${authEmail||\"admin\"}`:\"Connexion\"} onClick={()=>priv?signOut():setLoginMod(true)} style={btn(priv,\"#8B9A7A\")}>{priv?\"🔓 Connecte\":\"🔐 Connexion\"}</button><button title=\"Vue annuelle\" onClick={()=>setYearMod(true)} style={btn(false)}>📅 Annee</button><button title=\"Rapport\" onClick={()=>setPdfMod(true)} style={btn(false)}>📄 Rapport</button></div>")
      .replace("<div style={{display:\"flex\",justifyContent:\"space-between\",alignItems:\"center\",marginTop:10}}><span style={{fontSize:12,color:\"#657C91\"}}>Initiales et noms masques hors session connectee.</span><button onClick={()=>setEmailMod(true)} style={btn(true,\"#7BAFD4\")}>📧</button></div>", "<div style={{display:\"flex\",justifyContent:\"space-between\",alignItems:\"center\",gap:8,marginTop:10}}><span style={{fontSize:12,color:\"#746D61\"}}>Vue mensuelle</span><button onClick={()=>setEmailMod(true)} style={btn(true,\"#8B9A7A\")}>📧 Envoyer</button></div>")
      .replace("<button onClick={()=>setEmailMod(true)} style={btn(true,\"#7BAFD4\")}>📧 Email / Imprimer</button>", "<button onClick={()=>setEmailMod(true)} style={btn(true,\"#8B9A7A\")}>📧 Envoyer ou imprimer</button>")
      .replace("return <div style={{minHeight:\"100vh\",maxWidth:430,margin:\"0 auto\",background:\"linear-gradient(155deg, #EBF5FF 0%, #FBFCFF 55%, #F0ECFF 100%)\",fontFamily:\"Nunito, system-ui, sans-serif\",color:\"#294C69\"}}>", "return <div style={{minHeight:\"100vh\",maxWidth:430,margin:\"0 auto\",background:\"linear-gradient(155deg, #F7F4EE 0%, #FFFEFA 48%, #F1EDE4 100%)\",fontFamily:\"Nunito, system-ui, sans-serif\",color:\"#3F4A3A\"}}>")
      .replace("<div style={{...card,padding:10,background:\"linear-gradient(120deg,#FFFFFF,#EEF7FF)\",fontWeight:900,color:\"#31556F\"}}>{bulle}</div>", "<div style={{...card,padding:10,background:\"linear-gradient(120deg,#FFFFFF,#F6F1E8)\",fontWeight:900,color:\"#4F5D4A\"}}>{bulle}</div>")
      .replace("<div style={{display:\"grid\",gridTemplateColumns:\"repeat(4,1fr)\",gap:7,marginTop:10}}>{[[\"month\",\"📅\"],[\"week\",\"📋\"],[\"hours\",\"⏱\"],[\"config\",\"⚙️\"]].map(x=><button key={x[0]} onClick={()=>setView(x[0])} style={btn(view===x[0],\"#7BAFD4\")}>{x[1]}</button>)}</div>", "<div style={{display:\"grid\",gridTemplateColumns:\"repeat(4,1fr)\",gap:7,marginTop:10}}>{[[\"month\",\"📅\",\"Mois\"],[\"week\",\"📋\",\"Blocs\"],[\"hours\",\"⏱\",\"Heures\"],[\"config\",\"⚙️\",\"Reglages\"]].map(x=><button key={x[0]} onClick={()=>setView(x[0])} style={{...btn(view===x[0],\"#8B9A7A\"),minHeight:52,flexDirection:\"column\",lineHeight:1.05}}><span style={{fontSize:17}}>{x[1]}</span><span style={{fontSize:11}}>{x[2]}</span></button>)}</div>")
      .replace("const [swi,setSWI] = useState(0), [bOv,setBOv] = useState({}), [spOv,setSpOv] = useState({}), [nBlks,setNBlks] = useState({});", "const [swi,setSWI] = useState(0), [bOv,setBOv] = useState({}), [spOv,setSpOv] = useState({}), [nBlks,setNBlks] = useState({});\n  const [schedRule,setSchedRule] = useState(\"blocks\"), [restStart,setRestStart] = useState(0);")
      .replace("const [names,setNames] = useState(NDEF), [stat,setStat] = useState({P1:\"dispo\",P2:\"dispo\",P3:\"dispo\",P4:\"dispo\"}), [ah,setAh] = useState({P1:0,P2:0,P3:0,P4:0});", "const [names,setNames] = useState(NDEF), [stat,setStat] = useState({P1:\"dispo\",P2:\"dispo\",P3:\"dispo\",P4:\"dispo\"}), [ah,setAh] = useState({P1:0,P2:0,P3:0,P4:0});\n  const [auxContacts,setAuxContacts] = useState({P1:{},P2:{},P3:{},P4:{}});")
      .replace("const { sched, blks } = useMemo(() => buildSched(y,m,swi,bOv,names,stat,inh),[y,m,swi,bOv,names,stat,inh]);", "const { sched, blks } = useMemo(() => buildSched(y,m,swi,bOv,names,stat,inh,schedRule,restStart),[y,m,swi,bOv,names,stat,inh,schedRule,restStart]);")
      .replace("const priv = adminSess;", "const priv = !!window.PlanningAVDAuth?.isConnected;")
      .replace("const withAdmin = (title,fn,force=false) => { if (adminSess && !force) fn(); else setAdminMod({title,fn}); };", "const withAdmin = (title,fn,force=false) => { if (window.PlanningAVDAuth?.isConnected) fn(); else alert('Connexion Google requise.'); };")
      .replace("if(sc){ setSWI(sc.swi??0); setAdminCode(sc.adminCode||ADMIN_DEF); }", "if(sc){ setSWI(sc.swi??0); setAdminCode(sc.adminCode||ADMIN_DEF); setSchedRule(sc.schedRule||\"blocks\"); setRestStart(sc.restStart??0); setAuxContacts(sc.auxContacts||Object.fromEntries(TIDS.map(p=>[p,{email:sc.auxEmails?.[p]||\"\",tel:\"\",address:\"\"}]))); }")
      .replace("if(loaded) sS(SK.cfg,{swi,adminCode}); },[swi,adminCode,loaded]);", "if(loaded) sS(SK.cfg,{swi,adminCode,auxContacts,schedRule,restStart}); },[swi,adminCode,auxContacts,schedRule,restStart,loaded]);")
      .replace("const txt = mode===\"week\" ? mkWeek(blks,y,m,+ws||1,names,priv) : mkPerson(blks,y,m,pid,acts,lieux,names,det,priv);", "const txt = mode===\"week\" ? mkWeek(blks,y,m,+ws||1,names,priv) : mkPerson(blks,y,m,pid,acts,lieux,names,det,priv);\n    const recipients = mode===\"person\" ? (auxContacts[pid]?.email||\"\") : TIDS.map(p=>auxContacts[p]?.email).filter(Boolean).join(\",\");")
      .replace("href={`mailto:?subject=Planning AVD&body=${encodeURIComponent(txt)}`}", "href={`mailto:${encodeURIComponent(recipients)}?subject=Planning AVD&body=${encodeURIComponent(txt)}`}")
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
