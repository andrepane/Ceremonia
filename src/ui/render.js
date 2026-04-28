import { APP_DATA, refs, state, getLocale, getHomeCopy, findGuestById } from "../state.js";
import { renderTimeline } from "../features/timeline.js";
import { speakText } from "../features/translator.js";


const appTitleElement = document.querySelector(".app-title");
const appTitleSeparatorNode = Array.from(appTitleElement?.childNodes || []).find(
  (node) => node.nodeType === Node.TEXT_NODE && node.textContent.includes(",")
);
const appTitleDefaultSeparator = appTitleSeparatorNode?.textContent || ", ";

function getActiveViewName() {
  const activeView = document.querySelector(".view--active");
  return activeView?.id?.replace("view-", "") || "home";
}

const SECTION_HEADER_COPY_BY_VIEW = {
  guide: {
    titleKey: "guideHeaderTitle",
    subtitleKey: "guideHeaderSubtitle"
  },
  dictionary: {
    titleKey: "dictionaryHeaderTitle",
    subtitleKey: "dictionaryHeaderSubtitle"
  },
  photos: {
    titleKey: "photosHeaderTitle",
    subtitleKey: "photosHeaderSubtitle"
  },
  map: {
    titleKey: "mapHeaderTitle",
    subtitleKey: "mapHeaderSubtitle"
  }
};

function formatRelativeTimeFromDate(dateValue) {
  const copy = getHomeCopy();
  const d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
  const diffMinutes = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (diffMinutes < 60) return copy.minutesAgo.replace("{count}", String(diffMinutes));
  return copy.hoursAgo.replace("{count}", String(Math.floor(diffMinutes / 60)));
}

