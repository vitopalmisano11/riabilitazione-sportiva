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

// La LESS (Landing Error Scoring System): 17 voci guardate sul video di un
// atterraggio da una pedana di circa 30 cm, su due piani. I punti sono quelli
// della scheda originale: in alcune voci è il «Sì» a valere 1 (l'errore), in
// altre il «No», quindi si scrivono come risposte con i loro punti, come il
// «Sì/No» rovesciato dell'IKDC. Punteggio da 0 a 19: più basso è meglio.
function less(): QuestionarioCompleto {
  chiave = 0
  const SAG = 'piano sagittale'
  const FRO = 'piano frontale'
  // `siVale` = i punti del Sì; il No vale l'altro.
  const voce = (nome: string, piano: string, definizione: string, siVale: 0 | 1): DomandaQuestionario =>
    scelta(
      `${nome} (${piano}) — ${definizione}`,
      opz([
        ['Sì', siVale],
        ['No', 1 - siVale]
      ])
    )

  const domande = [
    voce(
      'Flessione del ginocchio al contatto iniziale',
      SAG,
      'Al contatto iniziale, se il ginocchio è flesso più di 30°, Sì. Se è flesso meno di 30°, No.',
      0
    ),
    voce(
      'Flessione dell’anca al contatto iniziale',
      SAG,
      'Al contatto iniziale, se la coscia è flessa sul tronco, Sì. Se la coscia non è flessa sul tronco, No.',
      0
    ),
    voce(
      'Flessione del tronco al contatto iniziale',
      SAG,
      'Al contatto iniziale, se il tronco è verticale o esteso rispetto alle anche, No. Se il tronco è flesso sulle anche, Sì.',
      0
    ),
    voce(
      'Flessione plantare della caviglia al contatto iniziale',
      SAG,
      'Se il piede atterra dalle dita al tallone, Sì. Se atterra dal tallone alle dita o con il piede piatto, No.',
      0
    ),
    voce(
      'Valgismo del ginocchio al contatto iniziale',
      FRO,
      'Al contatto iniziale, traccia una linea verso il basso dal centro della rotula. Se la linea passa oltre il mesopiede, No. Se la linea è mediale rispetto al mesopiede, Sì.',
      1
    ),
    voce(
      'Flessione laterale del tronco al contatto iniziale',
      FRO,
      'Al contatto iniziale, se la linea mediana del tronco è inclinata a destra o a sinistra rispetto al corpo, Sì. Se il tronco non è inclinato né a destra né a sinistra, No.',
      1
    ),
    voce(
      'Ampiezza dell’appoggio — ampio',
      FRO,
      'Appena il piede è completamente a contatto con il terreno, traccia una linea verso il basso dalle spalle. Se la linea cade internamente al piede, Sì. Se il piede è ruotato internamente o esternamente, valuta l’ampiezza in base alla posizione del tallone.',
      1
    ),
    voce(
      'Ampiezza dell’appoggio — stretto',
      FRO,
      'Appena il piede è completamente a contatto con il terreno, traccia una linea verso il basso dalle spalle. Se la linea cade esternamente al piede, Sì. Se il piede è ruotato internamente o esternamente, valuta l’ampiezza in base alla posizione del tallone.',
      1
    ),
    voce(
      'Posizione del piede — punta in dentro',
      FRO,
      'Se il piede è ruotato internamente più di 30° tra il contatto iniziale e la massima flessione del ginocchio, Sì. Se non lo è, No.',
      1
    ),
    voce(
      'Posizione del piede — punta in fuori',
      FRO,
      'Se il piede è ruotato esternamente più di 30° tra il contatto iniziale e la massima flessione del ginocchio, Sì. Se non lo è, No.',
      1
    ),
    voce(
      'Contatto iniziale dei piedi simmetrico',
      FRO,
      'Se un piede atterra prima dell’altro, o se un piede atterra con il tallone e l’altro con le dita, No. Se i piedi atterrano simmetricamente, Sì.',
      0
    ),
    voce(
      'Mobilità in flessione del ginocchio',
      SAG,
      'Se il ginocchio si flette più di 45° dal contatto iniziale alla massima flessione, Sì. Se si flette meno di 45°, No.',
      0
    ),
    voce(
      'Flessione dell’anca alla massima flessione del ginocchio',
      SAG,
      'Se la coscia si flette maggiormente sul tronco dal contatto iniziale alla massima flessione del ginocchio, Sì. Altrimenti, No.',
      0
    ),
    voce(
      'Flessione del tronco alla massima flessione del ginocchio',
      SAG,
      'Se il tronco si flette maggiormente dal contatto iniziale alla massima flessione del ginocchio, Sì. Se il tronco non si flette, No.',
      0
    ),
    voce(
      'Spostamento in valgismo del ginocchio',
      FRO,
      'Al punto di massimo valgismo del ginocchio, traccia una linea verso il basso dal centro della rotula. Se la linea cade sull’alluce o medialmente, Sì. Se cade lateralmente all’alluce, No.',
      1
    ),
    scelta(
      `Mobilità articolare (${SAG}) — Osserva il movimento di anche e ginocchia sul piano sagittale dal contatto iniziale alla massima flessione del ginocchio. Se il soggetto compie un ampio spostamento di tronco, anche e ginocchia, Morbido. Se lo spostamento è moderato, Medio. Se è minimo, Rigido.`,
      opz([
        ['Morbido', 0],
        ['Medio', 1],
        ['Rigido', 2]
      ])
    ),
    scelta(
      `Impressione generale (${SAG} e ${FRO}) — Se l’atterraggio è morbido e senza movimento del ginocchio sul piano frontale, Eccellente. Se è rigido e con ampio spostamento del ginocchio sul piano frontale, Scarsa. In tutti gli altri atterraggi, Media.`,
      opz([
        ['Eccellente', 0],
        ['Media', 1],
        ['Scarsa', 2]
      ])
    )
  ]

  return {
    questionario: {
      id: 0,
      categoria_id: null,
      nome: 'LESS — Landing Error Scoring System',
      istruzioni:
        'Obiettivo: identificare i soggetti ad alto rischio di lesione del LCA da non contatto. Per farlo servono gli schemi di movimento su più piani.\n\n' +
        'Svolgimento: l’atleta salta in basso da una pedana alta circa 30 cm, atterra su un punto prestabilito (a una distanza pari alla metà della propria altezza) e subito dopo esegue un salto massimale verso l’alto.\n\n' +
        'Acquisizione: il movimento si registra con due telecamere, una sul piano sagittale e una sul piano frontale. Le voci si valutano sul video.\n\n' +
        'Punteggio: più è basso, meglio è (da 0 a 19). Fino a 4: buona tecnica di atterraggio e basso rischio di infortunio. Da 5 a 6: tecnica discreta o moderatamente deficitaria. Oltre 6: scarsa qualità del movimento.',
      ordine: 0,
      archiviato: 0,
      mcid_punteggio_id: null,
      mcid_punti: null,
      mcid_percentuale: null,
      mcid_migliora_calando: 0,
      mcid_nota: null
    },
    domande,
    punteggi: [
      {
        id: -100,
        nome: 'Punteggio LESS',
        tipo: 'somma',
        domanda_ids: domande.map((d) => d.id as number)
      }
    ],
    fasce: [
      { etichetta: 'Buona tecnica, basso rischio', minimo: 0, massimo: 4 },
      { etichetta: 'Tecnica discreta o moderatamente deficitaria', minimo: 5, massimo: 6 },
      { etichetta: 'Scarsa qualità del movimento', minimo: 7, massimo: 19 }
    ].map((f) => ({ id: null, punteggio_id: -100, punteggio2_id: null, minimo2: null, massimo2: null, ...f }))
  }
}

export const MODELLI: { chiave: string; nome: string; costruisci: () => QuestionarioCompleto }[] = [
  { chiave: 'ikdc', nome: 'IKDC — Valutazione soggettiva del ginocchio', costruisci: ikdc },
  { chiave: 'less', nome: 'LESS — Landing Error Scoring System', costruisci: less }
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
