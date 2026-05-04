const INSTALL_ONBOARDING_COPY = {
  es: {
    progress: ["Paso 1 de 3", "Paso 2 de 3", "Paso 3 de 3"],
    screen1Title: "Antes de entrar",
    screen1Text: "Te vamos a guiar para instalar la app en tu móvil. Solo tienes que seguir unos pasos.",
    enter: "Entrar",
    screen2Title: "¿Qué móvil estás usando?",
    screen2Text: "Elige tu dispositivo para ver los pasos.",
    ios: "iPhone",
    android: "Android",
    iosTitle: "Instalar en iPhone",
    iosSteps: [
      "Toca los 3 puntitos abajo a la derecha.",
      "Pulsa el botón 'compartir'.",
      "Busca y pulsa “Añadir a pantalla de inicio”.",
      "Pulsa “Añadir”.",
      "Busca el icono de la app en tu pantalla de inicio.",
      "Abre la app desde ese icono."
    ],
    iosFinal: "Abre la app desde el icono para continuar. Ya no hace falta que uses Safari.",
    androidTitle: "Instalar en Android",
    androidSteps: [
      "Pulsa el menú de los tres puntos en Chrome.",
      "Pulsa “Instalar app” o “Añadir a pantalla de inicio”.",
      "Confirma pulsando “Instalar”.",
      "Busca el icono de la app en tu pantalla de inicio o menú de apps.",
      "Abre la app desde ese icono."
    ],
    androidFinal: "Abre la app desde el icono para continuar. Ya no hace falta que uses Chrome.",
    done: "Hecho",
    completed: "Tutorial terminado"
  },
  it: {
    progress: ["Passo 1 di 3", "Passo 2 di 3", "Passo 3 di 3"],
    screen1Title: "Prima di entrare",
    screen1Text: "Ti guideremo per installare l’app sul tuo telefono. Devi solo seguire alcuni passaggi.",
    enter: "Entra",
    screen2Title: "Che telefono stai usando?",
    screen2Text: "Scegli il tuo dispositivo per vedere i passaggi.",
    ios: "iPhone",
    android: "Android",
    iosTitle: "Installare su iPhone",
    iosSteps: [
      "Tocca i 3 puntini in basso a destra.",
      "Tocca il tasto condividi.",
      "Cerca e tocca “Aggiungi alla schermata Home”.",
      "Tocca “Aggiungi”.",
      "Cerca l’icona dell’app nella schermata Home.",
      "Apri l’app da quell’icona."
    ],
    iosFinal: "Apri l’app dall’icona per continuare. Non c’è più bisogno che utilizzi Safari.",
    androidTitle: "Installare su Android",
    androidSteps: [
      "Tocca il menu con i tre puntini in Chrome.",
      "Tocca “Installa app” o “Aggiungi alla schermata Home”.",
      "Conferma toccando “Installa”.",
      "Cerca l’icona dell’app nella schermata Home o nel menu app.",
      "Apri l’app da quell’icona."
    ],
    androidFinal: "Apri l’app dall’icona per continuare. Non c’è più bisogno che utilizzi Chrome.",
    done: "Fatto",
    completed: "Tutorial finito"
  }
};

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function setAppAccessVisibility(isVisible) {
  const appRoot = document.getElementById("app");
  if (!appRoot) return;
  if (isVisible) appRoot.removeAttribute("hidden");
  else appRoot.setAttribute("hidden", "");
}

function setOnboardingVisibility(isVisible) {
  const onboardingRoot = document.getElementById("onboarding");
  if (!onboardingRoot) return;
  if (isVisible) onboardingRoot.removeAttribute("hidden");
  else onboardingRoot.setAttribute("hidden", "");
}

