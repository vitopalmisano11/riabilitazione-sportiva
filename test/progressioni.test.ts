// Le progressioni di esercizi a step: la scala, il collegamento alle fasi e lo
// step a cui e' arrivato il paziente (progressioni.ts, shared/progressioni.ts).
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { archivioDiProva } from './archivio-di-prova'
import { getDb } from '../src/main/db'
import { creaCategoria, creaEsercizio, eliminaEsercizio } from '../src/main/esercizi'
import {
  aggiornaProgressione,
  aggiungiStep,
  creaProgressione,
  elencoProgressioni,
  eliminaProgressione,
  gruppiProgressioni,
  impostaProgressioniFase,
  progressioniDellaFase,
  statoProgressioni,
  togliStep
} from '../src/main/progressioni'
import { aggiornaSeduta, creaSeduta, eliminaSeduta, leggiSeduta, programmaSeduta } from '../src/main/sedute'
import { elencoCestino, ripristina } from '../src/main/cestino'
import { posizioneInProgressione } from '../src/shared/progressioni'
import type { EsercizioInput, EsitoProgressione, SedutaInput } from '../src/shared/types'

archivioDiProva()

const ins = (sql: string, ...a: unknown[]): number => Number(getDb().prepare(sql).run(...a).lastInsertRowid)

function esercizio(categoria_id: number, nome: string): number {
  return creaEsercizio({
    nome,
    categoria_id,
    serie_default: null,
    cluster_default: null,
    ripetizioni_default: null,
    rir_default: null,
    carico_default: null,
    unita_carico: null,
    recupero_cluster_default: null,
    recupero_default: null,
    nota_tecnica: null,
    link: null
  } as EsercizioInput)
}

function seduta(
  pazienteId: number,
  faseId: number | null,
  data: string,
  progressioni: { progressione_id: number; esito: EsitoProgressione }[] = []
): number {
  const input: SedutaInput = {
    paziente_id: pazienteId,
    data,
    ora: null,
    fase_id: faseId,
    focus: null,
    dolore: null,
    sforzo: null,
    segni: [],
    riferito_andamento: null,
    riferito: null,
    tecnica_ids: [],
    trattamento: null,
    note: null,
    sezioni: [],
    esercizi: [],
    progressioni
  }
  return creaSeduta(input)
}

// Una patologia con una fase, un paziente, e la progressione "Vertical braking"
// di tre step (wall sit, front squat, drop catch) dentro al gruppo "Braking".
function scenario(): {
  paz: number
  fase: number
  prog: number
  gruppo: number
  esercizi: number[]
} {
  const cat = creaCategoria(`Prog ${Math.random()}`)
  const esercizi = ['Wall sit', 'Front squat', 'Drop catch'].map((n) => esercizio(cat, `${n} ${Math.random()}`))
  const pat = ins('INSERT INTO patologie (nome) VALUES (?)', `Pat ${Math.random()}`)
  const fase = ins("INSERT INTO fasi (patologia_id, nome, ordine) VALUES (?, 'Intermedia', 0)", pat)
  const paz = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Prova', 'Progressioni')")
  const gruppo = gruppiProgressioni.crea(`Braking ${Math.random()}`)
  const prog = creaProgressione('Vertical braking', gruppo)
  esercizi.forEach((e, i) => aggiungiStep(prog, e, i === 2 ? 'solo se il front squat è di qualità' : null))
  impostaProgressioniFase(fase, { gruppo_ids: [gruppo], progressione_ids: [] })
  return { paz, fase, prog, gruppo, esercizi }
}

const stato = (paz: number, fase: number, finoAl = '2099-12-31', escludi: number | null = null) =>
  statoProgressioni(paz, fase, finoAl, escludi)

test('Il calcolo: avanza, continua, indietro e la fine della scala', () => {
  const p = posizioneInProgressione(3, [
    { data: '2026-09-01', esito: 'avanza' },
    { data: '2026-09-08', esito: 'avanza' },
    { data: '2026-09-15', esito: 'indietro' }
  ])
  assert.equal(p.posizione, 1)
  assert.deepEqual(p.superato_il, ['2026-09-01', null, null])
  // tornare indietro riporta lo step da fare, con la data in cui e' successo
  assert.equal(p.rivisto_il[1], '2026-09-15')
  assert.equal(p.attuale_dal, '2026-09-15')

  // senza esiti si parte dal primo; non si va sotto zero ne' oltre l'ultimo
  assert.equal(posizioneInProgressione(3, []).posizione, 0)
  assert.equal(posizioneInProgressione(3, [{ data: '2026-09-01', esito: 'indietro' }]).posizione, 0)
  const tutti = posizioneInProgressione(2, [
    { data: '2026-09-01', esito: 'avanza' },
    { data: '2026-09-02', esito: 'avanza' },
    { data: '2026-09-03', esito: 'avanza' }
  ])
  assert.equal(tutti.posizione, 2)
  // dopo un "indietro" il superamento successivo cancella la nota
  const poi = posizioneInProgressione(3, [
    { data: '2026-09-01', esito: 'avanza' },
    { data: '2026-09-02', esito: 'indietro' },
    { data: '2026-09-03', esito: 'avanza' }
  ])
  assert.equal(poi.rivisto_il[0], null)
  assert.equal(poi.superato_il[0], '2026-09-03')
})

