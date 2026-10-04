// Documenti stampati: indicazioni per casa, intestazione, certificato, tema.
import { test } from 'vitest'
import { archivioDiProva } from './archivio-di-prova'
import { pazExport, seduteExport } from './fixture-seduta'
import assert from 'node:assert/strict'
import { generaHtml } from '../src/main/export-doc'
import { leggiProfilo, righeProfilo, salvaProfilo } from '../src/main/profilo'
import { generaCertificatoHtml } from '../src/main/certificato'
import { coloriTema, impostaTemaCorrente, temaValido } from '../src/shared/temi'

// Un archivio cifrato tutto suo, in una cartella temporanea.
archivioDiProva()

test('Le indicazioni per casa in fondo al foglio', () => {
  // Senza indicazioni il foglio finisce con il programma, come prima.
  assert.ok(!generaHtml(pazExport, seduteExport).includes('class="per-casa"'))
  const conCasa = generaHtml(
    {
      ...pazExport,
      frequenza_casa: '3 volte a settimana',
      indicazioni: ['Fermati alla comparsa del dolore.']
    },
    seduteExport
  )
  assert.ok(conCasa.includes('>Indicazioni<'), 'blocco delle indicazioni')
  assert.ok(conCasa.includes('3 volte a settimana'))
  assert.ok(conCasa.includes('Fermati alla comparsa del dolore.'))
})

test('Chi firma i fogli: l\'intestazione dei documenti', () => {
  // Senza profilo il foglio esce come prima, senza intestazione.
  assert.ok(!generaHtml(pazExport, seduteExport).includes('carta-intestata'))
  salvaProfilo({
    nome: 'Dott. Mario Rossi',
    qualifica: 'Fisioterapista',
    studio: null,
    indirizzo: 'via Roma 3, Bari',
    codice_fiscale: null,
    partita_iva: '01234567890',
    numero_iscrizione: null,
    iscrizione_in_scheda: 1,
    telefono: '333 1234567',
    email: null
  })
  const p = leggiProfilo()
  assert.equal(p.nome, 'Dott. Mario Rossi')
  // le caselle lasciate vuote non diventano righe vuote
  assert.equal(p.studio, null)
  const { chi, dove } = righeProfilo()
  assert.equal(chi, 'Dott. Mario Rossi · Fisioterapista')
  assert.equal(dove, 'via Roma 3, Bari · P. IVA 01234567890 · 333 1234567')
  const conProfilo = generaHtml(pazExport, seduteExport)
  assert.ok(conProfilo.includes('carta-intestata'), 'intestazione nel foglio')
  assert.ok(conProfilo.includes('Dott. Mario Rossi · Fisioterapista'))
  assert.ok(conProfilo.includes('via Roma 3, Bari · P. IVA 01234567890 · 333 1234567'))
  // e poi si toglie, cosi' le prove che vengono dopo trovano i fogli com'erano
  salvaProfilo({
    nome: null,
    qualifica: null,
    studio: null,
    indirizzo: null,
    codice_fiscale: null,
    partita_iva: null,
    numero_iscrizione: null,
    iscrizione_in_scheda: 1,
    telefono: null,
    email: null
  })
  assert.equal(righeProfilo().chi, '')
})

