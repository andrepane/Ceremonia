const onboardingRoot = document.getElementById("onboarding");
const appRoot = document.getElementById("app");

const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const COPY = {
  es: {
    progress: ["Paso 1 de 3", "Paso 2 de 3", "Paso 3 de 3"],
    s1Title: "Antes de entrar",
    s1Text: "Te vamos a guiar para instalar la app en tu móvil. Solo tienes que seguir unos pasos.",
    enter: "Entrar",
    s2Title: "¿Qué móvil estás usando?",
    s2Text: "Elige tu dispositivo para ver los pasos.",
    ios: "iPhone / iPad",
    android: "Android",
    back: "Volver",
    iosTitle: "Instalar en iPhone",
    iosSteps: [
      "Pulsa el botón de compartir en Safari.",
      "Busca y pulsa “Añadir a pantalla de inicio”.",
      "Pulsa “Añadir” para confirmar.",
      "Cierra Safari completamente.",
      "Busca el icono de la app en tu pantalla de inicio.",
      "Abre la app desde ese icono."
    ],
    iosFinal: "Solo podrás continuar cuando abras la app desde ese icono. No uses Safari.",
    androidTitle: "Instalar en Android",
    androidSteps: [
      "Pulsa el menú de los tres puntos en Chrome.",
      "Pulsa “Instalar app” o “Añadir a pantalla de inicio”.",
      "Confirma pulsando “Instalar”.",
      "Cierra Google Chrome.",
      "Busca el icono de la app en tu pantalla de inicio o en el menú de apps.",
      "Abre la app desde ese icono."
    ],
    androidFinal: "Solo podrás continuar cuando abras la app desde ese icono. No uses Chrome."
  },
  it: {
    progress: ["Passo 1 di 3", "Passo 2 di 3", "Passo 3 di 3"],
    s1Title: "Prima di entrare",
    s1Text: "Ti guideremo per installare l’app sul tuo telefono. Devi solo seguire alcuni passaggi.",
    enter: "Entra",
    s2Title: "Che telefono stai usando?",
    s2Text: "Scegli il tuo dispositivo per vedere i passaggi.",
    ios: "iPhone / iPad",
    android: "Android",
    back: "Indietro",
    iosTitle: "Installare su iPhone",
    iosSteps: [
      "Tocca il pulsante di condivisione in Safari.",
      "Cerca e tocca “Aggiungi alla schermata Home”.",
      "Tocca “Aggiungi” per confermare.",
      "Chiudi completamente Safari.",
      "Cerca l’icona dell’app nella schermata Home.",
      "Apri l’app da quell’icona."
    ],
    iosFinal: "Potrai continuare solo aprendo l’app da quell’icona. Non usare Safari.",
    androidTitle: "Installare su Android",
    androidSteps: [
      "Tocca il menu con i tre puntini in Chrome.",
      "Tocca “Installa app” o “Aggiungi alla schermata Home”.",
      "Conferma toccando “Installa”.",
      "Chiudi Google Chrome.",
      "Cerca l’icona dell’app nella schermata Home o nel menu app.",
      "Apri l’app da quell’icona."
    ],
    androidFinal: "Potrai continuare solo aprendo l’app da quell’icona. Non usare Chrome."
  }
};

const state = {
  lang: "es",
  screen: 1,
  device: null
};

function setAppVisible(enabled) {
  appRoot.hidden = !enabled;
  appRoot.setAttribute("aria-hidden", String(!enabled));
  appRoot.inert = !enabled;
}

function renderOnboarding() {
  const text = COPY[state.lang];
  const onboardingScreen = state.screen;
  const progress = text.progress[Math.max(0, onboardingScreen - 1)] || text.progress[0];

  let body = "";
  if (onboardingScreen === 1) {
    body = `
      <header class="install-header">
        <span class="install-progress">${progress}</span>
        <div class="lang-toggle" role="group" aria-label="Language">
          <button type="button" class="lang-toggle__btn ${state.lang === "es" ? "is-active" : ""}" data-action="lang" data-lang="es">ES</button>
          <button type="button" class="lang-toggle__btn ${state.lang === "it" ? "is-active" : ""}" data-action="lang" data-lang="it">IT</button>
        </div>
      </header>
      <h1 class="install-title">${text.s1Title}</h1>
      <p class="install-text">${text.s1Text}</p>
      <button type="button" class="primary-btn primary-btn--full install-cta" data-action="next">${text.enter}</button>
    `;
  } else if (onboardingScreen === 2) {
    body = `
      <header class="install-header install-header--with-back">
        <button type="button" class="text-btn install-back" data-action="back">← ${text.back}</button>
        <span class="install-progress">${progress}</span>
      </header>
      <h2 class="install-title install-title--small">${text.s2Title}</h2>
      <p class="install-text">${text.s2Text}</p>
      <div class="install-device-actions">
        <button type="button" class="primary-btn primary-btn--full" data-action="device" data-device="ios">${text.ios}</button>
        <button type="button" class="secondary-btn primary-btn--full" data-action="device" data-device="android">${text.android}</button>
      </div>
    `;
  } else {
    const isIos = state.device === "ios";
    const title = isIos ? text.iosTitle : text.androidTitle;
    const steps = isIos ? text.iosSteps : text.androidSteps;
    const finalText = isIos ? text.iosFinal : text.androidFinal;
    body = `
      <header class="install-header install-header--with-back">
        <button type="button" class="text-btn install-back" data-action="back">← ${text.back}</button>
        <span class="install-progress">${progress}</span>
      </header>
      <h2 class="install-title install-title--small">${title}</h2>
      <ol class="install-steps">
        ${steps.map((step) => `<li>${step}</li>`).join("")}
      </ol>
      <p class="install-final">${finalText}</p>
    `;
  }

  onboardingRoot.innerHTML = `
    <section class="install-shell ${onboardingScreen === 3 ? "install-shell--steps" : ""}" aria-live="polite">
      <article class="install-card" data-screen="${onboardingScreen}">
        ${body}
      </article>
    </section>
  `;
}

function bindOnboardingEvents() {
  onboardingRoot.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    if (action === "lang") {
      state.lang = button.dataset.lang === "it" ? "it" : "es";
      renderOnboarding();
      return;
    }

    if (action === "next") {
      state.screen = 2;
      renderOnboarding();
      return;
    }

    if (action === "back") {
      if (state.screen === 3) {
        state.screen = 2;
      } else if (state.screen === 2) {
        state.screen = 1;
      }
      renderOnboarding();
      return;
    }

    if (action === "device") {
      state.device = button.dataset.device === "ios" ? "ios" : "android";
      state.screen = 3;
      renderOnboarding();
    }
  });
}

async function bootApp() {
  await import("./main.js");
}

async function init() {
  if (isStandalone) {
    onboardingRoot.hidden = true;
    setAppVisible(true);
    await bootApp();
    return;
  }

  setAppVisible(false);
  onboardingRoot.hidden = false;
  bindOnboardingEvents();
  renderOnboarding();
}

init();
