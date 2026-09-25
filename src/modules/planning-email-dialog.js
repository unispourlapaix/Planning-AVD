import { buildPersonalPlanningEmail, buildPlanningEml, buildSelectedPlanningEmails } from "./personal-planning-email.js";
import { gmailComposeUrl } from "./gmail-compose.js";

export function openPlanningEmailDialog(options) {
  document.getElementById("planning-email-dialog")?.remove();
  const recipients = options.auxiliaries.filter(aux => aux.active !== false && !aux.removedFromGroup && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(aux.email || "").trim()));
  if (!recipients.length) throw new Error("Renseignez un email complet dans la fiche de l'auxiliaire.");
  const dialog = document.createElement("dialog");
  dialog.id = "planning-email-dialog";
  dialog.className = "planning-email-dialog";
  dialog.setAttribute("aria-label", "Partager un planning personnel");
  dialog.innerHTML = `<form method="dialog"><header><h2>Partager un planning personnel</h2><button class="btn" aria-label="Fermer">Fermer</button></header></form>
    <fieldset class="email-recipients"><legend>Destinataires</legend><label><input type="checkbox" data-all> Toute l'équipe</label><div data-recipient-list></div><small data-count></small></fieldset>
    <div class="email-controls"><label>Aperçu du mail de<select data-recipient></select></label><label>Début de journée pour ces mails<input data-start type="time" required></label></div>
    <p>Début de journée : 8 h par défaut. Mise au lit : 20 h–22 h par défaut, sans pause. Les durées personnalisées restent prises en compte.</p>
    <div class="email-actions"><button class="btn" data-gmail>Préparer les mails sélectionnés</button><button class="btn" data-copy>Copier le mail affiché avec les couleurs</button><button class="btn" data-download>Télécharger le mail affiché (.eml)</button></div>
    <div data-drafts class="email-drafts"></div>
    <p data-status role="status" aria-live="polite">Choisissez l'heure de début pour afficher le mail.</p>
    <iframe title="Aperçu du mail personnel" sandbox="" hidden></iframe>`;
  const selector = dialog.querySelector("[data-recipient]");
  const selectedIds = new Set([recipients[0].id]);
  const all = dialog.querySelector("[data-all]");
  const recipientList = dialog.querySelector("[data-recipient-list]");
  for (const aux of recipients) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = aux.id;
    checkbox.checked = selectedIds.has(aux.id);
    label.append(checkbox, document.createTextNode(`${aux.name} · ${aux.email}`));
    recipientList.append(label);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedIds.add(aux.id); else selectedIds.delete(aux.id);
      updateSelection();
    });
  }
  const input = dialog.querySelector("[data-start]");
  input.value = "08:00";
  const status = dialog.querySelector("[data-status]");
  const frame = dialog.querySelector("iframe");
  const buttons = [...dialog.querySelectorAll(".email-actions button")];
  let draft = null;
  const selected = () => recipients.find(aux => aux.id === selector.value);
  const refresh = () => {
    dialog.querySelector("[data-drafts]").replaceChildren();
    draft = input.value && selected() ? buildPersonalPlanningEmail({ ...options, auxiliary: selected(), startTime: input.value }) : null;
    buttons.forEach(button => { button.disabled = !draft; });
    frame.hidden = !draft;
    frame.srcdoc = draft?.html || "";
    status.textContent = draft ? draft.summary : "Sélectionnez au moins un destinataire et une heure de début.";
  };
  const updateSelection = () => {
    const previous = selector.value;
    selector.replaceChildren();
    for (const aux of recipients.filter(aux => selectedIds.has(aux.id))) {
      const option = document.createElement("option");
      option.value = aux.id;
      option.textContent = `${aux.name} · ${aux.email}`;
      selector.append(option);
    }
    if (selectedIds.has(previous)) selector.value = previous;
    selector.disabled = selectedIds.size === 0;
    all.checked = selectedIds.size === recipients.length;
    all.indeterminate = selectedIds.size > 0 && !all.checked;
    recipientList.querySelectorAll("input").forEach(checkbox => { checkbox.checked = selectedIds.has(checkbox.value); });
    dialog.querySelector("[data-count]").textContent = `${selectedIds.size} destinataire(s) sélectionné(s) sur ${recipients.length}`;
    refresh();
  };
  all.addEventListener("change", () => {
    selectedIds.clear();
    if (all.checked) recipients.forEach(aux => selectedIds.add(aux.id));
    updateSelection();
  });
  selector.addEventListener("change", refresh);
  input.addEventListener("input", refresh);
  dialog.querySelector("[data-gmail]").addEventListener("click", () => {
    if (!draft) return;
    const drafts = buildSelectedPlanningEmails({ ...options, startTime: input.value }, selectedIds);
    const container = dialog.querySelector("[data-drafts]");
    container.replaceChildren();
    for (const mail of drafts) {
      const url = gmailComposeUrl(mail.auxiliary.email, mail.subject);
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = `Ouvrir le mail de ${mail.auxiliary.name}`;
      link.addEventListener("click", () => {
        selector.value = mail.auxiliary.id; draft = mail; frame.srcdoc = mail.html;
        status.textContent = `Gmail ouvert pour ${mail.auxiliary.name}. Copiez le mail affiché puis collez-le dans le corps du message avant de l'envoyer.`;
      });
      container.append(link);
      if (drafts.length === 1) window.open(url, "_blank", "noopener");
    }
    status.textContent = `${drafts.length} destinataire(s) prêt(s). Gmail ouvre seulement le destinataire et l'objet. Pour chacun, copiez le mail affiché puis collez-le dans Gmail avant l'envoi. Si aucune fenêtre ne s'ouvre, utilisez le lien. Aucun envoi automatique.`;
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
  updateSelection();
  dialog.showModal();
}
