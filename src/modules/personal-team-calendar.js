import { MONTHS } from "./constants.js";
import { mealForDate } from "./meal-planning.js";
import { shiftDisplayLabel } from "./shift-labels.js?v=20260720-morning-ranges";

const normalizeEmail = email => String(email || "").trim().toLowerCase();
const cleanEmail = email => String(email || "").trim();
const encodedEmailKey = email => encodeURIComponent(cleanEmail(email));
const shareEmailKey = email => cleanEmail(email).replaceAll("/", "%2F");
const uniqueShareKeys = email => {
  const raw = cleanEmail(email);
  const lower = normalizeEmail(email);
  return [...new Set([shareEmailKey(raw), shareEmailKey(lower), encodedEmailKey(raw), encodedEmailKey(lower)].filter(Boolean))];
};
const monthKey = (year, month) => `${year}-${String(month + 1).padStart(2, "0")}`;
const DAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const shiftOrder = ["morning", "afternoon", "night"];
const slotKey = (day, shift) => `${day}-${shift}`;
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
    .team-admin-view .day-card:not(.has-own){background:rgba(245,246,246,.72);border-color:rgba(224,228,229,.74)}
    .team-admin-view .day-card.has-own{box-shadow:0 12px 28px rgba(86,137,201,.13), inset 0 0 0 1px rgba(123,175,212,.18)}
    .team-admin-view .slot{
      --slot-accent:#9bb6c6;
      display:grid;
      grid-template-columns:minmax(0,1fr) auto;
      gap:2px;
      align-items:start;
      min-width:0;
      padding:5px 6px;
      border-radius:7px;
      background:rgba(255,255,255,.78);
      border:1px solid rgba(218,228,232,.9);
      box-shadow:inset 3px 0 0 var(--slot-accent);
    }
    .team-admin-view .slot.other{
      --slot-accent:#d8dee2;
      opacity:.48;
      background:rgba(247,248,248,.72);
      border-color:rgba(226,229,231,.72);
      box-shadow:inset 2px 0 0 rgba(207,215,219,.8);
    }
    .team-admin-view .slot.mine{
      opacity:1;
      background:linear-gradient(135deg,rgba(236,247,255,.98),rgba(255,241,248,.96));
      border-color:rgba(123,175,212,.72);
      box-shadow:inset 4px 0 0 var(--slot-accent),0 7px 18px rgba(86,137,201,.16);
    }
    .team-admin-view .slot.morning{--slot-accent:#7eb6d4}
    .team-admin-view .slot.afternoon{--slot-accent:#e5a0c6}
    .team-admin-view .slot.night{--slot-accent:#a99ade}
    .team-admin-view .slot-name{
      grid-column:1;
      min-width:0;
      color:#3f5967;
      font-size:11px;
      font-weight:900;
      line-height:1.08;
      white-space:normal;
      overflow-wrap:anywhere;
      text-overflow:clip;
    }
    .team-admin-view .slot.other .slot-name{color:#9aa3a7}
    .team-admin-view .slot.mine .slot-name{color:#264d71;font-size:11.5px}
    .team-admin-view .slot-label{
      grid-column:1;
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
    .team-admin-view .slot.other .slot-label{color:#aeb7bc}
    .team-admin-view .slot-rest{color:#9a948b;font-weight:800}
    .team-admin-view .exchange-tag{
      grid-column:2;
      grid-row:1 / span 2;
      align-self:center;
      width:24px;
      height:24px;
      padding:0;
      border:1px solid rgba(212,106,168,.42);
      border-radius:50%;
      background:rgba(255,255,255,.96);
      color:#d46aa8;
      font-size:18px;
      font-weight:900;
      line-height:1;
      box-shadow:0 4px 12px rgba(212,106,168,.18);
    }
    .team-admin-view .exchange-tag:active{transform:translateY(1px)}
    .team-admin-view .meal-tag{
      width:100%;
      display:grid;
      grid-template-columns:18px minmax(0,1fr);
      gap:5px;
      align-items:center;
      padding:5px 6px;
      border:1px solid rgba(104,196,154,.34);
      border-radius:7px;
      background:rgba(235,249,241,.86);
      color:#39735b;
      text-align:left;
      font-size:9px;
      font-weight:900;
      line-height:1.1;
    }
    .team-admin-view .meal-tag svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  `;
  document.head.appendChild(style);
};

const activePersonalView = () => {
  if (document.querySelector(".personal-app .month-title-btn.active")) return "month";
  const activeButton = document.querySelector(".personal-app .personal-tabs .btn.active");
  const view = activeButton?.dataset.view || "";
  if (view === "life") return "";
  if (view === "month") return "month";
  if (view === "week") return "week";
  const active = activeButton?.textContent || "";
  if (active.includes("Repas") || active.includes("Tâches") || active.includes("Taches")) return "";
  return active.includes("Mois") ? "month" : "week";
};

const personalSlotSet = entries => new Set((entries || []).map(entry => slotKey(entry.day, entry.shift)));

const slotHtml = (item, shift, personalSlots, calendarByDay) => {
  // Vue auxiliaire : uniquement le titulaire principal, les doublons restent cotes admin.
  const primaryName = (item?.shifts?.[shift] || []).filter(Boolean)[0];
  const mine = personalSlots.has(slotKey(item.day, shift));
  const name = primaryName ? escapeHtml(primaryName) : `<span class="slot-rest">Repos</span>`;
  const label = shiftDisplayLabel({ shift, calendarByDay, day: item.day, name: primaryName });
  const exchange = mine
    ? `<button class="exchange-tag" type="button" data-request-day="${item.day}" data-request-shift="${shift}" title="Demander un échange" aria-label="Demander un échange">+</button>`
    : "";
  return `<div class="slot ${shift} ${mine ? "mine" : "other"}"><span class="slot-label">${escapeHtml(label)}</span><span class="slot-name">${name}</span>${exchange}</div>`;
};

const dayHtml = (item, year, month, personalSlots, calendarByDay) => {
  if (!item) return `<div class="day-card empty"></div>`;
  const date = new Date(year, month, item.day);
  const tone = date.getDay() === 6 ? " saturday" : date.getDay() === 0 ? " sunday" : "";
  const meal = mealForDate(year, month, item.day);
  const hasOwn = shiftOrder.some(shift => personalSlots.has(slotKey(item.day, shift)));
  return `<div class="day-card${tone}${hasOwn ? " has-own" : ""}">
    <div class="day-head"><span>${item.day}</span><span>${DAYS_SHORT[(date.getDay() + 6) % 7]}</span></div>
    ${shiftOrder.map(shift => slotHtml(item, shift, personalSlots, calendarByDay)).join("")}
    <button class="meal-tag" data-meal-year="${year}" data-meal-month="${month}" data-meal-day="${item.day}" title="Repas : ${escapeHtml(meal.title)}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M15 3v18M15 3c4 2 5 8 0 11"></path></svg>
      <span>${escapeHtml(meal.short)}</span>
    </button>
  </div>`;
};

const render = ({ calendar = [], entries = [], year, month }) => {
  const layout = document.querySelector(".personal-app .layout");
  const app = document.querySelector(".personal-app");
  if (!layout) return;
  document.getElementById("personal-team-calendar")?.remove();
  app?.classList.remove("team-calendar-ready");
  if (!calendar.length) return;
  const byDay = Object.fromEntries(calendar.map(item => [item.day, item]));
  const ownSlots = personalSlotSet(entries);
  const view = activePersonalView();
  if (!view) return;
  const section = document.createElement("section");
  section.id = "personal-team-calendar";
  section.className = "team-admin-view";
  if (view === "month") {
    section.innerHTML = `<div class="calendar">
      ${DAYS_SHORT.map((day, index) => `<div class="dow${index === 5 ? " saturday" : index === 6 ? " sunday" : ""}">${day}</div>`).join("")}
      ${monthGrid(year, month).map(day => day ? dayHtml(byDay[day], year, month, ownSlots, byDay) : dayHtml(null, year, month, ownSlots, byDay)).join("")}
    </div>`;
  } else {
    section.innerHTML = weekStarts(year, month).map(start => {
      const days = Array.from({ length: 7 }, (_, index) => start + index).filter(day => byDay[day]);
      return `<section class="panel"><h3>Semaine du ${start} ${MONTHS[month]}</h3><div class="week-days">${days.map(day => dayHtml(byDay[day], year, month, ownSlots, byDay)).join("")}</div></section>`;
    }).join("");
  }
  layout.appendChild(section);
  app?.classList.add("team-calendar-ready");
};

export async function initPersonalTeamCalendar() {
  ensureStyle();
  document.addEventListener("click", event => {
    const exchangeButton = event.target.closest?.("#personal-team-calendar .exchange-tag");
    if (exchangeButton) {
      window.dispatchEvent(new CustomEvent("planning-avd-request-change", {
        detail: {
          day: Number(exchangeButton.dataset.requestDay),
          shift: exchangeButton.dataset.requestShift,
        },
      }));
      return;
    }
    const button = event.target.closest?.("#personal-team-calendar .meal-tag");
    if (!button) return;
    window.dispatchEvent(new CustomEvent("planning-avd-open-meal", {
      detail: {
        year: Number(button.dataset.mealYear),
        month: Number(button.dataset.mealMonth),
        day: Number(button.dataset.mealDay),
      },
    }));
  });
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
    const appState = globalThis.__planningAvdCurrentState || {};
    const beneficiaryId = String(appState.beneficiaryId || "").trim();
    const key = `${user.email}-${beneficiaryId}-${visible.year}-${visible.month}`;
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
    if (!beneficiaryId) {
      lastPayload = { calendar: [], ...visible };
      render(lastPayload);
      return;
    }
    const email = normalizeEmail(user.email);
    const rawEmail = cleanEmail(user.email);
    const monthId = monthKey(visible.year, visible.month);
    const refs = uniqueShareKeys(rawEmail).map(emailId =>
      db.collection("planning-avd-shares").doc(emailId).collection("beneficiaries").doc(beneficiaryId).collection("months").doc(monthId));
    let active = true;
    let directPending = refs.length;
    let queryUnsubscribe = null;
    let hasDirectPlanning = false;
    const renderSnapshot = snap => {
      if (!active) return;
      const data = snap.data() || {};
      lastPayload = {
        calendar: data.calendar || [],
        entries: data.entries || [],
        name: data.name || "",
        ...visible,
      };
      lastRenderedView = activePersonalView();
      render(lastPayload);
    };
    const renderEmpty = () => {
      if (!active) return;
      lastPayload = { calendar: [], ...visible };
      render(lastPayload);
    };
    const stopQuery = () => {
      queryUnsubscribe?.();
      queryUnsubscribe = null;
    };
    const startQueryFallback = () => {
      if (queryUnsubscribe || !active || hasDirectPlanning) return;
      queryUnsubscribe = db.collectionGroup("months")
        .where("email", "==", email)
        .where("beneficiaryId", "==", beneficiaryId)
        .where("year", "==", visible.year)
        .where("month", "==", visible.month)
        .limit(1)
        .onSnapshot(snapshot => {
          if (!active) return;
          if (snapshot.empty) renderEmpty();
          else renderSnapshot(snapshot.docs[0]);
        }, renderEmpty);
    };
    const directUnsubscribers = refs.map(ref => ref.onSnapshot(snap => {
        if (!active) return;
        directPending = Math.max(0, directPending - 1);
        if (snap.exists) {
          hasDirectPlanning = true;
          stopQuery();
          renderSnapshot(snap);
          return;
        }
        if (directPending === 0 && !hasDirectPlanning) startQueryFallback();
      }, () => {
        directPending = Math.max(0, directPending - 1);
        if (directPending === 0 && !hasDirectPlanning) startQueryFallback();
      }));
    unsubscribe = () => {
      active = false;
      directUnsubscribers.forEach(unsubscribeDirect => unsubscribeDirect());
      stopQuery();
    };
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
