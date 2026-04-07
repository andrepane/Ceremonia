import {
  isFirebaseConfigured,
  ensureAuth,
  getAuthUid,
  linkGuestToAuth,
  subscribeActivity,
  subscribePhotos,
  subscribeRanking,
  subscribeGuestChallenges,
  uploadPhoto,
  deletePhoto,
  togglePhotoLike,
  setChallengeDone
} from "./firebase.js";

const APP_DATA = window.WEDDING_APP_DATA;

const screenLanguage = document.getElementById("screen-language");
const screenGuest = document.getElementById("screen-guest");
const screenApp = document.getElementById("screen-app");

const btnEs = document.getElementById("btn-es");
const btnIt = document.getElementById("btn-it");
const backToLanguage = document.getElementById("back-to-language");
const changeProfile = document.getElementById("change-profile");
const uploadPhotoBtn = document.getElementById("upload-photo-btn");

const guestGrid = document.getElementById("guest-grid");
const navButtons = document.querySelectorAll(".nav-btn");
const views = document.querySelectorAll(".view");

const selectedGuestName = document.getElementById("selected-guest-name");
const countdownElement = document.getElementById("countdown");
const homeInfoStack = document.getElementById("home-info-stack");

let currentLanguage = "es";
let currentGuestId = null;
let realtimeActivity = [];
let realtimePhotos = [];
let realtimeRanking = [];
let realtimeChallenges = {};
let firebaseOnline = false;
let authUid = null;
let unsubscribeActivity = () => {};
let unsubscribePhotos = () => {};
let unsubscribeRanking = () => {};
let unsubscribeGuestChallenges = () => {};
const pendingPhotoLikes = new Set();

const challengeCatalog = [
  { id: "language_5min", points: 1 },
  { id: "help_prep", points: 1 },
  { id: "new_person_photo", points: 1 },
  { id: "full_song_dance", points: 1 },
  { id: "false_friend", points: 1 }
];

