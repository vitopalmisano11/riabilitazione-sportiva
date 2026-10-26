# Riabilitazione Sportiva — guida per chi sviluppa (umani e Claude Code)

App desktop Windows per un fisioterapista sportivo: costruisce, salva ed esporta le sedute
di riabilitazione dei pazienti. Uso personale, mono-utente, dati solo locali e cifrati.
Specifica originale e feedback dell'utente sono nei file `prompt-*.md` alla radice.

## Stack e struttura
- Electron + TypeScript + React, bundling con **electron-vite**; SQLite via
  `better-sqlite3-multiple-ciphers` (SQLCipher); Word con `docx`; PDF con `printToPDF`.
- `src/main/` processo principale: `ipc.ts` (tutti i canali, uno per `entita:azione`),
  `db.ts` (apertura db cifrato, migrazioni), `migrations.ts` (array di SQL versionate),
  `auth.ts` (password, recovery key, DEK avvolta), `export*.ts` (PDF/Word),
  `impostazioni.ts` (cartella dati/export), `file-dati.ts` (spostamento file).
- `src/preload/index.ts` espone `window.api` tipizzato; il contratto è `Api` in `src/shared/types.ts`.
  `src/preload/finestra.ts` è il ponte minimo delle finestre dei documenti (anteprima cartella,
  relazioni, report): espone solo i comandi della barra in cima (riduci, ingrandisci, chiudi).
- Tutte le finestre nascono senza barra di Windows (`barraDisegnata()` in `main/finestre.ts`): la
  barra la disegna la pagina (`components/BarraFinestra.tsx`, `conBarra()` per l'HTML generato).
- **Salvataggio, una regola sola** (`renderer/src/salvataggio.ts`): in una scheda di lavoro (seduta,
  valutazione, body chart, screening, configurazione, indicazioni, misure, profilo) quello che si
  scrive si salva da solo uscendo dalla scheda o chiudendo il programma; «Salva»/Ctrl+S lo fa subito.
  Accanto al pulsante sempre `<IndicatoreSalvataggio>` (modifiche non salvate / salvataggio… /
  salvato / non salvato e perché: l'errore resta finché un salvataggio non riesce). Un editor nuovo
  usa `useSalvataggio(modificato)` e `salvataggio.funzione.current = salva`; sotto ci sono
  `useSalvaUscendo` (uscita) e `useModificheInCorso` (chiusura del programma). Le anamnesi si
  salvano mentre si scrive, con lo stesso indicatore. Le finestre brevi (`Modale`) seguono la loro:
  Invio e clic fuori salvano, «Annulla» scarta.
- `src/renderer/src/` React: `App.tsx` (shell, sidebar, modali globali), `pages/`, `components/`,
  `styles.css` (indice che importa, in ordine, i file di `stili/` per area: l'ordine conta per la
  cascata; design token in `:root` dentro `stili/01-temi.css`).
- La costruzione della seduta sta in `components/seduta/`: `modello.ts` (dati e trasformazioni senza
  React, provati in `test/costruzione-seduta.test.ts`), `useSezioni` (reducer con Ctrl+Z), `useBozza`,
  e i pezzi della schermata; `SedutaBuilder.tsx` carica, salva ed esce. È il modello per dividere gli
  altri componenti grandi.
- Le progressioni di esercizi a step (es. Vertical braking) servono SOLO a programmare e non devono
  mai entrare in cartella, referti, stampe o esportazioni. I dati: `main/progressioni.ts` (gruppi,
  progressioni, step che rimandano a esercizi della libreria, collegamento alle fasi, lo step attuale),
  il calcolo puro in `shared/progressioni.ts`, l'esito per seduta (solo avanza/indietro, mai copiato
  programmando la settimana) in `seduta_progressioni`. Lo step del paziente NON è salvato: si ricalcola
  dagli esiti delle sedute. L'interfaccia: `ProgressioniLibreria` (linguetta della libreria),
  `ProgressioniFase` (tab della fase), `ProgressioniPaziente` e `SpecchiettoProgressioni` (specchietto),
  `seduta/SuggerimentiProgressioni` e `seduta/EsitiProgressioni`.
- Le **varianti** di un esercizio (equilibrio monopodalico normale o con uno stimolo cognitivo) si
  scrivono sull'esercizio in libreria (`esercizio_varianti`, migrazione 70, ordinate dalla più facile
  alla più difficile; `EsercizioInput.varianti` le salva insieme all'esercizio, `salvaVarianti` in
  `main/esercizi.ts`). Quasi tutti gli esercizi non ne hanno e non cambia niente: il menu «normale ▾»
  compare in `RigaSeduta` solo dove ce ne sono. Sulla riga della seduta si salva il **testo**
  (`seduta_esercizi.variante`, come la dose: rinominare la variante non cambia le sedute fatte); sullo
  step di una progressione il **rimando** (`progressione_step.variante_id`: la scala segue le
  rinominazioni, e una variante usata da uno step non si toglie). «Normale» = nessuna variante e sulla
  scheda non si scrive niente; altrimenti si legge sotto il nome (`nomeConVariante` in
  `shared/varianti.ts`, PDF/Word/finestra della scheda/CSV). Prove: `esercizi`, `progressioni`,
  `sedute`, `costruzione-seduta`, `export-seduta`, `e2e/varianti.spec.ts`.
