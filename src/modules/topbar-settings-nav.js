const findAdminTopbar = () => document.querySelector(".app:not(.personal-app) .topbar");
const findTab = label => [...document.querySelectorAll(".app:not(.personal-app) .topbar>.tabs .tab")]
  .find(button => button.textContent.includes(label));

const gearSvg = `
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.2a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.6a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.2a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.2a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.6a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.2a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z"></path>
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"></path>
  </svg>`;

const ensureGearButton = topbar => {
  const actionRow = topbar.querySelector(".action-row");
  if (!actionRow) return;
  let button = actionRow.querySelector(".settings-gear-btn");
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "btn icon-only settings-gear-btn";
    button.title = "Réglages";
    button.setAttribute("aria-label", "Réglages");
    button.innerHTML = gearSvg;
    button.addEventListener("click", () => findTab("Réglages")?.click());
    actionRow.appendChild(button);
  }
  button.classList.toggle("active", !!findTab("Réglages")?.classList.contains("active"));
};

const refreshTopbarSettingsNav = () => {
  const topbar = findAdminTopbar();
  if (!topbar) return;
  findTab("Heures")?.classList.add("topbar-hidden-tab");
  findTab("Réglages")?.classList.add("topbar-hidden-tab");
  ensureGearButton(topbar);
};

export function initTopbarSettingsNav() {
  if (!document.getElementById("topbar-settings-nav-style")) {
    const style = document.createElement("style");
    style.id = "topbar-settings-nav-style";
    style.textContent = `
      .topbar-hidden-tab{display:none!important}
      .settings-gear-btn{width:34px;height:34px;padding:0!important;border-radius:50%!important}
      .settings-gear-btn .icon{width:18px;height:18px}
      @media (max-width:560px) and (orientation:portrait){
        .app:not(.personal-app) .topbar .action-row{grid-template-columns:repeat(5,minmax(0,1fr))}
        .settings-gear-btn{width:auto;height:27px}
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
