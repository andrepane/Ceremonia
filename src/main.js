import {
  ensureAuth,
  isFirebaseConfigured,
  linkGuestToAuth,
  lockGuestProfile,
  releaseGuestProfileLock,
  switchGuestProfileLock
} from "../firebase.js";
import { APP_DATA, refs, state, setState, findGuestById, getHomeCopy } from "./state.js";
import { applyTranslations } from "./ui/translations.js";
import { handleUsefulPhraseSpeakClick, renderAllDynamicSections, renderDictionary, renderGuestCards, renderHomeDashboard, updateAppHeaderForView, updateGuestHeaderMessage, updateProfileAvatar, updateWelcomeLabel } from "./ui/render.js";
import { handleSpeakTranslation, handleTranslatorRequest } from "./features/translator.js";
import { handlePhotoGridClick, handlePhotoInputChange, handleUploadPhoto, highlightPhotoFromActivity } from "./features/photos.js";
import { startPhotoUploadQueue } from "./features/photo-upload-queue.js";
import { renderTimeline, updateCountdown } from "./features/timeline.js";
import { initInstallOnboardingGate } from "./features/onboarding.js";
import { initFirebaseListeners } from "./integrations/firebase-sync.js";
import { getBookModal, loadGuestFont } from "./ui/BookModal.js";
import {
  closeFridayDinnerMenuModal,
  closePrivateDinnerSurpriseModal,
  closeSaturdayBreakfastMenuModal,
  closeSaturdayMenuModal,
  closeSundayBreakfastMenuModal,
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
  console.log("[GUEST][before switch]", {
    from: state.currentGuestId,
    to: guestId
  });
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
  console.log("[GUEST][after switch]", {
    currentGuestId: state.currentGuestId,
    localStorageGuest: localStorage.getItem("wedding_guest")
  });
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


function handleMenuClick(event) {
  const openFridayDinnerButton = event.target.closest("[data-open-friday-dinner-menu]");
  if (openFridayDinnerButton) return void openFridayDinnerMenuModal();
  const openSaturdayBreakfastButton = event.target.closest("[data-open-saturday-breakfast-menu]");
  if (openSaturdayBreakfastButton) return void openSaturdayBreakfastMenuModal();
  const openSaturdayButton = event.target.closest("[data-open-saturday-menu]");
  if (openSaturdayButton) return void openSaturdayMenuModal();
  const openPrivateDinnerButton = event.target.closest("[data-open-private-dinner-surprise]");
  if (openPrivateDinnerButton) return void openPrivateDinnerSurpriseModal();
  const openSundayBreakfastButton = event.target.closest("[data-open-sunday-breakfast-menu]");
  if (openSundayBreakfastButton) return void openSundayBreakfastMenuModal();

  const closeFridayDinnerButton = event.target.closest("[data-close-friday-dinner-menu]");
  if (closeFridayDinnerButton) return void closeFridayDinnerMenuModal();
  const closeSaturdayBreakfastButton = event.target.closest("[data-close-saturday-breakfast-menu]");
  if (closeSaturdayBreakfastButton) return void closeSaturdayBreakfastMenuModal();
  const closeSaturdayButton = event.target.closest("[data-close-saturday-menu]");
  if (closeSaturdayButton) return void closeSaturdayMenuModal();
  const closeSundayBreakfastButton = event.target.closest("[data-close-sunday-breakfast-menu]");
  if (closeSundayBreakfastButton) return void closeSundayBreakfastMenuModal();
  const closePrivateDinnerButton = event.target.closest("[data-close-private-dinner-surprise]");
  if (closePrivateDinnerButton) closePrivateDinnerSurpriseModal();
}

function handleActivityClick(event) {
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

  refs.homeInfoStack.addEventListener("click", handleActivityClick);
  document.addEventListener("click", handleMenuClick);

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
  refs.photoInput?.addEventListener("change", handlePhotoInputChange);
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

function initApp() {
  bindUIEvents();
  startPhotoUploadQueue();
  restoreSession();
  startGuestbookIconAlternation();
  initHeroRotator();
  initHeroDateRotator();
  activateView("home");
  updateCountdown();
  setInterval(updateCountdown, 1000);
  initFirebaseListeners(() => showScreen(refs.screenGuest));
}

const isInstallGateBlocking = initInstallOnboardingGate();
applyConnectionState({ online: navigator.onLine });
window.addEventListener("online", () => applyConnectionState({ online: true }));
window.addEventListener("offline", () => applyConnectionState({ online: false }));
window.addEventListener("resize", () => {
  const activeButton = document.querySelector(".nav-btn--active");
  if (activeButton) syncBottomNavIndicator(activeButton);
});

initApp();
if (isInstallGateBlocking) showScreen(refs.screenLanguage);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service Worker registration failed:", error);
    });
  });
}
