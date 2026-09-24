import { DAYS_LONG, MONTHS, PALETTE, SHIFT_DEFS } from "./constants.js?v=20260726-normal-slots";
import { dayIndex, monthGrid } from "./dates.js";
import { shiftTimeRange } from "./shift-hours.js";

const esc = value => String(value ?? "").replace(/[<>&"]/g, char => ({
  "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;",
}[char]));

export function buildCleanPlanningHtml({ year, month, beneficiaryName = "", auxiliaries = [], schedule = {}, startTime = "08:00" }) {
  // Validate even when the month has no assignments.
  shiftTimeRange({ shift: "morning", startTime });
  const names = new Map(auxiliaries.map((aux, index) => [aux.id, { name: aux.name || "Non attribué", color: PALETTE[index % PALETTE.length].text }]));
  const dayHtml = day => {
    if (!day) return '<div class="day empty"></div>';
    const plan = schedule[day] || {};
    const slots = SHIFT_DEFS.map(shift => {
      const entry = plan[shift.id];
      const worker = entry?.workers?.[0] || entry?.worker;
      const person = names.get(worker);
      const range = shiftTimeRange({ plan, shift: shift.id, worker, startTime });
      return `<div class="slot"><span class="label">${esc(shift.label)}</span><div><strong style="color:${person?.color || "#6b747b"}">${esc(person?.name || (worker ? "Intervenant" : "Non attribué"))}</strong><time>${esc(range)}</time></div></div>`;
    }).join("");
    return `<div class="day${dayIndex(year, month, day) >= 5 ? " weekend" : ""}"><div class="date">${day}</div>${slots}</div>`;
  };
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Planning ${MONTHS[month]} ${year}</title><style>
    @page{size:A4 landscape;margin:8mm}
    *{box-sizing:border-box}body{margin:0;padding:16px;background:#f1f3f4;color:#243641;font-family:Arial,sans-serif}
    .sheet{max-width:281mm;margin:auto;padding:12px;background:#fff}
    header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:10px}
    h1{font-size:20px;margin:0}header p{font-size:12px;margin:5px 0 0;color:#5e6e78}
    .print-button{padding:8px 14px;border:1px solid #9bafb9;border-radius:4px;background:white;color:#243641;cursor:pointer}
    .calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:1px solid #ccd6dc;border-left:1px solid #ccd6dc}
    .dow{padding:7px 2px;text-align:center;font-size:11px;font-weight:bold;background:#f2f5f7;border-right:1px solid #ccd6dc;border-bottom:1px solid #ccd6dc}
    .day{min-width:0;padding:4px;border-right:1px solid #ccd6dc;border-bottom:1px solid #ccd6dc;break-inside:avoid}
    .empty{background:#fafbfc}.weekend{background:#f2f7fa}.date{font-size:14px;font-weight:bold;margin-bottom:3px}
    .slot{display:grid;grid-template-columns:48px minmax(0,1fr);gap:4px;padding:4px 0;border-top:1px solid #edf0f2}
    .label{font-size:9px;line-height:1.2;color:#60717b}.slot strong{display:block;font-size:10px;line-height:1.2;overflow-wrap:anywhere}
    time{display:block;font-size:9px;line-height:1.3;color:#364f60}
    @media print{body{padding:0;background:white}.sheet{max-width:none;padding:0}header{margin-bottom:3mm}h1{font-size:14pt}header p{font-size:8pt}.print-button{display:none}.dow{font-size:7pt;padding:1mm}.day{padding:1mm}.date{font-size:9pt;margin-bottom:.5mm}.slot{padding:.65mm 0;grid-template-columns:12mm minmax(0,1fr);gap:1mm}.label{font-size:6.5pt}.slot strong{font-size:7pt}time{font-size:6.5pt}}
  </style></head><body><main class="sheet"><header><div><h1>${MONTHS[month]} ${year}</h1><p>${esc(beneficiaryName || "Planning-AVD")} · Début de journée : ${esc(startTime)}</p></div><button type="button" class="print-button" onclick="window.print()">Imprimer</button></header><div class="calendar">${DAYS_LONG.map(day => `<div class="dow">${day}</div>`).join("")}${monthGrid(year, month).map(dayHtml).join("")}</div></main></body></html>`;
}
