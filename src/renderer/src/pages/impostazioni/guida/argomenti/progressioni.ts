import type { ArgomentoGuida } from '../modello'

export const progressioni: ArgomentoGuida = {
  id: 'progressioni',
  titolo: 'Progressioni a step',
  breve: 'Una scala di esercizi sempre più difficili, da suggerire in seduta',
  parole: [
    'scala',
    'step',
    'vertical braking',
    'avanza',
    'regredisci',
    'rimani',
    'gruppo',
    'dove siamo',
    'livello'
  ],
  blocchi: [
    {
      titolo: 'A cosa serve',
      elementi: [
        'Una progressione è una scala di esercizi in ordine di difficoltà (per esempio Vertical braking). In seduta ti suggerisce l’esercizio giusto per il paziente e tiene il conto di a che punto è. Serve solo a **programmare**: non entra mai in cartella, referti, stampe o esportazioni.'
      ]
    },
    {
      titolo: 'Come si costruisce la scala',
      elementi: [
        'Prima di cominciare, gli esercizi devono già stare in libreria (vedi **Esercizi in libreria**).',
        {
          passi: [
            'Apri le progressioni: [[Configurazione > Libreria esercizi > Progressioni]].',
            'Se vuoi raggruppare più scale, premi **+ Gruppo** e scrivi il nome (es. «Braking strategies»).',
            'Premi **+ Progressione**, scrivi il nome e scegli il gruppo (o «senza gruppo»).',
            'Clicca la progressione appena creata: a destra compare **Step della progressione**. Scrivi i **Criteri per passare allo step dopo**.',
            'Premi **+ Step**, cerca l’esercizio nella libreria e premi **+** accanto al suo nome.',
            'Ripeti per ogni step, **dal più facile al più difficile**. Per cambiare l’ordine trascina gli step. Lo stesso esercizio può comparire in più step.',
            'Su ogni step, se serve: scegli le **Gambe** (bipodalico o monopodalico, solo per gli esercizi che si fanno a scelta) e la **Variante**, scrivi il **requisito per arrivarci**, e **Serie**, **Ripetizioni**, **Recupero** dello step. Se li lasci vuoti valgono quelli dell’esercizio.'
          ]
        }
      ]
    },
    {
      titolo: 'Come si collega alla fase',
      elementi: [
        'Una progressione compare in seduta solo se è collegata alla fase del paziente.',
        {
          passi: [
            'Apri la fase: [[Configurazione > Patologie e fasi > la patologia > la fase > Progressioni]].',
            'Spunta il **gruppo** intero (valgono anche le progressioni che aggiungerai dopo) oppure le **singole progressioni**.',
            'Si salva da solo.'
          ]
        },
        'Una fase senza progressioni collegate non mostra né suggerimenti né riquadri.'
      ]
    },
    {
      titolo: 'Cosa vedi in seduta',
      elementi: [
        {
          passi: [
            'In una sezione della seduta premi **Esercizio**: in cima all’elenco c’è **Suggeriti dalle progressioni**.',
            'Per ogni progressione vedi lo **step attuale** (premi **+** per aggiungerlo, con la sua dose) e solo lo **step successivo**, con il lucchetto e il suo requisito. Quello successivo si può scegliere lo stesso: è un suggerimento.',
            'Alla fine della seduta, in **Progressioni: come è andata?**, scegli per ognuna **Avanza**, **Rimani** o **Regredisci**. **Rimani** è la scelta di partenza e non segna niente.',
            'Salva la seduta.'
          ]
        },
        'Il suggerimento compare solo nelle **sezioni che propongono la categoria di quell’esercizio**: lo squat non si propone in «Mobilizzazione». Una sezione aggiunta al volo li vede tutti, e una categoria che nessuna sezione propone viene suggerita dappertutto.'
      ]
    },
    {
      titolo: 'Dove vedi a che punto è il paziente',
      elementi: [
        {
          passi: [
            'In seduta, premi **Vedi dove siamo** in cima ai suggerimenti.',
            'Oppure, dalla scheda del paziente: [[Percorso > Progressioni]].'
          ]
        },
        'Si apre **Dove siamo nelle progressioni**: gli step già fatti, quello attuale e quelli ancora da sbloccare.'
      ]
    },
    {
      titolo: 'Da ricordare',
      elementi: [
        {
          punti: [
            'Lo step del paziente **non è salvato**: si ricalcola rileggendo gli esiti delle sedute in ordine di data (Avanza +1, Regredisci −1). Correggere o eliminare una seduta aggiorna tutto da solo.',
            'L’esito vale per la seduta in cui lo segni: programmando la settimana non viene copiato.',
            'L’icona **Cambia l’esercizio di questo step** lascia com’erano le sedute già fatte.',
            'Un esercizio archiviato non si può aggiungere da un suggerimento.'
          ]
        }
      ]
    }
  ]
}
