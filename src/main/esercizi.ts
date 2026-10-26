// La libreria degli esercizi e le sue categorie. Senza niente di Electron
// (modello: sedute.ts). Il codice e' quello che stava nei canali di ipc.ts,
// spostato com'era; la scelta del file dell'immagine (che apre un dialogo) resta
// in ipc.ts.
import { getDb } from './db'
import { eliminaConCestino, nomeDi } from './cestino'
import { validaImmagine, validaLink } from './validazione'
import { progressioniConEsercizio, progressioniConVariante } from './progressioni'
import type { EsercizioInput, VarianteEsercizio, VarianteInput } from '../shared/types'

// Sta nel database (quindi cifrata e inclusa nel backup della cartella) come
// data URL. Il peso massimo tiene il file sotto controllo.
const IMG_PESO_MAX = 3 * 1024 * 1024

// In ordine alfabetico: le categorie sono tante e si cercano per nome, e un
// ordine deciso a mano andava tenuto aggiornato a ogni aggiunta. L'ordine lo
// decide qui, non nella query: COLLATE NOCASE dell'SQL confonde le lettere
// accentate (es. "Mobilità" finiva fuori posto), mentre localeCompare
// conosce le regole dell'italiano.
export function elencoCategorie(): unknown[] {
  return (getDb().prepare('SELECT * FROM categorie').all() as { nome: string }[]).sort((a, b) =>
    a.nome.localeCompare(b.nome, 'it')
  )
}

// Colonne esplicite: `e.*` trascinerebbe anche `immagine` in ogni elenco.
export function elencoEsercizi(includiArchiviati: boolean): unknown[] {
  const db = getDb()
  // Le varianti si leggono tutte insieme e si distribuiscono: sono poche, e
  // una query per esercizio sarebbe lenta con la libreria aperta.
  const varianti = new Map<number, VarianteEsercizio[]>()
  for (const v of db
    .prepare('SELECT id, esercizio_id, nome FROM esercizio_varianti ORDER BY ordine, id')
    .all() as (VarianteEsercizio & { esercizio_id: number })[]) {
    const elenco = varianti.get(v.esercizio_id) ?? []
    elenco.push({ id: v.id, nome: v.nome })
    varianti.set(v.esercizio_id, elenco)
  }
  const esercizi = db
    .prepare(
      `SELECT e.id, e.nome, e.categoria_id, e.serie_default, e.cluster_default,
              e.ripetizioni_default, e.rir_default, e.carico_default, e.unita_carico,
              e.recupero_cluster_default,
              e.recupero_default, e.nota_tecnica, e.link, e.archiviato,
              c.nome AS categoria_nome, c.dosaggio_cluster, c.dosaggio_rir,
              (SELECT COUNT(*) FROM seduta_esercizi se WHERE se.esercizio_id = e.id) AS usi,
              (e.immagine IS NOT NULL) AS ha_immagine
       FROM esercizi e JOIN categorie c ON c.id = e.categoria_id
       ${includiArchiviati ? '' : 'WHERE e.archiviato = 0'}
       ORDER BY e.nome`
    )
    .all() as { id: number }[]
  return esercizi.map((e) => ({ ...e, varianti: varianti.get(e.id) ?? [] }))
}

export function creaCategoria(nome: string): number {
  const db = getDb()
  const { next } = db
    .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM categorie')
    .get() as { next: number }
  return Number(
    db.prepare('INSERT INTO categorie (nome, ordine) VALUES (?, ?)').run(nome.trim(), next)
      .lastInsertRowid
  )
}

export function rinominaCategoria(id: number, nome: string): void {
  getDb().prepare('UPDATE categorie SET nome = ? WHERE id = ?').run(nome.trim(), id)
}

export function impostaCluster(id: number, attivo: boolean): void {
  getDb()
    .prepare('UPDATE categorie SET dosaggio_cluster = ? WHERE id = ?')
    .run(attivo ? 1 : 0, id)
}

export function impostaRir(id: number, attivo: boolean): void {
  getDb().prepare('UPDATE categorie SET dosaggio_rir = ? WHERE id = ?').run(attivo ? 1 : 0, id)
}

export function impostaPadre(id: number, padreId: number | null): void {
  const db = getDb()
  if (padreId != null) {
    if (padreId === id) throw new Error('Una categoria non puo\' stare dentro a se stessa.')
    const figlie = db
      .prepare('SELECT COUNT(*) AS n FROM categorie WHERE padre_id = ?')
      .get(id) as { n: number }
    if (figlie.n > 0) {
      throw new Error(
        'Questa categoria ha gia\' dei distretti dentro: prima spostali, poi potrai metterla dentro a un\'altra.'
      )
    }
    const padre = db.prepare('SELECT padre_id FROM categorie WHERE id = ?').get(padreId) as
      | { padre_id: number | null }
      | undefined
    if (padre?.padre_id != null) {
      throw new Error('Si puo\' scendere di un livello solo: quella categoria e\' gia\' dentro a un\'altra.')
    }
  }
  db.prepare('UPDATE categorie SET padre_id = ? WHERE id = ?').run(padreId, id)
}

export function eliminaCategoria(id: number): void {
  eliminaConCestino('categorie', id, 'Categoria di esercizi', nomeDi('categorie', id))
}

