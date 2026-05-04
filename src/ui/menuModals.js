import { findGuestById, getLocale, refs, state } from "../state.js";

const FRIDAY_DINNER_MENU_MODAL_ID = "friday-dinner-menu-modal";
const SATURDAY_BREAKFAST_MENU_MODAL_ID = "saturday-breakfast-menu-modal";
const SATURDAY_MENU_MODAL_ID = "saturday-menu-modal";
const SUNDAY_BREAKFAST_MENU_MODAL_ID = "sunday-breakfast-menu-modal";
const PRIVATE_DINNER_SURPRISE_MODAL_ID = "private-dinner-surprise-modal";

function getFridayDinnerMenuModal() {
  return document.getElementById(FRIDAY_DINNER_MENU_MODAL_ID);
}

function getMenuCoverTitle(label, fallback) {
  return (label || fallback || "").replace(/\s+/g, " ").replace(" ", "\n");
}

function ensureFridayDinnerMenuModal() {
  const locale = getLocale();
  const labels = locale.labels || {};
  const existingModal = getFridayDinnerMenuModal();
  if (existingModal) {
    const closeButton = existingModal.querySelector(".menu-modal__close-btn");
    const subtitle = existingModal.querySelector(".menu-modal__subtitle");
    const title = existingModal.querySelector(".menu-modal__title");
    const sectionTitles = existingModal.querySelectorAll(".menu-modal__block-title-text");
    const itemLabels = existingModal.querySelectorAll(".menu-modal__item-text");
    const coverArt = existingModal.querySelector(".menu-modal__cover-art");

    if (closeButton) closeButton.setAttribute("aria-label", labels.closeMenuBtn || "Cerrar menú");
    if (subtitle) subtitle.textContent = labels.fridayDinnerMenuSubtitle || "VIERNES · 21:30";
    if (title) title.textContent = labels.fridayDinnerMenuTitle || "Menú Pescaito";
    if (sectionTitles[0]) sectionTitles[0].textContent = labels.fridayDinnerMenuStarter || "Entrante";
    if (sectionTitles[1]) sectionTitles[1].textContent = labels.fridayDinnerMenuMain || "Plato principal";
    if (sectionTitles[2]) sectionTitles[2].textContent = labels.fridayDinnerMenuDessert || "Postre";
    if (sectionTitles[3]) sectionTitles[3].textContent = labels.fridayDinnerMenuDrinks || "Bebidas";
    if (itemLabels[0]) itemLabels[0].textContent = labels.fridayDinnerMenuStarter1 || "Ensalada caprese con mozzarella y albahaca fresca.";
    if (itemLabels[1]) itemLabels[1].textContent = labels.fridayDinnerMenuMain1 || "Noche de pescadito frito con limón y hierbas aromáticas.";
    if (itemLabels[2]) itemLabels[2].textContent = labels.fridayDinnerMenuDessert1 || "Postre de la casa";
    if (itemLabels[3]) itemLabels[3].textContent = labels.fridayDinnerMenuDrink1 || "Vino";
    if (itemLabels[4]) itemLabels[4].textContent = labels.fridayDinnerMenuDrink2 || "Cerveza";
    if (itemLabels[5]) itemLabels[5].textContent = labels.fridayDinnerMenuDrink3 || "Agua";
    if (itemLabels[6]) itemLabels[6].textContent = labels.fridayDinnerMenuDrink4 || "Refrescos";
    if (itemLabels[7]) itemLabels[7].textContent = labels.fridayDinnerMenuDrink5 || "Tinto de verano";
    if (itemLabels[8]) itemLabels[8].textContent = labels.fridayDinnerMenuDrink6 || "Vermut";
    if (coverArt) coverArt.setAttribute("data-cover-title", getMenuCoverTitle(labels.fridayDinnerMenuTitle, "Menú Pescaito"));
    return existingModal;
  }

  const modal = document.createElement("div");
  modal.id = FRIDAY_DINNER_MENU_MODAL_ID;
  modal.className = "menu-modal";
  modal.setAttribute("hidden", "");
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="menu-modal__backdrop" data-close-friday-dinner-menu="true"></div>
    <section class="menu-modal__dialog menu-modal__dialog--with-cover" role="dialog" aria-modal="true" aria-labelledby="friday-dinner-menu-title">
      <div class="menu-modal__cover" data-menu-cover aria-hidden="true">
        <div class="menu-modal__cover-art menu-modal__cover-art--friday" data-cover-title="${getMenuCoverTitle(labels.fridayDinnerMenuTitle, "Menú Pescaito")}" aria-hidden="true"></div>
      </div>
      <div class="menu-modal__scroll">
        <button class="menu-modal__close-btn" type="button" aria-label="${labels.closeMenuBtn || "Cerrar menú"}" data-close-friday-dinner-menu="true">×</button>
        <p class="menu-modal__subtitle">${labels.fridayDinnerMenuSubtitle || "VIERNES · 21:30"}</p>
        <h3 id="friday-dinner-menu-title" class="menu-modal__title">${labels.fridayDinnerMenuTitle || "Menú Pescaito"}</h3>
        <div class="menu-modal__content">
          <div class="menu-modal__blocks">
          <article class="menu-modal__block">
            <h4 class="menu-modal__block-title"><span aria-hidden="true">🥣</span> <span class="menu-modal__block-title-text">${labels.fridayDinnerMenuStarter || "Entrante"}</span></h4>
            <ul class="menu-modal__list">
              <li><span class="menu-modal__item-text">${labels.fridayDinnerMenuStarter1 || "Ensalada caprese con mozzarella y albahaca fresca."}</span></li>
            </ul>
          </article>
          <article class="menu-modal__block">
            <h4 class="menu-modal__block-title"><span aria-hidden="true">🍤</span> <span class="menu-modal__block-title-text">${labels.fridayDinnerMenuMain || "Plato principal"}</span></h4>
            <ul class="menu-modal__list">
              <li><span class="menu-modal__item-text">${labels.fridayDinnerMenuMain1 || "Noche de pescadito frito con limón y hierbas aromáticas."}</span></li>
            </ul>
          </article>
          <article class="menu-modal__block">
            <h4 class="menu-modal__block-title"><span aria-hidden="true">🍰</span> <span class="menu-modal__block-title-text">${labels.fridayDinnerMenuDessert || "Postre"}</span></h4>
            <ul class="menu-modal__list">
              <li><span class="menu-modal__item-text">${labels.fridayDinnerMenuDessert1 || "Postre de la casa"}</span></li>
            </ul>
          </article>
          <article class="menu-modal__block">
            <h4 class="menu-modal__block-title"><span aria-hidden="true">🍷</span> <span class="menu-modal__block-title-text">${labels.fridayDinnerMenuDrinks || "Bebidas"}</span></h4>
            <ul class="menu-modal__list">
              <li><span class="menu-modal__item-text">${labels.fridayDinnerMenuDrink1 || "Vino"}</span></li>
              <li><span class="menu-modal__item-text">${labels.fridayDinnerMenuDrink2 || "Cerveza"}</span></li>
              <li><span class="menu-modal__item-text">${labels.fridayDinnerMenuDrink3 || "Agua"}</span></li>
              <li><span class="menu-modal__item-text">${labels.fridayDinnerMenuDrink4 || "Refrescos"}</span></li>
              <li><span class="menu-modal__item-text">${labels.fridayDinnerMenuDrink5 || "Tinto de verano"}</span></li>
              <li><span class="menu-modal__item-text">${labels.fridayDinnerMenuDrink6 || "Vermut"}</span></li>
            </ul>
          </article>
          </div>
        </div>
      </div>
    </section>
  `;

  document.body.append(modal);
  return modal;
}

function openFridayDinnerMenuModal() {
  const modal = ensureFridayDinnerMenuModal();
  const coverEl = modal.querySelector("[data-menu-cover]");
  modal.removeAttribute("hidden");
  modal.setAttribute("aria-hidden", "false");
  coverEl?.classList.remove("menu-modal__cover--hidden");
  window.setTimeout(() => {
    coverEl?.classList.add("menu-modal__cover--hidden");
  }, 1200);
  document.body.classList.add("body--menu-modal-open");
  refs.bottomNav?.classList.add("bottom-nav--hidden");
}

function closeFridayDinnerMenuModal() {
  const modal = getFridayDinnerMenuModal();
  if (!modal || modal.hasAttribute("hidden")) return;
  modal.setAttribute("hidden", "");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("body--menu-modal-open");
  refs.bottomNav?.classList.remove("bottom-nav--hidden");
}

function getSaturdayBreakfastMenuModal() {
  return document.getElementById(SATURDAY_BREAKFAST_MENU_MODAL_ID);
}

function ensureSaturdayBreakfastMenuModal() {
  const locale = getLocale();
  const labels = locale.labels || {};
  const existingModal = getSaturdayBreakfastMenuModal();
  if (existingModal) {
    const closeButton = existingModal.querySelector(".menu-modal__close-btn");
    const subtitle = existingModal.querySelector(".menu-modal__subtitle");
    const title = existingModal.querySelector(".menu-modal__title");
    const sectionTitles = existingModal.querySelectorAll(".menu-modal__block-title-text");
    const itemLabels = existingModal.querySelectorAll(".menu-modal__item-text");
    const coverArt = existingModal.querySelector(".menu-modal__cover-art");

    if (closeButton) closeButton.setAttribute("aria-label", labels.closeMenuBtn || "Cerrar menú");
    if (subtitle) subtitle.textContent = labels.saturdayBreakfastMenuSubtitle || "SÁBADO · 09:00–11:00";
    if (title) title.textContent = labels.breakfastMenuTitle || "Desayuno";
    if (sectionTitles[0]) sectionTitles[0].textContent = labels.breakfastMenuToastsTitle || "Para empezar";
    if (sectionTitles[1]) sectionTitles[1].textContent = labels.breakfastMenuSweetTitle || "Dulce";
    if (sectionTitles[2]) sectionTitles[2].textContent = labels.breakfastMenuDrinksTitle || "Para acompañar";
    if (itemLabels[0]) itemLabels[0].textContent = labels.breakfastMenuToast1 || "Tomate";
    if (itemLabels[1]) itemLabels[1].textContent = labels.breakfastMenuToast2 || "Tomate y jamón";
    if (itemLabels[2]) itemLabels[2].textContent = labels.breakfastMenuToast3 || "Aguacate y tomate";
    if (itemLabels[3]) itemLabels[3].textContent = labels.breakfastMenuToast4 || "Aguacate y jamón";
    if (itemLabels[4]) itemLabels[4].textContent = labels.breakfastMenuToast5 || "Aceite y jamón";
    if (itemLabels[5]) itemLabels[5].textContent = labels.breakfastMenuToast6 || "Mantequilla y mermelada";
    if (itemLabels[6]) itemLabels[6].textContent = labels.breakfastMenuSweet1 || "Croissants";
    if (itemLabels[7]) itemLabels[7].textContent = labels.breakfastMenuSweet2 || "Bollería variada";
    if (itemLabels[8]) itemLabels[8].textContent = labels.breakfastMenuDrink1 || "Café";
    if (itemLabels[9]) itemLabels[9].textContent = labels.breakfastMenuDrink2 || "Leche";
    if (itemLabels[10]) itemLabels[10].textContent = labels.breakfastMenuDrink3 || "Zumo";
    if (itemLabels[11]) itemLabels[11].textContent = labels.breakfastMenuDrink4 || "Agua";
    if (coverArt) coverArt.setAttribute("data-cover-title", getMenuCoverTitle(labels.breakfastMenuTitle, "Desayuno"));
    return existingModal;
  }

  const modal = document.createElement("div");
  modal.id = SATURDAY_BREAKFAST_MENU_MODAL_ID;
  modal.className = "menu-modal";
  modal.setAttribute("hidden", "");
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="menu-modal__backdrop" data-close-saturday-breakfast-menu="true"></div>
    <section class="menu-modal__dialog menu-modal__dialog--with-cover" role="dialog" aria-modal="true" aria-labelledby="saturday-breakfast-menu-title">
      <div class="menu-modal__cover" data-menu-cover aria-hidden="true">
        <div class="menu-modal__cover-art menu-modal__cover-art--breakfast" data-cover-title="${getMenuCoverTitle(labels.breakfastMenuTitle, "Desayuno")}" aria-hidden="true"></div>
      </div>
      <div class="menu-modal__scroll">
        <button class="menu-modal__close-btn" type="button" aria-label="${labels.closeMenuBtn || "Cerrar menú"}" data-close-saturday-breakfast-menu="true">×</button>
      <p class="menu-modal__subtitle">${labels.saturdayBreakfastMenuSubtitle || "SÁBADO · 09:00–11:00"}</p>
      <h3 id="saturday-breakfast-menu-title" class="menu-modal__title">${labels.breakfastMenuTitle || "Desayuno"}</h3>
      <div class="menu-modal__blocks">
        <article class="menu-modal__block">
          <h4 class="menu-modal__block-title"><span aria-hidden="true">🍞</span> <span class="menu-modal__block-title-text">${labels.breakfastMenuToastsTitle || "Para empezar"}</span></h4>
          <ul class="menu-modal__list">
            <li><span class="menu-modal__item-text">${labels.breakfastMenuToast1 || "Tomate"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuToast2 || "Tomate y jamón"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuToast3 || "Aguacate y tomate"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuToast4 || "Aguacate y jamón"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuToast5 || "Aceite y jamón"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuToast6 || "Mantequilla y mermelada"}</span></li>
          </ul>
        </article>
        <article class="menu-modal__block">
          <h4 class="menu-modal__block-title"><span aria-hidden="true">🥐</span> <span class="menu-modal__block-title-text">${labels.breakfastMenuSweetTitle || "Dulce"}</span></h4>
          <ul class="menu-modal__list">
            <li><span class="menu-modal__item-text">${labels.breakfastMenuSweet1 || "Croissants"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuSweet2 || "Bollería variada"}</span></li>
          </ul>
        </article>
        <article class="menu-modal__block">
          <h4 class="menu-modal__block-title"><span aria-hidden="true">☕</span> <span class="menu-modal__block-title-text">${labels.breakfastMenuDrinksTitle || "Para acompañar"}</span></h4>
          <ul class="menu-modal__list">
            <li><span class="menu-modal__item-text">${labels.breakfastMenuDrink1 || "Café"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuDrink2 || "Leche"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuDrink3 || "Zumo"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuDrink4 || "Agua"}</span></li>
          </ul>
        </article>
      </div>
      </div>
    </section>
  `;

  document.body.append(modal);
  return modal;
}

