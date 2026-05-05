import { refs } from "../state.js";

const SHOW_MIN_MS = 4000;
const SHOW_MAX_MS = 6000;
const INTERVAL_MIN_MS = 6 * 60 * 1000;
const INTERVAL_MAX_MS = 10 * 60 * 1000;
const RETRY_WHILE_TYPING_MS = 12000;
const MESSAGES = ["¡Guau! Ya estás dentro, te acompaño un ratito 🐾"];

let hideTimeoutId = null;
let nextAppearanceTimeoutId = null;

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isUserTyping() {
  const activeElement = document.activeElement;
  if (!activeElement) return false;
  if (activeElement instanceof HTMLTextAreaElement) return !activeElement.readOnly && !activeElement.disabled;
  if (activeElement instanceof HTMLInputElement) {
    const inputType = (activeElement.type || "text").toLowerCase();
    const nonTypingTypes = new Set(["button", "submit", "reset", "checkbox", "radio", "file", "color", "range"]);
    return !activeElement.readOnly && !activeElement.disabled && !nonTypingTypes.has(inputType);
  }
  return activeElement.isContentEditable;
}

function clearTimers() {
  if (hideTimeoutId) window.clearTimeout(hideTimeoutId);
  if (nextAppearanceTimeoutId) window.clearTimeout(nextAppearanceTimeoutId);
  hideTimeoutId = null;
  nextAppearanceTimeoutId = null;
}

function hideAssistant() {
  refs.mayaAssistant?.classList.remove("maya-assistant--visible");
  refs.mayaAssistant?.setAttribute("aria-hidden", "true");
}

function scheduleAppearance() {
  if (!refs.mayaAssistant || !refs.screenApp?.classList.contains("screen--active")) return;
  const waitMs = getRandomInt(INTERVAL_MIN_MS, INTERVAL_MAX_MS);
  nextAppearanceTimeoutId = window.setTimeout(() => showAssistant(), waitMs);
}

function showAssistant({ immediate = false } = {}) {
  if (!refs.mayaAssistant || !refs.mayaAssistantBubble) return;
  if (!refs.screenApp?.classList.contains("screen--active")) return;
  if (isUserTyping()) {
    nextAppearanceTimeoutId = window.setTimeout(() => showAssistant(), RETRY_WHILE_TYPING_MS);
    return;
  }

  clearTimers();
  refs.mayaAssistantBubble.textContent = MESSAGES[getRandomInt(0, MESSAGES.length - 1)];
  refs.mayaAssistant.classList.add("maya-assistant--visible");
  refs.mayaAssistant.setAttribute("aria-hidden", "false");

  const visibleMs = immediate ? SHOW_MIN_MS : getRandomInt(SHOW_MIN_MS, SHOW_MAX_MS);
  hideTimeoutId = window.setTimeout(() => {
    hideAssistant();
    scheduleAppearance();
  }, visibleMs);
}

export function startMayaAssistantCycle() {
  clearTimers();
  showAssistant({ immediate: true });
}

export function stopMayaAssistantCycle() {
  clearTimers();
  hideAssistant();
}
