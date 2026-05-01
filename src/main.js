import {
  ensureAuth,
  isFirebaseConfigured,
  linkGuestToAuth,
  lockGuestProfile,
  releaseGuestProfileLock,
  switchGuestProfileLock
} from "../firebase.js";
import { APP_DATA, refs, state, setState, findGuestById, getHomeCopy, getLocale } from "./state.js";
import { applyTranslations } from "./ui/translations.js";
import { handleUsefulPhraseSpeakClick, renderAllDynamicSections, renderDictionary, renderGuestCards, renderHomeDashboard, updateAppHeaderForView, updateGuestHeaderMessage, updateProfileAvatar, updateWelcomeLabel } from "./ui/render.js";
import { handleSpeakTranslation, handleTranslatorRequest } from "./features/translator.js";
import { handlePhotoGridClick, handleUploadPhoto, highlightPhotoFromActivity } from "./features/photos.js";
import { startPhotoUploadQueue } from "./features/photo-upload-queue.js";
import { renderTimeline, updateCountdown } from "./features/timeline.js";
import { initFirebaseListeners } from "./integrations/firebase-sync.js";
import { getBookModal } from "./ui/BookModal.js";
import {
  renderCurrentTranslationForGuest,
  restoreDictionaryCache,
  startGuestDictionarySync,
  stopGuestDictionarySync
} from "./features/dictionary-store.js";

const rotatorSyncGroups = new Map();
const SCREEN_TRANSITION_MS = 560;
const VIEW_TRANSITION_MS = 420;
const ENTER_BUTTON_FEEDBACK_MS = 220;
const FRIDAY_DINNER_MENU_MODAL_ID = "friday-dinner-menu-modal";
const SATURDAY_BREAKFAST_MENU_MODAL_ID = "saturday-breakfast-menu-modal";
const SATURDAY_MENU_MODAL_ID = "saturday-menu-modal";
const SUNDAY_BREAKFAST_MENU_MODAL_ID = "sunday-breakfast-menu-modal";
const PRIVATE_DINNER_SURPRISE_MODAL_ID = "private-dinner-surprise-modal";
const INSTALL_ONBOARDING_COMPLETED_KEY = "install_onboarding_completed";
const GUESTBOOK_ICON_SWAP_MS = 2800;

let guestbookIconSwapIntervalId = null;

const INSTALL_ONBOARDING_COPY = {
  es: {
    progress: ["Paso 1 de 3", "Paso 2 de 3", "Paso 3 de 3"],
    screen1Title: "Antes de entrar",
    screen1Text: "Te vamos a guiar para instalar la app en tu móvil. Solo tienes que seguir unos pasos.",
    enter: "Entrar",
    screen2Title: "¿Qué móvil estás usando?",
    screen2Text: "Elige tu dispositivo para ver los pasos.",
    ios: "iPhone",
    android: "Android",
    iosTitle: "Instalar en iPhone",
    iosSteps: [
      "Toca los 3 puntitos abajo a la derecha.",
      "Pulsa el botón 'compartir'.",
      "Busca y pulsa “Añadir a pantalla de inicio”.",
      "Pulsa “Añadir”.",
      "Busca el icono de la app en tu pantalla de inicio.",
      "Abre la app desde ese icono."
    ],
    iosFinal: "Abre la app desde el icono para continuar. Ya no hace falta que uses Safari.",
    androidTitle: "Instalar en Android",
    androidSteps: [
      "Pulsa el menú de los tres puntos en Chrome.",
      "Pulsa “Instalar app” o “Añadir a pantalla de inicio”.",
      "Confirma pulsando “Instalar”.",
      "Busca el icono de la app en tu pantalla de inicio o menú de apps.",
      "Abre la app desde ese icono."
    ],
    androidFinal: "Abre la app desde el icono para continuar. Ya no hace falta que uses Chrome.",
    done: "Hecho",
    completed: "Tutorial terminado"
  },
  it: {
    progress: ["Passo 1 di 3", "Passo 2 di 3", "Passo 3 di 3"],
    screen1Title: "Prima di entrare",
    screen1Text: "Ti guideremo per installare l’app sul tuo telefono. Devi solo seguire alcuni passaggi.",
    enter: "Entra",
    screen2Title: "Che telefono stai usando?",
    screen2Text: "Scegli il tuo dispositivo per vedere i passaggi.",
    ios: "iPhone",
    android: "Android",
    iosTitle: "Installare su iPhone",
    iosSteps: [
      "Tocca i 3 puntini in basso a destra.",
      "Tocca il tasto condividi.",
      "Cerca e tocca “Aggiungi alla schermata Home”.",
      "Tocca “Aggiungi”.",
      "Cerca l’icona dell’app nella schermata Home.",
      "Apri l’app da quell’icona."
    ],
    iosFinal: "Apri l’app dall’icona per continuare. Non c’è più bisogno che utilizzi Safari.",
    androidTitle: "Installare su Android",
    androidSteps: [
      "Tocca il menu con i tre puntini in Chrome.",
      "Tocca “Installa app” o “Aggiungi alla schermata Home”.",
      "Conferma toccando “Installa”.",
      "Cerca l’icona dell’app nella schermata Home o nel menu app.",
      "Apri l’app da quell’icona."
    ],
    androidFinal: "Apri l’app dall’icona per continuare. Non c’è più bisogno che utilizzi Chrome.",
    done: "Fatto",
    completed: "Tutorial finito"
  }
};

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function setAppAccessVisibility(isVisible) {
  const appRoot = document.getElementById("app");
  if (!appRoot) return;
  if (isVisible) appRoot.removeAttribute("hidden");
  else appRoot.setAttribute("hidden", "");
}

