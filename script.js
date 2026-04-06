const APP_DATA = window.WEDDING_APP_DATA;

const screenLanguage = document.getElementById("screen-language");
const screenGuest = document.getElementById("screen-guest");
const screenApp = document.getElementById("screen-app");

const btnEs = document.getElementById("btn-es");
const btnIt = document.getElementById("btn-it");
const backToLanguage = document.getElementById("back-to-language");
const changeProfile = document.getElementById("change-profile");

const guestGrid = document.getElementById("guest-grid");
const navButtons = document.querySelectorAll(".nav-btn");
const views = document.querySelectorAll(".view");

const selectedGuestName = document.getElementById("selected-guest-name");
const countdownElement = document.getElementById("countdown");
const homeInfoStack = document.getElementById("home-info-stack");

let currentLanguage = "es";
let currentGuestId = null;

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
    quickLabel: "Accesos rápidos",
    quickActions: [
      { text: "Guía", target: "guide" },
      { text: "Diccionario", target: "dictionary" },
      { text: "Retos", target: "game" },
      { text: "Fotos", target: "photos" }
    ],
    personalLabel: "Tu panel personal",
    personalNoGuest: "Selecciona un perfil para personalizar recomendaciones.",
    personalWithGuest: "Hola, {name}. Recomendación: completa un reto y sube una foto del momento.",
    personalAction: "Ver retos pendientes",
    activityLabel: "Últimas acciones del grupo",
    activityHint: "En producción, aquí se verán acciones en tiempo real desde Firebase.",
    activityTemplates: {
      upload_photo: "{name} ha subido una foto",
      complete_challenge: "{name} ha cumplido un reto",
      add_dictionary_phrase: "{name} ha añadido una frase útil",
      react_photo: "{name} ha reaccionado a una foto"
    },
    minutesAgo: "hace {count} min",
    hoursAgo: "hace {count} h",
    moments: {
      pre: "Ahora estáis en preparación previa.",
      live: "Ya estáis dentro del fin de semana de boda.",
      post: "El fin de semana terminó, pero siguen los recuerdos."
    },
    nextCeremony: "Próximo momento: ceremonia el sábado a las 20:00."
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
    quickLabel: "Accessi rapidi",
    quickActions: [
      { text: "Guida", target: "guide" },
      { text: "Dizionario", target: "dictionary" },
      { text: "Sfide", target: "game" },
      { text: "Foto", target: "photos" }
    ],
    personalLabel: "Il tuo pannello personale",
    personalNoGuest: "Seleziona un profilo per ricevere consigli personalizzati.",
    personalWithGuest: "Ciao, {name}. Consiglio: completa una sfida e carica una foto del momento.",
    personalAction: "Apri sfide",
    activityLabel: "Ultime azioni del gruppo",
    activityHint: "In produzione, qui compariranno le azioni in tempo reale da Firebase.",
    activityTemplates: {
      upload_photo: "{name} ha caricato una foto",
      complete_challenge: "{name} ha completato una sfida",
      add_dictionary_phrase: "{name} ha aggiunto una frase utile",
      react_photo: "{name} ha reagito a una foto"
    },
    minutesAgo: "{count} min fa",
    hoursAgo: "{count} h fa",
    moments: {
      pre: "Adesso siete nella fase di preparazione.",
      live: "Siete già nel weekend di matrimonio.",
      post: "Il weekend è finito, ma i ricordi continuano."
    },
    nextCeremony: "Prossimo momento: cerimonia sabato alle 20:00."
  }
};

const HOME_ACTIVITY_FEED = [
  { guestId: "gigi", type: "upload_photo", minutesAgo: 5 },
  { guestId: "rachele", type: "complete_challenge", minutesAgo: 18 },
  { guestId: "manolo", type: "react_photo", minutesAgo: 37 },
  { guestId: "ana_amiga_novia", type: "add_dictionary_phrase", minutesAgo: 76 }
];

function showScreen(screenToShow) {
  [screenLanguage, screenGuest, screenApp].forEach((screen) => {
    screen.classList.remove("screen--active");
  });

  screenToShow.classList.add("screen--active");
}

function getLocale() {
  return APP_DATA.translations[currentLanguage] || APP_DATA.translations.es;
}

function getHomeCopy() {
  return HOME_DASHBOARD_COPY[currentLanguage] || HOME_DASHBOARD_COPY.es;
}

function findGuestById(guestId) {
  return APP_DATA.guests.find((guest) => guest.id === guestId) || null;
}

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

function formatRelativeTime(minutesAgo) {
  const copy = getHomeCopy();

  if (minutesAgo < 60) {
    return copy.minutesAgo.replace("{count}", String(minutesAgo));
  }

  const hours = Math.floor(minutesAgo / 60);
  return copy.hoursAgo.replace("{count}", String(hours));
}

