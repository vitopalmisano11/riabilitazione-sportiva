import type { ArgomentoGuida } from '../modello'

export const pedana: ArgomentoGuida = {
  id: 'pedana',
  titolo: 'Test con la pedana',
  breve: 'Importare i file della Balance Squat App, lato interessato, documenti',
  parole: [
    'pedana di forza',
    'balance squat',
    'importa',
    'file',
    'json',
    'lsi',
    'lato interessato',
    'promemoria',
    'retest',
    'grafici'
  ],
  blocchi: [
    {
      titolo: 'A cosa serve',
      elementi: [
        'I test fatti con la pedana di forza arrivano come file della Balance Squat App (il nome finisce con «.pedana.json») e hanno un **archivio proprio** nella scheda del paziente: non sono righe di uno screening.'
      ]
    },
    {
      titolo: 'Come si importa un file',
      elementi: [
        {
          passi: [
            'Apri l’importazione. Hai due strade: dalla lista, il pulsante con la freccia in su accanto a **Cerca paziente** (**Importa i test dal file della pedana**); oppure dal paziente, [[Pazienti > il paziente > Pedana > Importa]].',
            'Scegli il file.',
            'In **Di chi è** scegli il paziente. Il programma non lo abbina mai da solo: ti propone i nomi simili, oppure **Un altro paziente** o **Un paziente nuovo**.',
            'In **Cosa importare** spunta le registrazioni che vuoi. Quelle già importate sono disabilitate.',
            'Premi **Importa**.'
          ]
        },
        'Importare di nuovo lo stesso file non crea doppioni: li riconosce da sé. Un file non valido (versione non supportata) dà un errore e non importa niente.'
      ]
    },
    {
      titolo: 'Cosa vedi',
      elementi: [
        'Nella linguetta **Pedana** c’è un elenco con data e test, uno per riga (destro e sinistro fatti a meno di 7 giorni di distanza stanno nella stessa riga). Aprendo un test ci sono le linguette **Risultato e grafici**, **Misure**, **Report sintetico**, **Come è stato fatto** e, se il test è stato ripetuto, **Nel tempo**. Nel risultato compaiono Destro, Sinistro e l’**LSI** (lato interessato ÷ lato sano × 100).',
        '**Elimina questo test** lo toglie dall’archivio e si può sempre reimportare dal file.'
      ]
    },
    {
      titolo: 'Il lato interessato',
      elementi: [
        'Per i test di forza fatti sui due lati, nella finestra del test c’è **Lato interessato** (**Destro** o **Sinistro**), che vale **solo per quel test**. Se non lo scrivi vale il **lato operato/infortunato** della scheda del paziente. Senza nessuno dei due, si confronta il lato meno forte con il più forte e l’etichetta è **Fra i lati**, non LSI.'
      ]
    },
    {
      titolo: 'Dove finisce nei documenti',
      elementi: [
        {
          punti: [
            '**Cartella del paziente**: spunta **Test con pedana**, con lo storico completo.',
            '**Relazione scritta della valutazione obiettiva**: una sintesi in fondo, con tabella e frasi.',
            '**Report di screening**: solo i test che spunti in **Test con pedana (facoltativo)**.',
            '**Report dei soli test pedana**: [[Pazienti > il paziente > Pedana > Report]]. Un test è un report singolo, più test dello stesso tipo in date diverse sono un confronto.'
          ]
        }
      ]
    },
    {
      titolo: 'Il promemoria per rifare il test',
      elementi: [
        {
          passi: [
            'Apri i promemoria: [[Pazienti > il paziente > Clinica > Promemoria]] e premi **+**.',
            'Scegli il tipo **pedana** e il test dal menu **Scegli il test…** (solo test già importati).',
            'Scrivi la data in **Entro il** e premi **Aggiungi**.'
          ]
        },
        'Si chiude da solo quando importi quel test per quel paziente.'
      ]
    }
  ]
}
