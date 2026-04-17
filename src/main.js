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

  refs.guestGrid.addEventListener("click", (event) => {
    const enterButton = event.target.closest("[data-guest-enter]");
    if (enterButton) {
      setGuest(enterButton.dataset.guestEnter);
      return;
    }
    const card = event.target.closest(".guest-card");
    if (!card) return;
    card.classList.toggle("guest-card--flipped");
    card.setAttribute("aria-pressed", card.classList.contains("guest-card--flipped") ? "true" : "false");
  });

  refs.guestGrid.addEventListener("keydown", (event) => {
    if (event.target.closest("[data-guest-enter]")) return;
    const card = event.target.closest(".guest-card");
    if (!card) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      card.classList.toggle("guest-card--flipped");
      card.setAttribute("aria-pressed", card.classList.contains("guest-card--flipped") ? "true" : "false");
    }
  });

  let activeTiltCard = null;

  refs.guestGrid.addEventListener("pointermove", (event) => {
    const card = event.target.closest(".guest-card");
    if (!card) return;
    if (activeTiltCard && activeTiltCard !== card) {
      activeTiltCard.style.setProperty("--guest-tilt-y", "0deg");
      activeTiltCard.style.setProperty("--guest-tilt-x", "0deg");
    }
    activeTiltCard = card;
    const rect = card.getBoundingClientRect();
    const relX = (event.clientX - rect.left) / rect.width;
    const relY = (event.clientY - rect.top) / rect.height;
    const tiltY = (relX - 0.5) * 18;
    const tiltX = (0.5 - relY) * 14;
    card.style.setProperty("--guest-tilt-y", `${tiltY.toFixed(2)}deg`);
    card.style.setProperty("--guest-tilt-x", `${tiltX.toFixed(2)}deg`);
    card.style.setProperty("--guest-glare-x", `${(relX * 100).toFixed(2)}%`);
    card.style.setProperty("--guest-glare-y", `${(relY * 100).toFixed(2)}%`);
  });

  refs.guestGrid.addEventListener("pointerleave", () => {
    refs.guestGrid.querySelectorAll(".guest-card").forEach((card) => {
      card.style.setProperty("--guest-tilt-y", "0deg");
      card.style.setProperty("--guest-tilt-x", "0deg");
      card.style.setProperty("--guest-glare-x", "50%");
      card.style.setProperty("--guest-glare-y", "28%");
    });
    activeTiltCard = null;
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
