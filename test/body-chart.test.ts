// La body chart: i simboli e i tratti a mano libera.
import { test } from 'vitest'
import { archivioDiProva } from './archivio-di-prova'
import assert from 'node:assert/strict'
import { getDb } from '../src/main/db'
import { creaBodyChart, leggiBodyChart, salvaBodyChart } from '../src/main/body-chart'
import { sezBodyChart } from '../src/main/cartella-sezioni'
import {
  leggiPunti,
  percorsoTratto,
  PUNTI_MASSIMI,
  serializzaPunti,
  stratiTratto
} from '../src/shared/tratti'
import type { BodyChartCompleta, SegnoBodyChart } from '../src/shared/types'

archivioDiProva()

const paziente = (): number =>
  Number(
    getDb().prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Anna', 'Test')").run().lastInsertRowid
  )

const simbolo: SegnoBodyChart = {
  id: null,
  vista: 'fronte',
  tipo: 'dolore',
  x: 0.5,
  y: 0.4,
  dimensione: 1,
  intensita: 6,
  punti: null
}

test('Tratti: un puntino o un tratto lungo diventano un percorso, uno vuoto no', () => {
  assert.equal(percorsoTratto([], 260, 660), '')
  // un clic senza trascinare ha comunque una lunghezza, se no non si vedrebbe
  assert.match(percorsoTratto([[0.5, 0.5]], 260, 660), /^M130,330 L130\.1,330$/)
  assert.equal(percorsoTratto([[0, 0], [1, 1]], 100, 200), 'M0,0 L100,200')
  // la curva passa per il punto medio fra il secondo e il terzo campione
  assert.equal(percorsoTratto([[0, 0], [0.5, 0.5], [1, 0]], 100, 100), 'M0,0 Q50,50 75,25 L100,0')
})

test('Tratti: il pieno e una passata, il tenue quattro piu trasparenti e piu strette', () => {
  assert.deepEqual(stratiTratto('tratto', 10), [{ spessore: 10, opacita: 1 }])
  const tenue = stratiTratto('sfumato', 10)
  assert.equal(tenue.length, 4)
  assert.ok(tenue.every((s) => s.opacita < 0.2))
  assert.ok(tenue.every((s, i) => i === 0 || s.spessore < tenue[i - 1].spessore))
})

test('Tratti: i punti si salvano puliti e si rileggono, anche se il testo e rovinato', () => {
  assert.equal(serializzaPunti(null), null)
  assert.equal(serializzaPunti([]), null)
  // fuori dalla figura si riporta dentro, a quattro decimali
  assert.equal(
    serializzaPunti([[-1, 0.123456], [2, 0.5]]),
    JSON.stringify([[0, 0.1235], [1, 0.5]])
  )
  assert.equal(serializzaPunti([[0.1, 0.2]]) && leggiPunti(serializzaPunti([[0.1, 0.2]])!)?.length, 1)
  assert.equal(leggiPunti('non e json'), null)
  assert.equal(leggiPunti('{"a":1}'), null)
  assert.equal(leggiPunti(null), null)
  assert.deepEqual(leggiPunti('[[0.1,0.2],["x",1],[0.3,0.4]]'), [[0.1, 0.2], [0.3, 0.4]])
  const lungo = Array.from({ length: PUNTI_MASSIMI + 500 }, (): [number, number] => [0.5, 0.5])
  assert.equal(leggiPunti(serializzaPunti(lungo)!)?.length, PUNTI_MASSIMI)
})

test('Body chart: i tratti tornano com erano, e i simboli di prima non hanno punti', () => {
  const pz = paziente()
  const id = creaBodyChart(pz, '2026-10-01', 'corpo')
  const base = leggiBodyChart(id)
  const dati: BodyChartCompleta = {
    chart: base.chart,
    segni: [
      simbolo,
      {
        ...simbolo,
        tipo: 'tratto',
        x: 0.2,
        y: 0.3,
        dimensione: 1.5,
        intensita: null,
        punti: [[0.2, 0.3], [0.25, 0.35], [0.3, 0.4]]
      },
      {
        ...simbolo,
        vista: 'retro',
        tipo: 'sfumato',
        x: 0.6,
        y: 0.6,
        intensita: null,
        punti: [[0.6, 0.6], [0.7, 0.65]]
      },
      // dei punti su un simbolo non hanno senso: non si salvano
      { ...simbolo, tipo: 'scossa', punti: [[0.1, 0.1]] }
    ]
  }
  salvaBodyChart(dati)

  const letto = leggiBodyChart(id).segni
  assert.equal(letto.length, 4)
  assert.equal(letto[0].punti, null)
  assert.deepEqual(letto[1].punti, [[0.2, 0.3], [0.25, 0.35], [0.3, 0.4]])
  assert.equal(letto[1].dimensione, 1.5)
  assert.equal(letto[2].tipo, 'sfumato')
  assert.deepEqual(letto[2].punti, [[0.6, 0.6], [0.7, 0.65]])
  assert.equal(letto[3].punti, null)
})

test('Cartella: i tratti escono nella figura stampata, sotto ai simboli', () => {
  const pz = paziente()
  const id = creaBodyChart(pz, '2026-10-02', 'corpo')
  salvaBodyChart({
    chart: leggiBodyChart(id).chart,
    segni: [
      simbolo,
      { ...simbolo, tipo: 'tratto', intensita: null, punti: [[0.2, 0.3], [0.3, 0.4]] },
      { ...simbolo, tipo: 'sfumato', intensita: null, punti: [[0.5, 0.5], [0.6, 0.6]] }
    ]
  })
  const blocchi = sezBodyChart(pz)
  const figure = blocchi.find((b) => b.tipo === 'figure')
  assert.ok(figure && figure.tipo === 'figure')
  const fronte = figure.viste[0].svg
  // 1 passata del pieno + 4 del tenue
  assert.equal((fronte.match(/class="s-tratto"/g) ?? []).length, 5)
  assert.ok(
    fronte.indexOf('class="s-tratto"') < fronte.indexOf('class="s-dolore"'),
    'i tratti stanno sotto'
  )
  const legenda = blocchi.find((b) => b.tipo === 'testo')
  assert.ok(legenda && legenda.tipo === 'testo')
  assert.ok(legenda.corpo.includes('Disegno a mano libera'))
  assert.ok(legenda.corpo.includes('Area tenue'))
})