const HOME_DASHBOARD_COPY = {
  es: {
    nextStepLabel: "Tu próximo paso",
    nextStepTitlePre: "Revisa el plan del finde",
    nextStepTextPre: "Consulta horarios, ubicaciones y detalles para llegar sin prisas.",
    nextStepCtaPre: "Ver guía del finde",
    nextStepTargetPre: "guide",
    nextStepTitleLive: "Estáis en directo",
    nextStepTextLive: "Sigue el siguiente momento importante y comparte lo que está pasando.",
    nextStepCtaLive: "Abrir guía en vivo",
    nextStepTargetLive: "guide",
    nextStepTitlePost: "Guarda los mejores recuerdos",
    nextStepTextPost: "La ceremonia ya pasó: ahora toca revivir y compartir fotos del fin de semana.",
    nextStepCtaPost: "Ver fotos del finde",
    nextStepTargetPost: "photos",
    nowLabel: "Lo urgente ahora",
    nowDefault: "Todo en orden. Revisa la guía para el siguiente momento importante.",
    mapLabel: "Cómo llegar",
    mapTitle: "Consulta el mapa del sitio",
    mapText: "Revisa la ubicación y las indicaciones prácticas antes de salir.",
    mapAction: "Abrir sección mapa",
    personalLabel: "Tu panel personal",
    personalNoGuest: "Selecciona un perfil para personalizar recomendaciones.",
    personalWithGuest: "Hola, {name}. Recomendación: completa un reto y sube una foto del momento.",
    personalAction: "Ver retos pendientes",
    activityLabel: "Últimas acciones del grupo",
    activityTemplates: {
      upload_photo: "{name} ha subido una foto",
      complete_challenge: "{name} ha cumplido un reto",
      react_photo: "{name} ha reaccionado a una foto"
    },
    activityEmpty: "Aún no hay actividad compartida.",
    activityFallback: "Mostrando datos demo por falta de conexión a Firebase.",
    minutesAgo: "hace {count} min",
    hoursAgo: "hace {count} h",
    moments: {
      pre: "Ahora estáis en preparación previa.",
      live: "Ya estáis dentro del fin de semana de boda.",
      post: "El fin de semana terminó, pero siguen los recuerdos."
    },
    nextCeremony: "Próximo momento: ceremonia el sábado 5.",
    photosLoading: "Cargando fotos...",
    photosEmpty: "Todavía no hay fotos.",
    photosFallback: "Firebase no disponible: se muestran fotos demo.",
    uploadError: "No se pudo subir la foto. Inténtalo de nuevo.",
    uploadLoading: "Subiendo...",
    uploadPrompt: "Añade un pie de foto (opcional)",
    deletePhoto: "Eliminar",
    deletePhotoConfirm: "¿Seguro que quieres eliminar esta foto?",
    deleteError: "No se pudo eliminar la foto.",
    likeError: "No se pudo registrar el like.",
    challengeSaved: "Guardado",
    challengeError: "No se pudo guardar el reto.",
    authError: "No se pudo autenticar."
  },
  it: {
    nextStepLabel: "Il tuo prossimo passo",
    nextStepTitlePre: "Controlla il piano del weekend",
    nextStepTextPre: "Guarda orari, luoghi e dettagli per arrivare senza fretta.",
    nextStepCtaPre: "Apri guida weekend",
    nextStepTargetPre: "guide",
    nextStepTitleLive: "Siete in diretta",
    nextStepTextLive: "Segui il prossimo momento importante e condividi quello che succede.",
    nextStepCtaLive: "Apri guida live",
    nextStepTargetLive: "guide",
    nextStepTitlePost: "Salva i ricordi migliori",
    nextStepTextPost: "La cerimonia è finita: adesso rivivete e condividete le foto del weekend.",
    nextStepCtaPost: "Vedi foto weekend",
    nextStepTargetPost: "photos",
    nowLabel: "Priorità adesso",
    nowDefault: "Tutto sotto controllo. Apri la guida per il prossimo momento importante.",
    mapLabel: "Come arrivare",
    mapTitle: "Controlla la mappa del luogo",
    mapText: "Verifica posizione e indicazioni pratiche prima di partire.",
    mapAction: "Apri sezione mappa",
    personalLabel: "Il tuo pannello personale",
    personalNoGuest: "Seleziona un profilo per ricevere consigli personalizzati.",
    personalWithGuest: "Ciao, {name}. Consiglio: completa una sfida e carica una foto del momento.",
    personalAction: "Apri sfide",
    activityLabel: "Ultime azioni del gruppo",
    activityTemplates: {
      upload_photo: "{name} ha caricato una foto",
      complete_challenge: "{name} ha completato una sfida",
      react_photo: "{name} ha reagito a una foto"
    },
    activityEmpty: "Non ci sono ancora attività condivise.",
    activityFallback: "Mostro dati demo perché Firebase non è disponibile.",
    minutesAgo: "{count} min fa",
    hoursAgo: "{count} h fa",
    moments: {
      pre: "Adesso siete nella fase di preparazione.",
      live: "Siete già nel weekend di matrimonio.",
      post: "Il weekend è finito, ma i ricordi continuano."
    },
    nextCeremony: "Prossimo momento: cerimonia sabato 5.",
    photosLoading: "Caricamento foto...",
    photosEmpty: "Non ci sono ancora foto.",
    photosFallback: "Firebase non disponibile: mostro foto demo.",
    uploadError: "Impossibile caricare la foto.",
    uploadLoading: "Caricamento...",
    uploadPrompt: "Aggiungi una didascalia (opzionale)",
    deletePhoto: "Elimina",
    deletePhotoConfirm: "Vuoi davvero eliminare questa foto?",
    deleteError: "Impossibile eliminare la foto.",
    likeError: "Impossibile registrare il like.",
    challengeSaved: "Salvato",
    challengeError: "Impossibile salvare la sfida.",
    authError: "Impossibile autenticarsi."
  }
};

const HOME_ACTIVITY_FEED = [
  { guestId: "gigi", type: "upload_photo", minutesAgo: 5 },
  { guestId: "rachele", type: "complete_challenge", minutesAgo: 18 },
  { guestId: "manolo", type: "react_photo", minutesAgo: 37 }
];

function showScreen(screenToShow) {
  [screenLanguage, screenGuest, screenApp].forEach((screen) => screen.classList.remove("screen--active"));
  screenToShow.classList.add("screen--active");
}

const getLocale = () => APP_DATA.translations[currentLanguage] || APP_DATA.translations.es;
const getHomeCopy = () => HOME_DASHBOARD_COPY[currentLanguage] || HOME_DASHBOARD_COPY.es;
const findGuestById = (guestId) => APP_DATA.guests.find((guest) => guest.id === guestId) || null;

