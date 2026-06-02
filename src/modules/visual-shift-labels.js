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

  const auxiliaryNames = Array.from(document.querySelectorAll(".summary .pill"))
    .map(node => node.textContent.split("·").pop().trim())
    .filter(Boolean);
  document.querySelectorAll(".slot-name").forEach(node => {
    const parts = node.textContent.split(" + ");
    if (parts.length < 2) return;
    const label = parts.map((part, index) => {
      if (index === 0 || part.trim().length !== 1) return part;
      const name = auxiliaryNames.find(item => item.toUpperCase().startsWith(part.trim().toUpperCase()));
      return name ? name.slice(0, 3) : part;
    }).join(" + ");
    if (node.textContent !== label) node.textContent = label;
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

  const options = {
    childList: true,
    subtree: true,
  };
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      observer.disconnect();
      refreshLabels();
      observer.observe(document.body, options);
      scheduled = false;
    }, 0);
  });

  refreshLabels();
  observer.observe(document.body, options);
}
