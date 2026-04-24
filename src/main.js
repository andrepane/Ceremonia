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
import { handlePhotoGridClick, handleUploadPhoto } from "./features/photos.js";
import { renderTimeline, updateCountdown } from "./features/timeline.js";
import { initFirebaseListeners } from "./integrations/firebase-sync.js";
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
const SATURDAY_MENU_MODAL_ID = "saturday-menu-modal";
const SATURDAY_DINNER_SURPRISE_MODAL_ID = "saturday-dinner-surprise-modal";

function getSaturdayMenuModal() {
  return document.getElementById(SATURDAY_MENU_MODAL_ID);
}

function getSaturdayDinnerSurpriseModal() {
  return document.getElementById(SATURDAY_DINNER_SURPRISE_MODAL_ID);
}

function getSaturdayDinnerSurpriseText(labels = {}) {
  const guest = findGuestById(state.currentGuestId);
  const isFemale = guest?.sex === "f";
  return {
    spanish: isFemale
      ? labels.saturdayDinnerSurpriseEsFemale || "Esto va a ser una sorpresa: ¡Cotilla!"
      : labels.saturdayDinnerSurpriseEsMale || "Esto va a ser una sorpresa: ¡Cotilla!",
    italian: isFemale
      ? labels.saturdayDinnerSurpriseItFemale || "Questa è una sorpresa: ¡Pettegola!"
      : labels.saturdayDinnerSurpriseItMale || "Questa è una sorpresa: ¡Pettegolo!"
  };
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

    if (closeButton) closeButton.setAttribute("aria-label", labels.closeMenuBtn || "Cerrar menú");
    if (subtitle) subtitle.textContent = labels.saturdayMenuSubtitle || "SÁBADO · 14:00";
    if (title) title.textContent = labels.saturdayMenuTitle || "Almuerzo del sábado";
    if (sectionTitles[0]) sectionTitles[0].textContent = labels.saturdayMenuStarters || "Entrantes al centro";
    if (sectionTitles[1]) sectionTitles[1].textContent = labels.saturdayMenuMain || "Principal";
    if (sectionTitles[2]) sectionTitles[2].textContent = labels.saturdayMenuDessert || "Postre";
    if (sectionTitles[3]) sectionTitles[3].textContent = labels.saturdayMenuCoffee || "Café";
    if (sectionTitles[4]) sectionTitles[4].textContent = labels.saturdayMenuDrinks || "Bebidas";
    if (itemLabels[0]) itemLabels[0].textContent = labels.saturdayMenuStarter1 || "Salmorejo";
    if (itemLabels[1]) itemLabels[1].textContent = labels.saturdayMenuStarter2 || "Ensaladilla rusa";
    if (itemLabels[2]) itemLabels[2].textContent = labels.saturdayMenuMain1 || "Paella de marisco";
    if (itemLabels[3]) itemLabels[3].textContent = labels.saturdayMenuDessert1 || "Postre de la casa";
    if (itemLabels[4]) itemLabels[4].textContent = labels.saturdayMenuCoffee1 || "Café";
    if (itemLabels[5]) itemLabels[5].textContent = labels.saturdayMenuDrink1 || "Vino";
    if (itemLabels[6]) itemLabels[6].textContent = labels.saturdayMenuDrink2 || "Cerveza";
    if (itemLabels[7]) itemLabels[7].textContent = labels.saturdayMenuDrink3 || "Agua";
    if (itemLabels[8]) itemLabels[8].textContent = labels.saturdayMenuDrink4 || "Refrescos";
    if (itemLabels[9]) itemLabels[9].textContent = labels.saturdayMenuDrink5 || "Tinto de verano";
    if (itemLabels[10]) itemLabels[10].textContent = labels.saturdayMenuDrink6 || "Vermut";
    return existingModal;
  }

  const modal = document.createElement("div");
  modal.id = SATURDAY_MENU_MODAL_ID;
  modal.className = "menu-modal";
  modal.setAttribute("hidden", "");
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="menu-modal__backdrop" data-close-saturday-menu="true"></div>
    <section class="menu-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="menu-modal-title">
      <button class="menu-modal__close-btn" type="button" aria-label="${labels.closeMenuBtn || "Cerrar menú"}" data-close-saturday-menu="true">×</button>
      <p class="menu-modal__subtitle">${labels.saturdayMenuSubtitle || "SÁBADO · 14:00"}</p>
      <h3 id="menu-modal-title" class="menu-modal__title">${labels.saturdayMenuTitle || "Almuerzo del sábado"}</h3>
      <div class="menu-modal__blocks">
        <article class="menu-modal__block">
          <h4 class="menu-modal__block-title"><span aria-hidden="true">🥣</span> <span class="menu-modal__block-title-text">${labels.saturdayMenuStarters || "Entrantes al centro"}</span></h4>
          <ul class="menu-modal__list">
            <li><span class="menu-modal__item-text">${labels.saturdayMenuStarter1 || "Salmorejo"}</span></li>
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
          <h4 class="menu-modal__block-title"><span aria-hidden="true">☕</span> <span class="menu-modal__block-title-text">${labels.saturdayMenuCoffee || "Café"}</span></h4>
          <ul class="menu-modal__list">
            <li><span class="menu-modal__item-text">${labels.saturdayMenuCoffee1 || "Café"}</span></li>
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
    </section>
  `;

  document.body.append(modal);
  return modal;
}

function ensureSaturdayDinnerSurpriseModal() {
  const locale = getLocale();
  const labels = locale.labels || {};
  const surpriseText = getSaturdayDinnerSurpriseText(labels);
  const existingModal = getSaturdayDinnerSurpriseModal();
  if (existingModal) {
    const closeButton = existingModal.querySelector(".menu-modal__close-btn");
    const subtitle = existingModal.querySelector(".menu-modal__subtitle");
    const title = existingModal.querySelector(".menu-modal__title");
    const lines = existingModal.querySelectorAll(".menu-modal__item-text");

    if (closeButton) closeButton.setAttribute("aria-label", labels.closeMenuBtn || "Cerrar menú");
    if (subtitle) subtitle.textContent = labels.saturdayDinnerSurpriseSubtitle || "SÁBADO · 21:00/21:30";
    if (title) title.textContent = labels.saturdayDinnerSurpriseTitle || "Cena con chef privado";
    if (lines[0]) lines[0].textContent = surpriseText.spanish;
    if (lines[1]) lines[1].textContent = surpriseText.italian;
    return existingModal;
  }

  const modal = document.createElement("div");
  modal.id = SATURDAY_DINNER_SURPRISE_MODAL_ID;
  modal.className = "menu-modal";
  modal.setAttribute("hidden", "");
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="menu-modal__backdrop" data-close-saturday-surprise="true"></div>
    <section class="menu-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="saturday-surprise-modal-title">
      <button class="menu-modal__close-btn" type="button" aria-label="${labels.closeMenuBtn || "Cerrar menú"}" data-close-saturday-surprise="true">×</button>
      <p class="menu-modal__subtitle">${labels.saturdayDinnerSurpriseSubtitle || "SÁBADO · 21:00/21:30"}</p>
      <h3 id="saturday-surprise-modal-title" class="menu-modal__title">${labels.saturdayDinnerSurpriseTitle || "Cena con chef privado"}</h3>
      <div class="menu-modal__blocks">
        <article class="menu-modal__block">
          <ul class="menu-modal__list">
            <li><span class="menu-modal__item-text">${surpriseText.spanish}</span></li>
            <li><span class="menu-modal__item-text">${surpriseText.italian}</span></li>
          </ul>
        </article>
      </div>
    </section>
  `;

  document.body.append(modal);
  return modal;
}

