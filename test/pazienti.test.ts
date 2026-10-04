// Pazienti, follow-up e tecniche: il servizio vero (pazienti.ts, tecniche.ts).
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { archivioDiProva } from './archivio-di-prova'
import { getDb } from '../src/main/db'
import {
  aggiornaPaziente,
  creaPaziente,
  eliminaPaziente,
  elencoFollowUp,
  elencoPazienti,
  impostaFollowUp,
  impostaObiettivoRaggiunto,
  impostaPatologiaFase,
  impostaRecensione,
  impostaStato,
  impostaValoreTest,
  obiettiviRaggiunti,
  segnaContattato,
  valoriTest
} from '../src/main/pazienti'
import { archiviaTecnica, creaTecnica, elencoTecniche } from '../src/main/tecniche'
import { elencoCestino, ripristina } from '../src/main/cestino'
import type { PazienteCreateInput, PazienteInput } from '../src/shared/types'

// Un archivio cifrato tutto suo, in una cartella temporanea.
archivioDiProva()

const ins = (sql: string, ...a: unknown[]): number => Number(getDb().prepare(sql).run(...a).lastInsertRowid)

function nuovo(extra: Partial<PazienteCreateInput> = {}): PazienteCreateInput {
  return {
    nome: 'Mario',
    cognome: 'Rossi',
    data_nascita: null,
    codice_fiscale: null,
    telefono: null,
    email: null,
    lavoro: null,
    inviato_da: null,
    sport: null,
    diagnosi: null,
    tipo_intervento: null,
    data_intervento: null,
    precauzioni: null,
    patologia_id: null,
    fase_corrente_id: null,
    gruppo_id: null,
    ...extra
  } as PazienteCreateInput
}

test('Un paziente si crea, si rilegge e si modifica; nome e cognome si ripuliscono e servono', () => {
  const id = creaPaziente(nuovo({ nome: '  Anna ', cognome: ' Bianchi  ', sport: 'Pallavolo' }))
  const p = elencoPazienti().find((x) => x.id === id)!
  assert.equal(p.nome, 'Anna')
  assert.equal(p.cognome, 'Bianchi')
  assert.equal(p.sport, 'Pallavolo')
  assert.equal(p.stato, 'trattamento', 'si comincia in trattamento')

  assert.throws(() => creaPaziente(nuovo({ nome: '   ' })), /nome/i)
  assert.throws(() => creaPaziente(nuovo({ cognome: '' })), /cognome/i)
  assert.throws(() => creaPaziente(nuovo({ data_nascita: '12 maggio' })), /data di nascita/i)

  aggiornaPaziente(id, { ...p, nome: 'Anna Maria', telefono: '333 1234567' } as unknown as PazienteInput)
  const dopo = elencoPazienti().find((x) => x.id === id)!
  assert.equal(dopo.nome, 'Anna Maria')
  assert.equal(dopo.telefono, '333 1234567')
  assert.equal(dopo.sport, 'Pallavolo', 'quello che non cambia resta')
})

test('La fase deve essere della patologia, e non del campo', () => {
  const lca = ins("INSERT INTO patologie (nome) VALUES ('LCA pazienti')")
  const spalla = ins("INSERT INTO patologie (nome) VALUES ('Spalla pazienti')")
  const acuta = ins("INSERT INTO fasi (patologia_id, nome, ordine) VALUES (?, 'Acuta', 0)", lca)
  const fSpalla = ins("INSERT INTO fasi (patologia_id, nome, ordine) VALUES (?, 'Mobilita', 0)", spalla)
  const campo = ins("INSERT INTO fasi (patologia_id, nome, ordine, campo) VALUES (?, 'Campo', 1, 1)", lca)

  const id = creaPaziente(nuovo({ cognome: 'Fasi', patologia_id: lca, fase_corrente_id: acuta }))
  assert.equal(elencoPazienti().find((x) => x.id === id)!.fase_nome, 'Acuta')
  // una fase senza patologia, o di un'altra patologia, o del campo, non si imposta
  assert.throws(() => creaPaziente(nuovo({ fase_corrente_id: acuta })), /prima la patologia/)
  assert.throws(() => impostaPatologiaFase(id, lca, fSpalla), /non appartiene/)
  assert.throws(() => impostaPatologiaFase(id, lca, campo), /campo/)
  // e dopo un tentativo rifiutato il paziente e' com'era
  assert.equal(elencoPazienti().find((x) => x.id === id)!.fase_nome, 'Acuta')
  impostaPatologiaFase(id, spalla, fSpalla)
  assert.equal(elencoPazienti().find((x) => x.id === id)!.patologia_nome, 'Spalla pazienti')
  impostaPatologiaFase(id, null, null)
  assert.equal(elencoPazienti().find((x) => x.id === id)!.fase_nome, null)
})

