import { useState, useMemo, useEffect, useCallback } from "react";

// ══ MODULE CFG-001 ══ Constantes globales
const MAX_H = 151;
const EMPLOYER = "Employeur";
const MFR = ["Janvier","Fevrier","Mars","Avril","Mai","Juin","Juillet","Aout","Septembre","Octobre","Novembre","Decembre"];
const DL = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const DS = ["L","M","M","J","V","S","D"];
const WE_ONLY = "P4";
const ADMIN_DEF = "00000001A";

// ══ MODULE CFG-002 ══ Equipe
const TIDS = ["P1","P2","P3","P4"];
const NDEF = { P1:"Auxiliaire 1", P2:"Auxiliaire 2", P3:"Auxiliaire 3", P4:"Auxiliaire 4" };
const STATUTS = { dispo:"Disponible", absent:"Absent", remplace:"Remplacant" };
const PAL = [
  {solid:"#7BAFD4", light:"#E6F3FF", pill:"#CCE8FF", text:"#1E5A8A", border:"#A2CCEC", dot:"#5B9DC4"},
  {solid:"#68C49A", light:"#E4F8F0", pill:"#C6EFE0", text:"#1A6A44", border:"#8ED9BA", dot:"#40A876"},
  {solid:"#E08A8A", light:"#FFF0F0", pill:"#FFD6D6", text:"#A02828", border:"#EFBBBB", dot:"#CC5858"},
  {solid:"#9E8ED8", light:"#F0ECFF", pill:"#DDD5FF", text:"#3E2A9E", border:"#C0B2EE", dot:"#7460C8"},
];

// ══ MODULE CFG-003 ══ Activites
const ACTS = [
  ["voyage","Voyage","✈️"],["cinema","Cinema","🎬"],["rando","Rando","🥾"],
  ["kine","Kine","💆"],["docteur","Docteur","🏥"],["courses","Courses","🛒"],
];

// ══ MODULE CFG-004 ══ Bulles de sagesse
const BULLES = [
  "💪 Genoux flechis pour les transferts","🧤 N'oubliez pas vos gants","💊 Verifiez medicaments et horaires",
  "🚿 Testez la temperature de l'eau","📋 Notez les changements d'etat","🦺 Verifiez le materiel de transfert",
  "😊 Un sourire change une journee","🔑 Cle rendue et rapport signe","📞 En cas de doute : appelez l'infirmiere",
  "🍽️ Textures et regimes : verifiez le classeur","🌡️ Fievre > 38.5° : contacter le medecin","🛏️ Antiescarres : changement toutes les 2h",
];

// ══ MODULE UTL-001 ══ Utilitaires date
const dim = (y,m) => new Date(y,m+1,0).getDate();
const dowD = (y,m,d) => (new Date(y,m,d).getDay()+6)%7;
const rgb = h => `${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)}`;
const tsNow = () => new Date().toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
const vCode = c => /^\d{8}[A-Za-z]$/.test(c);
const pidIx = p => Math.max(0,TIDS.indexOf(p));
const pName = (names,p,priv=false) => priv ? (names[p] || NDEF[p]) : `Intervenant ${pidIx(p)+1}`;
const initial = (names,p,priv=false) => (priv ? (names[p] || NDEF[p]) : `I${pidIx(p)+1}`).slice(0,1).toUpperCase();
const BBtxt = t => t === "wd" ? "Lun-Jeu" : "Ven-Dim";

// ══ MODULE BLK-001 ══ Blocs Lun-Jeu / Ven-Dim
const getBlocks = (y,m) => {
  const out = []; let d = 1, ix = 0, n = dim(y,m);
  while (d <= n) {
    const wd = dowD(y,m,d), type = wd <= 3 ? "wd" : "we", endDow = type === "wd" ? 3 : 6;
    const end = Math.min(n,d + (endDow - wd));
    out.push({ type, start:d, end, idx:ix++ });
    d = end + 1;
  }
  return out;
};

