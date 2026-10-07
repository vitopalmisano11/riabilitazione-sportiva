// Questionari già scritti, da aggiungere con un clic invece di ricopiarli a mano.
//
// Si creano come un questionario qualunque (poi si modificano come gli altri):
// qui c'è solo il testo. La traduzione italiana è nostra, non una versione
// validata: per l'uso clinico ufficiale conviene confrontarla con la versione
// italiana autorizzata del questionario.
import { getDb } from './db'
import { salvaQuestionario } from './questionari'
import type { DomandaQuestionario, OpzioneDomanda, QuestionarioCompleto } from '../shared/types'

const opz = (voci: [string, number][]): OpzioneDomanda[] =>
  voci.map(([etichetta, punteggio]) => ({ id: null, etichetta, punteggio }))

let chiave = 0
const nuova = (): number => --chiave

function scelta(testo: string, opzioni: OpzioneDomanda[], intestazione: string | null = null): DomandaQuestionario {
  return {
    id: nuova(),
    testo,
    tipo: 'scelta',
    scala_min: null,
    scala_max: null,
    etichetta_min: null,
    etichetta_max: null,
    intestazione,
    opzioni
  }
}

function scala(testo: string, etichettaMin: string, etichettaMax: string): DomandaQuestionario {
  return {
    id: nuova(),
    testo,
    tipo: 'scala',
    scala_min: 0,
    scala_max: 10,
    etichetta_min: etichettaMin,
    etichetta_max: etichettaMax,
    intestazione: null,
    opzioni: []
  }
}

// Le cinque risposte sul livello di attività, uguali nelle domande 1, 5, 7 e 8;
// cambia solo l'ultima, che dice perché non si riesce a fare niente.
const livelloAttivita = (ultima: string): OpzioneDomanda[] =>
  opz([
    ['Attività molto intense, come saltare o fare perni (ad esempio nel basket o nel calcio)', 4],
    ['Attività intense, come lavori fisici pesanti, sci o tennis', 3],
    ['Attività moderate, come lavori fisici moderati, corsa o jogging', 2],
    ['Attività leggere, come camminare, lavori di casa o in giardino', 1],
    [ultima, 0]
  ])