test('Lo step del paziente si ricava dalle sedute: contano solo quelle fino al giorno', () => {
  const { paz, fase, prog } = scenario()
  const s = (...a: Parameters<typeof stato>) => stato(...a)[0]

  // nessuna seduta: primo step da fare, tutti gli altri da sbloccare
  let r = s(paz, fase)
  assert.equal(r.posizione, 0)
  assert.deepEqual(r.step.map((x) => x.stato), ['attuale', 'da_sbloccare', 'da_sbloccare'])
  assert.equal(r.step[2].requisito, 'solo se il front squat è di qualità')
  assert.equal(r.gruppo_nome?.startsWith('Braking'), true)

  seduta(paz, fase, '2026-09-01', [{ progressione_id: prog, esito: 'avanza' }])
  seduta(paz, fase, '2026-09-08') // "continua": niente da scrivere
  const terza = seduta(paz, fase, '2026-09-15', [{ progressione_id: prog, esito: 'avanza' }])
  // una seduta programmata nel futuro non conta ancora
  seduta(paz, fase, '2099-01-01', [{ progressione_id: prog, esito: 'avanza' }])

  r = s(paz, fase, '2026-10-01')
  assert.equal(r.posizione, 2)
  assert.deepEqual(r.step.map((x) => x.stato), ['fatto', 'fatto', 'attuale'])
  assert.equal(r.step[0].superato_il, '2026-09-01')
  assert.equal(r.step[1].superato_il, '2026-09-15')
  assert.equal(r.attuale_dal, '2026-09-15')

  // scrivendo proprio quella seduta, il suo esito non conta
  assert.equal(s(paz, fase, '2026-10-01', terza).posizione, 1)
  // fino a un giorno prima del primo "avanza"
  assert.equal(s(paz, fase, '2026-08-31').posizione, 0)

  // tornare indietro, poi finire la scala
  seduta(paz, fase, '2026-09-22', [{ progressione_id: prog, esito: 'indietro' }])
  assert.equal(s(paz, fase, '2026-10-01').posizione, 1)
  assert.equal(s(paz, fase, '2026-10-01').step[1].rivisto_il, '2026-09-22')
  seduta(paz, fase, '2026-09-29', [{ progressione_id: prog, esito: 'avanza' }])
  seduta(paz, fase, '2026-09-30', [{ progressione_id: prog, esito: 'avanza' }])
  r = s(paz, fase, '2026-10-01')
  assert.equal(r.completata, true)
  assert.deepEqual(r.step.map((x) => x.stato), ['fatto', 'fatto', 'fatto'])
})

test('Ogni paziente ha il suo step; eliminare una seduta lo ricalcola e il cestino lo rimette', () => {
  const { paz, fase, prog } = scenario()
  const altro = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Altro', 'Paziente')")
  const sid = seduta(paz, fase, '2026-09-01', [{ progressione_id: prog, esito: 'avanza' }])
  assert.equal(stato(paz, fase)[0].posizione, 1)
  assert.equal(stato(altro, fase)[0].posizione, 0)

  eliminaSeduta(sid)
  assert.equal(stato(paz, fase)[0].posizione, 0)
  ripristina(elencoCestino().find((v) => v.tipo === 'Seduta')!.id)
  assert.equal(stato(paz, fase)[0].posizione, 1)
})

