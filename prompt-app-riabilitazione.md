# Prompt di progettazione — Web App Riabilitazione Sportiva

## Contesto
Sono un fisioterapista sportivo. Ho bisogno di un **programma desktop ad uso personale** (non commerciale, un solo utente, solo locale sul mio pc, niente hosting/web/server esterno) per costruire, gestire ed esportare programmi di riabilitazione sportiva per i miei pazienti, sostituendo l'attuale gestione via file Word (uno per paziente, con liste infinite di giornate).

Nei periodi in cui sono via e non ho accesso al pc, mi organizzo preparando in anticipo le sedute necessarie — non serve quindi accesso remoto/da telefono.

## Obiettivo v1 (prima versione da costruire)

### 1. Modello dati / gerarchia concettuale
```
Patologia (es. Ricostruzione LCA, Riparazione meniscale, ...)
  └─ Fase (es. Fase iniziale, Fase intermedia, Fase avanzata)
       └─ Obiettivo principale della fase (es. "controllo del dolore e gonfiore", "corsa precoce", "cambi di direzione")
            └─ Categorie di esercizi associate (es. mobilizzazione, elettrostimolazione, rinforzo, corsa, cambi di direzione)
                 └─ Esercizi (libreria condivisa e riutilizzabile tra patologie diverse)

Paziente
  └─ Sedute (una seduta = un programma completo per quel giorno)
       └─ Esercizi selezionati (con serie/ripetizioni/carico specifici per quella seduta + note)
```

Punti chiave del modello:
- **La libreria esercizi è indipendente e condivisa**: lo stesso esercizio (es. "cambio di direzione a 45°") deve poter essere richiamato da patologie diverse, senza duplicazioni.
- **Patologie, fasi, obiettivi e categorie di esercizi associate a ciascuna fase devono essere completamente configurabili da me** dall'interfaccia (non hardcoded, non solo modificabili dallo sviluppatore). Questa è la parte di "template", creata una volta e riusata per tutti i pazienti con quella patologia.
- **Un programma = una seduta singola**, non un piano settimanale/mensile. Un paziente con 5 sedute/settimana avrà 5 programmi/sedute distinte.
- **Il diario di trattamento** è semplicemente la lista cronologica delle sedute di un paziente, consultabile per rivedere cosa è stato fatto giorno per giorno.
- **Fase corrente persistente sul paziente**: quando assegno una patologia a un paziente, imposto anche la fase attuale (es. "fase iniziale"). Questa fase resta associata al paziente come stato — **non va riselezionata a ogni seduta**. Ogni nuova seduta per quel paziente si apre già nella fase corrente, con la relativa struttura (categorie di esercizi) pronta. Sono io, attivamente, a far avanzare la fase del paziente quando decido che è pronto per il passo successivo; da quel momento le sedute successive useranno automaticamente la nuova fase.

### 2. Flusso utente (interfaccia)

**Alla creazione di un paziente (una tantum, o quando cambio patologia):**
1. Creo il paziente e gli assegno la patologia (es. "riabilitazione LCA").
2. Imposto la sua fase attuale (es. "Fase iniziale") — questa resta impostata come stato del paziente finché non la cambio io manualmente.

**Ad ogni seduta:**
3. Apro il paziente → vedo il suo diario/storico sedute e la fase corrente già impostata (nessuna riselezione richiesta).
4. Creo una nuova seduta: mi vengono proposti direttamente gli obiettivi della fase corrente con checkbox (posso selezionarne uno o più) — niente riselezione di patologia/fase ogni volta.
5. Per ogni obiettivo selezionato, si apre la scelta degli esercizi organizzati per categoria (es. Mobilizzazione, Rinforzo, Corsa) secondo la struttura definita per quella fase.
6. Seleziono gli esercizi desiderati dalla categoria → questi vanno a popolare lo schema della seduta.
7. Per ogni esercizio selezionato nella seduta posso modificare serie/ripetizioni/carico e aggiungere una nota (es. attenzione particolare al gesto tecnico, o un problema riscontrato da riprendere alla seduta successiva).
8. Salvo la seduta nel diario del paziente.
9. Esporto la seduta (o un intervallo di sedute) in Word e PDF.

**Quando decido di avanzare il paziente alla fase successiva:**
10. Vado sulla scheda paziente e cambio manualmente la fase corrente. Da quel momento le nuove sedute create per lui useranno la struttura della nuova fase.

### 3. Gestione contenuti (area "configurazione")
Un'area amministrativa (accessibile solo a me) dove posso:
- Creare/modificare/eliminare patologie, fasi, obiettivi, categorie di esercizi.
- Creare/modificare/eliminare esercizi nella libreria condivisa (campi: nome, categoria, serie/ripetizioni/carico di default modificabili, nota tecnica).
- Associare categorie di esercizi a un obiettivo/fase specifici.

### 4. Dati paziente e privacy
- Campi minimi per paziente: nome, cognome (eventualmente abbreviati), tipologia di intervento, data di intervento.
- Serve **login con password** obbligatorio per accedere all'app, anche essendo mono-utente e solo locale.
- Dati sensibili: valutare comunque una cifratura del database locale, dato che contiene dati clinici (anche se minimi).
- I dati/file devono essere salvati in una cartella sul mio computer; il backup lo gestisco io manualmente (non serve backup automatico integrato nell'app).

### 5. Esportazione
- Esportazione della singola seduta in formato Word e PDF, con layout leggibile e stampabile.
- Esportazione anche di un intervallo di sedute/storico completo del paziente (es. riepilogo delle sedute di un periodo), sempre in Word e PDF.

## Requisiti tecnici e vincoli
- **Piattaforma:** applicazione desktop per Windows, eseguita in locale sul mio pc — nessun hosting, nessun server esterno, nessun accesso da remoto/telefono necessario (mi organizzo preparando le sedute in anticipo quando sono via).
- **Scala:** utente singolo, meno di 20 pazienti attivi in parallelo — non servono soluzioni enterprise, va bene uno stack semplice (es. app desktop con database locale tipo SQLite).
- **Interfaccia:** deve essere intuitiva e veloce da usare durante le sedute, non un tool "da scrivania".

## Fuori scope per la v1 (da considerare come "fase 2")
- **Generazione automatica/assistita da IA delle sedute settimanali**, basata su un tema (es. 3 sedute forza + 2 sedute aerobiche a settimana), con possibilità di modifica manuale dopo la generazione. Da progettare solo dopo aver validato bene la v1 manuale.
- Integrazione automatica con YouTube per i video degli esercizi (non necessaria, li cerco fuori dall'app).
- Import di pazienti/programmi dai vecchi file Word (si riparte da zero con i nuovi pazienti).
- Gestione di più patologie/interventi contemporanei o in sequenza sullo stesso paziente (caso raro, non prioritario).

## Cosa vorrei da chi implementa
1. Una proposta di stack tecnico semplice per un'app desktop locale (es. Electron, o altra soluzione desktop con database embedded tipo SQLite), adatto a un progetto personale a bassa scala.
2. Uno schema del database (tabelle/relazioni) che rispecchi la gerarchia sopra descritta, incluso il concetto di "fase corrente" persistente sul paziente.
3. Un piano di sviluppo a step (es. prima libreria esercizi + configurazione patologie/fasi, poi creazione sedute, poi pazienti/diario con fase persistente, poi export, poi login).
4. Attenzione fin da subito a dove/come vengono salvati i dati dei pazienti sul disco locale (anche se minimi), data la natura sanitaria dell'app.
