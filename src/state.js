export const APP_DATA = window.WEDDING_APP_DATA;

export const refs = {
  screenLanguage: document.getElementById("screen-language"),
  screenGuest: document.getElementById("screen-guest"),
  screenApp: document.getElementById("screen-app"),
  btnEs: document.getElementById("btn-es"),
  btnIt: document.getElementById("btn-it"),
  backToLanguage: document.getElementById("back-to-language"),
  changeProfile: document.getElementById("change-profile"),
  guestbookTrigger: document.getElementById("guestbook-trigger"),
  guestbookModal: document.getElementById("guestbook-modal"),
  guestbookClose: document.getElementById("guestbook-close"),
  uploadPhotoBtn: document.getElementById("upload-photo-btn"),
  uploadPhotoBtnLabel: document.getElementById("upload-photo-btn-label"),
  uploadPhotoBtnProgressText: document.getElementById("upload-photo-progress-text"),
  guestGrid: document.getElementById("guest-grid"),
  bottomNav: document.querySelector(".bottom-nav"),
  navLiquidIndicator: document.querySelector(".nav-liquid-indicator"),
  navButtons: document.querySelectorAll(".nav-btn"),
  views: document.querySelectorAll(".view"),
  selectedGuestName: document.getElementById("selected-guest-name"),
  profileAvatarElement: document.getElementById("profile-avatar"),
  countdownElement: document.getElementById("countdown"),
  countdownHintElement: document.getElementById("txt-countdown-hint"),
  countdownNextEventLabelElement: document.getElementById("txt-next-event-label"),
  countdownNextEventElement: document.getElementById("countdown-next-event"),
  countdownUrgencyElement: document.getElementById("countdown-urgency"),
  guestHeaderMessageElement: document.getElementById("guest-header-message"),
  homeInfoStack: document.getElementById("home-info-stack"),
  appShell: document.querySelector(".app-shell"),
  translatorInput: document.getElementById("translator-input"),
  translatorButton: document.getElementById("translator-btn"),
  translatorSpeakButton: document.getElementById("translator-speak-btn"),
  translatorText: document.getElementById("txt-translator-text"),
  translatorHistoryTitle: document.getElementById("txt-translator-history-title"),
  translatorHistoryList: document.getElementById("translator-history-list")
};

export const constants = {
  TRANSLATOR_API_ENDPOINT: "/api/translate",
  TRANSLATOR_UI_COPY: {
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
  },
  WEEKEND_TIMELINE_STARTS: [
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
  ],
  SATURDAY_ONLY_GUEST_IDS: new Set(["tito", "ana_amiga_novia", "gabri"]),
  FRIDAY_TIMELINE_ITEMS_TO_HIDE: 3
};

