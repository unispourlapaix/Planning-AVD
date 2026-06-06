import { MONTHS, SHIFT_DEFS, SHIFT_LABEL } from "./constants.js";
import { dayName, daysInMonth } from "./dates.js";

const esc = value => String(value ?? "").replace(/[<>&]/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[char]));
const shiftWorkerIds = entry => Array.isArray(entry?.workers) ? entry.workers.filter(Boolean) : (entry?.worker ? [entry.worker] : []);
const displayHours = (raw = {}, fallbackQuota = 0) => {
  const quota = Number(raw.quota ?? fallbackQuota) || 0;
  const rawTotal = Number(raw.total) || 0;
  const factor = rawTotal > quota && rawTotal > 0 ? quota / rawTotal : 1;
  const capShift = value => Math.round((Number(value) || 0) * factor * 100) / 100;
  const total = Math.min(rawTotal, quota);
  return {
    morning: capShift(raw.morning),
    afternoon: capShift(raw.afternoon),
    night: capShift(raw.night),
    total,
    quota,
    pause: Math.max(0, Math.round((quota - total) * 100) / 100),
  };
};

export function buildReportHtml({ year, month, auxiliaries, schedule, hours }) {
  const findName = id => auxiliaries.find(aux => aux.id === id)?.name || "A definir";
  const formatNames = ids => ids.map((id, index) => {
    const name = findName(id);
    return index === 0 ? name : name.trim().charAt(0).toUpperCase();
  }).join(" + ");
  const dayRows = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).map(day => {
    const plan = schedule[day] || {};
    const lines = SHIFT_DEFS.map(shift => {
      const names = formatNames(shiftWorkerIds(plan[shift.id])) || "A definir";
      return `<div class="slot"><b>${SHIFT_LABEL[shift.id]}</b><span>${esc(names)}</span><em>${shift.hours}h</em></div>`;
    }).join("");
    return `<td><div class="date">${day} ${dayName(year, month, day)}</div>${lines}</td>`;
  });
  const rows = [];
  for (let i = 0; i < dayRows.length; i += 7) rows.push(`<tr>${dayRows.slice(i, i + 7).join("")}</tr>`);

  const hourRows = auxiliaries.map(aux => {
    const h = displayHours(hours[aux.id], aux.quota);
    return `<tr><td>${esc(aux.name)}</td><td>${h.morning}</td><td>${h.afternoon}</td><td>${h.night}</td><td>${h.total}</td><td>${h.quota}</td><td>${h.pause}</td></tr>`;
  }).join("");

  return `<!doctype html><html><head><title>Rapport Planning-AVD</title><style>
    body{font-family:Arial,sans-serif;color:#25302c;padding:18px;background:#fff}
    h1{margin:0 0 14px;color:#3f4a3a} table{width:100%;border-collapse:collapse;table-layout:fixed}
    td,th{border:1px solid #ded7ca;vertical-align:top;padding:6px;font-size:11px}
    th{background:#f4efe7}.date{font-weight:900;margin-bottom:4px;color:#3f4a3a}
    .slot{display:grid;grid-template-columns:58px 1fr 28px;gap:4px;margin:3px 0}.slot b{color:#746d61}.slot span{font-weight:700}
    .hours{margin-top:18px}.hours td,.hours th{font-size:12px}
  </style></head><body><h1>Planning-AVD - ${MONTHS[month]} ${year}</h1><table>${rows.join("")}</table>
  <table class="hours"><tr><th>Auxiliaire</th><th>Matin</th><th>Apres-midi</th><th>Nuit</th><th>Total</th><th>Quota</th><th>En pause</th></tr>${hourRows}</table></body></html>`;
}
