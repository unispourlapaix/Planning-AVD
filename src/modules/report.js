import { MONTHS, SHIFT_DEFS, SHIFT_LABEL } from "./constants.js";
import { dayName, daysInMonth } from "./dates.js";

const esc = value => String(value ?? "").replace(/[<>&]/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[char]));

export function buildReportHtml({ year, month, auxiliaries, schedule, hours }) {
  const findName = id => auxiliaries.find(aux => aux.id === id)?.name || "A definir";
  const dayRows = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).map(day => {
    const plan = schedule[day] || {};
    const lines = SHIFT_DEFS.map(shift => `<div class="slot"><b>${SHIFT_LABEL[shift.id]}</b><span>${esc(findName(plan[shift.id]?.worker))}</span><em>${shift.hours}h</em></div>`).join("");
    return `<td><div class="date">${day} ${dayName(year, month, day)}</div>${lines}</td>`;
  });
  const rows = [];
  for (let i = 0; i < dayRows.length; i += 7) rows.push(`<tr>${dayRows.slice(i, i + 7).join("")}</tr>`);

  const hourRows = auxiliaries.map(aux => {
    const h = hours[aux.id] || { total: 0, quota: aux.quota || 0 };
    return `<tr><td>${esc(aux.name)}</td><td>${h.morning}</td><td>${h.afternoon}</td><td>${h.night}</td><td>${h.total}</td><td>${h.quota}</td><td>${Math.round((h.quota - h.total) * 100) / 100}</td></tr>`;
  }).join("");

  return `<!doctype html><html><head><title>Rapport Planning-AVD</title><style>
    body{font-family:Arial,sans-serif;color:#25302c;padding:18px;background:#fff}
    h1{margin:0 0 14px;color:#3f4a3a} table{width:100%;border-collapse:collapse;table-layout:fixed}
    td,th{border:1px solid #ded7ca;vertical-align:top;padding:6px;font-size:11px}
    th{background:#f4efe7}.date{font-weight:900;margin-bottom:4px;color:#3f4a3a}
    .slot{display:grid;grid-template-columns:58px 1fr 28px;gap:4px;margin:3px 0}.slot b{color:#746d61}.slot span{font-weight:700}
    .hours{margin-top:18px}.hours td,.hours th{font-size:12px}
  </style></head><body><h1>Planning-AVD - ${MONTHS[month]} ${year}</h1><table>${rows.join("")}</table>
  <table class="hours"><tr><th>Auxiliaire</th><th>Matin</th><th>Apres-midi</th><th>Nuit</th><th>Total</th><th>Quota</th><th>Reste</th></tr>${hourRows}</table></body></html>`;
}
