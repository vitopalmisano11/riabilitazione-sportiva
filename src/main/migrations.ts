import type Database from 'better-sqlite3-multiple-ciphers'

// Ogni voce è una migrazione; l'indice + 1 corrisponde a PRAGMA user_version.
// Mai modificare una migrazione già rilasciata: aggiungerne una nuova in coda.
const MIGRATIONS: string[] = [
  // 1 — schema iniziale
  `
  CREATE TABLE patologie (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE
  );

  CREATE TABLE fasi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patologia_id INTEGER NOT NULL REFERENCES patologie(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE obiettivi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fase_id INTEGER NOT NULL REFERENCES fasi(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE categorie (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE
  );

  CREATE TABLE obiettivo_categorie (
    obiettivo_id INTEGER NOT NULL REFERENCES obiettivi(id) ON DELETE CASCADE,
    categoria_id INTEGER NOT NULL REFERENCES categorie(id) ON DELETE CASCADE,
    PRIMARY KEY (obiettivo_id, categoria_id)
  );

  CREATE TABLE esercizi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    categoria_id INTEGER NOT NULL REFERENCES categorie(id),
    serie_default TEXT,
    ripetizioni_default TEXT,
    carico_default TEXT,
    nota_tecnica TEXT,
    archiviato INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE pazienti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    tipo_intervento TEXT,
    data_intervento TEXT,
    patologia_id INTEGER REFERENCES patologie(id),
    fase_corrente_id INTEGER REFERENCES fasi(id)
  );

  CREATE TABLE sedute (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paziente_id INTEGER NOT NULL REFERENCES pazienti(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    fase_id INTEGER REFERENCES fasi(id),
    note TEXT
  );

  CREATE TABLE seduta_obiettivi (
    seduta_id INTEGER NOT NULL REFERENCES sedute(id) ON DELETE CASCADE,
    obiettivo_id INTEGER NOT NULL REFERENCES obiettivi(id),
    PRIMARY KEY (seduta_id, obiettivo_id)
  );

  CREATE TABLE seduta_esercizi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seduta_id INTEGER NOT NULL REFERENCES sedute(id) ON DELETE CASCADE,
    esercizio_id INTEGER NOT NULL REFERENCES esercizi(id),
    serie TEXT,
    ripetizioni TEXT,
    carico TEXT,
    nota TEXT,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX idx_fasi_patologia ON fasi(patologia_id);
  CREATE INDEX idx_obiettivi_fase ON obiettivi(fase_id);
  CREATE INDEX idx_esercizi_categoria ON esercizi(categoria_id);
  CREATE INDEX idx_sedute_paziente ON sedute(paziente_id);
  CREATE INDEX idx_seduta_esercizi_seduta ON seduta_esercizi(seduta_id);
  `,

  // 2 — v1.1: struttura seduta per fase (sezioni), test di avanzamento,
  //     obiettivi raggiunti persistenti sul paziente, campo recupero
  `
  ALTER TABLE esercizi ADD COLUMN recupero_default TEXT;
  ALTER TABLE seduta_esercizi ADD COLUMN recupero TEXT;

  CREATE TABLE sezioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fase_id INTEGER NOT NULL REFERENCES fasi(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE sezione_categorie (
    sezione_id INTEGER NOT NULL REFERENCES sezioni(id) ON DELETE CASCADE,
    categoria_id INTEGER NOT NULL REFERENCES categorie(id) ON DELETE CASCADE,
    ordine INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (sezione_id, categoria_id)
  );

  CREATE TABLE test_avanzamento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fase_id INTEGER NOT NULL REFERENCES fasi(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE paziente_obiettivi (
    paziente_id INTEGER NOT NULL REFERENCES pazienti(id) ON DELETE CASCADE,
    obiettivo_id INTEGER NOT NULL REFERENCES obiettivi(id) ON DELETE CASCADE,
    raggiunto_il TEXT,
    PRIMARY KEY (paziente_id, obiettivo_id)
  );

  CREATE TABLE paziente_test (
    paziente_id INTEGER NOT NULL REFERENCES pazienti(id) ON DELETE CASCADE,
    test_id INTEGER NOT NULL REFERENCES test_avanzamento(id) ON DELETE CASCADE,
    eseguito INTEGER NOT NULL DEFAULT 0,
    valore TEXT,
    PRIMARY KEY (paziente_id, test_id)
  );

  CREATE TABLE seduta_sezioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seduta_id INTEGER NOT NULL REFERENCES sedute(id) ON DELETE CASCADE,
    sezione_id INTEGER REFERENCES sezioni(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  ALTER TABLE seduta_esercizi ADD COLUMN seduta_sezione_id INTEGER
    REFERENCES seduta_sezioni(id) ON DELETE SET NULL;

  CREATE INDEX idx_sezioni_fase ON sezioni(fase_id);
  CREATE INDEX idx_test_avanzamento_fase ON test_avanzamento(fase_id);
  CREATE INDEX idx_seduta_sezioni_seduta ON seduta_sezioni(seduta_id);
  `,

  // 3 — v1.2: link video opzionale sugli esercizi
  `
  ALTER TABLE esercizi ADD COLUMN link TEXT;
  `,

  // 4 — v1.3: categorie ordinabili (ordine iniziale = alfabetico)
  `
  ALTER TABLE categorie ADD COLUMN ordine INTEGER NOT NULL DEFAULT 0;
  UPDATE categorie SET ordine = (SELECT COUNT(*) FROM categorie c2 WHERE c2.nome < categorie.nome);
  `,

  // 5 — immagine dell'esercizio, come data URL dentro il database cifrato
  //     (cosi' il backup resta "copia la cartella" e l'immagine e' protetta
  //     come il resto). Non si legge mai nell'elenco: vedi esercizi:immagine.
  `
  ALTER TABLE esercizi ADD COLUMN immagine TEXT;
  `,

  // 6 — questionari (PROM). Ogni domanda, di qualunque forma, e' un elenco di
  //     risposte che valgono un punteggio: si/no sono due risposte (0 e 1), una
  //     scala 0-10 sono undici risposte, una scelta multipla le sue opzioni. Un
  //     questionario puo' avere piu' punteggi (es. Totale e Sub) e delle fasce,
  //     lette in ordine: vince la prima regola che si avvera.
  `
  CREATE TABLE questionari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    istruzioni TEXT,
    ordine INTEGER NOT NULL DEFAULT 0,
    archiviato INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE questionario_domande (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    questionario_id INTEGER NOT NULL REFERENCES questionari(id) ON DELETE CASCADE,
    testo TEXT NOT NULL,
    tipo TEXT NOT NULL,
    scala_min INTEGER,
    scala_max INTEGER,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE questionario_opzioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domanda_id INTEGER NOT NULL REFERENCES questionario_domande(id) ON DELETE CASCADE,
    etichetta TEXT NOT NULL,
    punteggio REAL NOT NULL DEFAULT 0,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE questionario_punteggi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    questionario_id INTEGER NOT NULL REFERENCES questionari(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE punteggio_domande (
    punteggio_id INTEGER NOT NULL REFERENCES questionario_punteggi(id) ON DELETE CASCADE,
    domanda_id INTEGER NOT NULL REFERENCES questionario_domande(id) ON DELETE CASCADE,
    PRIMARY KEY (punteggio_id, domanda_id)
  );

  CREATE TABLE questionario_fasce (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    questionario_id INTEGER NOT NULL REFERENCES questionari(id) ON DELETE CASCADE,
    etichetta TEXT NOT NULL,
    punteggio_id INTEGER REFERENCES questionario_punteggi(id) ON DELETE CASCADE,
    minimo REAL,
    massimo REAL,
    punteggio2_id INTEGER REFERENCES questionario_punteggi(id) ON DELETE CASCADE,
    minimo2 REAL,
    massimo2 REAL,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE paziente_questionari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paziente_id INTEGER NOT NULL REFERENCES pazienti(id) ON DELETE CASCADE,
    questionario_id INTEGER NOT NULL REFERENCES questionari(id),
    data TEXT NOT NULL,
    fascia TEXT,
    note TEXT
  );

  CREATE TABLE questionario_risposte (
    compilazione_id INTEGER NOT NULL REFERENCES paziente_questionari(id) ON DELETE CASCADE,
    domanda_id INTEGER NOT NULL REFERENCES questionario_domande(id),
    valore REAL NOT NULL,
    PRIMARY KEY (compilazione_id, domanda_id)
  );

  CREATE TABLE compilazione_punteggi (
    compilazione_id INTEGER NOT NULL REFERENCES paziente_questionari(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    valore REAL NOT NULL,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX idx_domande_questionario ON questionario_domande(questionario_id);
  CREATE INDEX idx_opzioni_domanda ON questionario_opzioni(domanda_id);
  CREATE INDEX idx_paziente_questionari_paziente ON paziente_questionari(paziente_id);
  `,

  // 7 — test di valutazione da letteratura (es. Drop Jump): la scheda con
  //     protocollo, immagine e link, i parametri di setup e le misure. Una
  //     misura si registra a ogni prova oppure una volta sola per il test; il
  //     valore confrontato col cutoff e' la prova migliore, la media o la
  //     peggiore, a seconda di come e' definita la misura.
  `
  CREATE TABLE test_valutazione (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    descrizione TEXT,
    protocollo TEXT,
    link TEXT,
    immagine TEXT,
    prove INTEGER NOT NULL DEFAULT 3,
    ordine INTEGER NOT NULL DEFAULT 0,
    archiviato INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE test_parametri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NULL REFERENCES test_valutazione(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    valore TEXT,
    unita TEXT,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE test_misure (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NULL REFERENCES test_valutazione(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    unita TEXT,
    per_prova INTEGER NOT NULL DEFAULT 1,
    riassunto TEXT NOT NULL DEFAULT 'migliore',
    cutoff REAL,
    cutoff_direzione TEXT,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX idx_test_parametri_test ON test_parametri(test_id);
  CREATE INDEX idx_test_misure_test ON test_misure(test_id);
  `,

  // 8 — categorie dei questionari (rachide, ginocchio...). I questionari gia'
  //     esistenti finiscono in una categoria "Generale", creata solo se
  //     servono, cosi' nessuno resta senza.
  `
  CREATE TABLE questionario_categorie (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  ALTER TABLE questionari ADD COLUMN categoria_id INTEGER
    REFERENCES questionario_categorie(id) ON DELETE CASCADE;

  INSERT INTO questionario_categorie (nome, ordine)
    SELECT 'Generale', 0 WHERE EXISTS (SELECT 1 FROM questionari);

  UPDATE questionari
    SET categoria_id = (SELECT id FROM questionario_categorie WHERE nome = 'Generale');

  CREATE INDEX idx_questionari_categoria ON questionari(categoria_id);
  `,

  // 9 — categorie dei test di valutazione (es. Test di salto). Come per i
  //     questionari, quelli gia' esistenti finiscono in "Generale".
  `
  CREATE TABLE test_categorie (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  ALTER TABLE test_valutazione ADD COLUMN categoria_id INTEGER
    REFERENCES test_categorie(id) ON DELETE CASCADE;

  INSERT INTO test_categorie (nome, ordine)
    SELECT 'Generale', 0 WHERE EXISTS (SELECT 1 FROM test_valutazione);

  UPDATE test_valutazione
    SET categoria_id = (SELECT id FROM test_categorie WHERE nome = 'Generale');

  CREATE INDEX idx_test_categoria ON test_valutazione(categoria_id);
  `,

  // 10 — patologie ordinabili a mano (ordine iniziale = alfabetico), come le
  //      categorie degli esercizi
  `
  ALTER TABLE patologie ADD COLUMN ordine INTEGER NOT NULL DEFAULT 0;
  UPDATE patologie SET ordine = (SELECT COUNT(*) FROM patologie p2 WHERE p2.nome < patologie.nome);
  `,

  // 11 — dati anagrafici del paziente. Niente indirizzo, comune, codice fiscale
  //      o partita IVA: quelli stanno nel gestionale delle fatture. L'eta' non
  //      si memorizza, si calcola dalla data di nascita (altrimenti invecchia).
  //      La diagnosi e' testo libero e resta distinta dalla patologia, che e'
  //      invece la scelta del percorso di cura.
  `
  ALTER TABLE pazienti ADD COLUMN data_nascita TEXT;
  ALTER TABLE pazienti ADD COLUMN telefono TEXT;
  ALTER TABLE pazienti ADD COLUMN email TEXT;
  ALTER TABLE pazienti ADD COLUMN lavoro TEXT;
  ALTER TABLE pazienti ADD COLUMN inviato_da TEXT;
  ALTER TABLE pazienti ADD COLUMN diagnosi TEXT;
  `,

  // 12 — body chart: dove e come il paziente sente il dolore. Ogni segno e' un
  //      dato a se' (tipo, posizione, dimensione, intensita'), non un disegno
  //      appiattito: cosi' si puo' modificare e confrontare nel tempo. Le
  //      coordinate sono frazioni 0..1 del riquadro della figura, quindi non
  //      dipendono da quanto e' grande sullo schermo.
  `
  CREATE TABLE body_chart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paziente_id INTEGER NOT NULL REFERENCES pazienti(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    note TEXT
  );

  CREATE TABLE body_chart_segni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chart_id INTEGER NOT NULL REFERENCES body_chart(id) ON DELETE CASCADE,
    vista TEXT NOT NULL,
    tipo TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    dimensione REAL NOT NULL DEFAULT 1,
    intensita INTEGER,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX idx_body_chart_paziente ON body_chart(paziente_id);
  CREATE INDEX idx_body_chart_segni_chart ON body_chart_segni(chart_id);
  `,

  // 13 - anamnesi prossima. Quasi tutte le domande del colloquio si ripetono
  //      per ogni sintomo, percio' i sintomi sono righe con un id proprio e non
  //      caselle di testo: i grafici dell'andamento (24 ore ed esordio) si
  //      aggancieranno a questi. Le domande sul quadro generale stanno invece
  //      sulla riga del paziente. Nessun campo e' obbligatorio: durante il
  //      colloquio si compila in qualsiasi ordine.
  `
  CREATE TABLE anamnesi_prossima (
    paziente_id INTEGER PRIMARY KEY REFERENCES pazienti(id) ON DELETE CASCADE,
    motivo_consulto TEXT,
    dolore_notturno TEXT,
    disturbi_sonno TEXT,
    tosse_starnuto TEXT,
    sintomi_neurologici TEXT,
    relazione_sintomi TEXT,
    note TEXT
  );

  CREATE TABLE anamnesi_sintomi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paziente_id INTEGER NOT NULL REFERENCES pazienti(id) ON DELETE CASCADE,
    descrizione TEXT,
    andamento TEXT,
    da_quanto TEXT,
    episodio TEXT,
    esordio TEXT,
    traumatico INTEGER,
    comportamento TEXT,
    aggrava TEXT,
    allevia TEXT,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX idx_anamnesi_sintomi_paziente ON anamnesi_sintomi(paziente_id);
  `,

  // 14 - andamento dei sintomi, attivita' e partecipazione, anamnesi remota.
  //      I punti dei due grafici sono agganciati al sintomo, non al paziente:
  //      ogni sintomo ha la sua linea. Nel grafico delle 24 ore il tempo sono
  //      minuti dalla mezzanotte; in quello dall'esordio e' una data vera, cosi'
  //      un punto aggiunto fra mesi si colloca da solo al posto giusto.
  `
  ALTER TABLE anamnesi_prossima ADD COLUMN note_giorno TEXT;
  ALTER TABLE anamnesi_prossima ADD COLUMN note_esordio TEXT;

  CREATE TABLE sintomo_punti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sintomo_id INTEGER NOT NULL REFERENCES anamnesi_sintomi(id) ON DELETE CASCADE,
    grafico TEXT NOT NULL,
    minuti INTEGER,
    data TEXT,
    dolore REAL NOT NULL
  );

  CREATE TABLE anamnesi_attivita (
    paziente_id INTEGER PRIMARY KEY REFERENCES pazienti(id) ON DELETE CASCADE,
    attivita TEXT,
    partecipazione TEXT,
    fattori_interni TEXT
  );

  CREATE TABLE anamnesi_remota (
    paziente_id INTEGER PRIMARY KEY REFERENCES pazienti(id) ON DELETE CASCADE,
    traumi TEXT,
    interventi TEXT,
    riabilitazioni TEXT,
    bioimmagini_note TEXT,
    peso INTEGER,
    febbre INTEGER,
    sudorazione INTEGER,
    nausea INTEGER,
    fumo INTEGER,
    neoplasie INTEGER,
    gravidanza INTEGER,
    pacemaker INTEGER,
    schegge INTEGER
  );

  CREATE TABLE bioimmagini (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paziente_id INTEGER NOT NULL REFERENCES pazienti(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    contenuto TEXT NOT NULL,
    data TEXT NOT NULL,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX idx_sintomo_punti_sintomo ON sintomo_punti(sintomo_id);
  CREATE INDEX idx_bioimmagini_paziente ON bioimmagini(paziente_id);
  `,

  // 15 - valutazione obiettiva. Movimenti e test appartengono al distretto, non
  //      alla patologia: il rachide cervicale ruota comunque, qualunque sia la
  //      diagnosi. Cosi' si scrivono una volta sola invece che in ogni
  //      patologia del collo. Alla patologia si collegano i distretti abituali,
  //      che diventano la preselezione all'apertura della valutazione.
  `
  CREATE TABLE distretti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE distretto_movimenti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distretto_id INTEGER NOT NULL REFERENCES distretti(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE distretto_test (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distretto_id INTEGER NOT NULL REFERENCES distretti(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    gruppo TEXT NOT NULL,
    risposta TEXT NOT NULL,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE patologia_distretti (
    patologia_id INTEGER NOT NULL REFERENCES patologie(id) ON DELETE CASCADE,
    distretto_id INTEGER NOT NULL REFERENCES distretti(id) ON DELETE CASCADE,
    PRIMARY KEY (patologia_id, distretto_id)
  );

  CREATE TABLE valutazioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paziente_id INTEGER NOT NULL REFERENCES pazienti(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    ispezione TEXT,
    note TEXT,
    carico_locale TEXT,
    carico_generale TEXT,
    capacita_locale TEXT,
    capacita_generale TEXT
  );

  CREATE TABLE valutazione_distretti (
    valutazione_id INTEGER NOT NULL REFERENCES valutazioni(id) ON DELETE CASCADE,
    distretto_id INTEGER NOT NULL REFERENCES distretti(id) ON DELETE CASCADE,
    PRIMARY KEY (valutazione_id, distretto_id)
  );

  CREATE TABLE valutazione_movimenti (
    valutazione_id INTEGER NOT NULL REFERENCES valutazioni(id) ON DELETE CASCADE,
    movimento_id INTEGER NOT NULL REFERENCES distretto_movimenti(id) ON DELETE CASCADE,
    attivo_restrizione INTEGER,
    attivo_dolore INTEGER,
    passivo_restrizione INTEGER,
    passivo_dolore INTEGER,
    nota TEXT,
    PRIMARY KEY (valutazione_id, movimento_id)
  );

  CREATE TABLE valutazione_test (
    valutazione_id INTEGER NOT NULL REFERENCES valutazioni(id) ON DELETE CASCADE,
    test_id INTEGER NOT NULL REFERENCES distretto_test(id) ON DELETE CASCADE,
    valore TEXT,
    nota TEXT,
    PRIMARY KEY (valutazione_id, test_id)
  );

  CREATE INDEX idx_movimenti_distretto ON distretto_movimenti(distretto_id);
  CREATE INDEX idx_test_distretto ON distretto_test(distretto_id);
  CREATE INDEX idx_valutazioni_paziente ON valutazioni(paziente_id);
  `,

  // 16 - gradi di movimento, ma solo dove hanno senso: si segna sul movimento
  //      della libreria se va misurato, e in valutazione compaiono le due
  //      caselle. Cosi' la tabella si allarga solo per i distretti che lo
  //      richiedono, invece che per tutti.
  `
  ALTER TABLE distretto_movimenti ADD COLUMN gradi INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE valutazione_movimenti ADD COLUMN attivo_gradi REAL;
  ALTER TABLE valutazione_movimenti ADD COLUMN passivo_gradi REAL;
  `,

  // 17 - obiettivi terapeutici concordati col paziente. Il termine (breve,
  //      medio, lungo) e' una colonna e non tre tabelle: un obiettivo cambia
  //      spesso di respiro durante il percorso, e cosi' basta cambiare la voce
  //      nel menu invece di riscriverlo. L'ordine e' uno solo per paziente:
  //      l'elenco si mostra raggruppato per termine, e dentro ogni gruppo si
  //      trascina.
  `
  CREATE TABLE obiettivi_terapeutici (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paziente_id INTEGER NOT NULL REFERENCES pazienti(id) ON DELETE CASCADE,
    testo TEXT NOT NULL,
    termine TEXT NOT NULL DEFAULT 'breve',
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX idx_obiettivi_terapeutici_paziente
    ON obiettivi_terapeutici(paziente_id);
  `,

  // 18 - follow-up. Quattro colonne sul paziente invece di una tabella a
  //      parte: di ognuno interessa una cosa sola alla volta — quando
  //      risentirlo — e non lo storico di tutti i contatti. Lo stato lo decide
  //      il fisioterapista e non si ricava dalle sedute: una pausa per ferie
  //      non e' una fine del trattamento.
  `
  ALTER TABLE pazienti ADD COLUMN stato TEXT NOT NULL DEFAULT 'trattamento';
  ALTER TABLE pazienti ADD COLUMN follow_up_il TEXT;
  ALTER TABLE pazienti ADD COLUMN contattato_il TEXT;
  ALTER TABLE pazienti ADD COLUMN recensione INTEGER NOT NULL DEFAULT 0;
  `,

  // 19 - screening off season. Un protocollo non contiene test propri: pesca
  //      da quelli gia' scritti nella libreria (e dai questionari), li ordina e
  //      li raggruppa in sezioni. Cosi' un test si scrive una volta sola e i
  //      suoi risultati restano confrontabili, che lo si esegua dentro uno
  //      screening o da solo.
  //
  //      Le sezioni sono libere: "In ambulatorio" e "In campo" sono solo la
  //      proposta di partenza, ma chi vuole dividere per qualita' (forza,
  //      salti, sprint) lo fa senza cambiare niente.
  //
  //      per_lato sulla libreria: i test monopodalici (hop, single leg CMJ,
  //      dinamometro d'anca) si registrano destra e sinistra, e da li' nasce
  //      l'asimmetria. Un test bilaterale ha un valore solo.
  `
  ALTER TABLE test_valutazione ADD COLUMN per_lato INTEGER NOT NULL DEFAULT 0;

  CREATE TABLE screening_protocolli (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    sport TEXT NOT NULL,
    note TEXT,
    ordine INTEGER NOT NULL DEFAULT 0,
    archiviato INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE screening_sezioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    protocollo_id INTEGER NOT NULL REFERENCES screening_protocolli(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  -- Una voce e' un test della libreria oppure un questionario, mai tutti e due
  -- e mai nessuno dei due.
  CREATE TABLE screening_voci (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sezione_id INTEGER NOT NULL REFERENCES screening_sezioni(id) ON DELETE CASCADE,
    test_id INTEGER REFERENCES test_valutazione(id) ON DELETE CASCADE,
    questionario_id INTEGER REFERENCES questionari(id) ON DELETE CASCADE,
    ordine INTEGER NOT NULL DEFAULT 0,
    CHECK ((test_id IS NULL) <> (questionario_id IS NULL))
  );

  CREATE INDEX idx_screening_sezioni_protocollo
    ON screening_sezioni(protocollo_id);
  CREATE INDEX idx_screening_voci_sezione ON screening_voci(sezione_id);
  `,

  // 20 - screening eseguiti. Una sessione e' un protocollo somministrato a un
  //      paziente in una data; i valori sono righe, non colonne, perche' ogni
  //      test ha misure sue e un numero di prove suo.
  //
  //      lato: 'dx' o 'sx' per i test monopodalici, NULL per i bilaterali.
  //      prova: il numero della ripetizione (1, 2, 3...) per le misure che si
  //      registrano a ogni prova, NULL per quelle che si prendono una volta
  //      sola. Il protocollo resta collegato: se lo si cancella, gli screening
  //      gia' fatti restano leggibili con i loro valori.
  `
  CREATE TABLE screening_sessioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paziente_id INTEGER NOT NULL REFERENCES pazienti(id) ON DELETE CASCADE,
    protocollo_id INTEGER REFERENCES screening_protocolli(id) ON DELETE SET NULL,
    protocollo_nome TEXT NOT NULL,
    sport TEXT NOT NULL,
    data TEXT NOT NULL,
    note TEXT
  );

  CREATE TABLE screening_valori (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessione_id INTEGER NOT NULL REFERENCES screening_sessioni(id) ON DELETE CASCADE,
    misura_id INTEGER NOT NULL REFERENCES test_misure(id) ON DELETE CASCADE,
    lato TEXT,
    prova INTEGER,
    valore REAL NOT NULL
  );

  -- Il questionario di uno screening e' una compilazione normale: qui si tiene
  -- solo il collegamento, cosi' resta anche nello storico del paziente.
  CREATE TABLE screening_questionari (
    sessione_id INTEGER NOT NULL REFERENCES screening_sessioni(id) ON DELETE CASCADE,
    questionario_id INTEGER NOT NULL REFERENCES questionari(id) ON DELETE CASCADE,
    compilazione_id INTEGER REFERENCES paziente_questionari(id) ON DELETE SET NULL,
    PRIMARY KEY (sessione_id, questionario_id)
  );

  CREATE INDEX idx_screening_sessioni_paziente ON screening_sessioni(paziente_id);
  CREATE INDEX idx_screening_valori_sessione ON screening_valori(sessione_id);
  `,

  // 21 - quello che serve a leggere davvero un confronto fra i due arti.
  //
  //      arto_operato sul paziente: senza, il rapporto e' solo destra/sinistra.
  //      Sapendo qual e' l'arto operato diventa operato ÷ sano, che e' l'LSI, e
  //      il verso ha un significato clinico. Sta sul paziente e non sul singolo
  //      screening perche' non cambia da una volta all'altra.
  //
  //      lsi_cutoff sul test: e' una soglia sul rapporto (90%, 95%), cosa
  //      diversa dal cutoff della misura, che si confronta col valore misurato.
  //      Servono tutti e due e non possono stare nello stesso campo.
  //
  //      calcolo sulla misura: alcune misure non si misurano, si ricavano da
  //      altre due dello stesso test (l'EUR e' CMJ diviso Squat Jump). Le fonti
  //      sono misure gia' salvate, quindi si citano per id.
  `
  ALTER TABLE pazienti ADD COLUMN arto_operato TEXT;
  ALTER TABLE test_valutazione ADD COLUMN lsi_cutoff REAL;
  ALTER TABLE test_misure ADD COLUMN calcolo TEXT;
  ALTER TABLE test_misure ADD COLUMN calcolo_a INTEGER
    REFERENCES test_misure(id) ON DELETE SET NULL;
  ALTER TABLE test_misure ADD COLUMN calcolo_b INTEGER
    REFERENCES test_misure(id) ON DELETE SET NULL;
  `,

  // 22 - valore normativo della misura, facoltativo. E' cosa diversa dal
  //      cutoff: il cutoff dice se il test e' superato, questo e' solo la riga
  //      di riferimento nei grafici dell'andamento. Sta separato perche' una
  //      soglia di passaggio e un valore atteso di popolazione non sono la
  //      stessa cosa, e chi non ha valori normativi lascia il campo vuoto.
  `
  ALTER TABLE test_misure ADD COLUMN riferimento REAL;
  `,

  // 23 - tipi di body chart. Oltre al corpo intero servono figure mirate a una
  //      zona (per ora il piede e la caviglia): stesso modo di segnare, viste
  //      diverse. Le body chart gia' salvate sono tutte del corpo intero.
  `
  ALTER TABLE body_chart ADD COLUMN tipo TEXT NOT NULL DEFAULT 'corpo';
  `,

  // 24 - una nota per il movimento attivo e una per il passivo, per ogni
  //      distretto della valutazione: quello che si annota ("in inclinazione a
  //      destra tira a sinistra") riguarda l'insieme dei movimenti provati, non
  //      il singolo movimento. Stanno sulla riga del distretto perche' una
  //      valutazione puo' comprenderne piu' d'uno.
  `
  ALTER TABLE valutazione_distretti ADD COLUMN nota_attivo TEXT;
  ALTER TABLE valutazione_distretti ADD COLUMN nota_passivo TEXT;
  `,

  // 25 - bozza della seduta in costruzione. Una sola per paziente: il
  //      costruttore e' aperto su un paziente per volta. Sta nel database, e
  //      non in un file a parte, perche' contiene quello che si sta scrivendo
  //      per una persona: deve essere cifrato e finire nelle copie come il
  //      resto. Si cancella appena la seduta viene salvata.
  `
  CREATE TABLE bozze_seduta (
    paziente_id INTEGER PRIMARY KEY REFERENCES pazienti(id) ON DELETE CASCADE,
    aggiornata_il TEXT NOT NULL,
    contenuto TEXT NOT NULL
  );
  `,

  // 26 - cestino. Quello che si elimina non sparisce subito: se ne mette da
  //      parte una fotografia (la riga e tutto quello che le sta appeso, in
  //      JSON) e la si puo' rimettere dov'era. Si svuota da solo dopo un mese.
  //      Non ha vincoli verso le altre tabelle: e' una copia, non un
  //      collegamento, e deve sopravvivere alla riga che descrive.
  `
  CREATE TABLE cestino (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    etichetta TEXT NOT NULL,
    quando TEXT NOT NULL,
    contenuto TEXT NOT NULL
  );
  `,

  // 27 - dosaggio a cluster. La serie si spezza in piccoli blocchi con una
  //      pausa breve dentro: "4 x (3 x 2)" con 15" tra i cluster e 2' tra le
  //      serie. Serve solo dove ha senso (la pliometria estensiva), percio' la
  //      categoria decide se i campi si vedono: senza la spunta, gli esercizi
  //      di quella categoria restano come sono sempre stati.
  //
  //      Le colonne che c'erano tengono il loro significato — serie resta
  //      serie, ripetizioni diventa "ripetizioni per cluster" — e se ne
  //      aggiungono due: quanti cluster per serie, e la pausa tra i cluster.
  `
  ALTER TABLE categorie ADD COLUMN dosaggio_cluster INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE esercizi ADD COLUMN cluster_default TEXT;
  ALTER TABLE esercizi ADD COLUMN recupero_cluster_default TEXT;
  ALTER TABLE seduta_esercizi ADD COLUMN cluster TEXT;
  ALTER TABLE seduta_esercizi ADD COLUMN recupero_cluster TEXT;
  `,

  // 28 - unita' di misura del carico, una per esercizio. La panca si carica in
  //      kg, il plank si tiene in secondi, l'elastico ha un colore: l'unita'
  //      giusta la sa l'esercizio, non l'app. Nella casella del carico si
  //      scrive solo il numero e l'unita' si aggiunge da sola quando la scheda
  //      si legge o si stampa. Le sedute non se la portano dietro: la leggono
  //      dall'esercizio, cosi' correggendola si sistemano anche le vecchie.
  `
  ALTER TABLE esercizi ADD COLUMN unita_carico TEXT;
  `,

  // 29 - le altre patologie del paziente, nell'anamnesi remota. Diabete,
  //      ipertensione, tiroide, artrite: non c'entrano con il motivo per cui e'
  //      venuto, ma cambiano come lo si tratta, e finora finivano schiacciate
  //      dentro "incidenti e traumi". Sta come primo campo perche' e' la prima
  //      cosa che si chiede.
  `
  ALTER TABLE anamnesi_remota ADD COLUMN patologie TEXT;
  `,

  // 30 - le aspettative del paziente, in cima agli obiettivi terapeutici. Gli
  //      obiettivi sono cose misurabili concordate a due; questo e' quello che
  //      il paziente si aspetta con parole sue, che e' il punto di partenza del
  //      colloquio e spesso spiega perche' un obiettivo e' quello e non un
  //      altro. Sta sul paziente, non su una fase o una seduta: non cambia da
  //      un giorno all'altro.
  `
  ALTER TABLE pazienti ADD COLUMN aspettative TEXT;
  `,

  // 31 - il percorso al campo. Chi si opera di crociato lavora su due binari
  //      in parallelo: tre giorni in palestra e uno sul campo, con una
  //      struttura di seduta diversa. Le fasi del campo (Campo 4 mesi, 6, 9)
  //      stanno nella stessa patologia — il campo fa parte di quel percorso —
  //      ma in un elenco a parte: cosi' "avanza di fase" continua a passare da
  //      Intermedia ad Avanzata e non propone mai un campo, e la fase corrente
  //      del paziente resta quella di palestra.
  //
  //      L'interruttore sta sulla PATOLOGIA, non sulla singola fase: le
  //      patologie che vanno al campo sono poche, e cosi' tutte le altre non
  //      vedono mai la parola "campo". Una fase e' del campo per l'elenco in
  //      cui la crei, non perche' qualcuno te lo chiede.
  `
  ALTER TABLE patologie ADD COLUMN ha_campo INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE fasi ADD COLUMN campo INTEGER NOT NULL DEFAULT 0;
  `,

  // 32 - il focus della seduta. Due sedute della stessa fase possono essere
  //      due giornate diverse ("preparazione corsa", "salti", "potenza"), e
  //      nell'elenco si distinguevano solo dalla data. E' testo libero e non
  //      un elenco da configurare: cambia da paziente a paziente, e chi lo
  //      scrive lo sceglie sul momento — l'app suggerisce quelli gia' usati.
  `
  ALTER TABLE sedute ADD COLUMN focus TEXT;
  `,

  // 33 - come e' andata la seduta: il dolore e lo sforzo percepito, da 0 a 10.
  //      Due numeri e non una frase nelle note, perche' il senso e' poterli
  //      confrontare: sapere che oggi il dolore e' 3 dove un mese fa era 7 e'
  //      un dato clinico, "andava meglio" no. Restano vuoti se non li si
  //      compila: non tutte le sedute vanno misurate.
  `
  ALTER TABLE sedute ADD COLUMN dolore INTEGER;
  ALTER TABLE sedute ADD COLUMN sforzo INTEGER;
  `,

  // 34 - chi firma i fogli. Nome, qualifica e contatti di chi lavora con
  //      l'app: finiscono in cima a tutto quello che si stampa, che prima
  //      usciva anonimo. Una riga sola, sempre quella (il vincolo su id lo
  //      garantisce). Sta nel database e non nel file delle impostazioni
  //      perche' cosi' segue le copie di sicurezza: rimettendo l'archivio su
  //      un altro computer l'intestazione c'e' ancora.
  `
  CREATE TABLE profilo (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nome TEXT,
    qualifica TEXT,
    studio TEXT,
    indirizzo TEXT,
    telefono TEXT,
    email TEXT
  );
  INSERT INTO profilo (id) VALUES (1);
  `,

  // 35 - i segni di riferimento e le precauzioni.
  //
  //      I segni sono le due o tre cose che di quel paziente si ricontrollano
  //      a ogni seduta ("dolore nello squat", "flessione del ginocchio"): un
  //      numero, sempre lo stesso, che dice se la strada e' giusta. Sono del
  //      paziente e non della patologia, perche' si scelgono guardando lui.
  //      Il valore sta appeso alla seduta in cui l'hai misurato: cosi' segue
  //      la seduta se la si elimina, e la data non va scritta due volte.
  //
  //      Le precauzioni sono i limiti da non superare ("non oltre 90° di
  //      flessione fino a 6 settimane"). Stanno in un campo loro e non nelle
  //      note perche' devono comparire in cima alla scheda e mentre componi la
  //      seduta: una nota che va riletta non serve a niente.
  `
  ALTER TABLE pazienti ADD COLUMN precauzioni TEXT;

  CREATE TABLE segni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paziente_id INTEGER NOT NULL REFERENCES pazienti(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    unita TEXT,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE segno_valori (
    segno_id INTEGER NOT NULL REFERENCES segni(id) ON DELETE CASCADE,
    seduta_id INTEGER NOT NULL REFERENCES sedute(id) ON DELETE CASCADE,
    valore REAL NOT NULL,
    PRIMARY KEY (segno_id, seduta_id)
  );
  `,

  // 36 - le indicazioni per casa e i numeri dell'atleta.
  //
  //      Al foglio che il paziente si porta a casa manca la parte che decide
  //      se lo fara' bene: quante volte a settimana, e come regolarsi con il
  //      dolore. Le frasi stanno in un elenco unico (si scrivono una volta e
  //      si riusano), e per ogni paziente si spunta quali valgono per lui.
  //
  //      I massimali servono a prescrivere il carico in percentuale nella fase
  //      di forza. Sono una riga per esercizio con la data, perche' cambiano;
  //      peso e altezza invece stanno sul paziente, sono una cosa sola.
  `
  ALTER TABLE pazienti ADD COLUMN frequenza_casa TEXT;
  ALTER TABLE pazienti ADD COLUMN peso REAL;
  ALTER TABLE pazienti ADD COLUMN altezza REAL;

  CREATE TABLE indicazioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    testo TEXT NOT NULL,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE paziente_indicazioni (
    paziente_id INTEGER NOT NULL REFERENCES pazienti(id) ON DELETE CASCADE,
    indicazione_id INTEGER NOT NULL REFERENCES indicazioni(id) ON DELETE CASCADE,
    PRIMARY KEY (paziente_id, indicazione_id)
  );

  CREATE TABLE massimali (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paziente_id INTEGER NOT NULL REFERENCES pazienti(id) ON DELETE CASCADE,
    esercizio TEXT NOT NULL,
    valore REAL NOT NULL,
    unita TEXT,
    data TEXT NOT NULL
  );

  -- Qualche indicazione gia' pronta: sono quelle che si scrivono sempre, e
  -- cosi' l'elenco non parte vuoto. Si cambiano e si cancellano.
  INSERT INTO indicazioni (testo, ordine) VALUES
    ('Puoi accettare un dolore fino a 4 su 10 durante gli esercizi.', 0),
    ('Fermati alla comparsa del dolore.', 1),
    ('Se il dolore resta il giorno dopo, riduci il carico e riprendi.', 2),
    ('Esegui i movimenti lentamente e in controllo, senza slanci.', 3),
    ('Se compare gonfiore, ghiaccio e riposo, e sentimi.', 4);
  `,

  // 37 - il RIR, le ripetizioni che restano in canna.
  //
  //      "4 x 8 con 2 ripetizioni di riserva" dice quanto e' pesante la serie
  //      meglio di quanto lo dica il carico da solo, e serve anche a stimare il
  //      massimale senza andare a cercarlo.
  //
  //      La spunta sta sulla categoria, come per il cluster: ha senso nella
  //      forza e non nella mobilita', e le categorie che non ce l'hanno non si
  //      ritrovano una casella in piu' nella riga della seduta.
  `
  ALTER TABLE categorie ADD COLUMN dosaggio_rir INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE esercizi ADD COLUMN rir_default TEXT;
  ALTER TABLE seduta_esercizi ADD COLUMN rir TEXT;
  `,

  // 38 - i questionari: i nomi degli estremi della scala e il cambiamento che
  //      conta.
  //
  //      In una scala numerica "0" e "10" da soli non vogliono dire niente: chi
  //      risponde deve leggere da che parte sta il male ("nessun dolore" /
  //      "il peggiore che si possa immaginare"). Sono due etichette per
  //      domanda, e restano vuote dove non servono.
  //
  //      Il MCID e' il cambiamento minimo che il paziente sente come un
  //      miglioramento vero. Sta sul questionario perche' e' una proprieta' di
  //      quel questionario, non del paziente: si scrive una volta, prendendola
  //      dalla letteratura, e da li' in poi l'app sa dire se la differenza fra
  //      due compilazioni conta davvero. Puo' essere in punti, in percentuale o
  //      tutte e due: alcuni questionari danno la soglia in tutti e due i modi
  //      perche' partire da 60 su 70 o da 20 su 70 non e' la stessa cosa.
  `
  ALTER TABLE questionario_domande ADD COLUMN etichetta_min TEXT;
  ALTER TABLE questionario_domande ADD COLUMN etichetta_max TEXT;

  ALTER TABLE questionari ADD COLUMN mcid_punteggio_id INTEGER
    REFERENCES questionario_punteggi(id) ON DELETE SET NULL;
  ALTER TABLE questionari ADD COLUMN mcid_punti REAL;
  ALTER TABLE questionari ADD COLUMN mcid_percentuale REAL;
  -- 1 = il paziente migliora quando il punteggio scende (dolore, disabilita');
  -- 0 = migliora quando sale (funzione, qualita' della vita).
  ALTER TABLE questionari ADD COLUMN mcid_migliora_calando INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE questionari ADD COLUMN mcid_nota TEXT;
  `
]

export function runMigrations(db: Database.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number
  for (let i = current; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[i])
      db.pragma(`user_version = ${i + 1}`)
    })()
  }
}
