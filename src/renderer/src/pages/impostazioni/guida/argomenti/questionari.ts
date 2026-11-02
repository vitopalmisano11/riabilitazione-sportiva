import type { ArgomentoGuida } from '../modello'

export const questionari: ArgomentoGuida = {
  id: 'questionari',
  titolo: 'Questionari e come si calcolano i punteggi',
  breve: 'Domande, modi di calcolo, fasce di risultato, cambiamento che conta',
  parole: [
    'ikdc',
    'koos',
    'odi',
    'less',
    'somma',
    'percentuale',
    'media',
    'mcid',
    'tabella',
    'griglia',
    'fascia',
    'interpretazione',
    'ricalcola'
  ],
  blocchi: [
    {
      titolo: 'A cosa serve',
      elementi: [
        'Un questionario si scrive una volta in Configurazione e poi si compila sul paziente. Dalle risposte il programma ricava i **punteggi**, la **fascia** di risultato e, se l’hai impostato, se il cambiamento dall’ultima volta è quello che conta.'
      ]
    },
    {
      titolo: 'Come si crea un questionario',
      elementi: [
        {
          passi: [
            'Apri i questionari: [[Configurazione > Questionari]].',
            'Scegli la categoria e premi **+**. Scrivi il nome e premi **Crea**.',
            'Nella linguetta **Domande** aggiungi le domande (vedi sotto).',
            'Nella linguetta **Punteggi** crea i punteggi e scegli **Come si calcola** (vedi sotto).',
            'Se vuoi un’interpretazione, nella linguetta **Fasce** aggiungi le fasce.',
            'Se vuoi segnare il cambiamento che conta, compila la linguetta **Cambiamento**.',
            'Premi **Salva questionario**.'
          ]
        }
      ]
    },
    {
      titolo: 'Le domande',
      elementi: [
        'Premi **Aggiungi domanda** e scegli il tipo:',
        {
          punti: [
            '**Sì / No**: vale 0 o 1.',
            '**Scala numerica**: scrivi **Da** e **A**, e cosa vuol dire il minimo e il massimo (es. «nessun dolore»).',
            '**Scelta con punteggi**: ogni risposta ha il suo testo e i suoi punti.'
          ]
        },
        'Per una domanda con più righe e le stesse risposte (come la 9 dell’IKDC) premi **Aggiungi domanda a tabella**: scrivi le colonne una volta sola e poi le righe. Ogni riga conta come una domanda.'
      ]
    },
    {
      titolo: 'I quattro modi di calcolo',
      elementi: [
        'Nella linguetta **Punteggi**, il menu **Come si calcola** ha quattro voci:',
        {
          punti: [
            '**Somma delle risposte**: somma dei valori; una domanda senza risposta conta 0. È la scelta di partenza.',
            '**Percentuale del massimo (0–100)**: quanto della scala è stato raggiunto, solo sulle domande a cui il paziente ha risposto. 0 = tutte al minimo, 100 = tutte al massimo (come ODI e IKDC).',
            '**Percentuale inversa (100 = nessun problema)**: la stessa cosa rovesciata, per le scale in cui il minimo è «nessun problema» (come le sottoscale del KOOS).',
            '**Media delle risposte**: media dei valori delle domande risposte, con un decimale.'
          ]
        },
        'Sotto il menu il programma spiega il modo scelto.'
      ]
    },
    {
      titolo: 'Fasce e cambiamento che conta',
      elementi: [
        {
          punti: [
            '**Fasce**: si leggono dall’alto in basso e vince la prima che si avvera. Ognuna ha un risultato (es. «Rischio basso») e un intervallo di punteggio, con una seconda condizione facoltativa.',
            '**Cambiamento** (MCID): scegli su quale punteggio, se il paziente migliora quando **scende** o quando **sale**, e di quanti punti oppure di quale percentuale.'
          ]
        }
      ]
    },
    {
      titolo: 'Come si compila sul paziente',
      elementi: [
        {
          passi: [
            'Apri il paziente: [[Pazienti > il paziente > Clinica > Questionari]] e premi **+**.',
            'Scegli la categoria e il questionario.',
            'Rispondi a tutte le domande. **Salva** si attiva solo quando hai risposto a tutte.'
          ]
        },
        'Nell’elenco restano data, punteggi, fascia e, se l’hai impostato, **+N punti** dall’ultima volta con il badge **cambiamento che conta**. Dallo screening il pulsante **Compila** fa la stessa cosa.'
      ]
    },
    {
      titolo: 'Da ricordare',
      elementi: [
        {
          punti: [
            'Se cambi il modo di calcolo o le domande, le compilazioni già fatte restano calcolate con le regole di allora: compare un avviso con **Ricalcola**. Le risposte non cambiano, cambiano solo i punteggi.',
            'I questionari già pronti (IKDC, LESS, ODI…) stanno ognuno nella sua categoria.',
            'Le percentuali si arrotondano a un decimale.'
          ]
        }
      ]
    }
  ]
}
