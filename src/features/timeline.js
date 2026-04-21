import { APP_DATA, constants, refs, state, getLocale, getHomeCopy } from "../state.js";

function updateFlipUnit(unitName, value, label) {
  const unitElement = refs.countdownElement.querySelector(`[data-unit="${unitName}"]`);
  if (!unitElement) return;
  const digitElement = unitElement.querySelector(".flip-clock__digit");
  const labelElement = unitElement.querySelector(".flip-clock__label");
  const nextValue = String(value).padStart(2, "0");
  if (labelElement && label) labelElement.textContent = String(label).toUpperCase();
  if (!digitElement) return;
  if (digitElement.textContent === nextValue) return;
  digitElement.textContent = nextValue;
  unitElement.classList.remove("is-flipping");
  void unitElement.offsetWidth;
  unitElement.classList.add("is-flipping");
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
  const timelineItems = getGuestTimelineItems(locale).map(({ item }) => item);
  document.getElementById("timeline").innerHTML = timelineItems
    .map((item) => `<article class="timeline-item"><span class="timeline-day">${item.day}</span><h4 class="timeline-title">${item.title}</h4><p class="timeline-text">${item.text}</p><span class="status-tag status-tag--${item.tone}">${item.status}</span></article>`)
    .join("");
}

export function updateCountdown() {
  const ceremonyDate = new Date(APP_DATA.ceremonyDate);
  const now = new Date();
  const diff = ceremonyDate - now;
  const locale = getLocale();
  const copy = getHomeCopy();
  const phase = getHomePhase();
  refs.countdownHintElement.textContent = copy.moments?.[phase] || locale.labels.countdownHint;
  refs.countdownNextEventLabelElement.textContent = copy.nextEventLabel;
  const nextEvent = getNextTimelineEvent();
  refs.countdownNextEventElement.textContent = nextEvent ? `${nextEvent.title} · ${nextEvent.day}` : copy.nextEventFallback;

  if (diff <= 0) {
    refs.countdownElement.textContent = locale.labels.countdownStarted;
    refs.countdownUrgencyElement.textContent = "";
    refs.countdownUrgencyElement.classList.remove("is-visible");
    refs.countdownElement.classList.remove("countdown--urgent");
    refs.countdownElement.classList.add("countdown--finished");
    document.querySelector(".hero-panel")?.classList.remove("hero-panel--urgent");
    return;
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;
  const units = copy.countdownUnits || { days: "días", hours: "horas", minutes: "minutos", seconds: "segundos" };
  refs.countdownElement.classList.remove("countdown--finished");
  updateFlipUnit("days", days, units.days);
  updateFlipUnit("hours", hours, units.hours);
  updateFlipUnit("minutes", minutes, units.minutes);
  updateFlipUnit("seconds", seconds, units.seconds);
  const isUrgent = diff < 24 * 60 * 60 * 1000;
  document.querySelector(".hero-panel")?.classList.toggle("hero-panel--urgent", isUrgent);
  refs.countdownElement.classList.toggle("countdown--urgent", isUrgent);
  refs.countdownUrgencyElement.classList.toggle("is-visible", isUrgent);
  refs.countdownUrgencyElement.textContent = isUrgent ? copy.countdownUrgency : "";
}
