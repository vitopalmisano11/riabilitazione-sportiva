// La seduta in costruzione senza schermata (src/renderer/src/components/seduta/modello.ts):
// le sezioni con la loro storia per Ctrl+Z, cosa proporre, la bozza e quello che si salva.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import type { Categoria, EsercizioConCategoria, Segno, UltimaVolta } from '../src/shared/types'
import {
  bozzaVuota,
  campiDaBozza,
  daProporre,
  haQualcosa,
  inBozza,
  inputSeduta,
  misuraNonNumerica,
  mostraCluster,
  riduciSezioni,
  type AzioneSezioni,
  type CampiSeduta,
  type StatoSezioni
} from '../src/renderer/src/components/seduta/modello'

const esercizio = (id: number, nome: string, categoria_id: number, categoria_nome: string): EsercizioConCategoria =>
  ({
    id,
    nome,
    categoria_id,
    categoria_nome,
    serie_default: '3',
    cluster_default: null,
    ripetizioni_default: '10',
    rir_default: null,
    carico_default: '20',
    unita_carico: 'kg',
    recupero_cluster_default: null,
    recupero_default: null,
    nota_tecnica: null,
    link: null,
    ha_immagine: 0
  }) as unknown as EsercizioConCategoria

const categoria = (id: number, nome: string, padre_id: number | null = null, cluster = 0): Categoria =>
  ({ id, nome, padre_id, ordine: id, dosaggio_cluster: cluster, dosaggio_rir: 0 }) as unknown as Categoria

const squat = esercizio(1, 'Squat', 10, 'Rinforzo')
const ponte = esercizio(2, 'Ponte', 10, 'Rinforzo')
const plank = esercizio(3, 'Plank', 20, 'Core')

const tutte = (azioni: AzioneSezioni[], da?: StatoSezioni): StatoSezioni =>
  azioni.reduce(riduciSezioni, da ?? { sezioni: [{ sezione_id: 5, nome: 'Forza', righe: [] }], storia: [] })

const nomi = (s: StatoSezioni, sez = 0): string[] => s.sezioni[sez].righe.map((r) => r.nome)

test('Aggiungere: dalla libreria con i suoi dosaggi, raggruppati per categoria, una volta sola', () => {
  const s = tutte([
    { tipo: 'aggiungi', sez: 0, esercizio: squat },
    { tipo: 'aggiungi', sez: 0, esercizio: plank },
    { tipo: 'aggiungi', sez: 0, esercizio: ponte },
    { tipo: 'aggiungi', sez: 0, esercizio: squat }
  ])
  // il ponte va dopo l'ultimo della sua categoria, non in fondo
  assert.deepEqual(nomi(s), ['Squat', 'Ponte', 'Plank'])
  assert.equal(s.sezioni[0].righe[0].serie, '3')
  assert.equal(s.sezioni[0].righe[0].carico, '20')
  // il doppione non entra e non sporca la storia
  assert.equal(s.storia.length, 3)
})

test('Ctrl+Z: annulla i cambiamenti, non le lettere scritte', () => {
  let s = tutte([{ tipo: 'aggiungi', sez: 0, esercizio: squat }])
  s = riduciSezioni(s, { tipo: 'valore', sez: 0, riga: 0, campo: 'carico', valore: '25' })
  assert.equal(s.storia.length, 1, 'scrivere in una casella non entra nella storia')
  s = riduciSezioni(s, { tipo: 'togliRiga', sez: 0, riga: 0 })
  assert.deepEqual(nomi(s), [])
  assert.equal(s.storia.at(-1)!.cosa, 'tolto Squat')
  s = riduciSezioni(s, { tipo: 'annulla' })
  assert.deepEqual(nomi(s), ['Squat'])
  assert.equal(s.sezioni[0].righe[0].carico, '25', 'torna com\'era, con il carico scritto')
  s = riduciSezioni(s, { tipo: 'annulla' })
  assert.deepEqual(nomi(s), [])
  // niente da annullare: lo stato resta lo stesso oggetto
  assert.equal(riduciSezioni(s, { tipo: 'annulla' }), s)
})

