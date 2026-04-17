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
import { renderAllDynamicSections, renderGuestCards, renderHomeDashboard, updateGuestHeaderMessage, updateProfileAvatar, updateWelcomeLabel } from "./ui/render.js";
import { handleSpeakTranslation, handleTranslatorRequest } from "./features/translator.js";
import { handlePhotoGridClick, handleUploadPhoto } from "./features/photos.js";
import { renderTimeline, updateCountdown } from "./features/timeline.js";
import { initFirebaseListeners } from "./integrations/firebase-sync.js";

const rotatorSyncGroups = new Map();
const ENTRY_TRANSITION_EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const ENTRY_TRANSITION_DURATION_MS = 420;
let isGuestEntryTransitionRunning = false;

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

function showScreen(screenToShow) {
  [refs.screenLanguage, refs.screenGuest, refs.screenApp].forEach((screen) => screen.classList.remove("screen--active"));
  screenToShow.classList.add("screen--active");
  document.body.classList.toggle("body--language-locked", screenToShow === refs.screenLanguage);
  scrollViewportToTop();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextAnimationFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(resolve));
}

function waitForTransitionEnd(element, timeoutMs = ENTRY_TRANSITION_DURATION_MS + 80) {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      element.removeEventListener("transitionend", handleTransitionEnd);
      window.clearTimeout(timeoutId);
      resolve();
    };
    const handleTransitionEnd = (event) => {
      if (event.target !== element) return;
      finish();
    };
    const timeoutId = window.setTimeout(finish, timeoutMs);
    element.addEventListener("transitionend", handleTransitionEnd);
  });
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
  const syncController = syncGroup ? getRotatorSyncGroup(syncGroup, { pauseMs, transitionMs }) : null;

  function syncLockedWidth() {
    if (!lockMaxItemWidth) return;
    const items = track.querySelectorAll(itemSelector);
    if (!items.length) return;
    const maxWidth = Array.from(items).reduce((currentMax, item) => Math.max(currentMax, item.getBoundingClientRect().width), 0);
    if (maxWidth > 0) rotator.style.width = `${Math.ceil(maxWidth)}px`;
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

  window.addEventListener("resize", syncLockedWidth);
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

function activateView(viewName) {
  refs.views.forEach((view) => view.classList.remove("view--active"));
  refs.navButtons.forEach((button) => button.classList.remove("nav-btn--active"));
  const targetView = document.getElementById(`view-${viewName}`);
  const targetButton = document.querySelector(`[data-view="${viewName}"]`);
  if (targetView) targetView.classList.add("view--active");
  if (targetButton) targetButton.classList.add("nav-btn--active");
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
    return true;
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
        return false;
      }
      alert(getHomeCopy().authError);
      return false;
    }
  }

  setState({ currentGuestId: guestId });
  localStorage.setItem("wedding_guest", guestId);
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
    updateCountdown();
  });

  if (isFirebaseConfigured()) {
    try {
      await linkGuestToAuth(guestId);
    } catch {
      alert(getHomeCopy().authError);
    }
  }

  return true;
}

