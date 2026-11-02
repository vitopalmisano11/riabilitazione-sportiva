import type { ArgomentoGuida } from '../modello'

export const screening: ArgomentoGuida = {
  id: 'screening',
  titolo: 'Screening e test di valutazione',
  breve: 'Test nella libreria, protocolli per sport, esecuzione e report di confronto',
  parole: [
    'return to play',
    'rtp',
    'protocollo',
    'lsi',
    'simmetria',
    'cluster',
    'ankle go',
    'confronto',
    'report',
    'sport'
  ],
  blocchi: [
    {
      titolo: 'A cosa serve',
      elementi: [
        'Uno screening è una batteria di test (e questionari) fatta a un paziente in un giorno, da ripetere nel tempo. Si prepara in due passi e si esegue in un terzo posto: i **test** si descrivono una volta sola, i **protocolli** li mettono insieme, e **Return To Play** li compila sul paziente. Un test descritto una volta vale per tutti i protocolli, e i risultati restano confrontabili.'
      ]
    },
    {
      titolo: 'Passo 1 · Descrivere il test',
      elementi: [
        {
          passi: [
            'Apri la libreria dei test: [[Configurazione > Test di valutazione]].',
            'Scegli la categoria (es. «Test di salto») e premi **+** per un test nuovo. Scrivi il nome e premi **Crea**.',
            'Compila **A cosa serve**, **Come si esegue**, **Cosa valuta** e il **Numero di prove**.',
            'Se si fa una gamba per volta, accendi l’interruttore e scrivi la soglia di simmetria.',
            'In **Misure** premi **Aggiungi misura**: scrivi nome e unità, scegli se vale la prova migliore, la media o la peggiore, e se è meglio un valore più alto o più basso. Una misura può anche essere calcolata da altre due.',
            'Premi **Salva test**.'
          ]
        }
      ]
    },
    {
      titolo: 'Passo 2 · Costruire il protocollo',
      elementi: [
        {
          passi: [
            'Apri i protocolli: [[Configurazione > Screening]].',
            'Premi **+** per un **Nuovo protocollo**: scrivi lo sport e il nome (es. «Screening off season»).',
            'Crea le sezioni con **Nuova sezione**.',
            'In ogni sezione premi **Aggiungi test o questionario** e pesca dalla libreria. Si riordinano trascinando.',
            'Se serve un punteggio unico (come Ankle-GO), in fondo c’è **Punteggio del cluster**.',
            'Premi **Salva**.'
          ]
        },
        'Un protocollo si può **duplicare** per farne una variante.'
      ]
    },
    {
      titolo: 'Passo 3 · Eseguire lo screening',
      elementi: [
        {
          passi: [
            'Apri **Return To Play** dal menu a sinistra e premi **+** (**Nuovo screening**).',
            'Scegli il **Paziente**, il **Protocollo** e la **Data**, poi **Comincia**.',
            'Per ogni test scrivi le prove. Se si fa una gamba per volta compaiono **Destra** e **Sinistra**: il lato operato è quello scritto nella scheda del paziente, e sotto compare l’**LSI** con «superato» o «sotto la soglia».',
            'Per i questionari premi **Compila**: il risultato resta anche nella scheda del paziente.',
            'Premi **Salva**.'
          ]
        },
        'Nell’esecuzione non si aggiungono né tolgono test: quello che vedi è il protocollo com’era il giorno in cui hai aperto lo screening.'
      ]
    },
    {
      titolo: 'Il report di confronto',
      elementi: [
        {
          passi: [
            'Apri il paziente: [[Return To Play > il paziente > Report]].',
            'Nella finestra **Quali screening mettere a confronto?** spunta gli screening che vuoi.',
            'Se vuoi, in **Test con pedana (facoltativo)** spunta anche i test dalla pedana (vedi **Test con la pedana**).',
            'Premi **Apri il report**, poi scaricalo da lì.'
          ]
        },
        'Il più recente fra quelli scelti è quello che si legge nelle tabelle, gli altri diventano i punti dei grafici. Due screening si leggono meglio di molti.'
      ]
    },
    {
      titolo: 'Da ricordare',
      elementi: [
        {
          punti: [
            'Per cambiare la soglia o le misure di un test, si cambia nella libreria **Test di valutazione**: vale per tutti i protocolli.',
            'Senza soglia l’LSI si mostra ma non si giudica.',
            'Uno screening aperto e non ancora compilato resta **da compilare**.'
          ]
        }
      ]
    }
  ]
}
