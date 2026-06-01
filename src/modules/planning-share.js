import { MONTHS } from "./constants.js";
import { publishPersonalPlannings } from "./storage.js";

const uniqueEmails = auxiliaries => [...new Set(auxiliaries
  .filter(aux => aux.active)
  .map(aux => String(aux.email || "").trim().toLowerCase())
  .filter(Boolean))];

const buildGmailUrl = ({ recipients, subject, body }) => {
  const url = new URL("https://mail.google.com/mail/");
  url.searchParams.set("view", "cm");
  url.searchParams.set("fs", "1");
  url.searchParams.set("bcc", recipients.join(","));
  url.searchParams.set("su", subject);
  url.searchParams.set("body", body);
  return url.toString();
};

export async function sharePlanningByEmail({ db, user, year, month, auxiliaries, schedule, hours }) {
  if (!user?.uid) throw new Error("Connexion admin necessaire.");
  const recipients = uniqueEmails(auxiliaries);
  if (!recipients.length) throw new Error("Ajoutez les emails des auxiliaires dans Reglages.");

  const count = await publishPersonalPlannings({ db, user, year, month, auxiliaries, schedule, hours });
  const appUrl = `${window.location.origin}${window.location.pathname}`;
  const subject = `Votre planning Planning-AVD - ${MONTHS[month]} ${year}`;
  const body = [
    "Bonjour,",
    "",
    `Votre planning personnel pour ${MONTHS[month]} ${year} est disponible.`,
    "Ouvrez le lien ci-dessous puis connectez-vous avec votre adresse Google :",
    appUrl,
    "",
    "Votre planning reste personnel et visible uniquement apres connexion.",
  ].join("\n");

  window.location.href = buildGmailUrl({ recipients, subject, body });
  return count;
}