- I test con la pedana di forza (file `*.pedana.json` della Balance Squat App, contratto in
  `docs/formato-pedana.md`, esempio vero in `docs/esempio.pedana.json`) hanno un archivio proprio, NON
  righe di screening: `main/pedana.ts` (anteprima con candidati paziente, importazione senza doppioni
  per `id_esterno`, archivio), lettura/validazione, somiglianza dei nomi, accoppiamento dei lati, LSI e
  frasi in `shared/pedana.ts`, tabelle `pedana_*` (migrazione 65). Il paziente non si abbina mai da
  solo (si conferma nella finestra `components/pedana/ImportaPedana.tsx`). Il lato interessato si
  sceglie per test (`pedana_lato_interessato`, chiave = `chiaveTestPedana`), altrimenti vale l'arto
  operato. Interfaccia: linguetta «Pedana» fra Clinica e Percorso della scheda paziente
  (`components/pedana/PedanaPaziente.tsx`: solo un elenco data + test come il diario sedute; il
  dettaglio sta nella finestra a sezioni `DettaglioPedana.tsx`; prova e2e in `e2e/pedana.spec.ts`) e pulsante di importazione nella lista pazienti. Nei
  documenti: `main/pedana-report.ts` (cartella = sezione «Test con pedana» con lo storico completo;
  relazione della valutazione = sintesi in fondo, tabella + frasi; report di screening = i test che
  si spuntano nella finestra «Quali screening mettere a confronto?», passati come secondo argomento
  `pedanaIds` di `screeningSvolti:anteprimaReport`/`report`), disegni in `main/pedana-disegni.ts`
  (SVG con stili in linea). Le curve (forza nel tempo, salto, oscillazione) sono descritte da
  `curvePedana` e disegnate da `curvaSvg` in `shared/pedana-curve.ts`: lo stesso SVG nella pagina
  (`GraficiCurve.tsx`) e nei documenti. Prove in `test/pedana.test.ts`.
- Promemoria («rifai questo questionario / screening / test pedana», `main/promemoria.ts`, tabella
  ricostruita dalla migrazione 66): quello della pedana si riconosce da `pedana_chiave` (`chiaveTestPedana`)
  e si chiude da solo importando quel test (`chiudiFatti` in `importaPedana`).
- Eliminare con cestino (`eliminaConCestino`) avvisa le finestre (`quandoEliminato` → evento
  `cestino:eliminato` → avviso con «Annulla» in `App.tsx`, che ripristina e ricarica la pagina). I PDF
  passano tutti da `htmlToPdf` in `main/export.ts`, che scrive nel piede nome, data e «Pagina X di Y».
  `components/StatoVuoto.tsx` è il riquadro delle pagine senza niente dentro.
- Le schermate grandi sono divise così: `pages/paziente/` (scheda, diario, obiettivi, scheda illustrata),
  `pages/questionari/` (elenco, editor, una scheda per tab; costanti e id provvisori in `modello.ts`),
  `pages/impostazioni/` (una scheda per file), `components/anamnesi/` e `components/valutazione/`. Il
  file di prima (es. `PazientiPage.tsx`) resta il punto d'ingresso e tiene stato e caricamento.
- Lingua dell'interfaccia, dei commenti e dei commit: **italiano**.

## Regole che contano
- **Migrazioni**: mai modificare una migrazione già rilasciata; aggiungerne una nuova in coda a
  `MIGRATIONS` in `src/main/migrations.ts`. Il db dell'utente si aggiorna da solo al login.
- **Nuova funzionalità end-to-end** = tipo in `shared/types.ts` (interfaccia `Api`) → logica in un
  modulo di servizio in `main/` → canale in `main/ipc.ts` → voce in `preload/index.ts` → uso in
  `renderer`. Il typecheck impone la coerenza.