test('Trascinare: nella storia solo il primo passo', () => {
  let s = tutte([
    { tipo: 'aggiungi', sez: 0, esercizio: squat },
    { tipo: 'aggiungi', sez: 0, esercizio: plank },
    { tipo: 'alVolo', sez: 0, nome: '  Affondo  ', chiave: -1 }
  ])
  assert.deepEqual(nomi(s), ['Squat', 'Plank', 'Affondo'])
  const prima = s.storia.length
  s = riduciSezioni(s, { tipo: 'spostaRiga', sez: 0, da: 0, a: 1, primo: true })
  s = riduciSezioni(s, { tipo: 'spostaRiga', sez: 0, da: 1, a: 2, primo: false })
  assert.deepEqual(nomi(s), ['Plank', 'Affondo', 'Squat'])
  assert.equal(s.storia.length, prima + 1)
  s = riduciSezioni(s, { tipo: 'annulla' })
  assert.deepEqual(nomi(s), ['Squat', 'Plank', 'Affondo'], 'un Ctrl+Z annulla tutto il trascinamento')
})

test('Sezioni: rinominare, aggiungere, togliere; i nomi vuoti non contano', () => {
  let s = tutte([
    { tipo: 'rinomina', sez: 0, nome: ' Rinforzo ' },
    { tipo: 'nuovaSezione', nome: 'Defaticamento' },
    { tipo: 'nuovaSezione', nome: '   ' },
    { tipo: 'rinomina', sez: 1, nome: '' }
  ])
  assert.deepEqual(
    s.sezioni.map((x) => [x.nome, x.sezione_id]),
    [
      ['Rinforzo', 5],
      ['Defaticamento', null]
    ]
  )
  assert.equal(s.storia.length, 2)
  s = riduciSezioni(s, { tipo: 'togliSezione', sez: 0 })
  assert.deepEqual(s.sezioni.map((x) => x.nome), ['Defaticamento'])
  s = riduciSezioni(s, { tipo: 'annulla' })
  assert.deepEqual(s.sezioni.map((x) => x.nome), ['Rinforzo', 'Defaticamento'])
})

test('Ricopiare l\'ultima volta rimette tutti i numeri, la nota no', () => {
  const ultima = {
    esercizio_id: 1,
    data: '2026-09-01',
    serie: '4',
    cluster: null,
    ripetizioni: '8',
    rir: '2',
    carico: '30',
    recupero_cluster: null,
    recupero: '90"'
  } as UltimaVolta
  let s = tutte([{ tipo: 'aggiungi', sez: 0, esercizio: squat }])
  s = riduciSezioni(s, { tipo: 'valore', sez: 0, riga: 0, campo: 'nota', valore: 'lento' })
  s = riduciSezioni(s, { tipo: 'ricopia', sez: 0, riga: 0, ultima })
  const r = s.sezioni[0].righe[0]
  assert.deepEqual([r.serie, r.ripetizioni, r.rir, r.carico, r.recupero, r.nota], ['4', '8', '2', '30', '90"', 'lento'])
})

test('Proposte: le categorie della sezione con le loro sottocategorie; cercando, nome o categoria', () => {
  const categorie = [categoria(10, 'Rinforzo'), categoria(11, 'Quadricipite', 10), categoria(20, 'Core')]
  const quad = esercizio(4, 'Leg extension', 11, 'Quadricipite')
  const libreria = [squat, ponte, plank, quad]
  const sezione = { sezione_id: 5, nome: 'Forza', righe: [] }
  const template = { 5: [10] }
  assert.deepEqual(
    daProporre(sezione, '', template, categorie, libreria).map((e) => e.nome),
    ['Squat', 'Ponte', 'Leg extension']
  )
  // quello che c'e' gia' non si ripropone
  const conSquat = tutte([{ tipo: 'aggiungi', sez: 0, esercizio: squat }]).sezioni[0]
  assert.deepEqual(daProporre(conSquat, '', template, categorie, libreria).map((e) => e.nome), [
    'Ponte',
    'Leg extension'
  ])
  // cercando si trova in tutta la libreria, anche per categoria
  assert.deepEqual(daProporre(sezione, 'core', template, categorie, libreria).map((e) => e.nome), ['Plank'])
  assert.deepEqual(daProporre(sezione, 'PLA', template, categorie, libreria).map((e) => e.nome), ['Plank'])
  // una sezione aggiunta a mano non ha proposte, ma la ricerca funziona
  const libera = { sezione_id: null, nome: 'Extra', righe: [] }
  assert.deepEqual(daProporre(libera, '', template, categorie, libreria), [])
  assert.deepEqual(daProporre(libera, 'squat', template, categorie, libreria).map((e) => e.nome), ['Squat'])
})

