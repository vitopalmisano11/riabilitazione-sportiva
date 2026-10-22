// I test fatti con la pedana di forza: importazione del file dell'app della
// pedana e archivio del paziente. Senza niente di Electron (modello:
// sedute.ts): la scelta del file sta in ipc.ts, le prove in test/pedana.test.ts.
//
// Il file si legge e si controlla (shared/pedana.ts), poi resta in memoria in
// attesa che si confermi: la pagina riceve solo l'anteprima e un gettone per
// riconoscerlo. Cosi' i dati del paziente non fanno il giro dalla pagina e
// ritorno, e un file mai confermato sparisce da solo.
import { randomUUID } from 'node:crypto'
import { getDb } from './db'
import { chiudiFatti } from './promemoria'
import {
  leggiFilePedana,
  chiaveTestPedana,
  nomeTestPulito,
  type ArchivioPedana,
  somiglianzaNomi,
  SOGLIA_CANDIDATO,
  type AnteprimaPedana,
  type CandidatoPaziente,
  type EsitoImportPedana,
  type FilePedana,
  type LatoPedana,
  type MisuraPedana,
  type RegistrazionePedana,
  type SeriePedana,
  type TestPedanaSalvato
} from '../shared/pedana'

// Pochi file in attesa: uno per volta e' il caso normale.
const MAX_IN_ATTESA = 3
const inAttesa = new Map<string, FilePedana>()

// Il lato di una registrazione: quello comune a tutti i suoi valori, o nessuno
// (test bilaterale, o valori misti).
function latoDellaRegistrazione(r: RegistrazionePedana): LatoPedana | null {
  const lati = new Set(r.misure.flatMap((m) => m.valori.map((v) => v.lato)))
  return lati.size === 1 ? ([...lati][0] as LatoPedana | null) : null
}

const idGiaImportati = (pazienteId: number): Set<string> =>
  new Set(
    (
      getDb().prepare('SELECT id_esterno FROM pedana_test WHERE paziente_id = ?').all(pazienteId) as {
        id_esterno: string
      }[]
    ).map((r) => r.id_esterno)
  )

// Legge e controlla il file e ne ritorna l'anteprima. Il paziente non si
// abbina da solo: si propongono quelli con il nome somigliante (in qualunque
// ordine di nome e cognome) e si lascia scegliere. Se si parte dalla scheda di
// un paziente, e' lui il suggerimento.
export function anteprimaPedana(
  contenuto: string,
  nomeFile: string,
  pazienteDaCuiSiParte: number | null
): AnteprimaPedana {
  const file = leggiFilePedana(contenuto)
  if (file.registrazioni.length === 0) throw new Error('Il file non contiene nessuna registrazione.')

  const nomeNelFile = file.paziente_nome
  const candidati: CandidatoPaziente[] = nomeNelFile
    ? (
        getDb().prepare('SELECT id, nome, cognome FROM pazienti').all() as {
          id: number
          nome: string
          cognome: string
        }[]
      )
        .map((p) => ({ ...p, somiglianza: somiglianzaNomi(nomeNelFile, p.cognome, p.nome) }))
        .filter((p) => p.somiglianza >= SOGLIA_CANDIDATO)
        .sort((a, b) => b.somiglianza - a.somiglianza || a.cognome.localeCompare(b.cognome))
        .slice(0, 5)
    : []

  if (
    pazienteDaCuiSiParte !== null &&
    !getDb().prepare('SELECT 1 FROM pazienti WHERE id = ?').get(pazienteDaCuiSiParte)
  ) {
    throw new Error('Paziente non trovato.')
  }
  const proposto = pazienteDaCuiSiParte ?? candidati[0]?.id ?? null
  const giaDentro = proposto !== null ? idGiaImportati(proposto) : new Set<string>()

  const token = randomUUID()
  inAttesa.set(token, file)
  while (inAttesa.size > MAX_IN_ATTESA) inAttesa.delete(inAttesa.keys().next().value as string)

  return {
    token,
    nome_file: nomeFile,
    app: file.app,
    dispositivo: file.dispositivo,
    paziente_nome_file: nomeNelFile,
    peso_kg: file.peso_kg,
    candidati,
    proposto,
    registrazioni: file.registrazioni.map((r) => ({
      id: r.id,
      data: r.data,
      ora: r.ora,
      test_codice: r.test.codice,
      test_nome: r.test.nome,
      lato: latoDellaRegistrazione(r),
      num_valori: r.misure.reduce((n, m) => n + m.valori.length, 0),
      ha_serie: r.serie.length > 0,
      avvertenze: r.avvertenze,
      gia_importata: giaDentro.has(r.id)
    }))
  }
}

