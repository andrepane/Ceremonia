import { refs } from "../state.js";

const SHOW_MIN_MS = 4000;
const SHOW_MAX_MS = 6000;
const RETRY_WHILE_TYPING_MS = 12000;
const SESSION_INTERVAL_MS = 2 * 60 * 1000;

const STORAGE_KEYS = {
  hasSeenWelcome: "maya_has_seen_welcome",
  profileEntryCount: "maya_profile_entry_count"
};

const WELCOME_MESSAGE = "Hola, soy Maya, tu asistente perruno";

const ENTRY_RULES = [
  { every: 3, message: "Si cae algo al suelo… es mío." },
  { every: 5, message: "Yo ya lo sabía desde el principio." },
  { every: 8, message: "Estoy vigilando. Todo en orden." }
];

const SESSION_MESSAGES = [
  "Creo que esto va en serio.",
  "Se quieren. Se nota hasta aquí.",
  "Estoy supervisando todo. De momento… aprobado."
];

let hideTimeoutId = null;
let nextSessionMessageTimeoutId = null;
let sessionMessageIndex = 0;

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
  if (nextSessionMessageTimeoutId) window.clearTimeout(nextSessionMessageTimeoutId);
  hideTimeoutId = null;
  nextSessionMessageTimeoutId = null;
}

function hideAssistant() {
  refs.mayaAssistant?.classList.remove("maya-assistant--visible");
  refs.mayaAssistant?.setAttribute("aria-hidden", "true");
}

function canDisplayAssistantNow() {
  return Boolean(refs.mayaAssistant && refs.mayaAssistantBubble && refs.screenApp?.classList.contains("screen--active"));
}

function scheduleNextSessionMessage() {
  if (!canDisplayAssistantNow()) return;
  nextSessionMessageTimeoutId = window.setTimeout(() => {
    const message = SESSION_MESSAGES[sessionMessageIndex % SESSION_MESSAGES.length];
    sessionMessageIndex += 1;
    showAssistantMessage(message);
  }, SESSION_INTERVAL_MS);
}

function showAssistantMessage(message, { immediate = false } = {}) {
  if (!canDisplayAssistantNow()) return;

  if (isUserTyping()) {
    nextSessionMessageTimeoutId = window.setTimeout(() => showAssistantMessage(message, { immediate }), RETRY_WHILE_TYPING_MS);
    return;
  }

  if (hideTimeoutId) {
    window.clearTimeout(hideTimeoutId);
    hideTimeoutId = null;
  }

  refs.mayaAssistantBubble.textContent = message;
  refs.mayaAssistant.classList.add("maya-assistant--visible");
  refs.mayaAssistant.setAttribute("aria-hidden", "false");

  const visibleMs = immediate ? SHOW_MIN_MS : getRandomInt(SHOW_MIN_MS, SHOW_MAX_MS);
  hideTimeoutId = window.setTimeout(() => {
    hideAssistant();
    scheduleNextSessionMessage();
  }, visibleMs);
}

function getStoredNumber(key) {
  const rawValue = localStorage.getItem(key);
  const parsed = Number.parseInt(rawValue ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function getEntryMessage(entryCount) {
  for (const rule of ENTRY_RULES) {
    if (entryCount % rule.every === 0) return rule.message;
  }
  return null;
}

function getStartMessage() {
  const nextEntryCount = getStoredNumber(STORAGE_KEYS.profileEntryCount) + 1;
  localStorage.setItem(STORAGE_KEYS.profileEntryCount, String(nextEntryCount));

  const hasSeenWelcome = localStorage.getItem(STORAGE_KEYS.hasSeenWelcome) === "true";
  if (!hasSeenWelcome) {
    localStorage.setItem(STORAGE_KEYS.hasSeenWelcome, "true");
    return WELCOME_MESSAGE;
  }

  return getEntryMessage(nextEntryCount);
}

export function startMayaAssistantCycle() {
  clearTimers();
  const startMessage = getStartMessage();
  if (startMessage) {
    showAssistantMessage(startMessage, { immediate: true });
  } else {
    hideAssistant();
    scheduleNextSessionMessage();
  }
}

export function stopMayaAssistantCycle() {
  clearTimers();
  hideAssistant();
}
