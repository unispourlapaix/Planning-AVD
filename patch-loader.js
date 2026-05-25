(async () => {
  const root = document.getElementById("root");
  const fail = error => {
    console.error(error);
    if (root) root.innerHTML = '<div style="font:16px system-ui;padding:24px;color:#7a1d1d;white-space:pre-wrap">Impossible de charger Planning-AVD.\n' + String(error && (error.stack || error.message) || error) + '</div>';
  };
  const loadText = url => new Promise((resolve, reject) => {
    if (window.fetch) {
      fetch(url, { cache: "no-cache" })
        .then(r => r.ok ? r.text() : Promise.reject(new Error(`${url} introuvable (${r.status})`)))
        .then(resolve, reject);
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.responseText) : reject(new Error(`${url} introuvable (${xhr.status})`));
    xhr.onerror = () => reject(new Error(`${url} inaccessible`));
    xhr.send();
  });
  try {
    let code = await loadText("https://raw.githubusercontent.com/unispourlapaix/Planning-AVD/main/browser-loader.js?v=20260525-stable");
    code = code
      .replace('const response = await fetch("./planning-avd.jsx", { cache: "no-cache" });', 'const response = await fetch("https://raw.githubusercontent.com/unispourlapaix/Planning-AVD/main/planning-avd.jsx?v=20260525-stable", { cache: "no-cache" });')
      .replace('const allowedShift = (p,shift,auxRules={}) => shift === "night" ? !!auxRules[p]?.night || auxRules[p]?.shift === "night" : (!auxRules[p]?.shift || auxRules[p].shift === "all" || auxRules[p].shift === shift);', 'const allowedShift = (p,shift,auxRules={}) => { const r=auxRules[p]||{}, s=r.shift||"all"; if (shift==="night") return !!r.night || s==="night"; if (s==="night") return false; if (s==="morning") return shift==="morning"; if (s==="evening") return shift==="evening"; return s==="all" || s===shift; };')
      .replace('const shiftPayHours = s => s === "night" ? 12 : 5.75;', 'const shiftPayHours = s => s === "night" ? 12 : 6;')
      .replace('const fairPick = (team,load,auxRules,ok,prev=null) => { const arr = team.filter(p => p && p !== prev && ok(p)); if (!arr.length) return null; return arr.sort((a,b)=>loadScore(a,load,auxRules)-loadScore(b,load,auxRules))[0]; };', 'const fairPick = (team,load,auxRules,ok,prev=null) => { const pool = team.filter(p => p && ok(p)); const src = pool.filter(p => p !== prev); const list = src.length ? src : pool; return list.sort((a,b)=>loadScore(a,load,auxRules)-loadScore(b,load,auxRules) || team.indexOf(a)-team.indexOf(b))[0] || null; };')
      .replace('const rotationTeam = (ids=[],auxRules={}) => { const base = ids.filter(p => TIDS.includes(p)); const lead = base.find(p => auxRules[p]?.lead); if (!lead) return base; const others = base.filter(p => p !== lead); return others.length ? others.flatMap(p => [lead,p]) : [lead]; };', 'const rotationTeam = (ids=[],auxRules={},weekend=false) => { const base = ids.filter(p => TIDS.includes(p)); if (weekend) return base; const lead = base.find(p => auxRules[p]?.lead); if (!lead) return base; const others = base.filter(p => p !== lead); return [lead,...others]; };')
      .replace('const weTeam = rotationTeam(baseTeam,auxRules);\n  const wdTeam = weTeam;', 'const weTeam = rotationTeam(baseTeam,auxRules,true);\n  const wdTeam = rotationTeam(baseTeam,auxRules,false);')
      .replace('const s = d && sched[d], sm=s?.morning, se=s?.evening, pm=sm&&PAL[pidIx(sm.worker)], pe=se&&PAL[pidIx(se.worker)], a = d && acts[d];', 'const s = d && sched[d], sm=s?.morning, se=s?.evening, sn=s?.night, am=sm?.worker, ev=se?.worker, rawN=sn?.worker, nt=allowedShift(rawN,"night",auxRules)?rawN:(allowedShift(ev,"night",auxRules)?ev:null), pm=am&&PAL[pidIx(am)], pe=ev&&PAL[pidIx(ev)], pn=nt&&PAL[pidIx(nt)], a = d && acts[d];')
      .replace('height:62,borderRadius:12', 'height:118,borderRadius:12')
      .replace('[[\\"M\\",sm,pm],[\\"S\\",se,pe]]', '[[\\"Matin\\",am,pm],[\\"Après-midi\\",ev,pe],[\\"Nuit\\",nt,pn]]')
      .replace('height:14,borderRadius:8', 'minHeight:24,borderRadius:8')
      .replace('{x[1]?initial(names,x[1].worker,priv):\\"-\\"}', '{x[1]?pName(names,x[1],priv):\\"A definir\\"}');
    (0, eval)(code + "\n//# sourceURL=browser-loader.patched.js");
  } catch (error) {
    fail(error);
  }
})();
