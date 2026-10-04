// Il percorso: patologie, fasi (palestra e campo), obiettivi, sezioni e test di
// avanzamento (percorso.ts).
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { archivioDiProva } from './archivio-di-prova'
import { getDb } from '../src/main/db'
import {
  creaFase,
  creaObiettivo,
  creaPatologia,
  creaSezione,
  creaTestAvanzamento,
  elencoFasi,
  elencoObiettivi,
  elencoPatologie,
  elencoSezioni,
  elencoTestAvanzamento,
  eliminaFase,
  eliminaObiettivo,
  eliminaPatologia,
  eliminaSezione,
  impostaCampo,
  impostaCategorieSezione,
  rinominaFase,
  rinominaPatologia
} from '../src/main/percorso'
import { riordina } from '../src/main/elenchi'
import { elencoCestino, ripristina } from '../src/main/cestino'

// Un archivio cifrato tutto suo, in una cartella temporanea.
archivioDiProva()

const nomi = (righe: unknown[]): string[] => (righe as { nome: string }[]).map((r) => r.nome)

test('Patologie: si creano in fondo, si rinominano, si riordinano', () => {
  const a = creaPatologia('  LCA percorso ')
  const b = creaPatologia('Spalla percorso')
  const mie = (): string[] => nomi(elencoPatologie()).filter((n) => n.endsWith('percorso'))
  assert.deepEqual(mie(), ['LCA percorso', 'Spalla percorso'])
  riordina('patologie', [b, a])
  assert.deepEqual(mie(), ['Spalla percorso', 'LCA percorso'])
  rinominaPatologia(a, 'LCA ricostruzione percorso')
  assert.ok(mie().includes('LCA ricostruzione percorso'))
  // l'interruttore del campo
  assert.equal((elencoPatologie() as { id: number; ha_campo: number }[]).find((p) => p.id === a)!.ha_campo, 0)
  impostaCampo(a, true)
  assert.equal((elencoPatologie() as { id: number; ha_campo: number }[]).find((p) => p.id === a)!.ha_campo, 1)
})

test('Fasi: palestra e campo sono due elenchi, ognuno con la sua numerazione', () => {
  const pat = creaPatologia('Fasi percorso')
  const acuta = creaFase(pat, 'Acuta')
  const forza = creaFase(pat, 'Forza')
  const corsa = creaFase(pat, 'Corsa', true)
  const sport = creaFase(pat, 'Sport', true)
  const ordine = (id: number): number => (elencoFasi(pat) as { id: number; ordine: number }[]).find((f) => f.id === id)!.ordine
  assert.deepEqual([ordine(acuta), ordine(forza)], [0, 1])
  assert.deepEqual([ordine(corsa), ordine(sport)], [0, 1], 'il campo riparte da zero')
  // l'elenco mette prima la palestra, poi il campo
  assert.deepEqual(nomi(elencoFasi(pat)), ['Acuta', 'Forza', 'Corsa', 'Sport'])
  rinominaFase(forza, 'Rinforzo')
  riordina('fasi', [forza, acuta])
  assert.deepEqual(nomi(elencoFasi(pat)).slice(0, 2), ['Rinforzo', 'Acuta'])
  // un'altra patologia ha le sue fasi
  assert.deepEqual(elencoFasi(creaPatologia('Altra percorso')), [])
})

test('Obiettivi, sezioni e test di avanzamento: ognuno nella sua fase, in ordine', () => {
  const pat = creaPatologia('Dentro percorso')
  const f1 = creaFase(pat, 'Prima')
  const f2 = creaFase(pat, 'Seconda')
  const o1 = creaObiettivo(f1, ' Estensione ')
  creaObiettivo(f1, 'Flessione')
  creaObiettivo(f2, 'Corsa')
  assert.deepEqual(nomi(elencoObiettivi(f1)), ['Estensione', 'Flessione'])
  assert.deepEqual(nomi(elencoObiettivi(f2)), ['Corsa'], 'la numerazione e\' per fase')
  assert.equal((elencoObiettivi(f2) as { ordine: number }[])[0].ordine, 0)

  creaTestAvanzamento(f1, 'Hop test')
  creaTestAvanzamento(f1, 'Squat')
  assert.deepEqual(nomi(elencoTestAvanzamento(f1)), ['Hop test', 'Squat'])
  assert.deepEqual(elencoTestAvanzamento(f2), [])

  const riscaldamento = creaSezione(f1, 'Riscaldamento')
  const rinforzo = creaSezione(f1, 'Rinforzo')
  assert.deepEqual(nomi(elencoSezioni(f1)), ['Riscaldamento', 'Rinforzo'])

  // le categorie proposte da una sezione, nell'ordine scelto, e riscrivibili
  const c = (nome: string): number =>
    Number(getDb().prepare('INSERT INTO categorie (nome) VALUES (?)').run(nome).lastInsertRowid)
  const mob = c('Mobilita percorso')
  const forzaCat = c('Forza percorso')
  const core = c('Core percorso')
  impostaCategorieSezione(rinforzo, [forzaCat, core, mob])
  const letta = (id: number): number[] =>
    (elencoSezioni(f1) as { id: number; categoria_ids: number[] }[]).find((s) => s.id === id)!.categoria_ids
  assert.deepEqual(letta(rinforzo), [forzaCat, core, mob])
  impostaCategorieSezione(rinforzo, [mob])
  assert.deepEqual(letta(rinforzo), [mob])
  assert.deepEqual(letta(riscaldamento), [])

  // eliminati finiscono nel cestino col nome, e tornano come prima
  eliminaObiettivo(o1)
  assert.deepEqual(nomi(elencoObiettivi(f1)), ['Flessione'])
  const voce = elencoCestino().find((v) => v.tipo === 'Obiettivo' && v.etichetta === 'Estensione')!
  ripristina(voce.id)
  assert.deepEqual(nomi(elencoObiettivi(f1)).sort(), ['Estensione', 'Flessione'])
  eliminaSezione(riscaldamento)
  assert.deepEqual(nomi(elencoSezioni(f1)), ['Rinforzo'])
})

test('Eliminare una patologia porta con se\' fasi, obiettivi e test, e il cestino li rimette tutti', () => {
  const pat = creaPatologia('Cascata percorso')
  const fase = creaFase(pat, 'Unica')
  creaObiettivo(fase, 'Obiettivo uno')
  creaTestAvanzamento(fase, 'Test uno')
  creaSezione(fase, 'Sezione una')
  eliminaPatologia(pat)
  assert.ok(!nomi(elencoPatologie()).includes('Cascata percorso'))
  assert.equal(
    (getDb().prepare('SELECT COUNT(*) AS n FROM fasi WHERE patologia_id = ?').get(pat) as { n: number }).n,
    0
  )
  const voce = elencoCestino().find((v) => v.etichetta === 'Cascata percorso')!
  ripristina(voce.id)
  assert.deepEqual(nomi(elencoFasi(pat)), ['Unica'])
  assert.deepEqual(nomi(elencoObiettivi(fase)), ['Obiettivo uno'])
  assert.deepEqual(nomi(elencoTestAvanzamento(fase)), ['Test uno'])
  assert.deepEqual(nomi(elencoSezioni(fase)), ['Sezione una'])
  // una fase eliminata da sola
  eliminaFase(fase)
  assert.deepEqual(elencoFasi(pat), [])
})
