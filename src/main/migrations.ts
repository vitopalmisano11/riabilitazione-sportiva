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
