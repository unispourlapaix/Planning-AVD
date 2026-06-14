const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const RECIPES = {
  greenBeans: {
    title: "Salade de haricots verts",
    short: "Haricots verts",
    ingredients: ["600 g de haricots verts", "3 tomates", "4 oeufs", "1 echalote", "Vinaigrette maison"],
    steps: [
      "Cuire les haricots verts puis les refroidir.",
      "Ajouter tomates, oeufs durs et echalote.",
      "Assaisonner au dernier moment avec la vinaigrette.",
    ],
  },
  burgers: {
    title: "Hamburgers maison",
    short: "Burgers maison",
    ingredients: ["4 pains a hamburger", "4 steaks haches", "4 tranches de fromage", "Salade", "Tomates", "Oignon", "Sauce au choix"],
    steps: [
      "Cuire les steaks et faire legerement griller les pains.",
      "Monter les burgers avec fromage, salade, tomate et oignon.",
      "Servir avec une salade maison.",
    ],
  },
  tacos: {
    title: "Tacos et salade maison",
    short: "Tacos + salade",
    ingredients: ["8 tortillas", "500 g de viande hachee", "1 poivron", "1 oignon", "Epices tacos", "Salade", "Tomates", "Fromage rape"],
    steps: [
      "Faire revenir viande, oignon, poivron et epices.",
      "Garnir les tortillas et ajouter un peu de fromage.",
      "Servir avec une salade tomate maison.",
    ],
  },
  wraps: {
    title: "Wraps, salade et tenders",
    short: "Wraps + tenders",
    ingredients: ["8 wraps", "600 g de tenders", "Salade", "2 tomates", "1 concombre", "Sauce yaourt ou mayonnaise"],
    steps: [
      "Cuire les tenders jusqu'a ce qu'ils soient bien dores.",
      "Garnir les wraps de salade, tomate, concombre et tenders.",
      "Ajouter la sauce puis rouler fermement.",
    ],
  },
  pizza: {
    title: "Pizza maison et salade",
    short: "Pizza maison",
    ingredients: ["1 grande pate a pizza", "300 g de sauce tomate", "250 g de mozzarella", "Garniture au choix", "Salade"],
    steps: [
      "Etaler la pate et repartir la sauce tomate.",
      "Ajouter mozzarella et garniture.",
      "Cuire environ 15 minutes a 220 C et servir avec la salade.",
    ],
  },
  riceMeat: {
    title: "Riz et viande cuisinee",
    short: "Riz + viande",
    ingredients: ["400 g de riz", "600 g de viande a mijoter", "2 carottes", "1 oignon", "1 gousse d'ail", "Bouillon", "Herbes et epices"],
    steps: [
      "Faire dorer la viande avec oignon et ail.",
      "Ajouter carottes, bouillon et assaisonnement puis laisser mijoter.",
      "Cuire le riz separement et servir avec la viande et sa sauce.",
    ],
  },
};

const ROTATION = [
  RECIPES.greenBeans,
  RECIPES.burgers,
  RECIPES.tacos,
  RECIPES.wraps,
  RECIPES.pizza,
  RECIPES.riceMeat,
  RECIPES.greenBeans,
];

export const WEEKLY_SHOPPING = [
  { category: "Fruits et legumes", items: ["Haricots verts 1,2 kg", "Salades vertes x4", "Tomates x10", "Oignons x5", "Echalotes x2", "Poivron x1", "Concombre x1", "Carottes x2", "Ail x1"] },
  { category: "Viandes", items: ["Steaks haches x4", "Viande hachee 500 g", "Tenders 600 g", "Viande a mijoter 600 g"] },
  { category: "Frais", items: ["Oeufs x8", "Fromage en tranches x4", "Fromage rape 200 g", "Mozzarella 250 g", "Yaourt ou mayonnaise"] },
  { category: "Pain et galettes", items: ["Pains a hamburger x4", "Tortillas x8", "Wraps x8", "Pate a pizza x1"] },
  { category: "Epicerie", items: ["Riz 400 g", "Sauce tomate 300 g", "Bouillon", "Epices tacos", "Vinaigrette", "Sauces et condiments"] },
];

const localDate = (year, month, day) => new Date(year, month, day, 12);
const mondayIndex = date => (date.getDay() + 6) % 7;

export const mealForDate = (year, month, day) => ROTATION[mondayIndex(localDate(year, month, day))];

export function mealWeekForDate(year, month, day) {
  const selected = localDate(year, month, day);
  const monday = new Date(selected);
  monday.setDate(selected.getDate() - mondayIndex(selected));
  return ROTATION.map((meal, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      ...meal,
      dayName: DAY_NAMES[index],
      day: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
      dateKey: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
    };
  });
}

export const shoppingListText = week => [
  `Courses - semaine du ${week[0].day}/${week[0].month + 1}/${week[0].year}`,
  "",
  ...WEEKLY_SHOPPING.flatMap(group => [group.category, ...group.items.map(item => `- ${item}`), ""]),
  "Quantites prevues pour environ 4 personnes.",
].join("\n");