- **Logica fuori dai canali**: SQL, validazione e transazioni stanno in un modulo per dominio senza
  Electron (modello: `main/sedute.ts`; anche `questionari.ts`, `screening.ts`, `valutazione.ts`…);
  in `ipc.ts` il canale chiama solo il servizio (`handle('sedute:get', (id) => leggiSeduta(id))`).
  Così le prove in `test/` chiamano il codice vero invece di ricopiarne le query. Gli elenchi
  ordinabili usano `main/elenchi.ts`: `riordina`, `prossimoOrdine`, e per quelli fatti solo di nomi
  `elencoSemplice` + `registraElenco` in `ipc.ts`. Già spostati: sedute, pazienti (anche follow-up),
  tecniche, percorso (patologie/fasi/obiettivi/sezioni/test), anamnesi, esercizi e categorie,
  obiettivi terapeutici, body chart, indicazioni, massimali, segni, bozze. Restano in `ipc.ts`:
  distretti, parti di questionari/screening/test di valutazione, e tutto ciò che apre un dialogo o
  tocca una finestra (auth, copie, impostazioni, export, referti): lì il canale ha davvero della
  logica di Electron. Un dominio che si tocca si sposta con lo stesso modello, con la sua prova.
- I dati delle sedute sono **snapshot** (serie/ripetizioni/carico/recupero copiati), gli
  esercizi usati nello storico non si eliminano (si archiviano). La fase è fotografata sulla seduta.
- Niente `alert()`: usare `toast()` / `toastErrore()` da `components/Toast.tsx`. I `confirm()`
  per le eliminazioni vanno bene. `window.prompt` NON funziona in Electron.
