// La guida di Impostazioni: la ricerca e la forma dei testi. I testi sono dati
// (pages/impostazioni/guida/), quindi una prova puo' controllare che ogni voce
// sia fatta come le altre e che nessuna si perda per strada.
import { describe, expect, it } from 'vitest'
import { ARGOMENTI } from '../src/renderer/src/pages/impostazioni/guida/contenuti'
import type { ArgomentoGuida } from '../src/renderer/src/pages/impostazioni/guida/modello'
import {
  cercaArgomenti,
  evidenzia,
  normalizza,
  paroleCercate,
  senzaSegni,
  vociPercorso
} from '../src/renderer/src/pages/impostazioni/guida/ricerca'

const piccola: ArgomentoGuida[] = [
  {
    id: 'a',
    titolo: 'Dose per seduta',
    breve: 'Quanti contatti e quante serie',
    parole: ['mantenimento'],
    blocchi: [{ titolo: 'Come si imposta', elementi: ['Apri la **fase** e vai su Dose.'] }]
  },
  {
    id: 'b',
    titolo: 'Progressioni',
    breve: 'Esercizi a step',
    parole: [],
    blocchi: [{ titolo: 'Da ricordare', elementi: [{ punti: ['La dose sta sullo step.'] }] }]
  }
]

describe('ricerca nella guida', () => {
  it('senza niente scritto mostra tutte le voci nell’ordine della guida', () => {
    expect(cercaArgomenti(piccola, '')).toEqual(piccola)
    expect(cercaArgomenti(piccola, '   ')).toEqual(piccola)
  })

  it('ignora maiuscole, accenti e apostrofi', () => {
    expect(normalizza('  È  l’Unica ')).toBe('e l unica')
    expect(cercaArgomenti(piccola, 'PROGRESSIONI').map((a) => a.id)).toEqual(['b'])
    expect(cercaArgomenti(piccola, 'progressionì').map((a) => a.id)).toEqual(['b'])
  })

  it('una parola si cerca dall’inizio, non da mezzo', () => {
    expect(cercaArgomenti(piccola, 'progress').map((a) => a.id)).toEqual(['b'])
    expect(cercaArgomenti(piccola, 'rogressioni')).toEqual([])
    // una lettera sola non trova tutto quello che la contiene
    expect(cercaArgomenti(piccola, 'x')).toEqual([])
  })

  it('serve ogni parola, in qualsiasi punto della voce', () => {
    expect(cercaArgomenti(piccola, 'apri vai').map((a) => a.id)).toEqual(['a'])
    expect(cercaArgomenti(piccola, 'apri step')).toEqual([])
  })

  it('trova anche con le parole alternative che nel testo non ci sono', () => {
    expect(cercaArgomenti(piccola, 'mantenimento').map((a) => a.id)).toEqual(['a'])
  })

  it('mette prima la voce che si chiama come la parola cercata', () => {
    // «dose» sta nel titolo di a e solo nel testo di b
    expect(cercaArgomenti(piccola, 'dose').map((a) => a.id)).toEqual(['a', 'b'])
    // «step» sta nel titolo-breve di b e non in a
    expect(cercaArgomenti(piccola, 'step').map((a) => a.id)).toEqual(['b'])
  })

  it('il grassetto non disturba la ricerca', () => {
    expect(cercaArgomenti(piccola, 'la fase').map((a) => a.id)).toEqual(['a'])
    expect(cercaArgomenti(piccola, '**').map((a) => a.id)).toEqual([])
  })

  it('paroleCercate separa e normalizza', () => {
    expect(paroleCercate('  Dose  FASE ')).toEqual(['dose', 'fase'])
    expect(paroleCercate('')).toEqual([])
  })

  it('le parole di una lettera si ignorano se ce ne sono altre', () => {
    expect(paroleCercate('sedute a settimana')).toEqual(['sedute', 'settimana'])
    expect(paroleCercate('a')).toEqual(['a'])
  })

  it('con la dose e la progressione a pari merito vince chi ha la parola nel titolo', () => {
    const risultato = cercaArgomenti(ARGOMENTI, 'sedute a settimana')
    expect(risultato[0].id).toBe('dose')
  })
})

