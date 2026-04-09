import {
  isFirebaseConfigured,
  ensureAuth,
  getAuthUid,
  linkGuestToAuth,
  subscribeGuestPresence,
  subscribeActivity,
  subscribePhotos,
  subscribeRanking,
  subscribeGuestChallenges,
  lockGuestProfile,
  switchGuestProfileLock,
  releaseGuestProfileLock,
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
const countdownHintElement = document.getElementById("txt-countdown-hint");
const countdownNextEventLabelElement = document.getElementById("txt-next-event-label");
const countdownNextEventElement = document.getElementById("countdown-next-event");
const countdownUrgencyElement = document.getElementById("countdown-urgency");
const homeInfoStack = document.getElementById("home-info-stack");
const appShell = document.querySelector(".app-shell");

let currentLanguage = "es";
let currentGuestId = null;
let realtimeActivity = [];
let realtimePhotos = [];
let realtimeRanking = [];
let realtimeChallenges = {};
let realtimeGuestLocks = {};
let firebaseOnline = false;
let authUid = null;
let hasActiveGuestLock = false;
let unsubscribeActivity = () => {};
let unsubscribePhotos = () => {};
let unsubscribeRanking = () => {};
let unsubscribeGuestChallenges = () => {};
let unsubscribeGuestPresence = () => {};
const pendingPhotoLikes = new Set();
let isWeekendFormatExpanded = false;
let homeActivityLoading = true;
let homePhotosLoading = true;

const MAX_ACTIVE_CHALLENGES = 5;
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
const CHALLENGE_DATABASE = [
  { id: "social_new_person", category: "social", points: 1, text: { es: "Hablar con alguien con quien aún no habías hablado", it: "Parlare con qualcuno con cui non avevi ancora parlato" } },
  { id: "social_other_family", category: "social", points: 1, text: { es: "Hablar con alguien de la otra familia", it: "Parlare con qualcuno dell'altra famiglia" } },
  { id: "social_mixed_languages", category: "social", points: 1, text: { es: "Participar en una conversación con mezcla de idiomas", it: "Partecipare a una conversazione con mix di lingue" } },
  { id: "social_switch_group", category: "social", points: 1, text: { es: "Cambiar de grupo de conversación al menos una vez", it: "Cambiare gruppo di conversazione almeno una volta" } },
  { id: "social_four_people", category: "social", points: 1, text: { es: "Participar en una conversación de 4 o más personas", it: "Partecipare a una conversazione con 4 o più persone" } },
  { id: "social_new_story", category: "social", points: 1, text: { es: "Escuchar una historia de alguien que no conocías bien", it: "Ascoltare una storia da qualcuno che non conoscevi bene" } },
  { id: "social_how_they_know", category: "social", points: 1, text: { es: "Preguntar a alguien cómo conoce a los novios", it: "Chiedere a qualcuno come conosce gli sposi" } },
  { id: "social_unexpected_talk", category: "social", points: 1, text: { es: "Acabar hablando con alguien con quien no esperabas hablar", it: "Finire a parlare con qualcuno con cui non ti aspettavi di parlare" } },
  { id: "social_someone_translates", category: "social", points: 1, text: { es: "Participar en una conversación donde alguien traduzca algo", it: "Partecipare a una conversazione in cui qualcuno traduce qualcosa" } },
  { id: "social_not_getting_it", category: "social", points: 1, text: { es: "Estar en una conversación en la que alguien diga “no me estoy enterando”", it: "Essere in una conversazione in cui qualcuno dica «non ci sto capendo niente»" } },
  { id: "culture_phrase_other_language", category: "culture_language", points: 1, text: { es: "Decir una frase en el otro idioma", it: "Dire una frase nell'altra lingua" } },
  { id: "culture_understand_without_translation", category: "culture_language", points: 1, text: { es: "Entender algo sin que te lo traduzcan", it: "Capire qualcosa senza traduzione" } },
  { id: "culture_ask_word_meaning", category: "culture_language", points: 1, text: { es: "Preguntar el significado de una palabra", it: "Chiedere il significato di una parola" } },
  { id: "culture_repeat_difficult_word", category: "culture_language", points: 1, text: { es: "Repetir correctamente una palabra difícil", it: "Ripetere correttamente una parola difficile" } },
  { id: "culture_mix_es_it", category: "culture_language", points: 1, text: { es: "Mezclar español e italiano en una frase", it: "Mescolare spagnolo e italiano in una frase" } },
  { id: "culture_teach_word", category: "culture_language", points: 1, text: { es: "Enseñar una palabra de tu idioma a alguien", it: "Insegnare una parola della tua lingua a qualcuno" } },
  { id: "culture_translate_moment", category: "culture_language", points: 1, text: { es: "Hacer de traductor en un momento puntual", it: "Fare da traduttore in un momento preciso" } },
  { id: "culture_understand_nothing", category: "culture_language", points: 1, text: { es: "Escuchar una frase y no entender nada (y reconocerlo)", it: "Sentire una frase e non capire nulla (e ammetterlo)" } },
  { id: "culture_new_word_weekend", category: "culture_language", points: 1, text: { es: "Aprender una palabra nueva durante el finde", it: "Imparare una parola nuova durante il weekend" } },
  { id: "culture_correct_word", category: "culture_language", points: 1, text: { es: "Corregir correctamente una palabra", it: "Correggere correttamente una parola" } },
  { id: "photo_friday", category: "photos", points: 1, text: { es: "Subir una foto del viernes (llegada / piscina)", it: "Caricare una foto del venerdì (arrivo / piscina)" } },
  { id: "photo_other_family", category: "photos", points: 1, text: { es: "Subir una foto con alguien de la otra familia", it: "Caricare una foto con qualcuno dell'altra famiglia" } },
  { id: "photo_three_people", category: "photos", points: 1, text: { es: "Subir una foto con 3 o más personas", it: "Caricare una foto con 3 o più persone" } },
  { id: "photo_before_ceremony", category: "photos", points: 1, text: { es: "Subir una foto antes de la ceremonia", it: "Caricare una foto prima della cerimonia" } },
  { id: "photo_after_ceremony", category: "photos", points: 1, text: { es: "Subir una foto después de la ceremonia", it: "Caricare una foto dopo la cerimonia" } },
  { id: "photo_unexpected_moment", category: "photos", points: 1, text: { es: "Subir una foto de un momento inesperado", it: "Caricare una foto di un momento inaspettato" } },
  { id: "photo_with_you", category: "photos", points: 1, text: { es: "Subir una foto en la que salgas tú", it: "Caricare una foto in cui ci sei tu" } },
  { id: "photo_group", category: "photos", points: 1, text: { es: "Subir una foto del grupo", it: "Caricare una foto del gruppo" } },
  { id: "photo_three_likes", category: "photos", points: 1, text: { es: "Conseguir 3 likes en una foto", it: "Ottenere 3 like su una foto" } },
  { id: "photo_two_uploads", category: "photos", points: 1, text: { es: "Subir al menos 2 fotos durante el finde", it: "Caricare almeno 2 foto durante il weekend" } },
  { id: "chaos_clap_no_reason", category: "chaos", points: 1, text: { es: "Aplaudir sin motivo aparente", it: "Applaudire senza motivo apparente" } },
  { id: "chaos_absurd_toast", category: "chaos", points: 1, text: { es: "Hacer un brindis por algo absurdo (repetible)", it: "Fare un brindisi per qualcosa di assurdo (ripetibile)" } },
  { id: "chaos_sternocleidomastoideo", category: "chaos", points: 1, text: { es: "Gritar “ESTERNOCLEIDOMASTOIDEO”", it: "Gridare «STERNOCLEIDOMASTOIDEO»" } },
  { id: "chaos_absurd_word", category: "chaos", points: 1, text: { es: "Gritar otra palabra absurda (ej: “HIPOPÓTAMO”)", it: "Gridare un'altra parola assurda (es: «IPPOPOTAMO»)" } },
  { id: "chaos_gestures_only", category: "chaos", points: 1, text: { es: "Comunicar algo sin palabras, solo con gestos", it: "Comunicare qualcosa senza parole, solo con gesti" } },
  { id: "chaos_drink_no_hands", category: "chaos", points: 1, text: { es: "Beber un vaso de agua sin usar las manos", it: "Bere un bicchiere d'acqua senza usare le mani" } },
  { id: "chaos_foreign_accent", category: "chaos", points: 1, text: { es: "Hablar con acento extranjero durante 5 minutos", it: "Parlare con accento straniero per 5 minuti" } },
  { id: "chaos_follow_someone", category: "chaos", points: 1, text: { es: "Seguir a alguien sin que se dé cuenta durante 2 minutos", it: "Seguire qualcuno senza farsi notare per 2 minuti" } },
  { id: "chaos_animal_imitation", category: "chaos", points: 1, text: { es: "Imitar a un animal", it: "Imitare un animale" } },
  { id: "chaos_fake_toast", category: "chaos", points: 1, text: { es: "Levantar la copa como si fueras a brindar… y no hacerlo", it: "Alzare il calice come per brindare... e non farlo" } },
  { id: "chaos_start_clapping_group", category: "chaos", points: 1, text: { es: "Empezar a aplaudir e intentar que alguien se una", it: "Iniziare ad applaudire e provare a far unire qualcuno" } },
  { id: "chaos_point_nothing", category: "chaos", points: 1, text: { es: "Señalar algo inexistente y actuar como si fuera importante", it: "Indicare qualcosa che non esiste e comportarti come se fosse importante" } },
  { id: "chaos_greet_old_friend", category: "chaos", points: 1, text: { es: "Saludar a alguien como si lo conocieras de toda la vida", it: "Salutare qualcuno come se lo conoscessi da sempre" } },
  { id: "chaos_move_without_words", category: "chaos", points: 1, text: { es: "Cambiar de sitio sin decir nada y actuar normal", it: "Cambiare posto senza dire nulla e comportarti normalmente" } },
  { id: "chaos_shhh", category: "chaos", points: 1, text: { es: "Decir “shhh” sin que esté pasando nada", it: "Dire «shhh» quando non sta succedendo nulla" } },
  { id: "chaos_stand_sit", category: "chaos", points: 1, text: { es: "Levantarte como si fueras a decir algo importante… y sentarte", it: "Alzarti come per dire qualcosa di importante... e sederti" } },
  { id: "chaos_overreact", category: "chaos", points: 1, text: { es: "Reaccionar exageradamente a algo normal", it: "Reagire in modo esagerato a qualcosa di normale" } },
  { id: "chaos_phone_surprised", category: "chaos", points: 1, text: { es: "Mirar el móvil, sorprenderte… y no explicar nada", it: "Guardare il telefono, stupirti... e non spiegare nulla" } },
  { id: "chaos_toast_two_people", category: "chaos", points: 1, text: { es: "Brindar solo con una persona sin motivo", it: "Brindare solo con una persona senza motivo" } },
  { id: "chaos_have_you_seen_it", category: "chaos", points: 1, text: { es: "Mirar alrededor y decir “¿lo habéis visto?” sin contexto", it: "Guardarti intorno e dire «l'avete visto?» senza contesto" } },
  { id: "ambience_clap_end_song", category: "ambience", points: 1, text: { es: "Aplaudir al final de una canción", it: "Applaudire alla fine di una canzone" } },
  { id: "ambience_stand_when_song_starts", category: "ambience", points: 1, text: { es: "Levantarte cuando empieza una canción", it: "Alzarti quando inizia una canzone" } },
  { id: "ambience_on_dancefloor_start", category: "ambience", points: 1, text: { es: "Estar en la pista cuando empieza una canción", it: "Essere in pista quando inizia una canzone" } },
  { id: "ambience_full_song_dancefloor", category: "ambience", points: 1, text: { es: "Permanecer en la pista durante una canción entera", it: "Restare in pista per una canzone intera" } },
  { id: "ambience_good_song_comment", category: "ambience", points: 1, text: { es: "Decir “esta canción es buenísima”", it: "Dire «questa canzone è bellissima»" } },
  { id: "ambience_go_when_people_dancing", category: "ambience", points: 1, text: { es: "Ir a la pista cuando ya hay gente bailando", it: "Andare in pista quando c'è già gente che balla" } },
  { id: "ambience_keep_beat_unknown_song", category: "ambience", points: 1, text: { es: "Seguir el ritmo aunque no conozcas la canción", it: "Seguire il ritmo anche se non conosci la canzone" } },
  { id: "ambience_collective_applause", category: "ambience", points: 1, text: { es: "Estar en un momento de aplauso colectivo", it: "Essere in un momento di applauso collettivo" } },
  { id: "ambience_leave_table_to_dance", category: "ambience", points: 1, text: { es: "Levantarte de la mesa para ir a bailar", it: "Alzarti dal tavolo per andare a ballare" } },
  { id: "ambience_return_dancefloor", category: "ambience", points: 1, text: { es: "Volver a la pista después de haber salido", it: "Tornare in pista dopo essere uscito" } }
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
    personalWithGuest: "Hola, {name}. Recomendación: completa un reto y sube una foto del momento.",
    personalAction: "Ver retos pendientes",
    activityLabel: "Últimas acciones del grupo",
    activityTemplates: {
      upload_photo: "{name} ha subido una foto",
      complete_challenge: "{name} ha cumplido un reto",
      react_photo: "{name} ha reaccionado a una foto"
    },
    activityEmpty: "Aún no hay actividad compartida.",
    activityEmptyElegant: "Sé el primero en subir una foto.",
    activityFallback: "Mostrando datos demo por falta de conexión a Firebase.",
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
    challengeSaved: "Guardado",
    challengeError: "No se pudo guardar el reto.",
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
    personalWithGuest: "Ciao, {name}. Consiglio: completa una sfida e carica una foto del momento.",
    personalAction: "Apri sfide",
    activityLabel: "Ultime azioni del gruppo",
    activityTemplates: {
      upload_photo: "{name} ha caricato una foto",
      complete_challenge: "{name} ha completato una sfida",
      react_photo: "{name} ha reagito a una foto"
    },
    activityEmpty: "Non ci sono ancora attività condivise.",
    activityEmptyElegant: "Sii il primo a caricare una foto.",
    activityFallback: "Mostro dati demo perché Firebase non è disponibile.",
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

const CHALLENGE_BY_ID = new Map(CHALLENGE_DATABASE.map((challenge) => [challenge.id, challenge]));

function getChallengeCategoryLabel(category) {
  const labels = {
    es: {
      social: "🧑‍🤝‍🧑 SOCIALES",
      culture_language: "🇪🇸🇮🇹 CULTURA / IDIOMA",
      photos: "📸 FOTOS",
      chaos: "🎭 MODO CAOS",
      ambience: "🎶 AMBIENTE"
    },
    it: {
      social: "🧑‍🤝‍🧑 SOCIALI",
      culture_language: "🇪🇸🇮🇹 CULTURA / LINGUA",
      photos: "📸 FOTO",
      chaos: "🎭 MODALITÀ CAOS",
      ambience: "🎶 ATMOSFERA"
    }
  };
  return labels[currentLanguage]?.[category] || category;
}

function getChallengeStateFromRealtime() {
  const defaultState = { activeIds: [], completedIds: [], seenIds: [] };
  if (!firebaseOnline || !currentGuestId) return defaultState;

  const legacyCompleted = Object.entries(realtimeChallenges?.completed || {})
    .filter(([, isDone]) => Boolean(isDone))
    .map(([id]) => id);

  const completedIds = Array.from(new Set([...(realtimeChallenges?.completedIds || []), ...legacyCompleted]));
  const seenIds = Array.from(new Set([...(realtimeChallenges?.seenIds || []), ...completedIds]));
  const validActive = (realtimeChallenges?.activeIds || []).filter((id) => CHALLENGE_BY_ID.has(id) && !completedIds.includes(id));
  return { activeIds: validActive, completedIds, seenIds };
}

function buildChallengeDeck(state) {
  const completedSet = new Set(state.completedIds);
  const seenSet = new Set(state.seenIds);
  const activeSet = new Set(state.activeIds.filter((id) => !completedSet.has(id)));

  const normalizedActiveIds = Array.from(activeSet).filter((id) => CHALLENGE_BY_ID.has(id));
  const usedCategories = new Set(
    normalizedActiveIds
      .map((id) => CHALLENGE_BY_ID.get(id)?.category)
      .filter(Boolean)
  );

  const slotsLeft = Math.max(0, MAX_ACTIVE_CHALLENGES - normalizedActiveIds.length);
  if (slotsLeft > 0) {
    for (const challenge of CHALLENGE_DATABASE) {
      if (normalizedActiveIds.length >= MAX_ACTIVE_CHALLENGES) break;
      if (completedSet.has(challenge.id) || activeSet.has(challenge.id) || seenSet.has(challenge.id)) continue;
      if (usedCategories.has(challenge.category)) continue;
      normalizedActiveIds.push(challenge.id);
      activeSet.add(challenge.id);
      seenSet.add(challenge.id);
      usedCategories.add(challenge.category);
    }
  }

  if (normalizedActiveIds.length < MAX_ACTIVE_CHALLENGES) {
    for (const challenge of CHALLENGE_DATABASE) {
      if (normalizedActiveIds.length >= MAX_ACTIVE_CHALLENGES) break;
      if (completedSet.has(challenge.id) || activeSet.has(challenge.id) || seenSet.has(challenge.id)) continue;
      normalizedActiveIds.push(challenge.id);
      activeSet.add(challenge.id);
      seenSet.add(challenge.id);
    }
  }

  return {
    activeIds: normalizedActiveIds.slice(0, MAX_ACTIVE_CHALLENGES),
    completedIds: Array.from(completedSet),
    seenIds: Array.from(seenSet)
  };
}

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

  const feedItems = firebaseOnline && realtimeActivity.length
    ? realtimeActivity
    : HOME_ACTIVITY_FEED.map((item) => ({ ...item, createdAt: new Date(Date.now() - item.minutesAgo * 60000) }));
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

  const phraseItems = (locale.usefulPhrases || []).map((entry) => {
    const phrase = currentLanguage === "es" ? entry.es : entry.it;
    const translation = currentLanguage === "es" ? entry.it : entry.es;
    return `<article class="dictionary-row"><h4 class="card-title">${phrase}</h4><p class="card-text">${translation}</p></article>`;
  }).join("");

  document.getElementById("false-friends-list").innerHTML = falseFriendItems;
  document.getElementById("useful-phrases-list").innerHTML = phraseItems;
}

function getLocalizedChallenge(challengeId) {
  const challenge = CHALLENGE_BY_ID.get(challengeId);
  if (!challenge) return null;
  return {
    ...challenge,
    label: challenge.text[currentLanguage] || challenge.text.es
  };
}

function renderChallengeItem(challenge, { completed = false } = {}) {
  if (!challenge) return "";
  const category = getChallengeCategoryLabel(challenge.category);
  const completeLabel = currentLanguage === "it" ? "Completa" : "Completar";
  const completedLabel = currentLanguage === "it" ? "Completata" : "Completado";
  return `
    <article class="challenge-item ${completed ? "challenge-item--completed" : ""}">
      <div class="challenge-item__content">
        <span class="challenge-item__category">${category}</span>
        <span class="challenge-item__text">${challenge.label}</span>
      </div>
      <label class="challenge-complete-btn">
        <input type="checkbox" data-challenge-id="${challenge.id}" ${completed ? "checked" : ""} ${currentGuestId ? "" : "disabled"} />
        <span class="challenge-complete-btn__chip">${completed ? "✓" : "○"}</span>
        <span class="challenge-complete-btn__label">${completed ? completedLabel : completeLabel}</span>
      </label>
    </article>
  `;
}

function getFallbackChallengeLists() {
  const locale = getLocale();
  const fallback = (locale.challenges || []).map((item, index) => {
    const databaseItem = CHALLENGE_DATABASE[index];
    if (!databaseItem) return null;
    return {
      ...databaseItem,
      done: Boolean(item.done),
      label: item.text || databaseItem.text[currentLanguage] || databaseItem.text.es
    };
  }).filter(Boolean);

  return {
    pending: fallback.filter((item) => !item.done).slice(0, MAX_ACTIVE_CHALLENGES),
    completed: fallback.filter((item) => item.done)
  };
}

function renderChallenges() {
  const pendingContainer = document.getElementById("challenge-list-pending");
  const completedContainer = document.getElementById("challenge-list-completed");
  const labels = getLocale().labels;

  if (!firebaseOnline || !currentGuestId) {
    const fallbackLists = getFallbackChallengeLists();
    pendingContainer.innerHTML = fallbackLists.pending.map((challenge) => renderChallengeItem(challenge)).join("");
    completedContainer.innerHTML = fallbackLists.completed.map((challenge) => renderChallengeItem(challenge, { completed: true })).join("");
  } else {
    const currentState = getChallengeStateFromRealtime();
    const deck = buildChallengeDeck(currentState);
    const pendingItems = deck.activeIds.map((id) => getLocalizedChallenge(id)).filter(Boolean);
    const completedItems = deck.completedIds.map((id) => getLocalizedChallenge(id)).filter(Boolean);
    pendingContainer.innerHTML = pendingItems.map((challenge) => renderChallengeItem(challenge)).join("");
    completedContainer.innerHTML = completedItems.length
      ? completedItems.map((challenge) => renderChallengeItem(challenge, { completed: true })).join("")
      : `<article class="challenge-item challenge-item--empty">${labels.noChallengesCompleted}</article>`;
  }

  if (!pendingContainer.innerHTML.trim()) {
    pendingContainer.innerHTML = `<article class="challenge-item challenge-item--empty">${labels.noChallengesPending}</article>`;
  }
  if (!completedContainer.innerHTML.trim()) {
    completedContainer.innerHTML = `<article class="challenge-item challenge-item--empty">${labels.noChallengesCompleted}</article>`;
  }

  const totalPoints = firebaseOnline && currentGuestId
    ? (realtimeRanking.find((entry) => (entry.guestId || entry.id) === currentGuestId)?.points || 0)
    : 0;
  document.getElementById("txt-progress-title").textContent = labels.progressTitleDynamic.replace("{points}", String(totalPoints));
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
  await withAppUpdate(async () => {
    updateWelcomeLabel();
    renderTimeline();
    showScreen(screenApp);
    renderHomeDashboard();
    renderGuestCards();
    updateCountdown();
  });

  if (isFirebaseConfigured()) {
    try {
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
  document.getElementById("txt-translator-text").textContent = labels.translatorText;
  document.getElementById("txt-false-friends-label").textContent = labels.falseFriendsLabel;
  document.getElementById("txt-useful-phrases-label").textContent = labels.usefulPhrasesLabel;
  document.getElementById("translator-input").placeholder = labels.translatorPlaceholder;
  document.getElementById("translator-btn").textContent = labels.translateBtn;
  document.getElementById("txt-game-title").textContent = labels.gameTitle;
  document.getElementById("txt-progress-label").textContent = labels.progressLabel;
  document.getElementById("txt-progress-title").textContent = labels.progressTitleDynamic.replace("{points}", "0");
  document.getElementById("txt-progress-text").textContent = labels.progressText;
  document.getElementById("txt-challenges-pending-label").textContent = labels.pendingChallengesLabel;
  document.getElementById("txt-challenges-completed-label").textContent = labels.completedChallengesLabel;
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

  ["false-friends", "useful-phrases"].forEach((id) => {
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

  const handleChallengeToggle = async (event) => {
    const check = event.target;
    if (!check.matches("input[data-challenge-id]") || !currentGuestId || !firebaseOnline) return;
    const challengeId = check.dataset.challengeId;
    const state = getChallengeStateFromRealtime();
    const nextCompletedIds = check.checked
      ? Array.from(new Set([...state.completedIds, challengeId]))
      : state.completedIds.filter((id) => id !== challengeId);
    const nextActiveIds = check.checked
      ? state.activeIds.filter((id) => id !== challengeId)
      : [challengeId, ...state.activeIds.filter((id) => id !== challengeId)].slice(0, MAX_ACTIVE_CHALLENGES);
    const projectedState = {
      activeIds: nextActiveIds,
      completedIds: nextCompletedIds,
      seenIds: Array.from(new Set([...state.seenIds, challengeId]))
    };
    const nextDeck = buildChallengeDeck(projectedState);
    const challenge = CHALLENGE_BY_ID.get(check.dataset.challengeId);
    try {
      await setChallengeDone({
        guestId: currentGuestId,
        challengeId,
        done: check.checked,
        points: challenge?.points || 1,
        activeIds: nextDeck.activeIds,
        completedIds: nextDeck.completedIds,
        seenIds: nextDeck.seenIds,
        maxActiveChallenges: MAX_ACTIVE_CHALLENGES
      });
    } catch {
      check.checked = !check.checked;
      alert(getHomeCopy().challengeError);
    }
  };

  document.getElementById("challenge-list-pending").addEventListener("change", handleChallengeToggle);
  document.getElementById("challenge-list-completed").addEventListener("change", handleChallengeToggle);

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
    renderTimeline();
    renderHomeDashboard();
    showScreen(screenApp);
    return;
  }
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
  unsubscribeRanking();
  unsubscribeGuestChallenges();
  unsubscribeGuestPresence();
  unsubscribeActivity = () => {};
  unsubscribePhotos = () => {};
  unsubscribeRanking = () => {};
  unsubscribeGuestChallenges = () => {};
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

    unsubscribeRanking = subscribeRanking((data) => {
      realtimeRanking = data;
      renderRanking();
      renderChallenges();
    }, () => {
      firebaseOnline = false;
      renderRanking();
      renderChallenges();
    });

    if (currentGuestId) {
      try {
        await lockGuestProfile(currentGuestId);
        hasActiveGuestLock = true;
        subscribeGuestStreams();
      } catch {
        hasActiveGuestLock = false;
        localStorage.removeItem("wedding_guest");
        currentGuestId = null;
        updateWelcomeLabel();
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
