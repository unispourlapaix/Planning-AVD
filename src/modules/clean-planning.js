import { DAYS_SHORT, MONTHS, PALETTE, SHIFT_DEFS } from "./constants.js";
import { dayIndex, monthGrid } from "./dates.js";

const esc = value => String(value ?? "").replace(/[<>&"]/g, char => ({
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  "\"": "&quot;",
}[char]));
const shiftWorkerIds = entry => Array.isArray(entry?.workers) ? entry.workers.filter(Boolean) : (entry?.worker ? [entry.worker] : []);
const colorFor = index => PALETTE[index % PALETTE.length];
const shiftNames = { morning: "Matin 11h", afternoon: "Apres-midi 17h", night: "Soir" };

export function buildCleanPlanningHtml({ year, month, auxiliaries = [], schedule = {} }) {
  const active = auxiliaries.filter(aux => aux.active !== false);
  const indexById = Object.fromEntries(active.map((aux, index) => [aux.id, index]));
  const nameById = Object.fromEntries(active.map(aux => [aux.id, aux.name || "A definir"]));

  const formatWorkers = ids => ids.map((id, index) => {
    const name = nameById[id] || "A definir";
    const color = colorFor(indexById[id] ?? 0);
    const label = index === 0 ? name : name.trim().slice(0, 3);
    return `<span class="${index === 0 ? "name" : "extra"}" style="--fg:${color.text};--bg:${color.light};--bd:${color.solid}">${esc(label)}</span>`;
  }).join("");

  const dayHtml = day => {
    if (!day) return `<div class="day empty"></div>`;
    const plan = schedule[day] || {};
    const tone = dayIndex(year, month, day) === 5 ? " saturday" : dayIndex(year, month, day) === 6 ? " sunday" : "";
    const slots = SHIFT_DEFS.map(shift => {
      const ids = shiftWorkerIds(plan[shift.id]);
      return `<div class="slot"><b>${shiftNames[shift.id] || shift.label}</b><div>${ids.length ? formatWorkers(ids) : `<span class="rest">A definir</span>`}</div></div>`;
    }).join("");
    return `<div class="day${tone}"><div class="head"><span>${day}</span><em>${DAYS_SHORT[dayIndex(year, month, day)]}</em></div>${slots}</div>`;
  };

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Planning-AVD A4 paysage - ${MONTHS[month]} ${year}</title><style>
    @page{size:A4 landscape;margin:8mm}
    *{box-sizing:border-box}html{background:#fffefa}body{margin:0;padding:14px;font-family:Inter,Arial,sans-serif;color:#26333a;background:#fffefa}
    .sheet{width:min(100%,281mm);min-height:194mm;margin:0 auto;padding:14px;border:1px solid #d8e3e6;border-radius:14px;background:linear-gradient(135deg,#ffffff,#fbfbf3 55%,#fff7fb);box-shadow:0 16px 42px rgba(84,111,124,.12)}
    header{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:14px}
    h1{margin:0;font-size:26px;letter-spacing:.02em;color:#344753}p{margin:5px 0 0;color:#6e7c84;font-weight:700}
    .badges{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.badge{padding:8px 12px;border-radius:999px;background:#e7f7fa;color:#17645e;font-weight:900}.badge.white{background:#fff;color:#344753;border:1px solid #d8e3e6}
    .calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px}.dow{font-size:11px;font-weight:900;text-align:center;color:#697981;text-transform:uppercase;padding:5px;border-radius:8px;background:rgba(255,255,255,.72)}
    .dow:nth-child(6){color:#4e7f99;background:#e9f6fb}.dow:nth-child(7){color:#a95d89;background:#fdeef6}
    .day{min-height:128px;padding:7px;border-radius:10px;border:1px solid #dfe8eb;background:rgba(255,255,255,.78);display:grid;gap:5px;align-content:start}
    .day.empty{background:transparent;border:0}.day.saturday{background:#eef8fc;border-color:#b9ddea}.day.sunday{background:#fff0f7;border-color:#efc2dc}
    .head{display:flex;justify-content:space-between;align-items:center;font-weight:900;color:#344753}.head span{font-size:17px}.head em{font-size:10px;font-style:normal;text-transform:uppercase;color:#7a858b}
    .slot{display:grid;grid-template-columns:54px minmax(0,1fr);gap:5px;align-items:center;padding:4px;border-radius:8px;background:rgba(255,255,255,.68);border:1px solid rgba(218,227,230,.82)}
    .slot b{font-size:8px;line-height:1.1;color:#687a83;text-transform:uppercase}.name{display:inline;font-size:11px;font-weight:900;color:var(--fg);line-height:1.12}.extra{display:inline-flex;margin-left:4px;padding:1px 4px;border-radius:999px;border:1px solid var(--bd);background:var(--bg);color:var(--fg);font-size:8px;font-weight:900;vertical-align:middle}.rest{color:#9a948b;font-size:10px;font-weight:800}
    footer{margin-top:10px;color:#6e7c84;font-size:10px;font-weight:700;text-align:right}
    @media print{html,body{width:297mm;min-height:210mm;background:#fff}body{padding:0}.sheet{width:auto;min-height:194mm;box-shadow:none;border-radius:0;border:0}footer{display:none}}
  </style></head><body><section class="sheet">
    <header><div><h1>Planning-AVD</h1><p>${MONTHS[month]} ${year} · calendrier A4 paysage pret a imprimer</p></div><div class="badges"><div class="badge white">A4 paysage</div><div class="badge">${active.length} auxiliaire(s)</div></div></header>
    <div class="calendar">${DAYS_SHORT.map(day => `<div class="dow">${day}</div>`).join("")}${monthGrid(year, month).map(dayHtml).join("")}</div>
    <footer>Planning genere depuis Planning-AVD</footer>
  </section></body></html>`;
}
