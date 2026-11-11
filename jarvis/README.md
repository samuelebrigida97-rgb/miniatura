# J.A.R.V.I.S. — il tuo assistente sul tablet

Jarvis è una web app che gira nel browser Chrome del tablet Android. Non ha server e non ha costi:
- **Cervello:** Google Gemini, con il piano gratuito.
- **Voce e udito:** quelli integrati nel tablet.
- **Meteo:** Open-Meteo, gratuito.
- **Memoria, promemoria e liste:** salvati sul tablet.

## Cosa sa fare

- **Si sveglia quando dici «Jarvis».** Da quel momento resta in conversazione e ti ascolta dopo ogni risposta, finché non lo saluti («ok ciao Jarvis», «a dopo Jarvis», «grazie, è tutto»).
- **Ti chiama Signore,** ma con il tono di un amico. Non ti dà ragione per forza: se dici una sciocchezza, te lo fa notare.
- **Usa gli strumenti:**
  - meteo
  - notizie e ricerche sul web
  - promemoria, timer e sveglie
  - liste (la spesa, cose da fare)
  - memoria a lungo termine («ricordati che…»)
  - Spotify completo
- **Briefing del mattino:** di' «Jarvis, buongiorno».
- **Racconta storie** su richiesta.
- **Tocchi sullo schermo:**
  - tocca il nucleo mentre parla per interromperlo;
  - tocca il nucleo quando è in attesa per svegliarlo senza parlare;
  - ⌨ apre la tastiera per scrivergli;
  - ⚙ apre le impostazioni.

---

## Installazione (una volta sola)

### 1. Metti Jarvis online (GitHub Pages)
1. Unisci questo branch nel branch principale (`main`) del repository.
2. Su GitHub apri il repository → **Settings → Pages**. In *Source* scegli **Deploy from a branch**, poi `main` e `/ (root)`. Salva.
3. Dopo un minuto Jarvis è raggiungibile a:
   **https://samuelebrigida97-rgb.github.io/miniatura/jarvis/**

### 2. Aprilo sul tablet
1. Apri quell'indirizzo con **Google Chrome**.
2. Menu ⋮ → **Aggiungi a schermata Home** (o **Installa app**). Ora Jarvis si apre a schermo intero come un'app.
3. Tocca **ATTIVA** e consenti l'uso del **microfono**. Se te lo chiede, consenti anche la **posizione** (serve per il meteo) e le **notifiche**.

### 3. Dagli un cervello (gratis)
1. Vai su **https://aistudio.google.com/apikey** con il tuo account Google.
2. Premi **Create API key** e copia la chiave (inizia con `AIza…`).
3. In Jarvis apri ⚙ → *Chiave API Gemini*, incollala e premi **Salva**.

> Il piano gratuito ha un limite di richieste al minuto e al giorno, più che sufficiente per uso personale. Google può usare le conversazioni del piano gratuito per migliorare i suoi modelli: evita di dire a Jarvis dati sensibili (password, numeri di carta).

### 4. Collega Spotify (serve Premium)
1. Vai su **https://developer.spotify.com/dashboard**, accedi e premi **Create app**.
2. Compila così:
   - Nome e descrizione: quello che vuoi, ad esempio "Jarvis".
   - **Redirect URI:** copia quello mostrato in Jarvis, ⚙ → Spotify. Sarà `https://samuelebrigida97-rgb.github.io/miniatura/jarvis/`.
   - API: spunta **Web API**.
3. Salva, apri l'app che hai creato e copia il **Client ID**.
4. In Jarvis apri ⚙ → *Client ID* di Spotify, incollalo e premi **Collega Spotify**. Accetta i permessi.
5. Apri l'app Spotify sul tablet e fai partire un brano almeno una volta, così il tablet risulta come "dispositivo attivo". Da lì in poi: «Jarvis, metti qualcosa dei Queen», «abbassa il volume», «salta», «cosa sta suonando?».

Mentre parli con Jarvis la musica si abbassa da sola, e torna al volume di prima quando lo saluti.

### 5. Alexa come cassa
Il modo più semplice è usare l'Echo come **cassa Bluetooth** del tablet:
1. Di' ad Alexa: **«Alexa, associa Bluetooth»** (oppure dall'app Alexa: Dispositivi → Echo → Dispositivi Bluetooth → Associa).
2. Sul tablet: Impostazioni → Bluetooth → scegli il tuo Echo.
3. Fatto: la voce di Jarvis e la musica di Spotify escono dall'Alexa. Il microfono resta quello del tablet. Jarvis smette di ascoltare mentre parla, così non sente se stesso.

> In alternativa, Spotify può suonare direttamente sull'Echo (Spotify Connect). Jarvis userà il dispositivo attivo.

---

## Consigli per il "corpo"
- **Tienilo in carica.** Lo schermo resta acceso finché Jarvis è aperto.
- **Restare in ascolto:** Android ascolta solo mentre Chrome (o l'app Jarvis) è in primo piano. Se cambi app, Jarvis "dorme" e riprende quando torni.
- **Bip a ogni riavvio dell'ascolto:** su alcuni tablet Android si sente un piccolo bip ogni volta che l'ascolto riparte. Si toglie abbassando il volume di "Notifiche/Sistema" (non quello multimediale).
- **Voce:** in ⚙ scegli tra le voci italiane disponibili e regola velocità e tono. Più voci si scaricano da Impostazioni Android → Sintesi vocale → Motore Google → Installa dati vocali → Italiano.

## Prossimi passi
- **Domotica:** luci, prese, termostato tramite Home Assistant, SmartThings o Alexa.
- **Voce più realistica:** ElevenLabs o altre voci neurali.
- **Altro:** collegare calendario ed email.

## Struttura del codice
| File | Cosa fa |
|---|---|
| `index.html`, `css/style.css` | L'interfaccia HUD |
| `js/neural.js` | La rete di neuroni animata |
| `js/voice.js` | Riconoscimento vocale e sintesi vocale |
| `js/brain.js` | Collegamento a Gemini e personalità di Jarvis |
| `js/tools.js` | Meteo, ricerca, promemoria, liste, memoria |
| `js/spotify.js` | Controllo di Spotify |
| `js/main.js` | Collega tutto: parola di attivazione, conversazione, stati |
