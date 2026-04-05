const screenLanguage = document.getElementById("screen-language");
const screenGuest = document.getElementById("screen-guest");
const screenApp = document.getElementById("screen-app");

const btnEs = document.getElementById("btn-es");
const backToLanguage = document.getElementById("back-to-language");
const changeProfile = document.getElementById("change-profile");

const guestCards = document.querySelectorAll(".guest-card");
const navButtons = document.querySelectorAll(".nav-btn");
const views = document.querySelectorAll(".view");

const selectedGuestName = document.getElementById("selected-guest-name");
const countdownElement = document.getElementById("countdown");

let currentLanguage = null;
let currentGuest = null;

function showScreen(screenToShow) {
  [screenLanguage, screenGuest, screenApp].forEach((screen) => {
    screen.classList.remove("screen--active");
  });

  screenToShow.classList.add("screen--active");
}

function setLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem("wedding_lang", lang);
  showScreen(screenGuest);
}

function setGuest(guestName) {
  currentGuest = guestName;
  localStorage.setItem("wedding_guest", guestName);
  selectedGuestName.textContent = guestName;
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

function updateCountdown() {
  // Fecha demo: sábado 13 septiembre a las 19:00
  const ceremonyDate = new Date("2026-09-13T19:00:00");
  const now = new Date();
  const diff = ceremonyDate - now;

  if (diff <= 0) {
    countdownElement.textContent = "Ya ha empezado";
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

btnEs.addEventListener("click", () => {
  setLanguage("es");
});

backToLanguage.addEventListener("click", () => {
  showScreen(screenLanguage);
});

changeProfile.addEventListener("click", () => {
  localStorage.removeItem("wedding_guest");
  currentGuest = null;
  showScreen(screenGuest);
});

guestCards.forEach((card) => {
  card.addEventListener("click", () => {
    const guestName = card.querySelector(".guest-name").textContent.trim();
    setGuest(guestName);
  });
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const viewName = button.dataset.view;
    activateView(viewName);
  });
});

function restoreSession() {
  const savedLang = localStorage.getItem("wedding_lang");
  const savedGuest = localStorage.getItem("wedding_guest");

  if (savedLang) {
    currentLanguage = savedLang;
  }

  if (savedLang && savedGuest) {
    selectedGuestName.textContent = savedGuest;
    currentGuest = savedGuest;
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
