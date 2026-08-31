export interface Patologia {
  id: number
  nome: string
  ordine: number
}

export interface Fase {
  id: number
  patologia_id: number
  nome: string
  ordine: number
}

export interface Obiettivo {
  id: number
  fase_id: number
  nome: string
  ordine: number
}

export interface Categoria {
  id: number
  nome: string
  ordine: number
}

export interface Esercizio {
  id: number
  nome: string
  categoria_id: number
  serie_default: string | null
  ripetizioni_default: string | null
  carico_default: string | null
  recupero_default: string | null
  nota_tecnica: string | null
  link: string | null
  archiviato: 0 | 1
}

// ha_immagine e' un flag, non l'immagine: l'elenco non trasporta i dati binari.
export type EsercizioConCategoria = Esercizio & {
  categoria_nome: string
  ha_immagine: 0 | 1
}

export interface EsercizioInput {
  nome: string
  categoria_id: number
  serie_default: string | null
  ripetizioni_default: string | null
  carico_default: string | null
  recupero_default: string | null
  nota_tecnica: string | null
  link: string | null
}

export interface Sezione {
  id: number
  fase_id: number
  nome: string
  ordine: number
}

// categoria_ids è ordinato secondo la sequenza riabilitativa scelta
export type SezioneConCategorie = Sezione & { categoria_ids: number[] }

export interface TestAvanzamento {
  id: number
  fase_id: number
  nome: string
  ordine: number
}

export interface TestValore {
  test_id: number
  nome: string
  eseguito: 0 | 1
  valore: string | null
}

export interface Paziente {
  id: number
  nome: string
  cognome: string
  data_nascita: string | null
  telefono: string | null
  email: string | null
  lavoro: string | null
  inviato_da: string | null
  // Testo libero: puo' essere la diagnosi del medico o l'ipotesi del
  // fisioterapista. Resta separata dalla patologia, che e' il percorso di cura.
  diagnosi: string | null
  tipo_intervento: string | null
  data_intervento: string | null
  patologia_id: number | null
  fase_corrente_id: number | null
}

export type PazienteDettaglio = Paziente & {
  patologia_nome: string | null
  fase_nome: string | null
  // data dell'ultima seduta, per tenere in cima chi e' in trattamento adesso
  ultima_seduta: string | null
}

export interface PazienteInput {
  nome: string
  cognome: string
  data_nascita: string | null
  telefono: string | null
  email: string | null
  lavoro: string | null
  inviato_da: string | null
  diagnosi: string | null
  tipo_intervento: string | null
  data_intervento: string | null
}

export type PazienteCreateInput = PazienteInput & {
  patologia_id: number | null
  fase_corrente_id: number | null
}

export interface SedutaEsercizioInput {
  esercizio_id: number
  serie: string | null
  ripetizioni: string | null
  carico: string | null
  recupero: string | null
  nota: string | null
  // indice nella lista sezioni della seduta; null = fuori sezione (dati vecchi)
  sezioneIndex: number | null
}

export interface SedutaSezioneInput {
  sezione_id: number | null // riferimento alla sezione del template, se derivata da esso
  nome: string
}

export interface SedutaInput {
  paziente_id: number
  data: string
  fase_id: number | null
  note: string | null
  sezioni: SedutaSezioneInput[]
  esercizi: SedutaEsercizioInput[]
}

export interface SedutaRiepilogo {
  id: number
  paziente_id: number
  data: string
  fase_nome: string | null
  note: string | null
  num_esercizi: number
  obiettivi_nomi: string | null
}

export type SedutaEsercizioDettaglio = Omit<SedutaEsercizioInput, 'sezioneIndex'> & {
  nome: string
  categoria_nome: string
  link: string | null
  ha_immagine: 0 | 1
}

export interface SedutaSezioneDettaglio {
  sezione_id: number | null
  nome: string
  esercizi: SedutaEsercizioDettaglio[]
}

export interface SedutaDettaglio {
  id: number
  paziente_id: number
  data: string
  fase_id: number | null
  fase_nome: string | null
  note: string | null
  sezioni: SedutaSezioneDettaglio[]
}

