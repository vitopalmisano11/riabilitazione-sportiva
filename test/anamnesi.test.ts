// L'anamnesi (anamnesi.ts): prossima con i sintomi e i loro grafici, attivita'
// e partecipazione, remota. Sono dati clinici: quello che si salva deve
// tornare identico, e un sintomo gia' salvato non cambia id se si riordina.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { archivioDiProva } from './archivio-di-prova'
import { getDb } from '../src/main/db'
import {
  leggiAnamnesi,
  leggiAttivita,
  leggiRemota,
  salvaAnamnesi,
  salvaAttivita,
  salvaRemota
} from '../src/main/anamnesi'
import type { AnamnesiProssima, SintomoAnamnesi } from '../src/shared/types'

// Un archivio cifrato tutto suo, in una cartella temporanea.
archivioDiProva()

const paziente = (cognome: string): number =>
  Number(getDb().prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Ana', ?)").run(cognome).lastInsertRowid)

function sintomo(descrizione: string, extra: Partial<SintomoAnamnesi> = {}): SintomoAnamnesi {
  return {
    id: null,
    descrizione,
    andamento: null,
    durata_numero: null,
    durata_unita: null,
    da_quanto: null,
    esordio_modo: null,
    nprs_attuale: null,
    nprs_peggiore: null,
    nprs_migliore: null,
    episodio: null,
    esordio: null,
    traumatico: null,
    comportamento: null,
    aggrava: null,
    allevia: null,
    punti: [],
    ...extra
  }
}

function anamnesi(extra: Partial<AnamnesiProssima> = {}): AnamnesiProssima {
  return {
    motivo_consulto: null,
    notturno_sn: null,
    dolore_notturno: null,
    sonno_sn: null,
    disturbi_sonno: null,
    neuro_sn: null,
    neuro_tipi: null,
    tosse_starnuto: null,
    sintomi_neurologici: null,
    relazione_sintomi: null,
    note: null,
    note_giorno: null,
    note_esordio: null,
    sintomi: [],
    ...extra
  }
}

test('Senza anamnesi si legge una scheda vuota, non un errore', () => {
  const pz = paziente('Vuota')
  const a = leggiAnamnesi(pz)
  assert.equal(a.motivo_consulto, null)
  assert.deepEqual(a.sintomi, [])
  assert.deepEqual(leggiAttivita(pz), { attivita: null, partecipazione: null, fattori_interni: null })
  const r = leggiRemota(pz)
  assert.equal(r.patologie, null)
  assert.equal(r.pacemaker, null)
})

test('L\'anamnesi prossima torna com\'e\' stata scritta, sintomi e punti compresi', () => {
  const pz = paziente('Prossima')
  salvaAnamnesi(
    pz,
    anamnesi({
      motivo_consulto: 'Dolore al ginocchio dopo la partita',
      notturno_sn: 1,
      dolore_notturno: 'Si sveglia due volte',
      neuro_sn: 0,
      sintomi: [
        sintomo('Dolore mediale', {
          andamento: 'peggiora' as never,
          durata_numero: 3,
          durata_unita: 'settimane',
          nprs_attuale: 6,
          traumatico: 1,
          aggrava: 'scale',
          punti: [
            { id: null, grafico: 'giornata' as never, minuti: 480, data: null, dolore: 2 },
            { id: null, grafico: 'giornata' as never, minuti: 1200, data: null, dolore: 7 }
          ]
        }),
        sintomo('Gonfiore')
      ]
    })
  )
  const a = leggiAnamnesi(pz)
  assert.equal(a.motivo_consulto, 'Dolore al ginocchio dopo la partita')
  assert.equal(a.notturno_sn, 1)
  assert.equal(a.neuro_sn, 0)
  assert.deepEqual(a.sintomi.map((x) => x.descrizione), ['Dolore mediale', 'Gonfiore'])
  const dolore = a.sintomi[0]
  assert.equal(dolore.durata_numero, 3)
  assert.equal(dolore.durata_unita, 'settimane')
  assert.equal(dolore.nprs_attuale, 6)
  assert.equal(dolore.traumatico, 1)
  assert.deepEqual(dolore.punti.map((p) => [p.minuti, p.dolore]), [[480, 2], [1200, 7]])
  assert.deepEqual(a.sintomi[1].punti, [])
})

test('Riscrivendo, i sintomi gia\' salvati tengono il loro id, e quelli tolti spariscono', () => {
  const pz = paziente('Riordino')
  salvaAnamnesi(pz, anamnesi({ sintomi: [sintomo('Primo'), sintomo('Secondo'), sintomo('Terzo')] }))
  const prima = leggiAnamnesi(pz).sintomi
  const id = (nome: string): number => prima.find((s) => s.descrizione === nome)!.id!

  // si riordina, si toglie il secondo, se ne aggiunge uno nuovo (id negativo = non ancora salvato)
  const [primo, , terzo] = prima
  salvaAnamnesi(
    pz,
    anamnesi({
      sintomi: [
        { ...terzo, punti: [{ id: null, grafico: 'giornata' as never, minuti: 60, data: null, dolore: 4 }] },
        primo,
        sintomo('Nuovo', { id: -1 })
      ]
    })
  )
  const dopo = leggiAnamnesi(pz).sintomi
  assert.deepEqual(dopo.map((s) => s.descrizione), ['Terzo', 'Primo', 'Nuovo'])
  assert.equal(dopo[0].id, id('Terzo'), 'il riordino non sposta i sintomi su altri id')
  assert.equal(dopo[1].id, id('Primo'))
  assert.ok(!dopo.some((s) => s.descrizione === 'Secondo'))
  assert.deepEqual(dopo[0].punti.map((p) => p.dolore), [4])
  // i punti del sintomo tolto non restano orfani
  const orfani = getDb()
    .prepare('SELECT COUNT(*) AS n FROM sintomo_punti WHERE sintomo_id NOT IN (SELECT id FROM anamnesi_sintomi)')
    .get() as { n: number }
  assert.equal(orfani.n, 0)

  // salvando una lista vuota se ne vanno tutti
  salvaAnamnesi(pz, anamnesi({ motivo_consulto: 'Solo motivo' }))
  const vuota = leggiAnamnesi(pz)
  assert.deepEqual(vuota.sintomi, [])
  assert.equal(vuota.motivo_consulto, 'Solo motivo')
})

test('Due pazienti non si mescolano', () => {
  const a = paziente('Alfa anamnesi')
  const b = paziente('Beta anamnesi')
  salvaAnamnesi(a, anamnesi({ motivo_consulto: 'di Alfa', sintomi: [sintomo('Sintomo di Alfa')] }))
  salvaAnamnesi(b, anamnesi({ motivo_consulto: 'di Beta' }))
  assert.equal(leggiAnamnesi(a).motivo_consulto, 'di Alfa')
  assert.equal(leggiAnamnesi(b).motivo_consulto, 'di Beta')
  assert.equal(leggiAnamnesi(a).sintomi.length, 1)
  assert.equal(leggiAnamnesi(b).sintomi.length, 0)
})

test('Attivita\' e partecipazione, e anamnesi remota: si scrivono e si riscrivono', () => {
  const pz = paziente('Attivita')
  salvaAttivita(pz, { attivita: 'Corre tre volte a settimana', partecipazione: 'Gioca in una squadra', fattori_interni: 'Motivato' })
  salvaAttivita(pz, { attivita: 'Corre due volte a settimana', partecipazione: 'Gioca in una squadra', fattori_interni: null })
  assert.deepEqual(leggiAttivita(pz), {
    attivita: 'Corre due volte a settimana',
    partecipazione: 'Gioca in una squadra',
    fattori_interni: null
  })

  const remota = { ...leggiRemota(pz), patologie: 'Asma', fumo: 1 as const, pacemaker: 0 as const, interventi: 'Menisco 2019' }
  salvaRemota(pz, remota)
  salvaRemota(pz, { ...remota, interventi: 'Menisco 2019, LCA 2022' })
  const letta = leggiRemota(pz)
  assert.equal(letta.patologie, 'Asma')
  assert.equal(letta.interventi, 'Menisco 2019, LCA 2022')
  assert.equal(letta.fumo, 1)
  assert.equal(letta.schegge, null, 'quello che non si e\' scritto resta vuoto')
})