function renderGuestCards() {
  const locale = getLocale();

  guestGrid.innerHTML = APP_DATA.guests
    .map(
      (guest) => `
      <button class="guest-card" type="button" data-guest-id="${guest.id}">
        <div class="guest-avatar">${guest.avatar}</div>
        <span class="guest-name">${guest.name}</span>
        <span class="guest-role">${locale.roles[guest.roleKey] || ""}</span>
      </button>
    `
    )
    .join("");

  guestGrid.querySelectorAll(".guest-card").forEach((card) => {
    card.addEventListener("click", () => {
      const guestId = card.dataset.guestId;
      setGuest(guestId);
    });
  });
}

function renderActivityFeed() {
  const copy = getHomeCopy();

  return HOME_ACTIVITY_FEED.map((item) => {
    const guest = findGuestById(item.guestId);
    const name = guest ? guest.name : item.guestId;
    const template = copy.activityTemplates[item.type] || "{name}";
    const actionText = template.replace("{name}", name);

    return `
      <li class="activity-item">
        <span class="activity-item__text">${actionText}</span>
        <span class="activity-item__time">${formatRelativeTime(item.minutesAgo)}</span>
      </li>
    `;
  }).join("");
}

function renderHomeDashboard() {
  const copy = getHomeCopy();
  const phase = getHomePhase();
  const phaseSuffix = phase === "pre" ? "Pre" : phase === "live" ? "Live" : "Post";
  const currentGuest = findGuestById(currentGuestId);

  const nextStepTitle = copy[`nextStepTitle${phaseSuffix}`];
  const nextStepText = copy[`nextStepText${phaseSuffix}`];
  const nextStepCta = copy[`nextStepCta${phaseSuffix}`];
  const nextStepTarget = copy[`nextStepTarget${phaseSuffix}`];

  const personalText = currentGuest
    ? copy.personalWithGuest.replace("{name}", currentGuest.name)
    : copy.personalNoGuest;

  const urgentText = phase === "post"
    ? `${copy.moments.post} ${copy.nowDefault}`
    : `${copy.moments[phase]} ${copy.nextCeremony}`;

  homeInfoStack.innerHTML = `
    <article class="card home-card home-card--next-step">
      <p class="card-label">${copy.nextStepLabel}</p>
      <h3 class="card-title">${nextStepTitle}</h3>
      <p class="card-text">${nextStepText}</p>
      <button class="primary-btn home-action-btn" type="button" data-target-view="${nextStepTarget}">
        ${nextStepCta}
      </button>
    </article>

    <article class="card home-card">
      <p class="card-label">${copy.nowLabel}</p>
      <p class="card-text">${urgentText}</p>
    </article>

    <article class="card home-card">
      <p class="card-label">${copy.quickLabel}</p>
      <div class="home-quick-grid">
        ${copy.quickActions
          .map(
            (action) => `
              <button class="secondary-btn home-action-btn" type="button" data-target-view="${action.target}">
                ${action.text}
              </button>
            `
          )
          .join("")}
      </div>
    </article>

    <article class="card home-card">
      <p class="card-label">${copy.personalLabel}</p>
      <p class="card-text">${personalText}</p>
      <button class="secondary-btn home-action-btn" type="button" data-target-view="game">
        ${copy.personalAction}
      </button>
    </article>

    <article class="card home-card home-card--activity">
      <p class="card-label">${copy.activityLabel}</p>
      <ul class="activity-list">
        ${renderActivityFeed()}
      </ul>
      <p class="card-text home-activity-hint">${copy.activityHint}</p>
    </article>
  `;
}

function renderTimeline() {
  const locale = getLocale();
  const container = document.getElementById("timeline");

  container.innerHTML = locale.timeline
    .map(
      (item) => `
      <article class="timeline-item">
        <span class="timeline-day">${item.day}</span>
        <h4 class="timeline-title">${item.title}</h4>
        <p class="timeline-text">${item.text}</p>
        <span class="status-tag status-tag--${item.tone}">${item.status}</span>
      </article>
    `
    )
    .join("");
}

function renderDictionary() {
  const locale = getLocale();
  const container = document.getElementById("dictionary-list");

  container.innerHTML = locale.dictionary
    .map(
      (entry) => `
      <article class="card">
        <p class="card-label">${entry.label}</p>
        <h4 class="card-title">${entry.title}</h4>
        <p class="card-text">${entry.text}</p>
      </article>
    `
    )
    .join("");
}

function renderChallenges() {
  const locale = getLocale();
  const container = document.getElementById("challenge-list");

  container.innerHTML = locale.challenges
    .map(
      (challenge) => `
      <label class="challenge-item">
        <input type="checkbox" ${challenge.done ? "checked" : ""} disabled />
        <span>${challenge.text}</span>
      </label>
    `
    )
    .join("");
}