// Le varianti di un esercizio, nell'ordine in cui arrivano (dalla piu' facile
// alla piu' difficile). Quelle con un id si aggiornano, le altre si aggiungono,
// quelle che non ci sono piu' si tolgono -- ma non se una progressione le usa:
// lo step di una scala resterebbe senza la sua variante, e in silenzio diventerebbe
// l'esercizio normale.
function salvaVarianti(esercizioId: number, varianti: VarianteInput[]): void {
  const db = getDb()
  const nuove = varianti.map((v) => ({ id: v.id, nome: v.nome.trim() })).filter((v) => v.nome !== '')
  const visti = new Set<string>()
  for (const v of nuove) {
    const chiave = v.nome.toLowerCase()
    if (visti.has(chiave)) throw new Error(`Due varianti si chiamano «${v.nome}»: dai loro nomi diversi.`)
    visti.add(chiave)
  }
  const attuali = db.prepare('SELECT id, nome FROM esercizio_varianti WHERE esercizio_id = ?').all(esercizioId) as VarianteEsercizio[]
  const tenute = new Set(nuove.map((v) => v.id))
  for (const v of attuali) {
    if (tenute.has(v.id)) continue
    const usate = progressioniConVariante(v.id)
    if (usate.length > 0) {
      throw new Error(
        `La variante «${v.nome}» è uno step di ${usate.length === 1 ? 'una progressione' : 'più progressioni'} (${usate.join(', ')}): toglila prima da lì, in Libreria → Progressioni.`
      )
    }
    db.prepare('DELETE FROM esercizio_varianti WHERE id = ?').run(v.id)
  }
  const aggiorna = db.prepare('UPDATE esercizio_varianti SET nome = ?, ordine = ? WHERE id = ? AND esercizio_id = ?')
  const inserisci = db.prepare('INSERT INTO esercizio_varianti (esercizio_id, nome, ordine) VALUES (?, ?, ?)')
  nuove.forEach((v, i) => {
    if (v.id != null && attuali.some((a) => a.id === v.id)) aggiorna.run(v.nome, i, v.id, esercizioId)
    else inserisci.run(esercizioId, v.nome, i)
  })
}

export function creaEsercizio(data: EsercizioInput): number {
  validaLink(data.link, 'Il link del video')
  const { varianti, ...campi } = data
  const db = getDb()
  return db.transaction(() => {
    const id = Number(
      db
        .prepare(
          `INSERT INTO esercizi (nome, categoria_id, serie_default, cluster_default,
                                 ripetizioni_default, rir_default, carico_default, unita_carico,
                                 recupero_cluster_default,
                                 recupero_default, nota_tecnica, link)
           VALUES (@nome, @categoria_id, @serie_default, @cluster_default,
                   @ripetizioni_default, @rir_default, @carico_default, @unita_carico,
                   @recupero_cluster_default,
                   @recupero_default, @nota_tecnica, @link)`
        )
        .run({ ...campi, nome: campi.nome.trim(), link: campi.link?.trim() || null }).lastInsertRowid
    )
    if (varianti) salvaVarianti(id, varianti)
    return id
  })()
}

export function aggiornaEsercizio(id: number, data: EsercizioInput): void {
  validaLink(data.link, 'Il link del video')
  const { varianti, ...campi } = data
  const db = getDb()
  db.transaction(() => {
    db.prepare(
      `UPDATE esercizi SET nome = @nome, categoria_id = @categoria_id,
       serie_default = @serie_default, cluster_default = @cluster_default,
       ripetizioni_default = @ripetizioni_default, rir_default = @rir_default,
       carico_default = @carico_default,
       unita_carico = @unita_carico,
       recupero_cluster_default = @recupero_cluster_default,
       recupero_default = @recupero_default,
       nota_tecnica = @nota_tecnica, link = @link
       WHERE id = @id`
    ).run({ ...campi, nome: campi.nome.trim(), link: campi.link?.trim() || null, id })
    if (varianti) salvaVarianti(id, varianti)
  })()
}

export function archiviaEsercizio(id: number, archiviato: boolean): void {
  getDb().prepare('UPDATE esercizi SET archiviato = ? WHERE id = ?').run(archiviato ? 1 : 0, id)
}

export function eliminaEsercizio(id: number): void {
  // Un esercizio citato da una seduta non si cancella: le sedute passate
  // devono restare leggibili. Il vincolo del database lo impedisce comunque,
  // ma da solo direbbe "FOREIGN KEY constraint failed": qui si dice cosa fare.
  const usi = getDb()
    .prepare('SELECT COUNT(*) AS n FROM seduta_esercizi WHERE esercizio_id = ?')
    .get(id) as { n: number }
  if (usi.n > 0) {
    throw new Error(
      `Questo esercizio è usato in ${usi.n === 1 ? 'una seduta' : `${usi.n} sedute`} già registrate e non si può eliminare: usa "Archivia" per toglierlo dall'elenco senza perdere quelle sedute.`
    )
  }
  // Lo stesso per le progressioni: l'esercizio e' uno step, e senza di lui la
  // scala avrebbe un buco. Si toglie prima dalla progressione.
  const progressioni = progressioniConEsercizio(id)
  if (progressioni.length > 0) {
    throw new Error(
      `Questo esercizio è uno step di ${progressioni.length === 1 ? 'una progressione' : 'più progressioni'} (${progressioni.join(', ')}): toglilo prima da lì, in Libreria → Progressioni.`
    )
  }
  eliminaConCestino('esercizi', id, 'Esercizio', nomeDi('esercizi', id))
}

export function leggiImmagine(id: number): string | null {
  const riga = getDb().prepare('SELECT immagine FROM esercizi WHERE id = ?').get(id) as
    | { immagine: string | null }
    | undefined
  if (!riga) throw new Error('Esercizio non trovato.')
  return riga.immagine
}

export function impostaImmagine(id: number, dataUrl: string | null): void {
  if (dataUrl != null && dataUrl.length > IMG_PESO_MAX) {
    throw new Error('Immagine troppo pesante.')
  }
  validaImmagine(dataUrl)
  getDb().prepare('UPDATE esercizi SET immagine = ? WHERE id = ?').run(dataUrl, id)
}
