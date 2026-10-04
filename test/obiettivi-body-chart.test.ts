// Obiettivi terapeutici e body chart (obiettivi-terapeutici.ts, body-chart.ts).
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { archivioDiProva } from './archivio-di-prova'
import { getDb } from '../src/main/db'
import {
  aggiornaObiettivoTerapeutico,
  creaObiettivoTerapeutico,
  elencoObiettiviTerapeutici,
  leggiAspettative,
  salvaAspettative,
  togliObiettivoTerapeutico
} from '../src/main/obiettivi-terapeutici'
import {
  creaBodyChart,
  elencoBodyChart,
  eliminaBodyChart,
  leggiBodyChart,
  salvaBodyChart
} from '../src/main/body-chart'
import { riordina } from '../src/main/elenchi'
import { elencoCestino, ripristina } from '../src/main/cestino'
import type { BodyChartCompleta, TermineObiettivo } from '../src/shared/types'

// Un archivio cifrato tutto suo, in una cartella temporanea.
archivioDiProva()

const paziente = (cognome: string): number =>
  Number(getDb().prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Ob', ?)").run(cognome).lastInsertRowid)

test('Aspettative: si scrivono sul paziente, ripulite, e vuote diventano nessuna', () => {
  const pz = paziente('Aspettative')
  assert.equal(leggiAspettative(pz), null)
  salvaAspettative(pz, '  Tornare a giocare a marzo  ')
  assert.equal(leggiAspettative(pz), 'Tornare a giocare a marzo')
  salvaAspettative(pz, '   ')
  assert.equal(leggiAspettative(pz), null)
  assert.equal(leggiAspettative(999999), null, 'un paziente che non c\'e\' non da\' errore')
})

test('Obiettivi terapeutici: per paziente, in ordine, si modificano e si riordinano', () => {
  const a = paziente('Obiettivi A')
  const b = paziente('Obiettivi B')
  const breve = 'breve' as TermineObiettivo
  const lungo = 'lungo' as TermineObiettivo
  const o1 = creaObiettivoTerapeutico(a, '  Camminare senza dolore ', breve)
  const o2 = creaObiettivoTerapeutico(a, 'Tornare a correre', lungo)
  creaObiettivoTerapeutico(b, 'Solo di B', breve)
  const testi = (pz: number): string[] =>
    (elencoObiettiviTerapeutici(pz) as { testo: string }[]).map((o) => o.testo)
  assert.deepEqual(testi(a), ['Camminare senza dolore', 'Tornare a correre'])
  assert.deepEqual(testi(b), ['Solo di B'])
  // la numerazione e' per paziente
  assert.equal(
    (getDb().prepare('SELECT ordine FROM obiettivi_terapeutici WHERE paziente_id = ?').get(b) as { ordine: number }).ordine,
    0
  )
  aggiornaObiettivoTerapeutico(o1, 'Camminare senza stampelle', lungo)
  const letto = (elencoObiettiviTerapeutici(a) as { id: number; testo: string; termine: string }[]).find((o) => o.id === o1)!
  assert.deepEqual([letto.testo, letto.termine], ['Camminare senza stampelle', 'lungo'])
  riordina('obiettivi_terapeutici', [o2, o1])
  assert.deepEqual(testi(a), ['Tornare a correre', 'Camminare senza stampelle'])
  togliObiettivoTerapeutico(o2)
  assert.deepEqual(testi(a), ['Camminare senza stampelle'])
})

function chart(id: number, segni: BodyChartCompleta['segni'], note: string | null): BodyChartCompleta {
  return {
    chart: { id, paziente_id: 0, data: '2026-09-10', note, tipo: 'corpo' } as unknown as BodyChartCompleta['chart'],
    segni
  }
}
const segno = (x: number, vista = 'fronte'): BodyChartCompleta['segni'][number] =>
  ({ id: 0, vista, tipo: 'dolore', x, y: 0.5, dimensione: 1, intensita: 5 }) as unknown as BodyChartCompleta['segni'][number]

test('Body chart: si crea, si riempie di segni, si rilegge e si riscrive', () => {
  const pz = paziente('Body chart')
  assert.throws(() => creaBodyChart(pz, '', 'corpo'), /data/i)
  const id = creaBodyChart(pz, '2026-09-10', 'corpo')
  assert.deepEqual(leggiBodyChart(id).segni, [])

  salvaBodyChart(chart(id, [segno(0.1), segno(0.2, 'retro'), segno(0.3)], 'dopo la partita'))
  const letta = leggiBodyChart(id)
  assert.equal(letta.chart.note, 'dopo la partita')
  assert.deepEqual(letta.segni.map((s) => s.x), [0.1, 0.2, 0.3], 'nell\'ordine in cui sono stati messi')
  assert.deepEqual(letta.segni.map((s) => s.vista), ['fronte', 'retro', 'fronte'])

  // riscrivendo, i segni di prima non restano
  salvaBodyChart(chart(id, [segno(0.9)], null))
  assert.deepEqual(leggiBodyChart(id).segni.map((s) => s.x), [0.9])
  assert.equal(leggiBodyChart(id).chart.note, null)
  assert.throws(() => salvaBodyChart({ ...chart(id, [], null), chart: { ...chart(id, [], null).chart, data: 'ieri' } }), /data/i)
  assert.throws(() => leggiBodyChart(999999), /non trovata/)

  // l'elenco dice quanti segni ha ognuna, dalla piu' recente; il tipo non riconosciuto e' "corpo"
  const piede = creaBodyChart(pz, '2026-09-12', 'piede')
  const strano = creaBodyChart(pz, '2026-09-11', 'altro' as never)
  const elenco = elencoBodyChart(pz) as { id: number; tipo: string; num_segni: number }[]
  assert.deepEqual(elenco.map((c) => c.id), [piede, strano, id])
  assert.deepEqual(elenco.map((c) => c.tipo), ['piede', 'corpo', 'corpo'])
  assert.equal(elenco[2].num_segni, 1)

  // eliminata, va nel cestino con la sua data e coi segni, e torna com'era
  eliminaBodyChart(id)
  assert.ok(!(elencoBodyChart(pz) as { id: number }[]).some((c) => c.id === id))
  const voce = elencoCestino().find((v) => v.etichetta === 'Body chart del 10/09/2026')!
  ripristina(voce.id)
  assert.deepEqual(leggiBodyChart(id).segni.map((s) => s.x), [0.9])
})