async function animateGuestCardTransition(guestCard, guestId) {
  if (!guestCard || isGuestEntryTransitionRunning) {
    setGuest(guestId);
    return;
  }

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reducedMotionQuery.matches) {
    await setGuest(guestId);
    return;
  }

  const cardRect = guestCard.getBoundingClientRect();
  if (!cardRect.width || !cardRect.height) {
    await setGuest(guestId);
    return;
  }

  isGuestEntryTransitionRunning = true;
  const transitionLayer = document.createElement("div");
  transitionLayer.className = "guest-card-shared-transition";
  transitionLayer.setAttribute("aria-hidden", "true");

  const clonedCard = guestCard.cloneNode(true);
  clonedCard.classList.add("guest-card-shared-transition__card");
  clonedCard.classList.remove("guest-card--flipped");
  clonedCard.style.minHeight = `${Math.round(cardRect.height)}px`;
  clonedCard.style.width = "100%";
  clonedCard.style.height = "100%";
  clonedCard.style.pointerEvents = "none";
  transitionLayer.append(clonedCard);
  document.body.append(transitionLayer);

  guestCard.classList.add("guest-card--entering");
  refs.screenApp.classList.add("screen--entry-transition-pending");

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const sourceCenterX = cardRect.left + cardRect.width / 2;
  const sourceCenterY = cardRect.top + cardRect.height / 2;
  const targetCenterX = viewportWidth / 2;
  const targetCenterY = viewportHeight / 2;
  const translateX = sourceCenterX - targetCenterX;
  const translateY = sourceCenterY - targetCenterY;
  const scaleX = cardRect.width / viewportWidth;
  const scaleY = cardRect.height / viewportHeight;

  transitionLayer.style.setProperty("--entry-translate-x", `${translateX}px`);
  transitionLayer.style.setProperty("--entry-translate-y", `${translateY}px`);
  transitionLayer.style.setProperty("--entry-scale-x", `${scaleX}`);
  transitionLayer.style.setProperty("--entry-scale-y", `${scaleY}`);
  transitionLayer.style.setProperty("--entry-duration", `${ENTRY_TRANSITION_DURATION_MS}ms`);
  transitionLayer.style.setProperty("--entry-ease", ENTRY_TRANSITION_EASE);

  guestCard.style.visibility = "hidden";
  document.body.classList.add("body--entry-transition");

  await nextAnimationFrame();
  transitionLayer.classList.add("guest-card-shared-transition--feedback");
  await delay(90);

  const setGuestPromise = setGuest(guestId);
  transitionLayer.classList.remove("guest-card-shared-transition--feedback");
  transitionLayer.classList.add("guest-card-shared-transition--expanding");
  await waitForTransitionEnd(transitionLayer);
  const wasGuestSet = await setGuestPromise;

  const transitionSucceeded = Boolean(wasGuestSet && state.currentGuestId === guestId);
  if (transitionSucceeded) {
    refs.screenApp.classList.add("screen--entry-transition-active");
    await nextAnimationFrame();
    refs.screenApp.classList.remove("screen--entry-transition-pending");
    await delay(190);
  } else {
    refs.screenApp.classList.remove("screen--entry-transition-pending");
    refs.screenApp.classList.remove("screen--entry-transition-active");
    guestCard.style.visibility = "";
  }

  transitionLayer.remove();
  guestCard.classList.remove("guest-card--entering");
  if (transitionSucceeded) {
    guestCard.style.visibility = "";
    window.setTimeout(() => refs.screenApp.classList.remove("screen--entry-transition-active"), 260);
  }
  document.body.classList.remove("body--entry-transition");
  isGuestEntryTransitionRunning = false;
}

function restoreSession() {
  const savedLang = localStorage.getItem("wedding_lang");
  const savedGuestId = localStorage.getItem("wedding_guest");
  if (savedLang && APP_DATA.translations[savedLang]) setState({ currentLanguage: savedLang });
  applyTranslations();
  renderAllDynamicSections();
  highlightSelectedLanguage();

  if (savedGuestId && findGuestById(savedGuestId)) {
    setState({ currentGuestId: savedGuestId });
    refs.selectedGuestName.textContent = findGuestById(savedGuestId).name;
    updateWelcomeLabel();
    updateGuestHeaderMessage();
    updateProfileAvatar();
    renderTimeline();
    renderHomeDashboard();
    showScreen(refs.screenApp);
    return;
  }

  updateProfileAvatar();
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

  ["false-friends"].forEach((id) => {
    const toggle = document.getElementById(`${id}-toggle`);
    const content = document.getElementById(`${id}-list`);
    toggle.addEventListener("click", () => {
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", isExpanded ? "false" : "true");
      content.hidden = isExpanded;
    });
  });

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

  refs.guestGrid.addEventListener("click", (event) => {
    const enterButton = event.target.closest("[data-guest-enter]");
    if (enterButton) {
      const card = enterButton.closest(".guest-card");
      animateGuestCardTransition(card, enterButton.dataset.guestEnter);
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
updateCountdown();
setInterval(updateCountdown, 60000);
initFirebaseListeners(() => showScreen(refs.screenGuest));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service Worker registration failed:", error);
    });
  });
}