describe('sequenze di clic', () => {
  it('si dividono in tasti e non disturbano la ricerca', () => {
    expect(vociPercorso('Configurazione > Libreria esercizi > Esercizi')).toEqual([
      'Configurazione',
      'Libreria esercizi',
      'Esercizi'
    ])
    expect(senzaSegni('Apri [[Configurazione > Distretti]] e **salva**')).toBe(
      'Apri Configurazione Distretti e salva'
    )
    const voce: ArgomentoGuida[] = [
      {
        id: 'x',
        titolo: 'Prova',
        breve: 'x',
        parole: [],
        blocchi: [{ titolo: 'T', elementi: ['Apri [[Configurazione > Distretti]].'] }]
      }
    ]
    expect(cercaArgomenti(voce, 'distretti').map((a) => a.id)).toEqual(['x'])
    expect(cercaArgomenti(voce, '[[')).toEqual([])
  })
})

describe('parole colorate', () => {
  it('lascia il testo intatto e segna solo le parole cercate', () => {
    const pezzi = evidenzia('La dose è per seduta', ['dose', 'seduta'])
    expect(pezzi.map((p) => p[0]).join('')).toBe('La dose è per seduta')
    expect(pezzi.filter((p) => p[1]).map((p) => p[0])).toEqual(['dose', 'seduta'])
  })

  it('trova senza badare agli accenti', () => {
    const pezzi = evidenzia('Perché è così', ['perche', 'cosi'])
    expect(pezzi.filter((p) => p[1]).map((p) => p[0])).toEqual(['Perché', 'così'])
  })

  it('senza parole restituisce un pezzo solo', () => {
    expect(evidenzia('ciao', [])).toEqual([['ciao', false]])
    expect(evidenzia('', ['a'])).toEqual([['', false]])
  })
})

describe('contenuti della guida', () => {
  it('ogni voce ha un id suo, un titolo e almeno un blocco con del testo', () => {
    const id = new Set<string>()
    for (const a of ARGOMENTI) {
      expect(id.has(a.id), `id ripetuto: ${a.id}`).toBe(false)
      id.add(a.id)
      expect(a.titolo.trim(), a.id).not.toBe('')
      expect(a.breve.trim(), a.id).not.toBe('')
      expect(a.blocchi.length, a.id).toBeGreaterThan(0)
      const titoli = new Set<string>()
      for (const b of a.blocchi) {
        expect(titoli.has(b.titolo), `${a.id}: blocco ripetuto «${b.titolo}»`).toBe(false)
        titoli.add(b.titolo)
        expect(b.elementi.length, `${a.id}: ${b.titolo}`).toBeGreaterThan(0)
      }
    }
  })

  it('i grassetti sono sempre chiusi e nessun paragrafo e’ vuoto', () => {
    for (const a of ARGOMENTI) {
      for (const b of a.blocchi) {
        const testi = b.elementi.flatMap((e) =>
          typeof e === 'string' ? [e] : 'passi' in e ? e.passi : e.punti
        )
        for (const t of [b.titolo, ...testi]) {
          expect(t.trim(), `${a.id}: ${b.titolo}`).not.toBe('')
          // le sequenze [[A > B]] devono essere chiuse e avere almeno due tasti
          const aperte = (t.match(/\[\[/g) ?? []).length
          expect((t.match(/\]\]/g) ?? []).length, `${a.id}: sequenza aperta in «${t}»`).toBe(aperte)
          for (const m of t.matchAll(/\[\[(.+?)\]\]/g)) {
            expect(vociPercorso(m[1]).length, `${a.id}: sequenza di un tasto solo «${m[0]}»`).toBeGreaterThan(1)
          }
          // fuori dalle sequenze il grassetto va a coppie e non restano asterischi isolati
          for (const [i, pezzo] of t.split(/\[\[.+?\]\]/).entries()) {
            expect((pezzo.match(/\*\*/g) ?? []).length % 2, `${a.id}: grassetto aperto in «${t}»`).toBe(0)
            expect(pezzo.replace(/\*\*/g, ''), `${a.id}: asterisco isolato in «${t}» (${i})`).not.toContain('*')
          }
          expect(t.replace(/\[\[.+?\]\]/g, '').replace(/\*\*/g, ''), `${a.id}: parentesi isolate in «${t}»`).not.toMatch(/\[\[|\]\]/)
        }
      }
    }
  })

  it('ogni voce si ritrova cercando il suo titolo', () => {
    for (const a of ARGOMENTI) {
      expect(cercaArgomenti(ARGOMENTI, a.titolo).map((x) => x.id), a.titolo).toContain(a.id)
    }
  })

  it('c’e’ una voce per ciascuna delle funzioni da non dimenticare', () => {
    expect(ARGOMENTI.map((a) => a.id)).toEqual(
      expect.arrayContaining([
        'esercizi',
        'progressioni',
        'dose',
        'percorso',
        'screening',
        'pedana',
        'questionari',
        'dati'
      ])
    )
  })
})