// ══ MODULE SCH-001 ══ Scheduler deux passes
const buildSched = (y,m,startWeIdx,blkOverrides={},names=NDEF,statuts={},inheritWeWorker=null) => {
  const blks = getBlocks(y,m).map(b => ({...b, workerId:null, cross:false}));
  const weTeam = ["P1","P2","P3","P4"], wdTeam = ["P1","P2","P3"];
  let weIdx = startWeIdx || 0, wdIdx = 0, prevWe = null, prevWd = null, dup = 0;
  const usable = p => statuts[p] !== "absent";
  blks.forEach(b => {
    if (b.type !== "we") return;
    if (blkOverrides[b.idx]) { b.workerId = blkOverrides[b.idx]; if (usable(b.workerId)) weIdx = (weTeam.indexOf(b.workerId)+1+weTeam.length)%weTeam.length; prevWe = b.workerId; return; }
    if (inheritWeWorker && b.start === 1 && dowD(y,m,1) >= 5) { b.workerId = inheritWeWorker; b.cross = true; prevWe = b.workerId; return; }
    for (let k=0;k<weTeam.length;k++) {
      const p = weTeam[(weIdx+k)%weTeam.length];
      if (usable(p)) { b.workerId = p; weIdx = (weIdx+k+1)%weTeam.length; prevWe = p; return; }
    }
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

// ══ MODULE STO-001 ══ Persistance window.storage
const SK = { team:"avq-t", cfg:"avq-c", journal:"avq-j", month:(y,m)=>`avq-m-${y}-${m}` };
const sS = async (k,v) => { try { if (window.storage) await window.storage.set(k,JSON.stringify(v)); else localStorage.setItem(k,JSON.stringify(v)); } catch {} };
const sL = async k => { try { if (window.storage) { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; } };

// ══ MODULE EML-001 ══ Generation email
const mkWeek = (blks,y,m,weekStart,names,priv=false) => blks.filter(b => b.end >= weekStart && b.start <= weekStart+6).map(b => `${BBtxt(b.type)} ${b.start}-${b.end} ${MFR[m]} : ${pName(names,b.workerId,priv)}`).join("\n");
const mkPerson = (blks,y,m,pid,acts,lieux,names,detailed=false,priv=false) => {
  const rows = [`Planning ${pName(names,pid,priv)} - ${MFR[m]} ${y}`];
  blks.filter(b => b.workerId === pid).forEach(b => {
    rows.push(`${BBtxt(b.type)} du ${b.start} au ${b.end}`);
    if (detailed) for(let d=b.start; d<=b.end; d++) { const a = acts[d] || {}; rows.push(`  ${DL[dowD(y,m,d)]} ${d}: ${lieux[d] || "Lieu a preciser"} ${(a.types||[]).join(", ")} ${a.note||""} ${a.objectif ? "Objectif: "+a.objectif : ""}`); }
  });
  return rows.join("\n");
};

// ══ MODULE ATM-001 ══ Avatar
function Av({ t, sz=34, st, names=NDEF, priv=false }) {
  const p = PAL[pidIx(t)], s = st === "absent" ? "🚫" : st === "remplace" ? "🔄" : "";
  return <span title={pName(names,t,priv)} style={{width:sz,height:sz,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",background:p.pill,color:p.text,border:`1px solid ${p.border}`,fontWeight:900,fontSize:sz*.38,position:"relative",flex:"0 0 auto"}}>{initial(names,t,priv)}{s && <b style={{position:"absolute",right:-4,bottom:-5,fontSize:12}}>{s}</b>}</span>;
}

// ══ MODULE ATM-002 ══ Barre de progression
function HBar({ v, m=MAX_H, c="#7BAFD4", bg="#EDF6FF" }) {
  return <div style={{height:8,background:bg,borderRadius:99,overflow:"hidden"}}><div style={{width:`${Math.min(100,Math.round((+v||0)/m*100))}%`,height:"100%",background:c,borderRadius:99,transition:"width .25s"}} /></div>;
}

// ══ MODULE ATM-003 ══ Badge bloc
function BB({ type }) {
  const we = type === "we";
  return <span style={{fontSize:11,fontWeight:900,padding:"5px 9px",borderRadius:99,background:we?"#F0ECFF":"#E6F3FF",color:we?"#4B3299":"#1E5A8A",border:`1px solid ${we?"#C0B2EE":"#A2CCEC"}`}}>{we?"Ven→Dim":"Lun→Jeu"}</span>;
}

// ══ MODULE ATM-004 ══ Overlay
function Ov({ onClose, ch }) {
  return <div onMouseDown={onClose} style={{position:"fixed",inset:0,zIndex:30,background:"rgba(42,62,90,.28)",backdropFilter:"blur(9px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>{ch}</div>;
}

// ══ MODULE ATM-005 ══ Sheet
function Sh({ ch }) {
  return <div onMouseDown={e=>e.stopPropagation()} className="su" style={{width:"min(430px,100%)",maxHeight:"88vh",overflow:"auto",background:"rgba(255,255,255,.97)",borderRadius:"22px 22px 0 0",boxShadow:"0 -12px 40px rgba(40,80,140,.18)",padding:16}}><div style={{width:48,height:5,borderRadius:99,background:"#D8E7F5",margin:"0 auto 12px"}} />{ch}</div>;
}

// ══ MODULE APP-001 ══ Application
export default function App() {
  const now = new Date();
  const [y,setY] = useState(now.getFullYear()), [m,setM] = useState(now.getMonth()), [view,setView] = useState("month");
  const [swi,setSWI] = useState(0), [bOv,setBOv] = useState({}), [spOv,setSpOv] = useState({}), [nBlks,setNBlks] = useState({});
  const [acts,setActs] = useState({}), [lieux,setLieux] = useState({});
  const [names,setNames] = useState(NDEF), [stat,setStat] = useState({P1:"dispo",P2:"dispo",P3:"dispo",P4:"dispo"}), [ah,setAh] = useState({P1:0,P2:0,P3:0,P4:0});
  const [adminCode,setAdminCode] = useState(ADMIN_DEF), [adminSess,setAdminSess] = useState(false), [journal,setJournal] = useState([]), [validated,setValidated] = useState(false);
  const [blkMod,setBlkMod] = useState(null), [dayMod,setDayMod] = useState(null), [emailMod,setEmailMod] = useState(false), [yearMod,setYearMod] = useState(false), [pdfMod,setPdfMod] = useState(false), [adminMod,setAdminMod] = useState(null);
  const [toast,setToast] = useState(null), [showJ,setShowJ] = useState(false), [loaded,setLoaded] = useState(false);
  const [bulle] = useState(() => BULLES[Math.floor(Math.random()*BULLES.length)]);
  const priv = adminSess;
  const defStat = {P1:"dispo",P2:"dispo",P3:"dispo",P4:"dispo"};
  const inh = useMemo(() => {
    if (dowD(y,m,1) < 5) return null;
    const pm = m === 0 ? 11 : m-1, py = m === 0 ? y-1 : y;
    return [...buildSched(py,pm,swi,{},names,defStat,null).blks].reverse().find(b=>b.type==="we")?.workerId || null;
  },[y,m,swi,names]);
  const { sched, blks } = useMemo(() => buildSched(y,m,swi,bOv,names,stat,inh),[y,m,swi,bOv,names,stat,inh]);
  const daysByP = useMemo(() => TIDS.reduce((a,p)=>(a[p]=blks.filter(b=>b.workerId===p).reduce((s,b)=>s+b.end-b.start+1,0),a),{}),[blks]);
  const showT = useCallback(msg => { setToast(msg); setTimeout(()=>setToast(null),2400); },[]);
  const addJ = useCallback((action,detail) => setJournal(p => [{ts:tsNow(),action,detail},...p].slice(0,50)),[]);
  const withAdmin = (title,fn,force=false) => { if (adminSess && !force) fn(); else setAdminMod({title,fn}); };

  useEffect(() => { (async()=>{ const sn=await sL(SK.team); if(sn) setNames(sn); const sc=await sL(SK.cfg); if(sc){ setSWI(sc.swi??0); setAdminCode(sc.adminCode||ADMIN_DEF); } const j=await sL(SK.journal); if(j) setJournal(j); setLoaded(true); })(); },[]);
  useEffect(() => { if(!loaded) return; (async()=>{ const sm=await sL(SK.month(y,m)); setBOv(sm?.bOv||{}); setSpOv(sm?.spOv||{}); setAh(sm?.ah||{P1:0,P2:0,P3:0,P4:0}); setActs(sm?.acts||{}); setLieux(sm?.lieux||{}); setStat(sm?.stat||{P1:"dispo",P2:"dispo",P3:"dispo",P4:"dispo"}); setNBlks(sm?.nBlks||{}); setValidated(!!sm?.validated); })(); },[y,m,loaded]);
  useEffect(() => { if(loaded) sS(SK.month(y,m),{bOv,spOv,ah,acts,lieux,stat,nBlks,validated}); },[bOv,spOv,ah,acts,lieux,stat,nBlks,validated,y,m,loaded]);
  useEffect(() => { if(loaded) sS(SK.team,names); },[names,loaded]);
  useEffect(() => { if(loaded) sS(SK.cfg,{swi,adminCode}); },[swi,adminCode,loaded]);
  useEffect(() => { if(loaded) sS(SK.journal,journal); },[journal,loaded]);
  useEffect(() => { if(!adminSess) return; const t=setTimeout(()=>setAdminSess(false),15*60*1000); return()=>clearTimeout(t); },[adminSess]);

  const moveM = n => { const d = new Date(y,m+n,1); setY(d.getFullYear()); setM(d.getMonth()); };
  const setDay = (d,next) => { setActs(p=>({...p,[d]:{...(p[d]||{}),...next}})); };
  const card = {background:"rgba(255,255,255,.9)",border:"1px solid rgba(180,210,235,.72)",borderRadius:18,boxShadow:"0 2px 14px rgba(90,150,210,.06)"};
  const btn = (on, c="#7BAFD4") => ({padding:"9px 11px",borderRadius:14,background:on?c:"rgba(255,255,255,.75)",color:on?"white":"#35546F",border:`1px solid ${on?c:"#D6E7F5"}`,fontWeight:900});

  function Header() {
    return <div style={{position:"sticky",top:0,zIndex:10,backdropFilter:"blur(18px)",background:"rgba(250,253,255,.78)",borderBottom:"1px solid rgba(190,215,235,.6)",padding:"10px 12px 9px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
        <b style={{fontSize:20,color:"#264A69"}}>🗓 Planning-AVD</b>
        <div style={{display:"flex",gap:7}}><button title="Vue annuelle" onClick={()=>setYearMod(true)} style={btn(false)}>📅</button><button title="Rapport" onClick={()=>setPdfMod(true)} style={btn(false)}>📄</button></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"44px 1fr 44px",alignItems:"center",marginTop:9,gap:8}}>
        <button onClick={()=>moveM(-1)} style={btn(false)}>‹</button><b style={{textAlign:"center",color:"#32556F"}}>{MFR[m]} {y}{validated && " 🔒"}</b><button onClick={()=>moveM(1)} style={btn(false)}>›</button>
      </div>
    </div>;
  }

  function TeamMini() {
    return <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,margin:"10px 0"}}>
      {TIDS.map(p => <div key={p} style={{...card,padding:8,textAlign:"center",minWidth:0}}><Av t={p} sz={32} st={stat[p]} names={names} priv={priv}/><div style={{fontSize:11,fontWeight:900,color:PAL[pidIx(p)].text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",margin:"4px 0"}}>{pName(names,p,priv)}</div><HBar v={ah[p]||0} c={PAL[pidIx(p)].solid}/><div style={{fontSize:10,color:"#6B8195",marginTop:3}}>{daysByP[p]||0} j</div></div>)}
    </div>;
  }

  function MonthView() {
    const first = dowD(y,m,1), total = dim(y,m), cells = Array.from({length:first+total},(_,i)=>i<first?null:i-first+1);
    return <div className="su" style={{...card,padding:10}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,position:"relative"}}>
        {DS.map((x,i)=><b key={i} style={{textAlign:"center",fontSize:12,color:i<4?"#1E5A8A":"#4B3299",padding:4}}>{x}</b>)}
        {cells.map((d,i)=> {
          const s = d && sched[d], p = s && PAL[pidIx(s.worker)], a = d && acts[d], isStart = s && d === s.bs;
          return <button key={i} disabled={!d} onClick={()=>d&&setDayMod(d)} style={{height:54,borderRadius:12,background:d?(p?.light||"white"):"transparent",border:d?`1px solid ${p?.border||"#E7EEF7"}`:"none",padding:5,position:"relative",overflow:"hidden"}}>
            {i%7===4 && <span style={{position:"absolute",left:-3,top:0,bottom:0,borderLeft:"2px dotted #B8C9E6"}} />}
            {d && <><span style={{position:"absolute",top:5,left:6,fontSize:11,fontFamily:"DM Mono",fontWeight:900,color:"#526A7F"}}>{d}</span>{isStart ? <span style={{position:"absolute",right:5,top:5,width:20,height:20,borderRadius:99,background:p.pill,color:p.text,fontSize:10,fontWeight:900,display:"grid",placeItems:"center"}}>{initial(names,s.worker,priv)}</span> : <span style={{position:"absolute",left:6,right:6,bottom:9,height:8,borderRadius:99,background:p.solid,opacity:.75}} />}{a?.types?.length>0 && <span style={{position:"absolute",left:5,bottom:3,fontSize:11}}>{a.types.map(t=>ACTS.find(x=>x[0]===t)?.[2]).join("")}</span>}</>}
          </button>;
        })}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}><span style={{fontSize:12,color:"#657C91"}}>Initiales et noms masques hors session connectee.</span><button onClick={()=>setEmailMod(true)} style={btn(true,"#7BAFD4")}>📧</button></div>
    </div>;
  }

  function WeekView() {
    const today = new Date(), cur = today.getFullYear()===y && today.getMonth()===m ? today.getDate() : -1;
    return <div className="su" style={{display:"grid",gap:10}}><button onClick={()=>setEmailMod(true)} style={btn(true,"#7BAFD4")}>📧 Email / Imprimer</button>{blks.map(b => {
      const p = PAL[pidIx(b.workerId)], act = cur>=b.start && cur<=b.end;
      return <div key={b.idx} style={{...card,overflow:"hidden"}}>
        <button onClick={()=>setBlkMod(b.idx)} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:12,background:`rgba(${rgb(p.solid)},.11)`}}>
          <BB type={b.type}/><Av t={b.workerId} st={stat[b.workerId]} names={names} priv={priv}/><b style={{color:p.text,flex:1,textAlign:"left"}}>{pName(names,b.workerId,priv)}</b>{act&&<small style={btn(true,p.solid)}>Actuel</small>}{b.cross&&<small style={btn(false)}>↩ suite</small>}{validated&&<small>🔒</small>}
        </button>
        {nBlks[b.idx] && <div style={{margin:10,padding:9,borderRadius:12,background:"#F0ECFF",color:"#4B3299",fontSize:13}}>💬 {nBlks[b.idx]}</div>}
        <div style={{padding:"0 10px 10px",display:"grid",gap:7}}>{Array.from({length:b.end-b.start+1},(_,i)=>b.start+i).map(d => {
          const a=acts[d]||{}; return <button key={d} onClick={()=>setDayMod(d)} style={{display:"grid",gridTemplateColumns:"62px 1fr 34px",alignItems:"center",gap:8,padding:8,borderRadius:12,background:"#FBFDFF",border:"1px solid #E4EEF8",textAlign:"left"}}>
            <b style={{fontSize:12,color:"#526A7F"}}>{DL[dowD(y,m,d)].slice(0,3)} {d}</b><span style={{fontSize:13,color:"#39566F"}}>{lieux[d]||"Lieu a preciser"} {a.types?.map(t=>ACTS.find(x=>x[0]===t)?.[2]).join(" ")||""} {a.objectif ? `• ${a.objectif}` : ""}</span><span>＋</span>
          </button>;
        })}</div>
        {spOv[b.idx]?.special && <div style={{margin:"0 10px 10px",padding:8,borderRadius:12,background:"#FFF7E6",color:"#8A5A12",fontSize:13}}>✦ cas particulier : {spOv[b.idx].note}</div>}
      </div>;
    })}</div>;
  }

  function HoursView() {
    return <div className="su" style={{display:"grid",gap:10}}>{TIDS.map(p => {
      const h=+ah[p]||0, c=h>MAX_H?"#D94C4C":h>130?"#E6A23C":PAL[pidIx(p)].solid;
      return <div key={p} style={{...card,padding:12}}><div style={{display:"flex",alignItems:"center",gap:10}}><Av t={p} st={stat[p]} names={names} priv={priv}/><b style={{flex:1,color:PAL[pidIx(p)].text}}>{pName(names,p,priv)}</b><input type="number" value={ah[p]||""} onChange={e=>setAh(x=>({...x,[p]:e.target.value}))} style={{width:72,padding:8,borderRadius:12,border:"1px solid #D6E7F5",fontFamily:"DM Mono",fontWeight:900}} /></div><div style={{marginTop:10}}><HBar v={h} c={c}/></div>{h>MAX_H && <div style={{marginTop:7,color:"#B83232",fontWeight:900,fontSize:12}}>+{h-MAX_H}h a regulariser</div>}</div>;
    })}</div>;
  }

  function ConfigView() {
    return <div className="su" style={{display:"grid",gap:10}}>
      <div style={{...card,padding:12}}><b style={{color:"#31556F"}}>Statuts</b>{TIDS.map(p=><div key={p} style={{display:"flex",alignItems:"center",gap:8,marginTop:9}}><Av t={p} st={stat[p]} names={names} priv={priv}/><span style={{flex:1,fontWeight:900,color:PAL[pidIx(p)].text}}>{pName(names,p,priv)}</span>{Object.keys(STATUTS).map(s=><button key={s} onClick={()=>setStat(x=>({...x,[p]:s}))} style={btn(stat[p]===s,PAL[pidIx(p)].solid)}>{s==="dispo"?"✅":s==="absent"?"🚫":"🔄"}</button>)}</div>)}</div>
      <div style={{...card,padding:12}}><b style={{color:"#31556F"}}>Rotation + noms prives</b><p style={{fontSize:12,color:"#667F94",margin:"6px 0"}}>Les noms complets restent caches tant qu'une session connectee n'est pas active.</p><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,margin:"8px 0 12px"}}>{TIDS.map((p,i)=><button key={p} onClick={()=>setSWI(i)} style={btn(swi===i,PAL[i].solid)}><Av t={p} sz={25} names={names} priv={priv}/></button>)}</div>{priv ? TIDS.map(p=><input key={p} value={names[p]||""} onChange={e=>setNames(x=>({...x,[p]:e.target.value}))} placeholder={NDEF[p]} style={{width:"100%",boxSizing:"border-box",marginTop:7,padding:10,borderRadius:12,border:"1px solid #D6E7F5"}} />) : TIDS.map(p=><button key={p} onClick={()=>withAdmin("Afficher les noms prives",()=>setAdminSess(true))} style={{...btn(false),width:"100%",marginTop:7,textAlign:"left"}}>🔒 {pName(names,p,false)}</button>)}</div>
      <div style={{...card,padding:12}}><b style={{color:"#31556F"}}>Admin</b><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:9}}><button onClick={()=>setAdminMod({title:"Ouvrir une session",fn:()=>{setAdminSess(true);addJ("Session","Admin connecte");}})} style={btn(adminSess,"#68C49A")}>{adminSess?"Connecte":"Session"}</button><button onClick={()=>withAdmin(validated?"Deverrouiller le mois":"Valider le mois",()=>{setValidated(v=>!v);addJ("Mois",validated?"Deverrouille":"Valide");showT(validated?"Mois deverrouille":"Mois valide");},true)} style={btn(validated,"#9E8ED8")}>{validated?"Deverrouiller":"Valider"}</button></div>{priv ? <input value={adminCode} onChange={e=>setAdminCode(e.target.value)} style={{width:"100%",boxSizing:"border-box",marginTop:8,padding:10,borderRadius:12,border:"1px solid #D6E7F5",fontFamily:"DM Mono"}} /> : <button onClick={()=>setAdminMod({title:"Changer le code",fn:()=>setAdminSess(true)})} style={{...btn(false),width:"100%",marginTop:8,textAlign:"left"}}>🔒 Code admin masque</button>}<button onClick={()=>setShowJ(!showJ)} style={{...btn(false),width:"100%",marginTop:8}}>Journal</button>{showJ&&<pre style={{whiteSpace:"pre-wrap",fontSize:11,maxHeight:170,overflow:"auto",background:"#F7FBFF",padding:8,borderRadius:12}}>{journal.map(j=>`${j.ts} - ${j.action} - ${j.detail}`).join("\n")}</pre>}<button onClick={()=>withAdmin("Reset du mois",()=>{setBOv({});setSpOv({});setNBlks({});setActs({});setLieux({});setAh({P1:0,P2:0,P3:0,P4:0});setValidated(false);addJ("Reset","Mois courant");},true)} style={{...btn(false),width:"100%",marginTop:8}}>Reset mois</button></div>
    </div>;
  }

  function DayModal({ d }) {
    const a = acts[d] || {types:[]};
    const toggle = t => setDay(d,{types:(a.types||[]).includes(t)?a.types.filter(x=>x!==t):[...(a.types||[]),t]});
    return <Ov onClose={()=>setDayMod(null)} ch={<Sh ch={<><h3 style={{margin:"0 0 10px",color:"#294C69"}}>{DL[dowD(y,m,d)]} {d} {MFR[m]}</h3><input value={lieux[d]||""} onChange={e=>setLieux(p=>({...p,[d]:e.target.value}))} placeholder="Lieu" style={{width:"100%",boxSizing:"border-box",padding:11,borderRadius:13,border:"1px solid #D6E7F5"}} /><button onClick={()=>window.open(`https://www.google.com/maps/search/${encodeURIComponent(lieux[d]||"")}`,"_blank")} style={{...btn(true,"#68C49A"),width:"100%",marginTop:8}}>🗺️ Google Maps</button><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginTop:10}}>{ACTS.map(x=><button key={x[0]} onClick={()=>toggle(x[0])} style={btn(a.types?.includes(x[0]),"#7BAFD4")}>{x[2]}<br/><small>{x[1]}</small></button>)}</div><textarea value={a.note||""} onChange={e=>setDay(d,{note:e.target.value})} placeholder="Note" style={{width:"100%",boxSizing:"border-box",minHeight:70,marginTop:10,padding:11,borderRadius:13,border:"1px solid #D6E7F5"}} /><input value={a.objectif||""} onChange={e=>setDay(d,{objectif:e.target.value})} placeholder="Objectif du jour" style={{width:"100%",boxSizing:"border-box",marginTop:8,padding:11,borderRadius:13,border:"1px solid #D6E7F5"}} /></>} />} />;
  }

  function BlkModal({ i }) {
    const b = blks.find(x=>x.idx===i), ov = bOv[i], sp = spOv[i] || {};
    const choose = p => { if (b.type==="wd" && p===WE_ONLY) return showT("P4 est reservee aux week-ends"); setBOv(x=>({...x,[i]:p})); addJ("Bloc",`${BBtxt(b.type)} ${b.start}-${b.end}`); };
    return <Ov onClose={()=>setBlkMod(null)} ch={<Sh ch={<><h3 style={{margin:"0 0 10px",color:"#294C69"}}>Bloc {b.start}-{b.end} <BB type={b.type}/></h3><div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>{TIDS.map(p=><button disabled={b.type==="wd"&&p===WE_ONLY} key={p} onClick={()=>choose(p)} style={{...btn((ov||b.workerId)===p,PAL[pidIx(p)].solid),opacity:(b.type==="wd"&&p===WE_ONLY) ? .45 : 1}}><Av t={p} names={names} priv={priv}/> <span>{pName(names,p,priv)}</span><br/><small>{daysByP[p]||0} jours</small></button>)}</div><textarea value={nBlks[i]||""} onChange={e=>setNBlks(x=>({...x,[i]:e.target.value}))} placeholder="💬 Note inter-equipe" style={{width:"100%",boxSizing:"border-box",minHeight:72,marginTop:10,padding:11,borderRadius:13,border:"1px solid #D6E7F5"}} /><label style={{display:"flex",gap:8,alignItems:"center",marginTop:9}}><input type="checkbox" checked={!!sp.special} onChange={e=>setSpOv(x=>({...x,[i]:{...sp,special:e.target.checked}}))}/> ✦ cas particulier</label>{sp.special&&<><select value={sp.second||""} onChange={e=>setSpOv(x=>({...x,[i]:{...sp,second:e.target.value}}))} style={{width:"100%",marginTop:8,padding:10,borderRadius:12,border:"1px solid #D6E7F5"}}><option value="">2e intervenant</option>{TIDS.map(p=><option key={p} value={p}>{pName(names,p,priv)}</option>)}</select><textarea value={sp.note||""} onChange={e=>setSpOv(x=>({...x,[i]:{...sp,note:e.target.value}}))} placeholder="Motif" style={{width:"100%",boxSizing:"border-box",minHeight:58,marginTop:8,padding:10,borderRadius:12,border:"1px solid #D6E7F5"}} /></>}{ov&&<button onClick={()=>setBOv(x=>{const n={...x}; delete n[i]; return n;})} style={{...btn(false),width:"100%",marginTop:10}}>↩ Remettre par defaut</button>}</>} />} />;
  }

  function EmailModal() {
    const [mode,setMode] = useState("week"), [ws,setWs] = useState(1), [pid,setPid] = useState("P1"), [det,setDet] = useState(false);
    const txt = mode==="week" ? mkWeek(blks,y,m,+ws||1,names,priv) : mkPerson(blks,y,m,pid,acts,lieux,names,det,priv);
    const print = () => { const w=window.open("","_blank"); w.document.write(`<pre style="font:14px Nunito,Arial;white-space:pre-wrap">${txt.replace(/[<>&]/g,s=>({ "<":"&lt;",">":"&gt;","&":"&amp;" }[s]))}</pre>`); w.print(); };
    return <Ov onClose={()=>setEmailMod(false)} ch={<Sh ch={<><h3 style={{margin:"0 0 10px",color:"#294C69"}}>Email</h3><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><button onClick={()=>setMode("week")} style={btn(mode==="week")}>Semaine equipe</button><button onClick={()=>setMode("person")} style={btn(mode==="person")}>Par intervenant</button></div>{mode==="week"?<input type="number" value={ws} onChange={e=>setWs(e.target.value)} style={{width:"100%",boxSizing:"border-box",marginTop:8,padding:10,borderRadius:12,border:"1px solid #D6E7F5"}}/>:<><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginTop:8}}>{TIDS.map(p=><button key={p} onClick={()=>setPid(p)} style={btn(pid===p,PAL[pidIx(p)].solid)}><Av t={p} names={names} priv={priv}/></button>)}</div><label style={{display:"flex",gap:8,marginTop:8}}><input type="checkbox" checked={det} onChange={e=>setDet(e.target.checked)}/> Mode detaille</label></>}<pre style={{whiteSpace:"pre-wrap",maxHeight:260,overflow:"auto",padding:10,borderRadius:12,background:"#F7FBFF",fontFamily:"DM Mono",fontSize:12}}>{txt}</pre><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}><button onClick={()=>navigator.clipboard?.writeText(txt).then(()=>showT("Copie"))} style={btn(true,"#68C49A")}>📋</button><a href={`mailto:?subject=Planning AVD&body=${encodeURIComponent(txt)}`} style={{...btn(true,"#7BAFD4"),textDecoration:"none",textAlign:"center"}}>✉️</a><button onClick={print} style={btn(true,"#9E8ED8")}>🖨️</button></div></>} />} />;
  }

  function YearModal() {
    const [yy,setYY] = useState(y);
    return <Ov onClose={()=>setYearMod(false)} ch={<Sh ch={<><div style={{display:"grid",gridTemplateColumns:"44px 1fr 44px",alignItems:"center"}}><button onClick={()=>setYY(yy-1)} style={btn(false)}>‹</button><h3 style={{textAlign:"center",margin:0,color:"#294C69"}}>{yy}</h3><button onClick={()=>setYY(yy+1)} style={btn(false)}>›</button></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>{MFR.map((mo,mi)=>{ const bs=buildSched(yy,mi,swi,{},names,stat,null).blks; const c=TIDS.reduce((a,p)=>(a[p]=bs.filter(b=>b.workerId===p).reduce((s,b)=>s+b.end-b.start+1,0),a),{}); return <div key={mo} style={{...card,padding:9}}><b style={{color:"#31556F"}}>{mo}</b>{TIDS.map(p=><div key={p} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,marginTop:5}}><span style={{width:8,height:8,borderRadius:99,background:PAL[pidIx(p)].solid}}/><span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pName(names,p,priv)}</span><b>{c[p]}</b></div>)}</div>;})}</div></>} />} />;
  }

  function PdfModal() {
    const make = () => { const rows = blks.map(b=>`<tr><td>${BBtxt(b.type)}</td><td>${b.start}-${b.end}</td><td>${pName(names,b.workerId,priv)}</td><td>${nBlks[b.idx]||""}</td></tr>`).join(""); const hrs=TIDS.map(p=>`<tr><td>${pName(names,p,priv)}</td><td>${daysByP[p]||0}</td><td>${ah[p]||0}</td><td>${MAX_H}</td><td>${Math.round((+ah[p]||0)/MAX_H*100)}%</td></tr>`).join(""); const detail=Array.from({length:dim(y,m)},(_,i)=>i+1).map(d=>`<p><b>${d} ${MFR[m]}</b> ${lieux[d]||""} ${(acts[d]?.types||[]).join(", ")} ${acts[d]?.note||""} ${acts[d]?.objectif||""}</p>`).join(""); const w=window.open("","_blank"); w.document.write(`<html><head><title>Rapport Planning-AVD</title><style>body{font-family:Arial;padding:28px;color:#223}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border:1px solid #ccd;padding:7px;text-align:left}h1{color:#2f5f85}</style></head><body><h1>Rapport Planning-AVD - ${MFR[m]} ${y}</h1><h2>Blocs</h2><table><tr><th>Type</th><th>Dates</th><th>Intervenant</th><th>Note</th></tr>${rows}</table><h2>Heures</h2><table><tr><th>Intervenant</th><th>Jours</th><th>Heures</th><th>Limite</th><th>%</th></tr>${hrs}</table><h2>Detail jour par jour</h2>${detail}</body></html>`); w.document.close(); w.print(); };
    return <Ov onClose={()=>setPdfMod(false)} ch={<Sh ch={<><h3 style={{margin:"0 0 10px",color:"#294C69"}}>Rapport mensuel</h3><p style={{color:"#667F94",fontSize:13}}>Le rapport reprend blocs, notes, details journaliers et recapitulatif des heures. Les noms suivent le niveau de confidentialite de la session.</p><button onClick={make} style={{...btn(true,"#9E8ED8"),width:"100%"}}>Generer le rapport PDF</button></>} />} />;
  }

  function AdminModal({ mod }) {
    const [code,setCode] = useState(""), [err,setErr] = useState(false);
    const ok = () => { if (vCode(code) && code.toUpperCase()===adminCode.toUpperCase()) { setAdminSess(true); setAdminMod(null); mod.fn(); showT("Session ouverte"); } else { setErr(true); } };
    return <Ov onClose={()=>setAdminMod(null)} ch={<Sh ch={<><h3 style={{margin:"0 0 10px",color:"#294C69"}}>{mod.title}</h3><input autoFocus value={code} onChange={e=>{setCode(e.target.value);setErr(false);}} onKeyDown={e=>e.key==="Enter"&&ok()} placeholder="8 chiffres + 1 lettre" style={{width:"100%",boxSizing:"border-box",padding:12,borderRadius:13,border:`1px solid ${err?"#E08A8A":"#D6E7F5"}`,background:err?"#FFF0F0":"white",fontFamily:"DM Mono",fontWeight:900}} />{err&&<p style={{color:"#A02828",fontWeight:900}}>Code incorrect !</p>}<button onClick={ok} style={{...btn(true,"#68C49A"),width:"100%",marginTop:8}}>Valider</button></>} />} />;
  }

  return <div style={{minHeight:"100vh",maxWidth:430,margin:"0 auto",background:"linear-gradient(155deg, #EBF5FF 0%, #FBFCFF 55%, #F0ECFF 100%)",fontFamily:"Nunito, system-ui, sans-serif",color:"#294C69"}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Nunito:wght@500;700;900&display=swap');*{box-sizing:border-box}button{cursor:pointer;border:none;font-family:inherit;transition:all .15s;background:none}button:active{transform:scale(.96)}button:disabled{cursor:not-allowed}input,textarea,select{font-family:inherit;outline:none}input[type=number]{-moz-appearance:textfield}::-webkit-scrollbar{width:2px}::-webkit-scrollbar-thumb{background:#C4DCF0;border-radius:2px}@keyframes su{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}.su{animation:su .17s ease}`}</style>
    <Header/>
    <div style={{padding:"9px 11px 80px"}}>
      <div style={{...card,padding:10,background:"linear-gradient(120deg,#FFFFFF,#EEF7FF)",fontWeight:900,color:"#31556F"}}>{bulle}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginTop:10}}>{[["month","📅"],["week","📋"],["hours","⏱"],["config","⚙️"]].map(x=><button key={x[0]} onClick={()=>setView(x[0])} style={btn(view===x[0],"#7BAFD4")}>{x[1]}</button>)}</div>
      <TeamMini/>
      {view==="month"&&<MonthView/>}
      {view==="week"&&<WeekView/>}
      {view==="hours"&&<HoursView/>}
      {view==="config"&&<ConfigView/>}
    </div>
    {dayMod&&<DayModal d={dayMod}/>}
    {blkMod!==null&&<BlkModal i={blkMod}/>}
    {emailMod&&<EmailModal/>}
    {yearMod&&<YearModal/>}
    {pdfMod&&<PdfModal/>}
    {adminMod&&<AdminModal mod={adminMod}/>}
    {toast&&<div style={{position:"fixed",bottom:22,left:"50%",transform:"translateX(-50%)",zIndex:60,background:"#294C69",color:"white",borderRadius:99,padding:"10px 16px",fontWeight:900,boxShadow:"0 8px 28px rgba(30,80,130,.25)"}}>{toast}</div>}
  </div>;
}
