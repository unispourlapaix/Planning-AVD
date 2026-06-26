import { MONTHS } from "./constants.js";
import { mealWeekForDate } from "./meal-planning.js";
import { addShoppingItem, setShoppingChecked, shoppingItems, shoppingListText, subscribeShopping } from "./meal-shopping.js";

const STYLE_ID = "planning-avd-meal-banner-style";
const BAR_ID = "planning-avd-meal-banner";
const MODAL_ID = "planning-avd-meal-modal";

const addStyle = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .meal-tag{display:none!important}
    #${BAR_ID}{display:flex;align-items:center;justify-content:center;gap:10px;min-height:38px;margin-top:7px;padding:5px 9px;border:1px solid rgba(176,218,196,.78);border-radius:8px;background:rgba(246,253,249,.92)}
    #${BAR_ID} .meal-banner-title{color:#39735b;font-size:12px;font-weight:900;white-space:nowrap}
    #${BAR_ID} .meal-banner-days{display:flex;align-items:center;gap:5px}
    #${BAR_ID} button{width:27px;height:27px;padding:0;border:1px solid rgba(104,196,154,.42);border-radius:50%;background:#fff;color:#39735b;font-size:11px;font-weight:900}
    #${BAR_ID} button.active{background:#68a887;border-color:#68a887;color:#fff}
    #${BAR_ID} .meal-banner-task{width:auto;min-width:72px;padding:0 10px;border-radius:999px;background:rgba(235,245,255,.96);border-color:rgba(123,175,212,.5);color:#2c6f9e}
    #${BAR_ID} .meal-banner-task.active{background:#7bafd4;border-color:#7bafd4;color:#fff}
    #${MODAL_ID}{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:14px;background:rgba(34,51,60,.34);backdrop-filter:blur(4px)}
    #${MODAL_ID} .meal-modal-card{width:min(900px,100%);max-height:92vh;overflow:auto;padding:16px;border:1px solid rgba(180,211,201,.94);border-radius:8px;background:rgba(255,255,255,.98);box-shadow:0 20px 60px rgba(30,62,52,.22)}
    #${MODAL_ID} .meal-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    #${MODAL_ID} h3,#${MODAL_ID} h4{margin:0 0 8px}
    #${MODAL_ID} .meal-modal-close{width:32px;height:32px;border:1px solid #d8e5df;border-radius:50%;background:#fff;font-size:20px}
    #${MODAL_ID} .meal-modal-tabs{display:flex;gap:5px;margin:12px 0;overflow-x:auto}
    #${MODAL_ID} .meal-modal-tabs button{min-width:54px;padding:7px;border:1px solid #cfe2d8;border-radius:7px;background:#f8fcfa;color:#39735b;font-weight:800}
    #${MODAL_ID} .meal-modal-tabs button.active{background:#68a887;color:#fff}
    #${MODAL_ID} .meal-modal-grid{display:grid;grid-template-columns:minmax(260px,.85fr) minmax(340px,1.15fr);gap:16px}
    #${MODAL_ID} ul,#${MODAL_ID} ol{margin:6px 0 14px;padding-left:20px}
    #${MODAL_ID} li{margin:4px 0}
    #${MODAL_ID} .shopping-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
    #${MODAL_ID} .meal-copy{padding:7px 9px;border:1px solid #b8d8c8;border-radius:7px;background:#eef8f2;color:#39735b;font-weight:800}
    #${MODAL_ID} .shopping-progress{margin:0 0 10px;color:#697981;font-size:11px;font-weight:800}
    #${MODAL_ID} .shopping-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    #${MODAL_ID} .shopping-group{padding:8px;border-radius:7px;background:#f3faf6}
    #${MODAL_ID} .shopping-check{display:grid;grid-template-columns:18px minmax(0,1fr);gap:7px;align-items:start;margin:5px 0;color:#465b51;font-size:12px;font-weight:700;cursor:pointer}
    #${MODAL_ID} .shopping-check input{width:17px;height:17px;margin:0;accent-color:#68a887}
    #${MODAL_ID} .shopping-check.checked span{text-decoration:line-through;color:#8b9791}
    #${MODAL_ID} .shopping-add{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;margin-top:10px}
    #${MODAL_ID} .shopping-add input{min-width:0;padding:8px;border:1px solid #cfe2d8;border-radius:7px}
    #${MODAL_ID} .shopping-add button{padding:8px 10px;border:1px solid #68a887;border-radius:7px;background:#68a887;color:#fff;font-weight:900}
    @media(max-width:620px){
      #${BAR_ID}{justify-content:flex-start;overflow-x:auto}
      #${MODAL_ID} .meal-modal-grid,#${MODAL_ID} .shopping-groups{grid-template-columns:1fr}
    }
    @media print{#${BAR_ID},#${MODAL_ID}{display:none!important}}
  `;
  document.head.appendChild(style);
};

const visibleMonth = () => {
  const title = document.querySelector(".month-title-btn")?.textContent || "";
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

const firebaseContext = () => {
  if (!globalThis.firebase?.apps?.length) return { db: null, user: null };
  return { db: firebase.firestore(), user: firebase.auth().currentUser };
};

const beneficiaryContext = () => {
  const state = globalThis.__planningAvdCurrentState || {};
  return {
    beneficiaryId: String(state.beneficiaryId || "").trim(),
    beneficiaryName: String(state.beneficiaryName || "").trim(),
  };
};

const openMealModal = (week, initialIndex) => {
  document.getElementById(MODAL_ID)?.remove();
  const beneficiary = beneficiaryContext();
  let selectedIndex = initialIndex;
  let shoppingState = { checked: {}, customItems: [] };
  let unsubscribe = () => {};
  const overlay = document.createElement("div");
  overlay.id = MODAL_ID;
  const card = document.createElement("section");
  card.className = "meal-modal-card";
  overlay.appendChild(card);

  const close = () => {
    unsubscribe();
    overlay.remove();
  };
  overlay.addEventListener("click", event => {
    if (event.target === overlay) close();
  });

  const render = () => {
    const meal = week[selectedIndex];
    const items = shoppingItems(week, shoppingState);
    const checkedCount = items.filter(item => item.checked).length;
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
    ingredientsTitle.textContent = "Ingredients";
    recipe.append(recipeTitle, ingredientsTitle);
    appendList(recipe, "ul", meal.ingredients);
    const stepsTitle = document.createElement("h4");
    stepsTitle.textContent = "Recette";
    recipe.appendChild(stepsTitle);
    appendList(recipe, "ol", meal.steps);

    const shopping = document.createElement("aside");
    const shoppingHead = document.createElement("div");
    shoppingHead.className = "shopping-head";
    const shoppingTitle = document.createElement("h3");
    shoppingTitle.textContent = "Courses";
    const copy = document.createElement("button");
    copy.className = "meal-copy";
    copy.type = "button";
    copy.textContent = "Copier";
    copy.addEventListener("click", async () => {
      await navigator.clipboard?.writeText(shoppingListText(week, shoppingState));
      copy.textContent = "Copiee";
    });
    shoppingHead.append(shoppingTitle, copy);
    const progress = document.createElement("div");
    progress.className = "shopping-progress";
    progress.textContent = `${checkedCount} article(s) deja pris sur ${items.length}`;
    shopping.append(shoppingHead, progress);

    const groups = document.createElement("div");
    groups.className = "shopping-groups";
    [...new Set(items.map(item => item.category))].forEach(category => {
      const section = document.createElement("section");
      section.className = "shopping-group";
      const groupTitle = document.createElement("h4");
      groupTitle.textContent = category;
      section.appendChild(groupTitle);
      items.filter(item => item.category === category).forEach(item => {
        const label = document.createElement("label");
        label.className = `shopping-check${item.checked ? " checked" : ""}`;
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = item.checked;
        checkbox.addEventListener("change", async () => {
          shoppingState = {
            ...shoppingState,
            checked: { ...shoppingState.checked, [item.id]: checkbox.checked },
          };
          render();
          const { db, user } = firebaseContext();
          try {
            await setShoppingChecked({ db, user, beneficiaryId: beneficiary.beneficiaryId, week, itemId: item.id, checked: checkbox.checked });
          } catch (error) {
            alert(`Mise a jour impossible : ${error.message}`);
          }
        });
        const text = document.createElement("span");
        text.textContent = item.text;
        label.append(checkbox, text);
        section.appendChild(label);
      });
      groups.appendChild(section);
    });
    shopping.appendChild(groups);

    const addForm = document.createElement("form");
    addForm.className = "shopping-add";
    const input = document.createElement("input");
    input.maxLength = 120;
    input.placeholder = "Ajouter un article...";
    const addButton = document.createElement("button");
    addButton.type = "submit";
    addButton.textContent = "Ajouter";
    addForm.append(input, addButton);
    addForm.addEventListener("submit", async event => {
      event.preventDefault();
      const { db, user } = firebaseContext();
      try {
        shoppingState = await addShoppingItem({ db, user, beneficiaryId: beneficiary.beneficiaryId, week, text: input.value });
        render();
      } catch (error) {
        alert(`Ajout impossible : ${error.message}`);
      }
    });
    shopping.appendChild(addForm);

    grid.append(recipe, shopping);
    card.append(head, tabs, grid);
  };

  document.body.appendChild(overlay);
  const { db, user } = firebaseContext();
  unsubscribe = subscribeShopping({
    db,
    user,
    beneficiaryId: beneficiary.beneficiaryId,
    week,
    onChange: state => {
      shoppingState = state;
      render();
    },
    onError: error => console.warn("Liste de courses cloud indisponible.", error),
  });
};

const renderBanner = () => {
  const topbar = document.querySelector(".app > .topbar, .personal-app > .topbar");
  const period = visibleMonth();
  const app = document.querySelector(".app, .personal-app");
  if (!topbar || !period || !app) {
    document.getElementById(BAR_ID)?.remove();
    return;
  }
  const today = new Date();
  const beneficiary = beneficiaryContext();
  const currentMonth = today.getFullYear() === period.year && today.getMonth() === period.month;
  const week = mealWeekForDate(period.year, period.month, currentMonth ? today.getDate() : 1);
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const signature = `${beneficiary.beneficiaryId || "local"}-${period.year}-${period.month}-${week[0].dateKey}`;
  let bar = document.getElementById(BAR_ID);
  if (bar?.dataset.signature === signature) {
    if (bar.previousElementSibling !== topbar) topbar.insertAdjacentElement("afterend", bar);
    bar.querySelector(".meal-banner-task")?.classList.toggle("active", app.classList.contains("life-view"));
    return;
  }
  if (!bar) {
    bar = document.createElement("section");
    bar.id = BAR_ID;
  }
  bar.dataset.signature = signature;
  topbar.insertAdjacentElement("afterend", bar);
  bar.replaceChildren();
  const title = document.createElement("div");
  title.className = "meal-banner-title";
  title.textContent = "Repas / Taches";
  const taskButton = document.createElement("button");
  taskButton.type = "button";
  taskButton.className = `meal-banner-task${app.classList.contains("life-view") ? " active" : ""}`;
  taskButton.textContent = "Taches";
  taskButton.title = "Ouvrir les taches et les repas";
  taskButton.addEventListener("click", () => {
    window.dispatchEvent(new Event("planning-avd-open-life"));
  });
  const days = document.createElement("div");
  days.className = "meal-banner-days";
  week.forEach((meal, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = meal.dateKey === todayKey ? "active" : "";
    button.textContent = String(index + 1);
    button.title = `${meal.dayName} : ${meal.title}`;
    button.addEventListener("click", () => openMealModal(week, index));
    days.appendChild(button);
  });
  bar.append(title, taskButton, days);
};

export function initMealBanner() {
  addStyle();
  let timer = 0;
  const refresh = () => {
    clearTimeout(timer);
    timer = window.setTimeout(renderBanner, 40);
  };
  new MutationObserver(refresh).observe(document.getElementById("root"), { childList: true, subtree: true, characterData: true, attributes: true });
  refresh();
}
