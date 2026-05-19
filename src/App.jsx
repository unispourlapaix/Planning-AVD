import { useState, useMemo, useEffect, useCallback } from "react";
import { MAX_H, EMPLOYER, MFR, DL, DS, WE_ONLY, ADMIN_DEF, PAL, TIDS, NDEF, STATUTS, ACTS, BULLES } from "./constants.js";
import { dim, dowD, rgb, tsNow, vCode, buildSched } from "./scheduler.js";
import { SK, sS, sL, hashCode } from "./storage.js";

// ══════════════════════════════════════════════
// MODULE CFG-001 · Constantes
// ══════════════════════════════════════════════


// ══════════════════════════════════════════════
// MODULE UTL-001 · Utilitaires
// ══════════════════════════════════════════════


// ══════════════════════════════════════════════
// MODULE EML-001 · Email
// ══════════════════════════════════════════════
const mkWeek=(blks,y,m,ws,names)=>{
  const n=dim(y,m);const sep="─".repeat(42);
  let t=`📋 PLANNING SEMAINE — ${MFR[m].toUpperCase()} ${y}\n${EMPLOYER}\n${sep}\n`;
  const wb=blks.filter(b=>b.end>=ws&&b.start<=Math.min(ws+6,n));
  for(const b of wb){const p=names[b.workerId]?.firstName||"—";t+=`\n${b.type==="wd"?"📅 Lun→Jeu":"🏖 Ven→Dim"} · ${DL[dowD(y,m,b.start)].slice(0,3)} ${b.start}→${DL[dowD(y,m,b.end)].slice(0,3)} ${b.end}\n   👤 ${p}\n`;}
  return t;
};
const mkPerson=(blks,y,m,pid,acts,lieux,names,det)=>{
  const nm=names[pid];const pn=nm?`${nm.firstName}${nm.lastName?" "+nm.lastName:""}`:pid;
  let t=`📋 PLANNING — ${pn.toUpperCase()}\n${MFR[m]} ${y} · ${EMPLOYER}\n${"─".repeat(42)}\n\n`;
  for(const b of blks.filter(x=>x.workerId===pid)){
    t+=`${b.type==="wd"?"📅":"🏖"} ${DL[dowD(y,m,b.start)].slice(0,3)} ${b.start} → ${DL[dowD(y,m,b.end)].slice(0,3)} ${b.end}\n`;
    if(det)for(let d=b.start;d<=b.end;d++){
      const a=acts[d]||{};const l=lieux[d]||"";
      t+=`  ${DL[dowD(y,m,d)].padEnd(9)} ${d}`;
      const has=(a.types?.length)||a.note||a.objectif||l;
      if(!has){t+=": —\n";continue;}
      t+="\n";if(l)t+=`    📍 ${l}\n`;
      if(a.types?.length)t+=`    ${a.types.map(id=>{const x=ACTS.find(a=>a.id===id);return x?`${x.i}${x.l}`:id;}).join(" ")}\n`;
      if(a.note)t+=`    📝 ${a.note}\n`;if(a.objectif)t+=`    🎯 ${a.objectif}\n`;
    }
  }
  return t;
};

