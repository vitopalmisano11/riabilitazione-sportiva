# Formato del file della pedana (`*.pedana.json`)

Questa pagina è la sezione «Esportazione per il gestionale» del README della Balance Squat App,
copiata qui com'è: è il contratto del formato. Il file di esempio completo è
[esempio.pedana.json](esempio.pedana.json). Il codice che lo legge è `src/shared/pedana.ts`
(`leggiFilePedana`); l'importazione è in `src/main/pedana.ts`.

Se il formato cambia, si cambia prima l'app della pedana: qui si ricopia la sezione.

## Come il gestionale usa il file (regole sue, non del formato)

- **Riconoscimento**: valido solo con `formato = "pedana-report"` e `versione = 1`; altrimenti
  «Versione del file non supportata». Se il file non si legge o mancano `paziente` e `registrazioni`,
  errore chiaro e non si importa niente.
- **Paziente**: mai abbinato da solo. Si propongono i pazienti con nome somigliante (senza maiuscole
  e accenti, con nome e cognome in qualunque ordine, una lettera sbagliata tollerata nelle parole
  lunghe), si conferma, si sceglie un altro o se ne crea uno nuovo.
- **Doppioni**: la registrazione si riconosce dall'`id`, per paziente. Rimportare dà «importate N,
  già presenti M».
- **Test e misure** si riconoscono solo dal `codice`. Quello che non si conosce si ignora senza errore.
- **LSI** (la calcola il gestionale, solo per `forza.*`): una registrazione destra e una sinistra dello
  stesso test (stesso codice; per `forza.custom` anche stesso nome) fatte a non più di 7 giorni una
  dall'altra si mettono insieme, la più vicina per prima. Si confronta `picco_migliore_kg` (poi
  `picco_medio_kg`, poi il migliore di `picco_kg`). LSI = lato interessato ÷ lato sano × 100, dove il
  lato interessato è quello scelto per quel test nella scheda del paziente, altrimenti l'arto operato;
  senza nessuno dei due è il lato meno forte ÷ il più forte × 100. Se manca un lato, niente LSI.
- **Frase di sintesi**: «Arto destro più forte di X% rispetto al sinistro», con X = (forte − debole) ÷
  debole × 100.
- **Avvertenze** accanto al risultato; una registrazione senza misure («nessuna ripetizione valida»)
  si importa lo stesso.
- **Date**: si mostrano `data` e `ora` (locali); `salvata_il` e `creato_il` non servono.
- **Serie**: se le liste non hanno la stessa lunghezza la serie si scarta e restano le misure. Il
  tracciato `stabilogramma` si disegna nella scheda; le curve `forza_tempo` (ripetizioni di forza e
  salto, con i momenti del salto da `eventi_serie_ms`), `carico_lati_tempo` e `stabilogramma_tempo`
  si disegnano sotto la riga aperta e nei documenti (`src/shared/pedana-curve.ts`). Le serie che non
  si conoscono si conservano senza disegnarle.
- **Statokinesigramma**: se la serie `stabilogramma` ha `ellisse` (l'ovale al 95%: `centro_x_mm`,
  `centro_y_mm`, semiassi, `angolo_gradi` e il contorno chiuso in `x`/`y`) si disegna sopra la
  traiettoria, col centro segnato; nei file vecchi manca e non si disegna, senza errore. Il quadro è
  centrato sulla posizione media, stessa scala sui due assi; due tracciati a confronto (piede destro e
  sinistro) usano lo stesso raggio. `stabilogramma_tempo` si disegna con `y_ml` e `y_ap` centrate sulla
  propria media, sulla stessa scala verticale. Il `riassunto` si mostra com'è.
- **Nome del test**: le parentesi dentro le parentesi si tolgono (`Spalla (Y (135°))` diventa
  `Spalla (Y 135°)`), sia leggendo il file sia nei test già salvati.

## Esportazione per il gestionale

