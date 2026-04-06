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

let currentLanguage = "es";
let currentGuestId = null;

function showScreen(screenToShow) {
  [screenLanguage, screenGuest, screenApp].forEach((screen) => {
    screen.classList.remove("screen--active");
  });

  screenToShow.classList.add("screen--active");
}

function getLocale() {
  return APP_DATA.translations[currentLanguage] || APP_DATA.translations.es;
}

function findGuestById(guestId) {
  return APP_DATA.guests.find((guest) => guest.id === guestId) || null;
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

function renderHomeCards() {
  const locale = getLocale();
  const container = document.getElementById("home-info-stack");

  container.innerHTML = locale.homeCards
    .map(
      (card) => `
      <article class="card">
        <p class="card-label">${card.label}</p>
        <h3 class="card-title">${card.title}</h3>
        <p class="card-text">${card.text}</p>
      </article>
    `
    )
    .join("");
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
  renderHomeCards();
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
