import { MONTHS } from "./constants.js";
import { publishPersonalPlannings } from "./storage.js?v=20260624-personal-fallback";

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

export async function sharePlanningByEmail({ db, user, year, month, auxiliaries, schedule, hours, dayOutings = {} }) {
  if (!user?.uid) throw new Error("Connexion admin necessaire.");
  const recipients = uniqueEmails(auxiliaries);
  if (!recipients.length) throw new Error("Aucun email auxiliaire trouve. Ouvrez Reglages puis renseignez le champ Email des auxiliaires.");

  const appUrl = `${window.location.origin}${window.location.pathname}`;
  const subject = `Votre planning Planning-AVD - ${MONTHS[month]} ${year}`;
  const body = [
    "Bonjour,",
    "",
    `Votre planning personnel pour ${MONTHS[month]} ${year} est disponible.`,
    "Ouvrez le lien ci-dessous puis connectez-vous avec votre adresse :",
    appUrl,
    "",
    "Votre planning reste personnel et visible uniquement apres connexion.",
  ].join("\n");
  const gmailUrl = buildGmailUrl({ sender: user.email, recipients, subject, body });
  const gmailTab = window.open("about:blank", "_blank");

  const count = await publishPersonalPlannings({ db, user, year, month, auxiliaries, schedule, hours, dayOutings });
  if (gmailTab) gmailTab.location.href = gmailUrl;
  else window.location.href = gmailUrl;
  return count;
}
