import { APP_DATA, refs, state, getLocale, getHomeCopy, findGuestById } from "../state.js";
import { renderTimeline } from "../features/timeline.js";

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
    return `<li class="activity-item"><span class="activity-item__text">${template.replace("{name}", name)}</span><span class="activity-item__time">${formatRelativeTimeFromDate(item.createdAt)}</span></li>`;
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

export function renderDictionary() {
  const locale = getLocale();
  const falseFriendItems = (locale.falseFriends || []).map((entry) => {
    const term = entry.term ?? (state.currentLanguage === "es" ? entry.it : entry.es);
    const translation = entry.translation ?? (state.currentLanguage === "es" ? entry.es : entry.it);
    return `<article class="dictionary-row"><h4 class="card-title">${term}</h4><p class="card-text">${translation}</p></article>`;
  }).join("");
  document.getElementById("false-friends-list").innerHTML = falseFriendItems;
}

export function renderPhotos() {
  const locale = getLocale();
  const copy = getHomeCopy();
  const container = document.getElementById("photo-grid");

  if (!state.firebaseOnline) {
    container.innerHTML = locale.photos.map((photo) => `<article class="photo-card"><div class="photo-placeholder">${locale.labels.photoLabel}</div><div class="photo-meta"><span>${photo.caption}</span><button type="button" disabled>♡ ${photo.likes}</button></div></article>`).join("");
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

  container.innerHTML = state.realtimePhotos.map((photo) => `<article class="photo-card"><img src="${photo.downloadURL}" alt="${photo.caption || "photo"}" class="photo-img" loading="lazy" /><div class="photo-meta"><span>${photo.caption || "—"}</span><div class="photo-actions"><button type="button" class="photo-like-btn ${photo.likedByGuestIds?.includes(state.currentGuestId) ? "photo-like-btn--liked" : ""}" data-photo-like="${photo.id}" aria-pressed="${photo.likedByGuestIds?.includes(state.currentGuestId) ? "true" : "false"}"><span class="photo-like-btn__icon">${photo.likedByGuestIds?.includes(state.currentGuestId) ? "♥" : "♡"}</span><span>${photo.likesCount || 0}</span></button>${photo.authorUid === state.authUid ? `<button type="button" class="photo-delete-btn" data-photo-delete="${photo.id}">${copy.deletePhoto}</button>` : ""}</div></div></article>`).join("");
}

export function renderAllDynamicSections() {
  renderGuestCards();
  renderHomeDashboard();
  renderTimeline();
  renderDictionary();
  renderPhotos();
}
