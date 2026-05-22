(async () => {
  const root = document.getElementById("root");
  const fail = error => {
    console.error(error);
    if (root) root.innerHTML = '<div style="font:16px system-ui;padding:24px;color:#7a1d1d">Impossible de charger Planning-AVD. Rechargez la page dans un instant.</div>';
  };

  const replaceOnce = (code, before, after) => {
    if (!code.includes(before)) return code;
    return code.replace(before, after);
  };

  try {
    const response = await fetch("./browser-loader.js", { cache: "no-cache" });
    if (!response.ok) throw new Error(`browser-loader.js introuvable (${response.status})`);
    let code = await response.text();

    code = replaceOnce(
      code,
      'if (ov) { b.workerId = ov; if (usable(b.workerId,b)) weIdx = (weTeam.indexOf(b.workerId)+1+weTeam.length)%weTeam.length; prevWe = b.workerId; return; }\n    if (inheritWeWorker',
      'if (ov) { b.workerId = ov; if (usable(b.workerId,b)) weIdx = (weTeam.indexOf(b.workerId)+1+weTeam.length)%weTeam.length; prevWe = b.workerId; return; }\n    if (b.shift === "evening") { const am = blks.find(x => x.baseIdx === b.baseIdx && x.shift === "morning"); if (am?.workerId && usable(am.workerId,b)) { b.workerId = am.workerId; prevWe = b.workerId; return; } }\n    if (inheritWeWorker'
    );

    code = replaceOnce(
      code,
      'if (ov && ov !== WE_ONLY) { b.workerId = ov; wdIdx = (wdTeam.indexOf(b.workerId)+1+wdTeam.length)%wdTeam.length; prevWd = b.workerId; return; }\n    const sameWeekWE',
      'if (ov && ov !== WE_ONLY) { b.workerId = ov; wdIdx = (wdTeam.indexOf(b.workerId)+1+wdTeam.length)%wdTeam.length; prevWd = b.workerId; return; }\n    if (b.shift === "evening") { const am = blks.find(x => x.baseIdx === b.baseIdx && x.shift === "morning"); if (am?.workerId && usable(am.workerId,b)) { b.workerId = am.workerId; prevWd = b.workerId; return; } }\n    const sameWeekWE'
    );

    code = replaceOnce(
      code,
      'if (blkOverrides[b.idx] || blkOverrides[b.baseIdx]) b.workerId = blkOverrides[b.idx] || blkOverrides[b.baseIdx];\n      if (!b.workerId) {\n        for (let k=0;k<team.length;k++) {\n          const p = team[(rot+k)%team.length];\n          const inRest = restWeek(p) === weekOf(b.start) || restWeek(p) === weekOf(b.end);',
      'if (blkOverrides[b.idx] || blkOverrides[b.baseIdx]) b.workerId = blkOverrides[b.idx] || blkOverrides[b.baseIdx];\n      if (!b.workerId && s.id === "evening") { const am = blks.find(x => x.baseIdx === b.baseIdx && x.shift === "morning"); if (am?.workerId && usable(am.workerId,b)) b.workerId = am.workerId; }\n      if (!b.workerId) {\n        for (let k=0;k<team.length;k++) {\n          const p = team[(rot+k)%team.length];\n          const inRest = restWeek(p) === weekOf(b.start) || restWeek(p) === weekOf(b.end);'
    );

    code = replaceOnce(
      code,
      'if (blkOverrides[b.idx] || blkOverrides[b.baseIdx]) b.workerId = blkOverrides[b.idx] || blkOverrides[b.baseIdx];\n      if (!b.workerId) {\n        for (let k=0;k<team.length;k++) {\n          const p = team[(rot+k)%team.length];\n          if (usable(p,d) && allowedShift(p,s.id,auxRules) && p !== prev)',
      'if (blkOverrides[b.idx] || blkOverrides[b.baseIdx]) b.workerId = blkOverrides[b.idx] || blkOverrides[b.baseIdx];\n      if (!b.workerId && s.id === "evening") { const am = blks.find(x => x.baseIdx === b.baseIdx && x.shift === "morning"); if (am?.workerId && usable(am.workerId,d) && allowedShift(am.workerId,s.id,auxRules)) b.workerId = am.workerId; }\n      if (!b.workerId) {\n        for (let k=0;k<team.length;k++) {\n          const p = team[(rot+k)%team.length];\n          if (usable(p,d) && allowedShift(p,s.id,auxRules) && p !== prev)'
    );

    code = replaceOnce(
      code,
      '<b>{x[0]}</b><span>{x[1]?initial(names,x[1].worker,priv):"-"}</span>',
      '<b style={{color:"#746D61",background:"#FFFFFF",border:"1px solid #E5DED2",borderRadius:6,minWidth:12,textAlign:"center"}}>{x[0]}</b><span>{x[1]?initial(names,x[1].worker,priv):"-"}</span>'
    );

    code = replaceOnce(
      code,
      '<b>{x[0]}</b><span>{x[1]?initial(names,x[1].worker,priv):\\"-\\"}</span>',
      '<b style={{color:\\"#746D61\\",background:\\"#FFFFFF\\",border:\\"1px solid #E5DED2\\",borderRadius:6,minWidth:12,textAlign:\\"center\\"}}>{x[0]}</b><span>{x[1]?initial(names,x[1].worker,priv):\\"-\\"}</span>'
    );

    (0, eval)(code + "\n//# sourceURL=browser-loader.patched.js");
  } catch (error) {
    fail(error);
  }
})();
