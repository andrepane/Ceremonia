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
import { getBookModal, loadGuestFont } from "./ui/BookModal.js";
import {
  closeFridayDinnerMenuModal,
  closePrivateDinnerSurpriseModal,
  closeSaturdayBreakfastMenuModal,
  closeSaturdayMenuModal,
  closeSundayBreakfastMenuModal,
  ensureFridayDinnerMenuModal,
  ensurePrivateDinnerSurpriseModal,
  ensureSaturdayBreakfastMenuModal,
  ensureSaturdayMenuModal,
  ensureSundayBreakfastMenuModal,
  getFridayDinnerMenuModal,
  getMenuCoverTitle,
  getPrivateDinnerSurpriseModal,
  getPrivateDinnerSurpriseText,
  getSaturdayBreakfastMenuModal,
  getSaturdayMenuModal,
  getSundayBreakfastMenuModal,
  openFridayDinnerMenuModal,
  openPrivateDinnerSurpriseModal,
  openSaturdayBreakfastMenuModal,
  openSaturdayMenuModal,
  openSundayBreakfastMenuModal
} from "./ui/menuModals.js";
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
const GUESTBOOK_AVATAR_VISIBLE_MS = 2500;
const GUESTBOOK_BOOK_VISIBLE_MS = 3500;

let guestbookIconSwapTimeoutId = null;
const OFFLINE_CACHE_KEYS = {
  activity: "ceremonia_cache_activity_v1",
  photos: "ceremonia_cache_photos_v1"
};

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
  loadGuestFont(guestId);
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
    loadGuestFont(savedGuestId);
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
  if (guestbookIconSwapTimeoutId) {
    window.clearTimeout(guestbookIconSwapTimeoutId);
    guestbookIconSwapTimeoutId = null;
  }
}

function scheduleGuestbookIconSwap(showBookNext) {
  const waitMs = showBookNext ? GUESTBOOK_AVATAR_VISIBLE_MS : GUESTBOOK_BOOK_VISIBLE_MS;
  guestbookIconSwapTimeoutId = window.setTimeout(() => {
    if (!refs.guestbookTrigger || refs.guestbookTrigger.hidden) {
      stopGuestbookIconAlternation();
      return;
    }
    refs.guestbookTrigger.classList.toggle("guestbook-trigger--show-book", showBookNext);
    scheduleGuestbookIconSwap(!showBookNext);
  }, waitMs);
}

function startGuestbookIconAlternation() {
  if (!refs.guestbookTrigger || refs.guestbookTrigger.hidden) {
    stopGuestbookIconAlternation();
    return;
  }
  stopGuestbookIconAlternation();
  refs.guestbookTrigger.classList.remove("guestbook-trigger--show-book");
  scheduleGuestbookIconSwap(true);
}

function bindUIEvents() {
  refs.uploadPhotoBtn?.setAttribute("data-requires-network", "true");
  refs.translatorButton?.setAttribute("data-requires-network", "true");
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

function ensureOfflineBanner() {
  let banner = document.querySelector("[data-offline-banner]");
  if (banner) return banner;
  banner = document.createElement("div");
  banner.className = "offline-banner";
  banner.setAttribute("data-offline-banner", "true");
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");
  banner.textContent = "Sin conexión. Mostrando última versión disponible";
  document.body.append(banner);
  return banner;
}

function updateConnectionDependentControls(isOffline) {
  document.querySelectorAll("[data-requires-network], [data-guest-enter]").forEach((element) => {
    if (!(element instanceof HTMLButtonElement)) return;
    element.disabled = isOffline;
    element.classList.toggle("network-disabled", isOffline);
  });
}

function applyConnectionState({ online, forceOfflineUi = false } = {}) {
  const isOnline = typeof online === "boolean" ? online : navigator.onLine;
  const isOffline = forceOfflineUi || !isOnline;
  document.body.classList.toggle("offline", isOffline);
  document.body.classList.toggle("online", !isOffline);
  ensureOfflineBanner();
  updateConnectionDependentControls(isOffline);
}

window.setOfflineUiState = () => applyConnectionState({ forceOfflineUi: true });
window.saveOfflineSnapshot = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify({ value, updatedAt: Date.now() }));
  } catch {}
};
window.readOfflineSnapshot = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw)?.value ?? null;
  } catch {
    return null;
  }
};
window.OFFLINE_CACHE_KEYS = OFFLINE_CACHE_KEYS;

window.addEventListener("beforeunload", () => {
  stopGuestbookIconAlternation();
  if (!isFirebaseConfigured() || !state.currentGuestId || !state.hasActiveGuestLock) return;
  releaseGuestProfileLock(state.currentGuestId).catch(() => {});
});

const isInstallGateBlocking = initInstallOnboardingGate();
applyConnectionState({ online: navigator.onLine });
window.addEventListener("online", () => applyConnectionState({ online: true }));
window.addEventListener("offline", () => applyConnectionState({ online: false }));

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
