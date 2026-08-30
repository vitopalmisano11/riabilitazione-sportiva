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
