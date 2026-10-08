import type Database from 'better-sqlite3-multiple-ciphers'

// Ogni voce è una migrazione; l'indice + 1 corrisponde a PRAGMA user_version.
// Mai modificare una migrazione già rilasciata: aggiungerne una nuova in coda.
export const MIGRATIONS: string[] = [
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
  `,

  // 39 - i distretti dentro alle categorie degli esercizi.
  //
  //      Scrivere "Rinforzo quadricipite", "Rinforzo ischiocrurali", "Rinforzo
  //      spalla" una accanto all'altra fa venti categorie in fila, e trovarne
  //      una diventa un lavoro. Con un livello in mezzo "Rinforzo" si scrive
  //      una volta sola e dentro ci stanno i distretti.
  //
  //      Un solo livello di profondita': una categoria puo' stare dentro a una
  //      categoria che non sta dentro a nessuno. Piu' giu' non serve, e un
  //      albero senza fondo sarebbe solo piu' difficile da leggere.
  //
  //      Le categorie di adesso restano com'erano, senza padre: le fasi gia'
  //      configurate continuano a proporre esattamente gli stessi esercizi.
  `
  ALTER TABLE categorie ADD COLUMN padre_id INTEGER
    REFERENCES categorie(id) ON DELETE SET NULL;
  `,

  // 40 - cosa valuta un test: forza, reattivita', equilibrio...
  //
  //      Serve al riassunto scritto del report dello screening, che raggruppa
  //      i risultati per qualita' ("deficit di forza sul lato operato") invece
  //      di elencarli test per test. E' testo libero: chi non lo scrive vede
  //      il test raggruppato sotto al suo nome.
  `
  ALTER TABLE test_valutazione ADD COLUMN qualita TEXT;
  `,

  // 41 - anamnesi prossima con piu' scelte e meno testo libero, perche' la
  //      relazione scritta possa dire le cose giuste.
  //
  //      Dolore notturno e disturbi del sonno diventano si'/no: la casella di
  //      testo che c'era resta, per il dettaglio. La durata si segna con un
  //      numero e un'unita' (da li' si ricava acuto, subacuto o cronico), e il
  //      testo libero resta per quello che non sta in un numero. L'esordio
  //      improvviso o graduale si aggiunge a traumatico o no, e l'intensita' del
  //      dolore si segna sulla scala da 0 a 10: attuale, peggiore, migliore.
  //
  //      I dati gia' scritti non si toccano: le colonne nuove partono vuote.
  `
  ALTER TABLE anamnesi_prossima ADD COLUMN notturno_sn INTEGER;
  ALTER TABLE anamnesi_prossima ADD COLUMN sonno_sn INTEGER;
  ALTER TABLE anamnesi_sintomi ADD COLUMN durata_numero REAL;
  ALTER TABLE anamnesi_sintomi ADD COLUMN durata_unita TEXT;
  ALTER TABLE anamnesi_sintomi ADD COLUMN esordio_modo TEXT;
  ALTER TABLE anamnesi_sintomi ADD COLUMN nprs_attuale INTEGER;
  ALTER TABLE anamnesi_sintomi ADD COLUMN nprs_peggiore INTEGER;
  ALTER TABLE anamnesi_sintomi ADD COLUMN nprs_migliore INTEGER;
  `,

  // 42 - destra e sinistra nella valutazione, e "nella norma".
  //
  //      I distretti che hanno un lato (ginocchio, spalla, anca...) si segnano
  //      nella libreria, e in valutazione ogni movimento e ogni test si rileva a
  //      destra e a sinistra: e' dal confronto con il lato sano che si capisce
  //      quanto manca. Per questo i rilievi prendono una colonna "lato": ''
  //      per i distretti senza lato e per tutto quello scritto finora, 'dx' e
  //      'sx' per gli altri. Il lato entra nella chiave, quindi le due tabelle
  //      si ricostruiscono copiando i dati come sono.
  //
  //      "norma" sul movimento: 1 = valutato e nella norma. Senza, un
  //      movimento lasciato vuoto non dice se era normale o non provato.
  //
  //      I sintomi neurologici diventano si'/no con il tipo (formicolio,
  //      intorpidimento, perdita di forza, dolore irradiato); la casella di
  //      testo resta per la sede e il dettaglio.
  `
  ALTER TABLE distretti ADD COLUMN bilaterale INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE anamnesi_prossima ADD COLUMN neuro_sn INTEGER;
  ALTER TABLE anamnesi_prossima ADD COLUMN neuro_tipi TEXT;

  CREATE TABLE valutazione_movimenti_nuova (
    valutazione_id INTEGER NOT NULL REFERENCES valutazioni(id) ON DELETE CASCADE,
    movimento_id INTEGER NOT NULL REFERENCES distretto_movimenti(id) ON DELETE CASCADE,
    lato TEXT NOT NULL DEFAULT '',
    attivo_restrizione INTEGER,
    attivo_dolore INTEGER,
    passivo_restrizione INTEGER,
    passivo_dolore INTEGER,
    nota TEXT,
    attivo_gradi REAL,
    passivo_gradi REAL,
    norma INTEGER,
    PRIMARY KEY (valutazione_id, movimento_id, lato)
  );
  INSERT INTO valutazione_movimenti_nuova
    (valutazione_id, movimento_id, lato, attivo_restrizione, attivo_dolore,
     passivo_restrizione, passivo_dolore, nota, attivo_gradi, passivo_gradi)
    SELECT valutazione_id, movimento_id, '', attivo_restrizione, attivo_dolore,
           passivo_restrizione, passivo_dolore, nota, attivo_gradi, passivo_gradi
    FROM valutazione_movimenti;
  DROP TABLE valutazione_movimenti;
  ALTER TABLE valutazione_movimenti_nuova RENAME TO valutazione_movimenti;

  CREATE TABLE valutazione_test_nuova (
    valutazione_id INTEGER NOT NULL REFERENCES valutazioni(id) ON DELETE CASCADE,
    test_id INTEGER NOT NULL REFERENCES distretto_test(id) ON DELETE CASCADE,
    lato TEXT NOT NULL DEFAULT '',
    valore TEXT,
    nota TEXT,
    PRIMARY KEY (valutazione_id, test_id, lato)
  );
  INSERT INTO valutazione_test_nuova (valutazione_id, test_id, lato, valore, nota)
    SELECT valutazione_id, test_id, '', valore, nota FROM valutazione_test;
  DROP TABLE valutazione_test;
  ALTER TABLE valutazione_test_nuova RENAME TO valutazione_test;
  `,

  // 43 - il punteggio del cluster.
  //
  //      Un protocollo di screening puo' dare un risultato: per ogni voce (una
  //      misura di un test, o il punteggio di un questionario) le soglie dei
  //      punti, e sul totale le fasce, come nei questionari (l'Ankle-GO e' il
  //      caso tipico). Sta sul protocollo e non sul test: lo stesso test puo'
  //      valere punti diversi in cluster diversi.
  //
  //      Le soglie di una voce sono una lista corta che si legge e si scrive
  //      sempre tutta insieme: stanno in una colonna sola, come testo JSON.
  //      lato: per i test a una gamba per volta, 'interessato' (il valore del
  //      lato interessato) o 'lsi' (la simmetria fra i due lati, in %).
  `
  CREATE TABLE screening_punteggio_regole (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    protocollo_id INTEGER NOT NULL REFERENCES screening_protocolli(id) ON DELETE CASCADE,
    misura_id INTEGER REFERENCES test_misure(id) ON DELETE CASCADE,
    punteggio_id INTEGER REFERENCES questionario_punteggi(id) ON DELETE CASCADE,
    lato TEXT,
    nome TEXT NOT NULL,
    soglie TEXT NOT NULL DEFAULT '[]',
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE screening_punteggio_fasce (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    protocollo_id INTEGER NOT NULL REFERENCES screening_protocolli(id) ON DELETE CASCADE,
    etichetta TEXT NOT NULL,
    minimo REAL,
    massimo REAL,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX idx_punteggio_regole_protocollo ON screening_punteggio_regole(protocollo_id);
  CREATE INDEX idx_punteggio_fasce_protocollo ON screening_punteggio_fasce(protocollo_id);
  `,

  // 44 - il diario della seduta: cosa riferisce il paziente e cosa gli si e'
  //      fatto.
  //
  //      Fino a qui tutto finiva nelle note. Il paziente torna e riferisce
  //      (meglio, uguale, peggio, e con parole sue), si fanno delle tecniche e
  //      poi gli esercizi: sono tre cose diverse, e nel diario vanno lette
  //      separate. Le tecniche sono un elenco del fisioterapista, come le
  //      indicazioni per casa: si scrivono una volta e si spuntano. Non si
  //      cancellano, si archiviano: le sedute vecchie devono continuare a dire
  //      cosa e' stato fatto.
  `
  ALTER TABLE sedute ADD COLUMN riferito_andamento TEXT;
  ALTER TABLE sedute ADD COLUMN riferito TEXT;
  ALTER TABLE sedute ADD COLUMN trattamento TEXT;

  CREATE TABLE tecniche (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    archiviata INTEGER NOT NULL DEFAULT 0,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE seduta_tecniche (
    seduta_id INTEGER NOT NULL REFERENCES sedute(id) ON DELETE CASCADE,
    tecnica_id INTEGER NOT NULL REFERENCES tecniche(id) ON DELETE CASCADE,
    PRIMARY KEY (seduta_id, tecnica_id)
  );

  INSERT INTO tecniche (nome, ordine) VALUES
    ('Terapia manuale', 0),
    ('Mobilizzazione articolare', 1),
    ('Massoterapia', 2),
    ('Tecar', 3),
    ('Dry needling', 4),
    ('Taping', 5),
    ('Crioterapia', 6);
  `,

  // 45 - "nella norma" per il movimento attivo e per il passivo, separati; il
  //      codice fiscale e la partita IVA di chi firma i fogli.
  //
  //      Fino a qui la spunta valeva per il movimento da quel lato, attivo e
  //      passivo insieme. Ma un movimento attivo limitato con il passivo
  //      completo e' proprio una delle cose che si vogliono scrivere. La
  //      colonna di prima resta quella dell'attivo; quella nuova parte uguale,
  //      perche' una spunta messa prima diceva nella norma tutti e due.
  `
  ALTER TABLE valutazione_movimenti ADD COLUMN passivo_norma INTEGER;
  UPDATE valutazione_movimenti SET passivo_norma = norma WHERE norma IS NOT NULL;

  ALTER TABLE profilo ADD COLUMN codice_fiscale TEXT;
  ALTER TABLE profilo ADD COLUMN partita_iva TEXT;
  `,

  // 46 - la tabella degli obiettivi della seduta non e' mai stata scritta (il
  //      diario e l'export la leggevano, ma restava sempre vuota): il modello
  //      voluto e' quello degli obiettivi raggiunti sul paziente
  //      (paziente_obiettivi), non uno per seduta. Codice morto, si toglie.
  `
  DROP TABLE seduta_obiettivi;
  `,

  // 47 - l'orario della seduta (facoltativo, formato HH:MM): la settimana si
  //      legge ordinata per appuntamento, non piu' per cognome del paziente.
  `
  ALTER TABLE sedute ADD COLUMN ora TEXT;
  `,

  // 48 - lo sport praticato (testo libero, con dentro anche il ruolo se
  //      c'e': "Calcio (portiere)"). Non e' un campo clinico, ma dice molto
  //      su carichi e gesti da riprodurre in palestra.
  `
  ALTER TABLE pazienti ADD COLUMN sport TEXT;
  `,

  // 49 - i gruppi dei pazienti: dove li segui (Centro, Studio, Domicilio...),
  //      configurabili come le patologie. Un paziente sta in un gruppo solo,
  //      facoltativo.
  `
  CREATE TABLE gruppi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  ALTER TABLE pazienti ADD COLUMN gruppo_id INTEGER REFERENCES gruppi(id);
  `,

  // 50 - l'esercizio "al volo": una variante inventata li' per li', che serve
  //      solo per quella seduta e non va salvata in libreria. La riga tiene il
  //      suo nome (nome_libero) invece di un rimando alla libreria: niente
  //      categoria, dosaggi di default, foto o link, che restano cose della
  //      libreria vera. Esattamente uno dei due tra esercizio_id e nome_libero
  //      e' valorizzato, mai tutti e due e mai nessuno dei due (come per
  //      test_id/questionario_id in screening_voci).
  //
  //      SQLite non permette di togliere un NOT NULL con ALTER COLUMN: si
  //      ricrea la tabella e si travasano i dati, come gia' fatto per
  //      valutazione_movimenti alla migrazione 42.
  `
  CREATE TABLE seduta_esercizi_nuova (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seduta_id INTEGER NOT NULL REFERENCES sedute(id) ON DELETE CASCADE,
    esercizio_id INTEGER REFERENCES esercizi(id),
    nome_libero TEXT,
    serie TEXT,
    ripetizioni TEXT,
    carico TEXT,
    nota TEXT,
    ordine INTEGER NOT NULL DEFAULT 0,
    recupero TEXT,
    seduta_sezione_id INTEGER REFERENCES seduta_sezioni(id) ON DELETE SET NULL,
    cluster TEXT,
    recupero_cluster TEXT,
    rir TEXT,
    CHECK ((esercizio_id IS NULL) <> (nome_libero IS NULL))
  );
  INSERT INTO seduta_esercizi_nuova
    (id, seduta_id, esercizio_id, serie, ripetizioni, carico, nota, ordine,
     recupero, seduta_sezione_id, cluster, recupero_cluster, rir)
    SELECT id, seduta_id, esercizio_id, serie, ripetizioni, carico, nota, ordine,
           recupero, seduta_sezione_id, cluster, recupero_cluster, rir
    FROM seduta_esercizi;
  DROP TABLE seduta_esercizi;
  ALTER TABLE seduta_esercizi_nuova RENAME TO seduta_esercizi;

  CREATE INDEX idx_seduta_esercizi_seduta ON seduta_esercizi(seduta_id);
  `,

  // 51 - tre indici che mancavano. Sono tutte ricerche che l'app fa di continuo
  //      (i valori dei segni di una seduta, i punteggi di un questionario, le
  //      sedute di un giorno o di un periodo): senza indice il database legge
  //      l'intera tabella, e con gli anni di sedute si sente.
  `
  CREATE INDEX IF NOT EXISTS idx_segno_valori_seduta ON segno_valori(seduta_id);
  CREATE INDEX IF NOT EXISTS idx_compilazione_punteggi_compilazione
    ON compilazione_punteggi(compilazione_id);
  CREATE INDEX IF NOT EXISTS idx_sedute_data ON sedute(data);
  `,

  // 52 - il certificato di presenza.
  //
  //      Serve il numero di iscrizione all'Ordine (OFI) di chi firma, che va
  //      nel profilo in Impostazioni, e il codice fiscale del paziente. Sono
  //      due caselle nuove, facoltative: chi non le compila non vede nessun
  //      cambiamento nei fogli di prima.
  `
  ALTER TABLE profilo ADD COLUMN numero_iscrizione TEXT;
  ALTER TABLE pazienti ADD COLUMN codice_fiscale TEXT;
  `,

  // 53 - scegliere se l'iscrizione all'Ordine compare sui fogli stampati.
  //
  //      Di partenza si': e' il comportamento che si era chiesto per le schede.
  //      Si spegne dal profilo, in Impostazioni.
  `
  ALTER TABLE profilo ADD COLUMN iscrizione_in_scheda INTEGER NOT NULL DEFAULT 1;
  `,

  // 54 - quante righe ha una voce del cestino.
  //
  //      L'elenco del cestino leggeva e interpretava il contenuto intero di ogni
  //      voce (con dentro anche i referti dei pazienti) solo per contare le righe.
  //      Adesso il numero si scrive quando la voce entra nel cestino. Le voci di
  //      prima restano senza (NULL): le completa la pulizia del cestino, a ogni
  //      accesso.
  `
  ALTER TABLE cestino ADD COLUMN righe INTEGER;
  `,

  // 55 - il punteggio salvato di una compilazione sa da quale punteggio del
  //      questionario viene.
  //
  //      Fino a qui si riconosceva solo dal nome: rinominare "Totale" in
  //      "Punteggio totale" faceva sparire il confronto con la prima volta (il
  //      cambiamento che conta), e il punteggio di un questionario dentro il
  //      cluster dello screening. Il nome resta, perche' e' come si chiamava
  //      quel giorno; l'id serve a ritrovarlo. Se il punteggio viene tolto dal
  //      questionario l'id diventa NULL e resta il nome.
  //
  //      Le compilazioni gia' fatte si agganciano per nome, dentro al loro
  //      questionario.
  `
  ALTER TABLE compilazione_punteggi ADD COLUMN punteggio_id INTEGER
    REFERENCES questionario_punteggi(id) ON DELETE SET NULL;

  UPDATE compilazione_punteggi SET punteggio_id = (
    SELECT qp.id FROM questionario_punteggi qp
    JOIN paziente_questionari pq ON pq.questionario_id = qp.questionario_id
    WHERE pq.id = compilazione_punteggi.compilazione_id
      AND qp.nome = compilazione_punteggi.nome
    ORDER BY qp.ordine, qp.id
    LIMIT 1
  );

  CREATE INDEX idx_compilazione_punteggi_punteggio ON compilazione_punteggi(punteggio_id);
  `,

  // 56 - i referti (foto e PDF) come dati binari invece che come testo.
  //
  //      Stavano nell'archivio come "data:...;base64,...": un terzo in piu' del
  //      file vero, in ogni copia di sicurezza. Ora la stessa colonna tiene i
  //      byte del file (SQLite lo permette anche a una colonna dichiarata TEXT:
  //      un valore binario resta binario). Restano dentro all'archivio cifrato,
  //      e quindi nelle copie. La conversione la fa la funzione da_data_url,
  //      registrata da runMigrations; quello che non e' un data URL resta com'e'
  //      (chi legge accetta tutte e due le forme, vedi referti.ts). Dopo questa
  //      migrazione l'archivio si compatta (VACUUM), per ridare lo spazio.
  `
  UPDATE bioimmagini SET contenuto = da_data_url(contenuto) WHERE typeof(contenuto) = 'text';
  `,

  // 57 - come si calcola un punteggio di questionario: somma (come sempre),
  //      percentuale del massimo, percentuale inversa, media. Vedi
  //      shared/punteggi-questionario.ts. I punteggi gia' configurati restano
  //      somme: nessuna compilazione cambia.
  `
  ALTER TABLE questionario_punteggi ADD COLUMN tipo TEXT NOT NULL DEFAULT 'somma';
  `,

  // 58 - l'esame neurologico nella valutazione obiettiva.
  //
  //      Solo i distretti che lo chiedono (esame_neuro = 1: di solito cervicale
  //      e lombare) mostrano la sezione. Le voci sono del distretto, come
  //      movimenti e test: radici (sensibilita'), muscoli (forza) e riflessi.
  //      Il rilievo e' per voce e per lato; per le radici ci sono solo quelle
  //      alterate (ridotta o aumentata), per i muscoli 0-5, per i riflessi
  //      ipo / normale / iper. Una nota sola per distretto, accanto a quelle
  //      dei movimenti.
  `
  ALTER TABLE distretti ADD COLUMN esame_neuro INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE valutazione_distretti ADD COLUMN nota_neuro TEXT;

  CREATE TABLE distretto_neuro (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distretto_id INTEGER NOT NULL REFERENCES distretti(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    nome TEXT NOT NULL,
    ordine INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_distretto_neuro ON distretto_neuro(distretto_id);

  CREATE TABLE valutazione_neuro (
    valutazione_id INTEGER NOT NULL REFERENCES valutazioni(id) ON DELETE CASCADE,
    voce_id INTEGER NOT NULL REFERENCES distretto_neuro(id) ON DELETE CASCADE,
    lato TEXT NOT NULL DEFAULT '',
    valore TEXT NOT NULL,
    PRIMARY KEY (valutazione_id, voce_id, lato)
  );
  `,

  // 59 - domande a griglia nei questionari: una domanda comune con piu' righe
  //      (le attivita') che hanno le stesse risposte. Ogni riga resta una
  //      domanda vera; l'intestazione e' il testo comune, uguale per tutte le
  //      righe consecutive della griglia. NULL = domanda singola, come prima.
  `
  ALTER TABLE questionario_domande ADD COLUMN intestazione TEXT;
  `,

  // 60 - promemoria per un paziente: rifare un questionario o uno screening a
  //      una certa data. Il riferimento e' o il questionario o il protocollo
  //      (mai tutti e due): se quello che si doveva ripetere viene eliminato, il
  //      promemoria va con lui. fatto_il vuoto = ancora da fare.
  `
  CREATE TABLE promemoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paziente_id INTEGER NOT NULL REFERENCES pazienti(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    questionario_id INTEGER REFERENCES questionari(id) ON DELETE CASCADE,
    protocollo_id INTEGER REFERENCES screening_protocolli(id) ON DELETE CASCADE,
    scadenza TEXT NOT NULL,
    nota TEXT,
    fatto_il TEXT,
    CHECK ((questionario_id IS NULL) <> (protocollo_id IS NULL))
  );
  CREATE INDEX idx_promemoria_paziente ON promemoria(paziente_id);
  CREATE INDEX idx_promemoria_aperti ON promemoria(scadenza) WHERE fatto_il IS NULL;
  `,

  // 61 - le progressioni di esercizi a step (es. "Vertical braking": wall sit,
  //      front squat, drop catch...). Servono solo a programmare: non finiscono
  //      mai in cartella, referti o stampe.
  //
  //      Uno step RIMANDA a un esercizio della libreria (senza cascata: un
  //      esercizio che e' step di una progressione non si elimina), cosi' lo
  //      stesso esercizio puo' stare in piu' progressioni. Si collegano alle
  //      FASI di una patologia, un gruppo intero o una progressione sola.
  //
  //      Lo step a cui e' il paziente NON e' salvato: si ricalcola rileggendo,
  //      in ordine, l'esito delle sue sedute (seduta_progressioni). Si salva
  //      solo "avanza" o "indietro"; niente vuol dire "continua".
  `
  CREATE TABLE progressione_gruppi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    ordine INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE progressioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gruppo_id INTEGER REFERENCES progressione_gruppi(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    criteri TEXT,
    ordine INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_progressioni_gruppo ON progressioni(gruppo_id);

  CREATE TABLE progressione_step (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    progressione_id INTEGER NOT NULL REFERENCES progressioni(id) ON DELETE CASCADE,
    esercizio_id INTEGER NOT NULL REFERENCES esercizi(id),
    requisito TEXT,
    ordine INTEGER NOT NULL DEFAULT 0,
    UNIQUE (progressione_id, esercizio_id)
  );
  CREATE INDEX idx_progressione_step_esercizio ON progressione_step(esercizio_id);

  CREATE TABLE fase_progressione_gruppi (
    fase_id INTEGER NOT NULL REFERENCES fasi(id) ON DELETE CASCADE,
    gruppo_id INTEGER NOT NULL REFERENCES progressione_gruppi(id) ON DELETE CASCADE,
    PRIMARY KEY (fase_id, gruppo_id)
  );

  CREATE TABLE fase_progressioni (
    fase_id INTEGER NOT NULL REFERENCES fasi(id) ON DELETE CASCADE,
    progressione_id INTEGER NOT NULL REFERENCES progressioni(id) ON DELETE CASCADE,
    PRIMARY KEY (fase_id, progressione_id)
  );

  CREATE TABLE seduta_progressioni (
    seduta_id INTEGER NOT NULL REFERENCES sedute(id) ON DELETE CASCADE,
    progressione_id INTEGER NOT NULL REFERENCES progressioni(id) ON DELETE CASCADE,
    esito TEXT NOT NULL CHECK (esito IN ('avanza', 'indietro')),
    PRIMARY KEY (seduta_id, progressione_id)
  );
  CREATE INDEX idx_seduta_progressioni_progressione ON seduta_progressioni(progressione_id);
  `,

  // 62 - indici che mancavano, e che con gli anni rallentavano il programma.
  //      Il peggiore: l'elenco degli esercizi conta in quante sedute e' usato
  //      ognuno, e senza un indice su seduta_esercizi(esercizio_id) rileggeva
  //      tutte le righe di tutte le sedute per ogni esercizio. Con 400 esercizi
  //      e 6000 sedute ci metteva 2 secondi (con l'indice 7 millesimi), e in
  //      quei 2 secondi il programma restava fermo: si apre a ogni seduta.
  //      Gli altri servono ai controlli delle chiavi esterne: salvando una
  //      seduta si cancellano le sue sezioni, e per ognuna SQLite cercava fra
  //      tutti gli esercizi di tutte le sedute chi la usava ancora.
  //      Solo indici: nessun dato cambia.
  `
  CREATE INDEX IF NOT EXISTS idx_seduta_esercizi_esercizio ON seduta_esercizi(esercizio_id);
  CREATE INDEX IF NOT EXISTS idx_seduta_esercizi_sezione ON seduta_esercizi(seduta_sezione_id);
  CREATE INDEX IF NOT EXISTS idx_sedute_fase ON sedute(fase_id);
  CREATE INDEX IF NOT EXISTS idx_seduta_tecniche_tecnica ON seduta_tecniche(tecnica_id);
  CREATE INDEX IF NOT EXISTS idx_seduta_sezioni_sezione ON seduta_sezioni(sezione_id);
  CREATE INDEX IF NOT EXISTS idx_questionario_risposte_domanda ON questionario_risposte(domanda_id);
  CREATE INDEX IF NOT EXISTS idx_paziente_questionari_questionario ON paziente_questionari(questionario_id);
  CREATE INDEX IF NOT EXISTS idx_screening_valori_misura ON screening_valori(misura_id);
  CREATE INDEX IF NOT EXISTS idx_screening_sessioni_protocollo ON screening_sessioni(protocollo_id);
  CREATE INDEX IF NOT EXISTS idx_valutazione_movimenti_movimento ON valutazione_movimenti(movimento_id);
  CREATE INDEX IF NOT EXISTS idx_valutazione_test_test ON valutazione_test(test_id);
  CREATE INDEX IF NOT EXISTS idx_segni_paziente ON segni(paziente_id);
  CREATE INDEX IF NOT EXISTS idx_massimali_paziente ON massimali(paziente_id);
  CREATE INDEX IF NOT EXISTS idx_bozze_seduta_paziente ON bozze_seduta(paziente_id);
  CREATE INDEX IF NOT EXISTS idx_pazienti_gruppo ON pazienti(gruppo_id);
  CREATE INDEX IF NOT EXISTS idx_pazienti_patologia ON pazienti(patologia_id);
  `
]

// Quante migrazioni conosce questo programma: e' anche il "formato" piu' nuovo
// di archivio che sa aprire.
export const VERSIONE_SCHEMA = MIGRATIONS.length

// `primaDiMigrare` si chiama una volta sola, prima della prima migrazione da
// applicare, con la versione da cui si parte: e' il momento di mettere da parte
// una copia dell'archivio com'e', perche' le migrazioni non si annullano. Non
// si chiama per un archivio nuovo (versione 0): non c'e' niente da proteggere.
export function runMigrations(
  db: Database.Database,
  primaDiMigrare?: (versione: number) => void
): void {
  const current = db.pragma('user_version', { simple: true }) as number

  // Un archivio scritto da una versione piu' recente ha colonne e regole che
  // questo programma non conosce: aprirlo lo farebbe scrivere righe incomplete
  // senza dare nessun errore. Meglio non toccarlo.
  if (current > MIGRATIONS.length) {
    throw new Error(
      'Questo archivio è stato salvato da una versione più recente del programma. ' +
        'Aggiorna il programma prima di aprirlo: così non si rovina niente. ' +
        `(formato ${current}, questo programma arriva al ${MIGRATIONS.length})`
    )
  }

  if (current > 0 && current < MIGRATIONS.length) primaDiMigrare?.(current)

  registraFunzioniMigrazioni(db)

  for (let i = current; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[i])
      db.pragma(`user_version = ${i + 1}`)
    })()
  }

  // La 56 libera un quarto dello spazio dei referti: senza VACUUM il file resta
  // grande uguale (le pagine liberate stanno dentro, vuote) e cosi' le copie.
  // Si fa una volta, subito dopo. Se non riesce (poco spazio sul disco) non e'
  // un errore: l'archivio e' a posto, solo piu' grande del necessario.
  if (current > 0 && current < 56) {
    try {
      db.exec('VACUUM')
    } catch {
      // resta piu' grande, ma corretto
    }
  }
}

// Le funzioni che le migrazioni possono usare oltre a quelle di SQLite. Chi
// applica le migrazioni a mano (le prove che costruiscono archivi di versioni
// vecchie) le registra anche lui, altrimenti la 56 non trova da_data_url.
export function registraFunzioniMigrazioni(db: Database.Database): void {
  db.function('da_data_url', { deterministic: true }, (valore: unknown) => daDataUrl(valore))
}

// "data:image/jpeg;base64,...." -> i byte del file. Qualunque altra cosa resta
// com'e'.
export function daDataUrl(valore: unknown): unknown {
  if (typeof valore !== 'string') return valore
  const m = /^data:[^;,]*;base64,/.exec(valore)
  if (!m) return valore
  return Buffer.from(valore.slice(m[0].length), 'base64')
}
