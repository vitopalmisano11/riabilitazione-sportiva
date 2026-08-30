# Riabilitazione Sportiva — guida per chi sviluppa (umani e Claude Code)

App desktop Windows per un fisioterapista sportivo: costruisce, salva ed esporta le sedute
di riabilitazione dei pazienti. Uso personale, mono-utente, dati solo locali e cifrati.
Specifica originale e feedback dell'utente sono nei file `prompt-*.md` alla radice.

## Stack e struttura
- Electron + TypeScript + React, bundling con **electron-vite**; SQLite via
  `better-sqlite3-multiple-ciphers` (SQLCipher); Word con `docx`; PDF con `printToPDF`.
- `src/main/` processo principale: `ipc.ts` (tutti gli handler, uno per canale `entita:azione`),
  `db.ts` (apertura db cifrato, migrazioni), `migrations.ts` (array di SQL versionate),
  `auth.ts` (password, recovery key, DEK avvolta), `export*.ts` (PDF/Word),
  `impostazioni.ts` (cartella dati/export), `file-dati.ts` (spostamento file).
- `src/preload/index.ts` espone `window.api` tipizzato; il contratto è `Api` in `src/shared/types.ts`.
- `src/renderer/src/` React: `App.tsx` (shell, sidebar, modali globali), `pages/`, `components/`,
  `styles.css` (unico foglio di stile, design token in `:root`).
- Lingua dell'interfaccia, dei commenti e dei commit: **italiano**.

## Regole che contano
- **Migrazioni**: mai modificare una migrazione già rilasciata; aggiungerne una nuova in coda a
  `MIGRATIONS` in `src/main/migrations.ts`. Il db dell'utente si aggiorna da solo al login.
- **Nuova funzionalità end-to-end** = tipo in `shared/types.ts` (interfaccia `Api`) → handler in
  `main/ipc.ts` → voce in `preload/index.ts` → uso in `renderer`. Il typecheck impone la coerenza.
- I dati delle sedute sono **snapshot** (serie/ripetizioni/carico/recupero copiati), gli
  esercizi usati nello storico non si eliminano (si archiviano). La fase è fotografata sulla seduta.
- Niente `alert()`: usare `toast()` / `toastErrore()` da `components/Toast.tsx`. I `confirm()`
  per le eliminazioni vanno bene. `window.prompt` NON funziona in Electron.
- Nuove icone: `lucide-react`. Nuovi testi: sempre in italiano, tono semplice (l'utente non è tecnico).

## Comandi
```bash
npm install        # prima volta (scarica Electron, compila il modulo nativo per Electron)
npm run dev        # app in sviluppo con hot reload
npm run typecheck  # obbligatorio prima di committare
npm run build      # build di produzione in out/
npm run smoke      # test db/auth/export — vedi trappola sotto
```

### Trappola: modulo nativo e ABI
`better-sqlite3-multiple-ciphers` va compilato per l'ABI di **Electron** per l'app, ma per
l'ABI di **Node** per `npm run smoke`. Sequenza corretta:
```bash
npm rebuild better-sqlite3-multiple-ciphers   # -> Node, per lo smoke
npm run smoke
npx @electron/rebuild -f -m .                 # -> Electron, per far ripartire l'app (il -f e' obbligatorio)
```
Se l'app si avvia "muta" senza finestra, è quasi sempre questo: rilanciare l'ultimo comando.

## Release
1. Aggiornare `version` in `package.json` e la sezione novità nel `README.md`.
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
- A ogni push GitHub Actions (`.github/workflows/ci.yml`) esegue typecheck, smoke e build:
  se il badge è rosso, non rilasciare finché non è verde.
