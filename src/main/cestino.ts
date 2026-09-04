// Il cestino: quello che elimini non sparisce subito.
//
// Prima, cancellare un paziente per sbaglio si rimediava solo ripristinando una
// copia di sicurezza, che pero' riporta indietro tutto l'archivio — anche il
// lavoro fatto dopo. Qui invece, prima di cancellare, si mette da parte una
// fotografia della riga e di tutto quello che le sta appeso (le sedute di un
// paziente, gli esercizi di quelle sedute, e cosi' via), e la si puo' rimettere
// dov'era.
//
// Le righe si ritrovano con gli stessi id di prima: le tabelle usano
// AUTOINCREMENT, e SQLite non riassegna mai un id gia' usato, percio' rimetterle
// non puo' scontrarsi con qualcosa di nuovo.
//
// I figli si scoprono da soli chiedendo al database chi punta a chi
// (PRAGMA foreign_key_list): cosi' una tabella aggiunta domani finisce nel
// cestino senza che nessuno debba ricordarsi di aggiornare un elenco.
import { getDb } from './db'

const GIORNI_IN_CESTINO = 30

export interface VoceCestino {
  id: number
  tipo: string
  etichetta: string
  quando: string
  righe: number
}

interface Fotografia {
  tabella: string
  righe: Record<string, unknown>[]
}

type Db = ReturnType<typeof getDb>

// Per ogni tabella, chi la cita: [tabella figlia, colonna che punta qui].
function figli(db: Db): Map<string, [string, string][]> {
  const mappa = new Map<string, [string, string][]>()
  const tabelle = (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[]
  ).map((r) => r.name)
  for (const t of tabelle) {
    const riferimenti = db.pragma(`foreign_key_list('${t}')`) as {
      table: string
      from: string
    }[]
    for (const r of riferimenti) {
      const elenco = mappa.get(r.table) ?? []
      elenco.push([t, r.from])
      mappa.set(r.table, elenco)
    }
  }
  return mappa
}

// Fotografia della riga e di tutto quello che le sta appeso, dal padre ai figli:
// rimettendole in quest'ordine i vincoli sono sempre soddisfatti.
function raccogli(db: Db, tabella: string, ids: number[], mappa: Map<string, [string, string][]>): Fotografia[] {
  if (ids.length === 0) return []
  const segnaposto = ids.map(() => '?').join(', ')
  const righe = db
    .prepare(`SELECT * FROM ${tabella} WHERE id IN (${segnaposto})`)
    .all(...ids) as Record<string, unknown>[]
  if (righe.length === 0) return []

  const raccolto: Fotografia[] = [{ tabella, righe }]
  for (const [figlia, colonna] of mappa.get(tabella) ?? []) {
    const suoi = db
      .prepare(`SELECT * FROM ${figlia} WHERE ${colonna} IN (${segnaposto})`)
      .all(...ids) as Record<string, unknown>[]
    if (suoi.length === 0) continue
    // Le tabelle di collegamento non hanno un id proprio: si portano via cosi'
    // come sono, senza cercare altri figli sotto.
    const idFigli = suoi.map((r) => r.id).filter((x): x is number => typeof x === 'number')
    if (idFigli.length === suoi.length && idFigli.length > 0) {
      raccolto.push(...raccogli(db, figlia, idFigli, mappa))
    } else {
      raccolto.push({ tabella: figlia, righe: suoi })
    }
  }
  return raccolto
}

// Elimina mettendo prima da parte la fotografia. L'etichetta e' quello che si
// legge nel cestino ("Rossi Marco", "Seduta del 03/09/2026").
export function eliminaConCestino(tabella: string, id: number, tipo: string, etichetta: string): void {
  const db = getDb()
  db.transaction(() => {
    const foto = raccogli(db, tabella, [id], figli(db))
    if (foto.length === 0) return
    db.prepare(
      'INSERT INTO cestino (tipo, etichetta, quando, contenuto) VALUES (?, ?, ?, ?)'
    ).run(tipo, etichetta, new Date().toISOString(), JSON.stringify(foto))
    db.prepare(`DELETE FROM ${tabella} WHERE id = ?`).run(id)
  })()
}

export function elencoCestino(): VoceCestino[] {
  return (
    getDb()
      .prepare('SELECT id, tipo, etichetta, quando, contenuto FROM cestino ORDER BY quando DESC')
      .all() as (VoceCestino & { contenuto: string })[]
  ).map(({ contenuto, ...v }) => ({
    ...v,
    righe: (JSON.parse(contenuto) as Fotografia[]).reduce((n, f) => n + f.righe.length, 0)
  }))
}

export function ripristina(idCestino: number): void {
  const db = getDb()
  const voce = db.prepare('SELECT contenuto FROM cestino WHERE id = ?').get(idCestino) as
    | { contenuto: string }
    | undefined
  if (!voce) throw new Error('Questa voce del cestino non c’è più.')
  const foto = JSON.parse(voce.contenuto) as Fotografia[]

  db.transaction(() => {
    for (const { tabella, righe } of foto) {
      for (const riga of righe) {
        const colonne = Object.keys(riga)
        db.prepare(
          `INSERT INTO ${tabella} (${colonne.join(', ')})
           VALUES (${colonne.map((c) => '@' + c).join(', ')})`
        ).run(riga)
      }
    }
    db.prepare('DELETE FROM cestino WHERE id = ?').run(idCestino)
  })()
}

export function svuotaCestino(idCestino?: number): void {
  const db = getDb()
  if (idCestino == null) db.prepare('DELETE FROM cestino').run()
  else db.prepare('DELETE FROM cestino WHERE id = ?').run(idCestino)
}

// All'avvio si buttano le voci piu' vecchie di un mese: il cestino e' una rete
// per gli sbagli di ieri, non un secondo archivio.
export function ripuliscilCestino(): void {
  const limite = new Date(Date.now() - GIORNI_IN_CESTINO * 24 * 60 * 60 * 1000).toISOString()
  try {
    getDb().prepare('DELETE FROM cestino WHERE quando < ?').run(limite)
  } catch {
    // database non ancora aperto: si ripulira' al prossimo accesso
  }
}