test("L'elenco: in cima chi e' stato visto per ultimo, e una seduta futura non conta", () => {
  const vecchio = creaPaziente(nuovo({ cognome: 'Zeta', nome: 'Elenco' }))
  const recente = creaPaziente(nuovo({ cognome: 'Alfa', nome: 'Elenco' }))
  const soloFutura = creaPaziente(nuovo({ cognome: 'Beta', nome: 'Elenco' }))
  ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2020-01-10')", vecchio)
  ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2021-06-10')", recente)
  ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2999-01-01')", soloFutura)
  const ordine = elencoPazienti()
    .filter((p) => p.nome === 'Elenco')
    .map((p) => p.cognome)
  // chi non ha ancora una seduta fatta resta in fondo: la futura non lo porta in cima
  assert.deepEqual(ordine, ['Alfa', 'Zeta', 'Beta'])
})

test('Follow-up: concluso con la data, contattato, recensione, e le due liste', () => {
  const a = creaPaziente(nuovo({ cognome: 'Uno', nome: 'Follow' }))
  const b = creaPaziente(nuovo({ cognome: 'Due', nome: 'Follow' }))
  const c = creaPaziente(nuovo({ cognome: 'Tre', nome: 'Follow' }))
  impostaStato(a, 'concluso', '2026-12-01')
  impostaStato(b, 'concluso', '2026-11-01')
  impostaStato(c, 'concluso', null)
  const { trattamento, concluso } = elencoFollowUp()
  const miei = concluso.filter((p) => p.nome === 'Follow').map((p) => p.cognome)
  assert.deepEqual(miei, ['Due', 'Uno', 'Tre'], 'prima chi scade prima, in fondo chi non ha una data')
  assert.ok(!trattamento.some((p) => p.nome === 'Follow'))

  // tornando in trattamento la data da rispettare cade
  impostaStato(a, 'trattamento', '2026-12-01')
  assert.equal(elencoFollowUp().trattamento.find((p) => p.id === a)!.follow_up_il, null)

  impostaFollowUp(b, '2027-01-15')
  assert.equal(elencoFollowUp().concluso.find((p) => p.id === b)!.follow_up_il, '2027-01-15')
  segnaContattato(b, true)
  const dopo = elencoFollowUp().concluso.find((p) => p.id === b)!
  assert.match(dopo.contattato_il ?? '', /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(dopo.follow_up_il, null, 'contattato libera il prossimo contatto')
  segnaContattato(b, false)
  assert.equal(elencoFollowUp().concluso.find((p) => p.id === b)!.contattato_il, null)
  impostaRecensione(b, true)
  assert.equal(elencoFollowUp().concluso.find((p) => p.id === b)!.recensione, 1)
  impostaRecensione(b, false)
  assert.equal(elencoFollowUp().concluso.find((p) => p.id === b)!.recensione, 0)
})

test('Obiettivi raggiunti e test della fase, per paziente', () => {
  const pat = ins("INSERT INTO patologie (nome) VALUES ('Obiettivi pazienti')")
  const fase = ins("INSERT INTO fasi (patologia_id, nome, ordine) VALUES (?, 'F', 0)", pat)
  const ob1 = ins("INSERT INTO obiettivi (fase_id, nome, ordine) VALUES (?, 'Estensione completa', 0)", fase)
  const ob2 = ins("INSERT INTO obiettivi (fase_id, nome, ordine) VALUES (?, 'Cammino senza zoppia', 1)", fase)
  const hop = ins("INSERT INTO test_avanzamento (fase_id, nome, ordine) VALUES (?, 'Hop test', 0)", fase)
  const sq = ins("INSERT INTO test_avanzamento (fase_id, nome, ordine) VALUES (?, 'Squat', 1)", fase)
  const pz = creaPaziente(nuovo({ cognome: 'Obiettivi' }))

  impostaObiettivoRaggiunto(pz, ob1, true)
  impostaObiettivoRaggiunto(pz, ob1, true) // due volte non duplica
  impostaObiettivoRaggiunto(pz, ob2, true)
  assert.deepEqual(obiettiviRaggiunti(pz).sort(), [ob1, ob2].sort())
  impostaObiettivoRaggiunto(pz, ob1, false)
  assert.deepEqual(obiettiviRaggiunti(pz), [ob2])

  type Valore = { test_id: number; nome: string; eseguito: number; valore: string | null }
  assert.deepEqual(
    (valoriTest(pz, fase) as Valore[]).map((t) => [t.nome, t.eseguito, t.valore]),
    [
      ['Hop test', 0, null],
      ['Squat', 0, null]
    ]
  )
  impostaValoreTest(pz, hop, true, '120')
  impostaValoreTest(pz, hop, true, '125') // si riscrive, non si duplica
  impostaValoreTest(pz, sq, false, null)
  const letti = valoriTest(pz, fase) as Valore[]
  assert.deepEqual(letti.find((t) => t.test_id === hop), { test_id: hop, nome: 'Hop test', eseguito: 1, valore: '125' })
  assert.equal(letti.find((t) => t.test_id === sq)!.eseguito, 0)
})

test('Eliminare un paziente lo mette nel cestino col suo nome, e si rimette a posto', () => {
  const id = creaPaziente(nuovo({ nome: 'Cesti', cognome: 'Pazienti', telefono: '555' }))
  ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-05-05')", id)
  eliminaPaziente(id)
  assert.ok(!elencoPazienti().some((p) => p.id === id))
  const voce = elencoCestino().find((v) => v.etichetta === 'Pazienti Cesti')!
  assert.equal(voce.tipo, 'Paziente')
  ripristina(voce.id)
  const tornato = elencoPazienti().find((p) => p.id === id)!
  assert.equal(tornato.telefono, '555')
  const sedute = getDb().prepare('SELECT COUNT(*) AS n FROM sedute WHERE paziente_id = ?').get(id) as { n: number }
  assert.equal(sedute.n, 1)
})

test("Tecniche: una gia' scritta si rimette in elenco invece di duplicarsi", () => {
  const tecar = creaTecnica('  Tecar nuova ')
  const nomi = (inclusi: boolean): string[] => (elencoTecniche(inclusi) as { nome: string }[]).map((t) => t.nome)
  assert.ok(nomi(false).includes('Tecar nuova'))
  assert.throws(() => creaTecnica('   '), /Scrivi il nome/)
  archiviaTecnica(tecar, true)
  assert.ok(!nomi(false).includes('Tecar nuova'), "archiviata sparisce dall'elenco di tutti i giorni")
  assert.ok(nomi(true).includes('Tecar nuova'), "ma c'e' ancora per le sedute che la citano")
  // riscriverla, anche con maiuscole diverse, la rimette in elenco: stesso id
  assert.equal(creaTecnica('TECAR NUOVA'), tecar)
  assert.ok(nomi(false).includes('Tecar nuova'))
  assert.equal(nomi(true).filter((n) => n.toLowerCase() === 'tecar nuova').length, 1)
})
