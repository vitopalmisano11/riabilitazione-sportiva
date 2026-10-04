// La cartella completa del paziente.
import { test } from 'vitest'
import { archivioDiProva } from './archivio-di-prova'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getDb } from '../src/main/db'
import { generaCartella, generaRelazione, SEZIONI } from '../src/main/export-cartella'
import { esportaArchivio } from '../src/main/esporta-archivio'
import { datiScheda } from '../src/main/scheda-dati'
import { relazioneAnamnesi } from '../src/main/relazione-anamnesi'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import {
  caricoTesto,
  intensitaTesto,
  rirTesto,
  recuperoEsteso,
  recuperoTesto,
  ripetizioniTesto,
  volumeTesto
} from '../src/shared/dosaggio'

// Un archivio cifrato tutto suo, in una cartella temporanea.
archivioDiProva()

// Le query della cartella toccano quasi tutte le tabelle: qui si semina un
// paziente con qualcosa in ognuna e si controlla che il documento le riporti.
// Serve a beccare i nomi di colonna sbagliati, che il typecheck non vede.
test('Cartella completa del paziente: ogni tabella arriva nel documento', () => {
  const c = getDb()
  const ins = (sql: string, ...args: unknown[]): number | bigint =>
    c.prepare(sql).run(...args).lastInsertRowid

  const patC = ins("INSERT INTO patologie (nome) VALUES ('Lombalgia')")
  const faseC = ins('INSERT INTO fasi (patologia_id, nome, ordine) VALUES (?, ?, 0)', patC, 'Acuta')
  const catC = ins("INSERT INTO categorie (nome) VALUES ('Core')")
  const esC = ins('INSERT INTO esercizi (nome, categoria_id) VALUES (?, ?)', 'Plank', catC)
  const pz = ins(
    `INSERT INTO pazienti (nome, cognome, data_nascita, telefono, email, lavoro, inviato_da,
       diagnosi, tipo_intervento, data_intervento, patologia_id, fase_corrente_id)
     VALUES ('Giulia', 'Verdi', '1990-04-12', '333', 'g@v.it', 'Impiegata', 'Dott. Neri',
       'Lombalgia aspecifica', 'Nessuno', '2026-01-05', ?, ?)`,
    patC,
    faseC
  )

  ins(
    `INSERT INTO anamnesi_prossima (paziente_id, motivo_consulto, dolore_notturno, disturbi_sonno,
       tosse_starnuto, sintomi_neurologici, relazione_sintomi, note, note_giorno, note_esordio)
     VALUES (?, 'Dolore lombare', 'no', 'no', 'no', 'no', 'unico sintomo', 'nessuna', 'peggio la sera', 'in calo')`,
    pz
  )
  const sint = ins(
    `INSERT INTO anamnesi_sintomi (paziente_id, descrizione, andamento, da_quanto, episodio,
       esordio, traumatico, comportamento, aggrava, allevia, ordine)
     VALUES (?, 'Lombare destro', 'intermittente', '3 settimane', 'primo', 'graduale', 0,
       'riposo', 'stare seduta', 'camminare', 0)`,
    pz
  )
  ins(
    "INSERT INTO sintomo_punti (sintomo_id, grafico, minuti, dolore) VALUES (?, 'giorno', 480, 6)",
    sint
  )
  ins(
    "INSERT INTO sintomo_punti (sintomo_id, grafico, data, dolore) VALUES (?, 'esordio', '2026-08-01', 7)",
    sint
  )
  // Un secondo sintomo: nella cartella i due finiscono nello stesso grafico,
  // distinti per colore, ed e' quello che la legenda deve dichiarare.
  const sint2 = ins(
    `INSERT INTO anamnesi_sintomi (paziente_id, descrizione, andamento, ordine)
     VALUES (?, 'Rigidità mattutina', 'costante', 1)`,
    pz
  )
  ins(
    "INSERT INTO sintomo_punti (sintomo_id, grafico, minuti, dolore) VALUES (?, 'giorno', 1200, 4)",
    sint2
  )
  ins(
    "INSERT INTO sintomo_punti (sintomo_id, grafico, data, dolore) VALUES (?, 'esordio', '2026-08-20', 3)",
    sint2
  )
  ins(
    "INSERT INTO anamnesi_attivita (paziente_id, attivita, partecipazione, fattori_interni) VALUES (?, 'guida', 'palestra', 'timore')",
    pz
  )
  ins(
    `INSERT INTO anamnesi_remota (paziente_id, patologie, traumi, interventi, riabilitazioni,
       bioimmagini_note,
       peso, febbre, sudorazione, nausea, fumo, neoplasie, gravidanza, pacemaker, schegge)
     VALUES (?, 'Ipertensione', 'nessuno', 'nessuno', 'nessuna', 'RX negativa',
       0, 0, 0, 0, 1, 0, 0, 0, 0)`,
    pz
  )
  ins(
    "INSERT INTO bioimmagini (paziente_id, nome, tipo, contenuto, data) VALUES (?, 'RX bacino', 'image/png', 'x', '2026-07-01')",
    pz
  )

  const chart = ins("INSERT INTO body_chart (paziente_id, data, note) VALUES (?, '2026-08-20', 'prima visita')", pz)
  for (const [vista, tipo] of [
    ['fronte', 'dolore'],
    ['retro', 'rigidita'],
    ['destra', 'scossa'],
    ['sinistra', 'parestesie']
  ]) {
    ins(
      'INSERT INTO body_chart_segni (chart_id, vista, tipo, x, y, dimensione, intensita) VALUES (?, ?, ?, 0.5, 0.4, 1, 6)',
      chart,
      vista,
      tipo
    )
  }

  // Una body chart del piede: stessi segni, viste diverse. Nella cartella deve
  // uscire con le sue figure, non con quelle del corpo intero.
  const chartPiede = ins(
    "INSERT INTO body_chart (paziente_id, data, tipo, note) VALUES (?, '2026-08-22', 'piede', 'caviglia destra')",
    pz
  )
  for (const vista of ['dorso', 'pianta', 'esterno', 'interno']) {
    ins(
      "INSERT INTO body_chart_segni (chart_id, vista, tipo, x, y, dimensione, intensita) VALUES (?, ?, 'dolore', 0.3, 0.5, 1, 4)",
      chartPiede,
      vista
    )
  }

  const distr = ins("INSERT INTO distretti (nome) VALUES ('Rachide lombare')")
  const mov = ins(
    "INSERT INTO distretto_movimenti (distretto_id, nome, gradi) VALUES (?, 'Flessione', 1)",
    distr
  )
  const tst = ins(
    "INSERT INTO distretto_test (distretto_id, nome, gruppo, risposta) VALUES (?, 'SLR', 'Neurodinamici', 'pos-neg')",
    distr
  )
  const val = ins(
    `INSERT INTO valutazioni (paziente_id, data, ispezione, note, carico_locale, carico_generale,
       capacita_locale, capacita_generale)
     VALUES (?, '2026-08-25', 'atteggiamento antalgico', 'ok', 'ridotto', 'buono', 'media', 'buona')`,
    pz
  )
  ins(
    `INSERT INTO valutazione_distretti (valutazione_id, distretto_id, nota_attivo, nota_passivo)
     VALUES (?, ?, 'tira dal lato opposto', 'fine corsa elastico')`,
    val,
    distr
  )
  ins(
    `INSERT INTO valutazione_movimenti (valutazione_id, movimento_id, attivo_restrizione,
       attivo_dolore, passivo_restrizione, passivo_dolore, attivo_gradi, passivo_gradi)
     VALUES (?, ?, 2, 1, 1, 1, 40, 55)`,
    val,
    mov
  )
  ins(
    "INSERT INTO valutazione_test (valutazione_id, test_id, valore, nota) VALUES (?, ?, 'negativo', 'nessuna irradiazione')",
    val,
    tst
  )

  const qst = ins("INSERT INTO questionari (nome, ordine) VALUES ('Prova PROM', 0)")
  const comp = ins(
    "INSERT INTO paziente_questionari (paziente_id, questionario_id, data, fascia, note) VALUES (?, ?, '2026-08-26', 'rischio medio', '')",
    pz,
    qst
  )
  ins(
    "INSERT INTO compilazione_punteggi (compilazione_id, nome, valore, ordine) VALUES (?, 'Totale', 5, 0)",
    comp
  )

  const sed = ins("INSERT INTO sedute (paziente_id, data, fase_id, note) VALUES (?, '2026-08-27', ?, 'ben tollerata')", pz, faseC)
  ins(
    "INSERT INTO seduta_esercizi (seduta_id, esercizio_id, serie, ripetizioni, carico, recupero, nota, ordine) VALUES (?, ?, '3', '30\"', '-', '1 min', 'ok', 0)",
    sed,
    esC
  )

  ins(
    "INSERT INTO obiettivi_terapeutici (paziente_id, testo, termine, ordine) VALUES (?, 'Camminare 30 minuti', 'medio', 0)",
    pz
  )
  c.prepare('UPDATE pazienti SET aspettative = ? WHERE id = ?').run(
    'Vorrei tornare in piscina prima dell estate',
    pz
  )

  // La relazione scritta: frasi fisse riempite con quello che c'e', i "no"
  // detti con "nega", niente di inventato.
  const rel = relazioneAnamnesi(Number(pz))
  assert.equal(rel.prossima[0].testo, 'Si rivolge per dolore lombare.')
  assert.ok(
    rel.prossima[1].testo.startsWith(
      'Riferisce lombare destro, intermittente, al primo episodio, presente da 3 settimane, a esordio non traumatico.'
    )
  )
  // cosa lo aggrava e cosa lo allevia: elenchi puntati sotto al sintomo
  assert.deepEqual(rel.prossima[1].elenchi, [
    { titolo: 'Cosa lo aggrava', voci: ['Stare seduta'] },
    { titolo: 'Cosa lo allevia', voci: ['Camminare'] }
  ])
  // l'andamento nelle 24 ore e dall'esordio: ognuno a capo
  assert.ok(rel.prossima.some((p) => p.testo === "Nell'arco delle 24 ore: peggio la sera."))
  assert.ok(rel.prossima.some((p) => p.testo === "Dall'esordio a oggi: in calo."))
  assert.ok(rel.prossima[2].testo.startsWith('Riferisce inoltre rigidità mattutina, costante.'))
  assert.ok(
    rel.prossima.some((p) =>
      p.testo.includes('Nega dolore o sintomi notturni, disturbi del sonno, sintomi neurologici e peggioramento con tosse o starnuto.')
    )
  )
  assert.ok(!rel.prossima.some((p) => p.testo.includes('Note: nessuna')))
  assert.ok(rel.remota[0].testo.startsWith('Altre patologie e farmaci: ipertensione.'))
  assert.ok(rel.remota[0].testo.includes('Nega traumi precedenti, interventi chirurgici e precedenti riabilitativi.'))
  assert.ok(rel.remota.some((p) => p.testo.startsWith('Riferisce fumo. Nega variazioni di peso')))
  // I campi a pulsanti: si'/no col dettaglio, durata con la fase, esordio in
  // una parola, intensita' del dolore.
  const pzNuovo = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Nuovi', 'Campi')")
  ins(
    `INSERT INTO anamnesi_prossima (paziente_id, notturno_sn, dolore_notturno, sonno_sn, neuro_sn,
       neuro_tipi, sintomi_neurologici)
     VALUES (?, 1, 'si sveglia verso le 4', 0, 1, 'formicolio,forza', 'gamba sinistra')`,
    pzNuovo
  )
  ins(
    `INSERT INTO anamnesi_sintomi (paziente_id, descrizione, durata_numero, durata_unita, da_quanto,
       esordio_modo, traumatico, nprs_attuale, nprs_peggiore, ordine)
     VALUES (?, 'dolore al ginocchio destro', 3, 'settimane', 'dopo la partita', 'improvviso', 1, 4, 7, 0)`,
    pzNuovo
  )
  const relNuova = relazioneAnamnesi(Number(pzNuovo))
  assert.equal(
    relNuova.prossima[0].testo,
    'Riferisce dolore al ginocchio destro, presente da 3 settimane (fase acuta), dopo la partita, a esordio improvviso e traumatico. Intensità del dolore (NPRS): attuale 4/10, peggiore 7/10.'
  )
  assert.equal(
    relNuova.prossima[1].testo,
    'Riferisce dolore o sintomi notturni (si sveglia verso le 4) e sintomi neurologici (formicolio o parestesie e perdita di forza, gamba sinistra). Nega disturbi del sonno.'
  )
  const cartellaNuova = generaCartella(Number(pzNuovo), ['anamnesi'])
  assert.ok(cartellaNuova.includes('3 settimane (fase acuta), dopo la partita'))
  assert.ok(cartellaNuova.includes('sì — si sveglia verso le 4'))
  assert.ok(cartellaNuova.includes('attuale 4/10 · peggiore 7/10'))
  assert.ok(cartellaNuova.includes('sì — formicolio o parestesie, perdita di forza — gamba sinistra'))

  // e' un documento a parte, non una sezione della cartella
  const documentoRelazione = generaRelazione(Number(pz))
  if (process.env['RELAZIONE_HTML']) writeFileSync(process.env['RELAZIONE_HTML'], documentoRelazione)
  assert.ok(documentoRelazione.includes('Relazione dell’anamnesi · stampata il'))
  assert.ok(documentoRelazione.includes('<p>Si rivolge per dolore lombare.</p>'))
  assert.ok(!generaCartella(Number(pz), SEZIONI.map((x) => x.chiave)).includes('Si rivolge per'))

  const tutte = SEZIONI.map((x) => x.chiave)
  const doc = generaCartella(Number(pz), tutte)
  for (const atteso of [
    'Verdi',
    'Dolore lombare',      // anamnesi prossima
    'Altre patologie',     // anamnesi remota: il campo nuovo
    'Ipertensione',
    'RX negativa',         // anamnesi remota
    'Rachide lombare',     // valutazione obiettiva
    'tira dal lato opposto', // note del movimento attivo nella valutazione
    'fine corsa elastico',   // e del passivo
    'Prova PROM',          // questionari
    'Aspettative del paziente', // quello che si aspetta, con parole sue
    'tornare in piscina',
    'Camminare 30 minuti', // obiettivi terapeutici
    'Lato sinistro',       // body chart, tutte e quattro le viste
    'Dorso',               // body chart del piede
    'Lato interno',
    'piede e caviglia'
  ]) {
    assert.ok(doc.includes(atteso), `la cartella non riporta "${atteso}"`)
  }

  // L'andamento del dolore si legge in due grafici affiancati — le 24 ore e
  // dall'esordio — con dentro tutti i sintomi, e sotto la legenda dei colori.
  // Prima ogni sintomo aveva i suoi due disegni e non erano confrontabili.
  assert.ok(doc.includes('Nelle 24 ore') && doc.includes('Dall’esordio'))
  assert.equal(doc.split('<figure>').length - 1, 2)
  assert.ok(doc.includes('class="legenda"'))
  for (const c of ['#2563eb', '#d64545']) {
    assert.ok(doc.includes(c), 'la legenda non distingue i due sintomi')
  }
  // i valori stanno nel disegno: elencarli di nuovo a parole era una ripetizione
  assert.ok(!doc.includes('08:00 →'))
  assert.ok(doc.includes('Rigidità mattutina'))
  // le sezioni escluse non devono comparire
  const soloDati = generaCartella(Number(pz), ['anagrafica'])
  assert.ok(soloDati.includes('Dott. Neri'))
  assert.ok(!soloDati.includes('27/08/2026'))
  // delle sedute nella cartella restano le date, non gli esercizi
  assert.ok(doc.includes('27/08/2026'))
  assert.ok(!doc.includes('Plank'))
  // una sezione senza contenuto non stampa un titolo vuoto
  const pzVuoto = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Vuoto', 'Test')")
  const nulla = generaCartella(Number(pzVuoto), tutte)
  assert.ok(!nulla.includes('Diario delle sedute'))
  assert.throws(() => generaCartella(999999, tutte), /non trovato/)

  // L'archivio si esporta anche in tabelle leggibili senza l'app: le query
  // toccano quasi tutte le tabelle, quindi qui si controlla che girino e che il
  // paziente seminato compaia.
  const dirCsv = mkdtempSync(join(tmpdir(), 'riab-csv-'))
  const cartellaCsv = esportaArchivio(dirCsv)
  for (const nome of [
    'pazienti.csv',
    'anamnesi.csv',
    'sintomi.csv',
    'obiettivi.csv',
    'sedute.csv',
    'valutazioni.csv',
    'questionari.csv',
    'screening.csv',
    'leggimi.txt'
  ]) {
    assert.ok(existsSync(join(cartellaCsv, nome)), `manca ${nome}`)
  }
  const csvPazienti = readFileSync(join(cartellaCsv, 'pazienti.csv'), 'utf-8')
  assert.ok(csvPazienti.startsWith('﻿'), 'senza BOM Excel sbaglia le accentate')
  assert.ok(csvPazienti.includes('Verdi;Giulia'))
  assert.ok(csvPazienti.includes('Lombalgia'))
  // il punto e virgola dentro a un testo non deve spezzare la colonna
  assert.ok(readFileSync(join(cartellaCsv, 'sedute.csv'), 'utf-8').includes('Plank'))
  rmSync(dirCsv, { recursive: true, force: true })

  // Un testo che comincia con = + - @ Excel lo eseguirebbe come formula: un
  // apostrofo davanti lo lascia testo. I numeri e il resto non cambiano.
  {
    const c = getDb()
    c.prepare('INSERT INTO pazienti (nome, cognome, diagnosi, lavoro, sport) VALUES (?, ?, ?, ?, ?)').run(
      'Formula',
      'Prova',
      '=HYPERLINK("http://esempio.it","clicca")',
      '-dolore al mattino',
      'Nuoto'
    )
    const dirF = mkdtempSync(join(tmpdir(), 'riab-csv-formule-'))
    const csvF = readFileSync(join(esportaArchivio(dirF), 'pazienti.csv'), 'utf-8')
    assert.ok(csvF.includes(`"'=HYPERLINK(""http://esempio.it"",""clicca"")"`), 'la formula resta testo')
    assert.ok(csvF.includes("'-dolore al mattino"))
    assert.ok(csvF.includes('Prova;Formula;'), 'il testo normale non cambia')
    assert.ok(!/;=HYPERLINK/.test(csvF), 'nessuna cella comincia con =')
    // 'Verdi;Giulia' e la data non hanno subito niente
    assert.ok(csvF.includes('Verdi;Giulia'))
    c.prepare("DELETE FROM pazienti WHERE cognome = 'Prova' AND nome = 'Formula'").run()
    rmSync(dirF, { recursive: true, force: true })
  }

  // --- Dosaggio a cluster: dalla categoria fino alla scheda ---
  // La serie si spezza in blocchi con una pausa breve dentro. La categoria dice
  // solo se i campi si vedono; quello che si stampa dipende dai numeri salvati.
  {
    const catCl = ins(
      "INSERT INTO categorie (nome, dosaggio_cluster) VALUES ('Pliometria estensiva', 1)"
    )
    assert.equal(
      (
        c.prepare('SELECT dosaggio_cluster AS d FROM categorie WHERE id = ?').get(catCl) as {
          d: number
        }
      ).d,
      1
    )
    const esCl = ins(
      `INSERT INTO esercizi (nome, categoria_id, serie_default, cluster_default,
                             ripetizioni_default, unita_carico,
                             recupero_cluster_default, recupero_default)
       VALUES ('Balzi a piedi pari', ?, '4', '3', '2', 'sec', '15"', '2''')`,
      catCl
    )
    const sedCl = ins(
      "INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-08-28')",
      pz
    )
    ins(
      `INSERT INTO seduta_esercizi (seduta_id, esercizio_id, serie, cluster, ripetizioni,
                                    recupero_cluster, recupero, ordine)
       SELECT ?, id, serie_default, cluster_default, ripetizioni_default,
              recupero_cluster_default, recupero_default, 0
       FROM esercizi WHERE id = ?`,
      sedCl,
      esCl
    )

    const schedaCl = datiScheda(Number(sedCl))
    const rigaCl = schedaCl.sezioni[0].esercizi[0]
    assert.equal(rigaCl.cluster, '3')
    assert.equal(rigaCl.recupero_cluster, '15"')
    assert.equal(volumeTesto(rigaCl), '4 × (3 × 2)')
    assert.equal(recuperoEsteso(rigaCl), `rec. 15" tra i cluster, 2' tra le serie`)
    assert.equal(ripetizioniTesto(rigaCl), '3 × 2')
    assert.equal(recuperoTesto(rigaCl), `15" / 2'`)
    // Il carico: si scrive il numero e l'unita' la mette l'app; quello che
    // scrivi a parole resta com'e'.
    assert.equal(caricoTesto('10', null), '10')
    assert.equal(caricoTesto('10', 'kg'), '10 kg')
    assert.equal(caricoTesto('7,5', 'sec'), '7,5 sec')
    assert.equal(caricoTesto('elastico rosso', 'kg'), 'elastico rosso')
    assert.equal(caricoTesto('12 kg', 'kg'), '12 kg')
    assert.equal(caricoTesto('', 'kg'), null)
    assert.equal(caricoTesto('10', ''), '10')
    // e la scheda del paziente porta con se' l'unita' scelta
    assert.equal(rigaCl.unita_carico, 'sec')

    // senza cluster il dosaggio resta quello di sempre
    assert.equal(volumeTesto({ serie: '3', cluster: null, ripetizioni: '10' }), '3 × 10')
    assert.equal(recuperoEsteso({ recupero_cluster: null, recupero: '1 min' }), 'rec. 1 min')
  // le ripetizioni di riserva: il numero da solo non si capirebbe
  assert.equal(rirTesto({ rir: '2' }), 'RIR 2')
  assert.equal(rirTesto({ rir: null }), null)
  assert.equal(rirTesto({ rir: '  ' }), null)
  assert.equal(intensitaTesto({ carico: '60', unita_carico: 'kg', rir: '2' }), '60 kg · RIR 2')
  assert.equal(intensitaTesto({ carico: '60', unita_carico: 'kg', rir: null }), '60 kg')
  assert.equal(intensitaTesto({ carico: null, rir: '2' }), 'RIR 2')
  assert.equal(intensitaTesto({ carico: null, rir: null }), null)

    // e finisce anche nelle tabelle che si aprono senza l'app
    const dirCl = mkdtempSync(join(tmpdir(), 'riab-csv-cl-'))
    const csvCl = readFileSync(join(esportaArchivio(dirCl), 'sedute.csv'), 'utf-8')
    assert.ok(csvCl.includes('cluster_per_serie'), 'colonna dei cluster')
    assert.ok(csvCl.includes('Balzi a piedi pari'))
    // e i valori ci sono davvero: la colonna con il titolo giusto ma vuota non basta
    const righeCl = csvCl.replace(/^﻿/, '').split('\r\n')
    const intestazioneCl = righeCl[0].split(';')
    const rigaBalzi = righeCl.find((r) => r.includes('Balzi a piedi pari'))?.split(';') ?? []
    assert.equal(rigaBalzi[intestazioneCl.indexOf('cluster_per_serie')], '3')
    assert.equal(rigaBalzi[intestazioneCl.indexOf('recupero_tra_i_cluster')], '"15"""')
    rmSync(dirCl, { recursive: true, force: true })
  }

  // La scheda mostrata al paziente legge le stesse sedute con query proprie.
  const scheda = datiScheda(Number(sed))
  assert.equal(scheda.paziente, 'Giulia Verdi')
  assert.equal(scheda.data, '2026-08-27')
  assert.equal(scheda.fase_nome, 'Acuta')
  assert.equal(scheda.sezioni.length, 1)
  assert.equal(scheda.sezioni[0].esercizi[0].nome, 'Plank')
  assert.equal(scheda.sezioni[0].esercizi[0].ripetizioni, '30"')
  assert.throws(() => datiScheda(999999), /non trovata/)
})
