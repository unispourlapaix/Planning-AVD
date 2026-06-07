import { MONTHS } from "./constants.js";

const emailKey = email => encodeURIComponent(String(email || "").trim().toLowerCase());
const monthKey = (year, month) => `${year}-${String(month + 1).padStart(2, "0")}`;
const DAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const shiftLabels = { morning: "Matin 11h", afternoon: "Après-midi 17h", night: "Soir" };
const shiftOrder = ["morning", "afternoon", "night"];
const escapeHtml = value => String(value ?? "").replace(/[<>&"]/g, char => ({
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  "\"": "&quot;",
}[char]));

const waitForFirebase = () => new Promise(resolve => {
  const find = () => {
    if (globalThis.firebase?.auth && globalThis.firebase?.firestore) resolve();
    else setTimeout(find, 120);
  };
  find();
});

const readVisibleMonth = () => {
  const title = document.querySelector(".personal-app .month-row h2")?.textContent || "";
  const match = title.match(/^(.*)\s+(\d{4})$/);
  const month = MONTHS.indexOf(match?.[1]);
  return month >= 0 ? { year: Number(match[2]), month } : null;
};

const monthGrid = (year, month) => {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ];
};

const weekStarts = (year, month) => {
  const days = new Date(year, month + 1, 0).getDate();
  const starts = [];
  for (let day = 1; day <= days; day += 7) starts.push(day);
  return starts;
};

const ensureStyle = () => {
  if (document.getElementById("personal-team-calendar-style")) return;
  const style = document.createElement("style");
  style.id = "personal-team-calendar-style";
  style.textContent = `
    .personal-app.team-calendar-ready>.layout>.week-grid,.personal-app.team-calendar-ready>.layout>.personal-month{display:none!important}
    .team-admin-view{display:grid;gap:10px}
    .team-admin-view h3{margin:0 0 8px;font-size:13px;color:#405662}
    .team-admin-view .calendar,.team-admin-view .week-days{align-items:stretch}
    .team-admin-view .day-card{position:relative;overflow:hidden}
    .team-admin-view .day-card.empty{min-height:0;opacity:.28}
    .team-admin-view .slot{
      --slot-accent:#9bb6c6;
      display:grid;
      grid-template-columns:minmax(0,1fr);
      gap:2px;
      align-items:start;
      min-width:0;
      padding:5px 6px;
      border-radius:7px;
      background:rgba(255,255,255,.78);
      border:1px solid rgba(218,228,232,.9);
      box-shadow:inset 3px 0 0 var(--slot-accent);
    }
    .team-admin-view .slot.morning{--slot-accent:#7eb6d4}
    .team-admin-view .slot.afternoon{--slot-accent:#e5a0c6}
    .team-admin-view .slot.night{--slot-accent:#a99ade}
    .team-admin-view .slot-name{
      min-width:0;
      color:#3f5967;
      font-size:11px;
      font-weight:900;
      line-height:1.08;
      white-space:normal;
      overflow-wrap:anywhere;
      text-overflow:clip;
    }
    .team-admin-view .slot-label{
      display:block;
      padding:0;
      border:0;
      background:transparent;
      color:var(--slot-accent);
      font-size:7px;
      font-weight:900;
      line-height:1;
      text-align:left;
      text-transform:uppercase;
    }
    .team-admin-view .slot-rest{color:#9a948b;font-weight:800}
  `;
  document.head.appendChild(style);
};

const activePersonalView = () => {
  if (document.querySelector(".personal-app .month-title-btn.active")) return "month";
  const active = document.querySelector(".personal-app .personal-tabs .btn.active")?.textContent || "";
  return active.includes("Mois") ? "month" : "week";
};

const slotHtml = (item, shift) => {
  // Vue auxiliaire : uniquement le titulaire principal, les doublons restent cotes admin.
  const primaryName = (item?.shifts?.[shift] || []).filter(Boolean)[0];
  const name = primaryName ? escapeHtml(primaryName) : `<span class="slot-rest">Repos</span>`;
  return `<div class="slot ${shift}"><span class="slot-label">${shiftLabels[shift]}</span><span class="slot-name">${name}</span></div>`;
};

