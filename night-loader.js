(async () => {
  const root = document.getElementById("root");
  const fail = error => {
    console.error(error);
    if (root) root.innerHTML = '<div style="font:16px system-ui;padding:24px;color:#7a1d1d">Impossible de charger Planning-AVD. Rechargez la page dans un instant.</div>';
  };
  try {
    const response = await fetch("./patch-loader.js?v=20260525-base", { cache: "no-cache" });
    if (!response.ok) throw new Error(`patch-loader.js introuvable (${response.status})`);
    let source = await response.text();

    source = source
      .replace(
        'const syncNightWorkers = blks => { blks.filter(b => b.shift === "night" && !b.workerId).forEach(n => { const day = blks.find(x => x.baseIdx === n.baseIdx && (x.shift === "evening" || x.shift === "morning") && x.workerId); if (day?.workerId) n.workerId = day.workerId; }); return blks; };',
        'const syncNightWorkers = (blks,auxRules={},y=0,m=0) => { const ids=[...new Set(blks.map(b=>b.workerId).filter(Boolean))]; blks.filter(b=>b.shift==="night").forEach(n=>{ const days=Array.from({length:n.end-n.start+1},(_,i)=>n.start+i); const weekend=days.some(d=>dowD(y,m,d)>=5); const eligible=ids.filter(p=>allowedShift(p,"night",auxRules)&&days.every(d=>allowedOn(p,y,m,d,auxRules))); const weekendFirst=weekend?eligible.filter(p=>auxRules[p]?.days==="weekend"):[]; const evening=blks.find(x=>x.baseIdx===n.baseIdx&&x.shift==="evening")?.workerId; const currentOk=n.workerId&&eligible.includes(n.workerId); if(!currentOk)n.workerId=weekendFirst[0]||eligible.find(p=>p===evening)||eligible[0]||null; }); return blks; };'
      )
      .replaceAll("syncNightWorkers(blks);", "syncNightWorkers(blks,auxRules,y,m);")
      .replace(
        "const order = activeIds.slice(cursor).concat(activeIds.slice(0,cursor));",
        'const baseOrder = activeIds.slice(cursor).concat(activeIds.slice(0,cursor));\n      const weekendDay = dowD(y,m,d) >= 5;\n      const order = weekendDay ? baseOrder.slice().sort((a,b)=>((auxRules[b]?.days==="weekend"&&allowedShift(b,"night",auxRules))?1:0)-((auxRules[a]?.days==="weekend"&&allowedShift(a,"night",auxRules))?1:0)) : baseOrder;'
      )
      .replace(
        "const sm=sched[d]?.morning, se=sched[d]?.evening, sn=sched[d]?.night, am=sm?.worker, pmw=se?.worker, nw=se?.worker || sn?.worker",
        'const sm=sched[d]?.morning, se=sched[d]?.evening, sn=sched[d]?.night, am=sm?.worker, pmw=se?.worker, rawN=sn?.worker, nw=allowedShift(rawN,"night",auxRules)?rawN:(allowedShift(pmw,"night",auxRules)?pmw:null)'
      )
      .replace(
        "const am = day.morning?.worker, ap = day.evening?.worker, nt = ap || day.night?.worker;",
        'const am = day.morning?.worker, ap = day.evening?.worker, rawNt = day.night?.worker, nt = allowedShift(rawNt,"night",auxRules) ? rawNt : (allowedShift(ap,"night",auxRules) ? ap : null);'
      );

    (0, eval)(source + "\n//# sourceURL=night-loader.patched.js");
  } catch (error) {
    fail(error);
  }
})();
