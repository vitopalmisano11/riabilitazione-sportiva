// Gli elenchi che si mettono in ordine a mano (elenchi.ts): lo stesso codice
// per gruppi, categorie, fasi... provato una volta sola.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { archivioDiProva } from './archivio-di-prova'
import { getDb } from '../src/main/db'
import { elencoSemplice, prossimoOrdine, riordina } from '../src/main/elenchi'
import { elencoCestino, ripristina } from '../src/main/cestino'

// Un archivio cifrato tutto suo, in una cartella temporanea.
archivioDiProva()

test('Un elenco di nomi: si crea in fondo, si riordina, si rinomina, va nel cestino', () => {
  const gruppi = elencoSemplice('gruppi', 'Gruppo')
  const nomi = (): string[] => (gruppi.elenco() as { nome: string }[]).map((g) => g.nome)
  const centro = gruppi.crea('  Centro ')
  const studio = gruppi.crea('Studio')
  const domicilio = gruppi.crea('Domicilio')
  assert.deepEqual(nomi(), ['Centro', 'Studio', 'Domicilio'], 'in fondo, nell’ordine in cui si creano')
  gruppi.riordina([domicilio, centro, studio])
  assert.deepEqual(nomi(), ['Domicilio', 'Centro', 'Studio'])
  gruppi.rinomina(studio, 'Studio privato')
  assert.deepEqual(nomi(), ['Domicilio', 'Centro', 'Studio privato'])
  // un nome vuoto non si accetta, ne' nuovo ne' rinominando
  assert.throws(() => gruppi.crea('   '), /Scrivi il nome/)
  assert.throws(() => gruppi.rinomina(centro, ''), /Scrivi il nome/)

  // eliminato, si riconosce nel cestino dal nome, e torna al suo posto
  gruppi.elimina(centro)
  assert.deepEqual(nomi(), ['Domicilio', 'Studio privato'])
  const voce = elencoCestino().find((v) => v.tipo === 'Gruppo')!
  assert.equal(voce.etichetta, 'Centro')
  ripristina(voce.id)
  assert.deepEqual(nomi(), ['Domicilio', 'Centro', 'Studio privato'])
})

test("Il posto in fondo, anche per un elenco dentro a un altro (le fasi di una patologia)", () => {
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number => Number(c.prepare(sql).run(...a).lastInsertRowid)
  const lca = ins("INSERT INTO patologie (nome) VALUES ('LCA elenchi')")
  const spalla = ins("INSERT INTO patologie (nome) VALUES ('Spalla elenchi')")
  const dentro = (id: number): { colonna: string; id: number } => ({ colonna: 'patologia_id', id })
  assert.equal(prossimoOrdine('fasi', dentro(lca)), 0)
  const f1 = ins('INSERT INTO fasi (patologia_id, nome, ordine) VALUES (?, ?, ?)', lca, 'Acuta', prossimoOrdine('fasi', dentro(lca)))
  const f2 = ins('INSERT INTO fasi (patologia_id, nome, ordine) VALUES (?, ?, ?)', lca, 'Rinforzo', prossimoOrdine('fasi', dentro(lca)))
  assert.equal(prossimoOrdine('fasi', dentro(lca)), 2)
  assert.equal(prossimoOrdine('fasi', dentro(spalla)), 0, 'ogni patologia ha le sue')
  riordina('fasi', [f2, f1])
  assert.deepEqual(
    (c.prepare('SELECT nome FROM fasi WHERE patologia_id = ? ORDER BY ordine').all(lca) as { nome: string }[]).map((f) => f.nome),
    ['Rinforzo', 'Acuta']
  )
})
