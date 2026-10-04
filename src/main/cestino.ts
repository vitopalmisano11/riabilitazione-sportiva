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

// Fotografia della riga e di tutto quello che le sta appeso, dal padre ai figli.
// La stessa riga puo' arrivare da due strade (la misura di un segno sta sotto
// la seduta e sotto il segno): l'ordine e i doppioni li sistema normalizza().
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

// Una riga si riconosce dal suo id. Le tabelle di collegamento non ce l'hanno:
// li' la riga intera fa da chiave (le colonne arrivano sempre nello stesso
// ordine, da SELECT *).
function chiaveRiga(riga: Record<string, unknown>): string {
  return typeof riga.id === 'number' ? `id:${riga.id}` : JSON.stringify(riga)
}

// La fotografia pronta da rimettere: una voce per tabella, ogni riga una volta
// sola, e le tabelle in un ordine in cui ogni riga trova gia' al suo posto
// quello a cui punta.
//
// Prima le righe si rimettevano nell'ordine in cui erano state trovate, e la
// stessa riga poteva esserci due volte: un paziente con le misure dei segni
// rimetteva le misure prima dei segni, e il ripristino falliva sempre. Si
// normalizza anche quando si ripristina, perche' le voci gia' nel cestino sono
// state scritte cosi'.
function normalizza(db: Db, foto: Fotografia[]): Fotografia[] {
  const perTabella = new Map<string, Map<string, Record<string, unknown>>>()
  for (const { tabella, righe } of foto) {
    const giaViste = perTabella.get(tabella) ?? new Map<string, Record<string, unknown>>()
    for (const riga of righe) {
      const chiave = chiaveRiga(riga)
      if (!giaViste.has(chiave)) giaViste.set(chiave, riga)
    }
    perTabella.set(tabella, giaViste)
  }

  // Da chi dipende ogni tabella, fra quelle della fotografia. Un rimando a se
  // stessa (una categoria dentro un'altra) non decide l'ordine: lo regge il
  // controllo rinviato alla fine del ripristino.
  const tabelle = [...perTabella.keys()]
  const padri = new Map(
    tabelle.map((t) => [
      t,
      (db.pragma(`foreign_key_list('${t}')`) as { table: string }[])
        .map((l) => l.table)
        .filter((p) => p !== t && perTabella.has(p))
    ])
  )
  const ordine: string[] = []
  const restanti = [...tabelle]
  while (restanti.length > 0) {
    // la prima, nell'ordine di prima, che ha gia' tutti i padri al loro posto;
    // in un giro chiuso (non dovrebbe esserci) si va avanti con la prima
    const i = restanti.findIndex((t) => padri.get(t)!.every((p) => ordine.includes(p)))
    ordine.push(restanti.splice(Math.max(i, 0), 1)[0])
  }
  return ordine.map((t) => ({ tabella: t, righe: [...perTabella.get(t)!.values()] }))
}

// Elimina mettendo prima da parte la fotografia. L'etichetta e' quello che si
// legge nel cestino ("Rossi Marco", "Seduta del 03/09/2026").
export function eliminaConCestino(tabella: string, id: number, tipo: string, etichetta: string): void {
  const db = getDb()
  db.transaction(() => {
    const foto = normalizza(db, raccogli(db, tabella, [id], figli(db)))
    if (foto.length === 0) return
    db.prepare(
      'INSERT INTO cestino (tipo, etichetta, quando, contenuto, righe) VALUES (?, ?, ?, ?, ?)'
    ).run(tipo, etichetta, new Date().toISOString(), JSON.stringify(foto), contaRighe(foto))
    db.prepare(`DELETE FROM ${tabella} WHERE id = ?`).run(id)
  })()
}

// Le righe di una fotografia, ognuna una volta sola.
function contaRighe(foto: Fotografia[]): number {
  return foto.reduce((n, f) => n + f.righe.length, 0)
}

// L'elenco non apre il contenuto delle voci: con i referti dentro sarebbe
// leggere e interpretare megabyte per mostrare un numero. Quel numero sta in una
// colonna, scritta quando la voce entra nel cestino.
export function elencoCestino(): VoceCestino[] {
  return getDb()
    .prepare('SELECT id, tipo, etichetta, quando, righe FROM cestino ORDER BY quando DESC')
    .all()
    .map((v) => {
      const r = v as Omit<VoceCestino, 'righe'> & { righe: number | null }
      // una voce di prima della migrazione 54 che la pulizia non ha ancora
      // completato (succede solo fra l'aggiornamento e il primo accesso)
      return { ...r, righe: r.righe ?? righeDellaVoce(r.id) }
    })
}

// Conta le righe di una voce dal suo contenuto, senza doppioni: le voci scritte
// prima della correzione del cestino ne possono avere.
function righeDellaVoce(id: number): number {
  const db = getDb()
  const voce = db.prepare('SELECT contenuto FROM cestino WHERE id = ?').get(id) as
    | { contenuto: string }
    | undefined
  if (!voce) return 0
  try {
    return contaRighe(normalizza(db, JSON.parse(voce.contenuto) as Fotografia[]))
  } catch {
    return 0
  }
}

// Completa il numero delle voci che non ce l'hanno. Si fa a ogni accesso, con la
// pulizia: e' un lavoro da fare una volta sola per voce, e non in una lettura.
function completaRighe(): void {
  const db = getDb()
  const senza = db.prepare('SELECT id FROM cestino WHERE righe IS NULL').all() as { id: number }[]
  const scrivi = db.prepare('UPDATE cestino SET righe = ? WHERE id = ?')
  for (const { id } of senza) scrivi.run(righeDellaVoce(id), id)
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
  const foto = normalizza(db, JSON.parse(voce.contenuto) as Fotografia[])

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
      // I collegamenti si controllano tutti insieme alla fine, quando ogni riga
      // e' tornata al suo posto: una riga che punta a un'altra della stessa
      // tabella non dipende piu' dall'ordine. Se alla fine manca qualcosa, non
      // si rimette niente. Il rinvio vale solo per questo ripristino.
      db.pragma('defer_foreign_keys = ON')
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
    completaRighe()
  } catch {
    // database non ancora aperto: si ripulira' al prossimo accesso
  }
}
