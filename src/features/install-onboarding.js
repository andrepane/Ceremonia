const INSTALL_ONBOARDING_STORAGE_KEY = "install_onboarding_completed";

const COPY = {
  es: {
    progress: (step) => `Paso ${step} de 3`,
    back: "Volver",
    language: {
      title: "Antes de entrar",
      text: "Te vamos a guiar para instalar la app en tu móvil. Así podrás abrirla como una app normal durante el fin de semana.",
      options: {
        es: "Español",
        it: "Italiano"
      }
    },
    device: {
      title: "¿Qué móvil estás usando?",
      text: "Elige tu dispositivo para ver los pasos correctos.",
      ios: "iPhone / iPad",
      android: "Android"
    },
    ios: {
      title: "Instalar en iPhone",
      intro: "Hazlo desde Safari. Si estás en WhatsApp, abre primero el enlace en Safari.",
      steps: [
        "Pulsa el botón de compartir de Safari.",
        "Busca la opción “Añadir a pantalla de inicio”. Puede estar más abajo en el menú.",
        "Pulsa “Añadir”.",
        "Ahora cierra Safari.",
        "Busca el icono de la app en la pantalla de inicio del iPhone y ábrela desde ahí."
      ],
      note: "No sigas navegando desde Safari. Después de instalarla, entra siempre desde el icono de la app.",
      confirm: "Ya la he instalado y la he abierto desde la app",
      skip: "Continuar sin instalar"
    },
    android: {
      title: "Instalar en Android",
      intro: "Hazlo desde Google Chrome. Si estás en WhatsApp, abre primero el enlace en Chrome.",
      steps: [
        "Abre este enlace en Google Chrome.",
        "Toca el menú de los tres puntos arriba a la derecha.",
        "Pulsa “Instalar app” o “Añadir a pantalla de inicio”.",
        "Confirma pulsando “Instalar”.",
        "Cuando termine, cierra Chrome.",
        "Busca el icono de la app en tu pantalla de inicio o en el cajón de aplicaciones y ábrela desde ahí."
      ],
      note: "No sigas navegando desde Chrome. Después de instalarla, entra siempre desde el icono de la app.",
      confirm: "Ya la he instalado y la he abierto desde la app",
      skip: "Continuar sin instalar"
    }
  },
  it: {
    progress: (step) => `Passo ${step} di 3`,
    back: "Indietro",
    language: {
      title: "Prima di entrare",
      text: "Ti guideremo per installare l’app sul tuo telefono. Così potrai aprirla come una normale app durante il weekend.",
      options: {
        it: "Italiano",
        es: "Spagnolo"
      }
    },
    device: {
      title: "Che telefono stai usando?",
      text: "Scegli il tuo dispositivo per vedere i passaggi corretti.",
      ios: "iPhone / iPad",
      android: "Android"
    },
    ios: {
      title: "Installare su iPhone",
      intro: "Fallo da Safari. Se sei dentro WhatsApp, apri prima il link in Safari.",
      steps: [
        "Tocca il pulsante di condivisione di Safari.",
        "Cerca l’opzione “Aggiungi alla schermata Home”. Potrebbe essere più in basso nel menu.",
        "Tocca “Aggiungi”.",
        "Ora chiudi Safari.",
        "Cerca l’icona dell’app nella schermata Home dell’iPhone e aprila da lì."
      ],
      note: "Non continuare a navigare da Safari. Dopo averla installata, entra sempre dall’icona dell’app.",
      confirm: "L’ho installata e l’ho aperta dall’app",
      skip: "Continuare senza installare"
    },
    android: {
      title: "Installare su Android",
      intro: "Fallo da Google Chrome. Se sei dentro WhatsApp, apri prima il link in Chrome.",
      steps: [
        "Apri questo link in Google Chrome.",
        "Tocca il menu con i tre puntini in alto a destra.",
        "Tocca “Installa app” oppure “Aggiungi alla schermata Home”.",
        "Conferma toccando “Installa”.",
        "Quando ha finito, chiudi Chrome.",
        "Cerca l’icona dell’app nella schermata Home o nel menu delle app e aprila da lì."
      ],
      note: "Non continuare a navigare da Chrome. Dopo averla installata, entra sempre dall’icona dell’app.",
      confirm: "L’ho installata e l’ho aperta dall’app",
      skip: "Continuare senza installare"
    }
  }
};

function detectStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function shouldSkipOnboarding() {
  return localStorage.getItem(INSTALL_ONBOARDING_STORAGE_KEY) === "true" || detectStandaloneMode();
}

export function initInstallOnboarding() {
  const root = document.getElementById("install-onboarding");
  const card = document.getElementById("install-onboarding-card");
  const appShell = document.querySelector(".app-shell");

  if (!root || !card || !appShell) return false;

  const complete = () => {
    localStorage.setItem(INSTALL_ONBOARDING_STORAGE_KEY, "true");
    root.setAttribute("hidden", "");
    appShell.classList.remove("app-shell--hidden");
  };

  if (shouldSkipOnboarding()) {
    root.setAttribute("hidden", "");
    appShell.classList.remove("app-shell--hidden");
    return false;
  }

  appShell.classList.add("app-shell--hidden");

  const flow = {
    lang: "es",
    device: null,
    step: 1
  };

  const render = () => {
    const c = COPY[flow.lang] || COPY.es;
    const showBack = flow.step > 1;
    const progress = c.progress(flow.step);

    let body = "";

    if (flow.step === 1) {
      body = `
        <header class="install-onboarding__header">
          <p class="install-onboarding__progress">${progress}</p>
          <h2 class="install-onboarding__title">${c.language.title}</h2>
          <p class="install-onboarding__text">${c.language.text}</p>
        </header>
        <div class="install-onboarding__actions">
          <button class="primary-btn primary-btn--full" type="button" data-action="select-language" data-lang="es">${c.language.options.es}</button>
          <button class="secondary-btn primary-btn--full" type="button" data-action="select-language" data-lang="it">${c.language.options.it}</button>
        </div>
      `;
    }

    if (flow.step === 2) {
      body = `
        <header class="install-onboarding__header">
          <p class="install-onboarding__progress">${progress}</p>
          <h2 class="install-onboarding__title">${c.device.title}</h2>
          <p class="install-onboarding__text">${c.device.text}</p>
        </header>
        <div class="install-onboarding__actions">
          <button class="primary-btn primary-btn--full" type="button" data-action="select-device" data-device="ios">${c.device.ios}</button>
          <button class="secondary-btn primary-btn--full" type="button" data-action="select-device" data-device="android">${c.device.android}</button>
        </div>
      `;
    }

    if (flow.step === 3 && flow.device) {
      const tutorial = c[flow.device];
      body = `
        <header class="install-onboarding__header">
          <p class="install-onboarding__progress">${progress}</p>
          <h2 class="install-onboarding__title">${tutorial.title}</h2>
          <p class="install-onboarding__text">${tutorial.intro}</p>
        </header>
        <ol class="install-onboarding__steps">
          ${tutorial.steps.map((step) => `<li>${step}</li>`).join("")}
        </ol>
        <p class="install-onboarding__note">${tutorial.note}</p>
        <div class="install-onboarding__actions">
          <button class="primary-btn primary-btn--full" type="button" data-action="complete">${tutorial.confirm}</button>
          <button class="install-onboarding__skip" type="button" data-action="complete">${tutorial.skip}</button>
        </div>
      `;
    }

    const backButton = showBack
      ? `<button class="text-btn text-btn--inline install-onboarding__back" type="button" data-action="back">← ${c.back}</button>`
      : "";

    card.innerHTML = `${backButton}${body}`;
    card.classList.remove("install-onboarding__card--enter");
    void card.offsetWidth;
    card.classList.add("install-onboarding__card--enter");
  };

  card.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;

    if (action === "select-language") {
      flow.lang = target.dataset.lang === "it" ? "it" : "es";
      flow.step = 2;
      render();
      return;
    }

    if (action === "select-device") {
      flow.device = target.dataset.device === "android" ? "android" : "ios";
      flow.step = 3;
      render();
      return;
    }

    if (action === "back") {
      if (flow.step === 3) {
        flow.step = 2;
      } else if (flow.step === 2) {
        flow.step = 1;
      }
      render();
      return;
    }

    if (action === "complete") {
      complete();
    }
  });

  render();
  return true;
}