// Quali registrazioni del file in attesa ci sono gia' per un paziente: serve
// quando nella finestra si sceglie un altro paziente.
export function giaImportatePedana(token: string, pazienteId: number): string[] {
  const file = inAttesa.get(token)
  if (!file) throw new Error('Il file non è più in attesa: sceglilo di nuovo.')
  const dentro = idGiaImportati(pazienteId)
  return file.registrazioni.filter((r) => dentro.has(r.id)).map((r) => r.id)
}

// Importa le registrazioni scelte del file in attesa nel paziente scelto.
// Quelle gia' presenti si saltano senza errore: reimportare lo stesso file e'
// innocuo. Tutto o niente.
export function importaPedana(
  pazienteId: number,
  token: string,
  idScelti: string[]
): EsitoImportPedana {
  const file = inAttesa.get(token)
  if (!file) throw new Error('Il file non è più in attesa: sceglilo di nuovo.')
  const scelti = new Set(idScelti)
  const db = getDb()
  if (!db.prepare('SELECT 1 FROM pazienti WHERE id = ?').get(pazienteId)) {
    throw new Error('Paziente non trovato.')
  }

  const nuovoTest = db.prepare(
    `INSERT INTO pedana_test
       (paziente_id, id_esterno, data, ora, test_codice, test_nome, categoria, lato, peso_kg,
        dispositivo_tipo, dispositivo_modello, condizioni, avvertenze, riassunto)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (paziente_id, id_esterno) DO NOTHING`
  )
  const nuovoValore = db.prepare(
    `INSERT INTO pedana_valori
       (test_id, misura_codice, misura_nome, unita, meglio, per_prova, lato, prova, valore, ordine)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const nuovaSerie = db.prepare(
    'INSERT INTO pedana_serie (test_id, codice, nome, dati) VALUES (?, ?, ?, ?)'
  )

  let importate = 0
  let saltate = 0
  db.transaction(() => {
    for (const r of file.registrazioni) {
      if (!scelti.has(r.id)) continue
      const esito = nuovoTest.run(
        pazienteId,
        r.id,
        r.data,
        r.ora,
        r.test.codice,
        r.test.nome,
        r.test.categoria,
        latoDellaRegistrazione(r),
        r.peso_kg ?? file.peso_kg,
        file.dispositivo.tipo,
        file.dispositivo.modello,
        JSON.stringify(r.condizioni),
        JSON.stringify(r.avvertenze),
        JSON.stringify(r.riassunto)
      )
      if (esito.changes === 0) {
        saltate++
        continue
      }
      const testId = Number(esito.lastInsertRowid)
      let ordine = 0
      for (const mis of r.misure) {
        for (const v of mis.valori) {
          nuovoValore.run(
            testId,
            mis.codice,
            mis.nome,
            mis.unita,
            mis.meglio,
            mis.per_prova ? 1 : 0,
            v.lato,
            v.prova,
            v.valore,
            ordine++
          )
        }
      }
      for (const s of r.serie) {
        nuovaSerie.run(
          testId,
          s.codice,
          s.nome,
          JSON.stringify({
            asse_x: s.asse_x,
            asse_y: s.asse_y,
            frequenza_hz: s.frequenza_hz,
            lato: s.lato,
            prova: s.prova,
            canali: s.canali,
            ellisse: s.ellisse
          })
        )
      }
      importate++
      // un promemoria "rifai questo test" si chiude da solo quando il test arriva
      chiudiFatti(db, pazienteId, { pedanaChiave: chiaveTestPedana(r.test.codice, r.test.nome) })
    }
  })()

  inAttesa.delete(token)
  return { importate, saltate }
}

export function annullaImportPedana(token: string): void {
  inAttesa.delete(token)
}

interface RigaTest {
  id: number
  data: string
  ora: string | null
  test_codice: string
  test_nome: string
  categoria: string | null
  lato: LatoPedana | null
  peso_kg: number | null
  dispositivo_tipo: string | null
  dispositivo_modello: string | null
  condizioni: string | null
  avvertenze: string | null
  riassunto: string | null
}

const json = <T>(testo: string | null, ripiego: T): T => {
  if (!testo) return ripiego
  try {
    return JSON.parse(testo) as T
  } catch {
    return ripiego
  }
}

// Tutto quello che si sa dei test pedana di un paziente: dal piu' recente.
export function archivioPedana(pazienteId: number): ArchivioPedana {
  const db = getDb()
  const righe = db
    .prepare(
      `SELECT id, data, ora, test_codice, test_nome, categoria, lato, peso_kg,
              dispositivo_tipo, dispositivo_modello, condizioni, avvertenze, riassunto
       FROM pedana_test WHERE paziente_id = ?
       ORDER BY data DESC, COALESCE(ora, '') DESC, id DESC`
    )
    .all(pazienteId) as RigaTest[]

  const valoriStmt = db.prepare(
    `SELECT misura_codice, misura_nome, unita, meglio, per_prova, lato, prova, valore
     FROM pedana_valori WHERE test_id = ? ORDER BY ordine, id`
  )
  const serieStmt = db.prepare('SELECT codice, nome, dati FROM pedana_serie WHERE test_id = ? ORDER BY id')

  const test = righe.map((r): TestPedanaSalvato => {
    const misure: MisuraPedana[] = []
    for (const v of valoriStmt.all(r.id) as {
      misura_codice: string
      misura_nome: string
      unita: string | null
      meglio: 'alto' | 'basso' | null
      per_prova: number
      lato: LatoPedana | null
      prova: number | null
      valore: number
    }[]) {
      let m = misure.find((x) => x.codice === v.misura_codice)
      if (!m) {
        m = {
          codice: v.misura_codice,
          nome: v.misura_nome,
          unita: v.unita,
          per_prova: v.per_prova === 1,
          meglio: v.meglio,
          valori: []
        }
        misure.push(m)
      }
      m.valori.push({ lato: v.lato, prova: v.prova, valore: v.valore })
    }
    const serie = (serieStmt.all(r.id) as { codice: string; nome: string; dati: string }[]).map(
      (s): SeriePedana => {
        const d = json<Partial<SeriePedana>>(s.dati, {})
        return {
          codice: s.codice,
          nome: s.nome,
          asse_x: d.asse_x ?? null,
          asse_y: d.asse_y ?? null,
          frequenza_hz: d.frequenza_hz ?? null,
          lato: d.lato ?? null,
          prova: d.prova ?? null,
          canali: d.canali ?? {},
          ellisse: d.ellisse ?? null
        }
      }
    )
    return {
      id: r.id,
      data: r.data,
      ora: r.ora,
      test_codice: r.test_codice,
      // i test importati prima della pulizia dei nomi hanno ancora le parentesi doppie
      test_nome: nomeTestPulito(r.test_nome),
      categoria: r.categoria,
      lato: r.lato,
      peso_kg: r.peso_kg,
      dispositivo_tipo: r.dispositivo_tipo,
      dispositivo_modello: r.dispositivo_modello,
      condizioni: json<Record<string, unknown>>(r.condizioni, {}),
      avvertenze: json<string[]>(r.avvertenze, []),
      riassunto: json<string[]>(r.riassunto, []),
      misure,
      serie
    }
  })

  const lati: Record<string, LatoPedana> = {}
  for (const l of db
    .prepare('SELECT test_codice, lato FROM pedana_lato_interessato WHERE paziente_id = ?')
    .all(pazienteId) as { test_codice: string; lato: LatoPedana }[]) {
    lati[l.test_codice] = l.lato
  }
  const operato = db.prepare('SELECT arto_operato FROM pazienti WHERE id = ?').get(pazienteId) as
    | { arto_operato: LatoPedana | null }
    | undefined

  return { test, lati_interessati: lati, arto_operato: operato?.arto_operato ?? null }
}

export function eliminaTestPedana(id: number): void {
  getDb().prepare('DELETE FROM pedana_test WHERE id = ?').run(id)
}

// Il lato interessato per un test: null torna a quello della scheda del paziente.
export function impostaLatoInteressato(
  pazienteId: number,
  testCodice: string,
  lato: LatoPedana | null
): void {
  if (lato !== null && lato !== 'dx' && lato !== 'sx') throw new Error('Il lato deve essere destro o sinistro.')
  const db = getDb()
  if (lato === null) {
    db.prepare('DELETE FROM pedana_lato_interessato WHERE paziente_id = ? AND test_codice = ?').run(
      pazienteId,
      testCodice
    )
    return
  }
  db.prepare(
    `INSERT INTO pedana_lato_interessato (paziente_id, test_codice, lato) VALUES (?, ?, ?)
     ON CONFLICT (paziente_id, test_codice) DO UPDATE SET lato = excluded.lato`
  ).run(pazienteId, testCodice, lato)
}
