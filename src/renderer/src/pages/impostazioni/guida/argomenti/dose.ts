import type { ArgomentoGuida } from '../modello'

export const dose: ArgomentoGuida = {
  id: 'dose',
  titolo: 'Dose per seduta e per settimana',
  breve: 'Contatti di pliometria e serie di forza, confrontati con la fase',
  parole: [
    'pliometria',
    'contatti',
    'serie',
    'forza',
    'potenza',
    'volume',
    'carico',
    'rtp',
    'preparazione atletica',
    'avviso',
    'monopodalico',
    'settimana',
    'andamento',
    'grafico',
    'dolore',
    'sforzo'
  ],
  blocchi: [
    {
      titolo: 'A cosa serve',
      elementi: [
        'Mentre costruisci la seduta, il programma conta i **contatti** della pliometria e le **serie** di potenza e forza, e li confronta con i numeri che hai deciso per quella fase. Serve solo a **programmare**: non entra in nessun documento.',
        'Per farlo funzionare servono **tre cose**, da fare una volta sola: dire come si conta ogni categoria, scrivere i numeri della fase e indicare quante sedute fa il paziente.'
      ]
    },
    {
      titolo: 'Passo 1 · Come si conta ogni categoria',
      elementi: [
        {
          passi: [
            'Apri la libreria: [[Configurazione > Libreria esercizi > Esercizi]].',
            'Premi la **matita** sulla piastrella di una categoria (o di un distretto).',
            'Nel menu **Nel conto della dose** scegli: **Pliometria estensiva (contatti)**, **Pliometria intensiva (contatti)**, **Potenza con carico (serie)** o **Forza (serie)**.',
            'Premi **Salva**. Ripeti per le altre categorie.'
          ]
        },
        'Isometrie, core e accessori si lasciano su **Non si conta**. Un distretto lasciato vuoto prende la scelta della sua categoria. La forza si conta **per muscolo**: ogni categoria o distretto di forza ha la sua riga nel passo 2.'
      ]
    },
    {
      titolo: 'Passo 2 · I numeri della fase',
      elementi: [
        {
          passi: [
            'Apri la fase: [[Configurazione > Patologie e fasi > la patologia > la fase > Dose]].',
            'Per partire da un modello, premi **Riempi con:** e scegli **RTP 1**, **RTP 2** o **Preparazione atletica**.',
            'Correggi i numeri: ogni riga ha **da** e **a**. Solo «da» vuol dire «almeno», solo «a» vuol dire «al massimo», vuoto vuol dire «non controllare».',
            'Si salva uscendo dalla casella.'
          ]
        }
      ]
    },
    {
      titolo: 'Passo 3 · Le sedute a settimana',
      elementi: [
        {
          passi: [
            'Apri il paziente: [[Pazienti > il paziente > Percorso]].',
            'Scrivi il numero nel campo **Sedute a settimana** (da 1 a 14).'
          ]
        },
        'Lo puoi cambiare anche al volo dalla riga della dose in seduta. Senza questo numero la forza si confronta con il valore per seduta.'
      ]
    },
    {
      titolo: 'Cosa vedi in seduta',
      elementi: [
        'Sopra l’elenco degli esercizi compare una riga compatta, per esempio «Pliometria est. 90 ✓ · Quadricipite 3 serie ✓». La spunta vuol dire dentro l’intervallo, il triangolo vuol dire **poco** o **troppo**. Cliccandola si apre il dettaglio, una riga per voce. La riga compare solo se la fase ha almeno un numero nella linguetta **Dose**.'
      ]
    },
    {
      titolo: 'Il carico settimana per settimana',
      elementi: [
        'In [[Pazienti > il paziente > Percorso]], sotto le progressioni, il riquadro **Carico settimana per settimana** mette in fila le settimane già fatte, dalla più recente. Ogni casella dice quanto è stato fatto e, dopo la barra, quanto voleva la dose della fase per quella settimana: «240 ✓ / 160–240».',
        {
          punti: [
            '**Pliometria e potenza**: la dose per seduta × le sedute **fatte** quella settimana.',
            '**Forza**: la dose per seduta × le **sedute a settimana** del paziente (senza quel numero, × le sedute fatte).',
            'La **fase** della settimana è quella dell’ultima seduta. Le sedute al campo non contano nel carico, ma dolore e sforzo sì.',
            'Nella settimana **in corso** non si segna mai «poco»: può ancora arrivare.',
            'Le settimane senza sedute restano in tabella con «Nessuna seduta», così una pausa si vede.'
          ]
        },
        'Sopra la tabella ci sono due grafici sulle stesse settimane: il carico della voce scelta in **Nel grafico**, con la fascia della dose dietro le barre, e sotto **dolore** e **sforzo** medi da 0 a 10. Passando il mouse su una settimana se ne leggono i numeri.',
        'Se nelle ultime tre settimane il dolore medio è salito ogni settimana (di almeno un punto in tutto) mentre una voce del carico cresceva, in cima compare un **avviso**. Il riquadro non c’è per i pazienti senza dose nelle fasi né esercizi che si contano. Come il resto della dose, non entra in nessun documento.'
      ]
    },
    {
      titolo: 'Come si conta',
      elementi: [
        {
          punti: [
            '**Pliometria** = serie × cluster × ripetizioni. A **una gamba** i contatti valgono doppio (3 × 10 per gamba = 60).',
            '**Forza** e **potenza** = somma delle serie.',
            '**«8-10» conta come 8** (il primo numero).',
            'Una ripetizione **a tempo** (30", 45 sec, 1 min) è un’isometria e **non conta**.',
            'La **pliometria** si confronta per seduta. La **forza** si confronta sulla **settimana**: numero della fase × sedute a settimana, meno quello già fatto nelle altre sedute della settimana, diviso le sedute che restano. Il dettaglio lo dice con «da fare oggi» e «in settimana».'
          ]
        }
      ]
    },
    {
      titolo: 'Da ricordare',
      elementi: [
        {
          punti: [
            'Le sedute di una **fase al campo** non entrano nel conto della settimana (vedi **Patologie, fasi e distretti**).',
            'Si contano le sedute della stessa settimana, da lunedì a domenica, fatte o programmate. Studio, palestra e casa contano uguale.',
            'Lato operato e lato sano non si distinguono.',
            'Le serie si contano tutte, con o senza RIR.'
          ]
        }
      ]
    }
  ]
}