function setOnboardingVisibility(isVisible) {
  const onboardingRoot = document.getElementById("onboarding");
  if (!onboardingRoot) return;
  if (isVisible) onboardingRoot.removeAttribute("hidden");
  else onboardingRoot.setAttribute("hidden", "");
}

function initInstallOnboardingGate() {
  const onboardingRoot = document.getElementById("onboarding");
  if (!onboardingRoot) return false;

  const shouldAllowAccess = isStandaloneMode();
  if (shouldAllowAccess) {
    setOnboardingVisibility(false);
    setAppAccessVisibility(true);
    return false;
  }

  const onboardingState = { step: 1, lang: "es", device: "ios" };
  let completionAnimationTimeoutId = null;

  const clearCompletionAnimationTimeout = () => {
    if (!completionAnimationTimeoutId) return;
    window.clearTimeout(completionAnimationTimeoutId);
    completionAnimationTimeoutId = null;
  };

  const render = () => {
    const copy = INSTALL_ONBOARDING_COPY[onboardingState.lang];
    if (onboardingState.completing) {
      onboardingRoot.innerHTML = `
        <section class="install-onboarding__card install-onboarding__completion" aria-live="polite">
          <p class="install-onboarding__completion-badge">✓</p>
          <h2 class="section-title install-onboarding__completion-title">${copy.completed}</h2>
        </section>
      `;
      return;
    }

    const isStepOne = onboardingState.step === 1;
    const isStepTwo = onboardingState.step === 2;
    const isStepThree = onboardingState.step === 3;
    const isIos = onboardingState.device === "ios";
    const title = isStepOne
      ? copy.screen1Title
      : isStepTwo
        ? copy.screen2Title
        : isIos
          ? copy.iosTitle
          : copy.androidTitle;
    const text = isStepOne ? copy.screen1Text : isStepTwo ? copy.screen2Text : "";
    const steps = isStepThree ? (isIos ? copy.iosSteps : copy.androidSteps) : [];
    const finalMessage = isStepThree ? (isIos ? copy.iosFinal : copy.androidFinal) : "";
    const progressLabel = copy.progress[onboardingState.step - 1];

    onboardingRoot.innerHTML = `
      <section class="install-onboarding__card install-onboarding__screen">
        <div class="install-onboarding__head">
          ${onboardingState.step > 1 ? `<button type="button" class="install-onboarding__back" data-onboarding-back="true" aria-label="Back">←</button>` : `<p class="install-onboarding__progress">${progressLabel}</p>`}
          ${isStepOne
            ? `<div class="install-onboarding__lang" role="group" aria-label="Language">
                <button type="button" class="install-onboarding__lang-btn ${onboardingState.lang === "es" ? "install-onboarding__lang-btn--active" : ""}" data-onboarding-lang="es">ES</button>
                <button type="button" class="install-onboarding__lang-btn ${onboardingState.lang === "it" ? "install-onboarding__lang-btn--active" : ""}" data-onboarding-lang="it">IT</button>
              </div>`
            : `<p class="install-onboarding__progress">${progressLabel}</p>`
          }
        </div>
        <h2 class="section-title install-onboarding__title">${title}</h2>
        ${text ? `<p class="install-onboarding__text">${text}</p>` : ""}
        ${steps.length ? `<ol class="install-onboarding__steps">${steps.map((item) => `<li>${item}</li>`).join("")}</ol>` : ""}
        ${finalMessage ? `<p class="install-onboarding__footer-note">${finalMessage}</p>` : ""}
        <div class="install-onboarding__actions">
          ${isStepOne ? `<button type="button" class="primary-btn primary-btn--full" data-onboarding-next="1">${copy.enter}</button>` : ""}
          ${isStepTwo ? `<button type="button" class="primary-btn primary-btn--full" data-onboarding-device="ios">${copy.ios}</button><button type="button" class="primary-btn primary-btn--full" data-onboarding-device="android">${copy.android}</button>` : ""}
          ${isStepThree ? `<button type="button" class="primary-btn primary-btn--full" data-onboarding-done="true">${copy.done}</button>` : ""}
        </div>
      </section>
    `;
  };

  onboardingRoot.addEventListener("click", (event) => {
    const langButton = event.target.closest("[data-onboarding-lang]");
    if (langButton) {
      onboardingState.lang = langButton.dataset.onboardingLang;
      render();
      return;
    }

    const backButton = event.target.closest("[data-onboarding-back]");
    if (backButton) {
      if (onboardingState.step === 3) onboardingState.step = 2;
      else if (onboardingState.step === 2) onboardingState.step = 1;
      render();
      return;
    }

    const nextButton = event.target.closest("[data-onboarding-next]");
    if (nextButton) {
      onboardingState.step = 2;
      render();
      return;
    }

    const deviceButton = event.target.closest("[data-onboarding-device]");
    if (deviceButton) {
      onboardingState.device = deviceButton.dataset.onboardingDevice;
      onboardingState.step = 3;
      render();
      return;
    }

    const doneButton = event.target.closest("[data-onboarding-done]");
    if (!doneButton) return;
    localStorage.setItem(INSTALL_ONBOARDING_COMPLETED_KEY, "true");
    clearCompletionAnimationTimeout();
    onboardingState.completing = true;
    render();
    completionAnimationTimeoutId = window.setTimeout(() => {
      onboardingState.completing = false;
      onboardingState.step = 3;
      render();
    }, 1900);
    setOnboardingVisibility(true);
    setAppAccessVisibility(false);
  });

  render();
  setOnboardingVisibility(true);
  setAppAccessVisibility(false);
  return true;
}

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
    if (sectionTitles[3]) sectionTitles[3].textContent = labels.fridayDinnerMenuCoffee || "Cafés";
    if (sectionTitles[4]) sectionTitles[4].textContent = labels.fridayDinnerMenuDrinks || "Bebidas";
    if (itemLabels[0]) itemLabels[0].textContent = labels.fridayDinnerMenuStarter1 || "Ensalada caprese con mozzarella y albahaca fresca.";
    if (itemLabels[1]) itemLabels[1].textContent = labels.fridayDinnerMenuMain1 || "Noche de pescadito frito con limón y hierbas aromáticas.";
    if (itemLabels[2]) itemLabels[2].textContent = labels.fridayDinnerMenuDessert1 || "Postre de la casa";
    if (itemLabels[3]) itemLabels[3].textContent = labels.fridayDinnerMenuCoffee1 || "Café solo";
    if (itemLabels[4]) itemLabels[4].textContent = labels.fridayDinnerMenuCoffee2 || "Café con leche";
    if (itemLabels[5]) itemLabels[5].textContent = labels.fridayDinnerMenuCoffee3 || "Cortado";
    if (itemLabels[6]) itemLabels[6].textContent = labels.fridayDinnerMenuCoffee4 || "Carajillo";
    if (itemLabels[7]) itemLabels[7].textContent = labels.fridayDinnerMenuCoffee5 || "Café con hielo";
    if (itemLabels[8]) itemLabels[8].textContent = labels.fridayDinnerMenuCoffee6 || "Bombón";
    if (itemLabels[9]) itemLabels[9].textContent = labels.fridayDinnerMenuDrink1 || "Vino";
    if (itemLabels[10]) itemLabels[10].textContent = labels.fridayDinnerMenuDrink2 || "Cerveza";
    if (itemLabels[11]) itemLabels[11].textContent = labels.fridayDinnerMenuDrink3 || "Agua";
    if (itemLabels[12]) itemLabels[12].textContent = labels.fridayDinnerMenuDrink4 || "Refrescos";
    if (itemLabels[13]) itemLabels[13].textContent = labels.fridayDinnerMenuDrink5 || "Tinto de verano";
    if (itemLabels[14]) itemLabels[14].textContent = labels.fridayDinnerMenuDrink6 || "Vermut";
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
            <h4 class="menu-modal__block-title"><span aria-hidden="true">☕</span> <span class="menu-modal__block-title-text">${labels.fridayDinnerMenuCoffee || "Cafés"}</span></h4>
            <ul class="menu-modal__list">
              <li><span class="menu-modal__item-text">${labels.fridayDinnerMenuCoffee1 || "Café solo"}</span></li>
              <li><span class="menu-modal__item-text">${labels.fridayDinnerMenuCoffee2 || "Café con leche"}</span></li>
              <li><span class="menu-modal__item-text">${labels.fridayDinnerMenuCoffee3 || "Cortado"}</span></li>
              <li><span class="menu-modal__item-text">${labels.fridayDinnerMenuCoffee4 || "Carajillo"}</span></li>
              <li><span class="menu-modal__item-text">${labels.fridayDinnerMenuCoffee5 || "Café con hielo"}</span></li>
              <li><span class="menu-modal__item-text">${labels.fridayDinnerMenuCoffee6 || "Bombón"}</span></li>
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
    const coverArt = existingModal.querySelector(".menu-modal__private-cover-art");
    const defaultPrivateCoverTitle = state.currentLanguage === "it" ? "Menù Chef Privato" : "Menú Chef Privado";
    if (closeButton) closeButton.setAttribute("aria-label", labels.closeMenuBtn || "Cerrar menú");
    if (subtitle) subtitle.textContent = labels.privateDinnerSurpriseSubtitle || "SÁBADO · 22:00";
    if (title) title.textContent = labels.privateDinnerSurpriseTitle || "Cena con chef privado";
    if (message) message.textContent = surpriseText;
    if (coverArt) coverArt.setAttribute("data-private-cover-title", getMenuCoverTitle(labels.privateDinnerSurpriseCoverTitle, defaultPrivateCoverTitle));
    return existingModal;
  }

  const modal = document.createElement("div");
  modal.id = PRIVATE_DINNER_SURPRISE_MODAL_ID;
  modal.className = "menu-modal";
  modal.setAttribute("hidden", "");
  modal.setAttribute("aria-hidden", "true");
  const defaultPrivateCoverTitle = state.currentLanguage === "it" ? "Menù Chef Privato" : "Menú Chef Privado";
  modal.innerHTML = `
    <div class="menu-modal__backdrop" data-close-private-dinner-surprise="true"></div>
    <section class="menu-modal__dialog menu-modal__dialog--with-private-cover" role="dialog" aria-modal="true" aria-labelledby="private-dinner-surprise-title">
      <div class="menu-modal__private-cover" data-private-menu-cover aria-hidden="true">
        <div class="menu-modal__private-cover-art" data-private-cover-title="${getMenuCoverTitle(labels.privateDinnerSurpriseCoverTitle, defaultPrivateCoverTitle)}" aria-hidden="true"></div>
      </div>
      <div class="menu-modal__private-scroll">
        <button class="menu-modal__close-btn" type="button" aria-label="${labels.closeMenuBtn || "Cerrar menú"}" data-close-private-dinner-surprise="true">×</button>
        <p class="menu-modal__subtitle">${labels.privateDinnerSurpriseSubtitle || "SÁBADO · 22:00"}</p>
        <h3 id="private-dinner-surprise-title" class="menu-modal__title">${labels.privateDinnerSurpriseTitle || "Cena con chef privado"}</h3>
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
  const coverEl = modal.querySelector("[data-private-menu-cover]");
  modal.removeAttribute("hidden");
  modal.setAttribute("aria-hidden", "false");
  coverEl?.classList.remove("menu-modal__private-cover--hidden");
  window.setTimeout(() => {
    coverEl?.classList.add("menu-modal__private-cover--hidden");
  }, 130);
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

function getRotatorSyncGroup(groupName, { pauseMs, transitionMs }) {
  const existingGroup = rotatorSyncGroups.get(groupName);
  if (existingGroup) return existingGroup;

  const group = {
    subscribers: new Set(),
    firstTickTimer: null,
    intervalTimer: null
  };

  function clearTimers() {
    if (group.firstTickTimer) {
      window.clearTimeout(group.firstTickTimer);
      group.firstTickTimer = null;
    }
    if (group.intervalTimer) {
      window.clearInterval(group.intervalTimer);
      group.intervalTimer = null;
    }
  }

  function tick() {
    group.subscribers.forEach((subscriber) => subscriber.triggerMove());
  }

  group.start = () => {
    if (group.firstTickTimer || group.intervalTimer) return;
    group.firstTickTimer = window.setTimeout(() => {
      tick();
      group.intervalTimer = window.setInterval(tick, pauseMs + transitionMs);
      group.firstTickTimer = null;
    }, pauseMs);
  };

  group.stop = () => clearTimers();

  group.subscribe = (subscriber) => group.subscribers.add(subscriber);

  group.unsubscribe = (subscriber) => {
    group.subscribers.delete(subscriber);
    if (!group.subscribers.size) group.stop();
  };

  rotatorSyncGroups.set(groupName, group);
  return group;
}

function scrollViewportToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function animateEntrance(element, animationClass, durationMs) {
  if (!element) return;
  element.classList.remove(animationClass);
  void element.offsetWidth;
  element.classList.add(animationClass);
  window.setTimeout(() => element.classList.remove(animationClass), durationMs);
}

function showScreen(screenToShow) {
  [refs.screenLanguage, refs.screenGuest, refs.screenApp].forEach((screen) => screen.classList.remove("screen--active"));
  screenToShow.classList.add("screen--active");
  animateEntrance(screenToShow, "screen--transition-in", SCREEN_TRANSITION_MS);
  document.body.classList.toggle("body--language-locked", screenToShow === refs.screenLanguage);
  scrollViewportToTop();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function initVerticalLoopRotator({
  rootSelector,
  trackSelector,
  itemSelector,
  transitionMs = 760,
  pauseMs = 1450,
  lockMaxItemWidth = false,
  syncGroup = null
}) {
  const rotator = document.querySelector(rootSelector);
  const track = rotator?.querySelector(trackSelector);
  if (!track) return;

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let isRunning = false;
  let pauseTimer = null;
  let isTransitioning = false;
  let syncSubscription = null;
  let pendingWidthSyncFrame = null;
  const syncController = syncGroup ? getRotatorSyncGroup(syncGroup, { pauseMs, transitionMs }) : null;

  function syncLockedWidth() {
    if (!lockMaxItemWidth) return;
    const items = track.querySelectorAll(itemSelector);
    if (!items.length) return;
    const maxWidth = Array.from(items).reduce((currentMax, item) => Math.max(currentMax, item.getBoundingClientRect().width), 0);
    if (maxWidth > 0) rotator.style.width = `${Math.ceil(maxWidth) + 2}px`;
  }

  function scheduleWidthSync() {
    if (!lockMaxItemWidth) return;
    if (pendingWidthSyncFrame) window.cancelAnimationFrame(pendingWidthSyncFrame);
    pendingWidthSyncFrame = window.requestAnimationFrame(() => {
      pendingWidthSyncFrame = null;
      syncLockedWidth();
    });
  }

  function clearPauseTimer() {
    if (!pauseTimer) return;
    window.clearTimeout(pauseTimer);
    pauseTimer = null;
  }

  function getStepHeight() {
    const firstItem = track.firstElementChild;
    if (!firstItem) return 0;
    return firstItem.getBoundingClientRect().height;
  }

  function resetTrackPosition() {
    track.style.transition = "none";
    track.style.transform = "translateY(0)";
  }

  function queueNextMove() {
    if (!isRunning) return;
    if (syncController) return;
    clearPauseTimer();
    pauseTimer = window.setTimeout(() => {
      triggerMove();
    }, pauseMs);
  }

  function stop() {
    isRunning = false;
    clearPauseTimer();
    isTransitioning = false;
    if (syncController && syncSubscription) {
      syncController.unsubscribe(syncSubscription);
      syncSubscription = null;
    }
    resetTrackPosition();
  }

  function triggerMove() {
    if (!isRunning || isTransitioning) return;
    const stepHeight = getStepHeight();
    if (!stepHeight) return;
    isTransitioning = true;
    track.style.transition = `transform ${transitionMs}ms cubic-bezier(0.33, 1, 0.68, 1)`;
    track.style.transform = `translateY(-${stepHeight}px)`;
  }

  function start() {
    if (reducedMotionQuery.matches) {
      stop();
      return;
    }
    syncLockedWidth();
    isRunning = true;
    resetTrackPosition();
    if (syncController && !syncSubscription) {
      syncSubscription = { triggerMove };
      syncController.subscribe(syncSubscription);
      syncController.start();
    }
    queueNextMove();
  }

  track.addEventListener("transitionend", (event) => {
    if (event.propertyName !== "transform") return;
    isTransitioning = false;
    const firstItem = track.firstElementChild;
    if (firstItem) track.append(firstItem);
    resetTrackPosition();
    void track.offsetHeight;
    queueNextMove();
  });

  reducedMotionQuery.addEventListener("change", () => {
    if (reducedMotionQuery.matches) {
      stop();
      return;
    }
    start();
  });

  window.addEventListener("resize", scheduleWidthSync);
  window.addEventListener("orientationchange", scheduleWidthSync);
  window.addEventListener("pageshow", scheduleWidthSync);

  if (document.fonts?.ready) {
    document.fonts.ready.then(scheduleWidthSync);
  }

  window.setTimeout(scheduleWidthSync, 180);
  window.setTimeout(scheduleWidthSync, 600);

  syncLockedWidth();
  start();
}

function initHeroRotator() {
  initVerticalLoopRotator({
    rootSelector: ".hero-rotator",
    trackSelector: ".hero-rotator__track",
    itemSelector: ".hero-rotator__item",
    pauseMs: 1600,
    syncGroup: "language-hero"
  });
}

function initHeroDateRotator() {
  initVerticalLoopRotator({
    rootSelector: ".hero-date-rotator",
    trackSelector: ".hero-date-rotator__track",
    itemSelector: ".hero-date-rotator__item",
    pauseMs: 1600,
    lockMaxItemWidth: true,
    syncGroup: "language-hero"
  });
}

async function withAppUpdate(task) {
  if (refs.appShell) refs.appShell.classList.add("app-shell--updating");
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  try {
    await task();
  } finally {
    window.requestAnimationFrame(() => {
      if (refs.appShell) refs.appShell.classList.remove("app-shell--updating");
    });
  }
}

function highlightSelectedLanguage() {
  const isEs = state.currentLanguage === "es";
  refs.btnEs.classList.toggle("primary-btn", isEs);
  refs.btnEs.classList.toggle("secondary-btn", !isEs);
  refs.btnIt.classList.toggle("primary-btn", !isEs);
  refs.btnIt.classList.toggle("secondary-btn", isEs);
  refs.btnEs.classList.toggle("language-btn--active", isEs);
  refs.btnIt.classList.toggle("language-btn--active", !isEs);
}

function syncBottomNavIndicator(activeButton) {
  if (!refs.bottomNav || !refs.navLiquidIndicator || !activeButton) return;

  const navRect = refs.bottomNav.getBoundingClientRect();
  const buttonRect = activeButton.getBoundingClientRect();
  const indicatorWidth = activeButton.offsetWidth;
  const buttonCenterX = buttonRect.left + buttonRect.width / 2;
  const offsetX = buttonCenterX - navRect.left - indicatorWidth / 2;

  refs.navLiquidIndicator.style.width = `${indicatorWidth}px`;
  refs.navLiquidIndicator.style.transform = `translate3d(${offsetX}px, 0, 0)`;
}

function activateView(viewName) {
  refs.views.forEach((view) => view.classList.remove("view--active"));
  refs.navButtons.forEach((button) => {
    button.classList.remove("nav-btn--active");
    button.removeAttribute("aria-current");
  });
  const targetView = document.getElementById(`view-${viewName}`);
  const targetButton = document.querySelector(`[data-view="${viewName}"]`);
  if (targetView) {
    targetView.classList.add("view--active");
    animateEntrance(targetView, "view--transition-in", VIEW_TRANSITION_MS);
  }
  if (targetButton) {
    targetButton.classList.add("nav-btn--active");
    targetButton.setAttribute("aria-current", "page");
    syncBottomNavIndicator(targetButton);
  }
  updateAppHeaderForView(viewName);
  scrollViewportToTop();
}

async function playLanguageSelectionAnimation(lang) {
  const selectedButton = lang === "es" ? refs.btnEs : refs.btnIt;
  refs.btnEs.disabled = true;
  refs.btnIt.disabled = true;
  selectedButton.classList.remove("language-btn--selected");
  void selectedButton.offsetWidth;
  selectedButton.classList.add("language-btn--selected");
  await delay(420);
  selectedButton.classList.remove("language-btn--selected");
  refs.btnEs.disabled = false;
  refs.btnIt.disabled = false;
}

async function setLanguage(lang) {
  setState({ currentLanguage: lang });
  localStorage.setItem("wedding_lang", lang);
  await withAppUpdate(async () => {
    applyTranslations();
    renderAllDynamicSections();
    highlightSelectedLanguage();
    updateCountdown();
  });
  await playLanguageSelectionAnimation(lang);
  showScreen(refs.screenGuest);
}

async function setGuest(guestId) {
  if (state.currentGuestId === guestId) {
    showScreen(refs.screenApp);
    return;
  }

  if (isFirebaseConfigured()) {
    try {
      await ensureAuth();
      if (state.currentGuestId) {
        await switchGuestProfileLock(state.currentGuestId, guestId);
      } else {
        await lockGuestProfile(guestId);
      }
      setState({ hasActiveGuestLock: true });
    } catch (error) {
      if (error?.message === "guest_locked") {
        alert(state.currentLanguage === "it" ? "Questo profilo è già occupato." : "Este perfil ya está ocupado.");
        return;
      }
      alert(getHomeCopy().authError);
      return;
    }
  }

  setState({ currentGuestId: guestId });
  localStorage.setItem("wedding_guest", guestId);
  startGuestDictionarySync(guestId);
  const guest = findGuestById(guestId);
  refs.selectedGuestName.textContent = guest ? guest.name : "Invitado";
  updateProfileAvatar();
  startGuestbookIconAlternation();
  await withAppUpdate(async () => {
    updateWelcomeLabel();
    updateGuestHeaderMessage();
    renderTimeline();
    showScreen(refs.screenApp);
    renderHomeDashboard();
    renderGuestCards();
    renderDictionary();
    updateCountdown();
  });

  if (isFirebaseConfigured()) {
    try {
      await linkGuestToAuth(guestId);
    } catch {
      alert(getHomeCopy().authError);
    }
  }
}

function restoreSession() {
  restoreDictionaryCache();
  const savedLang = localStorage.getItem("wedding_lang");
  const savedGuestId = localStorage.getItem("wedding_guest");
  if (savedLang && APP_DATA.translations[savedLang]) setState({ currentLanguage: savedLang });
  applyTranslations();
  renderAllDynamicSections();
  highlightSelectedLanguage();

  if (savedGuestId && findGuestById(savedGuestId)) {
    setState({ currentGuestId: savedGuestId });
    startGuestDictionarySync(savedGuestId);
    refs.selectedGuestName.textContent = findGuestById(savedGuestId).name;
    updateWelcomeLabel();
    updateGuestHeaderMessage();
    updateProfileAvatar();
    renderTimeline();
    renderHomeDashboard();
    renderDictionary();
    showScreen(refs.screenApp);
    return;
  }

  updateProfileAvatar();
  renderCurrentTranslationForGuest(null);
  showScreen(savedLang ? refs.screenGuest : refs.screenLanguage);
}

function openGuestbookModal() {
  getBookModal().open();
}

function closeGuestbookModal() {
  getBookModal().close();
}

function stopGuestbookIconAlternation() {
  if (guestbookIconSwapIntervalId) {
    window.clearInterval(guestbookIconSwapIntervalId);
    guestbookIconSwapIntervalId = null;
  }
}

function startGuestbookIconAlternation() {
  if (!refs.guestbookTrigger || refs.guestbookTrigger.hidden) {
    stopGuestbookIconAlternation();
    return;
  }
  stopGuestbookIconAlternation();
  refs.guestbookTrigger.classList.remove("guestbook-trigger--show-book");
  guestbookIconSwapIntervalId = window.setInterval(() => {
    refs.guestbookTrigger?.classList.toggle("guestbook-trigger--show-book");
  }, GUESTBOOK_ICON_SWAP_MS);
}

function bindUIEvents() {
  refs.btnEs.addEventListener("click", () => setLanguage("es"));
  refs.btnIt.addEventListener("click", () => setLanguage("it"));
  refs.backToLanguage.addEventListener("click", () => showScreen(refs.screenLanguage));
  refs.changeProfile.addEventListener("click", async () => {
    const previousGuestId = state.currentGuestId;
    if (isFirebaseConfigured() && previousGuestId) {
      try { await releaseGuestProfileLock(previousGuestId); } catch {}
    }
    setState({ hasActiveGuestLock: false, currentGuestId: null });
    localStorage.removeItem("wedding_guest");
    stopGuestDictionarySync();
    updateWelcomeLabel();
    updateGuestHeaderMessage();
    updateProfileAvatar();
    stopGuestbookIconAlternation();
    renderGuestCards();
    showScreen(refs.screenGuest);
  });
  refs.guestbookTrigger?.addEventListener("click", () => {
    refs.guestbookTrigger.classList.add("guestbook-trigger--show-book");
    openGuestbookModal();
  });
  refs.guestbookClose?.addEventListener("click", closeGuestbookModal);

  refs.navButtons.forEach((button) => button.addEventListener("click", () => activateView(button.dataset.view)));

  refs.homeInfoStack.addEventListener("click", (event) => {
    const targetButton = event.target.closest("[data-target-view]");
    if (targetButton) activateView(targetButton.dataset.targetView);

    const activityPhotoButton = event.target.closest("[data-activity-photo-id]");
    if (activityPhotoButton) {
      activateView("photos");
      highlightPhotoFromActivity(activityPhotoButton.dataset.activityPhotoId, activityPhotoButton.dataset.activityType);
      return;
    }

    const activityGuestbookButton = event.target.closest("[data-activity-open-guestbook]");
    if (activityGuestbookButton) {
      openGuestbookModal();
      return;
    }

    const detailToggle = event.target.closest("[data-home-toggle-details]");
    if (detailToggle) {
      setState({ isWeekendFormatExpanded: detailToggle.dataset.homeToggleDetails === "expand" });
      renderHomeDashboard();
    }
  });

  document.addEventListener("click", (event) => {
    const openFridayDinnerButton = event.target.closest("[data-open-friday-dinner-menu]");
    if (openFridayDinnerButton) {
      openFridayDinnerMenuModal();
      return;
    }
    const openSaturdayBreakfastButton = event.target.closest("[data-open-saturday-breakfast-menu]");
    if (openSaturdayBreakfastButton) {
      openSaturdayBreakfastMenuModal();
      return;
    }
    const openButton = event.target.closest("[data-open-saturday-menu]");
    if (openButton) {
      openSaturdayMenuModal();
      return;
    }
    const openPrivateDinnerButton = event.target.closest("[data-open-private-dinner-surprise]");
    if (openPrivateDinnerButton) {
      openPrivateDinnerSurpriseModal();
      return;
    }
    const closeFridayDinnerButton = event.target.closest("[data-close-friday-dinner-menu]");
    if (closeFridayDinnerButton) {
      closeFridayDinnerMenuModal();
      return;
    }
    const closeSaturdayBreakfastButton = event.target.closest("[data-close-saturday-breakfast-menu]");
    if (closeSaturdayBreakfastButton) {
      closeSaturdayBreakfastMenuModal();
      return;
    }
    const closeButton = event.target.closest("[data-close-saturday-menu]");
    if (closeButton) {
      closeSaturdayMenuModal();
      return;
    }
    const openSundayBreakfastButton = event.target.closest("[data-open-sunday-breakfast-menu]");
    if (openSundayBreakfastButton) {
      openSundayBreakfastMenuModal();
      return;
    }
    const closeSundayBreakfastButton = event.target.closest("[data-close-sunday-breakfast-menu]");
    if (closeSundayBreakfastButton) {
      closeSundayBreakfastMenuModal();
      return;
    }
    const closePrivateDinnerButton = event.target.closest("[data-close-private-dinner-surprise]");
    if (closePrivateDinnerButton) closePrivateDinnerSurpriseModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeGuestbookModal();
      closeFridayDinnerMenuModal();
      closeSaturdayBreakfastMenuModal();
      closeSaturdayMenuModal();
      closeSundayBreakfastMenuModal();
      closePrivateDinnerSurpriseModal();
    }
  });

  ["useful-phrases", "false-friends"].forEach((id) => {
    const toggle = document.getElementById(`${id}-toggle`);
    const content = document.getElementById(`${id}-list`);
    toggle.addEventListener("click", () => {
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", isExpanded ? "false" : "true");
      content.hidden = isExpanded;
    });
  });
  document.getElementById("useful-phrases-list").addEventListener("click", handleUsefulPhraseSpeakClick);

  document.getElementById("photo-grid").addEventListener("click", handlePhotoGridClick);
  refs.uploadPhotoBtn.addEventListener("click", handleUploadPhoto);
  refs.translatorButton.addEventListener("click", handleTranslatorRequest);
  refs.translatorSpeakButton.addEventListener("click", handleSpeakTranslation);
  refs.translatorInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleTranslatorRequest();
  });

  const toggleGuestCardFlip = (card) => {
    const isCurrentlyFlipped = card.classList.contains("guest-card--flipped");
    refs.guestGrid.querySelectorAll(".guest-card--flipped").forEach((flippedCard) => {
      flippedCard.classList.remove("guest-card--flipped");
      flippedCard.setAttribute("aria-pressed", "false");
    });
    if (isCurrentlyFlipped) return;
    card.classList.add("guest-card--flipped");
    card.setAttribute("aria-pressed", "true");
  };

  refs.guestGrid.addEventListener("click", async (event) => {
    const enterButton = event.target.closest("[data-guest-enter]");
    if (enterButton) {
      if (enterButton.disabled) return;
      enterButton.classList.remove("guest-enter-btn--pressed");
      void enterButton.offsetWidth;
      enterButton.classList.add("guest-enter-btn--pressed");
      await delay(ENTER_BUTTON_FEEDBACK_MS);
      enterButton.classList.remove("guest-enter-btn--pressed");
      await setGuest(enterButton.dataset.guestEnter);
      return;
    }
    const card = event.target.closest(".guest-card");
    if (!card) return;
    toggleGuestCardFlip(card);
  });

  refs.guestGrid.addEventListener("keydown", (event) => {
    if (event.target.closest("[data-guest-enter]")) return;
    const card = event.target.closest(".guest-card");
    if (!card) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleGuestCardFlip(card);
    }
  });
}

window.addEventListener("beforeunload", () => {
  stopGuestbookIconAlternation();
  if (!isFirebaseConfigured() || !state.currentGuestId || !state.hasActiveGuestLock) return;
  releaseGuestProfileLock(state.currentGuestId).catch(() => {});
});

const isInstallGateBlocking = initInstallOnboardingGate();

bindUIEvents();
startPhotoUploadQueue();
restoreSession();
startGuestbookIconAlternation();
initHeroRotator();
initHeroDateRotator();
activateView("home");
window.addEventListener("resize", () => {
  const activeButton = document.querySelector(".nav-btn--active");
  if (activeButton) syncBottomNavIndicator(activeButton);
});
updateCountdown();
setInterval(updateCountdown, 1000);
initFirebaseListeners(() => showScreen(refs.screenGuest));

if (isInstallGateBlocking) showScreen(refs.screenLanguage);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service Worker registration failed:", error);
    });
  });
}
