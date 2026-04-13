import {
  isFirebaseConfigured,
  ensureAuth,
  getAuthUid,
  linkGuestToAuth,
  subscribeGuestPresence,
  subscribeActivity,
  subscribePhotos,
  lockGuestProfile,
  switchGuestProfileLock,
  releaseGuestProfileLock,
  uploadPhoto,
  deletePhoto,
  togglePhotoLike
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
const profileAvatarElement = document.getElementById("profile-avatar");
const countdownElement = document.getElementById("countdown");
const countdownHintElement = document.getElementById("txt-countdown-hint");
const countdownNextEventLabelElement = document.getElementById("txt-next-event-label");
const countdownNextEventElement = document.getElementById("countdown-next-event");
const countdownUrgencyElement = document.getElementById("countdown-urgency");
const guestHeaderMessageElement = document.getElementById("guest-header-message");
const homeInfoStack = document.getElementById("home-info-stack");
const appShell = document.querySelector(".app-shell");
const translatorInput = document.getElementById("translator-input");
const translatorButton = document.getElementById("translator-btn");
const translatorSpeakButton = document.getElementById("translator-speak-btn");
const translatorText = document.getElementById("txt-translator-text");

let currentLanguage = "es";
let currentGuestId = null;
let realtimeActivity = [];
let realtimePhotos = [];
let realtimeGuestLocks = {};
let firebaseOnline = false;
let authUid = null;
let hasActiveGuestLock = false;
let unsubscribeActivity = () => {};
let unsubscribePhotos = () => {};
let unsubscribeGuestPresence = () => {};
const pendingPhotoLikes = new Set();
let isWeekendFormatExpanded = false;
let homeActivityLoading = true;
let homePhotosLoading = true;
let lastTranslatedLanguage = "it";

const TRANSLATOR_API_ENDPOINT = "/api/translate";
const TRANSLATOR_UI_COPY = {
  es: {
    empty: "Escribe una frase para traducir.",
    loading: "Traduciendo...",
    error: "No se pudo traducir ahora. Inténtalo de nuevo.",
    noTranslation: "Primero traduce una frase para poder escucharla.",
    speechNotSupported: "Tu navegador no permite reproducir audio de voz.",
    speechError: "No se pudo reproducir la traducción."
  },
  it: {
    empty: "Scrivi una frase da tradurre.",
    loading: "Traduzione...",
    error: "Impossibile tradurre adesso. Riprova.",
    noTranslation: "Traduci prima una frase per poterla ascoltare.",
    speechNotSupported: "Il tuo browser non supporta la riproduzione vocale.",
    speechError: "Impossibile riprodurre la traduzione."
  }
};

const WEEKEND_TIMELINE_STARTS = [
  { dayOffset: -1, hour: 15, minute: 0 },
  { dayOffset: -1, hour: 17, minute: 0 },
  { dayOffset: -1, hour: 21, minute: 0 },
  { dayOffset: 0, hour: 9, minute: 0 },
  { dayOffset: 0, hour: 10, minute: 30 },
  { dayOffset: 0, hour: 14, minute: 0 },
  { dayOffset: 0, hour: 17, minute: 0 },
  { dayOffset: 0, hour: 20, minute: 0 },
  { dayOffset: 0, hour: 21, minute: 15 },
  { dayOffset: 0, hour: 23, minute: 0 },
  { dayOffset: 1, hour: 9, minute: 0 }
];

const SATURDAY_ONLY_GUEST_IDS = new Set(["tito", "ana_amiga_novia", "gabri"]);
const FRIDAY_TIMELINE_ITEMS_TO_HIDE = 3;

const HOME_DASHBOARD_COPY = {
  es: {
    weekendFormatLabel: "Qué tipo de boda será",
    weekendFormatTitle: "Esto no es una boda típica.",
    weekendFormatParagraphs: [
      "Es un fin de semana juntos en una casa, con tiempo para estar, comer, hablar y celebrar sin prisas.",
      "No hay protocolos rígidos ni horarios militares. Habrá momentos importantes —como la ceremonia—, pero la mayor parte del tiempo es simplemente para disfrutar juntos.",
      "Todo ocurre en el mismo sitio: piscina, comida, preparación, boda y fiesta. A ratos será relax, a ratos hará falta echar una mano y a ratos simplemente dejarse llevar.",
      "Aquí la dinámica es fácil: si hace falta algo, se ayuda. Si suena buena música, se baila. Ven cómodo, ven a gusto, y sin complicarte más de la cuenta.",
      "La idea es simple: estar juntos."
    ],
    weekendFormatShowMore: "Ver más",
    weekendFormatShowLess: "Ver menos",
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
    personalWithGuest: "Hola, {name}. Recomendación: sube una foto del momento.",
    personalAction: "Ver fotos del finde",
    activityLabel: "Últimas acciones del grupo",
    activityTemplates: {
      upload_photo: "{name} ha subido una foto",
      complete_challenge: "{name} ha compartido un momento",
      react_photo: "{name} ha reaccionado a una foto"
    },
    activityEmpty: "Aún no hay actividad compartida.",
    activityEmptyElegant: "Sé el primero en subir una foto.",
    activityFallback: "Sin conexión a Firebase: cuando vuelva, verás la actividad del grupo aquí.",
    activityLoading: "Cargando actividad del grupo...",
    offlineBanner: "Sin conexión en tiempo real. Mostrando contenido de respaldo.",
    minutesAgo: "hace {count} min",
    hoursAgo: "hace {count} h",
    countdownUnits: {
      days: "días",
      hours: "horas",
      minutes: "minutos"
    },
    nextEventLabel: "Siguiente evento",
    nextEventFallback: "No quedan eventos pendientes en la guía.",
    countdownUrgency: "⏰ Queda menos de 24 horas para la ceremonia.",
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
    authError: "No se pudo autenticar."
  },
  it: {
    weekendFormatLabel: "Che tipo di matrimonio sarà",
    weekendFormatTitle: "Un matrimonio da vivere nel weekend",
    weekendFormatParagraphs: [
      "Non è un evento tipico: è un fine settimana insieme in una casa, con tempo per stare, mangiare, parlare e festeggiare.",
      "Niente fretta e niente protocolli rigidi. Ci saranno momenti importanti (come la cerimonia), ma la maggior parte del tempo sarà per godersela insieme.",
      "Succede tutto nello stesso posto: piscina, cibo, preparazione, matrimonio e festa. A tratti sarà relax, a tratti servirà dare una mano e a tratti basterà lasciarsi andare.",
      "L'idea è semplice: stare bene, senza complicarsi."
    ],
    weekendFormatShowMore: "Mostra di più",
    weekendFormatShowLess: "Mostra meno",
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
    personalWithGuest: "Ciao, {name}. Consiglio: carica una foto del momento.",
    personalAction: "Vedi foto del weekend",
    activityLabel: "Ultime azioni del gruppo",
    activityTemplates: {
      upload_photo: "{name} ha caricato una foto",
      complete_challenge: "{name} ha condiviso un momento",
      react_photo: "{name} ha reagito a una foto"
    },
    activityEmpty: "Non ci sono ancora attività condivise.",
    activityEmptyElegant: "Sii il primo a caricare una foto.",
    activityFallback: "Senza connessione a Firebase: quando torna, vedrai qui l'attività del gruppo.",
    activityLoading: "Caricamento attività del gruppo...",
    offlineBanner: "Senza connessione realtime. Mostro contenuti di fallback.",
    minutesAgo: "{count} min fa",
    hoursAgo: "{count} h fa",
    countdownUnits: {
      days: "giorni",
      hours: "ore",
      minutes: "minuti"
    },
    nextEventLabel: "Prossimo evento",
    nextEventFallback: "Non ci sono altri eventi in programma.",
    countdownUrgency: "⏰ Manca meno di 24 ore alla cerimonia.",
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
    authError: "Impossibile autenticarsi."
  }
};


function scrollViewportToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function showScreen(screenToShow) {
  [screenLanguage, screenGuest, screenApp].forEach((screen) => screen.classList.remove("screen--active"));
  screenToShow.classList.add("screen--active");
  document.body.classList.toggle("body--language-locked", screenToShow === screenLanguage);
  scrollViewportToTop();
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

function getGuestTimelineItems(locale = getLocale()) {
  const fullTimeline = locale.timeline || [];
  const withIndexes = fullTimeline.map((item, index) => ({ item, index }));
  return SATURDAY_ONLY_GUEST_IDS.has(currentGuestId)
    ? withIndexes.slice(FRIDAY_TIMELINE_ITEMS_TO_HIDE)
    : withIndexes;
}

function getTimelineDateByIndex(index) {
  const slot = WEEKEND_TIMELINE_STARTS[index];
  if (!slot) return null;
  const ceremonyDate = new Date(APP_DATA.ceremonyDate);
  const eventDate = new Date(ceremonyDate);
  eventDate.setDate(eventDate.getDate() + slot.dayOffset);
  eventDate.setHours(slot.hour, slot.minute, 0, 0);
  return eventDate;
}

function getNextTimelineEvent() {
  const timelineWithIndexes = getGuestTimelineItems();
  const now = new Date();
  for (const entry of timelineWithIndexes) {
    const eventDate = getTimelineDateByIndex(entry.index);
    if (eventDate && eventDate.getTime() > now.getTime()) {
      return entry.item;
    }
  }
  return null;
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

function updateProfileAvatar() {
  if (!profileAvatarElement) return;
  const guest = findGuestById(currentGuestId);
  if (!guest) {
    profileAvatarElement.innerHTML = "";
    profileAvatarElement.hidden = true;
    profileAvatarElement.classList.remove("header-profile-avatar--image");
    return;
  }

  const avatarImage = getGuestAvatarImage(guest);
  if (avatarImage) {
    profileAvatarElement.innerHTML = `<img class="header-profile-avatar__image" src="${avatarImage}" alt="Avatar de ${guest.name}" loading="lazy" decoding="async" onerror="this.parentElement.classList.remove('header-profile-avatar--image');this.outerHTML='${guest.avatar}';">`;
    profileAvatarElement.classList.add("header-profile-avatar--image");
  } else {
    profileAvatarElement.innerHTML = guest.avatar;
    profileAvatarElement.classList.remove("header-profile-avatar--image");
  }
  profileAvatarElement.hidden = false;
}

function renderGuestCards() {
  const locale = getLocale();
  guestGrid.innerHTML = APP_DATA.guests.map((guest) => {
    const avatarImage = getGuestAvatarImage(guest);
    const lockInfo = realtimeGuestLocks[guest.id] || {};
    const lockedByOther = Boolean(lockInfo.lockedByUid && lockInfo.lockedByUid !== authUid);
    const lockBadge = lockedByOther
      ? `<span class="guest-lock-badge">${currentLanguage === "it" ? "Occupato" : "Bloqueado"}</span>`
      : "";
    const enterLabel = lockedByOther
      ? (currentLanguage === "it" ? "Profilo occupato" : "Perfil ocupado")
      : locale.labels.enterCard;
    return `
      <article class="guest-card ${lockedByOther ? "guest-card--locked" : ""}" data-guest-id="${guest.id}" tabindex="0" role="button" aria-pressed="false" aria-label="${guest.name}">
        <div class="guest-card__inner">
          <div class="guest-card__face guest-card__face--front">
            ${lockBadge}
            <div class="guest-avatar ${avatarImage ? "guest-avatar--image" : ""}">${renderGuestAvatar(guest)}</div>
            <span class="guest-name">${guest.name}</span>
          </div>
          <div class="guest-card__face guest-card__face--back">
            <span class="guest-role">${locale.roles[guest.roleKey] || ""}</span>
            <button class="guest-enter-btn primary-btn" type="button" data-guest-enter="${guest.id}" ${lockedByOther ? "disabled" : ""}>${enterLabel}</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderActivityFeed() {
  const copy = getHomeCopy();
  if (firebaseOnline && homeActivityLoading) {
    return `
      <li class="activity-item activity-item--placeholder"><span class="activity-item__text">${copy.activityLoading}</span></li>
      <li class="activity-item activity-item--skeleton"><span class="activity-skeleton activity-skeleton--line"></span><span class="activity-skeleton activity-skeleton--chip"></span></li>
      <li class="activity-item activity-item--skeleton"><span class="activity-skeleton activity-skeleton--line"></span><span class="activity-skeleton activity-skeleton--chip"></span></li>
    `;
  }

  const feedItems = firebaseOnline ? realtimeActivity : [];
  const latestItems = feedItems.slice(0, 10);

  if (!latestItems.length) {
    return `<li class="activity-item"><span class="activity-item__text">${copy.activityEmptyElegant || copy.activityEmpty}</span></li>`;
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
  const paragraphs = copy.weekendFormatParagraphs || [];
  const visibleParagraphs = isWeekendFormatExpanded ? paragraphs : paragraphs.slice(0, 2);
  const formatParagraphs = visibleParagraphs
    .map((paragraph) => `<p class="card-text">${paragraph}</p>`)
    .join("");
  const formatToggle = paragraphs.length > 2
    ? `<button class="text-btn text-btn--inline" type="button" data-home-toggle-details="${isWeekendFormatExpanded ? "collapse" : "expand"}">${isWeekendFormatExpanded ? copy.weekendFormatShowLess : copy.weekendFormatShowMore}</button>`
    : "";
  const offlineBanner = !firebaseOnline
    ? `<div class="status-banner status-banner--offline">${copy.offlineBanner}</div>`
    : "";

  homeInfoStack.innerHTML = `
    ${offlineBanner}
    <article class="card home-card home-card--weekend-format">
      <p class="card-label">${copy.weekendFormatLabel}</p>
      <h3 class="card-title">${copy.weekendFormatTitle}</h3>
      ${formatParagraphs}
      ${formatToggle}
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

function updateGuestHeaderMessage() {
  if (!guestHeaderMessageElement) return;
  const message = APP_DATA.guestHeaders?.[currentGuestId] || "";
  guestHeaderMessageElement.textContent = message;
  guestHeaderMessageElement.hidden = !message;
}

function renderTimeline() {
  const locale = getLocale();
  const timelineItems = getGuestTimelineItems(locale).map(({ item }) => item);

  document.getElementById("timeline").innerHTML = timelineItems.map((item) => `
      <article class="timeline-item"><span class="timeline-day">${item.day}</span><h4 class="timeline-title">${item.title}</h4>
      <p class="timeline-text">${item.text}</p><span class="status-tag status-tag--${item.tone}">${item.status}</span></article>`).join("");
}

function renderDictionary() {
  const locale = getLocale();
  const falseFriendItems = (locale.falseFriends || []).map((entry) => {
    const term = entry.term ?? (currentLanguage === "es" ? entry.it : entry.es);
    const translation = entry.translation ?? (currentLanguage === "es" ? entry.es : entry.it);
    return `<article class="dictionary-row"><h4 class="card-title">${term}</h4><p class="card-text">${translation}</p></article>`;
  }).join("");

  document.getElementById("false-friends-list").innerHTML = falseFriendItems;
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

  if (homePhotosLoading) {
    container.innerHTML = `<article class="card"><p class="card-text">${copy.photosLoading}</p></article>`;
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
  await withAppUpdate(async () => {
    applyTranslations();
    renderAllDynamicSections();
    highlightSelectedLanguage();
    updateCountdown();
  });
  await playLanguageSelectionAnimation(lang);
  showScreen(screenGuest);
}

async function setGuest(guestId) {
  if (currentGuestId === guestId) {
    showScreen(screenApp);
    return;
  }

  if (isFirebaseConfigured()) {
    try {
      await ensureAuth();
      if (currentGuestId) {
        await switchGuestProfileLock(currentGuestId, guestId);
      } else {
        await lockGuestProfile(guestId);
      }
      hasActiveGuestLock = true;
    } catch (error) {
      if (error?.message === "guest_locked") {
        alert(currentLanguage === "it" ? "Questo profilo è già occupato." : "Este perfil ya está ocupado.");
        return;
      }
      alert(getHomeCopy().authError);
      return;
    }
  }

  currentGuestId = guestId;
  localStorage.setItem("wedding_guest", guestId);
  const guest = findGuestById(guestId);
  selectedGuestName.textContent = guest ? guest.name : "Invitado";
  updateProfileAvatar();
  await withAppUpdate(async () => {
    updateWelcomeLabel();
    updateGuestHeaderMessage();
    renderTimeline();
    showScreen(screenApp);
    renderHomeDashboard();
    renderGuestCards();
    updateCountdown();
  });

  if (isFirebaseConfigured()) {
    try {
      await linkGuestToAuth(guestId);
    } catch {
      alert(getHomeCopy().authError);
    }
  }
}

function activateView(viewName) {
  views.forEach((view) => view.classList.remove("view--active"));
  navButtons.forEach((button) => button.classList.remove("nav-btn--active"));
  const targetView = document.getElementById(`view-${viewName}`);
  const targetButton = document.querySelector(`[data-view="${viewName}"]`);
  if (targetView) targetView.classList.add("view--active");
  if (targetButton) targetButton.classList.add("nav-btn--active");
  scrollViewportToTop();
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
  backToLanguage.setAttribute("aria-label", labels.back);
  backToLanguage.setAttribute("title", labels.back);
  document.getElementById("txt-access").textContent = labels.access;
  document.getElementById("txt-who-title").textContent = labels.whoAreYouTitle;
  document.getElementById("txt-who-subtitle").textContent = labels.whoAreYouText;
  updateWelcomeLabel();
  updateGuestHeaderMessage();
  document.getElementById("txt-hello-prefix").textContent = labels.hello;
  changeProfile.setAttribute("aria-label", labels.changeProfile);
  changeProfile.setAttribute("title", labels.changeProfile);
  document.getElementById("txt-countdown-label").textContent = labels.countdownLabel;
  countdownHintElement.textContent = labels.countdownHint;
  countdownNextEventLabelElement.textContent = getHomeCopy().nextEventLabel;
  document.getElementById("txt-guide-title").textContent = labels.guideTitle;
  document.getElementById("txt-dictionary-title").textContent = labels.dictionaryTitle;
  document.getElementById("txt-translator-label").textContent = labels.translatorLabel;
  document.getElementById("txt-translator-title").textContent = labels.translatorTitle;
  translatorText.textContent = labels.translatorText;
  document.getElementById("txt-false-friends-label").textContent = labels.falseFriendsLabel;
  translatorInput.placeholder = labels.translatorPlaceholder;
  translatorButton.textContent = labels.translateBtn;
  translatorSpeakButton.textContent = labels.speakBtn;
  document.getElementById("txt-photos-title").textContent = labels.photosTitle;
  document.getElementById("txt-map-title").textContent = labels.mapTitle;
  document.getElementById("txt-map-text").textContent = labels.mapText;
  document.getElementById("txt-map-card-label").textContent = labels.mapHowToArrive;
  document.getElementById("txt-map-placeholder").textContent = labels.mapPlaceholder;
  document.getElementById("map-open-link").textContent = labels.mapOpenMaps;
  document.getElementById("map-route-image").alt = labels.mapImageAlt;
  uploadPhotoBtn.textContent = labels.uploadPhoto;
  document.getElementById("nav-home").textContent = labels.navHome;
  document.getElementById("nav-guide").textContent = labels.navGuide;
  document.getElementById("nav-dictionary").textContent = labels.navDictionary;
  document.getElementById("nav-photos").textContent = labels.navPhotos;
  document.getElementById("nav-map").textContent = labels.navMap;
}

function getTranslatorUiCopy() {
  return TRANSLATOR_UI_COPY[currentLanguage] || TRANSLATOR_UI_COPY.es;
}

async function handleTranslatorRequest() {
  const sourceText = translatorInput.value.trim();
  const uiCopy = getTranslatorUiCopy();
  if (!sourceText) {
    translatorText.textContent = uiCopy.empty;
    return;
  }

  const originalButtonText = translatorButton.textContent;
  const targetLanguage = currentLanguage === "es" ? "it" : "es";
  translatorButton.disabled = true;
  translatorButton.textContent = uiCopy.loading;

  try {
    const response = await fetch(TRANSLATOR_API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: sourceText,
        targetLang: targetLanguage,
        sourceLang: currentLanguage
      })
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

    lastTranslatedLanguage = targetLanguage;
    translatorText.textContent = translatedText || uiCopy.error;
  } catch {
    translatorText.textContent = uiCopy.error;
  } finally {
    translatorButton.disabled = false;
    translatorButton.textContent = originalButtonText;
  }
}

function handleSpeakTranslation() {
  const uiCopy = getTranslatorUiCopy();
  const translatedText = translatorText.textContent.trim();
  if (!translatedText || translatedText === uiCopy.error || translatedText === uiCopy.empty) {
    translatorText.textContent = uiCopy.noTranslation;
    return;
  }

  if (!("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance !== "function") {
    translatorText.textContent = uiCopy.speechNotSupported;
    return;
  }

  try {
    const utterance = new window.SpeechSynthesisUtterance(translatedText);
    utterance.lang = lastTranslatedLanguage === "es" ? "es-ES" : "it-IT";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    translatorText.textContent = uiCopy.speechError;
  }
}

async function callTranslatorEndpoint(sourceText, targetLanguage) {
  const jsonPayload = JSON.stringify({
    text: sourceText,
    targetLanguage
  });

  const attempts = [
    () =>
      fetch(TRANSLATOR_LOOP_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonPayload
      }),
    () =>
      fetch(TRANSLATOR_LOOP_ENDPOINT, {
        method: "POST",
        body: jsonPayload
      })
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const response = await attempt();
      if (!response.ok) throw new Error(`Translator endpoint error (${response.status})`);

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return await response.json();
      }

      const rawText = await response.text();
      try {
        return JSON.parse(rawText);
      } catch {
        return { translation: rawText };
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Translator endpoint error");
}

async function withAppUpdate(task) {
  if (appShell) appShell.classList.add("app-shell--updating");
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  try {
    await task();
  } finally {
    window.requestAnimationFrame(() => {
      if (appShell) appShell.classList.remove("app-shell--updating");
    });
  }
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
  const now = new Date();
  const diff = ceremonyDate - now;
  const locale = getLocale();
  const copy = getHomeCopy();
  const phase = getHomePhase();
  countdownHintElement.textContent = copy.moments?.[phase] || locale.labels.countdownHint;
  countdownNextEventLabelElement.textContent = copy.nextEventLabel;
  const nextEvent = getNextTimelineEvent();
  countdownNextEventElement.textContent = nextEvent
    ? `${nextEvent.title} · ${nextEvent.day}`
    : copy.nextEventFallback;

  if (diff <= 0) {
    countdownElement.textContent = locale.labels.countdownStarted;
    countdownUrgencyElement.textContent = "";
    countdownUrgencyElement.classList.remove("is-visible");
    countdownElement.classList.remove("countdown--urgent");
    document.querySelector(".hero-panel")?.classList.remove("hero-panel--urgent");
    return;
  }
  const totalMinutes = Math.floor(diff / 1000 / 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const units = copy.countdownUnits || { days: "d", hours: "h", minutes: "m" };
  countdownElement.textContent = `${String(days).padStart(2, "0")} ${units.days} ${String(hours).padStart(2, "0")} ${units.hours} ${String(minutes).padStart(2, "0")} ${units.minutes}`;
  const isUrgent = diff < 24 * 60 * 60 * 1000;
  document.querySelector(".hero-panel")?.classList.toggle("hero-panel--urgent", isUrgent);
  countdownElement.classList.toggle("countdown--urgent", isUrgent);
  countdownUrgencyElement.classList.toggle("is-visible", isUrgent);
  countdownUrgencyElement.textContent = isUrgent ? copy.countdownUrgency : "";
}

function renderAllDynamicSections() {
  renderGuestCards();
  renderHomeDashboard();
  renderTimeline();
  renderDictionary();
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
  changeProfile.addEventListener("click", async () => {
    const previousGuestId = currentGuestId;
    if (isFirebaseConfigured() && previousGuestId) {
      try {
        await releaseGuestProfileLock(previousGuestId);
      } catch {
        // no-op
      }
    }
    hasActiveGuestLock = false;
    localStorage.removeItem("wedding_guest");
    currentGuestId = null;
    updateWelcomeLabel();
    updateGuestHeaderMessage();
    updateProfileAvatar();
    renderGuestCards();
    showScreen(screenGuest);
  });
  navButtons.forEach((button) => button.addEventListener("click", () => activateView(button.dataset.view)));
  homeInfoStack.addEventListener("click", (event) => {
    const targetButton = event.target.closest("[data-target-view]");
    if (targetButton) activateView(targetButton.dataset.targetView);
    const detailToggle = event.target.closest("[data-home-toggle-details]");
    if (detailToggle) {
      isWeekendFormatExpanded = detailToggle.dataset.homeToggleDetails === "expand";
      renderHomeDashboard();
    }
  });

  ["false-friends"].forEach((id) => {
    const toggle = document.getElementById(`${id}-toggle`);
    const content = document.getElementById(`${id}-list`);
    toggle.addEventListener("click", () => {
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", isExpanded ? "false" : "true");
      content.hidden = isExpanded;
    });
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

  uploadPhotoBtn.addEventListener("click", handleUploadPhoto);
  translatorButton.addEventListener("click", handleTranslatorRequest);
  translatorSpeakButton.addEventListener("click", handleSpeakTranslation);
  translatorInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleTranslatorRequest();
  });

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
    updateGuestHeaderMessage();
    updateProfileAvatar();
    renderTimeline();
    renderHomeDashboard();
    showScreen(screenApp);
    return;
  }
  updateProfileAvatar();
  showScreen(savedLang ? screenGuest : screenLanguage);
}

async function initFirebaseListeners() {
  if (!isFirebaseConfigured()) {
    firebaseOnline = false;
    homeActivityLoading = false;
    homePhotosLoading = false;
    renderHomeDashboard();
    renderPhotos();
    return;
  }

  unsubscribeActivity();
  unsubscribePhotos();
  unsubscribeGuestPresence();
  unsubscribeActivity = () => {};
  unsubscribePhotos = () => {};
  unsubscribeGuestPresence = () => {};

  try {
    await ensureAuth();
    authUid = getAuthUid();
    firebaseOnline = true;
    homeActivityLoading = true;
    homePhotosLoading = true;
    renderHomeDashboard();
    renderPhotos();

    unsubscribeActivity = subscribeActivity((data) => {
      realtimeActivity = data;
      homeActivityLoading = false;
      renderHomeDashboard();
    }, () => {
      firebaseOnline = false;
      homeActivityLoading = false;
      renderHomeDashboard();
    });

    unsubscribeGuestPresence = subscribeGuestPresence((data) => {
      realtimeGuestLocks = data.reduce((acc, guestDoc) => {
        acc[guestDoc.id] = {
          locked: Boolean(guestDoc.locked),
          lockedByUid: guestDoc.lockedByUid || null
        };
        return acc;
      }, {});
      renderGuestCards();
    }, () => {
      firebaseOnline = false;
      renderGuestCards();
    });

    unsubscribePhotos = subscribePhotos((data) => {
      realtimePhotos = data;
      homePhotosLoading = false;
      renderPhotos();
    }, () => {
      firebaseOnline = false;
      homePhotosLoading = false;
      renderPhotos();
    });

    if (currentGuestId) {
      try {
        await lockGuestProfile(currentGuestId);
        hasActiveGuestLock = true;
      } catch {
        hasActiveGuestLock = false;
        localStorage.removeItem("wedding_guest");
        currentGuestId = null;
        updateWelcomeLabel();
        updateGuestHeaderMessage();
        updateProfileAvatar();
        showScreen(screenGuest);
      }
    }
  } catch {
    firebaseOnline = false;
    homeActivityLoading = false;
    homePhotosLoading = false;
    renderHomeDashboard();
    renderPhotos();
  }
}

window.addEventListener("beforeunload", () => {
  if (!isFirebaseConfigured() || !currentGuestId || !hasActiveGuestLock) return;
  releaseGuestProfileLock(currentGuestId).catch(() => {});
});

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
