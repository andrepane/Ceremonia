import { isFirebaseConfigured, subscribeGuestDictionary, upsertGuestDictionary } from "../../firebase.js";
import { refs, state, setState, getLocale } from "../state.js";

const DICTIONARY_STORAGE_KEY = "wedding_dictionary_state_v1";

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && typeof item.sourceText === "string" && typeof item.translatedText === "string")
    .map((item) => ({ sourceText: item.sourceText, translatedText: item.translatedText, updatedAt: item.updatedAt || Date.now() }))
    .slice(0, 5);
}

function normalizeCurrentTranslation(entry) {
  if (!entry || typeof entry.sourceText !== "string" || typeof entry.translatedText !== "string") return null;
  return {
    sourceText: entry.sourceText,
    translatedText: entry.translatedText,
    sourceLang: entry.sourceLang || "es",
    targetLang: entry.targetLang || "it",
    updatedAt: entry.updatedAt || Date.now()
  };
}

function readDictionaryCache() {
  try {
    const raw = localStorage.getItem(DICTIONARY_STORAGE_KEY);
    if (!raw) return { historyByGuest: {}, currentByGuest: {} };
    const parsed = JSON.parse(raw);
    return {
      historyByGuest: parsed?.historyByGuest && typeof parsed.historyByGuest === "object" ? parsed.historyByGuest : {},
      currentByGuest: parsed?.currentByGuest && typeof parsed.currentByGuest === "object" ? parsed.currentByGuest : {}
    };
  } catch {
    return { historyByGuest: {}, currentByGuest: {} };
  }
}

function writeDictionaryCache({ historyByGuest, currentByGuest }) {
  localStorage.setItem(
    DICTIONARY_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      historyByGuest,
      currentByGuest,
      updatedAt: Date.now()
    })
  );
}

export function restoreDictionaryCache() {
  const cached = readDictionaryCache();
  const normalizedHistoryByGuest = Object.entries(cached.historyByGuest).reduce((acc, [guestId, history]) => {
    acc[guestId] = normalizeHistory(history);
    return acc;
  }, {});
  const normalizedCurrentByGuest = Object.entries(cached.currentByGuest).reduce((acc, [guestId, current]) => {
    acc[guestId] = normalizeCurrentTranslation(current);
    return acc;
  }, {});

  setState({
    translationHistoryByGuest: normalizedHistoryByGuest,
    currentTranslationByGuest: normalizedCurrentByGuest
  });
}

export function persistDictionaryCache() {
  writeDictionaryCache({
    historyByGuest: state.translationHistoryByGuest,
    currentByGuest: state.currentTranslationByGuest
  });
}

function updateTranslatorDisplayForGuest(guestId) {
  const locale = getLocale();
  const currentTranslation = state.currentTranslationByGuest[guestId] || null;
  if (currentTranslation?.translatedText) {
    refs.translatorText.textContent = currentTranslation.translatedText;
    refs.translatorText.classList.add("translator-result--highlight");
    return;
  }
  refs.translatorText.textContent = locale.labels.translatorText;
  refs.translatorText.classList.remove("translator-result--highlight");
}

export function renderCurrentTranslationForGuest(guestId = state.currentGuestId) {
  updateTranslatorDisplayForGuest(guestId);
}

export async function saveGuestDictionaryState({ guestId, history, currentTranslation }) {
  if (!guestId) return;

  const normalizedHistory = normalizeHistory(history);
  const normalizedCurrent = normalizeCurrentTranslation(currentTranslation);

  setState({
    translationHistoryByGuest: {
      ...state.translationHistoryByGuest,
      [guestId]: normalizedHistory
    },
    currentTranslationByGuest: {
      ...state.currentTranslationByGuest,
      [guestId]: normalizedCurrent
    }
  });
  persistDictionaryCache();

  if (!isFirebaseConfigured()) return;
  try {
    await upsertGuestDictionary(guestId, {
      history: normalizedHistory,
      currentTranslation: normalizedCurrent
    });
  } catch {
    // Cache local already persisted; retry on next successful action.
  }
}

export function stopGuestDictionarySync() {
  state.unsubscribeDictionary();
  setState({ unsubscribeDictionary: () => {} });
}

export function startGuestDictionarySync(guestId) {
  stopGuestDictionarySync();
  if (!guestId || !isFirebaseConfigured()) {
    renderCurrentTranslationForGuest(guestId);
    return;
  }

  setState({
    unsubscribeDictionary: subscribeGuestDictionary(
      guestId,
      (data) => {
        const nextHistory = normalizeHistory(data?.history || []);
        const nextCurrent = normalizeCurrentTranslation(data?.currentTranslation || null);
        setState({
          translationHistoryByGuest: {
            ...state.translationHistoryByGuest,
            [guestId]: nextHistory
          },
          currentTranslationByGuest: {
            ...state.currentTranslationByGuest,
            [guestId]: nextCurrent
          }
        });
        persistDictionaryCache();
        if (state.currentGuestId === guestId) {
          renderCurrentTranslationForGuest(guestId);
        }
      },
      () => {
        renderCurrentTranslationForGuest(guestId);
      }
    )
  });
}
