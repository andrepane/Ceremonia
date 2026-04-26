const ONBOARDING_SEEN_KEY = "onboarding_seen";

function isAppInstalled() {
  const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches;
  const isIOSStandalone = Boolean(window.navigator.standalone);
  return isStandaloneMode || isIOSStandalone;
}

function hasSeenOnboarding() {
  return localStorage.getItem(ONBOARDING_SEEN_KEY) === "true";
}

function markOnboardingAsSeen() {
  localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
}

function detectIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function setAppVisible(isVisible) {
  const appContainer = document.getElementById("app");
  if (!appContainer) return;
  appContainer.classList.toggle("app-container--hidden", !isVisible);
  appContainer.classList.toggle("app-container--visible", isVisible);
  appContainer.setAttribute("aria-hidden", String(!isVisible));
}

function setOnboardingVisible(isVisible) {
  const onboardingContainer = document.getElementById("onboarding");
  if (!onboardingContainer) return;

  if (isVisible) {
    onboardingContainer.hidden = false;
    requestAnimationFrame(() => {
      onboardingContainer.classList.add("onboarding--visible");
      onboardingContainer.classList.remove("onboarding--hidden");
    });
    onboardingContainer.setAttribute("aria-hidden", "false");
    return;
  }

  onboardingContainer.classList.remove("onboarding--visible");
  onboardingContainer.classList.add("onboarding--hidden");
  onboardingContainer.setAttribute("aria-hidden", "true");
  window.setTimeout(() => {
    onboardingContainer.hidden = true;
  }, 300);
}

function renderOnboardingStep(step) {
  const onboardingContainer = document.getElementById("onboarding");
  if (!onboardingContainer) return;

  if (step === 1) {
    onboardingContainer.innerHTML = `
      <section class="onboarding__screen onboarding__screen--active">
        <div class="onboarding__card">
          <h2 class="onboarding__title">Hemos preparado algo para vosotros</h2>
          <button id="onboarding-continue" class="onboarding__btn onboarding__btn--primary" type="button">Continuar</button>
        </div>
      </section>
    `;
    return;
  }

  const isIOS = detectIOS();
  onboardingContainer.innerHTML = `
    <section class="onboarding__screen onboarding__screen--active">
      <div class="onboarding__card">
        <h2 class="onboarding__title">Instala la app para una mejor experiencia</h2>
        ${isIOS ? `
          <ol class="onboarding__list">
            <li>Pulsa el botón compartir</li>
            <li>“Añadir a pantalla de inicio”</li>
            <li>Confirmar</li>
          </ol>
        ` : `
          <p class="onboarding__text">Pulsa instalar cuando aparezca el aviso</p>
        `}
        <div class="onboarding__actions">
          <button id="onboarding-installed" class="onboarding__btn onboarding__btn--primary" type="button">Ya lo he instalado</button>
          <button id="onboarding-skip" class="onboarding__btn onboarding__btn--secondary" type="button">Continuar sin instalar</button>
        </div>
      </div>
    </section>
  `;
}

export function startOnboarding({ onComplete }) {
  let isCompleted = false;
  const completeOnboarding = () => {
    if (isCompleted) return;
    isCompleted = true;
    onComplete();
  };

  if (isAppInstalled() || hasSeenOnboarding()) {
    setOnboardingVisible(false);
    setAppVisible(true);
    completeOnboarding();
    return;
  }

  setAppVisible(false);
  renderOnboardingStep(1);
  setOnboardingVisible(true);

  const onboardingContainer = document.getElementById("onboarding");
  if (!onboardingContainer) {
    completeOnboarding();
    return;
  }

  onboardingContainer.addEventListener("click", (event) => {
    const continueButton = event.target.closest("#onboarding-continue");
    if (continueButton) {
      renderOnboardingStep(2);
      return;
    }

    const doneButton = event.target.closest("#onboarding-installed, #onboarding-skip");
    if (!doneButton) return;

    markOnboardingAsSeen();
    setOnboardingVisible(false);
    setAppVisible(true);
    completeOnboarding();
  }, { once: false });
}
