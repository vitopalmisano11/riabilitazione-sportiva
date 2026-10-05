# Riabilitazione Sportiva

App desktop (Windows, locale, mono-utente) per costruire, gestire ed esportare programmi di
riabilitazione sportiva. Sostituisce la gestione via file Word. Specifica completa in
[`prompt-app-riabilitazione.md`](./prompt-app-riabilitazione.md).

## Stack

- **Electron + TypeScript + React** (bundling con electron-vite)
- **SQLite** via `better-sqlite3-multiple-ciphers` con cifratura SQLCipher (vedi «Dove stanno i dati e come sono protetti»)
- **electron-builder** per l'installer Windows

## Comandi

```bash
npm install        # prima installazione
npm run dev        # avvia l'app in sviluppo (hot reload)
npm run typecheck  # controllo tipi
npm test           # prove automatiche (cartella test/, vedi CLAUDE.md)
npm run build:win  # produce l'installer Windows in dist/
```

## Distribuzione

L'installer Windows si costruisce automaticamente con GitHub Actions: pubblicando un tag
(`git tag v0.x.y && git push --tags`) l'installer compare nei **Releases** del repo, pronto da
scaricare. L'eseguibile non è firmato: al primo avvio Windows SmartScreen mostra un avviso, si
supera con *Ulteriori informazioni → Esegui comunque*.

## Primo giro di feedback (prima della 0.5)

- Struttura della seduta per fase: sezioni ordinate (es. Riscaldamento, Rinforzo) con
  categorie associate e ordinabili; usata come template alla creazione della seduta e
  modificabile nella singola seduta (aggiungi/rinomina/riordina/rimuovi sezioni)
- Obiettivi con stato persistente "raggiunto" sul paziente (barrati ma visibili),
  non più selezionati a ogni seduta
- Checklist "Test di avanzamento" per fase (informativa, non blocca il cambio fase),
  con valore registrato per paziente
- Campo "recupero" per esercizio (default in libreria + per seduta, tra carico e note)
- Cartella di destinazione export configurabile e memorizzata (ultima usata)
- Menu: "Diario pazienti" in alto; "Configurazione" in fondo, pannello unico a tab
- Fix layout: campi che uscivano dal riquadro dello schema seduta, testo spezzato male

## Secondo giro di feedback (prima della 0.5)

- Link video opzionale per esercizio: icona ▶ accanto al nome (libreria e builder),
  apre il browser predefinito; nessun testo sottolineato
- Configurazione ridisegnata a flusso progressivo: scegli patologia (con ricerca) →
  fasi come riquadri affiancati → editor della fase a schede (struttura/obiettivi/test),
  con breadcrumb per tornare indietro
- Fix: nomi delle sezioni non si spezzano più a metà parola (colonne con larghezza minima)

## Terzo giro di feedback — rifiniture (prima della 0.5)

- Libreria esercizi: colonna nome senza a capo, numero serie centrato,
  serie/ripetizioni/carico/recupero sulla stessa riga nel form
- Categorie esercizi riordinabili con frecce (nuovo campo ordine, migrazione 4);
  rimosse le frecce non necessarie in "categorie della sezione" e spaziatura compattata
- Diario: "Apri" rinominato in "Modifica"; PDF/Word sostituiti da un'icona di
  download con menu a tendina

## Novità per versione

Le versioni vere dell'app sono quelle di `package.json` e dei tag `vX.Y.Z`: le sezioni «giro di
feedback» qui sopra sono precedenti e usavano una numerazione propria.

### v0.5.7

**Prima di tutto:** al primo accesso dopo l'aggiornamento il programma applica due modifiche al
formato dell'archivio (migrazioni 56 e 57). Non si possono annullare, quindi prima fa da solo una
copia dell'archivio, e poi lo compatta: il primo accesso può durare qualche secondo in più, una
volta sola. Dai Releases di GitHub si installa da solo, come la 0.5.6.

- Cerca (Ctrl+K, o «Cerca» nel menu): un campo solo per trovare un paziente, una frase del diario
  delle sedute o dell'anamnesi, in tutto l'archivio. Maiuscole e accenti non contano; si apre
  direttamente il paziente o la seduta
- Elimina per sempre (scheda del paziente): toglie un paziente dall'archivio e dal cestino senza
  possibilità di recupero, e sovrascrive le righe. La conferma dice cosa resta nelle copie di
  sicurezza già fatte, che il programma non può modificare
- Cestino: rimettendo a posto una voce tornano anche i collegamenti che l'eliminazione aveva
  azzerato, dove sono ancora vuoti
- Referti: salvati come file e non più come testo, quindi l'archivio e ogni copia pesano circa un
  quarto in meno per ogni referto. Quelli che hai si convertono da soli; aprendoli escono identici