test('Modificare una seduta riscrive gli esiti; copiarla su piu\' giorni non li copia', () => {
  const { paz, fase, prog } = scenario()
  const sid = seduta(paz, fase, '2026-09-01', [{ progressione_id: prog, esito: 'avanza' }])
  assert.deepEqual(leggiSeduta(sid).progressioni, [{ progressione_id: prog, esito: 'avanza' }])

  const { id: _id, fase_nome: _fn, ...resto } = leggiSeduta(sid) as unknown as SedutaInput & {
    id: number
    fase_nome: string | null
  }
  aggiornaSeduta(sid, { ...resto, sezioni: [], esercizi: [], segni: [], progressioni: [] })
  assert.deepEqual(leggiSeduta(sid).progressioni, [])

  aggiornaSeduta(sid, { ...resto, sezioni: [], esercizi: [], segni: [], progressioni: [{ progressione_id: prog, esito: 'indietro' }] })
  const copie = programmaSeduta(sid, ['2026-09-10', '2026-09-12'])
  for (const c of copie) assert.deepEqual(leggiSeduta(c).progressioni, [])

  assert.throws(
    () =>
      aggiornaSeduta(sid, {
        ...resto,
        sezioni: [],
        esercizi: [],
        segni: [],
        progressioni: [{ progressione_id: prog, esito: 'forse' as EsitoProgressione }]
      }),
    /non è valido/
  )
})

test('Un gruppo collegato alla fase vale anche per le progressioni aggiunte dopo', () => {
  const { paz, fase, gruppo, esercizi } = scenario()
  assert.equal(stato(paz, fase).length, 1)

  const nuova = creaProgressione('Horizontal braking', gruppo)
  assert.equal(stato(paz, fase).length, 1, 'senza step non c\'e\' niente da mostrare')
  aggiungiStep(nuova, esercizi[0], null)
  assert.deepEqual(stato(paz, fase).map((p) => p.nome), ['Vertical braking', 'Horizontal braking'])

  // una progressione senza gruppo si collega da sola, e solo alla sua fase
  const sola = creaProgressione('Landing', null)
  aggiungiStep(sola, esercizi[1], null)
  assert.equal(stato(paz, fase).length, 2)
  const pat2 = ins('INSERT INTO patologie (nome) VALUES (?)', `Altra ${Math.random()}`)
  const fase2 = ins("INSERT INTO fasi (patologia_id, nome, ordine) VALUES (?, 'Avanzata', 0)", pat2)
  impostaProgressioniFase(fase2, { gruppo_ids: [], progressione_ids: [sola] })
  assert.deepEqual(stato(paz, fase2).map((p) => p.nome), ['Landing'])
  assert.deepEqual(progressioniDellaFase(fase2), { gruppo_ids: [], progressione_ids: [sola] })

  // senza fase, o con una fase senza progressioni: niente
  assert.deepEqual(statoProgressioni(paz, null, '2099-12-31', null), [])
  impostaProgressioniFase(fase2, { gruppo_ids: [], progressione_ids: [] })
  assert.deepEqual(stato(paz, fase2), [])
})

test('Un esercizio che e\' uno step non si elimina, ne\' due volte nella stessa scala', () => {
  const { prog, esercizi } = scenario()
  assert.throws(() => eliminaEsercizio(esercizi[0]), /uno step di una progressione.*Vertical braking/)
  assert.throws(() => aggiungiStep(prog, esercizi[0], null), /già uno step/)

  // lo stesso esercizio puo' stare in piu' progressioni
  const altra = creaProgressione('Altra scala', null)
  aggiungiStep(altra, esercizi[0], null)
  assert.throws(() => eliminaEsercizio(esercizi[0]), /più progressioni/)

  // tolto dagli step, si elimina
  const step = elencoProgressioni()
  for (const p of step) for (const s of p.step) if (s.esercizio_id === esercizi[0]) togliStep(s.id)
  eliminaEsercizio(esercizi[0])
})

test('Gruppi e progressioni nel cestino: si rimettono com\'erano', () => {
  const { gruppo, prog } = scenario()
  aggiornaProgressione(prog, { nome: 'Vertical braking', gruppo_id: gruppo, criteri: 'competenza, no dolore' })
  assert.equal(elencoProgressioni().find((p) => p.id === prog)!.criteri, 'competenza, no dolore')

  // il gruppo va, la progressione resta senza gruppo; tornando, si riattacca
  gruppiProgressioni.elimina(gruppo)
  assert.equal(elencoProgressioni().find((p) => p.id === prog)!.gruppo_id, null)
  ripristina(elencoCestino().find((v) => v.tipo === 'Gruppo di progressioni')!.id)
  assert.equal(elencoProgressioni().find((p) => p.id === prog)!.gruppo_id, gruppo)

  // la progressione va con i suoi step e torna con loro
  eliminaProgressione(prog)
  assert.equal(elencoProgressioni().some((p) => p.id === prog), false)
  ripristina(elencoCestino().find((v) => v.tipo === 'Progressione di esercizi')!.id)
  assert.equal(elencoProgressioni().find((p) => p.id === prog)!.step.length, 3)
})