test('Cluster: si mostra dove la categoria lo prevede o dove c\'e\' gia\' un valore', () => {
  const categorie = [categoria(10, 'Rinforzo'), categoria(30, 'Pliometria', null, 1)]
  assert.equal(mostraCluster({ categoria_nome: 'Rinforzo', cluster: null }, categorie), false)
  assert.equal(mostraCluster({ categoria_nome: 'Pliometria', cluster: null }, categorie), true)
  assert.equal(mostraCluster({ categoria_nome: 'Rinforzo', cluster: '3' }, categorie), true)
  assert.equal(mostraCluster({ categoria_nome: null, cluster: null }, categorie), false)
})

const campi = (p: Partial<CampiSeduta> = {}): CampiSeduta => ({
  data: '2026-10-05',
  ora: '',
  faseId: 7,
  faseNome: 'Fase 2',
  focus: '',
  dolore: '',
  sforzo: '',
  misure: {},
  note: '',
  riferitoAndamento: null,
  riferito: '',
  tecnicaIds: [],
  trattamento: '',
  ...p
})

test('Bozza: vuota non si scrive; scritta e ripresa torna uguale, compatibile con quelle di prima', () => {
  assert.equal(bozzaVuota(campi(), []), true)
  assert.equal(bozzaVuota(campi({ focus: 'corsa' }), []), false)
  // dolore e misure non stanno nella bozza: da soli non la fanno scrivere
  assert.equal(bozzaVuota(campi({ dolore: '3' }), []), true)
  const sezioni = tutte([{ tipo: 'aggiungi', sez: 0, esercizio: squat }]).sezioni
  assert.equal(bozzaVuota(campi(), sezioni), false)

  const c = campi({ ora: '09:30', focus: 'corsa', note: 'n', riferito: 'meglio', tecnicaIds: [2], trattamento: 'tecar' })
  const b = JSON.parse(JSON.stringify(inBozza(c, sezioni)))
  // la forma scritta dalle versioni di prima
  assert.deepEqual(Object.keys(b).sort(), [
    'data',
    'faseId',
    'focus',
    'note',
    'ora',
    'riferito',
    'riferitoAndamento',
    'sezioni',
    'tecnicaIds',
    'trattamento'
  ])
  const ripresi = campiDaBozza(b)
  for (const k of ['data', 'ora', 'focus', 'note', 'riferito', 'tecnicaIds', 'trattamento'] as const) {
    assert.deepEqual(ripresi[k], c[k], k)
  }
  // una bozza vecchia, senza i campi aggiunti dopo
  const vecchia = campiDaBozza({ data: '2026-01-01', faseId: null, note: 'x', sezioni: [] })
  assert.deepEqual([vecchia.ora, vecchia.focus, vecchia.riferito, vecchia.tecnicaIds], ['', '', '', []])
})

test('Salvare: cosa c\'e\' da salvare, le misure e i numeri vuoti', () => {
  assert.equal(haQualcosa(campi(), []), false)
  assert.equal(haQualcosa(campi({ tecnicaIds: [1] }), []), true)
  assert.equal(haQualcosa(campi({ note: '  ' }), []), false)

  const segni = [
    { id: 1, nome: 'Flessione', unita: '°' },
    { id: 2, nome: 'Dolore squat', unita: null }
  ] as unknown as Segno[]
  assert.equal(misuraNonNumerica(segni, { 1: '120', 2: '' }), null)
  assert.equal(misuraNonNumerica(segni, { 1: '5-6' })?.nome, 'Flessione')

  const sezioni = tutte([
    { tipo: 'aggiungi', sez: 0, esercizio: squat },
    { tipo: 'valore', sez: 0, riga: 0, campo: 'nota', valore: '  ' },
    { tipo: 'nuovaSezione', nome: 'Extra' },
    { tipo: 'alVolo', sez: 1, nome: 'Corsa', chiave: -1 }
  ]).sezioni
  const input = inputSeduta(42, campi({ dolore: '3', misure: { 1: '7,5', 2: '' }, focus: ' corsa ' }), sezioni, segni)
  assert.equal(input.paziente_id, 42)
  assert.equal(input.dolore, 3)
  assert.equal(input.sforzo, null)
  assert.equal(input.ora, null)
  assert.equal(input.focus, 'corsa')
  assert.deepEqual(input.segni, [{ segno_id: 1, valore: 7.5 }], 'la virgola vale, il vuoto non e\' zero')
  assert.deepEqual(input.sezioni, [
    { sezione_id: 5, nome: 'Forza' },
    { sezione_id: null, nome: 'Extra' }
  ])
  assert.deepEqual(
    input.esercizi.map((e) => [e.esercizio_id, e.nome_libero, e.nota, e.sezioneIndex]),
    [
      [1, null, null, 0],
      [null, 'Corsa', null, 1]
    ]
  )
})
