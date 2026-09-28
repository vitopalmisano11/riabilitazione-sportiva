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
import { erroreSenzaDatiNelRegistro } from './validazione'

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
//
// Si guardano solo i legami con ON DELETE CASCADE, cioe' le righe che il
// database cancella davvero insieme al padre. Le altre (ON DELETE SET NULL, o
// nessuna azione) restano dove sono: fotografarle vorrebbe dire, al ripristino,
// provare a reinserire righe mai cancellate.
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
      on_delete: string
    }[]
    for (const r of riferimenti) {
      if (r.on_delete !== 'CASCADE') continue
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

// Come si chiama, in parole semplici, la cosa che manca.
const COSA_MANCA: Record<string, string> = {
  patologie: 'una patologia',
  fasi: 'una fase',
  gruppi: 'un gruppo',
  esercizi: 'un esercizio',
  categorie: 'una categoria di esercizi',
  tecniche: 'una tecnica',
  questionari: 'un questionario',
  test_valutazione: 'un test',
  distretti: 'un distretto',
  pazienti: 'un paziente',
  sedute: 'una seduta'
}

// Cosa la fotografia si aspetta di ritrovare e non c'e' piu'. Una riga rimessa
// a posto porta con se' i suoi collegamenti (la fase di un paziente, l'esercizio
// di una seduta): se nel frattempo quella cosa e' stata eliminata, il database
// rifiuterebbe l'inserimento. Meglio scoprirlo prima, e dire cosa fare.
function mancanti(db: Db, foto: Fotografia[], idCestino: number): string[] {
  // Quello che la stessa fotografia rimette a posto non manca: arriva insieme.
  const riportato = new Set<string>()
  for (const { tabella, righe } of foto) {
    for (const r of righe) if (typeof r.id === 'number') riportato.add(`${tabella}:${r.id}`)
  }

  const esiste = new Map<string, boolean>()
  const cerca = (tabella: string, colonna: string, valore: unknown): boolean => {
    const chiave = `${tabella}:${colonna}:${String(valore)}`
    let trovato = esiste.get(chiave)
    if (trovato === undefined) {
      trovato = db.prepare(`SELECT 1 FROM ${tabella} WHERE ${colonna} = ?`).get(valore) !== undefined
      esiste.set(chiave, trovato)
    }
    return trovato
  }

  const persi = new Map<string, { tabella: string; colonna: string; valore: unknown }>()
  for (const { tabella, righe } of foto) {
    const legami = db.pragma(`foreign_key_list('${tabella}')`) as {
      table: string
      from: string
      to: string | null
    }[]
    for (const riga of righe) {
      for (const l of legami) {
        const valore = riga[l.from]
        if (valore == null) continue
        const colonna = l.to ?? 'id'
        if (colonna === 'id' && riportato.has(`${l.table}:${String(valore)}`)) continue
        if (cerca(l.table, colonna, valore)) continue
        persi.set(`${l.table}:${colonna}:${String(valore)}`, { tabella: l.table, colonna, valore })
      }
    }
  }
  if (persi.size === 0) return []

  // Se la cosa che manca e' nel cestino anch'essa, si dice qual e': basta
  // rimetterla a posto per prima.
  const altre = (
    db.prepare('SELECT tipo, etichetta, contenuto FROM cestino WHERE id <> ?').all(idCestino) as {
      tipo: string
      etichetta: string
      contenuto: string
    }[]
  ).map((v) => ({ tipo: v.tipo, etichetta: v.etichetta, foto: JSON.parse(v.contenuto) as Fotografia[] }))

  const messaggi = new Set<string>()
  for (const p of persi.values()) {
    const nelCestino = altre.find((v) =>
      v.foto.some((f) => f.tabella === p.tabella && f.righe.some((r) => r[p.colonna] === p.valore))
    )
    messaggi.add(
      nelCestino
        ? `prima rimetti a posto «${nelCestino.etichetta}» (${nelCestino.tipo}), che sta nel cestino`
        : `${COSA_MANCA[p.tabella] ?? 'un elemento collegato'} a cui era legato non c’è più e non è nel cestino`
    )
  }
  return [...messaggi]
}

export function ripristina(idCestino: number): void {
  const db = getDb()
  const voce = db.prepare('SELECT contenuto FROM cestino WHERE id = ?').get(idCestino) as
    | { contenuto: string }
    | undefined
  if (!voce) throw new Error('Questa voce del cestino non c’è più.')
  const foto = JSON.parse(voce.contenuto) as Fotografia[]

  const mancano = mancanti(db, foto, idCestino)
  if (mancano.length > 0) {
    // Il messaggio cita i nomi delle voci ("Rossi Mia"): chi usa il programma li
    // legge, il registro degli errori no.
    throw erroreSenzaDatiNelRegistro(
      `Non si può rimettere a posto adesso: ${mancano.join('; ')}. La voce resta nel cestino, non si perde niente.`,
      'Ripristino dal cestino: manca un elemento a cui la voce era collegata.'
    )
  }

  try {
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
  } catch (e) {
    // Un legame rotto che il controllo sopra non ha visto: il messaggio
    // generico di ipc.ts parlerebbe di "eliminare", qui si sta rimettendo a posto.
    if (e instanceof Error && e.message.includes('FOREIGN KEY constraint failed')) {
      throw new Error(
        'Non si può rimettere a posto: manca qualcosa a cui questa voce era collegata. La voce resta nel cestino.'
      )
    }
    throw e
  }
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
