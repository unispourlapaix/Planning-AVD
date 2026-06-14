const parseHour = value => Number(String(value || "0").replace(",", ".")) || 0;
const formatHour = value => Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);

const capTotalText = text => String(text || "").replace(
  /(\d+(?:[.,]\d+)?)h\s*\/\s*(\d+(?:[.,]\d+)?)h/g,
  (match, total, quota) => {
    const shown = Math.min(parseHour(total), parseHour(quota));
    return `${formatHour(shown)}h / ${quota}h`;
  },
);

const cleanNode = node => {
  const text = node.textContent || "";
  if (/En pause\s*:\s*-/.test(text)) {
    node.textContent = text.replace(/En pause\s*:\s*-\d+(?:[.,]\d+)?h/g, "En pause : 0h");
    return;
  }
  const capped = capTotalText(text);
  if (capped !== text) node.textContent = capped;
};

const cleanPersonalView = root => {
  root.querySelectorAll(".personal-summary > b").forEach(node => node.remove());
  root.querySelectorAll(".personal-slot span:last-child").forEach(node => {
    node.textContent = String(node.textContent || "").replace(/\s*[·-]\s*\d+(?:[.,]\d+)?h/g, "");
  });
};

const cleanAdminHours = root => {
  root.querySelectorAll(".summary .muted, .hours-grid .title-row b:last-child, .hours-grid .summary span").forEach(cleanNode);
};

export function initPrivateDisplay() {
  const refresh = () => {
    cleanPersonalView(document);
    cleanAdminHours(document);
  };
  refresh();
  new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true, characterData: true });
}
