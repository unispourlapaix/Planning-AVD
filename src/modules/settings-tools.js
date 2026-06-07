const TOOL_LABELS = ["Heures", "Rapport", "Sauvegarde", "Restaurer"];

const findSourceButton = label => [...document.querySelectorAll(".app:not(.personal-app) .topbar .action-row .btn, .app:not(.personal-app) .topbar>.tabs .tab")]
  .find(button => button.textContent.includes(label));

const buildPanel = () => {
  const panel = document.createElement("section");
  panel.id = "settings-tools-panel";
  panel.className = "panel settings-tools";
  panel.innerHTML = `
    <div>
      <h3>Données et rapport</h3>
      <div class="muted">Consulter les heures, imprimer le rapport ou transférer une sauvegarde complète.</div>
    </div>
    <div class="settings-actions"></div>
  `;
  return panel;
};

const refreshSettingsTools = () => {
  const config = document.querySelector(".app:not(.personal-app) .rotation-options")?.closest(".layout");
  const sources = TOOL_LABELS.map(label => findSourceButton(label)).filter(Boolean);
  sources.forEach(button => button.classList.add("settings-tool-source"));

  if (!config) {
    document.getElementById("settings-tools-panel")?.remove();
    return;
  }

  const panel = document.getElementById("settings-tools-panel") || buildPanel();
  if (!panel.isConnected) config.prepend(panel);
  const actions = panel.querySelector(".settings-actions");
  TOOL_LABELS.forEach(label => {
    const source = findSourceButton(label);
    let button = actions.querySelector(`[data-settings-tool="${label}"]`);
    if (!source) {
      button?.remove();
      return;
    }
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "btn";
      button.dataset.settingsTool = label;
      button.addEventListener("click", () => findSourceButton(label)?.click());
      actions.appendChild(button);
    }
    button.textContent = source.textContent;
  });
};

export function initSettingsTools() {
  if (!document.getElementById("settings-tools-style")) {
    const style = document.createElement("style");
    style.id = "settings-tools-style";
    style.textContent = `
      .settings-tool-source{display:none!important}
      .settings-tools{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .settings-tools h3{margin:0 0 4px}
      .settings-actions{display:flex;flex-wrap:wrap;gap:5px}
      @media (max-width:560px){
        .settings-tools{display:grid}
        .settings-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
        .settings-actions .btn{min-width:0;padding:7px 3px;font-size:11px}
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
      refreshSettingsTools();
      observer.observe(document.body, { childList: true, subtree: true });
      scheduled = false;
    }, 0);
  });
  refreshSettingsTools();
  observer.observe(document.body, { childList: true, subtree: true });
}
