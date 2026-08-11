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

## v1.1 (feedback dal primo utilizzo)

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

## v1.2 (secondo giro di feedback)

- Link video opzionale per esercizio: icona ▶ accanto al nome (libreria e builder),
  apre il browser predefinito; nessun testo sottolineato
- Configurazione ridisegnata a flusso progressivo: scegli patologia (con ricerca) →
  fasi come riquadri affiancati → editor della fase a schede (struttura/obiettivi/test),
  con breadcrumb per tornare indietro
- Fix: nomi delle sezioni non si spezzano più a metà parola (colonne con larghezza minima)

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
