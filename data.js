window.WEDDING_APP_DATA = {
  ceremonyDate: "2026-09-12T19:00:00",
  guests: [
    { id: "lucia", name: "Lucía", avatar: "L", roleKey: "friend_f" },
    { id: "marco", name: "Marco", avatar: "M", roleKey: "family" },
    { id: "elena", name: "Elena", avatar: "E", roleKey: "guest_f" },
    { id: "paolo", name: "Paolo", avatar: "P", roleKey: "friend_m" }
  ],
  ranking: [
    { guestId: "lucia", points: 5 },
    { guestId: "marco", points: 4 },
    { guestId: "elena", points: 3 },
    { guestId: "paolo", points: 2 }
  ],
  translations: {
    es: {
      labels: {
        weekend: "Fin de semana de boda",
        heroTitle: "Andrea & Sandra",
        heroSubtitle: "12–14 septiembre · Vera",
        chooseLanguageTitle: "Elige idioma",
        chooseLanguageText: "Selecciona idioma para acceder a tu versión de la app.",
        languageEs: "Español",
        languageIt: "Italiano",
        access: "Acceso",
        back: "← Volver",
        whoAreYouTitle: "¿Quién eres?",
        whoAreYouText: "Selecciona tu tarjeta para entrar.",
        welcome: "Bienvenido",
        hello: "Hola",
        changeProfile: "Cambiar perfil",
        countdownLabel: "Cuenta atrás para la ceremonia",
        countdownHint: "Sábado · 19:00 · Ya a esa hora no vale desaparecer.",
        nowLabel: "Ahora mismo",
        nextLabel: "Próximo momento importante",
        mealsLabel: "Comidas del finde",
        guideTitle: "Guía del finde",
        dictionaryTitle: "Diccionario exprés",
        translatorLabel: "Traductor de emergencia",
        translatorTitle: "Próximamente",
        translatorText: "Aquí iría el campo para escribir, traducir y escuchar la frase.",
        translatorPlaceholder: "Escribe una frase...",
        translateBtn: "Traducir",
        gameTitle: "Retos del finde",
        progressLabel: "Tu progreso",
        progressTitle: "3 puntos",
        progressText: "Idea demo: cada vez que cumplas un reto, sumas puntos y subes en el ranking.",
        rankingLabel: "Clasificación",
        photosTitle: "Fotos del finde",
        uploadPhoto: "Subir foto",
        navHome: "Inicio",
        navGuide: "Guía",
        navDictionary: "Diccionario",
        navGame: "Retos",
        navPhotos: "Fotos",
        photoLabel: "Foto",
        countdownStarted: "Ya ha empezado"
      },
      roles: {
        friend_f: "Amiga",
        friend_m: "Amigo",
        family: "Familia",
        guest_f: "Invitada"
      },
      homeCards: [
        {
          label: "Ahora mismo",
          title: "Tiempo de relax",
          text: "Piscina, charla, bebida fría y tranquilidad relativa."
        },
        {
          label: "Próximo momento importante",
          title: "Preparación de la boda",
          text: "Cuando llegue la hora, hará falta estar localizable y ayudar con lo que toque."
        },
        {
          label: "Comidas del finde",
          title: "Todo bajo control",
          text: "Habrá momentos para comer bien, repetir sin vergüenza y sobrevivir dignamente al domingo."
        }
      ],
      timeline: [
        {
          day: "Viernes",
          title: "Llegada + piscina + aterrizaje",
          text: "Momento de instalarse, hablar, reírse un rato y empezar a entrar en ambiente.",
          status: "Se puede relajar",
          tone: "soft"
        },
        {
          day: "Sábado mañana",
          title: "Preparación y ayuda",
          text: "Aquí ya conviene estar disponible. Puede tocar ayudar, preparar cosas o simplemente no desaparecer.",
          status: "Conviene ayudar",
          tone: "warn"
        },
        {
          day: "Sábado tarde",
          title: "Ceremonia",
          text: "Ya empieza lo importante. Aquí se llega a tiempo, vestido y sin caos innecesario.",
          status: "Momento importante",
          tone: "strong"
        },
        {
          day: "Domingo",
          title: "Despedida y supervivencia",
          text: "Café, comentarios sobre el día anterior y recuperación progresiva.",
          status: "Modo tranquilo",
          tone: "soft"
        }
      ],
      dictionary: [
        {
          label: "Falso amigo",
          title: "Vaso ≠ vaso",
          text: "En italiano, para beber normalmente dirías bicchiere."
        },
        {
          label: "Falso amigo",
          title: "Embarazada ≠ imbarazzata",
          text: "Una significa una cosa importante. La otra, simplemente vergüenza."
        },
        {
          label: "Emergencia útil",
          title: "Frase rápida",
          text: "¿Dónde está todo el mundo? / Dov'è andato tutto il mondo?"
        }
      ],
      challenges: [
        { text: "Hablar 5 minutos en el otro idioma", done: true },
        { text: "Ayudar en un momento de preparación", done: true },
        { text: "Hacerse una foto con alguien nuevo", done: true },
        { text: "Bailar una canción entera", done: false },
        { text: "Usar correctamente un falso amigo", done: false }
      ],
      photos: [
        { caption: "Viernes · piscina", likes: 4 },
        { caption: "Sábado · previa", likes: 7 },
        { caption: "Boda · momento top", likes: 12 }
      ]
    },
    it: {
      labels: {
        weekend: "Weekend di matrimonio",
        heroTitle: "Andrea & Sandra",
        heroSubtitle: "12–14 settembre · Vera",
        chooseLanguageTitle: "Scegli la lingua",
        chooseLanguageText: "Seleziona la lingua per accedere alla tua versione dell'app.",
        languageEs: "Spagnolo",
        languageIt: "Italiano",
        access: "Accesso",
        back: "← Indietro",
        whoAreYouTitle: "Chi sei?",
        whoAreYouText: "Seleziona la tua card per entrare.",
        welcome: "Benvenuto",
        hello: "Ciao",
        changeProfile: "Cambia profilo",
        countdownLabel: "Conto alla rovescia per la cerimonia",
        countdownHint: "Sabato · 19:00 · A quell'ora meglio non sparire.",
        guideTitle: "Guida del weekend",
        dictionaryTitle: "Dizionario espresso",
        translatorLabel: "Traduttore di emergenza",
        translatorTitle: "Prossimamente",
        translatorText: "Qui andrebbero campo testo, traduzione e audio.",
        translatorPlaceholder: "Scrivi una frase...",
        translateBtn: "Traduci",
        gameTitle: "Sfide del weekend",
        progressLabel: "Il tuo progresso",
        progressTitle: "3 punti",
        progressText: "Idea demo: ogni sfida completata aggiunge punti e posizione in classifica.",
        rankingLabel: "Classifica",
        photosTitle: "Foto del weekend",
        uploadPhoto: "Carica foto",
        navHome: "Home",
        navGuide: "Guida",
        navDictionary: "Dizionario",
        navGame: "Sfide",
        navPhotos: "Foto",
        photoLabel: "Foto",
        countdownStarted: "È già iniziato"
      },
      roles: {
        friend_f: "Amica",
        friend_m: "Amico",
        family: "Famiglia",
        guest_f: "Invitata"
      },
      homeCards: [
        {
          label: "Adesso",
          title: "Momento relax",
          text: "Piscina, chiacchiere, bevanda fresca e tranquillità relativa."
        },
        {
          label: "Prossimo momento importante",
          title: "Preparazione matrimonio",
          text: "Quando arriva l'ora, bisogna essere reperibili e dare una mano."
        },
        {
          label: "Pasti del weekend",
          title: "Tutto sotto controllo",
          text: "Ci saranno momenti per mangiare bene, fare bis e sopravvivere alla domenica."
        }
      ],
      timeline: [
        {
          day: "Venerdì",
          title: "Arrivo + piscina + atterraggio",
          text: "Momento per sistemarsi, chiacchierare, ridere e entrare nel clima.",
          status: "Ci si può rilassare",
          tone: "soft"
        },
        {
          day: "Sabato mattina",
          title: "Preparazione e aiuto",
          text: "Qui conviene essere disponibili: può servire aiuto o organizzazione.",
          status: "Meglio aiutare",
          tone: "warn"
        },
        {
          day: "Sabato pomeriggio",
          title: "Cerimonia",
          text: "Inizia la parte importante: puntuali, pronti e senza caos.",
          status: "Momento importante",
          tone: "strong"
        },
        {
          day: "Domenica",
          title: "Saluti e sopravvivenza",
          text: "Caffè, commenti sul giorno prima e recupero graduale.",
          status: "Modalità tranquilla",
          tone: "soft"
        }
      ],
      dictionary: [
        {
          label: "Falso amico",
          title: "Vaso ≠ vaso",
          text: "In italiano, per bere normalmente diresti bicchiere."
        },
        {
          label: "Falso amico",
          title: "Embarazada ≠ imbarazzata",
          text: "Una parola parla di gravidanza. L'altra solo di imbarazzo."
        },
        {
          label: "Emergenza utile",
          title: "Frase rapida",
          text: "¿Dónde está todo el mundo? / Dov'è andato tutto il mondo?"
        }
      ],
      challenges: [
        { text: "Parlare 5 minuti nell'altra lingua", done: true },
        { text: "Aiutare in un momento di preparazione", done: true },
        { text: "Fare una foto con qualcuno di nuovo", done: true },
        { text: "Ballare una canzone intera", done: false },
        { text: "Usare bene un falso amico", done: false }
      ],
      photos: [
        { caption: "Venerdì · piscina", likes: 4 },
        { caption: "Sabato · pre-cerimonia", likes: 7 },
        { caption: "Matrimonio · momento top", likes: 12 }
      ]
    }
  }
};