- Questionari: ogni punteggio ha il suo modo di calcolo, scelto nell'editor alla voce «Come si
  calcola». Somma (come prima), percentuale del massimo, percentuale inversa (100 = nessun
  problema) e media. Percentuali e media contano solo le domande a cui si è risposto: è come si
  calcolano l'ODI, l'IKDC soggettivo e le sottoscale del KOOS. I punteggi già configurati restano
  somme e nessuna compilazione cambia. I questionari validati non sono inclusi: testi e regole
  vanno inseriti e controllati da chi li usa
- Seduta: riprendendo una bozza torna anche la sua fase (con nome, obiettivi e struttura), che
  prima si perdeva; scrivere in una riga non rallenta più le sedute lunghe
- Protezioni: la finestra principale gira isolata dal sistema (sandbox) e non può caricare nulla da
  internet né eseguire script inseriti nella pagina. Ogni comando interno rifiuta numeri non validi
- Impostazioni: lette dal disco solo se il file è cambiato

**Dietro le quinte:** 126 prove automatiche e 12 prove dell'interfaccia che guidano il programma
costruito come una persona (primo avvio, pazienti, sedute, referti, questionari, impostazioni,
anamnesi, valutazione, bozza dopo uno spegnimento di colpo); girano anche nella CI su Windows. I
file più grandi sono divisi per argomento, e l'elenco dei comandi interni sta in un posto solo
(`src/shared/canali.ts`).

### v0.5.6

**Prima di tutto:** questa versione si installa a mano, una volta (scaricare l'installer da
GitHub e installarci sopra: i dati restano). Dalla prossima, il programma controlla da solo se
c'è una versione nuova, la scarica in sottofondo e la installa quando lo chiudi. In fondo al menu
compare «Aggiorna alla…» per farlo subito. All'aggiornamento il programma fa da solo una copia
dell'archivio prima di cambiarlo.

- Aggiornamenti automatici dai Releases di GitHub. Per controllare se c'è una versione nuova il
  programma contatta GitHub: non invia nessun dato dei pazienti (l'aggiornamento non ha accesso
  all'archivio)
- Salvataggio: una regola sola in tutte le schede. Quello che scrivi si salva da solo quando esci
  o chiudi il programma, e «Salva» (o Ctrl+S) lo fa subito. Accanto al pulsante si legge sempre
  «Modifiche non salvate», «Salvato» oppure «Non salvato» col motivo, che resta scritto finché un
  salvataggio non riesce. Indicazioni per casa, peso e altezza e profilo prima perdevano le
  modifiche se uscivi senza premere Salva
- Copie di sicurezza: la copia dell'accesso, «Fai una copia» e la copia su chiavetta non bloccano
  più il programma. La copia su chiavetta si confronta con l'archivio prima di prendere il nome.
  Chiudere il programma o ripristinare una copia aspetta che le copie in corso finiscano
- Copie di sicurezza: un promemoria quando l'ultima copia fuori dal computer è vecchia di oltre
  30 giorni; il ripristino spiega che serve la password in uso alla data della copia
- Password: una password nuova deve avere almeno 10 caratteri, non solo numeri e non essere tra le
  più comuni; sotto il campo si legge cosa non va. Indovinarla da una copia rubata costa circa
  quattro volte di più. Quella che usi già continua a funzionare. Prima di mettere le copie in
  OneDrive il programma spiega il rischio e, se la password è debole, suggerisce di cambiarla
- Questionari: punteggi e fascia restano quelli del giorno della compilazione. Se cambi le regole
  di un questionario, le compilazioni vecchie mostrano «Calcolata con regole diverse» e un
  pulsante «Ricalcola» (anche per tutte insieme, dopo conferma). Rinominare un punteggio non fa più
  perdere il confronto con la prima compilazione
- Soglie e fasce: la configurazione dice subito se una fascia lascia buchi o una soglia non si
  può mai raggiungere
- Seduta: un valore del segno non numerico lo dice invece di sparire, e la bozza di una seduta
  appena salvata non ricompare più
- Cestino: un paziente torna a posto anche se nel frattempo è stato tolto un punteggio del
  questionario che aveva compilato, e l'elenco è più veloce con i pazienti più ricchi

**Dietro le quinte:** il codice dei pazienti, delle sedute, dell'anamnesi e degli altri archivi
principali è separato dai canali dell'interfaccia e provato con 98 prove automatiche (prima erano
uno script solo); la CI prova anche su Windows. Nessuna modifica al formato dei dati oltre alle
migrazioni 54 e 55 (una colonna nel cestino e il collegamento dei punteggi dei questionari al loro
punteggio), che si applicano da sole all'apertura.

### v0.5.5

- Cestino: un paziente con le misure dei segni (le due o tre cose che si ricontrollano) ora si
  rimette a posto; prima il ripristino falliva sempre