function normalizeGuestNameForImage(name = "") {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function getGuestAvatarImage(guest) {
  if (guest.avatarImage) return guest.avatarImage;
  const imageName = normalizeGuestNameForImage(guest.name);
  return imageName ? `images/${imageName}.png` : "";
}

function renderGuestAvatar(guest) {
  const avatarImage = getGuestAvatarImage(guest);
  if (avatarImage) return `<img class="guest-avatar__image" src="${avatarImage}" alt="Avatar de ${guest.name}" loading="lazy" decoding="async" onerror="this.parentElement.classList.remove('guest-avatar--image');this.outerHTML='${guest.avatar}';">`;
  return guest.avatar;
}

export function updateProfileAvatar() {
  if (!refs.profileAvatarElement) return;
  const guest = findGuestById(state.currentGuestId);
  if (!guest) {
    refs.profileAvatarElement.innerHTML = "";
    refs.profileAvatarElement.hidden = true;
    refs.profileAvatarElement.classList.remove("header-profile-avatar--image");
    return;
  }

  const avatarImage = getGuestAvatarImage(guest);
  if (avatarImage) {
    refs.profileAvatarElement.innerHTML = `<img class="header-profile-avatar__image" src="${avatarImage}" alt="Avatar de ${guest.name}" loading="lazy" decoding="async" onerror="this.parentElement.classList.remove('header-profile-avatar--image');this.outerHTML='${guest.avatar}';">`;
    refs.profileAvatarElement.classList.add("header-profile-avatar--image");
  } else {
    refs.profileAvatarElement.innerHTML = guest.avatar;
    refs.profileAvatarElement.classList.remove("header-profile-avatar--image");
  }
  refs.profileAvatarElement.hidden = false;
}

export function renderGuestCards() {
  const locale = getLocale();
  refs.guestGrid.innerHTML = APP_DATA.guests.map((guest) => {
    const avatarImage = getGuestAvatarImage(guest);
    const lockInfo = state.realtimeGuestLocks[guest.id] || {};
    const lockedByOther = Boolean(lockInfo.lockedByUid && lockInfo.lockedByUid !== state.authUid);
    const lockBadge = lockedByOther ? `<span class="guest-lock-badge">${state.currentLanguage === "it" ? "Occupato" : "Bloqueado"}</span>` : "";
    const enterLabel = lockedByOther ? (state.currentLanguage === "it" ? "Profilo occupato" : "Perfil ocupado") : locale.labels.enterCard;
    return `<article class="guest-card ${lockedByOther ? "guest-card--locked" : ""}" data-guest-id="${guest.id}" tabindex="0" role="button" aria-pressed="false" aria-label="${guest.name}"><div class="guest-card__inner"><div class="guest-card__face guest-card__face--front">${lockBadge}<div class="guest-avatar ${avatarImage ? "guest-avatar--image" : ""}">${renderGuestAvatar(guest)}</div><span class="guest-name">${guest.name}</span></div><div class="guest-card__face guest-card__face--back"><span class="guest-role">${locale.roles[guest.roleKey] || ""}</span><button class="guest-enter-btn primary-btn" type="button" data-guest-enter="${guest.id}" ${lockedByOther ? "disabled" : ""}>${enterLabel}</button></div></div></article>`;
  }).join("");
}

function renderActivityFeed() {
  const copy = getHomeCopy();
  if (state.firebaseOnline && state.homeActivityLoading) {
    return `<li class="activity-item activity-item--placeholder"><span class="activity-item__text">${copy.activityLoading}</span></li><li class="activity-item activity-item--skeleton"><span class="activity-skeleton activity-skeleton--line"></span><span class="activity-skeleton activity-skeleton--chip"></span></li><li class="activity-item activity-item--skeleton"><span class="activity-skeleton activity-skeleton--line"></span><span class="activity-skeleton activity-skeleton--chip"></span></li>`;
  }
  const latestItems = (state.firebaseOnline ? state.realtimeActivity : []).slice(0, 10);
  if (!latestItems.length) return `<li class="activity-item"><span class="activity-item__text">${copy.activityEmptyElegant || copy.activityEmpty}</span></li>`;
  return latestItems.map((item) => {
    const guest = findGuestById(item.guestId);
    const name = guest ? guest.name : item.guestId;
    const template = copy.activityTemplates[item.type] || "{name}";
    const photoId = item?.metadata?.photoId || "";
    const isPhotoActivity = Boolean(photoId);
    const activityContent = `<span class="activity-item__text">${template.replace("{name}", name)}</span><span class="activity-item__time">${formatRelativeTimeFromDate(item.createdAt)}</span>`;
    if (!isPhotoActivity) return `<li class="activity-item">${activityContent}</li>`;
    return `<li class="activity-item activity-item--clickable"><button type="button" class="activity-item__button activity-item--interactive" data-activity-photo-id="${photoId}" data-activity-type="${item.type}" aria-label="${template.replace("{name}", name)}">${activityContent}<span class="activity-item__hint" aria-hidden="true"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></button></li>`;
  }).join("");
}

export function renderHomeDashboard() {
  const copy = getHomeCopy();
  const paragraphs = copy.weekendFormatParagraphs || [];
  const visibleParagraphs = state.isWeekendFormatExpanded ? paragraphs : paragraphs.slice(0, 2);
  const formatParagraphs = visibleParagraphs.map((paragraph) => `<p class="card-text">${paragraph}</p>`).join("");
  const formatToggle = paragraphs.length > 2 ? `<button class="text-btn text-btn--inline" type="button" data-home-toggle-details="${state.isWeekendFormatExpanded ? "collapse" : "expand"}">${state.isWeekendFormatExpanded ? copy.weekendFormatShowLess : copy.weekendFormatShowMore}</button>` : "";
  const offlineBanner = !state.firebaseOnline ? `<div class="status-banner status-banner--offline">${copy.offlineBanner}</div>` : "";
  refs.homeInfoStack.innerHTML = `${offlineBanner}<article class="card home-card home-card--weekend-format"><p class="card-label">${copy.weekendFormatLabel}</p><h3 class="card-title">${copy.weekendFormatTitle}</h3>${formatParagraphs}${formatToggle}</article><article class="card home-card home-card--activity"><p class="card-label">${copy.activityLabel}</p><ul class="activity-list">${renderActivityFeed()}</ul>${state.firebaseOnline ? "" : `<p class=\"card-text home-activity-hint\">${copy.activityFallback}</p>`}</article>`;
}

export function updateWelcomeLabel() {
  const labels = getLocale().labels;
  const guest = findGuestById(state.currentGuestId);
  const welcome = guest?.sex === "f" ? (labels.welcomeFemale || labels.welcome) : labels.welcome;
  document.getElementById("txt-welcome").textContent = welcome;
}

export function updateGuestHeaderMessage() {
  if (!refs.guestHeaderMessageElement) return;
  const message = APP_DATA.guestHeaders?.[state.currentGuestId] || "";
  refs.guestHeaderMessageElement.textContent = message;
  refs.guestHeaderMessageElement.hidden = !message;
}

export function updateAppHeaderForView(viewName = getActiveViewName()) {
  const labels = getLocale().labels;
  const welcomeElement = document.getElementById("txt-welcome");
  const helloPrefixElement = document.getElementById("txt-hello-prefix");

  if (viewName === "home") {
    updateWelcomeLabel();
    if (welcomeElement) welcomeElement.hidden = false;
    if (helloPrefixElement) helloPrefixElement.textContent = labels.hello;
    if (refs.selectedGuestName) {
      const guest = findGuestById(state.currentGuestId);
      refs.selectedGuestName.textContent = guest ? guest.name : "Invitado";
      refs.selectedGuestName.hidden = false;
    }
    if (appTitleSeparatorNode) appTitleSeparatorNode.textContent = appTitleDefaultSeparator;
    updateGuestHeaderMessage();
    return;
  }

  const sectionHeaderCopy = SECTION_HEADER_COPY_BY_VIEW[viewName];
  if (!sectionHeaderCopy) return;

  if (welcomeElement) {
    welcomeElement.textContent = "";
    welcomeElement.hidden = true;
  }
  if (helloPrefixElement) helloPrefixElement.textContent = labels[sectionHeaderCopy.titleKey] || "";
  if (refs.selectedGuestName) {
    refs.selectedGuestName.textContent = "";
    refs.selectedGuestName.hidden = true;
  }
  if (appTitleSeparatorNode) appTitleSeparatorNode.textContent = "";
  if (refs.guestHeaderMessageElement) {
    refs.guestHeaderMessageElement.textContent = labels[sectionHeaderCopy.subtitleKey] || "";
    refs.guestHeaderMessageElement.hidden = false;
  }
}

export function renderDictionary() {
  const locale = getLocale();
  const usefulPhraseItems = (locale.usefulPhrases || []).map((entry) => {
    const sourceText = state.currentLanguage === "es" ? entry.es : entry.it;
    const translatedText = state.currentLanguage === "es" ? entry.it : entry.es;
    const translatedLanguage = state.currentLanguage === "es" ? "it" : "es";
    return `<article class="dictionary-row useful-phrase-row"><p class="translator-history-row__source">${sourceText}</p><p class="card-text useful-phrase-row__target"><span class="translator-result--highlight useful-phrase-row__target-text">${translatedText}</span><button type="button" class="useful-phrase-speak-btn" data-useful-phrase-speak="${translatedLanguage}" data-useful-phrase-text="${encodeURIComponent(translatedText)}" aria-label="${state.currentLanguage === "es" ? "Escuchar frase traducida" : "Ascolta frase tradotta"}" title="${state.currentLanguage === "es" ? "Escuchar frase traducida" : "Ascolta frase tradotta"}">🔊</button></p></article>`;
  }).join("");
  document.getElementById("useful-phrases-list").innerHTML = usefulPhraseItems;

  const falseFriendItems = (locale.falseFriends || []).map((entry) => {
    const term = entry.term ?? (state.currentLanguage === "es" ? entry.it : entry.es);
    const translation = entry.translation ?? (state.currentLanguage === "es" ? entry.es : entry.it);
    return `<article class="dictionary-row"><h4 class="card-title">${term}</h4><p class="card-text">${translation}</p></article>`;
  }).join("");
  document.getElementById("false-friends-list").innerHTML = falseFriendItems;

  const history = state.translationHistoryByGuest[state.currentGuestId] || [];
  const historyItems = history.map((item) => `<article class="dictionary-row"><p class="translator-history-row__source">${item.sourceText}</p><p class="card-text translator-history-row__target">${item.translatedText}</p></article>`).join("");
  refs.translatorHistoryList.innerHTML = historyItems || `<p class="card-text translator-history-empty">${locale.labels.translatorHistoryEmpty}</p>`;

  const currentTranslation = state.currentTranslationByGuest[state.currentGuestId] || null;
  if (currentTranslation?.translatedText) {
    refs.translatorText.textContent = currentTranslation.translatedText;
    refs.translatorText.classList.add("translator-result--highlight");
  } else {
    refs.translatorText.textContent = locale.labels.translatorText;
    refs.translatorText.classList.remove("translator-result--highlight");
  }
}

export function handleUsefulPhraseSpeakClick(event) {
  const button = event.target.closest("[data-useful-phrase-speak]");
  if (!button) return;
  const text = decodeURIComponent(button.dataset.usefulPhraseText || "");
  const language = button.dataset.usefulPhraseSpeak || "it";
  if (!text) return;
  if (!("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance !== "function") return;
  speakText(text, language);
}

export function renderPhotos() {
  const locale = getLocale();
  const copy = getHomeCopy();
  const container = document.getElementById("photo-grid");

  if (!state.firebaseOnline) {
    container.innerHTML = locale.photos.map((photo) => `<article class="photo-card"><div class="photo-placeholder">${locale.labels.photoLabel}</div><div class="photo-meta"><div class="photo-actions"><button type="button" disabled>♡ ${photo.likes}</button></div></div></article>`).join("");
    return;
  }
  if (state.homePhotosLoading) {
    container.innerHTML = `<article class="card"><p class="card-text">${copy.photosLoading}</p></article>`;
    return;
  }
  if (!state.realtimePhotos.length) {
    container.innerHTML = `<article class="card"><p class="card-text">${copy.photosEmpty}</p></article>`;
    return;
  }

  container.innerHTML = state.realtimePhotos.map((photo) => {
    const previewUrl = photo.processedThumbnailURL || photo.thumbnailURL || photo.processedDownloadURL || photo.downloadURL;
    const fullUrl = photo.processedDownloadURL || photo.downloadURL || previewUrl || "";
    const imageMarkup = previewUrl
      ? `<img src="${previewUrl}" data-photo-open="${fullUrl}" alt="photo" class="photo-img ${photo.downloadURL ? "" : "photo-img--preview-only"}" loading="lazy" />`
      : `<div class="photo-placeholder">Subiendo...</div>`;
    const currentReaction = photo?.reactionsByGuestIds?.[state.currentGuestId]
      || (photo.likedByGuestIds?.includes(state.currentGuestId) ? "❤️" : "");
    return `<article class="photo-card" data-photo-card-id="${photo.id}">${imageMarkup}<div class="photo-meta"><div class="photo-actions"><button type="button" class="photo-like-btn ${currentReaction ? "photo-like-btn--liked" : ""}" data-photo-like="${photo.id}" aria-pressed="${currentReaction ? "true" : "false"}"><span class="photo-like-btn__icon">${currentReaction || "♡"}</span><span>${photo.likesCount || 0}</span></button>${photo.authorUid === state.authUid ? `<button type="button" class="photo-delete-btn" data-photo-delete="${photo.id}" aria-label="${copy.deletePhoto}" title="${copy.deletePhoto}">🗑</button>` : ""}</div></div></article>`;
  }).join("");
}

export function renderAllDynamicSections() {
  renderGuestCards();
  renderHomeDashboard();
  renderTimeline();
  renderDictionary();
  renderPhotos();
}
