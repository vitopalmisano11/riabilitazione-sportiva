// I referti del paziente (foto e PDF di esami, RX, risonanze): stanno
// nell'archivio cifrato come byte del file, dalla migrazione 56. Prima erano un
// data URL di testo: chi legge accetta tutte e due le forme, cosi' un archivio
// che la migrazione non e' riuscita a convertire si legge lo stesso.
//
// Senza niente di Electron (modello: sedute.ts): la scelta del file e la
// riduzione delle foto stanno in ipc.ts; le prove sono in test/referti.test.ts.
import { getDb } from './db'
import { eliminaConCestino, nomeDi } from './cestino'
import { prossimoOrdine } from './elenchi'

export const PESO_MASSIMO_REFERTO = 12 * 1024 * 1024

export interface VoceReferto {
  id: number
  nome: string
  tipo: string
  data: string
}

export function elencoReferti(pazienteId: number): VoceReferto[] {
  return getDb()
    .prepare('SELECT id, nome, tipo, data FROM bioimmagini WHERE paziente_id = ? ORDER BY ordine, id')
    .all(pazienteId) as VoceReferto[]
}

// Un referto in fondo all'elenco del paziente, con la data di oggi.
export function aggiungiReferto(pazienteId: number, nome: string, tipo: string, dati: Buffer): number {
  if (dati.length === 0) throw new Error('Il file del referto è vuoto.')
  if (dati.length > PESO_MASSIMO_REFERTO) throw new Error('Il referto è troppo pesante (oltre 12 MB).')
  const db = getDb()
  return Number(
    db
      .prepare(
        `INSERT INTO bioimmagini (paziente_id, nome, tipo, contenuto, data, ordine)
         VALUES (?, ?, ?, ?, date('now', 'localtime'), ?)`
      )
      .run(pazienteId, nome, tipo, dati, prossimoOrdine('bioimmagini', { colonna: 'paziente_id', id: pazienteId }))
      .lastInsertRowid
  )
}

// I byte di un referto, da qualunque delle due forme sia salvato.
export function byteDelReferto(contenuto: unknown): Buffer {
  if (Buffer.isBuffer(contenuto)) return contenuto
  if (contenuto instanceof Uint8Array) return Buffer.from(contenuto)
  if (typeof contenuto === 'string') {
    const virgola = contenuto.indexOf(',')
    return Buffer.from(contenuto.slice(virgola + 1), 'base64')
  }
  throw new Error('Il referto non è leggibile.')
}

export function leggiReferto(id: number): { nome: string; tipo: string; dati: Buffer } {
  const riga = getDb().prepare('SELECT nome, tipo, contenuto FROM bioimmagini WHERE id = ?').get(id) as
    | { nome: string; tipo: string; contenuto: unknown }
    | undefined
  if (!riga) throw new Error('Referto non trovato.')
  return { nome: riga.nome, tipo: riga.tipo, dati: byteDelReferto(riga.contenuto) }
}

export function eliminaReferto(id: number): void {
  eliminaConCestino('bioimmagini', id, 'Documento', nomeDi('bioimmagini', id))
}