// ══════════════════════════════════════════════
// MODULE ATOMS · Composants UI
// ══════════════════════════════════════════════
const Av=({t,sz=34,st})=>{const i=(t.firstName||"?")[0].toUpperCase();const abs=st==="absent";return(<div style={{position:"relative",flexShrink:0}}><div style={{width:sz,height:sz,borderRadius:"50%",background:abs?"#F4F4F4":t.light,border:`2px solid ${abs?"#DDD":t.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:sz<30?9:12,color:abs?"#BBB":t.text,opacity:abs?.5:1}}>{i}</div>{st==="remplace"&&<span style={{position:"absolute",bottom:-2,right:-2,fontSize:9}}>🔄</span>}{abs&&<span style={{position:"absolute",bottom:-2,right:-2,fontSize:9}}>🚫</span>}</div>);};
const HBar=({v,m,c,bg})=>(<div style={{height:5,borderRadius:99,background:bg||"#EEF4FB",overflow:"hidden"}}><div style={{width:`${Math.min(v/m*100,100)}%`,height:"100%",background:c,borderRadius:99,transition:"width .4s"}}/></div>);
const BB=({type})=>(<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,color:type==="wd"?"#1E5A8A":"#3E2A9E",background:type==="wd"?"#CCE8FF":"#DDD5FF",border:`1px solid ${type==="wd"?"#A2CCEC":"#C0B2EE"}`}}>{type==="wd"?"Lun→Jeu":"Ven→Dim"}</span>);
const Ov=({onClose,ch})=>(<div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"rgba(30,70,130,0.18)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:110,backdropFilter:"blur(7px)"}}>{ch}</div>);
const Sh=({ch})=>(<div style={{width:"100%",maxWidth:430,background:"rgba(252,255,255,.99)",borderRadius:"26px 26px 0 0",border:"1px solid rgba(162,204,236,0.4)",boxShadow:"0 -8px 48px rgba(80,130,200,0.12)",paddingBottom:28,maxHeight:"90vh",overflowY:"auto"}}><div style={{width:38,height:4,borderRadius:2,background:"#C8E0F4",margin:"10px auto 0"}}/>{ch}</div>);

// ══════════════════════════════════════════════
// MODULE ADMIN-MODAL · Code admin
// ══════════════════════════════════════════════
function AdminModal({title,adminCode,onOk,onClose}){
  const[v,setV]=useState("");const[err,setErr]=useState(false);
  const check=async()=>{const hv=await hashCode(v);if(hv===adminCode){onOk();}else{setErr(true);setTimeout(()=>setErr(false),1200);}};
  return(<Ov onClose={onClose} ch={<Sh ch={<div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
    <p style={{fontWeight:900,fontSize:16,color:"#1a2a3a",textAlign:"center"}}>🔒 {title}</p>
    <p style={{fontSize:11,color:"#90AABC",textAlign:"center"}}>Code admin (8 chiffres + 1 lettre)</p>
    <input value={v} onChange={e=>setV(e.target.value)} maxLength={9} placeholder="12345678A" onKeyDown={e=>e.key==="Enter"&&check()} style={{textAlign:"center",fontSize:20,letterSpacing:3,fontFamily:"'DM Mono',monospace",padding:"12px",borderRadius:14,border:`2px solid ${err?"#EFBBBB":"rgba(162,204,236,0.4)"}`,background:err?"#FFF0F0":"#F2F8FF",outline:"none",fontWeight:700,color:err?"#A02828":"#1a2a3a"}}/>
    {err&&<p style={{fontSize:12,color:"#A02828",textAlign:"center",fontWeight:700}}>Code incorrect !</p>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <button onClick={onClose} style={{padding:12,borderRadius:14,fontSize:13,fontWeight:800,background:"#F0F0F0",color:"#666"}}>Annuler</button>
      <button onClick={check} style={{padding:12,borderRadius:14,fontSize:13,fontWeight:800,background:"linear-gradient(135deg,#7BAFD4,#9E8ED8)",color:"#fff"}}>✓ Valider</button>
    </div>
  </div>}/>}/>);
}

// ══════════════════════════════════════════════
// MODULE DAY-MODAL · Activités + lieu gmap
// ══════════════════════════════════════════════
function DayModal({day,y,m,wt,initA,initL,onSave,onClose}){
  const[types,setT]=useState(initA?.types||[]);const[note,setN]=useState(initA?.note||"");const[obj,setO]=useState(initA?.objectif||"");const[lieu,setL]=useState(initL||"");
  const tog=id=>setT(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const dw=DL[dowD(y,m,day)];const gmUrl=lieu?`https://www.google.com/maps/search/${encodeURIComponent(lieu)}`:"";
  return(<Ov onClose={onClose} ch={<Sh ch={<>
    <div style={{padding:"13px 20px 11px",borderBottom:"1px solid rgba(162,204,236,0.16)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:44,height:44,borderRadius:13,flexShrink:0,background:wt?.light||"#EEF6FF",border:`2px solid ${wt?.border||"#A2CCEC"}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <span style={{fontSize:9,fontWeight:700,color:wt?.dot||"#90AABC",lineHeight:1}}>{dw.slice(0,3)}</span>
          <span style={{fontSize:17,fontWeight:900,color:wt?.text||"#1a2a3a",lineHeight:1.1}}>{day}</span>
        </div>
        <div style={{flex:1}}><p style={{fontWeight:900,fontSize:15,color:"#1a2a3a"}}>{dw} {day} {MFR[m]}</p>{wt&&<p style={{fontSize:11,color:wt.dot,marginTop:3,fontWeight:700}}>👤 {wt.firstName}</p>}</div>
        <button onClick={onClose} style={{width:28,height:28,borderRadius:9,background:"#EEF6FF",color:"#7a94b0",fontSize:14,fontWeight:800}}>✕</button>
      </div>
    </div>
    <div style={{padding:"12px 20px",display:"flex",flexDirection:"column",gap:11}}>
      <div><p style={{fontSize:10,fontWeight:700,color:"#90AABC",textTransform:"uppercase",letterSpacing:.9,marginBottom:6}}>📍 Lieu</p>
        <div style={{display:"flex",gap:6}}><input value={lieu} onChange={e=>setL(e.target.value)} placeholder="Adresse, lieu, établissement…" style={{flex:1,background:"#F2F8FF",border:"1px solid rgba(162,204,236,0.35)",borderRadius:11,padding:"9px 11px",fontSize:12,color:"#2d3f58",outline:"none"}}/>{lieu&&<a href={gmUrl} target="_blank" rel="noreferrer" style={{width:38,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:11,background:"#E6F3FF",border:"1px solid #A2CCEC",fontSize:17,textDecoration:"none"}}>🗺️</a>}</div>
      </div>
      <div><p style={{fontSize:10,fontWeight:700,color:"#90AABC",textTransform:"uppercase",letterSpacing:.9,marginBottom:7}}>Activités</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
          {ACTS.map(a=>{const on=types.includes(a.id);return(<button key={a.id} onClick={()=>tog(a.id)} style={{padding:"8px 4px",borderRadius:12,display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:on?"linear-gradient(135deg,#CCE8FF,#DDD5FF)":"rgba(236,246,255,0.7)",border:`2px solid ${on?"#A2CCEC":"rgba(162,204,236,0.2)"}`,boxShadow:on?"0 2px 8px rgba(123,175,212,0.18)":"none"}}>
            <span style={{fontSize:19}}>{a.i}</span><span style={{fontSize:10,fontWeight:800,color:on?"#1E5A8A":"#7a94b0"}}>{a.l}</span>
          </button>);})}
        </div>
      </div>
      <div><p style={{fontSize:10,fontWeight:700,color:"#90AABC",textTransform:"uppercase",letterSpacing:.9,marginBottom:5}}>📝 Note</p><input value={note} onChange={e=>setN(e.target.value)} placeholder="Heure rdv, précision…" style={{width:"100%",background:"#F2F8FF",border:"1px solid rgba(162,204,236,0.32)",borderRadius:11,padding:"9px 11px",fontSize:12,color:"#2d3f58",outline:"none"}}/></div>
      <div><p style={{fontSize:10,fontWeight:700,color:"#90AABC",textTransform:"uppercase",letterSpacing:.9,marginBottom:5}}>🎯 Objectif du jour</p><input value={obj} onChange={e=>setO(e.target.value)} placeholder="Ex : douche, marche 20 min…" style={{width:"100%",background:"#F2F8FF",border:"1px solid rgba(162,204,236,0.32)",borderRadius:11,padding:"9px 11px",fontSize:12,color:"#2d3f58",outline:"none"}}/></div>
      <button onClick={()=>{onSave({types,note,objectif:obj},lieu);onClose();}} style={{width:"100%",padding:13,borderRadius:16,fontSize:14,fontWeight:900,background:"linear-gradient(135deg,#7BAFD4,#9E8ED8)",color:"#fff",boxShadow:"0 4px 14px rgba(123,175,212,0.26)"}}>✓ Enregistrer</button>
    </div>
  </>}/>}/>);
}

// ══════════════════════════════════════════════
// MODULE BLK-MODAL · Édition bloc
// ══════════════════════════════════════════════
function BlkModal({blk,y,m,team,stats,curId,spec,noteB,onPerson,onSpec,onNote,onReset,onClose}){
  const[showSp,setSp]=useState(!!(spec?.special));const[spN,setSpN]=useState(spec?.note||"");const[note,setNote]=useState(noteB||"");
  const lb=`${DL[dowD(y,m,blk.start)].slice(0,3)} ${blk.start} → ${DL[dowD(y,m,blk.end)].slice(0,3)} ${blk.end}`;
  return(<Ov onClose={onClose} ch={<Sh ch={<>
    <div style={{padding:"12px 20px 11px",borderBottom:"1px solid rgba(162,204,236,0.14)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><BB type={blk.type}/><p style={{fontWeight:900,fontSize:15,color:"#1a2a3a",flex:1}}>{lb}</p>{curId!==blk.workerId&&<button onClick={()=>{onReset();onClose();}} style={{fontSize:10,color:"#A02828",background:"#FFF0F0",border:"1px solid #EFBBBB",padding:"4px 9px",borderRadius:20,fontWeight:700}}>↩</button>}</div>
    </div>
    <div style={{padding:"12px 20px",display:"flex",flexDirection:"column",gap:12}}>
      <div><p style={{fontSize:10,fontWeight:700,color:"#90AABC",textTransform:"uppercase",letterSpacing:.9,marginBottom:8}}>Intervenant</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
          {team.map(t=>{const on=t.id===curId;return(<button key={t.id} onClick={()=>onPerson(t.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 11px",borderRadius:15,background:on?t.pill:"rgba(236,246,255,0.7)",border:`2px solid ${on?t.border:"rgba(162,204,236,0.18)"}`,boxShadow:on?`0 2px 10px ${t.light}`:"none"}}>
            <Av t={t} sz={28}/><div><p style={{fontSize:12,fontWeight:800,color:on?t.text:"#4a6070",lineHeight:1}}>{t.firstName}</p><p style={{fontSize:10,color:on?t.dot:"#90AABC",marginTop:2}}>{stats.find(s=>s.id===t.id)?.days||0}j</p></div>
            {on&&<span style={{marginLeft:"auto",fontSize:14,color:t.solid}}>✓</span>}
          </button>);})}
        </div>
      </div>
      <div><p style={{fontSize:10,fontWeight:700,color:"#90AABC",textTransform:"uppercase",letterSpacing:.9,marginBottom:5}}>💬 Note inter-équipe</p>
        <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="Info pour le prochain : matériel, consignes, rdv…" style={{width:"100%",background:"#F2F8FF",border:"1px solid rgba(162,204,236,0.32)",borderRadius:11,padding:"9px 11px",fontSize:12,color:"#2d3f58",resize:"none",fontFamily:"inherit",outline:"none"}}/></div>
      <div><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}><p style={{fontSize:10,fontWeight:700,color:"#90AABC",textTransform:"uppercase",letterSpacing:.9}}>✦ Cas particulier</p><button onClick={()=>setSp(s=>!s)} style={{fontSize:10,padding:"3px 9px",borderRadius:20,fontWeight:700,background:showSp?"#FFF9E6":"rgba(236,246,255,0.7)",color:showSp?"#8A6000":"#90AABC",border:`1px solid ${showSp?"#F0D070":"rgba(162,204,236,0.22)"}`}}>{showSp?"−":"+"}</button></div>
        {showSp&&<div style={{display:"flex",flexDirection:"column",gap:6}}><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5}}>{team.filter(t=>t.id!==curId).map(t=>{const on=spec?.special===t.id;return(<button key={t.id} onClick={()=>onSpec(on?null:t.id,spN)} style={{padding:"7px 4px",borderRadius:11,background:on?t.pill:"rgba(236,246,255,0.7)",border:`1.5px solid ${on?t.border:"rgba(162,204,236,0.18)"}`,fontSize:11,fontWeight:800,color:on?t.text:"#7a94b0"}}>{t.firstName}</button>);})}</div><input placeholder="Motif…" value={spN} onChange={e=>setSpN(e.target.value)} onBlur={()=>onSpec(spec?.special||null,spN)} style={{background:"#F2F8FF",border:"1px solid rgba(162,204,236,0.3)",borderRadius:10,padding:"8px 11px",fontSize:12,color:"#2d3f58",outline:"none"}}/></div>}
      </div>
      <button onClick={()=>{onNote(note);onClose();}} style={{width:"100%",padding:13,borderRadius:16,fontSize:14,fontWeight:900,background:"linear-gradient(135deg,#7BAFD4,#9E8ED8)",color:"#fff"}}>✓ Confirmer</button>
    </div>
  </>}/>}/>);
}

// ══════════════════════════════════════════════
// MODULE EMAIL-MODAL · Email amélioré par intervenant
// ══════════════════════════════════════════════
function EmailModal({blks,y,m,names,team,acts,lieux,onClose}){
  const[pid,setPid]=useState(null);const[det,setDet]=useState(false);const[ws,setWs]=useState(1);
  const n=dim(y,m);
  const txt=pid?mkPerson(blks,y,m,pid,acts,lieux,names,det):mkWeek(blks,y,m,ws,names);
  const doPrint=()=>{const w=window.open("","_blank");w.document.write(`<html><head><title>Planning ${MFR[m]} ${y}</title><style>body{font-family:monospace;font-size:12px;padding:24px;white-space:pre-wrap;line-height:1.7;}</style></head><body>${txt.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/\n/g,"<br>")}</body></html>`);w.document.close();w.print();};
  return(<Ov onClose={onClose} ch={<Sh ch={<>
    <div style={{padding:"12px 18px 10px",borderBottom:"1px solid rgba(162,204,236,0.14)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <p style={{fontWeight:900,fontSize:14,color:"#1a2a3a"}}>📧 Planning {MFR[m]} {y}</p>
        <button onClick={onClose} style={{width:27,height:27,borderRadius:9,background:"#EEF6FF",color:"#7a94b0",fontSize:14,fontWeight:800}}>✕</button>
      </div>
    </div>
    <div style={{padding:"12px 18px",display:"flex",flexDirection:"column",gap:11}}>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setPid(null)} style={{flex:1,padding:"8px",borderRadius:11,fontSize:11,fontWeight:800,background:!pid?"linear-gradient(135deg,#7BAFD4,#9E8ED8)":"rgba(236,246,255,0.8)",color:!pid?"#fff":"#7a94b0",border:!pid?"none":"1px solid rgba(162,204,236,0.28)"}}>📅 Semaine équipe</button>
        <button onClick={()=>setPid(p=>p||"P1")} style={{flex:1,padding:"8px",borderRadius:11,fontSize:11,fontWeight:800,background:pid?"linear-gradient(135deg,#7BAFD4,#9E8ED8)":"rgba(236,246,255,0.8)",color:pid?"#fff":"#7a94b0",border:pid?"none":"1px solid rgba(162,204,236,0.28)"}}>👤 Par intervenant</button>
      </div>
      {!pid&&<div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:11,color:"#90AABC"}}>Semaine du :</span><input type="number" min={1} max={n} value={ws} onChange={e=>setWs(Math.max(1,Math.min(n,+e.target.value)))} style={{width:42,background:"#EEF6FF",border:"1px solid #A2CCEC",borderRadius:9,padding:"5px 7px",fontSize:13,textAlign:"center",fontFamily:"'DM Mono',monospace",outline:"none"}}/></div>}
      {pid&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
          {team.map(t=>{const on=pid===t.id;return(<button key={t.id} onClick={()=>setPid(t.id)} style={{padding:"7px 3px",borderRadius:11,background:on?t.pill:"rgba(236,246,255,0.7)",border:`2px solid ${on?t.border:"rgba(162,204,236,0.18)"}`,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <Av t={t} sz={22}/><span style={{fontSize:9,fontWeight:800,color:on?t.text:"#7a94b0"}}>{t.firstName}</span>
          </button>);})}
        </div>
        <button onClick={()=>setDet(d=>!d)} style={{padding:"7px",borderRadius:11,fontSize:11,fontWeight:700,background:det?"#E6F3FF":"rgba(236,246,255,0.8)",color:det?"#1E5A8A":"#90AABC",border:`1px solid ${det?"#A2CCEC":"rgba(162,204,236,0.25)"}`}}>
          {det?"📋 Détaillé activé ✓":"📋 Activer le détail (activités, lieux)"}
        </button>
      </>}
      <pre style={{background:"#F2F8FF",border:"1px solid #C8E4FF",borderRadius:12,padding:10,fontSize:9.5,color:"#4A7A9A",whiteSpace:"pre-wrap",maxHeight:190,overflowY:"auto",fontFamily:"'DM Mono',monospace",lineHeight:1.85}}>{txt}</pre>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
        <button onClick={()=>navigator.clipboard?.writeText(txt).catch(()=>{})} style={{padding:10,borderRadius:12,fontSize:11,fontWeight:800,background:"#EEF6FF",color:"#1E5A8A",border:"1.5px solid #A2CCEC"}}>📋 Copier</button>
        <a href={`mailto:?subject=Planning ${MFR[m]} ${y}&body=${encodeURIComponent(txt)}`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:10,borderRadius:12,fontSize:11,fontWeight:800,textDecoration:"none",background:"linear-gradient(135deg,#7BAFD4,#9E8ED8)",color:"#fff"}}>✉️ Email</a>
        <button onClick={doPrint} style={{padding:10,borderRadius:12,fontSize:11,fontWeight:800,background:"#F0ECFF",color:"#3E2A9E",border:"1.5px solid #C0B2EE"}}>🖨️ Print</button>
      </div>
    </div>
  </>}/>}/>);
}

// ══════════════════════════════════════════════
// MODULE YEAR-MODAL · Vue annuelle
// ══════════════════════════════════════════════
function YearModal({y,setY,swi,names,onClose}){
  const team=TIDS.map((id,i)=>({id,...PAL[i],...names[id]}));
  const defStat={P1:"dispo",P2:"dispo",P3:"dispo",P4:"dispo"};
  return(<Ov onClose={onClose} ch={<Sh ch={<>
    <div style={{padding:"12px 18px 10px",borderBottom:"1px solid rgba(162,204,236,0.14)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <button onClick={()=>setY(y-1)} style={{width:28,height:28,borderRadius:8,background:"rgba(123,175,212,0.12)",color:"#7BAFD4",fontSize:14,fontWeight:800}}>‹</button>
          <p style={{fontWeight:900,fontSize:16,color:"#1a2a3a"}}>📅 Répartition {y}</p>
          <button onClick={()=>setY(y+1)} style={{width:28,height:28,borderRadius:8,background:"rgba(123,175,212,0.12)",color:"#7BAFD4",fontSize:14,fontWeight:800}}>›</button>
        </div>
        <button onClick={onClose} style={{width:27,height:27,borderRadius:9,background:"#EEF6FF",color:"#7a94b0",fontSize:14,fontWeight:800}}>✕</button>
      </div>
    </div>
    <div style={{padding:"10px 13px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      {MFR.map((mn,mi)=>{
        const{blks:pb}=buildSched(y,mi,swi,{},names,defStat,null);
        const cnt={};TIDS.forEach(id=>{cnt[id]=0;});
        pb.forEach(b=>{if(cnt[b.workerId]!==undefined)cnt[b.workerId]+=b.end-b.start+1;});
        const tot=dim(y,mi);
        return(<div key={mi} style={{background:"rgba(255,255,255,0.88)",border:"1px solid rgba(162,204,236,0.22)",borderRadius:13,padding:"9px 11px"}}>
          <p style={{fontWeight:800,fontSize:11,color:"#2d3f58",marginBottom:7}}>{mn}</p>
          {team.map(t=>(<div key={t.id} style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:t.solid,flexShrink:0}}/>
            <span style={{fontSize:9,color:"#7a94b0",flex:1}}>{t.firstName}</span>
            <HBar v={cnt[t.id]||0} m={tot} c={t.solid} bg={t.light}/>
            <span style={{fontSize:9,fontWeight:800,color:t.text,minWidth:22,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{cnt[t.id]||0}j</span>
          </div>))}
        </div>);
      })}
    </div>
  </>}/>}/>);
}

// ══════════════════════════════════════════════
// MODULE PDF-MODAL · Rapport mensuel
// ══════════════════════════════════════════════
function PdfModal({y,m,blks,names,acts,lieux,ah,nBlks,onClose}){
  const team=TIDS.map((id,i)=>({id,...PAL[i],...names[id]}));
  const print=()=>{
    let H=`<html><head><title>Rapport ${MFR[m]} ${y}</title><style>body{font-family:Arial,sans-serif;font-size:11px;padding:20px;color:#1a2a3a;}h1{font-size:15px;}h2{font-size:12px;color:#1E5A8A;margin:12px 0 4px;border-bottom:1px solid #ddd;padding-bottom:3px;}p{margin:2px 0;}.day{padding:3px 0;border-bottom:1px dotted #eee;display:flex;flex-wrap:wrap;gap:4px;}.tag{background:#D0E9FF;color:#1E5A8A;padding:1px 6px;border-radius:8px;font-size:10px;}table{width:100%;border-collapse:collapse;margin-top:8px;}td,th{border:1px solid #ddd;padding:4px 8px;font-size:10px;}th{background:#EAF4FF;}</style></head><body>`;
    H+=`<h1>Rapport AVQ — ${MFR[m]} ${y}</h1><p>Employeur : ${EMPLOYER}</p><p>Généré le ${tsNow()}</p><hr>`;
    for(const b of blks){
      const t=team.find(x=>x.id===b.workerId);
      H+=`<h2>${b.type==="wd"?"📅 Lun→Jeu":"🏖 Ven→Dim"} · ${DL[dowD(y,m,b.start)].slice(0,3)} ${b.start} → ${DL[dowD(y,m,b.end)].slice(0,3)} ${b.end} — ${t?.firstName||"—"} ${t?.lastName||""}</h2>`;
      if(nBlks[b.idx])H+=`<p><b>💬 Note équipe :</b> ${nBlks[b.idx]}</p>`;
      for(let d=b.start;d<=b.end;d++){
        const a=acts[d]||{};const l=lieux[d]||"";const has=(a.types?.length)||a.note||a.objectif||l;
        H+=`<div class="day"><b>${DL[dowD(y,m,d)].slice(0,3)} ${d}</b>`;
        if(!has){H+=` <span style="color:#bbb">—</span>`;}
        else{if(l)H+=` <span>📍 ${l}</span>`;if(a.types?.length)H+=a.types.map(id=>{const x=ACTS.find(a=>a.id===id);return x?` <span class="tag">${x.i} ${x.l}</span>`:"";}).join("");if(a.note)H+=` <span>📝 ${a.note}</span>`;if(a.objectif)H+=` <span>🎯 ${a.objectif}</span>`;}
        H+=`</div>`;
      }
    }
    H+=`<h2>⏱ Heures réalisées</h2><table><tr><th>Nom</th><th>Jours</th><th>Heures</th><th>Limite</th><th>%</th></tr>`;
    team.forEach(t=>{const d=blks.filter(b=>b.workerId===t.id).reduce((s,b)=>s+b.end-b.start+1,0);const h=ah[t.id]||0;H+=`<tr><td>${t.firstName} ${t.lastName||""}</td><td>${d}j</td><td>${h}h</td><td>${MAX_H}h</td><td>${Math.round(h/MAX_H*100)}%</td></tr>`;});
    H+=`</table></body></html>`;
    const w=window.open("","_blank");w.document.write(H);w.document.close();w.print();
  };
  return(<Ov onClose={onClose} ch={<Sh ch={<>
    <div style={{padding:"12px 18px 10px",borderBottom:"1px solid rgba(162,204,236,0.14)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <p style={{fontWeight:900,fontSize:14,color:"#1a2a3a"}}>📄 Rapport {MFR[m]} {y}</p>
        <button onClick={onClose} style={{width:27,height:27,borderRadius:9,background:"#EEF6FF",color:"#7a94b0",fontSize:14,fontWeight:800}}>✕</button>
      </div>
    </div>
    <div style={{padding:"14px 18px",display:"flex",flexDirection:"column",gap:11}}>
      <div style={{background:"#EAF4FF",border:"1px solid #A2CCEC",borderRadius:13,padding:"11px 13px"}}>
        {["Tous les blocs avec intervenant","Notes inter-équipe","Activités et lieux par jour","Tableau récap des heures","Format imprimable / PDF"].map((r,i)=><p key={i} style={{fontSize:12,color:"#2E6A9A",marginBottom:3}}>· {r}</p>)}
      </div>
      <button onClick={print} style={{width:"100%",padding:13,borderRadius:15,fontSize:14,fontWeight:900,background:"linear-gradient(135deg,#7BAFD4,#9E8ED8)",color:"#fff",boxShadow:"0 4px 14px rgba(123,175,212,0.26)"}}>🖨️ Générer le rapport PDF</button>
    </div>
  </>}/>}/>);
}

// ══════════════════════════════════════════════
// MODULE UI-001 · App principale
// ══════════════════════════════════════════════
export default function App(){
  const td=new Date();
  const[y,setY]=useState(td.getFullYear());
  const[m,setM]=useState(td.getMonth());
  const[view,setView]=useState("month");
  const[swi,setSWI]=useState(0);
  const[names,setNames]=useState(NDEF);
  const[bOv,setBOv]=useState({});
  const[spOv,setSpOv]=useState({});
  const[nBlks,setNBlks]=useState({});
  const[acts,setActs]=useState({});
  const[lieux,setLieux]=useState({});
  const[ah,setAh]=useState({P1:0,P2:0,P3:0,P4:0});
  const[stat,setStat]=useState({P1:"dispo",P2:"dispo",P3:"dispo",P4:"dispo"});
  const[adminCode,setAdminCode]=useState("");
  const[adminHash,setAdminHash]=useState("");
  const[mustChangeAdmin,setMustChangeAdmin]=useState(false);
  const[adminInput,setAdminInput]=useState("");
  const[adminSess,setAdminSess]=useState(false);
  const[journal,setJournal]=useState([]);
  const[validated,setValidated]=useState(false);
  const[loaded,setLoaded]=useState(false);
  const[bulle]=useState(()=>BULLES[Math.floor(Math.random()*BULLES.length)]);
  const[blkMod,setBlkMod]=useState(null);
  const[dayMod,setDayMod]=useState(null);
  const[emailMod,setEmailMod]=useState(false);
  const[yearMod,setYearMod]=useState(false);
  const[pdfMod,setPdfMod]=useState(false);
  const[adminMod,setAdminMod]=useState(null);
  const[toast,setToast]=useState(null);
  const[showJ,setShowJ]=useState(false);

  const team=useMemo(()=>TIDS.map((id,i)=>({id,...PAL[i],...names[id]})),[names]);
  const inh=useMemo(()=>{if(dowD(y,m,1)<5)return null;const pm=m===0?11:m-1,py=m===0?y-1:y;const{blks:pb}=buildSched(py,pm,swi,{},names,{P1:"dispo",P2:"dispo",P3:"dispo",P4:"dispo"},null);return[...pb].reverse().find(b=>b.type==="we")?.workerId||null;},[y,m,swi,names]);
  const{sched,blks}=useMemo(()=>buildSched(y,m,swi,bOv,names,stat,inh),[y,m,swi,bOv,names,stat,inh]);
  const n=dim(y,m);
  const stats=useMemo(()=>team.map(t=>({...t,days:Object.values(sched).filter(s=>s.worker===t.id).length,actual:ah[t.id]||0,status:stat[t.id]||"dispo"})),[team,sched,ah,stat]);
  const showT=useCallback(msg=>{setToast(msg);setTimeout(()=>setToast(null),2400);},[]);
  const addJ=useCallback((a,d)=>setJournal(p=>[{ts:tsNow(),action:a,detail:d},...p].slice(0,50)),[]);
  const withAdmin=(title,fn)=>{if(adminSess){fn();return;}setAdminMod({title,fn});};

  useEffect(()=>{(async()=>{const sn=await sL(SK.team);if(sn)setNames(sn);const sc=await sL(SK.cfg);if(sc){if(sc.swi!=null)setSWI(sc.swi);if(sc.adminHash){setAdminHash(sc.adminHash);setAdminCode(sc.adminHash);} else if(sc.adminCode){const h=await hashCode(sc.adminCode);setAdminHash(h);setAdminCode(h);setMustChangeAdmin(sc.adminCode===ADMIN_DEF);}} else { const h=await hashCode(ADMIN_DEF); setAdminHash(h); setAdminCode(h); setMustChangeAdmin(true);}const j=await sL(SK.journal);if(j)setJournal(j);setLoaded(true);})();},[]);
  useEffect(()=>{if(!loaded)return;(async()=>{const d=await sL(SK.month(y,m));if(d){setBOv(d.bOv||{});setSpOv(d.spOv||{});setAh(d.ah||{P1:0,P2:0,P3:0,P4:0});setActs(d.acts||{});setLieux(d.lieux||{});setStat(d.stat||{P1:"dispo",P2:"dispo",P3:"dispo",P4:"dispo"});setNBlks(d.nBlks||{});setValidated(d.validated||false);}else{setBOv({});setSpOv({});setAh({P1:0,P2:0,P3:0,P4:0});setActs({});setLieux({});setStat({P1:"dispo",P2:"dispo",P3:"dispo",P4:"dispo"});setNBlks({});setValidated(false);}})();},[y,m,loaded]);
  useEffect(()=>{if(loaded)sS(SK.month(y,m),{bOv,spOv,ah,acts,lieux,stat,nBlks,validated});},[bOv,spOv,ah,acts,lieux,stat,nBlks,validated,y,m,loaded]);
  useEffect(()=>{if(loaded)sS(SK.team,names);},[names,loaded]);
  useEffect(()=>{if(loaded)sS(SK.cfg,{swi,adminHash});},[swi,adminHash,loaded]);
  useEffect(()=>{if(loaded)sS(SK.journal,journal);},[journal,loaded]);

  const navM=dir=>{let nm=m+dir,ny=y;if(nm>11){nm=0;ny++;}if(nm<0){nm=11;ny--;}setM(nm);setY(ny);};

  return(
    <div style={{minHeight:"100vh",maxWidth:430,margin:"0 auto",background:"linear-gradient(155deg,#EBF5FF 0%,#FBFCFF 55%,#F0ECFF 100%)",color:"#1a2a3a",fontFamily:"'Nunito',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}button{cursor:pointer;border:none;font-family:inherit;transition:all .15s;background:none}button:active{transform:scale(.96)}input,textarea,select{font-family:inherit;outline:none}input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}input[type=number]{-moz-appearance:textfield}::-webkit-scrollbar{width:2px}::-webkit-scrollbar-thumb{background:#C4DCF0;border-radius:2px}@keyframes su{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}.su{animation:su .17s ease}`}</style>

      {/* HEADER */}
      <div style={{position:"sticky",top:0,zIndex:50,background:"rgba(248,252,255,0.96)",backdropFilter:"blur(18px)",borderBottom:"1px solid rgba(162,204,236,0.2)",padding:"11px 13px 9px",boxShadow:"0 1px 16px rgba(90,150,210,0.05)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{width:39,height:39,borderRadius:12,background:"linear-gradient(135deg,#7BAFD4,#9E8ED8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,boxShadow:"0 4px 14px rgba(123,175,212,0.22)"}}>🗓</div>
          <div style={{flex:1}}><p style={{fontWeight:900,fontSize:15,letterSpacing:-.3,lineHeight:1}}>Planning AVQ</p><p style={{fontSize:10,color:"#90AABC",marginTop:2,fontWeight:600}}>{EMPLOYER}</p></div>
          <div style={{display:"flex",gap:4}}>
            {validated&&<span style={{fontSize:10,fontWeight:700,color:"#1A6A44",background:"#E4F8F0",padding:"3px 7px",borderRadius:20,border:"1px solid #8ED9BA"}}>✓ Validé</span>}
            <button onClick={()=>setYearMod(true)} title="Vue annuelle" style={{width:29,height:29,borderRadius:9,background:"rgba(158,142,216,0.12)",color:"#9E8ED8",fontSize:13}}>📅</button>
            <button onClick={()=>setPdfMod(true)} title="Rapport PDF" style={{width:29,height:29,borderRadius:9,background:"rgba(104,196,154,0.12)",color:"#68C49A",fontSize:13}}>📄</button>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center"}}>
          <button onClick={()=>navM(-1)} style={{width:30,height:30,borderRadius:8,background:"rgba(123,175,212,0.12)",color:"#7BAFD4",fontSize:16,fontWeight:800}}>‹</button>
          <h2 style={{flex:1,textAlign:"center",fontWeight:900,fontSize:17,letterSpacing:-.3}}>{MFR[m]} <span style={{fontWeight:500,color:"#90AABC",fontSize:13}}>{y}</span></h2>
          <button onClick={()=>navM(1)} style={{width:30,height:30,borderRadius:8,background:"rgba(123,175,212,0.12)",color:"#7BAFD4",fontSize:16,fontWeight:800}}>›</button>
        </div>
      </div>

      {/* BULLE */}
      <div style={{margin:"7px 11px 0",background:"linear-gradient(135deg,#EAF4FF,#F0ECFF)",border:"1px solid rgba(162,204,236,0.3)",borderRadius:15,padding:"9px 12px",display:"flex",gap:9,alignItems:"flex-start"}}>
        <span style={{fontSize:18,flexShrink:0}}>{bulle.e}</span>
        <p style={{fontSize:11,color:"#3E4A6A",fontWeight:600,lineHeight:1.5}}>{bulle.t}</p>
      </div>

      {/* TABS */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,padding:"8px 11px 4px"}}>
        {[["month","📅","Mois"],["week","📋","Sem."],["hours","⏱","H"],["config","⚙️","Config"]].map(([v,ic,lb])=>(
          <button key={v} onClick={()=>setView(v)} style={{padding:"8px 4px",borderRadius:13,fontSize:11,fontWeight:800,background:view===v?"linear-gradient(135deg,#7BAFD4,#9E8ED8)":"rgba(255,255,255,0.78)",color:view===v?"#fff":"#90AABC",border:view===v?"none":"1px solid rgba(162,204,236,0.3)",boxShadow:view===v?"0 3px 12px rgba(123,175,212,0.22)":"0 1px 4px rgba(90,150,210,0.04)"}}>
            <div style={{fontSize:16,marginBottom:2}}>{ic}</div>{lb}
          </button>
        ))}
      </div>

      <div style={{padding:"5px 11px 80px"}}>
        {/* Mini-cartes */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginBottom:8}}>
          {stats.map(t=>{const ov=t.actual>MAX_H;return(<div key={t.id} style={{background:"rgba(255,255,255,0.9)",border:`1.5px solid ${t.status==="absent"?"#EEE":t.border}`,borderRadius:14,padding:"8px 6px",opacity:t.status==="absent"?.55:1}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:4}}><Av t={t} sz={24} st={t.status}/></div>
            <HBar v={t.actual} m={MAX_H} c={ov?"#E08A8A":t.solid} bg={t.light}/>
            <p style={{fontSize:9,fontWeight:800,color:ov?"#E08A8A":t.dot,textAlign:"center",marginTop:3,fontFamily:"'DM Mono',monospace"}}>{t.days}j</p>
          </div>);})}
        </div>

        {/* ═══ VUE MOIS ═══ */}
        {view==="month"&&(()=>{const fd=dowD(y,m,1);return(<div style={{background:"rgba(255,255,255,0.86)",border:"1px solid rgba(162,204,236,0.22)",borderRadius:19,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:"rgba(228,244,255,0.45)",borderBottom:"1px solid rgba(162,204,236,0.13)"}}>
            {DS.map((d,i)=><div key={i} style={{textAlign:"center",padding:"7px 0",fontSize:10,fontWeight:800,color:i<=3?"#1E5A8A":i===4?"#3E2A9E":"#5040A8",borderRight:i===3?"2px dashed rgba(162,204,236,0.28)":"none"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
            {Array.from({length:fd}).map((_,i)=><div key={`e${i}`} style={{borderRight:i%7===3?"2px dashed rgba(162,204,236,0.16)":"1px solid rgba(162,204,236,0.08)",borderBottom:"1px solid rgba(162,204,236,0.08)",minHeight:54}}/>)}
            {Array.from({length:n}).map((_,i)=>{
              const d=i+1;const ds=sched[d];const t=team.find(x=>x.id===ds?.worker);
              const dw=dowD(y,m,d);const isT=d===td.getDate()&&m===td.getMonth()&&y===td.getFullYear();
              const isF=d===ds?.bs;const a=acts[d]||{};const hA=(a.types?.length)||a.note||a.objectif||lieux[d];const hN=nBlks[ds?.bi];
              return(<button key={d} onClick={()=>setDayMod({day:d,ds})} style={{borderRight:dw===3?"2px dashed rgba(162,204,236,0.16)":"1px solid rgba(162,204,236,0.08)",borderBottom:"1px solid rgba(162,204,236,0.08)",minHeight:54,padding:"3px 2px",display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:t?`rgba(${rgb(t.solid)},${dw>=4?".12":".07"})`:"transparent",cursor:"pointer",position:"relative"}}>
                {dw===4&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:2,background:"rgba(159,142,216,0.16)"}}/>}
                <div style={{width:18,height:18,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:isT?"linear-gradient(135deg,#7BAFD4,#9E8ED8)":"transparent"}}>
                  <span style={{fontSize:9,fontWeight:isT?900:500,color:isT?"#fff":dw>=4?"#5040A8":"#7a94b0"}}>{d}</span>
                </div>
                {t&&isF&&<div style={{width:18,height:18,borderRadius:"50%",background:t.pill,border:`1.5px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:9,fontWeight:900,color:t.text}}>{t.firstName[0]}</span></div>}
                {t&&!isF&&<div style={{width:"48%",height:2,borderRadius:99,background:t.solid,opacity:.35}}/>}
                <div style={{display:"flex",gap:1}}>{(a.types||[]).slice(0,2).map(id=>{const x=ACTS.find(a=>a.id===id);return x?<span key={id} style={{fontSize:7}}>{x.i}</span>:null;})}{ lieux[d]&&<span style={{fontSize:7}}>📍</span>}{hN&&<span style={{fontSize:7}}>💬</span>}</div>
              </button>);
            })}
          </div>
          <div style={{padding:"7px 11px",borderTop:"1px solid rgba(162,204,236,0.1)",display:"flex",flexWrap:"wrap",gap:5,alignItems:"center"}}>
            {team.map(t=><span key={t.id} style={{display:"flex",alignItems:"center",gap:4,fontSize:9,fontWeight:700,color:t.text}}><span style={{width:9,height:9,borderRadius:"50%",background:t.pill,border:`1.5px solid ${t.border}`,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:6,fontWeight:900,color:t.text}}>{t.firstName[0]}</span>{t.firstName}</span>)}
            <button onClick={()=>setEmailMod(true)} style={{marginLeft:"auto",background:"linear-gradient(135deg,#7BAFD4,#9E8ED8)",padding:"5px 10px",borderRadius:20,fontSize:10,fontWeight:800,color:"#fff"}}>📧</button>
          </div>
        </div>);})()}

        {/* ═══ VUE SEMAINE ═══ */}
        {view==="week"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={()=>setEmailMod(true)} style={{background:"linear-gradient(135deg,#7BAFD4,#9E8ED8)",padding:"8px 15px",borderRadius:12,fontSize:12,fontWeight:800,color:"#fff",boxShadow:"0 3px 12px rgba(123,175,212,0.22)"}}>📧 Email / Imprimer</button></div>
          {blks.map((blk,bi)=>{
            const t=team.find(x=>x.id===blk.workerId);const sp=spOv[blk.idx];const spT=sp?.special?team.find(x=>x.id===sp.special):null;
            const hT=td.getDate()>=blk.start&&td.getDate()<=blk.end&&m===td.getMonth()&&y===td.getFullYear();
            const isWd=blk.type==="wd";const bD=Array.from({length:blk.end-blk.start+1},(_,i)=>blk.start+i);const nB=nBlks[blk.idx];
            return(<div key={bi} className="su" style={{background:"rgba(255,255,255,0.92)",border:`2px solid ${hT?t?.border||"#A2CCEC":"rgba(162,204,236,0.18)"}`,borderRadius:19,overflow:"hidden"}}>
              <button onClick={()=>{if(validated)withAdmin("Modifier (mois validé)",()=>setBlkMod(blk));else setBlkMod(blk);}} style={{width:"100%",padding:"11px 13px",display:"flex",alignItems:"center",gap:10,background:isWd?"rgba(204,232,255,0.1)":"rgba(221,213,255,0.1)",borderBottom:"1px solid rgba(162,204,236,0.1)",cursor:"pointer",textAlign:"left"}}>
                <div style={{width:44,height:44,borderRadius:13,flexShrink:0,background:isWd?"linear-gradient(135deg,#CCE8FF,#E6F3FF)":"linear-gradient(135deg,#DDD5FF,#F0ECFF)",border:`1.5px solid ${isWd?"#A2CCEC":"#C0B2EE"}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:10,fontWeight:900,color:isWd?"#1E5A8A":"#3E2A9E",lineHeight:1}}>{isWd?"Lun":"Ven"}</span><span style={{fontSize:8,color:isWd?"#5B9DC4":"#7460C8",fontWeight:700}}>→</span><span style={{fontSize:10,fontWeight:900,color:isWd?"#1E5A8A":"#3E2A9E",lineHeight:1}}>{isWd?"Jeu":"Dim"}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>{t&&<Av t={t} sz={26} st={stat[t.id]}/>}<p style={{fontWeight:900,fontSize:14,color:t?.text||"#1a2a3a"}}>{t?.firstName||"—"}</p>{hT&&<span style={{fontSize:9,fontWeight:800,color:t?.text,background:t?.pill,padding:"2px 6px",borderRadius:20,border:`1px solid ${t?.border}`}}>Actuel</span>}{blk.cross&&<span style={{fontSize:9,color:"#5040A8",background:"#EDE8FF",padding:"2px 6px",borderRadius:20}}>↩ suite</span>}{validated&&<span style={{fontSize:9,color:"#1A6A44"}}>🔒</span>}</div>
                  <p style={{fontSize:10,color:"#90AABC",fontWeight:600}}>{DL[dowD(y,m,blk.start)].slice(0,3)} {blk.start} → {DL[dowD(y,m,blk.end)].slice(0,3)} {blk.end} · {blk.end-blk.start+1}j</p>
                </div>
                <span style={{color:"#C8DCF0",fontSize:14}}>✎</span>
              </button>
              {nB&&<div style={{padding:"7px 13px",background:"rgba(240,236,255,0.35)",borderBottom:"1px solid rgba(162,204,236,0.1)",display:"flex",gap:6}}><span style={{fontSize:13}}>💬</span><p style={{fontSize:11,color:"#3E2A9E",fontWeight:600,lineHeight:1.4}}>{nB}</p></div>}
              {bD.map((d,di)=>{
                const a=acts[d]||{};const l=lieux[d]||"";const hA=(a.types?.length)||a.note||a.objectif||l;
                const iT=d===td.getDate()&&m===td.getMonth()&&y===td.getFullYear();const dw=DL[dowD(y,m,d)];
                return(<button key={d} onClick={()=>setDayMod({day:d,ds:sched[d]})} style={{width:"100%",padding:"8px 12px",display:"flex",alignItems:"flex-start",gap:8,background:iT?"rgba(123,175,212,0.04)":"transparent",borderBottom:di<bD.length-1?"1px solid rgba(162,204,236,0.08)":"none",cursor:"pointer",textAlign:"left"}}>
                  <div style={{width:34,height:34,borderRadius:9,flexShrink:0,background:iT?"linear-gradient(135deg,#7BAFD4,#9E8ED8)":"rgba(228,244,255,0.7)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:8,fontWeight:700,lineHeight:1,color:iT?"rgba(255,255,255,0.7)":"#90AABC"}}>{dw.slice(0,3)}</span>
                    <span style={{fontSize:13,fontWeight:900,lineHeight:1.15,color:iT?"#fff":"#2d3f58"}}>{d}</span>
                  </div>
                  <div style={{flex:1,paddingTop:1}}>
                    {hA?<div style={{display:"flex",flexDirection:"column",gap:3}}>
                      {l&&<p style={{fontSize:11,color:"#1E5A8A",fontWeight:600}}>📍 {l}</p>}
                      {a.types?.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{a.types.map(id=>{const x=ACTS.find(a=>a.id===id);return x?<span key={id} style={{fontSize:10,fontWeight:700,color:"#1E5A8A",background:"#D0E9FF",padding:"2px 7px",borderRadius:20,border:"1px solid #A2CCEC"}}>{x.i} {x.l}</span>:null;})}</div>}
                      {a.note&&<p style={{fontSize:11,color:"#4a6070"}}>📝 {a.note}</p>}
                      {a.objectif&&<p style={{fontSize:11,color:"#3E2A9E",fontWeight:700}}>🎯 {a.objectif}</p>}
                    </div>:<span style={{fontSize:11,color:"#C8DCF0"}}>+ Activité…</span>}
                  </div>
                  <span style={{color:"#D8EAF8",fontSize:12,marginTop:3}}>+</span>
                </button>);
              })}
              {spT&&<div style={{padding:"6px 12px",background:"rgba(255,249,230,0.35)",borderTop:"1px solid rgba(240,208,112,0.18)",display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:11,color:"#8A6000",fontWeight:800}}>✦</span><Av t={spT} sz={17}/><span style={{fontSize:11,color:"#8A6000",fontWeight:700}}>{spT.firstName}</span>{sp.note&&<span style={{fontSize:10,color:"#A07820",fontStyle:"italic"}}>· {sp.note}</span>}</div>}
            </div>);
          })}
        </div>}

        {/* ═══ VUE HEURES ═══ */}
        {view==="hours"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
          {stats.map(t=>{const ov=t.actual>MAX_H,w=t.actual>130&&!ov;const c=ov?"#E08A8A":w?"#D4B840":t.solid;
            return(<div key={t.id} style={{background:"rgba(255,255,255,0.93)",border:`1.5px solid ${t.border}`,borderRadius:19,padding:"13px 14px",opacity:t.status==="absent"?.6:1}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:11}}><Av t={t} sz={40} st={t.status}/><div style={{flex:1}}><p style={{fontWeight:900,fontSize:14,color:"#1a2a3a"}}>{t.firstName} {t.lastName}</p><p style={{fontSize:10,color:"#90AABC",marginTop:2}}>{t.days}j · {STATUTS[t.status]?.icon} {STATUTS[t.status]?.label}</p></div>
                <div style={{textAlign:"center"}}><input type="number" min="0" max="200" value={t.actual} onChange={e=>setAh(p=>({...p,[t.id]:Math.max(0,+e.target.value)}))} style={{width:58,background:t.light,border:`2px solid ${t.border}`,borderRadius:12,padding:"7px 5px",fontSize:16,color:ov?"#A02828":t.text,textAlign:"center",fontFamily:"'DM Mono',monospace",fontWeight:700,display:"block"}}/><p style={{fontSize:9,color:"#90AABC",marginTop:2}}>h</p></div>
              </div>
              <HBar v={t.actual} m={MAX_H} c={c} bg={ov?"#FFF0F0":w?"#FFFBEB":t.light}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:11,fontWeight:700}}><span style={{color:"#90AABC"}}>{Math.round(t.actual/MAX_H*100)}%</span><span style={{color:c,fontFamily:"'DM Mono',monospace"}}>{t.actual}/{MAX_H}h</span></div>
              {ov&&<p style={{fontSize:11,color:"#A02828",marginTop:6,fontWeight:700}}>⚠ +{t.actual-MAX_H}h à régulariser</p>}
            </div>);
          })}
        </div>}

        {/* ═══ VUE CONFIG ═══ */}
        {view==="config"&&<div style={{display:"flex",flexDirection:"column",gap:9}}>
          {/* Statuts */}
          <div style={{background:"rgba(255,255,255,0.92)",border:"1px solid rgba(162,204,236,0.24)",borderRadius:18,padding:"13px 14px"}}>
            <p style={{fontSize:10,fontWeight:700,color:"#90AABC",textTransform:"uppercase",letterSpacing:.9,marginBottom:11}}>Statut · {MFR[m]}</p>
            {team.map(t=>{const cur=stat[t.id]||"dispo";return(<div key={t.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,paddingBottom:10,borderBottom:"1px solid rgba(162,204,236,0.09)"}}>
              <Av t={t} sz={32} st={cur}/><p style={{fontWeight:800,fontSize:12,color:"#1a2a3a",flex:1}}>{t.firstName}</p>
              <div style={{display:"flex",gap:4}}>{Object.entries(STATUTS).map(([sk,sv])=>{const on=cur===sk;return(<button key={sk} onClick={()=>setStat(p=>({...p,[t.id]:sk}))} style={{fontSize:13,padding:"5px 8px",borderRadius:20,fontWeight:700,background:on?sv.bg:"rgba(236,246,255,0.7)",color:on?sv.color:"#90AABC",border:`1.5px solid ${on?sv.border:"rgba(162,204,236,0.18)"}`}}>{sv.icon}</button>);})}</div>
            </div>);})}
          </div>
          {/* Rotation + noms */}
          <div style={{background:"rgba(255,255,255,0.92)",border:"1px solid rgba(162,204,236,0.24)",borderRadius:18,padding:"13px 14px"}}>
            <p style={{fontSize:10,fontWeight:700,color:"#90AABC",textTransform:"uppercase",letterSpacing:.9,marginBottom:11}}>Rotation WE · 1er WE du mois</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginBottom:11}}>
              {team.map((t,i)=>{const on=swi===i;return(<button key={t.id} onClick={()=>{setSWI(i);setBOv({});showT("↻ Recalculé");}} style={{padding:"7px 3px",borderRadius:11,display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:on?t.pill:"rgba(236,246,255,0.7)",border:`2px solid ${on?t.border:"rgba(162,204,236,0.16)"}`,boxShadow:on?`0 2px 8px ${t.light}`:"none"}}>
                <Av t={t} sz={24} st={stat[t.id]}/><span style={{fontSize:9,fontWeight:800,color:on?t.text:"#7a94b0"}}>{t.firstName}</span>{on&&<span style={{fontSize:8,color:t.solid}}>✓</span>}
              </button>);})}
            </div>
            {team.map(t=>(<div key={t.id} style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
              <Av t={t} sz={26} st={stat[t.id]}/>
              <input value={names[t.id]?.firstName||""} onChange={e=>setNames(p=>({...p,[t.id]:{...p[t.id],firstName:e.target.value}}))} style={{flex:1,background:t.light,border:`1.5px solid ${t.border}`,borderRadius:9,padding:"6px 8px",fontSize:12,fontWeight:700,color:t.text}}/>
              <input value={names[t.id]?.lastName||""} onChange={e=>setNames(p=>({...p,[t.id]:{...p[t.id],lastName:e.target.value}}))} style={{flex:1,background:"#F4F8FF",border:"1.5px solid rgba(162,204,236,0.25)",borderRadius:9,padding:"6px 8px",fontSize:12,color:"#4a6070"}}/>
            </div>))}
          </div>
          {/* Admin */}
          <div style={{background:"rgba(255,255,255,0.92)",border:"1px solid rgba(162,204,236,0.24)",borderRadius:18,padding:"13px 14px"}}>
            <p style={{fontSize:10,fontWeight:700,color:"#90AABC",textTransform:"uppercase",letterSpacing:.9,marginBottom:11}}>🔒 Sécurité admin</p>
            <div style={{display:"flex",gap:7,marginBottom:9}}>
              <div style={{flex:1}}><p style={{fontSize:9,color:"#90AABC",marginBottom:4}}>Code (8 chiffres + 1 lettre)</p>
                <input value={adminInput} onChange={e=>setAdminInput(e.target.value.toUpperCase())} maxLength={9} placeholder="12345678A" style={{width:"100%",background:"#F2F8FF",border:`1px solid ${adminInput===""||vCode(adminInput)?"rgba(162,204,236,0.35)":"#EFBBBB"}`,borderRadius:10,padding:"8px 10px",fontSize:13,fontFamily:"'DM Mono',monospace",letterSpacing:2,fontWeight:700,color:"#2d3f58"}}/>
                <button onClick={async()=>{if(!vCode(adminInput))return;const h=await hashCode(adminInput);setAdminHash(h);setAdminCode(h);setMustChangeAdmin(false);setAdminInput("");showT("✅ Code admin mis à jour");}} style={{marginTop:6,padding:"6px 9px",borderRadius:9,fontSize:10,fontWeight:800,background:"#EEF6FF",border:"1px solid rgba(162,204,236,0.26)",color:"#3E2A9E"}}>Enregistrer code</button>
                {mustChangeAdmin&&<p style={{fontSize:9,color:"#E08A8A",marginTop:2}}>Changez le code admin par défaut.</p>}
              </div>
              <button onClick={()=>setAdminSess(s=>!s)} style={{padding:"8px 11px",borderRadius:12,fontSize:12,fontWeight:800,background:adminSess?"#E4F8F0":"rgba(236,246,255,0.8)",color:adminSess?"#1A6A44":"#7a94b0",border:`1.5px solid ${adminSess?"#8ED9BA":"rgba(162,204,236,0.26)"}`,alignSelf:"flex-end"}}>
                {adminSess?"🔓 Actif":"🔒 Off"}
              </button>
            </div>
            <button onClick={()=>{if(!validated)withAdmin("Valider et verrouiller "+MFR[m],()=>{setValidated(true);addJ("Validation",`${MFR[m]} ${y} verrouillé`);showT("✅ Mois validé");});else withAdmin("Déverrouiller "+MFR[m],()=>{setValidated(false);addJ("Déverrouillage",`${MFR[m]} ${y} ouvert`);showT("🔓 Déverrouillé");});}} style={{width:"100%",padding:10,borderRadius:12,fontSize:12,fontWeight:800,marginBottom:8,background:validated?"#FFF0F0":"linear-gradient(135deg,#68C49A,#40A876)",color:validated?"#A02828":"#fff",border:validated?"1.5px solid #EFBBBB":"none",boxShadow:validated?"none":"0 3px 10px rgba(64,168,118,0.24)"}}>
              {validated?"🔓 Déverrouiller ce mois":"✅ Valider et sauvegarder le mois"}
            </button>
            <button onClick={()=>setShowJ(s=>!s)} style={{width:"100%",padding:"6px",borderRadius:10,fontSize:11,fontWeight:700,background:"rgba(236,246,255,0.7)",color:"#7a94b0",border:"1px solid rgba(162,204,236,0.22)",marginBottom:showJ?6:0}}>
              📋 Journal ({journal.length}) {showJ?"▲":"▼"}
            </button>
            {showJ&&<div style={{maxHeight:150,overflowY:"auto"}}>
              {journal.length===0&&<p style={{fontSize:11,color:"#B0C8D8",textAlign:"center",padding:"8px"}}>Aucune entrée</p>}
              {journal.map((e,i)=><div key={i} style={{padding:"5px 0",borderBottom:"1px solid rgba(162,204,236,0.08)"}}>
                <p style={{fontSize:10,fontWeight:700,color:"#3E2A9E"}}>{e.action} · <span style={{color:"#90AABC",fontWeight:500}}>{e.ts}</span></p>
                <p style={{fontSize:10,color:"#4a6070"}}>{e.detail}</p>
              </div>)}
            </div>}
            <button onClick={()=>withAdmin("Remettre par défaut",()=>{setBOv({});setSpOv({});setNBlks({});addJ("Reset","Planning remis par défaut");showT("↩ Défaut");})} style={{marginTop:7,width:"100%",padding:9,borderRadius:11,fontSize:11,fontWeight:800,background:"#FFF0F0",color:"#A02828",border:"1.5px solid #EFBBBB"}}>↩ Remettre par défaut</button>
          </div>
        </div>}
      </div>

      {/* MODALS */}
      {dayMod&&<DayModal day={dayMod.day} y={y} m={m} wt={team.find(t=>t.id===dayMod.ds?.worker)} initA={acts[dayMod.day]||{}} initL={lieux[dayMod.day]||""} onSave={(a,l)=>{setActs(p=>({...p,[dayMod.day]:a}));setLieux(p=>({...p,[dayMod.day]:l}));}} onClose={()=>setDayMod(null)}/>}
      {blkMod&&<BlkModal blk={blkMod} y={y} m={m} team={team} stats={stats} curId={bOv[blkMod.idx]??blkMod.workerId} spec={spOv[blkMod.idx]} noteB={nBlks[blkMod.idx]||""} onPerson={id=>{setBOv(p=>({...p,[blkMod.idx]:id}));addJ("Bloc modifié",`Bloc ${blkMod.idx} → ${team.find(t=>t.id===id)?.firstName}`);showT(`✅ ${team.find(t=>t.id===id)?.firstName}`);}} onSpec={(sp,n)=>setSpOv(p=>({...p,[blkMod.idx]:{special:sp,note:n}}))} onNote={n=>setNBlks(p=>({...p,[blkMod.idx]:n}))} onReset={()=>{setBOv(p=>{const v={...p};delete v[blkMod.idx];return v;});addJ("Reset bloc",`Bloc ${blkMod.idx}`);}} onClose={()=>setBlkMod(null)}/>}
      {emailMod&&<EmailModal blks={blks} y={y} m={m} names={names} team={team} acts={acts} lieux={lieux} onClose={()=>setEmailMod(false)}/>}
      {yearMod&&<YearModal y={y} setY={setY} swi={swi} names={names} onClose={()=>setYearMod(false)}/>}
      {pdfMod&&<PdfModal y={y} m={m} blks={blks} names={names} acts={acts} lieux={lieux} ah={ah} nBlks={nBlks} onClose={()=>setPdfMod(false)}/>}
      {adminMod&&<AdminModal title={adminMod.title} adminCode={adminCode} onOk={()=>{adminMod.fn();setAdminSess(true);setTimeout(()=>setAdminSess(false),15*60*1000);setAdminMod(null);}} onClose={()=>setAdminMod(null)}/>}

      {/* Toast */}
      {toast&&<div style={{position:"fixed",bottom:22,left:"50%",transform:"translateX(-50%)",background:"rgba(250,253,255,0.97)",border:"1px solid rgba(162,204,236,0.38)",borderRadius:13,padding:"9px 20px",fontSize:13,fontWeight:800,color:"#1a2a3a",zIndex:200,whiteSpace:"nowrap",boxShadow:"0 4px 22px rgba(90,150,210,0.1)"}}>{toast}</div>}
    </div>
  );
}
