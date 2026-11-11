# J.A.R.V.I.S. — il tuo assistente sul tablet

Jarvis è una web app che gira nel browser Chrome del tablet Android. Non ha server e non ha costi:
- **Cervello:** Google Gemini, con il piano gratuito.
- **Voce e udito:** quelli integrati nel tablet.
- **Meteo:** Open-Meteo, gratuito.
- **Memoria, promemoria e liste:** salvati sul tablet.

## Cosa sa fare

### Una mente, non un altoparlante
- **Ragiona prima di rispondere.** Usa la modalità di ragionamento di Gemini. Mentre pensa, i suoi pensieri compaiono in oro vicino ai neuroni, che si accendono.
- **Ha un carattere.** Ti chiama Signore ma ti tratta da amico. Ha opinioni sue, fa domande e non ti dà ragione per forza: se dici una sciocchezza, te lo dice e ti spiega perché.
- **Si ricorda di te.**
  - La conversazione resta salvata anche se chiudi l'app.
  - Le parti vecchie vengono riassunte invece di essere dimenticate.
  - Quando lo saluti scrive un **diario** della chiacchierata e annota cosa ha imparato su di te, così la volta dopo può dirti «l'altra volta mi dicevi che…».
- **Ti lascia finire.** Aspetta una vera pausa prima di rispondere, quindi puoi ragionare ad alta voce.

### Brainstorming
Di' ad esempio «Jarvis, facciamo brainstorming su un regalo per mia madre».
- Passa al modello più potente (Gemini Pro). Se la quota gratuita finisce, torna da solo a Flash senza interrompersi.
- Fa da sparring partner: costruisce sulle tue idee, smonta quelle deboli e propone alternative strane.
- Ti concede pause più lunghe prima di rispondere.
- Le idee migliori finiscono su una **lavagna** a lato dello schermo e restano salvate: se riprendi lo stesso tema giorni dopo, le ritrova.

### Il resto
- **Si sveglia quando dici «Jarvis»** e resta in conversazione finché non lo saluti («ok ciao Jarvis», «grazie, è tutto»).
- **Strumenti:**
  - meteo
  - notizie e ricerche sul web
  - promemoria, timer e sveglie
  - liste
  - memoria
  - Spotify completo
- **Briefing del mattino:** di' «Jarvis, buongiorno».
- **Storie** su richiesta.
- **Tocchi sullo schermo:**
  - tocca il nucleo mentre parla per interromperlo;
  - tocca il nucleo quando è in attesa per svegliarlo senza parlare;
  - ⌨ per scrivergli;
  - ⚙ per le impostazioni (anche per vedere e cancellare cosa ricorda di te).

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
