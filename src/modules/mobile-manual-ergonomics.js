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

const enhanceMonthAccess = () => {
  const title = document.querySelector(".app:not(.personal-app) .topbar>.month-row h2");
  if (!title || title.dataset.mobileMonthAccess) return;
  title.dataset.mobileMonthAccess = "true";
  title.classList.add("mobile-month-access");
  title.title = "Afficher le calendrier du mois";
  title.setAttribute("role", "button");
  title.tabIndex = 0;
  const openMonth = event => {
    if (event?.target?.closest?.(".month-title-btn")) return;
    title.querySelector(".month-title-btn")?.click();
  };
  title.addEventListener("click", openMonth);
  title.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openMonth();
  });
};

const refreshManualMarkers = () => {
  enhanceMonthAccess();
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
      @media (max-width:560px) and (orientation:portrait){
        .app:not(.personal-app){padding:6px}
        .app:not(.personal-app)::before{display:none}
        .app:not(.personal-app) .topbar{position:sticky;top:0;display:grid;grid-template-columns:minmax(0,1fr);gap:5px;padding:6px;border-radius:0 0 9px 9px;background:rgba(255,255,255,.94)}
        .app:not(.personal-app) .topbar>.title-row{display:grid;grid-template-columns:minmax(0,1fr);gap:5px}
        .app:not(.personal-app) .topbar h1{font-size:14px}
        .app:not(.personal-app) .topbar .action-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;width:100%;max-width:none}
        .app:not(.personal-app) .topbar .action-row .btn{min-width:0;min-height:27px;padding:5px 2px;border-radius:6px;font-size:clamp(7px,2.35vw,10px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .app:not(.personal-app) .topbar>.month-row{display:grid;grid-template-columns:30px minmax(0,1fr) 30px;align-items:center;gap:4px}
        .app:not(.personal-app) .topbar>.month-row h2{min-width:0;margin:0;font-size:14px;text-align:center}
        .app:not(.personal-app) .topbar>.month-row h2.mobile-month-access{cursor:pointer;padding:5px;border-radius:6px}
        .app:not(.personal-app) .topbar>.month-row .btn{width:30px;height:28px;border-radius:6px;font-size:19px}
        .app:not(.personal-app) .topbar>.tabs{display:grid;grid-template-columns:minmax(0,1fr);gap:3px;width:100%}
        .app:not(.personal-app) .topbar>.tabs .tab{display:flex;min-width:0;min-height:31px;gap:3px;padding:5px 3px;border-radius:6px;font-size:clamp(9px,2.8vw,11px);white-space:nowrap}
        .app:not(.personal-app) .topbar>.tabs .tab-icon{font-size:13px}
        .app:not(.personal-app) .calendar{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;overflow-x:visible}
        .app:not(.personal-app) .calendar>.dow{display:none}
        .app:not(.personal-app) .day-card{min-width:0;min-height:132px;padding:6px;gap:4px}
        .app:not(.personal-app) .slot-name{white-space:normal;overflow-wrap:anywhere;text-overflow:clip;line-height:1.1}
        .app:not(.personal-app) .week-days{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
        .personal-app{padding:6px}
        .personal-app::before{display:none}
        .personal-app .topbar{position:sticky;top:0;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 7px;padding:6px;border-radius:0 0 9px 9px;background:rgba(255,255,255,.94);overflow:visible}
        .personal-app .topbar>.title-row{display:contents}
        .personal-app .topbar>.title-row>div:first-child{min-width:0;align-self:center}
        .personal-app .topbar>.title-row>div:first-child .muted{display:none}
        .personal-app .topbar h1{font-size:13px;white-space:nowrap}
        .personal-app .action-row{display:flex;justify-content:flex-end;gap:3px;max-width:none}
        .personal-app .action-row .btn{min-height:27px;padding:5px 6px;border-radius:6px;font-size:10px}
        .personal-app .action-row .btn:first-child{display:none}
        .personal-app .month-row{grid-column:1 / -1;display:grid;grid-template-columns:28px minmax(0,1fr) 28px;align-items:center;gap:4px}
        .personal-app .month-row h2{min-width:0;margin:0;font-size:13px;text-align:center}
        .personal-app .month-row .btn{display:block;width:28px;height:27px;border-radius:6px;font-size:18px}
        .personal-app .personal-tabs{grid-column:1 / -1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px}
        .personal-app .personal-tabs .btn{display:flex;align-items:center;justify-content:center;min-height:29px;padding:5px 5px;border-radius:6px;font-size:10px;white-space:nowrap}
        .personal-app .personal-tabs .btn.active{box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}
        .personal-app .layout{gap:7px;margin-top:7px}
        .personal-app .panel{padding:8px}
        .personal-app .personal-summary{gap:6px;font-size:11px}
        .personal-app .personal-summary h3{font-size:12px}
        .personal-app .week-days,.personal-app .personal-month{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;overflow-x:visible}
        .personal-app .day-card{min-width:0;min-height:128px;padding:6px;gap:4px}
        .personal-app .personal-slot{min-width:0;grid-template-columns:minmax(0,1fr);gap:2px;padding:4px;font-size:10px}
        .personal-app .personal-slot span{min-width:0;overflow-wrap:anywhere}
      }
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
