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