test('L\'iscrizione all\'Ordine in cima ai fogli', () => {
  const profilo = {
    nome: 'Dott. Mario Rossi',
    qualifica: 'Fisioterapista',
    studio: null,
    indirizzo: 'via Roma 3, Bari',
    codice_fiscale: null,
    partita_iva: null,
    numero_iscrizione: '77',
    iscrizione_in_scheda: 1 as 0 | 1,
    telefono: '333 1234567',
    email: null
  }
  salvaProfilo(profilo)
  // la scheda illustrata, per il paziente: solo nome e qualifica, e l'iscrizione a destra
  const scheda = generaHtml(pazExport, seduteExport, true)
  assert.ok(scheda.includes('Dott. Mario Rossi · Fisioterapista'))
  assert.ok(scheda.includes('OFI di Siena n. 77'))
  assert.ok(!scheda.includes('333 1234567'), 'niente contatti sulla scheda illustrata')
  assert.ok(!scheda.includes('via Roma 3'))
  // gli altri fogli tengono i contatti
  assert.ok(generaHtml(pazExport, seduteExport).includes('333 1234567'))
  // spenta dal profilo, l'iscrizione non compare
  salvaProfilo({ ...profilo, iscrizione_in_scheda: 0 })
  assert.equal(leggiProfilo().iscrizione_in_scheda, 0)
  assert.ok(!generaHtml(pazExport, seduteExport, true).includes('OFI di Siena'))
  salvaProfilo({
    ...profilo,
    nome: null,
    qualifica: null,
    indirizzo: null,
    numero_iscrizione: null,
    iscrizione_in_scheda: 1,
    telefono: null
  })
  assert.equal(righeProfilo().chi, '')
})

test('Il certificato di presenza', () => {
  const base = {
    professionista: {
      nome: 'Dott. Mario Rossi',
      qualifica: 'Fisioterapista',
      numero_iscrizione: '1234',
      indirizzo: 'via Roma 3, Bari',
      telefono: '333 1234567',
      email: null
    },
    paziente: {
      nome: 'Anna',
      cognome: 'Bianchi',
      data_nascita: '1985-03-09',
      codice_fiscale: 'bnchnn85c49a662z'
    },
    data: '2026-09-30',
    ora_inizio: '10:00',
    ora_fine: '11:30',
    comprende_viaggio: false,
    data_emissione: '2026-10-01'
  }
  const html = generaCertificatoHtml(base)
  assert.ok(html.includes('CERTIFICATO DI PRESENZA'))
  assert.ok(html.includes('Dott. Mario Rossi'))
  assert.ok(html.includes('OFI di Siena n. 1234'), "iscrizione all'OFI di Siena")
  assert.ok(html.includes('09/03/1985'), 'data di nascita in italiano')
  assert.ok(html.includes('BNCHNN85C49A662Z'), 'codice fiscale in maiuscolo')
  assert.ok(html.includes('dalle ore <strong>10:00</strong>'))
  assert.ok(html.includes('alle ore <strong>11:30</strong>'))
  assert.ok(html.includes('seduta di fisioterapia'))
  assert.ok(html.includes('Data di emissione: <strong>01/10/2026</strong>'))
  assert.ok(!html.includes('tempo stimato per il viaggio'))
  assert.ok(generaCertificatoHtml({ ...base, comprende_viaggio: true }).includes('tempo stimato per il viaggio'))
  // quello che manca ferma il foglio con una frase chiara, invece di stamparlo a meta'
  const senza = (modifica: (c: typeof base) => void): string => {
    const c = JSON.parse(JSON.stringify(base)) as typeof base
    modifica(c)
    try {
      generaCertificatoHtml(c)
      return ''
    } catch (e) {
      return (e as Error).message
    }
  }
  assert.match(senza((c) => (c.professionista.numero_iscrizione = '')), /iscrizione/)
  assert.match(senza((c) => (c.paziente.codice_fiscale = ' ')), /codice fiscale/)
  assert.match(senza((c) => (c.ora_fine = '')), /ora di inizio/)
  assert.match(senza((c) => (c.ora_fine = '09:00')), /dopo quella di inizio/)
})

test('Tema: i documenti stampati devono seguire il colore scelto', () => {
  // Il tema di partenza e' il verde; scegliendo il blu cambiano le intestazioni
  // dei documenti, non solo l'interfaccia.
  assert.equal(coloriTema().accento, '#55806a')
  impostaTemaCorrente('blu')
  assert.equal(coloriTema().accento, '#2563eb')
  impostaTemaCorrente('prugna')
  assert.equal(coloriTema().accento, '#7a5299')
  assert.equal(temaValido('inventato'), 'verde')
  impostaTemaCorrente('verde')
})