export const HOME_DASHBOARD_COPY = {
  es: {
    weekendFormatLabel: "PEQUEÑA ACLARACIÓN", 
    weekendFormatTitle: "Nuestra 'Boda'",
    weekendFormatParagraphs: [
      "Una boda diferente, sin prisas ni protocolos innecesarios.",
      "Más que un evento, es un fin de semana en familia para estar a gusto, compartir tiempo de verdad y disfrutar sin presión.",
      "La idea es sencilla: buen ambiente, música, piscina y todo preparado para que solo tengáis que venir a pasarlo bien.",
      "Iremos construyendo cada momento entre todos, de forma natural, sin guion cerrado. Porque no se trata de una boda al uso, sino de celebrar juntos, a nuestro ritmo."
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
      delete_photo: "{name} ha borrado una foto",
      react_photo: "{name} ha reaccionado a una foto",
      write_dedication: "{name} ha escrito una dedicatoria a los novios"
    },
    activityEmpty: "Aún no hay actividad compartida.",
    activityEmptyElegant: "Sé el primero en subir una foto.",
    activityFallback: "Sin conexión a Firebase: cuando vuelva, verás la actividad del grupo aquí.",
    activityLoading: "Cargando actividad del grupo...",
    offlineBanner: "Sin conexión en tiempo real. Mostrando contenido de respaldo.",
    minutesAgo: "hace {count} min",
    hoursAgo: "hace {count} h",
    countdownUnits: {
      days: "D",
      hours: "H",
      minutes: "M",
      seconds: "S"
    },
    nextEventLabel: "Siguiente evento",
    nextEventFallback: "No quedan eventos pendientes en la guía.",
    countdownUrgency: "⏰ Queda menos de 24 horas para la ceremonia.",
    momentVariants: {
      pre: [
        "Queda muy poco: estamos ultimando los preparativos.",
        "Vamos calentando motores para un finde inolvidable.",
        "Modo preparación activado: se acerca el gran momento.",
        "Se viene un fin de semana muy especial… ¡ya casi!",
        "Cada detalle cuenta: estamos en los últimos preparativos."
      ],
      live: [
        "Estamos en pleno finde de boda: ¡a vivirlo!",
        "Llegó el momento: toca disfrutar, compartir y celebrar.",
        "Bienvenidos al corazón del fin de semana de boda.",
        "Ahora sí: estamos dentro del gran fin de semana.",
        "Todo en marcha: seguid el ritmo y disfrutadlo juntos."
      ]
    },
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
    deletePhoto: "Eliminar",
    deletePhotoConfirm: "¿Seguro que quieres eliminar esta foto?",
    deleteError: "No se pudo eliminar la foto.",
    likeError: "No se pudo registrar el like.",
    authError: "No se pudo autenticar."
  },
  it: {
    weekendFormatLabel: "PICCOLO CHIARIMENTO",
    weekendFormatTitle: "Il nostro 'Matrimonio'",
    weekendFormatParagraphs: [
      "Un matrimonio diverso, senza fretta né protocolli inutili.",
      "Più che un evento, è un fine settimana in famiglia per stare bene, condividere tempo insieme e godersi tutto senza pressioni.",
      "L’idea è semplice: buon ambiente, musica, piscina e tutto organizzato affinchè dobbiate solo venire a divertirvi.",
      "Costruiremo ogni momento insieme, in modo naturale, senza un copione rigido. Perché non si tratta di un matrimonio tradizionale, ma di festeggiare insieme, con i nostri ritmi."
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
      delete_photo: "{name} ha eliminato una foto",
      react_photo: "{name} ha reagito a una foto",
      write_dedication: "{name} ha scritto una dedica agli sposi"
    },
    activityEmpty: "Non ci sono ancora attività condivise.",
    activityEmptyElegant: "Sii il primo a caricare una foto.",
    activityFallback: "Senza connessione a Firebase: quando torna, vedrai qui l'attività del gruppo.",
    activityLoading: "Caricamento attività del gruppo...",
    offlineBanner: "Senza connessione realtime. Mostro contenuti di fallback.",
    minutesAgo: "{count} min fa",
    hoursAgo: "{count} h fa",
    countdownUnits: {
      days: "G",
      hours: "O",
      minutes: "M",
      seconds: "S"
    },
    nextEventLabel: "Prossimo evento",
    nextEventFallback: "Non ci sono altri eventi in programma.",
    countdownUrgency: "⏰ Manca meno di 24 ore alla cerimonia.",
    momentVariants: {
      pre: [
        "Manca pochissimo: stiamo ultimando i preparativi.",
        "Stiamo scaldando i motori per un weekend indimenticabile.",
        "Modalità preparazione attivata: il grande momento si avvicina.",
        "Arriva un fine settimana davvero speciale… ci siamo quasi!",
        "Ogni dettaglio conta: siamo agli ultimi preparativi."
      ],
      live: [
        "Siamo nel pieno delle nozze: viviamocelo!",
        "È arrivato il momento: godiamoci, condividiamo e festeggiamo.",
        "Benvenuti nel cuore del fine settimana.",
        "Adesso sì: siamo dentro il grande weekend.",
        "Tutto è in movimento: seguite il ritmo e godetevelo insieme."
      ]
    },
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
    deletePhoto: "Elimina",
    deletePhotoConfirm: "Vuoi davvero eliminare questa foto?",
    deleteError: "Impossibile eliminare la foto.",
    likeError: "Impossibile registrare il like.",
    authError: "Impossibile autenticarsi."
  }
};

export const state = {
  currentLanguage: "es",
  currentGuestId: null,
  realtimeActivity: [],
  realtimePhotos: [],
  realtimeGuestLocks: {},
  firebaseOnline: false,
  authUid: null,
  hasActiveGuestLock: false,
  unsubscribeActivity: () => {},
  unsubscribePhotos: () => {},
  unsubscribeGuestPresence: () => {},
  pendingPhotoLikes: new Set(),
  isWeekendFormatExpanded: false,
  homeActivityLoading: true,
  homePhotosLoading: true,
  lastTranslatedLanguage: "it",
  translationHistoryByGuest: {},
  currentTranslationByGuest: {},
  unsubscribeDictionary: () => {},
  guestbookEntries: []
};

export const setState = (updates) => Object.assign(state, updates);

export const getLocale = () => APP_DATA.translations[state.currentLanguage] || APP_DATA.translations.es;
export const getHomeCopy = () => HOME_DASHBOARD_COPY[state.currentLanguage] || HOME_DASHBOARD_COPY.es;
export const findGuestById = (guestId) => APP_DATA.guests.find((guest) => guest.id === guestId) || null;