export function initInstallOnboardingGate() {
  const onboardingRoot = document.getElementById("onboarding");
  if (!onboardingRoot) return false;

  if (isStandaloneMode()) {
    setOnboardingVisibility(false);
    setAppAccessVisibility(true);
    return false;
  }

  const onboardingState = { step: 1, lang: "es", device: "ios" };
  let completionAnimationTimeoutId = null;

  const clearCompletionAnimationTimeout = () => {
    if (!completionAnimationTimeoutId) return;
    window.clearTimeout(completionAnimationTimeoutId);
    completionAnimationTimeoutId = null;
  };

  const render = () => {
    const copy = INSTALL_ONBOARDING_COPY[onboardingState.lang];
    if (onboardingState.completing) {
      onboardingRoot.innerHTML = `<section class="install-onboarding__card install-onboarding__completion" aria-live="polite"><p class="install-onboarding__completion-badge">✓</p><h2 class="section-title install-onboarding__completion-title">${copy.completed}</h2></section>`;
      return;
    }

    const isStepOne = onboardingState.step === 1;
    const isStepTwo = onboardingState.step === 2;
    const isStepThree = onboardingState.step === 3;
    const isIos = onboardingState.device === "ios";
    const title = isStepOne ? copy.screen1Title : isStepTwo ? copy.screen2Title : isIos ? copy.iosTitle : copy.androidTitle;
    const text = isStepOne ? copy.screen1Text : isStepTwo ? copy.screen2Text : "";
    const steps = isStepThree ? (isIos ? copy.iosSteps : copy.androidSteps) : [];
    const finalMessage = isStepThree ? (isIos ? copy.iosFinal : copy.androidFinal) : "";
    const progressLabel = copy.progress[onboardingState.step - 1];

    onboardingRoot.innerHTML = `
      <section class="install-onboarding__card install-onboarding__screen">
        <div class="install-onboarding__head">
          ${onboardingState.step > 1 ? `<button type="button" class="install-onboarding__back" data-onboarding-back="true" aria-label="Back">←</button>` : `<p class="install-onboarding__progress">${progressLabel}</p>`}
          ${isStepOne ? `<div class="install-onboarding__lang" role="group" aria-label="Language"><button type="button" class="install-onboarding__lang-btn ${onboardingState.lang === "es" ? "install-onboarding__lang-btn--active" : ""}" data-onboarding-lang="es">ES</button><button type="button" class="install-onboarding__lang-btn ${onboardingState.lang === "it" ? "install-onboarding__lang-btn--active" : ""}" data-onboarding-lang="it">IT</button></div>` : `<p class="install-onboarding__progress">${progressLabel}</p>`}
        </div>
        <h2 class="section-title install-onboarding__title">${title}</h2>
        ${text ? `<p class="install-onboarding__text">${text}</p>` : ""}
        ${steps.length ? `<ol class="install-onboarding__steps">${steps.map((item) => `<li>${item}</li>`).join("")}</ol>` : ""}
        ${finalMessage ? `<p class="install-onboarding__footer-note">${finalMessage}</p>` : ""}
        <div class="install-onboarding__actions">
          ${isStepOne ? `<button type="button" class="primary-btn primary-btn--full" data-onboarding-next="1">${copy.enter}</button>` : ""}
          ${isStepTwo ? `<button type="button" class="primary-btn primary-btn--full" data-onboarding-device="ios">${copy.ios}</button><button type="button" class="primary-btn primary-btn--full" data-onboarding-device="android">${copy.android}</button>` : ""}
          ${isStepThree ? `<button type="button" class="primary-btn primary-btn--full" data-onboarding-done="true">${copy.done}</button>` : ""}
        </div>
      </section>
    `;
  };

  onboardingRoot.addEventListener("click", (event) => {
    const langButton = event.target.closest("[data-onboarding-lang]");
    if (langButton) {
      onboardingState.lang = langButton.dataset.onboardingLang;
      render();
      return;
    }
    const backButton = event.target.closest("[data-onboarding-back]");
    if (backButton) {
      onboardingState.step = onboardingState.step === 3 ? 2 : 1;
      render();
      return;
    }
    const nextButton = event.target.closest("[data-onboarding-next]");
    if (nextButton) {
      onboardingState.step = 2;
      render();
      return;
    }
    const deviceButton = event.target.closest("[data-onboarding-device]");
    if (deviceButton) {
      onboardingState.device = deviceButton.dataset.onboardingDevice;
      onboardingState.step = 3;
      render();
      return;
    }
    const doneButton = event.target.closest("[data-onboarding-done]");
    if (!doneButton) return;
    clearCompletionAnimationTimeout();
    onboardingState.completing = true;
    render();
    completionAnimationTimeoutId = window.setTimeout(() => {
      onboardingState.completing = false;
      onboardingState.step = 3;
      render();
    }, 1900);
    setOnboardingVisibility(true);
    setAppAccessVisibility(false);
  });

  render();
  setOnboardingVisibility(true);
  setAppAccessVisibility(false);
  return true;
}
