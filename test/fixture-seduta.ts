// Dati di esempio di una seduta, per le prove dei fogli stampati.
export const pazExport = {
  nome: 'Mario',
  cognome: 'Rossi',
  tipo_intervento: 'Ricostruzione LCA dx',
  data_intervento: '2026-05-01',
  patologia_nome: 'Ricostruzione LCA'
}
export const seduteExport = [
  {
    data: '2026-08-10',
    fase_nome: 'Fase iniziale',
    note: 'Buona risposta, <attenzione> al gonfiore',
    obiettivi: ['Controllo del dolore e gonfiore'],
    sezioni: [
      {
        nome: 'Riscaldamento',
        esercizi: [
          {
            nome: 'Mobilizzazione & scivolamenti rotulei',
            categoria_nome: 'Mobilizzazione',
            unita_carico: 'kg',
            serie: '3',
            cluster: null,
            ripetizioni: '10',
            rir: null,
            carico: null,
            recupero_cluster: null,
            recupero: '1 min',
            nota: 'lento'
          },
          {
            // Con le ripetizioni di riserva: il carico e il RIR si leggono
            // nella stessa colonna, che e' la stessa domanda.
            nome: 'Squat',
            categoria_nome: 'Forza',
            unita_carico: 'kg',
            serie: '4',
            cluster: null,
            ripetizioni: '8',
            rir: '2',
            carico: '60',
            recupero_cluster: null,
            recupero: "2'",
            nota: null
          },
          {
            // Dosaggio a cluster: la serie si spezza in blocchi con una pausa
            // breve dentro, e sulla carta si deve leggere per esteso.
            nome: 'Balzi a piedi pari',
            categoria_nome: 'Pliometria estensiva',
            unita_carico: null,
            serie: '4',
            cluster: '3',
            ripetizioni: '2',
            rir: null,
            carico: null,
            recupero_cluster: '15"',
            recupero: "2'",
            nota: null
          }
        ]
      }
    ]
  }
]
