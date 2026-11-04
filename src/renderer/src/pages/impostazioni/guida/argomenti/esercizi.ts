import type { ArgomentoGuida } from '../modello'

export const esercizi: ArgomentoGuida = {
  id: 'esercizi',
  titolo: 'Esercizi in libreria',
  breve: 'Categoria, una gamba o due, varianti più facili e più difficili',
  parole: [
    'monopodalico',
    'una gamba',
    'singola gamba',
    'variante',
    'archivia',
    'distretto',
    'cluster',
    'rir',
    'nuovo esercizio',
    'nome alternativo',
    'inglese',
    'cercare',
    'valori di default'
  ],
  blocchi: [
    {
      titolo: 'A cosa serve',
      elementi: [
        'La libreria è l’elenco degli esercizi che poi metti nelle sedute. Ogni esercizio porta con sé i valori di partenza (serie, ripetizioni, carico, recupero) e due scelte che cambiano come lo usi in seduta: se si fa a **una gamba o a due**, e le sue **varianti**.'
      ]
    },
    {
      titolo: 'Come si crea un esercizio',
      elementi: [
        {
          passi: [
            'Apri la libreria: [[Configurazione > Libreria esercizi > Esercizi]].',
            'Scegli la categoria (la piastrella) e, se serve, il distretto. I distretti sono le sotto-categorie, per esempio Quadricipite. Puoi anche saltare questo passo: **Nuovo esercizio** c’è anche nella prima pagina, accanto a **Nuova categoria**, e la categoria la scegli poi nella finestra.',
            'Premi **Nuovo esercizio**.',
            'Scrivi il **Nome** e scegli la **Categoria**. Il distretto si sceglie nello stesso campo: l’elenco ha prima le categorie e poi i loro distretti.',
            'Se vuoi, scrivi un **Nome alternativo** (di solito il nome in inglese): serve solo a ritrovare l’esercizio quando lo cerchi, in libreria, nelle sedute e nelle progressioni. Sulla scheda e nei documenti si legge sempre e solo il **Nome**.',
            'Nel campo **Gambe** scegli una delle tre voci: **Due**, **A scelta in seduta** (squat, CMJ, affondi…) oppure **Sempre una** (single leg hop…).',
            'Scrivi i valori di partenza: **Serie**, **Ripetizioni**, **Carico** (con la sua unità) e **Recupero**. **Cluster per serie** e **RIR** compaiono solo se la categoria li prevede.',
            'Premi **Salva**. Cliccare fuori dalla finestra salva lo stesso.'
          ]
        }
      ]
    },
    {
      titolo: 'Come si aggiungono le varianti',
      elementi: [
        'Le varianti servono per lo stesso esercizio fatto in modo più facile o più difficile (per esempio l’equilibrio normale oppure con uno stimolo cognitivo). Quasi tutti gli esercizi non ne hanno e non cambia niente.',
        {
          passi: [
            'Apri l’esercizio con la matita: [[Configurazione > Libreria esercizi > Esercizi > matita]].',
            'In fondo, nella parte **Varianti (opzionale)**, premi **Aggiungi una variante** e scrivi il nome (es. «con conteggio all’indietro»).',
            'Mettile in ordine con le frecce: **la più facile in alto, la più difficile in basso**.',
            'Premi **Salva**.'
          ]
        }
      ]
    },
    {
      titolo: 'Cosa vedi in seduta e nei documenti',
      elementi: [
        {
          punti: [
            'Esercizio **A scelta**: nella sua riga c’è il bottoncino **1 gamba**. Acceso, sulla scheda il nome diventa per esempio «Squat monopodalico». Con **Sempre una** o **Due** il bottone non c’è.',
            'Esercizio con varianti: nella riga c’è il menu **normale ▾**. Scegli una variante e sulla scheda si legge sotto il nome. **normale** vuol dire nessuna variante e sulla scheda non si scrive niente.',
            'Se un esercizio non ha varianti, il menu non compare.',
            'Vale per PDF, Word, finestra della scheda e CSV.'
          ]
        }
      ]
    },
    {
      titolo: 'Da ricordare',
      elementi: [
        {
          punti: [
            'In seduta si salva il **testo** della variante: se poi la rinomini in libreria, le sedute già fatte restano come erano.',
            'Una variante usata da uno step di una progressione non si può togliere (vedi **Progressioni a step**).',
            'Per togliere un esercizio dall’elenco senza perdere le sedute in cui l’hai usato, usa l’icona **Togli dall’elenco**: si archivia, e con l’interruttore **Archiviati** lo rivedi. Un esercizio già usato in una seduta non si elimina.'
          ]
        }
      ]
    }
  ]
}