function openSaturdayMenuModal() {
  const modal = ensureSaturdayMenuModal();
  modal.removeAttribute("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("body--menu-modal-open");
  refs.bottomNav?.classList.add("bottom-nav--hidden");
}

function openSaturdayDinnerSurpriseModal() {
  const modal = ensureSaturdayDinnerSurpriseModal();
  modal.removeAttribute("hidden");
  modal.setAttribute("aria-hidden", "false");
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

function closeSaturdayDinnerSurpriseModal() {
  const modal = getSaturdayDinnerSurpriseModal();
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
    renderGuestCards();
    showScreen(refs.screenGuest);
  });

  refs.navButtons.forEach((button) => button.addEventListener("click", () => activateView(button.dataset.view)));

  refs.homeInfoStack.addEventListener("click", (event) => {
    const targetButton = event.target.closest("[data-target-view]");
    if (targetButton) activateView(targetButton.dataset.targetView);
    const detailToggle = event.target.closest("[data-home-toggle-details]");
    if (detailToggle) {
      setState({ isWeekendFormatExpanded: detailToggle.dataset.homeToggleDetails === "expand" });
      renderHomeDashboard();
    }
  });

  document.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open-saturday-menu]");
    if (openButton) {
      openSaturdayMenuModal();
      return;
    }
    const openSurpriseButton = event.target.closest("[data-open-saturday-surprise]");
    if (openSurpriseButton) {
      openSaturdayDinnerSurpriseModal();
      return;
    }
    const closeButton = event.target.closest("[data-close-saturday-menu]");
    if (closeButton) {
      closeSaturdayMenuModal();
      return;
    }
    const closeSurpriseButton = event.target.closest("[data-close-saturday-surprise]");
    if (closeSurpriseButton) closeSaturdayDinnerSurpriseModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeSaturdayMenuModal();
    closeSaturdayDinnerSurpriseModal();
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
  if (!isFirebaseConfigured() || !state.currentGuestId || !state.hasActiveGuestLock) return;
  releaseGuestProfileLock(state.currentGuestId).catch(() => {});
});

bindUIEvents();
restoreSession();
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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service Worker registration failed:", error);
    });
  });
}
