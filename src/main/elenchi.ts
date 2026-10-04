// Gli elenchi che si mettono in ordine a mano: patologie, gruppi, categorie,
// fasi, questionari...
//
// Lo stesso codice era ripetuto per ogni elenco (leggere, creare in fondo,
// rinominare, eliminare nel cestino, riordinare): una correzione andava fatta
// tredici volte. Qui c'e' una volta sola. Gli elenchi fatti solo di un nome
// usano elencoSemplice per intero; quelli con piu' campi (le fasi di una
// patologia, i questionari) usano riordina e prossimoOrdine e scrivono a parte
// il resto.
import { getDb } from './db'
import { eliminaConCestino, nomeDi } from './cestino'

// Solo queste tabelle: il nome finisce dentro all'SQL, quindi non deve mai
// arrivare da fuori.
export type TabellaOrdinabile =
  | 'patologie'
  | 'gruppi'
  | 'distretti'
  | 'fasi'
  | 'obiettivi'
  | 'sezioni'
  | 'test_avanzamento'
  | 'categorie'
  | 'screening_protocolli'
  | 'questionario_categorie'
  | 'questionari'
  | 'test_categorie'
  | 'test_valutazione'
  | 'obiettivi_terapeutici'
  | 'indicazioni'
  | 'segni'

// L'ordine e' quello in cui arrivano gli id: il primo va in cima.
export function riordina(tabella: TabellaOrdinabile, ids: number[]): void {
  const db = getDb()
  const stmt = db.prepare(`UPDATE ${tabella} SET ordine = ? WHERE id = ?`)
  db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
}

// Il posto in fondo all'elenco, dove va una voce nuova. `dentro` per gli
// elenchi che stanno dentro a qualcos'altro (le fasi di una patologia).
export function prossimoOrdine(
  tabella: TabellaOrdinabile,
  dentro?: { colonna: string; id: number }
): number {
  const dove = dentro ? `WHERE ${dentro.colonna} = ?` : ''
  const parametri = dentro ? [dentro.id] : []
  return (
    getDb()
      .prepare(`SELECT COALESCE(MAX(ordine), -1) + 1 AS prossimo FROM ${tabella} ${dove}`)
      .get(...parametri) as { prossimo: number }
  ).prossimo
}

export interface ElencoSemplice {
  elenco(): unknown[]
  crea(nome: string): number
  rinomina(id: number, nome: string): void
  elimina(id: number): void
  riordina(ids: number[]): void
}

// Un elenco fatto solo di nomi, in un ordine deciso a mano. `etichetta` e'
// come la voce si presenta nel cestino ("Gruppo", "Categoria di test").
export function elencoSemplice(tabella: TabellaOrdinabile, etichetta: string): ElencoSemplice {
  const nomeValido = (nome: string): string => {
    const pulito = nome.trim()
    if (pulito === '') throw new Error('Scrivi il nome.')
    return pulito
  }
  return {
    elenco: () => getDb().prepare(`SELECT * FROM ${tabella} ORDER BY ordine, nome`).all(),
    crea: (nome) =>
      Number(
        getDb()
          .prepare(`INSERT INTO ${tabella} (nome, ordine) VALUES (?, ?)`)
          .run(nomeValido(nome), prossimoOrdine(tabella)).lastInsertRowid
      ),
    rinomina: (id, nome) => {
      getDb().prepare(`UPDATE ${tabella} SET nome = ? WHERE id = ?`).run(nomeValido(nome), id)
    },
    elimina: (id) => eliminaConCestino(tabella, id, etichetta, nomeDi(tabella, id)),
    riordina: (ids) => riordina(tabella, ids)
  }
}
