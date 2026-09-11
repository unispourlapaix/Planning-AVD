import {
  AUXILIARY_JOB_SECTIONS,
  AUXILIARY_WELCOME_PILLARS,
  AUXILIARY_WELCOME_QUOTE,
  buildAuxiliaryJobMeta,
  buildAuxiliaryJobPostEmailText,
  buildAuxiliaryWelcomeEmailText,
} from "../src/modules/auxiliary-welcome.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const text = buildAuxiliaryWelcomeEmailText({ beneficiaryName: "Payet Emmanuel" });
const jobText = buildAuxiliaryJobPostEmailText({ beneficiaryName: "Payet Emmanuel" });
const genericJobText = buildAuxiliaryJobPostEmailText();
const meta = buildAuxiliaryJobMeta({ beneficiaryName: "Payet Emmanuel" });

assert(text.includes("Bienvenue dans mon équipe !"), "Le titre d'accueil doit etre present");
assert(text.includes("Bénéficiaire : Payet Emmanuel"), "Le bénéficiaire doit etre indique dans le premier email");
assert(text.includes("garder le contrôle de ma vie"), "Le message cle doit etre corrige a la premiere personne");
assert(AUXILIARY_WELCOME_QUOTE.includes("c'est moi qui décide"), "La citation centrale doit etre conservee");
assert(AUXILIARY_WELCOME_PILLARS.length === 3, "Les trois piliers doivent etre conserves");
assert(!text.includes("&#x20;"), "Le mail ne doit pas contenir d'entite HTML parasite");
assert(!text.includes("*****"), "Le mail ne doit pas contenir d'ancien balisage Markdown casse");
assert(jobText.includes("Fiche de poste : Assistant(e) de vie d'un particulier employeur"), "La fiche de poste doit etre presente");
assert(jobText.includes("Nom de l'employeur : Payet Emmanuel"), "La fiche de poste doit utiliser le bénéficiaire actif");
assert(jobText.includes("Lieu de travail : Domicile principal du bénéficiaire et déplacements extérieurs"), "Le lieu de travail générique doit etre present");
assert(jobText.includes("Objectif général du poste"), "L'objectif général doit etre present");
assert(jobText.includes("Écoute et adaptabilité"), "Les regles professionnelles doivent etre presentes");
assert(AUXILIARY_JOB_SECTIONS.length === 2, "Les missions et les regles d'or doivent etre conservees");
assert(meta.some(item => item.label === "Nom de l'employeur" && item.text === "Payet Emmanuel"), "La meta employeur doit etre dynamique");
assert(!genericJobText.includes("Payet Emmanuel"), "La fiche ne doit pas figer un bénéficiaire dans le code");

console.log("Controle accueil auxiliaire OK: inscription et premier email");
