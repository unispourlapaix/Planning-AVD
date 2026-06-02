const LABELS = {
  AM: "Matin",
  PM: "Après-midi",
  SR: "Soir",
};

const refreshLabels = () => {
  document.querySelectorAll(".slot-label").forEach(node => {
    const label = LABELS[node.textContent.trim()];
    if (label) node.textContent = label;
  });
};

export function initVisualShiftLabels() {
  if (!document.getElementById("visual-shift-labels-style")) {
    const style = document.createElement("style");
    style.id = "visual-shift-labels-style";
    style.textContent = `
      .slot{grid-template-columns:54px minmax(0,1fr)}
      .slot-label{font-size:7px;line-height:1.05;padding:3px 1px;letter-spacing:0}
      .personal-slot{grid-template-columns:54px minmax(0,1fr)}
    `;
    document.head.appendChild(style);
  }

  refreshLabels();
  new MutationObserver(refreshLabels).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}
