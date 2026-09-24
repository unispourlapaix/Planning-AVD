import { buildPersonalPlanningEmail, buildPlanningEml } from "./personal-planning-email.js";

export function openPlanningEmailDialog(options) {
  document.getElementById("planning-email-dialog")?.remove();
  const recipients = options.auxiliaries.filter(aux => aux.active !== false && !aux.removedFromGroup && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(aux.email || "").trim()));
  if (!recipients.length) throw new Error("Renseignez un email complet dans la fiche de l'auxiliaire.");
  const dialog = document.createElement("dialog");
  dialog.id = "planning-email-dialog";
  dialog.className = "planning-email-dialog";
  dialog.setAttribute("aria-label", "Partager un planning personnel");
  dialog.innerHTML = `<form method="dialog"><header><h2>Partager un planning personnel</h2><button class="btn" aria-label="Fermer">Fermer</button></header></form>
    <div class="email-controls"><label>Auxiliaire<select data-recipient></select></label><label>Début de journée pour ce mail<input data-start type="time" required></label></div>
    <p>Les horaires suivants sont calculés selon les durées saisies au planning.</p>
    <div class="email-actions"><button class="btn" data-gmail>Préparer dans Gmail</button><button class="btn" data-copy>Copier le mail avec les couleurs</button><button class="btn" data-download>Télécharger le mail (.eml)</button></div>
    <p data-status role="status" aria-live="polite">Choisissez l'heure de début pour afficher le mail.</p>
    <iframe title="Aperçu du mail personnel" sandbox="" hidden></iframe>`;
  const selector = dialog.querySelector("[data-recipient]");
  for (const aux of recipients) {
    const option = document.createElement("option");
    option.value = aux.id;
    option.textContent = `${aux.name} · ${aux.email}`;
    selector.append(option);
  }
  const input = dialog.querySelector("[data-start]");
  const status = dialog.querySelector("[data-status]");
  const frame = dialog.querySelector("iframe");
  const buttons = [...dialog.querySelectorAll(".email-actions button")];
  let draft = null;
  const selected = () => recipients.find(aux => aux.id === selector.value);
  const refresh = () => {
    dialog.querySelector("[data-gmail-link]")?.remove();
    draft = input.value ? buildPersonalPlanningEmail({ ...options, auxiliary: selected(), startTime: input.value }) : null;
    buttons.forEach(button => { button.disabled = !draft; });
    frame.hidden = !draft;
    frame.srcdoc = draft?.html || "";
    status.textContent = draft ? draft.summary : "Choisissez l'heure de début pour afficher le mail.";
  };
  selector.addEventListener("change", refresh);
  input.addEventListener("input", refresh);
  dialog.querySelector("[data-gmail]").addEventListener("click", () => {
    if (!draft) return;
    const url = new URL("https://mail.google.com/mail/");
    for (const [key, value] of Object.entries({ view: "cm", fs: "1", to: selected().email.trim(), su: draft.subject, body: draft.text })) url.searchParams.set(key, value);
    window.open(url.href, "_blank", "noopener");
    status.textContent = "Brouillon texte demandé dans Gmail. Pour les couleurs, copiez le mail puis collez-le dans le corps du message. Aucun email envoyé automatiquement.";
    // A visible link also works when the browser silently blocks the popup.
    let link = dialog.querySelector("[data-gmail-link]");
    if (!link) { link = document.createElement("a"); link.dataset.gmailLink = ""; link.target = "_blank"; link.rel = "noopener"; status.after(link); }
    link.href = url.href;
    link.textContent = "Ouvrir le brouillon Gmail";
  });
  dialog.querySelector("[data-copy]").addEventListener("click", async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([draft.html], { type: "text/html" }), "text/plain": new Blob([draft.text], { type: "text/plain" }) })]);
      status.textContent = "Mail coloré copié. Collez-le dans le corps du mail destiné à cet auxiliaire.";
    } catch {
      status.textContent = "Copie avec couleurs indisponible dans ce navigateur. Téléchargez le fichier .eml pour conserver le calendrier coloré.";
    }
  });
  dialog.querySelector("[data-download]").addEventListener("click", () => {
    if (!draft) return;
    const blob = new Blob([buildPlanningEml({ ...draft, email: selected().email.trim() })], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `planning-${options.year}-${String(options.month + 1).padStart(2, "0")}.eml`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = "Mail téléchargé : ouvrez-le dans un logiciel compatible .eml. Aucun envoi automatique.";
  });
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  refresh();
  dialog.showModal();
}