function getHomePhase() {
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

function formatRelativeTimeFromDate(dateValue) {
  const copy = getHomeCopy();
  const d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
  const diffMinutes = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (diffMinutes < 60) return copy.minutesAgo.replace("{count}", String(diffMinutes));
  return copy.hoursAgo.replace("{count}", String(Math.floor(diffMinutes / 60)));
}

function normalizeGuestNameForImage(name = "") {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function getGuestAvatarImage(guest) {
  if (guest.avatarImage) return guest.avatarImage;
  const imageName = normalizeGuestNameForImage(guest.name);
  return imageName ? `images/${imageName}.png` : "";
}

function renderGuestAvatar(guest) {
  const avatarImage = getGuestAvatarImage(guest);
  if (avatarImage) {
    return `<img class="guest-avatar__image" src="${avatarImage}" alt="Avatar de ${guest.name}" loading="lazy" decoding="async" onerror="this.parentElement.classList.remove('guest-avatar--image');this.outerHTML='${guest.avatar}';">`;
  }
  return guest.avatar;
}

function renderGuestCards() {
  const locale = getLocale();
  guestGrid.innerHTML = APP_DATA.guests.map((guest) => {
    const avatarImage = getGuestAvatarImage(guest);
    return `
      <article class="guest-card" data-guest-id="${guest.id}" tabindex="0" role="button" aria-pressed="false" aria-label="${guest.name}">
        <div class="guest-card__inner">
          <div class="guest-card__face guest-card__face--front">
            <div class="guest-avatar ${avatarImage ? "guest-avatar--image" : ""}">${renderGuestAvatar(guest)}</div>
            <span class="guest-name">${guest.name}</span>
          </div>
          <div class="guest-card__face guest-card__face--back">
            <span class="guest-role">${locale.roles[guest.roleKey] || ""}</span>
            <button class="guest-enter-btn primary-btn" type="button" data-guest-enter="${guest.id}">${locale.labels.enterCard}</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderActivityFeed() {
  const copy = getHomeCopy();
  const feedItems = firebaseOnline && realtimeActivity.length
    ? realtimeActivity
    : HOME_ACTIVITY_FEED.map((item) => ({ ...item, createdAt: new Date(Date.now() - item.minutesAgo * 60000) }));
  const latestItems = feedItems.slice(0, 10);

  if (!latestItems.length) {
    return `<li class="activity-item"><span class="activity-item__text">${copy.activityEmpty}</span></li>`;
  }

  return latestItems.map((item) => {
    const guest = findGuestById(item.guestId);
    const name = guest ? guest.name : item.guestId;
    const template = copy.activityTemplates[item.type] || "{name}";
    const actionText = template.replace("{name}", name);
    return `
      <li class="activity-item">
        <span class="activity-item__text">${actionText}</span>
        <span class="activity-item__time">${formatRelativeTimeFromDate(item.createdAt)}</span>
      </li>
    `;
  }).join("");
}

function renderHomeDashboard() {
  const copy = getHomeCopy();
  const phase = getHomePhase();
  const phaseSuffix = phase === "pre" ? "Pre" : phase === "live" ? "Live" : "Post";
  const currentGuest = findGuestById(currentGuestId);
  const personalText = currentGuest ? copy.personalWithGuest.replace("{name}", currentGuest.name) : copy.personalNoGuest;
  const urgentText = phase === "post" ? `${copy.moments.post} ${copy.nowDefault}` : `${copy.moments[phase]} ${copy.nextCeremony}`;

  homeInfoStack.innerHTML = `
    <article class="card home-card home-card--next-step"><p class="card-label">${copy.nextStepLabel}</p>
      <h3 class="card-title">${copy[`nextStepTitle${phaseSuffix}`]}</h3>
      <p class="card-text">${copy[`nextStepText${phaseSuffix}`]}</p>
      <button class="primary-btn home-action-btn" type="button" data-target-view="${copy[`nextStepTarget${phaseSuffix}`]}">${copy[`nextStepCta${phaseSuffix}`]}</button>
    </article>

    <article class="card home-card"><p class="card-label">${copy.nowLabel}</p><p class="card-text">${urgentText}</p></article>

    <article class="card home-card"><p class="card-label">${copy.mapLabel}</p>
      <h3 class="card-title">${copy.mapTitle}</h3>
      <p class="card-text">${copy.mapText}</p>
      <button class="secondary-btn home-action-btn" type="button" data-target-view="map">${copy.mapAction}</button>
    </article>

    <article class="card home-card"><p class="card-label">${copy.personalLabel}</p><p class="card-text">${personalText}</p>
      <button class="secondary-btn home-action-btn" type="button" data-target-view="game">${copy.personalAction}</button>
    </article>

    <article class="card home-card home-card--activity"><p class="card-label">${copy.activityLabel}</p><ul class="activity-list">${renderActivityFeed()}</ul>
      ${firebaseOnline ? "" : `<p class=\"card-text home-activity-hint\">${copy.activityFallback}</p>`}
    </article>
  `;
}

function updateWelcomeLabel() {
  const labels = getLocale().labels;
  const guest = findGuestById(currentGuestId);
  const welcome = guest?.sex === "f" ? (labels.welcomeFemale || labels.welcome) : labels.welcome;
  document.getElementById("txt-welcome").textContent = welcome;
}

function renderTimeline() {
  const locale = getLocale();
  document.getElementById("timeline").innerHTML = locale.timeline.map((item) => `
      <article class="timeline-item"><span class="timeline-day">${item.day}</span><h4 class="timeline-title">${item.title}</h4>
      <p class="timeline-text">${item.text}</p><span class="status-tag status-tag--${item.tone}">${item.status}</span></article>`).join("");
}

function renderDictionary() {
  const locale = getLocale();
  document.getElementById("dictionary-list").innerHTML = locale.dictionary.map((entry) => `
      <article class="card"><p class="card-label">${entry.label}</p><h4 class="card-title">${entry.title}</h4><p class="card-text">${entry.text}</p></article>`).join("");
}

function getLocalizedChallenges() {
  const locale = getLocale();
  return (locale.challenges || []).map((item, index) => ({
    id: challengeCatalog[index]?.id || `challenge_${index + 1}`,
    points: challengeCatalog[index]?.points || 1,
    text: item.text,
    done: firebaseOnline && currentGuestId ? Boolean(realtimeChallenges?.completed?.[challengeCatalog[index]?.id || `challenge_${index + 1}`]) : Boolean(item.done)
  }));
}

function renderChallenges() {
  const container = document.getElementById("challenge-list");
  const items = getLocalizedChallenges();
  container.innerHTML = items.map((challenge) => `
      <label class="challenge-item">
        <input type="checkbox" data-challenge-id="${challenge.id}" ${challenge.done ? "checked" : ""} ${currentGuestId ? "" : "disabled"} />
        <span>${challenge.text}</span>
      </label>
    `).join("");
}

function renderRanking() {
  const container = document.getElementById("ranking-list");
  const source = firebaseOnline && realtimeRanking.length ? realtimeRanking : APP_DATA.ranking;
  container.innerHTML = source.map((item) => {
    const guest = findGuestById(item.guestId || item.id);
    const name = guest ? guest.name : (item.guestId || item.id);
    return `<li><span>${name}</span><strong>${item.points || 0} pts</strong></li>`;
  }).join("");
}

function renderPhotos() {
  const locale = getLocale();
  const copy = getHomeCopy();
  const container = document.getElementById("photo-grid");

  if (!firebaseOnline) {
    container.innerHTML = locale.photos.map((photo) => `
      <article class="photo-card"><div class="photo-placeholder">${locale.labels.photoLabel}</div><div class="photo-meta"><span>${photo.caption}</span><button type="button" disabled>♡ ${photo.likes}</button></div></article>
    `).join("");
    return;
  }

  if (!realtimePhotos.length) {
    container.innerHTML = `<article class="card"><p class="card-text">${getHomeCopy().photosEmpty}</p></article>`;
    return;
  }

  container.innerHTML = realtimePhotos.map((photo) => `
      <article class="photo-card">
        <img src="${photo.downloadURL}" alt="${photo.caption || "photo"}" class="photo-img" loading="lazy" />
        <div class="photo-meta">
          <span>${photo.caption || "—"}</span>
          <div class="photo-actions">
            <button
              type="button"
              class="photo-like-btn ${photo.likedByGuestIds?.includes(currentGuestId) ? "photo-like-btn--liked" : ""}"
              data-photo-like="${photo.id}"
              aria-pressed="${photo.likedByGuestIds?.includes(currentGuestId) ? "true" : "false"}"
            >
              <span class="photo-like-btn__icon">${photo.likedByGuestIds?.includes(currentGuestId) ? "♥" : "♡"}</span>
              <span>${photo.likesCount || 0}</span>
            </button>
            ${photo.authorUid === authUid ? `<button type="button" class="photo-delete-btn" data-photo-delete="${photo.id}">${copy.deletePhoto}</button>` : ""}
          </div>
        </div>
      </article>
    `).join("");
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function playLanguageSelectionAnimation(lang) {
  const selectedButton = lang === "es" ? btnEs : btnIt;
  btnEs.disabled = true;
  btnIt.disabled = true;
  selectedButton.classList.remove("language-btn--selected");
  void selectedButton.offsetWidth;
  selectedButton.classList.add("language-btn--selected");
  await delay(420);
  selectedButton.classList.remove("language-btn--selected");
  btnEs.disabled = false;
  btnIt.disabled = false;
}

async function setLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem("wedding_lang", lang);
  applyTranslations();
  renderAllDynamicSections();
  highlightSelectedLanguage();
  await playLanguageSelectionAnimation(lang);
  showScreen(screenGuest);
}

async function setGuest(guestId) {
  if (currentGuestId === guestId) {
    showScreen(screenApp);
    return;
  }

  currentGuestId = guestId;
  localStorage.setItem("wedding_guest", guestId);
  const guest = findGuestById(guestId);
  selectedGuestName.textContent = guest ? guest.name : "Invitado";
  updateWelcomeLabel();
  showScreen(screenApp);
  renderHomeDashboard();

  if (isFirebaseConfigured()) {
    try {
      await ensureAuth();
      await linkGuestToAuth(guestId);
      subscribeGuestStreams();
    } catch {
      alert(getHomeCopy().authError);
    }
  }
}

function subscribeGuestStreams() {
  if (!currentGuestId || !isFirebaseConfigured()) return;
  unsubscribeGuestChallenges();
  unsubscribeGuestChallenges = subscribeGuestChallenges(currentGuestId, (docData) => {
    realtimeChallenges = docData || {};
    renderChallenges();
  });
}

function activateView(viewName) {
  views.forEach((view) => view.classList.remove("view--active"));
  navButtons.forEach((button) => button.classList.remove("nav-btn--active"));
  const targetView = document.getElementById(`view-${viewName}`);
  const targetButton = document.querySelector(`[data-view="${viewName}"]`);
  if (targetView) targetView.classList.add("view--active");
  if (targetButton) targetButton.classList.add("nav-btn--active");
}

function applyTranslations() {
  const locale = getLocale();
  const labels = locale.labels;
  const oppositeLabels = (currentLanguage === "es" ? APP_DATA.translations.it : APP_DATA.translations.es).labels;
  document.documentElement.lang = currentLanguage;

  document.getElementById("txt-weekend").textContent = labels.weekend;
  document.getElementById("txt-weekend-translation").textContent = oppositeLabels.weekend;
  document.getElementById("txt-hero-title").textContent = labels.heroTitle;
  document.getElementById("txt-hero-subtitle").textContent = labels.heroSubtitle;
  document.getElementById("txt-hero-subtitle-translation").textContent = oppositeLabels.heroSubtitle;
  backToLanguage.textContent = labels.back;
  document.getElementById("txt-access").textContent = labels.access;
  document.getElementById("txt-who-title").textContent = labels.whoAreYouTitle;
  document.getElementById("txt-who-subtitle").textContent = labels.whoAreYouText;
  updateWelcomeLabel();
  document.getElementById("txt-hello-prefix").textContent = labels.hello;
  changeProfile.textContent = labels.changeProfile;
  document.getElementById("txt-countdown-label").textContent = labels.countdownLabel;
  document.getElementById("txt-countdown-hint").textContent = labels.countdownHint;
  document.getElementById("txt-guide-title").textContent = labels.guideTitle;
  document.getElementById("txt-dictionary-title").textContent = labels.dictionaryTitle;
  document.getElementById("txt-translator-label").textContent = labels.translatorLabel;
  document.getElementById("txt-translator-title").textContent = labels.translatorTitle;
  document.getElementById("txt-translator-text").textContent = labels.translatorText;
  document.getElementById("translator-input").placeholder = labels.translatorPlaceholder;
  document.getElementById("translator-btn").textContent = labels.translateBtn;
  document.getElementById("txt-game-title").textContent = labels.gameTitle;
  document.getElementById("txt-progress-label").textContent = labels.progressLabel;
  document.getElementById("txt-progress-title").textContent = labels.progressTitle;
  document.getElementById("txt-progress-text").textContent = labels.progressText;
  document.getElementById("txt-ranking-label").textContent = labels.rankingLabel;
  document.getElementById("txt-photos-title").textContent = labels.photosTitle;
  document.getElementById("txt-map-title").textContent = labels.mapTitle;
  document.getElementById("txt-map-text").textContent = labels.mapText;
  document.getElementById("txt-map-card-label").textContent = labels.mapHowToArrive;
  document.getElementById("txt-map-placeholder").textContent = labels.mapPlaceholder;
  uploadPhotoBtn.textContent = labels.uploadPhoto;
  document.getElementById("nav-home").textContent = labels.navHome;
  document.getElementById("nav-guide").textContent = labels.navGuide;
  document.getElementById("nav-dictionary").textContent = labels.navDictionary;
  document.getElementById("nav-game").textContent = labels.navGame;
  document.getElementById("nav-photos").textContent = labels.navPhotos;
  document.getElementById("nav-map").textContent = labels.navMap;
}

function highlightSelectedLanguage() {
  const isEs = currentLanguage === "es";
  btnEs.classList.toggle("primary-btn", isEs);
  btnEs.classList.toggle("secondary-btn", !isEs);
  btnIt.classList.toggle("primary-btn", !isEs);
  btnIt.classList.toggle("secondary-btn", isEs);
  btnEs.classList.toggle("language-btn--active", isEs);
  btnIt.classList.toggle("language-btn--active", !isEs);
}

function updateCountdown() {
  const ceremonyDate = new Date(APP_DATA.ceremonyDate);
  const diff = ceremonyDate - new Date();
  const locale = getLocale();
  if (diff <= 0) {
    countdownElement.textContent = locale.labels.countdownStarted;
    return;
  }
  const totalMinutes = Math.floor(diff / 1000 / 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  countdownElement.textContent = `${String(days).padStart(2, "0")}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

function renderAllDynamicSections() {
  renderGuestCards();
  renderHomeDashboard();
  renderTimeline();
  renderDictionary();
  renderChallenges();
  renderRanking();
  renderPhotos();
}

async function handleUploadPhoto() {
  if (!currentGuestId) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Máximo 10MB");
      return;
    }
    const caption = window.prompt(getHomeCopy().uploadPrompt, "") || "";

    if (!firebaseOnline) {
      alert(getHomeCopy().uploadError);
      return;
    }

    const original = uploadPhotoBtn.textContent;
    uploadPhotoBtn.disabled = true;
    uploadPhotoBtn.textContent = getHomeCopy().uploadLoading;
    try {
      await uploadPhoto({ file, guestId: currentGuestId, caption });
    } catch {
      alert(getHomeCopy().uploadError);
    } finally {
      uploadPhotoBtn.disabled = false;
      uploadPhotoBtn.textContent = original;
    }
  };
  input.click();
}

function bindUIEvents() {
  btnEs.addEventListener("click", () => setLanguage("es"));
  btnIt.addEventListener("click", () => setLanguage("it"));
  backToLanguage.addEventListener("click", () => showScreen(screenLanguage));
  changeProfile.addEventListener("click", () => {
    localStorage.removeItem("wedding_guest");
    currentGuestId = null;
    updateWelcomeLabel();
    showScreen(screenGuest);
  });
  navButtons.forEach((button) => button.addEventListener("click", () => activateView(button.dataset.view)));
  homeInfoStack.addEventListener("click", (event) => {
    const targetButton = event.target.closest("[data-target-view]");
    if (targetButton) activateView(targetButton.dataset.targetView);
  });

  document.getElementById("photo-grid").addEventListener("click", async (event) => {
    const likeBtn = event.target.closest("[data-photo-like]");
    if (likeBtn && currentGuestId && firebaseOnline) {
      const photoId = likeBtn.dataset.photoLike;
      if (!photoId || pendingPhotoLikes.has(photoId)) return;

      pendingPhotoLikes.add(photoId);
      likeBtn.disabled = true;
      likeBtn.classList.add("photo-like-btn--pulse");
      try {
        await togglePhotoLike(photoId, currentGuestId);
      } catch {
        alert(getHomeCopy().likeError);
      } finally {
        pendingPhotoLikes.delete(photoId);
        likeBtn.disabled = false;
        likeBtn.classList.remove("photo-like-btn--pulse");
      }
      return;
    }

    const deleteBtn = event.target.closest("[data-photo-delete]");
    if (!deleteBtn || !firebaseOnline) return;
    if (!window.confirm(getHomeCopy().deletePhotoConfirm)) return;
    try {
      await deletePhoto(deleteBtn.dataset.photoDelete);
    } catch {
      alert(getHomeCopy().deleteError);
    }
  });

  document.getElementById("challenge-list").addEventListener("change", async (event) => {
    const check = event.target;
    if (!check.matches("input[data-challenge-id]") || !currentGuestId || !firebaseOnline) return;
    const challenge = challengeCatalog.find((item) => item.id === check.dataset.challengeId);
    try {
      await setChallengeDone({
        guestId: currentGuestId,
        challengeId: check.dataset.challengeId,
        done: check.checked,
        points: challenge?.points || 1
      });
    } catch {
      check.checked = !check.checked;
      alert(getHomeCopy().challengeError);
    }
  });

  uploadPhotoBtn.addEventListener("click", handleUploadPhoto);

  guestGrid.addEventListener("click", (event) => {
    const enterButton = event.target.closest("[data-guest-enter]");
    if (enterButton) {
      setGuest(enterButton.dataset.guestEnter);
      return;
    }

    const card = event.target.closest(".guest-card");
    if (!card) return;
    card.classList.toggle("guest-card--flipped");
    card.setAttribute("aria-pressed", card.classList.contains("guest-card--flipped") ? "true" : "false");
  });

  guestGrid.addEventListener("keydown", (event) => {
    if (event.target.closest("[data-guest-enter]")) return;
    const card = event.target.closest(".guest-card");
    if (!card) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      card.classList.toggle("guest-card--flipped");
      card.setAttribute("aria-pressed", card.classList.contains("guest-card--flipped") ? "true" : "false");
    }
  });
}

function restoreSession() {
  const savedLang = localStorage.getItem("wedding_lang");
  const savedGuestId = localStorage.getItem("wedding_guest");
  if (savedLang && APP_DATA.translations[savedLang]) currentLanguage = savedLang;
  applyTranslations();
  renderAllDynamicSections();
  highlightSelectedLanguage();

  if (savedGuestId && findGuestById(savedGuestId)) {
    currentGuestId = savedGuestId;
    selectedGuestName.textContent = findGuestById(savedGuestId).name;
    updateWelcomeLabel();
    renderHomeDashboard();
    showScreen(screenApp);
    return;
  }
  showScreen(savedLang ? screenGuest : screenLanguage);
}

async function initFirebaseListeners() {
  if (!isFirebaseConfigured()) {
    firebaseOnline = false;
    return;
  }

  unsubscribeActivity();
  unsubscribePhotos();
  unsubscribeRanking();
  unsubscribeGuestChallenges();
  unsubscribeActivity = () => {};
  unsubscribePhotos = () => {};
  unsubscribeRanking = () => {};
  unsubscribeGuestChallenges = () => {};

  try {
    await ensureAuth();
    authUid = getAuthUid();
    firebaseOnline = true;

    unsubscribeActivity = subscribeActivity((data) => {
      realtimeActivity = data;
      renderHomeDashboard();
    }, () => {
      firebaseOnline = false;
      renderHomeDashboard();
    });

    unsubscribePhotos = subscribePhotos((data) => {
      realtimePhotos = data;
      renderPhotos();
    }, () => {
      firebaseOnline = false;
      renderPhotos();
    });

    unsubscribeRanking = subscribeRanking((data) => {
      realtimeRanking = data;
      renderRanking();
    }, () => {
      firebaseOnline = false;
      renderRanking();
    });

    if (currentGuestId) subscribeGuestStreams();
  } catch {
    firebaseOnline = false;
  }
}

bindUIEvents();
restoreSession();
activateView("home");
updateCountdown();
setInterval(updateCountdown, 60000);
initFirebaseListeners();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service Worker registration failed:", error);
    });
  });
}
