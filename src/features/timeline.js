import { APP_DATA, constants, refs, state, getLocale, getHomeCopy } from "../state.js";

const MOMENT_ROTATION_STORAGE_KEY = "wedding_moment_rotation_v1";
const APP_SESSION_ID = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function readMomentRotationStore() {
  try {
    const raw = localStorage.getItem(MOMENT_ROTATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMomentRotationStore(store) {
  try {
    localStorage.setItem(MOMENT_ROTATION_STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

function pickNextVariantIndex(previousIndex, totalVariants) {
  if (totalVariants <= 1) return 0;
  if (previousIndex < 0 || previousIndex >= totalVariants) return Math.floor(Math.random() * totalVariants);
  const randomIndex = Math.floor(Math.random() * (totalVariants - 1));
  return randomIndex >= previousIndex ? randomIndex + 1 : randomIndex;
}

function getMomentHintByPhase(phase, copy, locale) {
  const fallback = copy.moments?.[phase] || locale.labels.countdownHint;
  const variants = copy.momentVariants?.[phase];
  if (!Array.isArray(variants) || !variants.length) return fallback;
  if (!state.currentGuestId) return variants[0];

  const store = readMomentRotationStore();
  const guestStore = store[state.currentGuestId] || {};
  const previousByPhase = guestStore.indexByPhase || {};
  const lastSessionId = guestStore.lastSessionId;

  if (lastSessionId !== APP_SESSION_ID) {
    const previousIndex = Number.isInteger(previousByPhase[phase]) ? previousByPhase[phase] : -1;
    previousByPhase[phase] = pickNextVariantIndex(previousIndex, variants.length);
    store[state.currentGuestId] = {
      ...guestStore,
      lastSessionId: APP_SESSION_ID,
      indexByPhase: previousByPhase
    };
    writeMomentRotationStore(store);
  }

  const selectedIndex = Number.isInteger(previousByPhase[phase]) ? previousByPhase[phase] : 0;
  return variants[selectedIndex] || fallback;
}

export function getHomePhase() {
  const ceremonyDate = new Date(APP_DATA.ceremonyDate);
  const weekendStart = new Date(ceremonyDate);
  weekendStart.setDate(weekendStart.getDate() - 1);
  weekendStart.setHours(0, 0, 0, 0);
  const weekendEnd = new Date(ceremonyDate);
  weekendEnd.setDate(weekendEnd.getDate() + 1);
  weekendEnd.setHours(23, 59, 59, 999);
  const now = new Date();
  if (now < weekendStart) return "pre";
  if (now <= weekendEnd) return "live";
  return "post";
}

export function getGuestTimelineItems(locale = getLocale()) {
  const fullTimeline = locale.timeline || [];
  const withIndexes = fullTimeline.map((item, index) => ({ item, index }));
  return constants.SATURDAY_ONLY_GUEST_IDS.has(state.currentGuestId)
    ? withIndexes.slice(constants.FRIDAY_TIMELINE_ITEMS_TO_HIDE)
    : withIndexes;
}

export function getTimelineDateByIndex(index) {
  const slot = constants.WEEKEND_TIMELINE_STARTS[index];
  if (!slot) return null;
  const ceremonyDate = new Date(APP_DATA.ceremonyDate);
  const eventDate = new Date(ceremonyDate);
  eventDate.setDate(eventDate.getDate() + slot.dayOffset);
  eventDate.setHours(slot.hour, slot.minute, 0, 0);
  return eventDate;
}

export function getNextTimelineEvent() {
  const timelineWithIndexes = getGuestTimelineItems();
  const now = new Date();
  for (const entry of timelineWithIndexes) {
    const eventDate = getTimelineDateByIndex(entry.index);
    if (eventDate && eventDate.getTime() > now.getTime()) return entry.item;
  }
  return null;
}

export function renderTimeline() {
  const locale = getLocale();
  const timelineItems = getGuestTimelineItems(locale);
  document.getElementById("timeline").innerHTML = timelineItems
    .map(({ item, index }) => {
      const isSaturdayLunch = index === 5;
      return `<article class="timeline-item"><span class="timeline-day">${item.day}</span><h4 class="timeline-title">${item.title}</h4><p class="timeline-text">${item.text}</p>${isSaturdayLunch ? `<button class="timeline-menu-btn" type="button" data-open-saturday-menu="true">Ver menú</button>` : ""}<span class="status-tag status-tag--${item.tone}">${item.status}</span></article>`;
    })
    .join("");
}

export function updateCountdown() {
  const ceremonyDate = new Date(APP_DATA.ceremonyDate);
  const now = new Date();
  const diff = ceremonyDate - now;
  const locale = getLocale();
  const copy = getHomeCopy();
  const phase = getHomePhase();
  refs.countdownHintElement.textContent = getMomentHintByPhase(phase, copy, locale);
  refs.countdownNextEventLabelElement.textContent = copy.nextEventLabel;
  const nextEvent = getNextTimelineEvent();
  refs.countdownNextEventElement.textContent = nextEvent ? `${nextEvent.title} · ${nextEvent.day}` : copy.nextEventFallback;

  if (diff <= 0) {
    refs.countdownElement.textContent = locale.labels.countdownStarted;
    refs.countdownUrgencyElement.textContent = "";
    refs.countdownUrgencyElement.classList.remove("is-visible");
    refs.countdownElement.classList.remove("countdown--urgent");
    document.querySelector(".hero-panel")?.classList.remove("hero-panel--urgent");
    return;
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;
  const units = copy.countdownUnits || { days: "d", hours: "h", minutes: "m", seconds: "s" };
  refs.countdownElement.innerHTML = `
    <div class="countdown__unit">
      <span class="countdown__value">${String(days).padStart(2, "0")}</span>
      <span class="countdown__label">${units.days}</span>
    </div>
    <div class="countdown__unit">
      <span class="countdown__value">${String(hours).padStart(2, "0")}</span>
      <span class="countdown__label">${units.hours}</span>
    </div>
    <div class="countdown__unit">
      <span class="countdown__value">${String(minutes).padStart(2, "0")}</span>
      <span class="countdown__label">${units.minutes}</span>
    </div>
    <div class="countdown__unit">
      <span class="countdown__value">${String(seconds).padStart(2, "0")}</span>
      <span class="countdown__label">${units.seconds}</span>
    </div>
  `;
  const isUrgent = diff < 24 * 60 * 60 * 1000;
  document.querySelector(".hero-panel")?.classList.toggle("hero-panel--urgent", isUrgent);
  refs.countdownElement.classList.toggle("countdown--urgent", isUrgent);
  refs.countdownUrgencyElement.classList.toggle("is-visible", isUrgent);
  refs.countdownUrgencyElement.textContent = isUrgent ? copy.countdownUrgency : "";
}
