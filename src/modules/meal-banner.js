import { MONTHS } from "./constants.js";
import { mealWeekForDate, shoppingListText, WEEKLY_SHOPPING } from "./meal-planning.js";

const STYLE_ID = "planning-avd-meal-banner-style";
const BAR_ID = "planning-avd-meal-banner";
const MODAL_ID = "planning-avd-meal-modal";

const addStyle = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .meal-tag{display:none!important}
    #${BAR_ID}{display:flex;align-items:center;justify-content:center;gap:10px;min-height:38px;margin-top:7px;padding:5px 9px;border:1px solid rgba(176,218,196,.78);border-radius:8px;background:rgba(246,253,249,.92);box-shadow:inset 0 1px 0 #fff,0 5px 14px rgba(79,144,112,.09)}
    #${BAR_ID} .meal-banner-title{display:inline-flex;align-items:center;gap:6px;color:#39735b;font-size:12px;font-weight:900;white-space:nowrap}
    #${BAR_ID} .meal-banner-days{display:flex;align-items:center;gap:5px}
    #${BAR_ID} button{width:27px;height:27px;padding:0;border:1px solid rgba(104,196,154,.42);border-radius:50%;background:rgba(255,255,255,.96);color:#39735b;font-size:11px;font-weight:900;box-shadow:inset 0 1px 0 #fff}
    #${BAR_ID} button:hover,#${BAR_ID} button:focus-visible{outline:none;border-color:#4fae82;background:#eaf8f0;transform:translateY(-1px)}
    #${BAR_ID} button.active{background:#68a887;border-color:#68a887;color:#fff}
    #${MODAL_ID}{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:14px;background:rgba(34,51,60,.34);backdrop-filter:blur(4px)}
    #${MODAL_ID} .meal-modal-card{width:min(760px,100%);max-height:92vh;overflow:auto;padding:16px;border:1px solid rgba(180,211,201,.94);border-radius:8px;background:rgba(255,255,255,.98);box-shadow:0 20px 60px rgba(30,62,52,.22)}
    #${MODAL_ID} .meal-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    #${MODAL_ID} h3,#${MODAL_ID} h4{margin:0 0 8px}
    #${MODAL_ID} .meal-modal-close{width:32px;height:32px;border:1px solid #d8e5df;border-radius:50%;background:#fff;font-size:20px;line-height:1}
    #${MODAL_ID} .meal-modal-tabs{display:flex;gap:5px;margin:12px 0;overflow-x:auto}
    #${MODAL_ID} .meal-modal-tabs button{min-width:54px;padding:7px;border:1px solid #cfe2d8;border-radius:7px;background:#f8fcfa;color:#39735b;font-weight:800}
    #${MODAL_ID} .meal-modal-tabs button.active{background:#68a887;color:#fff}
    #${MODAL_ID} .meal-modal-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:16px}
    #${MODAL_ID} ul,#${MODAL_ID} ol{margin:6px 0 14px;padding-left:20px}
    #${MODAL_ID} li{margin:4px 0}
    #${MODAL_ID} .meal-copy{padding:8px 11px;border:1px solid #b8d8c8;border-radius:7px;background:#eef8f2;color:#39735b;font-weight:800}
    @media(max-width:620px){
      #${BAR_ID}{justify-content:flex-start;gap:7px;min-height:34px;margin-top:5px;padding:4px 6px;overflow-x:auto}
      #${BAR_ID} .meal-banner-title{font-size:10px}
      #${BAR_ID} .meal-banner-days{gap:4px}
      #${BAR_ID} button{width:25px;height:25px;flex:0 0 25px;font-size:10px}
      #${MODAL_ID} .meal-modal-grid{grid-template-columns:1fr}
    }
    @media print{#${BAR_ID},#${MODAL_ID}{display:none!important}}
  `;
  document.head.appendChild(style);
};

const visibleMonth = () => {
  const title = document.querySelector(".month-title-btn")?.textContent
    || document.querySelector(".personal-app .month-row h2")?.textContent
    || "";
  const match = title.trim().match(/(.+?)\s+(\d{4})$/);
  const month = MONTHS.findIndex(item => item.toLocaleLowerCase("fr") === match?.[1]?.trim().toLocaleLowerCase("fr"));
  return month >= 0 ? { month, year: Number(match[2]) } : null;
};

const appendList = (parent, tag, items) => {
  const list = document.createElement(tag);
  items.forEach(text => {
    const item = document.createElement("li");
    item.textContent = text;
    list.appendChild(item);
  });
  parent.appendChild(list);
};

const openMealModal = (week, initialIndex) => {
  document.getElementById(MODAL_ID)?.remove();
  let selectedIndex = initialIndex;
  const overlay = document.createElement("div");
  overlay.id = MODAL_ID;
  const card = document.createElement("section");
  card.className = "meal-modal-card";
  overlay.appendChild(card);

  const close = () => overlay.remove();
  overlay.addEventListener("click", event => {
    if (event.target === overlay) close();
  });

  const render = () => {
    const meal = week[selectedIndex];
    card.replaceChildren();

    const head = document.createElement("div");
    head.className = "meal-modal-head";
    const heading = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = "Repas et courses de la semaine";
    const subtitle = document.createElement("div");
    subtitle.className = "muted";
    subtitle.textContent = `${meal.dayName} ${meal.day}/${meal.month + 1}`;
    heading.append(title, subtitle);
    const closeButton = document.createElement("button");
    closeButton.className = "meal-modal-close";
    closeButton.type = "button";
    closeButton.title = "Fermer";
    closeButton.textContent = "x";
    closeButton.addEventListener("click", close);
    head.append(heading, closeButton);

    const tabs = document.createElement("div");
    tabs.className = "meal-modal-tabs";
    week.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = index === selectedIndex ? "active" : "";
      button.textContent = String(index + 1);
      button.title = `${item.dayName} : ${item.title}`;
      button.addEventListener("click", () => {
        selectedIndex = index;
        render();
      });
      tabs.appendChild(button);
    });

    const grid = document.createElement("div");
    grid.className = "meal-modal-grid";
    const recipe = document.createElement("article");
    const recipeTitle = document.createElement("h3");
    recipeTitle.textContent = meal.title;
    const ingredientsTitle = document.createElement("h4");
    ingredientsTitle.textContent = "Ingrédients";
    recipe.append(recipeTitle, ingredientsTitle);
    appendList(recipe, "ul", meal.ingredients);
    const stepsTitle = document.createElement("h4");
    stepsTitle.textContent = "Recette";
    recipe.appendChild(stepsTitle);
    appendList(recipe, "ol", meal.steps);

    const shopping = document.createElement("aside");
    const shoppingTitle = document.createElement("h3");
    shoppingTitle.textContent = "Courses";
    const copy = document.createElement("button");
    copy.className = "meal-copy";
    copy.type = "button";
    copy.textContent = "Copier la liste";
    copy.addEventListener("click", async () => {
      await navigator.clipboard?.writeText(shoppingListText(week));
      copy.textContent = "Liste copiée";
    });
    shopping.append(shoppingTitle, copy);
    WEEKLY_SHOPPING.forEach(group => {
      const groupTitle = document.createElement("h4");
      groupTitle.textContent = group.category;
      shopping.appendChild(groupTitle);
      appendList(shopping, "ul", group.items);
    });
    grid.append(recipe, shopping);
    card.append(head, tabs, grid);
  };

  render();
  document.body.appendChild(overlay);
};

const renderBanner = () => {
  const topbar = document.querySelector(".app > .topbar, .personal-app > .topbar");
  const period = visibleMonth();
  if (!topbar || !period) return;

  const today = new Date();
  const currentMonth = today.getFullYear() === period.year && today.getMonth() === period.month;
  const week = mealWeekForDate(period.year, period.month, currentMonth ? today.getDate() : 1);
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const signature = `${period.year}-${period.month}-${week[0].dateKey}`;
  let bar = document.getElementById(BAR_ID);
  if (bar?.dataset.signature === signature) {
    if (bar.previousElementSibling !== topbar) topbar.insertAdjacentElement("afterend", bar);
    return;
  }
  if (!bar) {
    bar = document.createElement("section");
    bar.id = BAR_ID;
    bar.setAttribute("aria-label", "Idées repas de la semaine");
  }
  bar.dataset.signature = signature;
  if (bar.previousElementSibling !== topbar) topbar.insertAdjacentElement("afterend", bar);
  bar.replaceChildren();

  const title = document.createElement("div");
  title.className = "meal-banner-title";
  title.textContent = "Idées repas";
  const days = document.createElement("div");
  days.className = "meal-banner-days";
  week.forEach((meal, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = meal.dateKey === todayKey ? "active" : "";
    button.textContent = String(index + 1);
    button.title = `${meal.dayName} : ${meal.title}`;
    button.setAttribute("aria-label", `Idée repas ${index + 1}, ${meal.dayName} : ${meal.title}`);
    button.addEventListener("click", () => openMealModal(week, index));
    days.appendChild(button);
  });
  bar.append(title, days);
};

export function initMealBanner() {
  addStyle();
  let timer = 0;
  const refresh = () => {
    clearTimeout(timer);
    timer = window.setTimeout(renderBanner, 40);
  };
  new MutationObserver(refresh).observe(document.getElementById("root"), { childList: true, subtree: true, characterData: true });
  refresh();
}