function openSaturdayBreakfastMenuModal() {
  const modal = ensureSaturdayBreakfastMenuModal();
  const coverEl = modal.querySelector("[data-menu-cover]");
  modal.removeAttribute("hidden");
  modal.setAttribute("aria-hidden", "false");
  coverEl?.classList.remove("menu-modal__cover--hidden");
  window.setTimeout(() => {
    coverEl?.classList.add("menu-modal__cover--hidden");
  }, 1900);
  document.body.classList.add("body--menu-modal-open");
  refs.bottomNav?.classList.add("bottom-nav--hidden");
}

function closeSaturdayBreakfastMenuModal() {
  const modal = getSaturdayBreakfastMenuModal();
  if (!modal || modal.hasAttribute("hidden")) return;
  modal.setAttribute("hidden", "");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("body--menu-modal-open");
  refs.bottomNav?.classList.remove("bottom-nav--hidden");
}

function getSaturdayMenuModal() {
  return document.getElementById(SATURDAY_MENU_MODAL_ID);
}

function ensureSaturdayMenuModal() {
  const locale = getLocale();
  const labels = locale.labels || {};
  const existingModal = getSaturdayMenuModal();
  if (existingModal) {
    const closeButton = existingModal.querySelector(".menu-modal__close-btn");
    const subtitle = existingModal.querySelector(".menu-modal__subtitle");
    const title = existingModal.querySelector(".menu-modal__title");
    const sectionTitles = existingModal.querySelectorAll(".menu-modal__block-title-text");
    const itemLabels = existingModal.querySelectorAll(".menu-modal__item-text");
    const coverArt = existingModal.querySelector(".menu-modal__cover-art");

    if (closeButton) closeButton.setAttribute("aria-label", labels.closeMenuBtn || "Cerrar menú");
    if (subtitle) subtitle.textContent = labels.saturdayMenuSubtitle || "SÁBADO · 14:00";
    if (title) title.textContent = labels.saturdayMenuTitle || "Menú Paella";
    if (sectionTitles[0]) sectionTitles[0].textContent = labels.saturdayMenuStarters || "Entrantes al centro";
    if (sectionTitles[1]) sectionTitles[1].textContent = labels.saturdayMenuMain || "Principal";
    if (sectionTitles[2]) sectionTitles[2].textContent = labels.saturdayMenuDessert || "Postre";
    if (sectionTitles[3]) sectionTitles[3].textContent = labels.saturdayMenuCoffee || "Cafés";
    if (sectionTitles[4]) sectionTitles[4].textContent = labels.saturdayMenuDrinks || "Bebidas";
    if (itemLabels[0]) itemLabels[0].textContent = labels.saturdayMenuStarter1 || "Ensalada de tomate Raf y melva";
    if (itemLabels[1]) itemLabels[1].textContent = labels.saturdayMenuStarter2 || "Ensaladilla rusa";
    if (itemLabels[2]) itemLabels[2].textContent = labels.saturdayMenuMain1 || "Paella de marisco";
    if (itemLabels[3]) itemLabels[3].textContent = labels.saturdayMenuDessert1 || "Postre de la casa";
    if (itemLabels[4]) itemLabels[4].textContent = labels.saturdayMenuCoffee1 || "Café solo";
    if (itemLabels[5]) itemLabels[5].textContent = labels.saturdayMenuCoffee2 || "Café con leche";
    if (itemLabels[6]) itemLabels[6].textContent = labels.saturdayMenuCoffee3 || "Cortado";
    if (itemLabels[7]) itemLabels[7].textContent = labels.saturdayMenuCoffee4 || "Carajillo";
    if (itemLabels[8]) itemLabels[8].textContent = labels.saturdayMenuCoffee5 || "Café con hielo";
    if (itemLabels[9]) itemLabels[9].textContent = labels.saturdayMenuCoffee6 || "Bombón";
    if (itemLabels[10]) itemLabels[10].textContent = labels.saturdayMenuDrink1 || "Vino";
    if (itemLabels[11]) itemLabels[11].textContent = labels.saturdayMenuDrink2 || "Cerveza";
    if (itemLabels[12]) itemLabels[12].textContent = labels.saturdayMenuDrink3 || "Agua";
    if (itemLabels[13]) itemLabels[13].textContent = labels.saturdayMenuDrink4 || "Refrescos";
    if (itemLabels[14]) itemLabels[14].textContent = labels.saturdayMenuDrink5 || "Tinto de verano";
    if (itemLabels[15]) itemLabels[15].textContent = labels.saturdayMenuDrink6 || "Vermut";
    if (coverArt) coverArt.setAttribute("data-cover-title", getMenuCoverTitle(labels.saturdayMenuTitle, "Menú Paella"));
    return existingModal;
  }

  const modal = document.createElement("div");
  modal.id = SATURDAY_MENU_MODAL_ID;
  modal.className = "menu-modal";
  modal.setAttribute("hidden", "");
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="menu-modal__backdrop" data-close-saturday-menu="true"></div>
    <section class="menu-modal__dialog menu-modal__dialog--with-cover" role="dialog" aria-modal="true" aria-labelledby="menu-modal-title">
      <div class="menu-modal__cover" data-menu-cover aria-hidden="true">
        <div class="menu-modal__cover-art menu-modal__cover-art--paella" data-cover-title="${getMenuCoverTitle(labels.saturdayMenuTitle, "Menú Paella")}" aria-hidden="true"></div>
      </div>
      <div class="menu-modal__scroll">
        <button class="menu-modal__close-btn" type="button" aria-label="${labels.closeMenuBtn || "Cerrar menú"}" data-close-saturday-menu="true">×</button>
        <p class="menu-modal__subtitle">${labels.saturdayMenuSubtitle || "SÁBADO · 14:00"}</p>
        <h3 id="menu-modal-title" class="menu-modal__title">${labels.saturdayMenuTitle || "Menú Paella"}</h3>
        <div class="menu-modal__content">
          <div class="menu-modal__blocks">
        <article class="menu-modal__block">
          <h4 class="menu-modal__block-title"><span aria-hidden="true">🥣</span> <span class="menu-modal__block-title-text">${labels.saturdayMenuStarters || "Entrantes al centro"}</span></h4>
          <ul class="menu-modal__list">
            <li><span class="menu-modal__item-text">${labels.saturdayMenuStarter1 || "Ensalada de tomate Raf y melva"}</span></li>
            <li><span class="menu-modal__item-text">${labels.saturdayMenuStarter2 || "Ensaladilla rusa"}</span></li>
          </ul>
        </article>
        <article class="menu-modal__block">
          <h4 class="menu-modal__block-title"><span aria-hidden="true">🥘</span> <span class="menu-modal__block-title-text">${labels.saturdayMenuMain || "Principal"}</span></h4>
          <ul class="menu-modal__list">
            <li><span class="menu-modal__item-text">${labels.saturdayMenuMain1 || "Paella de marisco"}</span></li>
          </ul>
        </article>
        <article class="menu-modal__block">
          <h4 class="menu-modal__block-title"><span aria-hidden="true">🍰</span> <span class="menu-modal__block-title-text">${labels.saturdayMenuDessert || "Postre"}</span></h4>
          <ul class="menu-modal__list">
            <li><span class="menu-modal__item-text">${labels.saturdayMenuDessert1 || "Postre de la casa"}</span></li>
          </ul>
        </article>
        <article class="menu-modal__block">
          <h4 class="menu-modal__block-title"><span aria-hidden="true">☕</span> <span class="menu-modal__block-title-text">${labels.saturdayMenuCoffee || "Cafés"}</span></h4>
          <ul class="menu-modal__list">
            <li><span class="menu-modal__item-text">${labels.saturdayMenuCoffee1 || "Café solo"}</span></li>
            <li><span class="menu-modal__item-text">${labels.saturdayMenuCoffee2 || "Café con leche"}</span></li>
            <li><span class="menu-modal__item-text">${labels.saturdayMenuCoffee3 || "Cortado"}</span></li>
            <li><span class="menu-modal__item-text">${labels.saturdayMenuCoffee4 || "Carajillo"}</span></li>
            <li><span class="menu-modal__item-text">${labels.saturdayMenuCoffee5 || "Café con hielo"}</span></li>
            <li><span class="menu-modal__item-text">${labels.saturdayMenuCoffee6 || "Bombón"}</span></li>
          </ul>
        </article>
        <article class="menu-modal__block">
          <h4 class="menu-modal__block-title"><span aria-hidden="true">🍷</span> <span class="menu-modal__block-title-text">${labels.saturdayMenuDrinks || "Bebidas"}</span></h4>
          <ul class="menu-modal__list">
            <li><span class="menu-modal__item-text">${labels.saturdayMenuDrink1 || "Vino"}</span></li>
            <li><span class="menu-modal__item-text">${labels.saturdayMenuDrink2 || "Cerveza"}</span></li>
            <li><span class="menu-modal__item-text">${labels.saturdayMenuDrink3 || "Agua"}</span></li>
            <li><span class="menu-modal__item-text">${labels.saturdayMenuDrink4 || "Refrescos"}</span></li>
            <li><span class="menu-modal__item-text">${labels.saturdayMenuDrink5 || "Tinto de verano"}</span></li>
            <li><span class="menu-modal__item-text">${labels.saturdayMenuDrink6 || "Vermut"}</span></li>
          </ul>
        </article>
          </div>
        </div>
      </div>
    </section>
  `;

  document.body.append(modal);
  return modal;
}

function openSaturdayMenuModal() {
  const modal = ensureSaturdayMenuModal();
  const coverEl = modal.querySelector("[data-menu-cover]");
  modal.removeAttribute("hidden");
  modal.setAttribute("aria-hidden", "false");
  coverEl?.classList.remove("menu-modal__cover--hidden");
  window.setTimeout(() => {
    coverEl?.classList.add("menu-modal__cover--hidden");
  }, 1200);
  document.body.classList.add("body--menu-modal-open");
  refs.bottomNav?.classList.add("bottom-nav--hidden");
}

function closeSaturdayMenuModal() {
  const modal = getSaturdayMenuModal();
  if (!modal || modal.hasAttribute("hidden")) return;
  modal.setAttribute("hidden", "");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("body--menu-modal-open");
  refs.bottomNav?.classList.remove("bottom-nav--hidden");
}

function getSundayBreakfastMenuModal() {
  return document.getElementById(SUNDAY_BREAKFAST_MENU_MODAL_ID);
}

function ensureSundayBreakfastMenuModal() {
  const locale = getLocale();
  const labels = locale.labels || {};
  const existingModal = getSundayBreakfastMenuModal();
  if (existingModal) {
    const closeButton = existingModal.querySelector(".menu-modal__close-btn");
    const subtitle = existingModal.querySelector(".menu-modal__subtitle");
    const title = existingModal.querySelector(".menu-modal__title");
    const sectionTitles = existingModal.querySelectorAll(".menu-modal__block-title-text");
    const itemLabels = existingModal.querySelectorAll(".menu-modal__item-text");
    const coverArt = existingModal.querySelector(".menu-modal__cover-art");

    if (closeButton) closeButton.setAttribute("aria-label", labels.closeMenuBtn || "Cerrar menú");
    if (subtitle) subtitle.textContent = labels.sundayBreakfastMenuSubtitle || "DOMINGO · 09:00–11:00";
    if (title) title.textContent = labels.breakfastMenuTitle || "Desayuno";
    if (sectionTitles[0]) sectionTitles[0].textContent = labels.breakfastMenuToastsTitle || "Para empezar";
    if (sectionTitles[1]) sectionTitles[1].textContent = labels.breakfastMenuSweetTitle || "Dulce";
    if (sectionTitles[2]) sectionTitles[2].textContent = labels.breakfastMenuDrinksTitle || "Para acompañar";
    if (itemLabels[0]) itemLabels[0].textContent = labels.breakfastMenuToast1 || "Tomate";
    if (itemLabels[1]) itemLabels[1].textContent = labels.breakfastMenuToast2 || "Tomate y jamón";
    if (itemLabels[2]) itemLabels[2].textContent = labels.breakfastMenuToast3 || "Aguacate y tomate";
    if (itemLabels[3]) itemLabels[3].textContent = labels.breakfastMenuToast4 || "Aguacate y jamón";
    if (itemLabels[4]) itemLabels[4].textContent = labels.breakfastMenuToast5 || "Aceite y jamón";
    if (itemLabels[5]) itemLabels[5].textContent = labels.breakfastMenuToast6 || "Mantequilla y mermelada";
    if (itemLabels[6]) itemLabels[6].textContent = labels.breakfastMenuSweet1 || "Croissants";
    if (itemLabels[7]) itemLabels[7].textContent = labels.breakfastMenuSweet2 || "Bollería variada";
    if (itemLabels[8]) itemLabels[8].textContent = labels.breakfastMenuDrink1 || "Café";
    if (itemLabels[9]) itemLabels[9].textContent = labels.breakfastMenuDrink2 || "Leche";
    if (itemLabels[10]) itemLabels[10].textContent = labels.breakfastMenuDrink3 || "Zumo";
    if (itemLabels[11]) itemLabels[11].textContent = labels.breakfastMenuDrink4 || "Agua";
    if (coverArt) coverArt.setAttribute("data-cover-title", getMenuCoverTitle(labels.breakfastMenuTitle, "Desayuno"));
    return existingModal;
  }

  const modal = document.createElement("div");
  modal.id = SUNDAY_BREAKFAST_MENU_MODAL_ID;
  modal.className = "menu-modal";
  modal.setAttribute("hidden", "");
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="menu-modal__backdrop" data-close-sunday-breakfast-menu="true"></div>
    <section class="menu-modal__dialog menu-modal__dialog--with-cover" role="dialog" aria-modal="true" aria-labelledby="sunday-breakfast-menu-title">
      <div class="menu-modal__cover" data-menu-cover aria-hidden="true">
        <div class="menu-modal__cover-art menu-modal__cover-art--breakfast" data-cover-title="${getMenuCoverTitle(labels.breakfastMenuTitle, "Desayuno")}" aria-hidden="true"></div>
      </div>
      <div class="menu-modal__scroll">
        <button class="menu-modal__close-btn" type="button" aria-label="${labels.closeMenuBtn || "Cerrar menú"}" data-close-sunday-breakfast-menu="true">×</button>
      <p class="menu-modal__subtitle">${labels.sundayBreakfastMenuSubtitle || "DOMINGO · 09:00–11:00"}</p>
      <h3 id="sunday-breakfast-menu-title" class="menu-modal__title">${labels.breakfastMenuTitle || "Desayuno"}</h3>
      <div class="menu-modal__blocks">
        <article class="menu-modal__block">
          <h4 class="menu-modal__block-title"><span aria-hidden="true">🍞</span> <span class="menu-modal__block-title-text">${labels.breakfastMenuToastsTitle || "Para empezar"}</span></h4>
          <ul class="menu-modal__list">
            <li><span class="menu-modal__item-text">${labels.breakfastMenuToast1 || "Tomate"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuToast2 || "Tomate y jamón"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuToast3 || "Aguacate y tomate"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuToast4 || "Aguacate y jamón"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuToast5 || "Aceite y jamón"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuToast6 || "Mantequilla y mermelada"}</span></li>
          </ul>
        </article>
        <article class="menu-modal__block">
          <h4 class="menu-modal__block-title"><span aria-hidden="true">🥐</span> <span class="menu-modal__block-title-text">${labels.breakfastMenuSweetTitle || "Dulce"}</span></h4>
          <ul class="menu-modal__list">
            <li><span class="menu-modal__item-text">${labels.breakfastMenuSweet1 || "Croissants"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuSweet2 || "Bollería variada"}</span></li>
          </ul>
        </article>
        <article class="menu-modal__block">
          <h4 class="menu-modal__block-title"><span aria-hidden="true">☕</span> <span class="menu-modal__block-title-text">${labels.breakfastMenuDrinksTitle || "Para acompañar"}</span></h4>
          <ul class="menu-modal__list">
            <li><span class="menu-modal__item-text">${labels.breakfastMenuDrink1 || "Café"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuDrink2 || "Leche"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuDrink3 || "Zumo"}</span></li>
            <li><span class="menu-modal__item-text">${labels.breakfastMenuDrink4 || "Agua"}</span></li>
          </ul>
        </article>
      </div>
    </section>
  `;

  document.body.append(modal);
  return modal;
}

