import { APP_DATA, refs, state, constants, getLocale, getHomeCopy } from "../state.js";
import { updateGuestHeaderMessage, updateWelcomeLabel } from "./render.js";

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
  updateWelcomeLabel();
  updateGuestHeaderMessage();
  document.getElementById("txt-hello-prefix").textContent = labels.hello;
  refs.changeProfile.setAttribute("aria-label", labels.changeProfile);
  refs.changeProfile.setAttribute("title", labels.changeProfile);
  document.getElementById("txt-countdown-label").textContent = labels.countdownLabel;
  refs.countdownHintElement.textContent = labels.countdownHint;
  refs.countdownNextEventLabelElement.textContent = getHomeCopy().nextEventLabel;
  document.getElementById("txt-guide-title").textContent = labels.guideTitle;
  document.getElementById("txt-guide-subtitle").textContent = labels.guideSubtitle;
  document.getElementById("txt-dictionary-title").textContent = labels.dictionaryTitle;
  document.getElementById("txt-dictionary-subtitle").textContent = labels.dictionarySubtitle;
  document.getElementById("txt-translator-label").textContent = labels.translatorLabel;
  refs.translatorText.textContent = labels.translatorText;
  document.getElementById("txt-false-friends-label").textContent = labels.falseFriendsLabel;
  refs.translatorInput.placeholder = labels.translatorPlaceholder;
  refs.translatorButton.textContent = labels.translateBtn;
  refs.translatorSpeakButton.textContent = labels.speakBtn;
  document.getElementById("txt-photos-title").textContent = labels.photosTitle;
  document.getElementById("txt-photos-subtitle").textContent = labels.photosSubtitle;
  document.getElementById("txt-map-title").textContent = labels.mapTitle;
  document.getElementById("txt-map-subtitle").textContent = labels.mapSubtitle;
  document.getElementById("txt-map-text").textContent = labels.mapText;
  document.getElementById("txt-map-card-label").textContent = labels.mapHowToArrive;
  document.getElementById("txt-map-placeholder").textContent = labels.mapPlaceholder;
  document.getElementById("map-open-link").textContent = labels.mapOpenMaps;
  document.getElementById("map-route-image").alt = labels.mapImageAlt;
  refs.uploadPhotoBtn.textContent = labels.uploadPhoto;
  document.getElementById("nav-home").textContent = labels.navHome;
  document.getElementById("nav-guide").textContent = labels.navGuide;
  document.getElementById("nav-dictionary").textContent = labels.navDictionary;
  document.getElementById("nav-photos").textContent = labels.navPhotos;
  document.getElementById("nav-map").textContent = labels.navMap;
}

export function getTranslatorUiCopy() {
  return constants.TRANSLATOR_UI_COPY[state.currentLanguage] || constants.TRANSLATOR_UI_COPY.es;
}