// ---- Questionari (PROM) ----
// Ogni domanda e' un elenco di risposte che valgono un punteggio: 'si_no' sono
// due risposte (0 e 1), 'scala' e' un intervallo di numeri, 'scelta' ha opzioni
// scritte a mano con il loro valore. Un solo meccanismo per tutte le forme.
export type TipoDomanda = 'si_no' | 'scala' | 'scelta'

export interface CategoriaQuestionario {
  id: number
  nome: string
  ordine: number
}

export interface Questionario {
  id: number
  categoria_id: number | null
  nome: string
  istruzioni: string | null
  ordine: number
  archiviato: 0 | 1
}

// id null = elemento nuovo, non ancora salvato
export interface OpzioneDomanda {
  id: number | null
  etichetta: string
  punteggio: number
}

export interface DomandaQuestionario {
  id: number | null
  testo: string
  tipo: TipoDomanda
  scala_min: number | null
  scala_max: number | null
  opzioni: OpzioneDomanda[]
}

// Un punteggio somma le risposte di alcune domande (es. "Totale" = tutte,
// "Sub" = dalla quinta alla nona).
export interface PunteggioQuestionario {
  id: number | null
  nome: string
  domanda_ids: number[]
}

// Regola di fascia: si legge in ordine e vince la prima che si avvera. La
// seconda condizione e' opzionale (serve a casi come lo StarT Back).
export interface FasciaQuestionario {
  id: number | null
  etichetta: string
  punteggio_id: number | null
  minimo: number | null
  massimo: number | null
  punteggio2_id: number | null
  minimo2: number | null
  massimo2: number | null
}

export interface QuestionarioCompleto {
  questionario: Questionario
  domande: DomandaQuestionario[]
  punteggi: PunteggioQuestionario[]
  fasce: FasciaQuestionario[]
}

export interface RispostaQuestionario {
  domanda_id: number
  valore: number
}

export interface CompilazioneInput {
  paziente_id: number
  questionario_id: number
  data: string
  note: string | null
  risposte: RispostaQuestionario[]
}

export interface CompilazioneRiepilogo {
  id: number
  data: string
  questionario_id: number
  questionario_nome: string
  fascia: string | null
  note: string | null
  punteggi: { nome: string; valore: number }[]
}

// ---- Test di valutazione (da letteratura) ----
// Una misura si registra a ogni prova (altezza del salto) oppure una volta sola
// per il test (simmetria). Il valore confrontato col cutoff e' la prova
// migliore, la media o la peggiore, secondo come e' definita la misura.
export type RiassuntoMisura = 'migliore' | 'media' | 'peggiore'

// 'min' = superato stando sopra la soglia; 'max' = stando sotto
export type DirezioneCutoff = 'min' | 'max'

export interface CategoriaTest {
  id: number
  nome: string
  ordine: number
}

export interface TestValutazione {
  id: number
  categoria_id: number | null
  nome: string
  descrizione: string | null
  protocollo: string | null
  // video o pagina che mostra come si esegue il test
  link: string | null
  prove: number
  ordine: number
  archiviato: 0 | 1
}

export interface ParametroTest {
  id: number | null
  nome: string
  valore: string | null
  unita: string | null
}

export interface MisuraTest {
  id: number | null
  nome: string
  unita: string | null
  per_prova: 0 | 1
  riassunto: RiassuntoMisura
  cutoff: number | null
  cutoff_direzione: DirezioneCutoff | null
}

export interface TestValutazioneCompleto {
  test: TestValutazione
  parametri: ParametroTest[]
  misure: MisuraTest[]
}

// ---- Body chart ----
// Le quattro viste da cui si guarda il paziente.
export type VistaCorpo = 'fronte' | 'retro' | 'sinistra' | 'destra'

// I quattro segni della legenda: rigidita' percepita, area dolorosa, scossa
// elettrica, parestesie.
export type TipoSegno = 'rigidita' | 'dolore' | 'scossa' | 'parestesie'

export interface SegnoBodyChart {
  id: number | null
  vista: VistaCorpo
  tipo: TipoSegno
  // frazioni 0..1 del riquadro della figura
  x: number
  y: number
  dimensione: number
  // 0..10, facoltativa: si vede passando il cursore sul segno
  intensita: number | null
}

export interface BodyChartRiepilogo {
  id: number
  data: string
  note: string | null
  num_segni: number
}

