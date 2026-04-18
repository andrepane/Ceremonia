import { constants, refs, state, setState } from "../state.js";
import { getTranslatorUiCopy } from "../ui/translations.js";
import { renderDictionary } from "../ui/render.js";
import { saveGuestDictionaryState } from "./dictionary-store.js";

export async function handleTranslatorRequest() {
  const sourceText = refs.translatorInput.value.trim();
  const uiCopy = getTranslatorUiCopy();
  if (!sourceText) {
    refs.translatorText.textContent = uiCopy.empty;
    return;
  }

  const originalButtonText = refs.translatorButton.textContent;
  const targetLanguage = state.currentLanguage === "es" ? "it" : "es";
  refs.translatorButton.disabled = true;
  refs.translatorButton.textContent = uiCopy.loading;

  try {
    const response = await fetch(constants.TRANSLATOR_API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: sourceText, targetLang: targetLanguage, sourceLang: state.currentLanguage })
    });

    if (!response.ok) throw new Error("Translator endpoint error");
    const data = await response.json();
    const translatedText = data?.translatedText || data?.translation || data?.text || data?.result;
    const provider = (data?.provider || "unknown").toString().toLowerCase();

    if (provider === "deepl" || provider === "magicloops") {
      console.log(`[Translator] Traducción realizada con: ${provider}`);
    } else {
      console.log("[Translator] Proveedor de traducción no informado", data);
    }

    if (!translatedText) throw new Error("Missing translation text");

    const guestId = state.currentGuestId || "guest-anonymous";
    const guestHistory = state.translationHistoryByGuest[guestId] || [];
    const updatedAt = Date.now();
    const updatedHistory = [{ sourceText, translatedText, updatedAt }, ...guestHistory].slice(0, 5);
    const currentTranslation = {
      sourceText,
      translatedText,
      sourceLang: state.currentLanguage,
      targetLang: targetLanguage,
      updatedAt
    };

    setState({
      lastTranslatedLanguage: targetLanguage
    });
    await saveGuestDictionaryState({ guestId, history: updatedHistory, currentTranslation });
    refs.translatorText.textContent = translatedText;
    refs.translatorText.classList.add("translator-result--highlight");
    renderDictionary();
  } catch {
    refs.translatorText.textContent = uiCopy.error;
    refs.translatorText.classList.remove("translator-result--highlight");
  } finally {
    refs.translatorInput.value = "";
    refs.translatorButton.disabled = false;
    refs.translatorButton.textContent = originalButtonText;
  }
}

export function handleSpeakTranslation() {
  const uiCopy = getTranslatorUiCopy();
  const translatedText = refs.translatorText.textContent.trim();
  if (!translatedText || translatedText === uiCopy.error || translatedText === uiCopy.empty) {
    refs.translatorText.textContent = uiCopy.noTranslation;
    return;
  }

  if (!("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance !== "function") {
    refs.translatorText.textContent = uiCopy.speechNotSupported;
    return;
  }

  try {
    const utterance = new window.SpeechSynthesisUtterance(translatedText);
    utterance.lang = state.lastTranslatedLanguage === "es" ? "es-ES" : "it-IT";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    refs.translatorText.textContent = uiCopy.speechError;
  }
}
