# Riabilitazione Sportiva

App desktop (Windows, locale, mono-utente) per costruire, gestire ed esportare programmi di
riabilitazione sportiva. Sostituisce la gestione via file Word. Specifica completa in
[`prompt-app-riabilitazione.md`](./prompt-app-riabilitazione.md).

## Stack

- **Electron + TypeScript + React** (bundling con electron-vite)
- **SQLite** via `better-sqlite3-multiple-ciphers` (predisposto per cifratura SQLCipher)
- **electron-builder** per l'installer Windows

## Comandi

```bash
npm install        # prima installazione
npm run dev        # avvia l'app in sviluppo (hot reload)
npm run typecheck  # controllo tipi
npm run smoke      # smoke test del database (vedi nota in scripts/smoke.ts)
npm run build:win  # produce l'installer Windows in dist/
```

## Distribuzione

L'installer Windows si costruisce automaticamente con GitHub Actions: pubblicando un tag
(`git tag v0.x.y && git push --tags`) l'installer compare nei **Releases** del repo, pronto da
scaricare. L'eseguibile non è firmato: al primo avvio Windows SmartScreen mostra un avviso, si
supera con *Ulteriori informazioni → Esegui comunque*.

## Stato di avanzamento (piano a step)

- [x] 1. Fondamenta: progetto, database, migrazioni
- [x] 2. Area configurazione: patologie / fasi / obiettivi / categorie / esercizi
- [x] 3. Pazienti: anagrafica + fase corrente persistente
- [x] 4. Builder seduta (obiettivi → categorie → esercizi → parametri)
- [x] 5. Diario + duplica seduta
- [x] 6. Export PDF e Word (singola seduta e intervallo)
- [ ] 7. Login + cifratura SQLCipher (chiave derivata dalla password + recovery key)
- [ ] 8. Packaging: scelta cartella dati, installer

## Dove stanno i dati

Per ora il database è in `%APPDATA%/riabilitazione-sportiva/riabilitazione.db`. Allo step 8 la
cartella diventa configurabile (es. `Documenti\Riabilitazione`) per rendere banale il backup
manuale (copia di un file). La cifratura arriva allo step 7: SQLCipher permette di cifrare il
database esistente senza perdere i dati.
