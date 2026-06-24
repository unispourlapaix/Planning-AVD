export function initPersonalMobileView() {
  if (document.getElementById("personal-mobile-view-style")) return;
  const style = document.createElement("style");
  style.id = "personal-mobile-view-style";
  style.textContent = `
    .personal-app .personal-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}
    .personal-app .personal-tabs .tab{min-width:0}
    .personal-app .team-admin-view .slot{min-width:0}
    .personal-app .team-admin-view .slot-name{font-size:11px;font-weight:900;line-height:1.08}
    .personal-app .team-admin-view .slot-label{letter-spacing:0}
    @media (max-width:560px) and (orientation:portrait){
      .personal-app{padding:5px}
      .personal-app .topbar{position:sticky;top:0;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:3px 6px;padding:5px 6px;border-radius:0 0 8px 8px;background:rgba(255,255,255,.96)}
      .personal-app .topbar>.title-row{display:contents}
      .personal-app .topbar>.title-row>div:first-child{min-width:0}
      .personal-app .topbar h1{font-size:12px;line-height:1;white-space:nowrap}
      .personal-app .topbar .muted{display:none}
      .personal-app .action-row{display:flex;justify-content:flex-end;gap:3px;max-width:none}
      .personal-app .action-row .btn{min-width:30px;min-height:26px;padding:4px 6px;border-radius:6px;font-size:10px}
      .personal-app .action-row .btn:first-child{display:none}
      .personal-app .month-row{grid-column:1 / -1;display:grid;grid-template-columns:28px minmax(0,1fr) 28px;align-items:center;gap:4px;width:100%}
      .personal-app .month-row h2{min-width:0;text-align:center}
      .personal-app .month-title-btn{width:100%;min-width:0;height:28px;padding:4px 6px;font-size:12px}
      .personal-app .month-row .icon-only{width:28px;height:27px;padding:0;border-radius:6px}
      .personal-app .personal-tabs{grid-column:1 / -1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;width:100%}
      .personal-app .personal-tabs .tab{display:flex;min-height:28px;padding:4px 5px;border-radius:6px;font-size:10px;white-space:nowrap}
      .personal-app .layout{gap:6px;margin-top:6px}
      .personal-app .panel{padding:7px}
      .personal-app .panel h3{font-size:12px;margin:0 0 6px}
      .personal-app .personal-summary{display:none}
      .personal-app .team-admin-view{gap:6px}
      .personal-app .team-admin-view .calendar{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;overflow-x:visible;padding-bottom:0}
      .personal-app .team-admin-view .calendar>.dow{display:none}
      .personal-app .team-admin-view .week-days{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;overflow-x:visible}
      .personal-app .team-admin-view .day-card{min-height:126px;padding:6px;gap:4px}
      .personal-app .team-admin-view .day-head{font-size:12px}
      .personal-app .team-admin-view .slot{padding:4px;border-radius:6px}
      .personal-app .team-admin-view .slot-label{font-size:7px}
      .personal-app .team-admin-view .slot-name{font-size:10.5px;overflow-wrap:anywhere}
    }
    @media (max-width:900px) and (orientation:landscape){
      .personal-app{width:100%;padding:5px}
      .personal-app .topbar{position:sticky;top:0;display:grid;grid-template-columns:auto minmax(150px,auto) minmax(160px,1fr) auto;align-items:center;gap:4px;padding:4px 6px;border-radius:0 0 8px 8px;background:rgba(255,255,255,.96);overflow:visible}
      .personal-app .topbar>.title-row{display:contents}
      .personal-app .topbar h1{font-size:12px;line-height:1;white-space:nowrap}
      .personal-app .topbar .muted{display:none}
      .personal-app .month-row{display:grid;grid-template-columns:24px minmax(94px,1fr) 24px;align-items:center;gap:2px;min-width:150px}
      .personal-app .month-title-btn{height:25px;min-width:0;padding:3px 5px;font-size:11px}
      .personal-app .month-row .icon-only{width:24px;height:24px;padding:0;border-radius:6px}
      .personal-app .personal-tabs{display:grid;grid-template-columns:repeat(3,minmax(52px,1fr));gap:3px}
      .personal-app .personal-tabs .tab{min-height:25px;padding:3px 5px;border-radius:6px;font-size:9.5px}
      .personal-app .action-row{display:flex;gap:3px;justify-content:flex-end;max-width:none}
      .personal-app .action-row .btn{min-height:25px;padding:4px 6px;border-radius:6px;font-size:10px}
      .personal-app .action-row .btn:first-child{display:none}
      .personal-app .layout{gap:6px;margin-top:6px}
      .personal-app .personal-summary{display:none}
      .personal-app .team-admin-view{gap:6px}
      .personal-app .team-admin-view .calendar{grid-template-columns:repeat(7,minmax(104px,1fr));gap:5px;overflow-x:auto;padding-bottom:4px}
      .personal-app .team-admin-view .week-days{grid-template-columns:repeat(7,minmax(104px,1fr));gap:5px;overflow-x:auto}
      .personal-app .team-admin-view .day-card{min-height:116px;padding:5px;gap:3px}
      .personal-app .team-admin-view .day-head{font-size:11px}
      .personal-app .team-admin-view .slot{padding:4px;border-radius:6px}
      .personal-app .team-admin-view .slot-label{font-size:6.5px}
      .personal-app .team-admin-view .slot-name{font-size:9.5px}
    }
  `;
  document.head.appendChild(style);
}
