const findAdminTopbar = () => document.querySelector(".app:not(.personal-app) .topbar");
const TAB_BY_LABEL = { Semaine: "week", Heures: "hours", Réglages: "config" };
const findTab = labelOrView => {
  const view = TAB_BY_LABEL[labelOrView] || labelOrView;
  return document.querySelector(`.app:not(.personal-app) .topbar>.tabs .tab[data-view="${view}"]`)
    || [...document.querySelectorAll(".app:not(.personal-app) .topbar>.tabs .tab")]
      .find(button => button.textContent.includes(labelOrView));
};
const findMonthButton = topbar => topbar?.querySelector(".month-title-btn");

const gearSvg = `
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.2a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.6a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.2a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.2a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.6a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.2a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z"></path>
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"></path>
  </svg>`;
const printSvg = `
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 8V3h10v5M7 17H5a3 3 0 0 1 0-6h14a3 3 0 0 1 0 6h-2M7 14h10v7H7v-7Z"></path>
  </svg>`;

const relabelButton = (button, from, to, icon) => {
  if (!button?.textContent.includes(from)) return;
  button.innerHTML = `${icon || button.querySelector(".icon")?.outerHTML || ""}<span>${to}</span>`;
};

const refreshLabels = topbar => {
  const muted = topbar.querySelector(".title-row .muted");
  if (muted?.textContent.includes("connexion Google disponible")) {
    muted.textContent = muted.textContent.replace("connexion Google disponible", "connexion disponible");
  }
  topbar.querySelectorAll(".action-row .btn").forEach(button => {
    relabelButton(button, "Vue propre", "Imprimer", printSvg);
    relabelButton(button, "A4 paysage", "Imprimer", printSvg);
    relabelButton(button, "Connexion Google", "Connexion");
  });
};

const ensureGearButton = topbar => {
  let button = topbar.querySelector(":scope > .settings-gear-btn") || topbar.querySelector(".action-row .settings-gear-btn");
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "btn icon-only settings-gear-btn has-tooltip";
    button.title = "Réglages / Settings";
    button.setAttribute("aria-label", "Réglages");
    button.dataset.tooltip = "Réglages / Settings";
    button.dataset.action = "view-config";
    button.dataset.view = "config";
    button.innerHTML = gearSvg;
    button.addEventListener("click", () => findTab("config")?.click());
  }
  if (button.parentElement !== topbar) topbar.insertBefore(button, topbar.firstChild);
  button.classList.toggle("active", !!findTab("config")?.classList.contains("active"));
};

const refreshTopbarSettingsNav = () => {
  const topbar = findAdminTopbar();
  if (!topbar) return;
  topbar.classList.add("topbar-gear-ready");
  findTab("week")?.classList.add("topbar-hidden-tab");
  findTab("hours")?.classList.add("topbar-hidden-tab");
  findTab("config")?.classList.add("topbar-hidden-tab");
  if (findTab("week")?.classList.contains("active")) findMonthButton(topbar)?.click();
  refreshLabels(topbar);
  ensureGearButton(topbar);
};

export function initTopbarSettingsNav() {
  if (!document.getElementById("topbar-settings-nav-style")) {
    const style = document.createElement("style");
    style.id = "topbar-settings-nav-style";
    style.textContent = `
      .topbar-hidden-tab{display:none!important}
      .topbar-gear-ready{position:sticky}
      .topbar-gear-ready>.title-row{padding-right:44px}
      .topbar-gear-ready>.tabs{display:none}
      .topbar-gear-ready>.settings-gear-btn{
        position:absolute;
        top:10px;
        right:10px;
        z-index:8;
        width:34px;
        height:34px;
        padding:0!important;
        border-radius:50%!important;
        background:rgba(255,255,255,.97)!important;
        color:#6f8fa1!important;
        border-color:rgba(255,255,255,.98)!important;
        box-shadow:inset 0 1px 0 rgba(255,255,255,1),0 8px 18px rgba(102,122,142,.16)!important;
      }
      .settings-gear-btn .icon{width:18px;height:18px}
      .month-title-btn,
      .month-title-btn.active{
        min-width:0!important;
        width:clamp(132px,28vw,230px)!important;
        max-width:100%!important;
        border-radius:999px!important;
        background:rgba(255,255,255,.97)!important;
        color:#344753!important;
        border-color:rgba(255,255,255,.98)!important;
        box-shadow:inset 0 1px 0 rgba(255,255,255,1),0 7px 18px rgba(102,122,142,.10)!important;
      }
      .month-title-btn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      @media (max-width:560px) and (orientation:portrait){
        .app:not(.personal-app) .topbar .action-row{grid-template-columns:repeat(5,minmax(0,1fr))}
        .topbar-gear-ready>.title-row{padding-right:38px}
        .topbar-gear-ready>.settings-gear-btn{width:30px;height:30px;top:8px;right:8px}
        .month-title-btn,.month-title-btn.active{width:clamp(128px,54vw,210px)!important}
      }
    `;
    document.head.appendChild(style);
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      refreshTopbarSettingsNav();
      scheduled = false;
    }, 0);
  });
  refreshTopbarSettingsNav();
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
}
