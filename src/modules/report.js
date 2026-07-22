import { MONTHS, SHIFT_DEFS } from "./constants.js?v=20260722-shift-7-5";
import { dayName, daysInMonth } from "./dates.js";
import { summarizeHours } from "./hour-accounting.js?v=20260722-custom-hours";
import { mealForDate } from "./meal-planning.js";
import { shiftDisplayLabel } from "./shift-labels.js?v=20260722-shift-7-5";
import { breakNoticeForSlot } from "./break-rules.js?v=20260722-custom-hours";
import { slotHours } from "./shift-hours.js?v=20260722-custom-hours";

const esc = value => String(value ?? "").replace(/[<>&]/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[char]));
const shiftWorkerIds = entry => Array.isArray(entry?.workers) ? entry.workers.filter(Boolean) : (entry?.worker ? [entry.worker] : []);
const displayHours = summarizeHours;

export function buildReportHtml({ year, month, beneficiaryName = "", auxiliaries, schedule, hours }) {
  const findName = id => auxiliaries.find(aux => aux.id === id)?.name || "A definir";
  const formatNames = ids => ids[0] ? findName(ids[0]) : "";
  const dayRows = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).map(day => {
    const plan = schedule[day] || {};
    const lines = SHIFT_DEFS.map(shift => {
      const ids = shiftWorkerIds(plan[shift.id]);
      const names = formatNames(ids) || "A definir";
      const label = shiftDisplayLabel({ shift: shift.id, schedule, day, worker: ids[0] });
      const notice = breakNoticeForSlot({ shift: shift.id, schedule, day, worker: ids[0] });
      const noticeHtml = notice ? `<small class="break ${notice.type}">${esc(notice.label)}</small>` : "";
      return `<div class="slot"><b>${esc(label)}</b><span>${esc(names)}${noticeHtml}</span><em>${slotHours(plan[shift.id], shift.id)}h</em></div>`;
    }).join("");
    const meal = mealForDate(year, month, day);
    return `<td><div class="date">${day} ${dayName(year, month, day)}</div>${lines}<div class="meal"><b>Repas</b><span>${esc(meal.short)}</span></div></td>`;
  });
  const rows = [];
  for (let i = 0; i < dayRows.length; i += 7) rows.push(`<tr>${dayRows.slice(i, i + 7).join("")}</tr>`);

  const hourRows = auxiliaries.map(aux => {
    const h = displayHours(hours[aux.id], aux.quota);
    return `<tr><td>${esc(aux.name)}</td><td>${h.morning}</td><td>${h.afternoon}</td><td>${h.night}</td><td>${h.total}</td><td>${h.quota}</td><td>${h.pause}</td></tr>`;
  }).join("");

  const completedThrough = Math.max(0, ...auxiliaries.map(aux => Number(hours[aux.id]?.completedThrough) || 0));
  const monthClosed = auxiliaries.some(aux => hours[aux.id]?.monthClosed);
  const accountingNote = monthClosed
    ? "Mois cloture : les doublons de comblage sont inclus."
    : completedThrough > 0
      ? `Heures effectuees jusqu'au ${completedThrough} ${MONTHS[month]}. Les doublons de comblage seront inclus a la cloture du mois.`
      : "Aucune journee terminee : le compteur des heures effectuees commence a 0. Les doublons de comblage seront inclus a la cloture du mois.";

  const beneficiaryLine = beneficiaryName ? `<p class="beneficiary">Bénéficiaire : ${esc(beneficiaryName)}</p>` : "";

  return `<!doctype html><html><head><title>Rapport Planning-AVD</title><style>
    body{font-family:Arial,sans-serif;color:#25302c;padding:18px;background:#fff}
    h1{margin:0 0 4px;color:#3f4a3a}.beneficiary{margin:0 0 14px;font-weight:900;color:#39735b} table{width:100%;border-collapse:collapse;table-layout:fixed}
    td,th{border:1px solid #ded7ca;vertical-align:top;padding:6px;font-size:11px}
    th{background:#f4efe7}.date{font-weight:900;margin-bottom:4px;color:#3f4a3a}
    .slot{display:grid;grid-template-columns:58px 1fr 28px;gap:4px;margin:3px 0}.slot b{color:#746d61}.slot span{font-weight:700}.break{display:inline-flex;margin-left:4px;padding:1px 4px;border-radius:999px;border:1px solid #a6dcc2;background:#e4f8f0;color:#1a6a44;font-size:8px;font-weight:900}.break.rest{border-color:#c9bee8;background:#f0ecff;color:#3e2a9e}
    .meal{display:grid;grid-template-columns:38px 1fr;gap:4px;margin-top:5px;padding-top:4px;border-top:1px solid #dfe9e3;color:#39735b}.meal b{font-size:9px}.meal span{font-size:10px;font-weight:700}
    .hours{margin-top:18px}.hours td,.hours th{font-size:12px}
  </style></head><body><h1>Planning-AVD - ${MONTHS[month]} ${year}</h1>${beneficiaryLine}<table>${rows.join("")}</table>
  <p>${accountingNote}</p>
  <table class="hours"><tr><th>Auxiliaire</th><th>Matin</th><th>Apres-midi</th><th>Nuit</th><th>Effectue</th><th>Quota</th><th>En pause</th></tr>${hourRows}</table></body></html>`;
}