L'app può salvare i risultati dei test della pedana in un file che un altro programma (il gestionale
per fisioterapisti) importa. Il file è un solo JSON, UTF-8, di nome
`<nome-paziente>_<AAAA-MM-GG>.pedana.json` (il nome è quello scritto nell'app, in minuscolo, senza
accenti e con i trattini; la data è quella dell'esportazione). Un esempio completo, generato dal
codice, è in [esempio.pedana.json](esempio.pedana.json).

### Come si usa

- Scheda **Pazienti**, sul paziente: **Esporta per gestionale** apre l'elenco di tutti i suoi
  risultati salvati (forza, salti, stabilometria), con una spunta ciascuno (tutti spuntati) e la
  casella **Includi i grafici**. **Salva file** apre il dialogo di salvataggio di sistema.
- Su ogni risultato: **Esporta questo** salva solo quel risultato (con i grafici).
- Prima di scrivere, il file viene controllato: i valori devono essere numeri finiti, le prove
  numeri interi da 1, i lati `sx`/`dx`/`null`, gli id univoci, le serie della stessa lunghezza. Se
  qualcosa non va compare un messaggio che dice cosa.
- I giochi non vengono esportati.

### Schema (versione 1)

```
{
  "formato": "pedana-report",
  "versione": 1,
  "creato_il": "2026-10-13T10:22:00",          // ora locale, senza fuso
  "app": { "nome": "Balance Squat App", "versione": "0.1.0" },
  "dispositivo": { "tipo": "wii-balance-board", "modello": null, "frequenza_hz": 100, "portata_nominale_kg": 150 },
  "paziente": { "nome_completo": "…", "peso_corporeo_kg": 80 },   // l'ultimo peso noto, o null
  "registrazioni": [ { …una per risultato salvato… } ]
}
```

Una registrazione:

| campo | contenuto |
|---|---|
| `id` | l'identificativo del risultato salvato nell'app: stabile, lo stesso a ogni riesportazione |
| `salvata_il`, `data`, `ora` | quando è stato salvato: ISO (UTC), `AAAA-MM-GG` e `HH:MM` (ora locale) |
| `test` | `{ codice, nome, categoria }`: il `codice` è fisso, il `nome` è un'etichetta |
| `condizioni` | come è stato fatto il test (vedi sotto) |
| `peso_corporeo_kg` | il peso usato dal test, o `null` |
| `avvertenze` | frasi fisse: `saturazione`, `ripetizioni poco costanti`, `nessuna ripetizione valida`, `stabilizzazione oltre 5 s` |
| `misure` | l'elenco delle misure (sotto) |
| `riassunto` | solo stabilometria: le frasi del mini report mostrato a schermo, una per riga |
| `serie` | i grafici, se inclusi (sotto) |

Una **misura** è `{ codice, nome, unita, per_prova, meglio, valori: [ { lato, prova, valore } ] }`:

- `lato`: `"sx"` o `"dx"` (sinistro e destro **del paziente**), oppure `null` nei test bilaterali.
  Con una pedana di forza vera sarà il lato della piastra su cui poggia il piede.
- `prova`: il numero della ripetizione, da 1 (conta anche quelle non valide, quindi può saltare un
  numero), oppure `null` per le misure con un solo valore. Le ripetizioni non valide non danno
  valori: si contano in `condizioni.ripetizioni_non_valide`.
- `meglio`: `"alto"` (più alto è meglio), `"basso"` (più basso è meglio) o `null` (nessuna direzione:
  la quota di carico, dove l'ideale è 50, e la durata).
- Una grandezza che non c'è non compare: niente `0` al posto di "mancante". I numeri hanno al massimo
  2 decimali.
- La forza è in kg (anche se l'app è impostata su N o lb), tranne dove il codice dice `_n`.
- `codice` di test e di misure sono stringhe fisse, minuscole, senza spazi: non si traducono e non
  si cambiano. `nome` e `categoria` possono cambiare.

### Test e misure

**Forza isometrica**: `forza.soleus`, `forza.hamstring`, `forza.shoulder.i` / `.y` / `.t` (la variante),
`forza.custom` (il nome scritto dall'utente è in `test.nome`). Categoria «Pedana di forza». Una
registrazione per risultato, con un solo lato (un test su entrambi i lati sono due registrazioni): la
simmetria (LSI) la calcola il gestionale. `condizioni`: `sorgente` (`total`, `topLeft`, `topRight`,
`bottomLeft`, `bottomRight`), `variante`, `durata_s`, `riposo_kg`, `ripetizioni_non_valide`.

| codice | misura | unità | meglio | per prova |
|---|---|---|---|---|
| `picco_kg` | Picco di forza | kg | alto | sì |
| `sostenuta_kg` | Forza sostenuta 1 s | kg | alto | sì |
| `tempo_90_ms` | Tempo al 90% del picco | ms | basso | sì |
| `tempo_picco_ms` | Tempo al picco | ms | basso | sì |
| `rfd200_kg_s` | RFD 0–200 ms | kg/s | alto | sì |
| `rfd_max_kg_s` | RFD massimo | kg/s | alto | sì |
| `impulso_kg_s` | Impulso | kg·s | alto | sì |
| `picco_pct_peso` | Picco / peso corporeo (solo se il peso è noto) | % | alto | sì |
| `costanza_cv_pct` | Variabilità nella spinta (CV) | % | basso | sì |
| `picco_migliore_kg` | Picco della ripetizione migliore | kg | alto | no |
| `picco_medio_kg` | Picco medio delle ripetizioni | kg | alto | no |

**Salto**: `salto.cmj`, `salto.dropjump`. Categoria «Salto». `lato` sempre `null`, una registrazione per
salto salvato. `condizioni`: `altezza_cassetto_cm`, `saturato`, `eventi_serie_ms` (inizio del
movimento, velocità zero, stacco e atterraggio, in ms dal primo campione delle serie).

| codice | misura | unità | meglio |
|---|---|---|---|
| `altezza_cm` | Altezza del salto | cm | alto |
| `tempo_volo_ms` | Tempo di volo | ms | alto |
| `tempo_contatto_ms` | Tempo di contatto (se presente) | ms | basso |
| `rsi` | RSI (se presente) | – | alto |
| `picco_forza_n` | Picco di forza | N | alto |
| `picco_atterraggio_n` | Picco all'atterraggio | N | basso |
| `stabilizzazione_ms` | Tempo di stabilizzazione (assente se oltre 5 s) | ms | basso |
| `carico_sx_propulsione_pct`, `carico_sx_atterraggio_pct`, `carico_sx_statica_pct` | Quota di carico sul lato sinistro | % | `null` |
| `durata_salto_ms`, `fase_eccentrica_ms`, `fase_concentrica_ms`, `tempo_eccentrico_forza_positiva_ms` | Fasi del movimento, lette dalla curva (le ultime tre solo nel CMJ) | ms | `null` |
| `picco_forza_eccentrica_n`, `picco_forza_concentrica_n` | Picchi di forza nelle due fasi (solo CMJ) | N | alto |
| `rfd_max_n_s` | RFD massimo | N/s | alto |

**Stabilometria**: `stabilometria.bipodalico.occhi_aperti`, `stabilometria.bipodalico.occhi_chiusi`,
`stabilometria.monopodalico.occhi_aperti`, `stabilometria.monopodalico.occhi_chiusi`. Categoria
«Stabilometria». Nel test monopodalico `lato` è il piede d'appoggio (`sx`/`dx`), nel bipodalico `null`.
Tutte le misure hanno `per_prova: false` e `meglio: "basso"` tranne la durata.
`condizioni`: `appoggio` (`bipodalico`, `monopodalico_sx`, `monopodalico_dx`), `occhi` (`aperti`,
`chiusi`), `durata_s`, `x_positivo: "destra"`, `y_positivo: "punte"` (come sono disegnati gli assi
nell'app), `posizione_media_ml_mm`, `posizione_media_ap_mm`.

| codice | misura | unità |
|---|---|---|
| `percorso_mm` | Lunghezza del percorso | mm |
| `velocita_media_mm_s` | Velocità media | mm/s |
| `velocita_ml_mm_s`, `velocita_ap_mm_s` | Velocità medio-laterale / antero-posteriore | mm/s |
| `range_ml_mm`, `range_ap_mm` | Escursione ML / AP | mm |
| `rms_ml_mm`, `rms_ap_mm` | RMS ML / AP | mm |
| `area_ellisse_mm2` | Area ellisse 95% | mm² |
| `durata_s` | Durata (`meglio: null`) | s |

### Serie (i grafici)

`serie` è un elenco di `{ codice, nome, asse_x, asse_y, frequenza_hz, x, y, … }` (valori a 2 decimali).
Sono incluse solo se la casella **Includi i grafici** è spuntata, tranne quelle della stabilometria,
che ci sono sempre.

| test | codice | contenuto |
|---|---|---|
| forza | `forza_tempo` | una per ripetizione valida (con `lato` e `prova`), 25 Hz: `x` ms dal via (negativo = a riposo), `y` kg sopra il riposo |
| salto | `forza_tempo` | `x` ms dal primo campione, `y` forza in N, alla frequenza della pedana |
| salto | `carico_lati_tempo` | `y_sx` e `y_dx`: kg su ciascun lato |
| stabilometria | `stabilogramma` | «Statokinesigramma»: `x` (medio-laterale) e `y` (antero-posteriore) in mm, un punto ogni 40 ms (25 Hz), a 1 decimale |
| stabilometria | `stabilogramma_tempo` | «Oscillazione nel tempo»: `x` in s, `y_ml` e `y_ap` in mm |

### Esempio (abbreviato)

```json
{
  "formato": "pedana-report",
  "versione": 1,
  "creato_il": "2026-10-13T10:22:00",
  "app": { "nome": "Balance Squat App", "versione": "0.1.0" },
  "dispositivo": { "tipo": "wii-balance-board", "modello": null, "frequenza_hz": 100, "portata_nominale_kg": 150 },
  "paziente": { "nome_completo": "Mario Rossi", "peso_corporeo_kg": 80 },
  "registrazioni": [
    {
      "id": "5b0e2c1a-7d1f-4a43-9a0b-1f6f3a9c1111",
      "salvata_il": "2026-10-12T08:30:00.000Z",
      "data": "2026-10-12",
      "ora": "10:30",
      "test": { "codice": "forza.soleus", "nome": "Forza isometrica — Soleo", "categoria": "Pedana di forza" },
      "condizioni": { "sorgente": "total", "variante": null, "durata_s": 5, "riposo_kg": 1.23, "ripetizioni_non_valide": 1 },
      "peso_corporeo_kg": 80,
      "avvertenze": [],
      "misure": [
        {
          "codice": "picco_kg", "nome": "Picco di forza", "unita": "kg", "per_prova": true, "meglio": "alto",
          "valori": [
            { "lato": "sx", "prova": 1, "valore": 31.2 },
            { "lato": "sx", "prova": 2, "valore": 33 }
          ]
        },
        {
          "codice": "picco_migliore_kg", "nome": "Picco della ripetizione migliore", "unita": "kg", "per_prova": false, "meglio": "alto",
          "valori": [ { "lato": "sx", "prova": null, "valore": 33 } ]
        }
      ],
      "serie": [
        {
          "codice": "forza_tempo", "nome": "Forza nel tempo",
          "asse_x": { "nome": "Tempo", "unita": "ms" }, "asse_y": { "nome": "Forza", "unita": "kg" },
          "frequenza_hz": 25, "lato": "sx", "prova": 1,
          "x": [-500, 0, 400, 800], "y": [0, 6.4, 24.96, 31.2]
        }
      ]
    }
  ]
}
```

### Note

- A parità di dati il file è identico a ogni riesportazione (stessi `id`, stesso ordine: per data di
  salvataggio, poi per id); cambia solo `creato_il`.
- Il formato non dipende dalla pedana: `dispositivo` e `serie` sono generici, e con una pedana di forza
  vera (due piastre, 1000 Hz) cambiano solo `dispositivo.frequenza_hz` e la frequenza delle serie.
- Il test automatico è in `src/lib/export/gestionale.test.ts`; si lancia con `bun test`.