const dayHtml = (item, year, month) => {
  if (!item) return `<div class="day-card empty"></div>`;
  const date = new Date(year, month, item.day);
  const tone = date.getDay() === 6 ? " saturday" : date.getDay() === 0 ? " sunday" : "";
  return `<div class="day-card${tone}">
    <div class="day-head"><span>${item.day}</span><span>${DAYS_SHORT[(date.getDay() + 6) % 7]}</span></div>
    ${shiftOrder.map(shift => slotHtml(item, shift)).join("")}
  </div>`;
};

const render = ({ calendar = [], year, month }) => {
  const layout = document.querySelector(".personal-app .layout");
  const app = document.querySelector(".personal-app");
  if (!layout) return;
  document.getElementById("personal-team-calendar")?.remove();
  app?.classList.remove("team-calendar-ready");
  if (!calendar.length) return;
  const byDay = Object.fromEntries(calendar.map(item => [item.day, item]));
  const view = activePersonalView();
  const section = document.createElement("section");
  section.id = "personal-team-calendar";
  section.className = "team-admin-view";
  if (view === "month") {
    section.innerHTML = `<div class="calendar">
      ${DAYS_SHORT.map((day, index) => `<div class="dow${index === 5 ? " saturday" : index === 6 ? " sunday" : ""}">${day}</div>`).join("")}
      ${monthGrid(year, month).map(day => day ? dayHtml(byDay[day], year, month) : dayHtml(null, year, month)).join("")}
    </div>`;
  } else {
    section.innerHTML = weekStarts(year, month).map(start => {
      const days = Array.from({ length: 7 }, (_, index) => start + index).filter(day => byDay[day]);
      return `<section class="panel"><h3>Semaine du ${start} ${MONTHS[month]}</h3><div class="week-days">${days.map(day => dayHtml(byDay[day], year, month)).join("")}</div></section>`;
    }).join("");
  }
  layout.appendChild(section);
  app?.classList.add("team-calendar-ready");
};

export async function initPersonalTeamCalendar() {
  ensureStyle();
  await waitForFirebase();
  const auth = firebase.auth();
  const db = firebase.firestore();
  let unsubscribe = null;
  let activeKey = "";
  let lastPayload = null;
  let lastRenderedView = "";
  let pageObserver = null;

  const subscribe = user => {
    const visible = readVisibleMonth();
    if (!user?.email || !visible || !document.querySelector(".personal-app")) return;
    const key = `${user.email}-${visible.year}-${visible.month}`;
    const view = activePersonalView();
    if (key === activeKey) {
      if (lastPayload && view !== lastRenderedView) {
        render(lastPayload);
        lastRenderedView = view;
      }
      return;
    }
    unsubscribe?.();
    activeKey = key;
    lastPayload = null;
    lastRenderedView = "";
    unsubscribe = db.collection("planning-avd-shares").doc(emailKey(user.email)).collection("months").doc(monthKey(visible.year, visible.month))
      .onSnapshot(snap => {
        lastPayload = { calendar: snap.data()?.calendar || [], ...visible };
        lastRenderedView = activePersonalView();
        render(lastPayload);
      }, () => {});
  };

  auth.onAuthStateChanged(async user => {
    unsubscribe?.();
    unsubscribe = null;
    pageObserver?.disconnect();
    pageObserver = null;
    activeKey = "";
    document.getElementById("personal-team-calendar")?.remove();
    document.querySelector(".personal-app")?.classList.remove("team-calendar-ready");
    if (!user?.uid) return;
    const admin = await db.collection("planning-avd-admins").doc(user.uid).get().catch(() => null);
    if (admin?.exists) return;
    const refresh = () => subscribe(user);
    refresh();
    pageObserver = new MutationObserver(refresh);
    pageObserver.observe(document.body, { childList: true, subtree: true });
  });
}
