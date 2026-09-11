export const AUXILIARY_WELCOME_TITLE = "Bienvenue dans mon équipe !";

export const AUXILIARY_WELCOME_INTRO = [
  "Si je choisis aujourd'hui de vous embaucher directement en CESU plutôt que de passer par une agence prestataire, c'est pour concrétiser un projet qui me tient particulièrement à cœur : mon projet de vie autonome.",
  "Je tiens à vous expliquer que mon objectif n'est pas d'être pris en charge, mais de garder le contrôle de ma vie. Mon message clé est le suivant :",
];

export const AUXILIARY_WELCOME_QUOTE = "Mon objectif est de vivre à mon domicile, de choisir mes horaires, mes sorties et mes activités. Vous êtes mes bras et mes jambes, mais c'est moi qui décide.";

export const AUXILIARY_WELCOME_CONTEXT = [
  "Notre collaboration repose sur le principe de l'autodétermination. C'est une philosophie essentielle ici : vous devez comprendre que vous vous adaptez à mon rythme, et non l'inverse, contrairement au fonctionnement rigide d'une structure ou d'une agence de services.",
  "Mon domicile n'est pas seulement un lieu de soins, c'est mon espace de vie, et j'en reste le seul maître à bord.",
  "Pour que notre quotidien se passe au mieux, il est important de valoriser votre fonction en évitant les termes trop médicaux qui ne correspondent pas à notre réalité, et en insistant sur la dimension humaine de votre métier.",
];

export const AUXILIARY_WELCOME_PILLARS = [
  {
    title: "1. L'aide technique",
    text: "M'accompagner avec professionnalisme dans les gestes du quotidien : levers, couchers, repas et soins de confort, en exécutant les tâches physiques que je ne peux pas accomplir seul, conformément à mes instructions.",
  },
  {
    title: "2. La complicité sociale",
    text: "Être le facilitateur de ma vie sociale en m'accompagnant lors de mes sorties, de mes loisirs, de mes rendez-vous ou de mes activités professionnelles.",
  },
  {
    title: "3. La posture professionnelle",
    text: "Faire preuve d'une discrétion absolue pour respecter mon intimité, être ponctuel pour le bon fonctionnement de toute l'équipe, et travailler dans la confiance mutuelle.",
  },
];

export const AUXILIARY_WELCOME_CLOSE = "En rejoignant cette équipe, vous devenez un acteur clé de ma liberté. Merci pour votre engagement à mes côtés, et bienvenue dans mon projet de vie !";

export const AUXILIARY_JOB_TITLE = "Fiche de poste : Assistant(e) de vie d'un particulier employeur";
export const AUXILIARY_JOB_DEFAULT_WORKPLACE = "Domicile principal du bénéficiaire et déplacements extérieurs";
export const AUXILIARY_JOB_OBJECTIVE_TITLE = "Objectif général du poste";
export const AUXILIARY_JOB_OBJECTIVE_TEXT = "Accompagner l'employeur dans l'expression de son autonomie, en exécutant les tâches physiques qu'il ne peut pas accomplir seul, conformément à ses instructions directes et à son projet de vie.";

export const AUXILIARY_JOB_SECTIONS = [
  {
    title: "1. Missions principales",
    groups: [
      {
        title: "Aide à la personne et actes quotidiens",
        items: [
          "Assister lors des transferts : lever, coucher et transferts fauteuil, dans le respect des règles de sécurité et d'ergonomie.",
          "Aider à la toilette, à l'habillage et aux soins d'hygiène et de confort non médicaux.",
          "Accompagner l'aide à la prise des traitements prescrits, selon l'ordonnance et la préparation médicale.",
        ],
      },
      {
        title: "Intendance et vie quotidienne",
        items: [
          "Préparer les repas selon mes goûts, mes consignes et mes exigences diététiques.",
          "Assurer l'entretien courant du logement : espace de vie, vaisselle et gestion du linge.",
          "Réaliser les courses et les démarches du quotidien.",
        ],
      },
      {
        title: "Vie sociale et déplacements",
        items: [
          "Accompagner les sorties culturelles, les loisirs, les rendez-vous médicaux ou professionnels.",
          "Conduire mon véhicule adapté si cette mission est prévue au contrat et assurée.",
        ],
      },
    ],
  },
  {
    title: "2. Posture professionnelle et règles d'or",
    groups: [
      {
        title: "Écoute et adaptabilité",
        items: [
          "Exécuter les tâches selon mes directives, même si vous avez l'habitude de procéder autrement avec d'autres personnes. C'est le principe du gré à gré.",
        ],
      },
      {
        title: "Discrétion et confidentialité",
        items: [
          "Respecter strictement ma vie privée, mes conversations et l'intimité de mon domicile. Ce qui se passe à la maison reste à la maison.",
        ],
      },
      {
        title: "Fiabilité et communication",
        items: [
          "Respecter scrupuleusement les horaires, car l'équipe dépend de votre ponctualité pour les relèves.",
          "Prévenir immédiatement le bénéficiaire et l'équipe en cas d'absence, même justifiée, et autant que possible à l'avance. Tout abandon de poste met en danger une personne dépendante et peut créer une situation de maltraitance grave.",
          "Remplir le cahier de liaison ou l'outil de transmission pour que vos collègues aient les informations importantes pour la suite de la journée.",
        ],
      },
    ],
  },
];

export function buildAuxiliaryJobMeta({ beneficiaryName = "", workplace = "" } = {}) {
  return [
    { label: "Intitulé du poste", text: "Assistant / Auxiliaire de vie à domicile en emploi direct" },
    { label: "Nom de l'employeur", text: String(beneficiaryName || "").trim() || "Bénéficiaire concerné" },
    { label: "Lieu de travail", text: String(workplace || "").trim() || AUXILIARY_JOB_DEFAULT_WORKPLACE },
  ];
}

export function buildAuxiliaryWelcomeEmailText({ beneficiaryName = "" } = {}) {
  const beneficiaryLine = beneficiaryName ? [`Bénéficiaire : ${beneficiaryName}`, ""] : [];
  const pillars = AUXILIARY_WELCOME_PILLARS.flatMap(item => [
    `${item.title} :`,
    item.text,
    "",
  ]);
  return [
    AUXILIARY_WELCOME_TITLE,
    "",
    ...beneficiaryLine,
    ...AUXILIARY_WELCOME_INTRO,
    "",
    `"${AUXILIARY_WELCOME_QUOTE}"`,
    "",
    ...AUXILIARY_WELCOME_CONTEXT,
    "",
    "Votre rôle d'Assistant de vie se découpe en trois piliers fondamentaux :",
    "",
    ...pillars,
    AUXILIARY_WELCOME_CLOSE,
  ].join("\n");
}

export function buildAuxiliaryJobPostEmailText({ beneficiaryName = "", workplace = "" } = {}) {
  const meta = buildAuxiliaryJobMeta({ beneficiaryName, workplace })
    .flatMap(item => [`${item.label} : ${item.text}`]);
  const sections = AUXILIARY_JOB_SECTIONS.flatMap(section => [
    section.title,
    "",
    ...section.groups.flatMap(group => [
      `${group.title} :`,
      ...group.items.map(item => `- ${item}`),
      "",
    ]),
  ]);
  return [
    AUXILIARY_JOB_TITLE,
    "",
    ...meta,
    "",
    AUXILIARY_JOB_OBJECTIVE_TITLE,
    AUXILIARY_JOB_OBJECTIVE_TEXT,
    "",
    ...sections,
  ].join("\n").trim();
}
