import type { ArgomentoGuida } from '../modello'

export const percorso: ArgomentoGuida = {
  id: 'percorso',
  titolo: 'Patologie, fasi e distretti',
  breve: 'Cosa si scrive una volta sul distretto e cosa sulla patologia e sulla fase',
  parole: [
    'valutazione',
    'campo',
    'palestra',
    'sezioni',
    'obiettivi',
    'test di avanzamento',
    'test muscolari',
    'neurologico',
    'movimenti',
    'gradi',
    'lato'
  ],
  blocchi: [
    {
      titolo: 'A cosa serve',
      elementi: [
        'Le due cose si scrivono in posti diversi. Il **distretto** (ginocchio, spalla, rachide lombare…) dice **cosa si valuta**: movimenti e test, scritti una volta sola e riusati su tutte le patologie di quella zona. La **patologia** con le sue **fasi** dice **come si lavora**: com’è fatta la seduta, gli obiettivi, la dose.'
      ]
    },
    {
      titolo: 'Come si crea un distretto',
      elementi: [
        {
          passi: [
            'Apri i distretti: [[Configurazione > Distretti]].',
            'Premi **+**, scrivi il nome (es. «Rachide cervicale») e premi **Crea**.',
            'Se si valuta a destra e a sinistra (ginocchio, spalla, anca, caviglia; non il rachide), accendi **Ha un lato: si valuta a destra e a sinistra**.',
            'In **Movimenti** premi **Aggiungi movimento** e scrivi il nome. Con la spunta **gradi** si misura l’escursione.',
            'In **Test** premi **Aggiungi test**, scrivi il nome e scegli il gruppo (provocazione del dolore, stabilità legamentosa, flessibilità, neurodinamici, altri) e il tipo di risposta (positivo / negativo, forza da 0 a 5, kg oppure + / −, testo libero).',
            'Premi **Salva distretto**.'
          ]
        }
      ]
    },
    {
      titolo: 'Test muscolari ed esame neurologico',
      elementi: [
        'Sono due interruttori dello stesso distretto:',
        {
          punti: [
            '**Ha i test muscolari**: acceso, scrivi l’elenco dei muscoli con **Aggiungi muscolo**. In valutazione ognuno ha la sua casella per destra e sinistra. Spento, i muscoli scritti restano ma non compaiono.',
            '**Ha l’esame neurologico**: per rachide cervicale e lombare. Se è vuoto compaiono gli elenchi pronti, che puoi modificare: **Sensibilità** (radici), **Forza** (muscoli) e **Riflessi osteotendinei**.'
          ]
        }
      ]
    },
    {
      titolo: 'Come si crea una patologia con le sue fasi',
      elementi: [
        {
          passi: [
            'Apri le patologie: [[Configurazione > Patologie e fasi]].',
            'Premi **+**, scrivi il nome (es. «Ricostruzione LCA») e premi **Aggiungi**.',
            'Apri la patologia e premi **Aggiungi fase**, una per ogni fase, nell’ordine in cui si fanno.',
            'Se vuoi, apri **Distretti da valutare** e spunta i distretti che devono comparire già spuntati nella valutazione obiettiva di questi pazienti.'
          ]
        }
      ]
    },
    {
      titolo: 'Cosa si imposta dentro una fase',
      elementi: [
        'Apri la fase: [[Configurazione > Patologie e fasi > la patologia > la fase]]. Ha cinque linguette:',
        {
          punti: [
            '**Struttura della seduta**: le sezioni (es. «Riscaldamento») e, per ognuna, le categorie di esercizi che propone. Spuntando una categoria la sezione propone anche gli esercizi dei suoi distretti.',
            '**Obiettivi**: quelli della fase.',
            '**Progressioni**: vedi **Progressioni a step**.',
            '**Dose**: vedi **Dose per seduta e per settimana**.',
            '**Test di avanzamento**: una lista facoltativa per decidere il passaggio alla fase dopo. Non blocca niente.'
          ]
        }
      ]
    },
    {
      titolo: 'Il lavoro sul campo',
      elementi: [
        {
          passi: [
            'Sulla piastrella della patologia premi l’icona ad albero, **Aggiungi un percorso al campo**.',
            'Compare un secondo elenco, **Fasi al campo**, accanto a **Fasi in palestra**. Aggiungi le fasi come sopra.',
            'In seduta, per questi pazienti, in alto compaiono **In palestra** e **Al campo**: scegli dove si svolge quella seduta.'
          ]
        },
        'Le fasi al campo non entrano nell’avanzamento e non si scelgono come fase corrente: la fase corrente del paziente non cambia.'
      ]
    },
    {
      titolo: 'Da ricordare',
      elementi: [
        {
          punti: [
            'L’avanzamento del paziente si fa dalla sua scheda: [[Percorso > Fase corrente]] e il pulsante per avanzare.',
            'Gli obiettivi della fase si spuntano come raggiunti nella scheda del paziente, non a ogni seduta.',
            'Eliminare una patologia elimina anche le sue fasi; eliminare un distretto elimina anche movimenti e test. Va tutto nel cestino per un mese.',
            'La fase è fotografata sulla seduta: cambiare la fase dopo non cambia le sedute già fatte.'
          ]
        }
      ]
    }
  ]
}
