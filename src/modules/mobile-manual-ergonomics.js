import { MONTHS, SHIFT_DEFS } from "./constants.js";

const LOCAL_KEY = "planning-avd-state-v2";
const manualKey = (year, month, day, shift) => `${year}-${month}-${day}-${shift}`;

const readState = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "null") || {};
  } catch {
    return {};
  }
};

const readVisibleMonth = () => {
  const title = document.querySelector(".topbar .month-row h2")?.textContent || "";
  const match = title.match(/^(.*)\s+(\d{4})$/);
  const month = MONTHS.indexOf(match?.[1]);
  return month >= 0 ? { year: Number(match[2]), month } : null;
};

const refreshManualMarkers = () => {
  const visible = readVisibleMonth();
  if (!visible) return;
  const overrides = readState().overrides || {};
  document.querySelectorAll(".day-card:not(.empty)").forEach(card => {
    const day = Number(card.querySelector(".day-head span")?.textContent);
    if (!day) return;
    card.querySelectorAll(".editable-slot").forEach((slot, index) => {
      const shift = SHIFT_DEFS[index]?.id;
      const manual = shift && overrides[manualKey(visible.year, visible.month, day, shift)];
      slot.classList.toggle("manual-override", !!manual);
      if (manual) slot.title = "Créneau modifié manuellement";
    });
  });
};

export function initMobileManualErgonomics() {
  if (!document.getElementById("mobile-manual-ergonomics-style")) {
    const style = document.createElement("style");
    style.id = "mobile-manual-ergonomics-style";
    style.textContent = `
      .editable-slot{position:relative}
      .editable-slot.manual-override{border-color:rgba(212,106,168,.72);box-shadow:inset 3px 0 0 rgba(212,106,168,.78)}
      .editable-slot.manual-override::after{content:"";position:absolute;top:5px;right:5px;width:6px;height:6px;border-radius:50%;background:#d46aa8;box-shadow:0 0 0 2px rgba(255,255,255,.92)}
      @media (max-width:900px) and (orientation:landscape){
        .personal-app{padding:6px}
        .personal-app .topbar{display:flex;align-items:center;gap:5px;padding:5px 6px;border-radius:0 0 8px 8px;overflow-x:auto}
        .personal-app .topbar>.title-row{display:flex;flex:0 0 auto;gap:4px}
        .personal-app .topbar>.title-row>div:first-child .muted{display:none}
        .personal-app .topbar h1{font-size:12px;white-space:nowrap}
        .personal-app .action-row{display:flex;max-width:none;gap:3px;flex:0 0 auto}
        .personal-app .action-row .btn{padding:5px;font-size:10px}
        .personal-app .action-row .btn:first-child{display:none}
        .personal-app .month-row{display:flex;gap:2px;flex:0 0 auto}
        .personal-app .month-row h2{min-width:94px;font-size:12px;white-space:nowrap}
        .personal-app .month-row .btn{width:24px;height:24px;font-size:17px}
        .personal-app .personal-tabs{display:flex;gap:3px;flex:0 0 auto}
        .personal-app .personal-tabs .btn{min-height:26px;padding:5px 7px;font-size:10px;white-space:nowrap}
        .personal-app .layout{gap:7px;margin-top:7px}
        .personal-app .panel{padding:8px}
        .personal-app .personal-summary{font-size:11px}
        .personal-app .personal-summary h3{font-size:12px}
        .personal-app .week-grid,.personal-app .week-days{gap:5px}
        .personal-app .week-days{grid-template-columns:repeat(7,minmax(112px,1fr));overflow-x:auto}
        .personal-app .day-card{min-height:126px;padding:5px;gap:4px}
        .personal-app .personal-slot{padding:4px;font-size:10px}
        .personal-app .personal-month{grid-template-columns:repeat(7,minmax(106px,1fr));gap:5px}
      }
    `;
    document.head.appendChild(style);
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      observer.disconnect();
      refreshManualMarkers();
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(refreshManualMarkers, 700);
      scheduled = false;
    }, 0);
  });
  refreshManualMarkers();
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("storage", refreshManualMarkers);
}