function ikdc(): QuestionarioCompleto {
  chiave = 0
  const attivita = [
    'Salire le scale',
    'Scendere le scale',
    'Inginocchiarsi sulla parte anteriore del ginocchio',
    'Accovacciarsi',
    'Stare seduto con il ginocchio piegato',
    'Alzarsi da una sedia',
    'Correre in linea retta',
    'Saltare e atterrare sulla gamba interessata',
    'Fermarsi e ripartire rapidamente'
  ]
  const colonne = (): OpzioneDomanda[] =>
    opz([
      ['Per niente difficile', 4],
      ['Poco difficile', 3],
      ['Moderatamente difficile', 2],
      ['Molto difficile', 1],
      ['Impossibile da fare', 0]
    ])
  const comune = 'Come influisce il ginocchio sulla sua capacità di:'
  const gravita = opz([
    ['Per niente', 4],
    ['Leggermente', 3],
    ['Moderatamente', 2],
    ['Molto', 1],
    ['Estremamente', 0]
  ])

  const d1 = scelta(
    'Qual è il livello di attività più alto che riesce a svolgere senza dolore significativo al ginocchio?',
    livelloAttivita('Non riesco a svolgere nessuna delle attività precedenti a causa del dolore al ginocchio')
  )
  const d2 = scala(
    'Nelle ultime 4 settimane, o dall’infortunio, con quale frequenza ha avuto dolore?',
    'Costante',
    'Mai'
  )
  const d3 = scala('Se ha dolore, quanto è forte?', 'Il peggior dolore immaginabile', 'Nessun dolore')
  const d4 = scelta(
    'Nelle ultime 4 settimane, o dall’infortunio, quanto è stato rigido o gonfio il ginocchio?',
    gravita
  )
  const d5 = scelta(
    'Qual è il livello di attività più alto che riesce a svolgere senza gonfiore significativo al ginocchio?',
    livelloAttivita('Non riesco a svolgere nessuna delle attività precedenti a causa del gonfiore al ginocchio')
  )
  // Sì vale 0 e No vale 1: il contrario di un sì/no normale, quindi con le
  // risposte scritte.
  const d6 = scelta(
    'Nelle ultime 4 settimane, o dall’infortunio, il ginocchio si è bloccato o ha avuto uno scatto?',
    opz([
      ['Sì', 0],
      ['No', 1]
    ])
  )
  const d7 = scelta(
    'Qual è il livello di attività più alto che riesce a svolgere senza cedimenti significativi del ginocchio?',
    livelloAttivita('Non riesco a svolgere nessuna delle attività precedenti a causa dei cedimenti del ginocchio')
  )
  const d8 = scelta(
    'Qual è il livello di attività più alto che riesce a svolgere abitualmente?',
    livelloAttivita('Non riesco a svolgere nessuna delle attività precedenti')
  )
  const d9 = attivita.map((testo) => scelta(testo, colonne(), comune))
  const funzione =
    'Come valuta la funzione del suo ginocchio, da 0 a 10 (10 = funzione normale, ottima; 0 = non riesce a svolgere nessuna attività abituale, sport compreso)?'
  const d10prima = scala(`${funzione} — Prima dell’infortunio`, 'Non riuscivo a svolgere le attività quotidiane', 'Nessuna limitazione')
  const d10ora = scala(`${funzione} — Oggi`, 'Non riesco a svolgere le attività quotidiane', 'Nessuna limitazione')

  // Il punteggio IKDC conta le domande da 1 a 9 e la funzione di oggi; la
  // funzione prima dell'infortunio resta fra i dati ma non si somma.
  const contate = [d1, d2, d3, d4, d5, d6, d7, d8, ...d9, d10ora]

  return {
    questionario: {
      id: 0,
      categoria_id: null,
      nome: 'IKDC — Valutazione soggettiva del ginocchio',
      istruzioni:
        'Valuti i sintomi al livello di attività più alto a cui pensa di poter funzionare senza sintomi significativi, ' +
        'anche se in realtà non svolge attività a quel livello. ' +
        'Per ogni domanda indichi una sola risposta.',
      ordine: 0,
      archiviato: 0,
      mcid_punteggio_id: -100,
      mcid_punti: 11.5,
      mcid_percentuale: null,
      mcid_migliora_calando: 0,
      mcid_nota:
        'Valore indicativo dalla letteratura (Irrgang et al., 2006, circa 11,5 punti sul punteggio IKDC soggettivo): ' +
        'da verificare sulla propria popolazione.'
    },
    domande: [d1, d2, d3, d4, d5, d6, d7, d8, ...d9, d10prima, d10ora],
    punteggi: [
      {
        id: -100,
        nome: 'Punteggio IKDC',
        // Somma dei punti sul massimo possibile, da 0 a 100 (100 = nessun
        // sintomo né limitazione).
        tipo: 'percentuale',
        domanda_ids: contate.map((d) => d.id as number)
      }
    ],
    fasce: []
  }
}

export const MODELLI: { chiave: string; nome: string; costruisci: () => QuestionarioCompleto }[] = [
  { chiave: 'ikdc', nome: 'IKDC — Valutazione soggettiva del ginocchio', costruisci: ikdc }
]

// Crea il questionario nella categoria scelta e ne scrive le domande.
export function creaDaModello(chiaveModello: string, categoriaId: number): number {
  const modello = MODELLI.find((m) => m.chiave === chiaveModello)
  if (!modello) throw new Error('Questionario pronto non trovato.')
  const db = getDb()
  return db.transaction(() => {
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM questionari WHERE categoria_id = ?')
      .get(categoriaId) as { next: number }
    const id = Number(
      db
        .prepare('INSERT INTO questionari (nome, categoria_id, ordine) VALUES (?, ?, ?)')
        .run(modello.nome, categoriaId, next).lastInsertRowid
    )
    const dati = modello.costruisci()
    salvaQuestionario({ ...dati, questionario: { ...dati.questionario, id, categoria_id: categoriaId, ordine: next } })
    return id
  })()
}