function openSundayBreakfastMenuModal() {
  const modal = ensureSundayBreakfastMenuModal();
  const coverEl = modal.querySelector("[data-menu-cover]");
  modal.removeAttribute("hidden");
  modal.setAttribute("aria-hidden", "false");
  coverEl?.classList.remove("menu-modal__cover--hidden");
  window.setTimeout(() => {
    coverEl?.classList.add("menu-modal__cover--hidden");
  }, 1900);
  document.body.classList.add("body--menu-modal-open");
  refs.bottomNav?.classList.add("bottom-nav--hidden");
}

function closeSundayBreakfastMenuModal() {
  const modal = getSundayBreakfastMenuModal();
  if (!modal || modal.hasAttribute("hidden")) return;
  modal.setAttribute("hidden", "");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("body--menu-modal-open");
  refs.bottomNav?.classList.remove("bottom-nav--hidden");
}

function getPrivateDinnerSurpriseModal() {
  return document.getElementById(PRIVATE_DINNER_SURPRISE_MODAL_ID);
}

function getPrivateDinnerSurpriseText(locale, guest) {
  if (state.currentLanguage !== "it") return locale.labels.privateDinnerSurpriseText || "Esto va a ser una sorpresa: !Cotilla!";
  const isFemale = guest?.sex === "f";
  return isFemale
    ? locale.labels.privateDinnerSurpriseTextFemale || "Questa è una sorpresa: ¡Pettegola!"
    : locale.labels.privateDinnerSurpriseTextMale || "Questa è una sorpresa: ¡Pettegolo!";
}