function renderRanking() {
  const container = document.getElementById("ranking-list");

  container.innerHTML = APP_DATA.ranking
    .map((item) => {
      const guest = findGuestById(item.guestId);
      const name = guest ? guest.name : item.guestId;
      return `<li><span>${name}</span><strong>${item.points} pts</strong></li>`;
    })
    .join("");
}

function renderPhotos() {
  const locale = getLocale();
  const container = document.getElementById("photo-grid");

  container.innerHTML = locale.photos
    .map(
      (photo) => `
      <article class="photo-card">
        <div class="photo-placeholder">${locale.labels.photoLabel}</div>
        <div class="photo-meta">
          <span>${photo.caption}</span>
          <button type="button">♡ ${photo.likes}</button>
        </div>
      </article>
    `
    )
    .join("");
}

function setLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem("wedding_lang", lang);
  applyTranslations();
  renderAllDynamicSections();
  highlightSelectedLanguage();
  showScreen(screenGuest);
}

function setGuest(guestId) {
  currentGuestId = guestId;
  localStorage.setItem("wedding_guest", guestId);

  const guest = findGuestById(guestId);
  selectedGuestName.textContent = guest ? guest.name : "Invitado";

  showScreen(screenApp);
  renderHomeDashboard();
}

function activateView(viewName) {
  views.forEach((view) => {
    view.classList.remove("view--active");
  });

  navButtons.forEach((button) => {
    button.classList.remove("nav-btn--active");
  });

  const targetView = document.getElementById(`view-${viewName}`);
  const targetButton = document.querySelector(`[data-view="${viewName}"]`);

  if (targetView) targetView.classList.add("view--active");
  if (targetButton) targetButton.classList.add("nav-btn--active");
}

function applyTranslations() {
  const locale = getLocale();
  const labels = locale.labels;

  document.documentElement.lang = currentLanguage;

  document.getElementById("txt-weekend").textContent = labels.weekend;
  document.getElementById("txt-hero-title").textContent = labels.heroTitle;
  document.getElementById("txt-hero-subtitle").textContent = labels.heroSubtitle;

  document.getElementById("txt-language-title").textContent = labels.chooseLanguageTitle;
  document.getElementById("txt-language-subtitle").textContent = labels.chooseLanguageText;
  btnEs.textContent = labels.languageEs;
  btnIt.textContent = labels.languageIt;

  backToLanguage.textContent = labels.back;
  document.getElementById("txt-access").textContent = labels.access;
  document.getElementById("txt-who-title").textContent = labels.whoAreYouTitle;
  document.getElementById("txt-who-subtitle").textContent = labels.whoAreYouText;

  document.getElementById("txt-welcome").textContent = labels.welcome;
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
  document.getElementById("upload-photo-btn").textContent = labels.uploadPhoto;

  document.getElementById("nav-home").textContent = labels.navHome;
  document.getElementById("nav-guide").textContent = labels.navGuide;
  document.getElementById("nav-dictionary").textContent = labels.navDictionary;
  document.getElementById("nav-game").textContent = labels.navGame;
  document.getElementById("nav-photos").textContent = labels.navPhotos;
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

  if (diff <= 0) {
    countdownElement.textContent = locale.labels.countdownStarted;
    return;
  }

  const totalMinutes = Math.floor(diff / 1000 / 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  countdownElement.textContent = `${String(days).padStart(2, "0")}d ${String(
    hours
  ).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
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

btnEs.addEventListener("click", () => {
  setLanguage("es");
});

btnIt.addEventListener("click", () => {
  setLanguage("it");
});

backToLanguage.addEventListener("click", () => {
  showScreen(screenLanguage);
});

changeProfile.addEventListener("click", () => {
  localStorage.removeItem("wedding_guest");
  currentGuestId = null;
  showScreen(screenGuest);
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const viewName = button.dataset.view;
    activateView(viewName);
  });
});

homeInfoStack.addEventListener("click", (event) => {
  const targetButton = event.target.closest("[data-target-view]");
  if (!targetButton) return;
  activateView(targetButton.dataset.targetView);
});

function restoreSession() {
  const savedLang = localStorage.getItem("wedding_lang");
  const savedGuestId = localStorage.getItem("wedding_guest");

  if (savedLang && APP_DATA.translations[savedLang]) {
    currentLanguage = savedLang;
  }

  applyTranslations();
  renderAllDynamicSections();
  highlightSelectedLanguage();

  if (savedGuestId && findGuestById(savedGuestId)) {
    currentGuestId = savedGuestId;
    const guest = findGuestById(savedGuestId);
    selectedGuestName.textContent = guest.name;
    renderHomeDashboard();
    showScreen(screenApp);
    return;
  }

  if (savedLang) {
    showScreen(screenGuest);
    return;
  }

  showScreen(screenLanguage);
}

restoreSession();
activateView("home");
updateCountdown();
setInterval(updateCountdown, 60000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service Worker registration failed:", error);
    });
  });
}