export interface BodyChart {
  id: number
  paziente_id: number
  data: string
  note: string | null
}

export interface BodyChartCompleta {
  chart: BodyChart
  segni: SegnoBodyChart[]
}

// ---- Anamnesi prossima ----
export type AndamentoSintomo = 'costante' | 'intermittente'
export type EpisodioSintomo = 'primo' | 'recidiva'

// id negativo = sintomo non ancora salvato, come per le domande dei questionari
export interface SintomoAnamnesi {
  id: number | null
  descrizione: string | null
  andamento: AndamentoSintomo | null
  da_quanto: string | null
  episodio: EpisodioSintomo | null
  esordio: string | null
  traumatico: 0 | 1 | null
  comportamento: string | null
  aggrava: string | null
  allevia: string | null
}

export interface AnamnesiProssima {
  motivo_consulto: string | null
  dolore_notturno: string | null
  disturbi_sonno: string | null
  tosse_starnuto: string | null
  sintomi_neurologici: string | null
  relazione_sintomi: string | null
  note: string | null
  sintomi: SintomoAnamnesi[]
}

export interface Api {
  // apre un URL http/https nel browser predefinito
  apriLink(url: string): Promise<void>
  // Apre il dialogo file e ritorna l'immagine gia' ridimensionata, o null.
  scegliImmagine(): Promise<string | null>
  auth: {
    status(): Promise<'setup' | 'login'>
    setup(password: string): Promise<string> // ritorna la recovery key
    login(password: string): Promise<void>
    recover(recoveryKey: string, nuovaPassword: string): Promise<void>
    cambiaPassword(vecchia: string, nuova: string): Promise<void>
  }
  patologie: {
    list(): Promise<Patologia[]>
    create(nome: string): Promise<number>
    update(id: number, nome: string): Promise<void>
    remove(id: number): Promise<void>
    reorder(ids: number[]): Promise<void>
  }
  fasi: {
    list(patologiaId: number): Promise<Fase[]>
    create(patologiaId: number, nome: string): Promise<number>
    update(id: number, nome: string): Promise<void>
    remove(id: number): Promise<void>
    reorder(ids: number[]): Promise<void>
  }
  obiettivi: {
    list(faseId: number): Promise<Obiettivo[]>
    create(faseId: number, nome: string): Promise<number>
    update(id: number, nome: string): Promise<void>
    remove(id: number): Promise<void>
    reorder(ids: number[]): Promise<void>
  }
  sezioni: {
    list(faseId: number): Promise<SezioneConCategorie[]>
    create(faseId: number, nome: string): Promise<number>
    update(id: number, nome: string): Promise<void>
    remove(id: number): Promise<void>
    reorder(ids: number[]): Promise<void>
    // sostituisce l'elenco ordinato delle categorie associate alla sezione
    setCategorie(sezioneId: number, categoriaIds: number[]): Promise<void>
  }
  testAvanzamento: {
    list(faseId: number): Promise<TestAvanzamento[]>
    create(faseId: number, nome: string): Promise<number>
    update(id: number, nome: string): Promise<void>
    remove(id: number): Promise<void>
    reorder(ids: number[]): Promise<void>
  }
  categorie: {
    list(): Promise<Categoria[]>
    create(nome: string): Promise<number>
    update(id: number, nome: string): Promise<void>
    remove(id: number): Promise<void>
    reorder(ids: number[]): Promise<void>
  }
  esercizi: {
    list(includiArchiviati: boolean): Promise<EsercizioConCategoria[]>
    create(data: EsercizioInput): Promise<number>
    update(id: number, data: EsercizioInput): Promise<void>
    setArchiviato(id: number, archiviato: boolean): Promise<void>
    remove(id: number): Promise<void>
    // L'immagine viaggia a parte: e' pesante e serve solo quando la si guarda.
    immagine(id: number): Promise<string | null>
    setImmagine(id: number, dataUrl: string | null): Promise<void>
  }
  pazienti: {
    list(): Promise<PazienteDettaglio[]>
    create(data: PazienteCreateInput): Promise<number>
    update(id: number, data: PazienteInput): Promise<void>
    setPatologiaFase(id: number, patologiaId: number | null, faseId: number | null): Promise<void>
    remove(id: number): Promise<void>
    // obiettivi raggiunti (stato persistente sul paziente)
    obiettiviRaggiunti(pazienteId: number): Promise<number[]>
    setObiettivoRaggiunto(pazienteId: number, obiettivoId: number, raggiunto: boolean): Promise<void>
    // test di avanzamento della fase, con stato/valore del paziente
    testValori(pazienteId: number, faseId: number): Promise<TestValore[]>
    setTestValore(
      pazienteId: number,
      testId: number,
      eseguito: boolean,
      valore: string | null
    ): Promise<void>
  }
  sedute: {
    list(pazienteId: number): Promise<SedutaRiepilogo[]>
    get(id: number): Promise<SedutaDettaglio>
    create(data: SedutaInput): Promise<number>
    update(id: number, data: SedutaInput): Promise<void>
    remove(id: number): Promise<void>
  }
  esporta: {
    // HTML della seduta per la sola anteprima a schermo (nessun file salvato).
    anteprima(sedutaId: number): Promise<string>
    // Ritornano il percorso del file salvato, o null se l'utente annulla.
    seduta(sedutaId: number, formato: 'pdf' | 'docx'): Promise<string | null>
    storico(
      pazienteId: number,
      dal: string,
      al: string,
      formato: 'pdf' | 'docx'
    ): Promise<string | null>
  }
  questionariCategorie: {
    list(): Promise<CategoriaQuestionario[]>
    create(nome: string): Promise<number>
    update(id: number, nome: string): Promise<void>
    remove(id: number): Promise<void>
    reorder(ids: number[]): Promise<void>
  }
  questionari: {
    // Ritorna tutti i questionari con la loro categoria: sono pochi, il filtro
    // per categoria si fa nell'interfaccia.
    list(includiArchiviati: boolean): Promise<Questionario[]>
    get(id: number): Promise<QuestionarioCompleto>
    create(nome: string, categoriaId: number): Promise<number>
    // Salva il questionario intero in una volta: le domande conservano il
    // proprio id, quelle sparite vengono eliminate. Cosi' le compilazioni gia'
    // fatte continuano a puntare alle domande giuste.
    salva(dati: QuestionarioCompleto): Promise<void>
    setArchiviato(id: number, archiviato: boolean): Promise<void>
    remove(id: number): Promise<void>
    reorder(ids: number[]): Promise<void>
  }
  compilazioni: {
    list(pazienteId: number): Promise<CompilazioneRiepilogo[]>
    risposte(compilazioneId: number): Promise<RispostaQuestionario[]>
    // Calcola punteggi e fascia lato principale e li memorizza con le risposte.
    create(dati: CompilazioneInput): Promise<number>
    remove(id: number): Promise<void>
  }
  testCategorie: {
    list(): Promise<CategoriaTest[]>
    create(nome: string): Promise<number>
    update(id: number, nome: string): Promise<void>
    remove(id: number): Promise<void>
    reorder(ids: number[]): Promise<void>
  }
  testValutazione: {
    list(includiArchiviati: boolean): Promise<TestValutazione[]>
    get(id: number): Promise<TestValutazioneCompleto>
    create(nome: string, categoriaId: number): Promise<number>
    salva(dati: TestValutazioneCompleto): Promise<void>
    remove(id: number): Promise<void>
    reorder(ids: number[]): Promise<void>
  }
  bodyChart: {
    list(pazienteId: number): Promise<BodyChartRiepilogo[]>
    get(id: number): Promise<BodyChartCompleta>
    create(pazienteId: number, data: string): Promise<number>
    // Salva tutto in blocco: i segni si riscrivono ogni volta, non sono citati
    // da nessun'altra tabella.
    salva(dati: BodyChartCompleta): Promise<void>
    remove(id: number): Promise<void>
  }
  anamnesi: {
    get(pazienteId: number): Promise<AnamnesiProssima>
    salva(pazienteId: number, dati: AnamnesiProssima): Promise<void>
  }
  impostazioni: {
    info(): Promise<{ cartella: string; cartellaExport: string }>
    apriCartella(): Promise<void>
    // Ritornano il nuovo percorso, o null se l'utente annulla.
    cambiaCartella(): Promise<string | null>
    cambiaCartellaExport(): Promise<string | null>
  }
}