- Nuove icone: `lucide-react`. Nuovi testi: sempre in italiano, tono semplice (l'utente non è tecnico).

## Comandi
```bash
npm install        # prima volta (scarica Electron, compila il modulo nativo per Electron)
npm run dev        # app in sviluppo con hot reload
                   # (per l'utente: scripts/avvia-prova.cmd, collegamento sul Desktop)
npm run typecheck  # obbligatorio prima di committare
npm run build      # build di produzione in out/
npm test           # prove automatiche (Vitest, cartella test/) con l'ABI dell'app
npm test -- cestino  # solo i file di prova che contengono "cestino"
npm run test:node  # le stesse prove con Node — richiede la ricompilazione, vedi sotto
npm run smoke:ripristino  # prova del ripristino delle copie e dell'aggiornamento di un archivio
                   # vecchio (avvia Electron per davvero)
npm run dev:reset  # azzera i dati di sviluppo (li archivia, non li cancella)
npm run build:win  # installer Windows in dist/
```

### Dati di sviluppo separati da quelli reali
In sviluppo (`!app.isPackaged`) l'app usa `%APPDATA%/riabilitazione-sportiva (dev)` e, come
cartella dati di default, `Documenti/Riabilitazione (dev)`. L'app installata usa i percorsi senza
suffisso. Serve perché le migrazioni si applicano da sole al login e **non hanno rollback**: una
prova andata male non deve toccare il database vero. Vedi `index.ts` (setPath userData) e
`nomeCartellaDati()` in `impostazioni.ts`. `npm run dev:reset` agisce solo sui percorsi che
contengono `(dev)` e archivia con un suffisso data/ora invece di cancellare.

### Trappola: modulo nativo e ABI
`better-sqlite3-multiple-ciphers` è compilato una volta sola, per l'ABI di **Electron**, perché
è quella che serve all'app. Node ne vuole un'altra, quindi `npm run test:node` (che gira con Node)
pretenderebbe di ricompilarlo avanti e indietro — e non ci riesce nemmeno, se l'app è aperta:
tiene il file `.node` bloccato.

**Usare `npm test`** (`scripts/test-app.mjs`): esegue Vitest dentro il runtime di Electron avviato
come Node (`ELECTRON_RUN_AS_NODE=1`), quindi con l'ABI già giusta. Nessuna ricompilazione, funziona
anche con l'app aperta.

`npm run test:node` resta per la CI su Linux, dove non c'è un'app aperta; lì serve la sequenza:
```bash
npm rebuild better-sqlite3-multiple-ciphers   # -> Node, per le prove
npm run test:node
npx @electron/rebuild -f -m .                 # -> Electron, per far ripartire l'app (il -f e' obbligatorio)
```
Se l'app si avvia "muta" senza finestra, è quasi sempre questo: rilanciare l'ultimo comando.

`npm run smoke:ripristino` sta un gradino più in là: gli servono le **vere** API di Electron
(`app.getPath`/`setPath`, da cui passano `impostazioni.ts` e `backup.ts`), che sotto
`ELECTRON_RUN_AS_NODE=1` non ci sono. `scripts/smoke-ripristino.js` riavvia quindi se stesso
dentro a Electron avviato per davvero (togliendo `ELECTRON_RUN_AS_NODE` dall'ambiente) ed esegue
`scripts/smoke-ripristino.ts` con il loader di `tsx`. ABI già giusta, nessuna ricompilazione in
più. Gira nel job Windows della CI; in locale va lanciato quando si tocca `backup.ts`, `db.ts` o
le migrazioni. Lavora solo in cartelle temporanee.

### Le prove automatiche (`test/`)
Un file per area (`cestino.test.ts`, `questionari.test.ts`, `auth.test.ts`…). Chi lavora sul
database chiama `archivioDiProva()` (`test/archivio-di-prova.ts`): un archivio cifrato suo, in
una cartella temporanea; le prove dello stesso file girano in fila su quell'archivio, file diversi
non si vedono (un processo per file). Una funzionalità nuova porta con sé la sua prova nel file
dell'area, o in un file nuovo. Niente dati veri: solo cartelle temporanee.

### Le prove dell'interfaccia (`e2e/`)
`npm run e2e` costruisce il programma e lo guida con Playwright come lo userebbe una persona
(primo avvio, pazienti, sedute, ricerca, protezioni della finestra). Ogni prova parte da una
cartella temporanea sua: `e2e/app.ts` avvia Electron con `RIABILITAZIONE_CARTELLA_PROVA`, che
`src/main/cartelle-di-avvio.ts` usa per impostazioni e dati (ignorata nel programma installato).
Una prova fallisce anche se la pagina scrive errori nella console, comprese le violazioni della
CSP. Le schermate restano in `e2e-risultati/schermate` (fuori da git): guardarle quando si tocca
l'interfaccia. Gira nel job Windows della CI, che le allega come artefatto.

Il **contratto dei canali** sta in `src/shared/canali.ts`: `Canali` (firma di ogni canale) e
`MAPPA_API` (metodo di `window.api` → canale). Da lì si ricavano il tipo `Api` (in `types.ts`, più
`ApiExtra` per ciò che non è una chiamata) e il ponte, che costruisce `window.api` dalla mappa. In
`ipc.ts` `handle()` accetta solo canali del contratto con gli argomenti giusti (`handleConFinestra`
per chi deve sapere la finestra), e all'avvio controlla che ogni canale abbia il gestore. Funzione
nuova = firma in `Canali` + voce in `MAPPA_API` + gestore.

La finestra principale gira nel **sandbox** con il ponte `src/preload/index.ts` (un file solo,
importa da Electron solo `contextBridge` e `ipcRenderer`): il ponte non può importare moduli di
Node. La CSP sta in `electron.vite.config.ts` e si scrive solo nella build; una risorsa nuova
caricata da fuori (font, immagini, script) va dichiarata lì, e `e2e/protezioni.spec.ts` lo controlla.

## Release
1. Aggiornare `version` in `package.json` e la sezione novità nel `README.md`. Se la versione porta
   migrazioni nuove, aggiungere una riga a `test/migrazioni-rilasciate.json` (versione, quante
   migrazioni, impronta: si ricava come nel test `test/migrazioni.test.ts`): da quel momento non si
   toccano più, e il test lo fa rispettare.
2. `git commit`, `git push`, poi `git tag vX.Y.Z && git push --tags`.
3. GitHub Actions (`.github/workflows/release.yml`) compila l'installer Windows e lo pubblica
   nei Releases in ~3 minuti. Poi `gh release edit vX.Y.Z --notes "..."` con le note in italiano.
4. L'utente finale scarica sempre da `.../releases/latest`; installando sopra, i dati restano.

## Flusso di lavoro in due
- `main` è sempre funzionante e rilasciabile: le release si taggano solo da `main`.
- Modifiche piccole: direttamente su `main`. Lavori grossi: branch `feature/nome`, poi merge
  in `main` quando `npm run typecheck` è verde.
- Prima di iniziare `git pull`; prima di pushare `npm run typecheck`. Messaggi di commit in italiano,
  al presente, che descrivono il "cosa" per l'utente (es. "Diario: menu download PDF/Word").
- A ogni push GitHub Actions (`.github/workflows/ci.yml`) esegue typecheck, prove e build su
  Linux, e le prove più `smoke:ripristino` su Windows: se il badge è rosso, non rilasciare
  finché non è verde.