- Copie di sicurezza: la copia di chiusura non cancella più quella buona del giorno se la nuova
  non riesce. Ogni copia si completa prima di prendere il suo nome; se una copia automatica non
  riesce lo dice all'accesso e in Impostazioni › Dati e backup
- Screening: nei test a tempo (dove meno è meglio) la prova migliore è quella più bassa e l'LSI si
  calcola sano ÷ operato. **Da fare una volta:** in Configurazione › Test di valutazione, sulle
  misure a tempo scegliere «è meglio se è più basso»
- Screening: le soglie si giudicano sul numero come si vede (niente più «LSI 90,0% — sotto la
  soglia di 90%»); nel riassunto l'LSI ha un decimale, come nella tabella
- Punteggio del cluster: un valore che non rientra in nessuna soglia non vale più zero punti in
  silenzio; compare «fuori dalle soglie» e il totale resta parziale
- Accesso: se l'archivio non si trova (disco staccato, OneDrive non sincronizzato, impostazioni
  rovinate, file auth.json mancante) il programma lo dice e fa scegliere cosa fare, invece di
  proporre un archivio nuovo

### v0.5.4

- Fix: premendo due volte "Salva seduta" (o Ctrl+S) la seduta finiva due volte nel diario

### v0.5.3

- Fix: la X in alto a destra non chiudeva la finestra se si premeva spingendo il mouse
  nell'angolo dello schermo (il pulsante si abbassava di un pixel e il clic andava perso)

### v0.5.2

- Il logo dell'app dentro al programma (barra laterale e schermata di accesso) prende il
  colore del tema; il riquadro bianco resta com'è
- Una sola copia del programma alla volta: riaprirlo porta in primo piano la finestra già
  aperta, invece di aprirne una seconda con l'accesso sotto

### v0.5.1

- L'app si chiama Gestionale Fisioterapia e mostra la sua icona nella barra laterale e
  all'accesso

### v0.5.0

- Body chart e valutazione: salvando, non si salvano una seconda volta chiudendosi

## Sviluppare (anche su Windows)

Prerequisiti: [Git](https://git-scm.com/download/win) e [Node.js 22 LTS](https://nodejs.org)
(installazione standard, non servono compilatori: il modulo SQLite arriva precompilato).
Editor consigliato: VS Code. Per contribuire con push diretto serve essere collaboratori del repo
(Settings → Collaborators su GitHub); in alternativa fork + pull request.

```bash
git clone https://github.com/vitopalmisano11/riabilitazione-sportiva.git
cd riabilitazione-sportiva
npm install       # scarica Electron e prepara il modulo nativo (qualche minuto la prima volta)
npm run dev       # avvia l'app con ricarica automatica
```

Prima di ogni sessione `git pull`; prima di ogni commit `npm run typecheck`. I dati di prova
finiscono in `Documenti\Riabilitazione` del proprio PC (password propria), separati da quelli
degli utenti. Le convenzioni di progetto, la trappola del modulo nativo e la procedura di
release sono in [`CLAUDE.md`](./CLAUDE.md), letto automaticamente anche da Claude Code.

## Stato di avanzamento (piano a step)

- [x] 1. Fondamenta: progetto, database, migrazioni
- [x] 2. Area configurazione: patologie / fasi / obiettivi / categorie / esercizi
- [x] 3. Pazienti: anagrafica + fase corrente persistente
- [x] 4. Builder seduta (obiettivi → categorie → esercizi → parametri)
- [x] 5. Diario + duplica seduta
- [x] 6. Export PDF e Word (singola seduta e intervallo)
- [x] 7. Login + cifratura SQLCipher (chiave derivata dalla password + recovery key)
- [x] 8. Packaging: scelta cartella dati, installer

## Dove stanno i dati e come sono protetti

I dati vivono nella **cartella dati**, di default `Documenti\Riabilitazione`, cambiabile
dall'app ("Dati e backup" nella sidebar): `riabilitazione.db` (database cifrato) e
`auth.json` (chiavi avvolte). Backup manuale = copia dell'intera cartella — servono
**entrambi** i file. Il percorso scelto è salvato in `%APPDATA%/riabilitazione-sportiva/impostazioni.json`;
i dati delle versioni precedenti (in `%APPDATA%`) vengono spostati automaticamente al primo avvio.

Cifratura: il database è cifrato con SQLCipher usando una chiave casuale (DEK). La DEK è
salvata in `auth.json` avvolta con AES-256-GCM due volte: con una chiave derivata dalla
password di login (scrypt N=32768) e con una derivata dalla **recovery key** mostrata alla
prima configurazione. Password dimenticata → si rientra con la recovery key. Perse entrambe →
i dati sono irrecuperabili, per design. Il cambio password ri-avvolge solo la DEK (non ricifra
il database) e non invalida la recovery key. Un database in chiaro preesistente viene cifrato
in place al primo setup.
