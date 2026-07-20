import { MONTHS } from "./constants.js";
import { dayName } from "./dates.js";
import { publishPersonalPlannings } from "./storage.js?v=20260702-login-refresh";
import { shiftDisplayLabel } from "./shift-labels.js?v=20260720-morning-ranges";

const SHARE_SHIFT_ORDER = ["morning", "afternoon", "night"];

const uniqueEmails = auxiliaries => [...new Set(auxiliaries
  .filter(aux => aux.active !== false)
  .map(aux => String(aux.email || "").trim().toLowerCase())
  .filter(Boolean))];

const buildGmailUrl = ({ sender, recipients, subject, body }) => {
  const url = new URL("https://mail.google.com/mail/");
  url.searchParams.set("view", "cm");
  url.searchParams.set("fs", "1");
  if (sender) url.searchParams.set("to", sender);
  url.searchParams.set("bcc", recipients.join(","));
  url.searchParams.set("su", subject);
  url.searchParams.set("body", body);
  return url.toString();
};

const shiftWorkers = entry => Array.isArray(entry?.workers)
  ? entry.workers.filter(Boolean)
  : entry?.worker
  ? [entry.worker]
  : [];

const workerNameMap = auxiliaries => new Map((auxiliaries || [])
  .map(aux => [aux.id, String(aux.name || "À définir").trim() || "À définir"]));

function buildSimplifiedPlanning({ year, month, auxiliaries, schedule }) {
  const names = workerNameMap(auxiliaries);
  const days = Object.values(schedule || {}).sort((a, b) => Number(a.day) - Number(b.day));
  if (!days.length) return "Planning simplifié indisponible.";
  return days.map(plan => {
    const shifts = SHARE_SHIFT_ORDER.map(shift => {
      const worker = shiftWorkers(plan?.[shift])[0];
      const label = shiftDisplayLabel({ shift, schedule, day: plan.day, worker });
      return `${label}: ${worker ? names.get(worker) || "À définir" : "Repos"}`;
    });
    return `${String(plan.day).padStart(2, "0")} ${dayName(year, month, plan.day)} : ${shifts.join(" | ")}`;
  }).join("\n");
}

export async function sharePlanningByEmail({ db, user, year, month, beneficiaryId = "", beneficiaryName = "", auxiliaries, schedule, hours, dayOutings = {} }) {
  if (!user?.uid) throw new Error("Connexion admin necessaire.");
  const recipients = uniqueEmails(auxiliaries);
  if (!recipients.length) throw new Error("Aucun email auxiliaire trouve. Ouvrez Reglages puis renseignez le champ Email des auxiliaires.");

  const appUrl = `${window.location.origin}${window.location.pathname}`;
  const beneficiaryLine = beneficiaryName ? `Bénéficiaire : ${beneficiaryName}` : "";
  const simplifiedPlanning = buildSimplifiedPlanning({ year, month, auxiliaries, schedule });
  const subject = `Votre planning Planning-AVD - ${MONTHS[month]} ${year}`;
  const body = [
    "Bonjour,",
    "",
    `Votre planning personnel pour ${MONTHS[month]} ${year} est disponible.`,
    beneficiaryLine,
    "",
    "Planning simplifié du mois :",
    simplifiedPlanning,
    "",
    "Ouvrez le lien ci-dessous puis connectez-vous avec votre adresse :",
    appUrl,
    "",
    "Votre planning reste personnel et visible uniquement apres connexion.",
  ].join("\n");
  const gmailUrl = buildGmailUrl({ sender: user.email, recipients, subject, body });
  const gmailTab = window.open("about:blank", "_blank");

  const count = await publishPersonalPlannings({ db, user, year, month, beneficiaryId, beneficiaryName, auxiliaries, schedule, hours, dayOutings });
  if (gmailTab) gmailTab.location.href = gmailUrl;
  else window.location.href = gmailUrl;
  return count;
}