function ensurePrivateDinnerSurpriseModal() {
  const locale = getLocale();
  const labels = locale.labels || {};
  const guest = findGuestById(state.currentGuestId);
  const surpriseText = getPrivateDinnerSurpriseText(locale, guest);
  const existingModal = getPrivateDinnerSurpriseModal();
  if (existingModal) {
    const closeButton = existingModal.querySelector(".menu-modal__close-btn");
    const subtitle = existingModal.querySelector(".menu-modal__subtitle");
    const title = existingModal.querySelector(".menu-modal__title");
    const message = existingModal.querySelector(".menu-modal__item-text");
    const coverArt = existingModal.querySelector(".menu-modal__cover-art");
    if (closeButton) closeButton.setAttribute("aria-label", labels.closeMenuBtn || "Cerrar menú");
    if (subtitle) subtitle.textContent = labels.privateDinnerSurpriseSubtitle || "SÁBADO · 22:00";
    if (title) title.textContent = labels.privateDinnerSurpriseTitle || "Menú Chef Privado";
    if (message) message.textContent = surpriseText;
    if (coverArt) coverArt.setAttribute("data-cover-title", getMenuCoverTitle(labels.privateDinnerSurpriseTitle, "Menú Chef Privado"));
    return existingModal;
  }

  const modal = document.createElement("div");
  modal.id = PRIVATE_DINNER_SURPRISE_MODAL_ID;
  modal.className = "menu-modal";
  modal.setAttribute("hidden", "");
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="menu-modal__backdrop" data-close-private-dinner-surprise="true"></div>
    <section class="menu-modal__dialog menu-modal__dialog--with-cover menu-modal__dialog--private-dinner" role="dialog" aria-modal="true" aria-labelledby="private-dinner-surprise-title">
      <div class="menu-modal__cover" data-menu-cover-private-dinner aria-hidden="true">
        <div class="menu-modal__cover-art menu-modal__cover-art--private-dinner" data-cover-title="${getMenuCoverTitle(labels.privateDinnerSurpriseTitle, "Menú Chef Privado")}" aria-hidden="true"></div>
      </div>
      <div class="menu-modal__scroll menu-modal__scroll--private-dinner">
      <button class="menu-modal__close-btn" type="button" aria-label="${labels.closeMenuBtn || "Cerrar menú"}" data-close-private-dinner-surprise="true">×</button>
      <p class="menu-modal__subtitle">${labels.privateDinnerSurpriseSubtitle || "SÁBADO · 22:00"}</p>
      <h3 id="private-dinner-surprise-title" class="menu-modal__title">${labels.privateDinnerSurpriseTitle || "Menú Chef Privado"}</h3>
      <div class="menu-modal__content">
        <div class="menu-modal__blocks">
        <article class="menu-modal__block">
          <h4 class="menu-modal__block-title"><span aria-hidden="true">🤫</span> <span class="menu-modal__block-title-text">${labels.privateDinnerSurpriseBlockTitle || "Sorpresa"}</span></h4>
          <ul class="menu-modal__list">
            <li><span class="menu-modal__item-text">${surpriseText}</span></li>
          </ul>
        </article>
        </div>
      </div>
      </div>
    </section>
  `;

  document.body.append(modal);
  return modal;
}

function openPrivateDinnerSurpriseModal() {
  const modal = ensurePrivateDinnerSurpriseModal();
  const coverEl = modal.querySelector("[data-menu-cover-private-dinner]");
  modal.removeAttribute("hidden");
  modal.setAttribute("aria-hidden", "false");
  coverEl?.classList.remove("menu-modal__cover--hidden");
  window.setTimeout(() => {
    coverEl?.classList.add("menu-modal__cover--hidden");
  }, 1200);
  document.body.classList.add("body--menu-modal-open");
  refs.bottomNav?.classList.add("bottom-nav--hidden");
}

function closePrivateDinnerSurpriseModal() {
  const modal = getPrivateDinnerSurpriseModal();
  if (!modal || modal.hasAttribute("hidden")) return;
  modal.setAttribute("hidden", "");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("body--menu-modal-open");
  refs.bottomNav?.classList.remove("bottom-nav--hidden");
}


export {
  getFridayDinnerMenuModal,
  ensureFridayDinnerMenuModal,
  openFridayDinnerMenuModal,
  closeFridayDinnerMenuModal,
  getSaturdayBreakfastMenuModal,
  ensureSaturdayBreakfastMenuModal,
  openSaturdayBreakfastMenuModal,
  closeSaturdayBreakfastMenuModal,
  getSaturdayMenuModal,
  ensureSaturdayMenuModal,
  openSaturdayMenuModal,
  closeSaturdayMenuModal,
  getSundayBreakfastMenuModal,
  ensureSundayBreakfastMenuModal,
  openSundayBreakfastMenuModal,
  closeSundayBreakfastMenuModal,
  getPrivateDinnerSurpriseModal,
  ensurePrivateDinnerSurpriseModal,
  openPrivateDinnerSurpriseModal,
  closePrivateDinnerSurpriseModal,
  getMenuCoverTitle,
  getPrivateDinnerSurpriseText
};
