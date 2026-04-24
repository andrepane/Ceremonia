import { APP_DATA, refs, state, constants, getLocale, getHomeCopy } from "../state.js";
import { updateAppHeaderForView } from "./render.js";

export function applyTranslations() {
  const locale = getLocale();
  const labels = locale.labels;
  const spanishLabels = APP_DATA.translations.es.labels;
  const italianLabels = APP_DATA.translations.it.labels;
  document.documentElement.lang = state.currentLanguage;

  document.getElementById("txt-weekend").textContent = spanishLabels.weekend;
  document.getElementById("txt-weekend-translation").textContent = italianLabels.weekend;
  document.getElementById("txt-hero-title").textContent = labels.heroTitle;
  document.getElementById("txt-hero-month-es").textContent = "septiembre";
  document.getElementById("txt-hero-month-it").textContent = "settembre";
  refs.backToLanguage.setAttribute("aria-label", labels.back);
  refs.backToLanguage.setAttribute("title", labels.back);
  document.getElementById("txt-access").textContent = labels.access;
  document.getElementById("txt-who-title").textContent = labels.whoAreYouTitle;
  document.getElementById("txt-who-subtitle").textContent = labels.whoAreYouText;
  document.getElementById("txt-hello-prefix").textContent = labels.hello;
  refs.changeProfile.setAttribute("aria-label", labels.changeProfile);
  refs.changeProfile.setAttribute("title", labels.changeProfile);
  document.getElementById("txt-countdown-label").textContent = labels.countdownLabel;
  refs.countdownHintElement.textContent = labels.countdownHint;
  refs.countdownNextEventLabelElement.textContent = getHomeCopy().nextEventLabel;
  document.getElementById("txt-guide-title").textContent = labels.guideTitle || "";
  document.getElementById("txt-dictionary-title").textContent = labels.dictionaryTitle || "";
  document.getElementById("txt-translator-label").textContent = labels.translatorLabel;
  document.getElementById("txt-translator-title").textContent = labels.translatorTitle || "";
  refs.translatorHistoryTitle.textContent = labels.translatorHistoryTitle;
  document.getElementById("txt-useful-phrases-label").textContent = labels.usefulPhrasesLabel;
  document.getElementById("txt-false-friends-label").textContent = labels.falseFriendsLabel;
  refs.translatorInput.placeholder = labels.translatorPlaceholder;
  refs.translatorButton.textContent = labels.translateBtn;
  refs.translatorSpeakButton.textContent = labels.speakBtn;
  document.getElementById("txt-photos-title").textContent = labels.photosTitle || "";
  document.getElementById("txt-map-title").textContent = labels.mapTitle || "";
  document.getElementById("txt-map-text").textContent = labels.mapText;
  document.getElementById("txt-map-card-label").textContent = labels.mapHowToArrive;
  document.getElementById("txt-map-placeholder").textContent = labels.mapPlaceholder;
  document.getElementById("map-open-link").textContent = labels.mapOpenMaps;
  document.getElementById("map-route-image").alt = labels.mapImageAlt;
  refs.uploadPhotoBtn.textContent = labels.uploadPhoto;
  const navLabelsById = {
    "nav-home": labels.navHome,
    "nav-guide": labels.navGuide,
    "nav-dictionary": labels.navDictionary,
    "nav-photos": labels.navPhotos,
    "nav-map": labels.navMap
  };
  Object.entries(navLabelsById).forEach(([id, text]) => {
    const labelElement = document.querySelector(`#${id} .nav-btn__label`);
    if (labelElement) labelElement.textContent = text;
  });
  updateAppHeaderForView();
}

export function getTranslatorUiCopy() {
  return constants.TRANSLATOR_UI_COPY[state.currentLanguage] || constants.TRANSLATOR_UI_COPY.es;
}
