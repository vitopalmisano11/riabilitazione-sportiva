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

export type StatoPaziente = 'trattamento' | 'concluso'

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
  // 'trattamento' = lo stai seguendo adesso; 'concluso' = il ciclo e' finito e
  // il paziente e' passato nell'elenco del follow-up.
  stato: StatoPaziente
  // Quando risentirlo. Vuoto = non c'e' niente in programma.
  follow_up_il: string | null
  contattato_il: string | null
  recensione: 0 | 1
  // Qual e' l'arto operato: serve a calcolare l'LSI come operato ÷ sano invece
  // che come semplice differenza fra destra e sinistra.
  arto_operato: 'dx' | 'sx' | null
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
  arto_operato: 'dx' | 'sx' | null
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
  // Soglia sul rapporto fra i due arti (90, 95...). E' cosa diversa dal cutoff
  // della misura, che si confronta col valore misurato.
  lsi_cutoff: number | null
  // 1 = si esegue una gamba per volta (hop, single leg CMJ, dinamometro
  // d'anca): i valori si registrano destra e sinistra e da li' nasce
  // l'asimmetria fra i due arti.
  per_lato: 0 | 1
  ordine: number
  archiviato: 0 | 1
}

export interface ParametroTest {
  id: number | null
  nome: string
  valore: string | null
  unita: string | null
}

// Una misura che si ricava da altre due dello stesso test invece di essere
// misurata: 'rapporto' e' A ÷ B (l'EUR), 'differenza' e' A − B (il COD deficit).
export type CalcoloMisura = 'rapporto' | 'differenza'

export interface MisuraTest {
  id: number | null
  nome: string
  unita: string | null
  per_prova: 0 | 1
  riassunto: RiassuntoMisura
  cutoff: number | null
  cutoff_direzione: DirezioneCutoff | null
  // Se valorizzato, la misura non si scrive: si calcola dalle due indicate.
  calcolo: CalcoloMisura | null
  calcolo_a: number | null
  calcolo_b: number | null
}

export interface TestValutazioneCompleto {
  test: TestValutazione
  parametri: ParametroTest[]
  misure: MisuraTest[]
}

// ---- Screening (off season e non) ----
// Un protocollo non ha test propri: raccoglie e ordina quelli gia' scritti
// nella libreria, piu' i questionari, divisi in sezioni libere ("In
// ambulatorio", "In campo", oppure per qualita': forza, salti, sprint).
//
// Le voci non ancora salvate hanno un id negativo assegnato dall'interfaccia,
// come nei questionari: serve a tenere i riferimenti giusti anche riordinando
// prima di salvare.
export interface ProtocolloScreening {
  id: number
  nome: string
  sport: string
  note: string | null
  ordine: number
  archiviato: 0 | 1
}

export interface VoceScreening {
  id: number | null
  // Esattamente uno dei due e' valorizzato.
  test_id: number | null
  questionario_id: number | null
  // solo per mostrarlo: non si salva, viene dalla libreria
  nome?: string
}

export interface SezioneScreening {
  id: number | null
  nome: string
  voci: VoceScreening[]
}

export interface ProtocolloScreeningCompleto {
  protocollo: ProtocolloScreening
  sezioni: SezioneScreening[]
}

// ---- Screening eseguito ----
// Un protocollo somministrato a un paziente in una data. Nome del protocollo e
// sport sono copiati dentro: uno screening gia' fatto deve restare leggibile
// anche se il protocollo viene poi cambiato o cancellato.
export interface ScreeningRiepilogo {
  id: number
  paziente_id: number
  paziente_nome: string
  paziente_cognome: string
  data: string
  protocollo_nome: string
  sport: string
  note: string | null
  num_valori: number
}

export interface SessioneScreening extends ScreeningRiepilogo {
  protocollo_id: number | null
  // Copiato dal paziente: serve a sapere quale dei due arti e' quello operato.
  arto_operato: 'dx' | 'sx' | null
}

// Un valore misurato. lato = 'dx' | 'sx' per i test monopodalici, null per i
// bilaterali; prova = numero della ripetizione, null per le misure che si
// prendono una volta sola.
export interface ValoreScreening {
  misura_id: number
  lato: 'dx' | 'sx' | null
  prova: number | null
  valore: number
}

export type VoceEseguita =
  | {
      tipo: 'test'
      test_id: number
      nome: string
      protocollo: string | null
      prove: number
      per_lato: 0 | 1
      lsi_cutoff: number | null
      misure: MisuraTest[]
    }
  | {
      tipo: 'questionario'
      questionario_id: number
      nome: string
      compilazione_id: number | null
      compilazione_data: string | null
      fascia: string | null
    }

export interface ScreeningCompleto {
  sessione: SessioneScreening
  sezioni: { nome: string; voci: VoceEseguita[] }[]
  valori: ValoreScreening[]
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

// Un punto sul grafico dell'andamento. Nel grafico del giorno il tempo sono
// minuti dalla mezzanotte; in quello dall'esordio e' una data.
export type TipoGrafico = 'giorno' | 'esordio'

export interface PuntoAndamento {
  id: number | null
  grafico: TipoGrafico
  minuti: number | null
  data: string | null
  dolore: number
}

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
  punti: PuntoAndamento[]
}

export interface AnamnesiProssima {
  motivo_consulto: string | null
  dolore_notturno: string | null
  disturbi_sonno: string | null
  tosse_starnuto: string | null
  sintomi_neurologici: string | null
  relazione_sintomi: string | null
  note: string | null
  note_giorno: string | null
  note_esordio: string | null
  sintomi: SintomoAnamnesi[]
}

export interface AttivitaPartecipazione {
  attivita: string | null
  partecipazione: string | null
  fattori_interni: string | null
}

// Le nove domande di sicurezza: 1 si', 0 no, null non chiesto.
export type RispostaSiNo = 0 | 1 | null

export interface AnamnesiRemota {
  traumi: string | null
  interventi: string | null
  riabilitazioni: string | null
  bioimmagini_note: string | null
  peso: RispostaSiNo
  febbre: RispostaSiNo
  sudorazione: RispostaSiNo
  nausea: RispostaSiNo
  fumo: RispostaSiNo
  neoplasie: RispostaSiNo
  gravidanza: RispostaSiNo
  pacemaker: RispostaSiNo
  schegge: RispostaSiNo
}

// Obiettivo concordato col paziente. Il termine e' il respiro dell'obiettivo,
// non una scadenza: un obiettivo a lungo termine non ha una data.
export type TermineObiettivo = 'breve' | 'medio' | 'lungo'

export interface ObiettivoTerapeutico {
  id: number
  testo: string
  termine: TermineObiettivo
}

// ---- Scheda da mostrare al paziente ----
// Una sola seduta, con dentro le immagini degli esercizi: la finestra che la
// mostra riceve tutto in una volta e non chiede altro all'archivio.
export interface EsercizioScheda {
  nome: string
  categoria_nome: string
  serie: string | null
  ripetizioni: string | null
  carico: string | null
  recupero: string | null
  nota: string | null
}

export interface SchedaPaziente {
  paziente: string
  data: string
  fase_nome: string | null
  note: string | null
  sezioni: { nome: string; esercizi: EsercizioScheda[] }[]
}

export interface Bioimmagine {
  id: number
  nome: string
  tipo: string
  data: string
}

// ---- Valutazione obiettiva ----
// Movimenti e test stanno nel distretto: si scrivono una volta e si riusano su
// tutte le patologie che riguardano quella zona.
export type GruppoTest = 'provocazione' | 'forza' | 'neurologico' | 'altri'

// Come si risponde a un test: positivo/negativo, scala di forza 0-5, testo.
export type RispostaTest = 'posneg' | 'scala5' | 'testo'

// 0 nulla, 1 lieve, 2 moderata, 3 severa. null = non valutato.
export type Grado = 0 | 1 | 2 | 3 | null

export type Andamento = 'aumentato' | 'invariato' | 'diminuito'

export interface Distretto {
  id: number
  nome: string
  ordine: number
}

export interface MovimentoDistretto {
  id: number | null
  nome: string
  // 1 = si misura l'escursione in gradi
  gradi: 0 | 1
}

export interface TestDistretto {
  id: number | null
  nome: string
  gruppo: GruppoTest
  risposta: RispostaTest
}

export interface DistrettoCompleto {
  distretto: Distretto
  movimenti: MovimentoDistretto[]
  test: TestDistretto[]
}

export interface RilievoMovimento {
  movimento_id: number
  attivo_restrizione: Grado
  attivo_dolore: Grado
  attivo_gradi: number | null
  passivo_restrizione: Grado
  passivo_dolore: Grado
  passivo_gradi: number | null
  nota: string | null
}

export interface RilievoTest {
  test_id: number
  valore: string | null
  nota: string | null
}

export interface Valutazione {
  id: number
  paziente_id: number
  data: string
  ispezione: string | null
  note: string | null
  carico_locale: Andamento | null
  carico_generale: Andamento | null
  capacita_locale: Andamento | null
  capacita_generale: Andamento | null
}

export interface ValutazioneRiepilogo {
  id: number
  data: string
  note: string | null
  num_distretti: number
}

export interface ValutazioneCompleta {
  valutazione: Valutazione
  distretto_ids: number[]
  movimenti: RilievoMovimento[]
  test: RilievoTest[]
}

export interface VoceBackup {
  nome: string
  quando: string
  dimensione: number
}

export interface InfoBackup {
  cartella: string
  attivo: boolean
  daTenere: number
  copie: VoceBackup[]
}

// Le parti della cartella del paziente che si possono stampare.
export type SezioneCartella =
  | 'anagrafica'
  | 'anamnesi'
  | 'remota'
  | 'bodychart'
  | 'valutazioni'
  | 'questionari'
  | 'obiettivi'
  | 'sedute'

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
  distretti: {
    list(): Promise<Distretto[]>
    get(id: number): Promise<DistrettoCompleto>
    create(nome: string): Promise<number>
    salva(dati: DistrettoCompleto): Promise<void>
    remove(id: number): Promise<void>
    reorder(ids: number[]): Promise<void>
  }
  valutazioni: {
    list(pazienteId: number): Promise<ValutazioneRiepilogo[]>
    get(id: number): Promise<ValutazioneCompleta>
    create(pazienteId: number, data: string, distrettoIds: number[]): Promise<number>
    salva(dati: ValutazioneCompleta): Promise<void>
    remove(id: number): Promise<void>
  }
  patologie: {
    list(): Promise<Patologia[]>
    create(nome: string): Promise<number>
    update(id: number, nome: string): Promise<void>
    remove(id: number): Promise<void>
    reorder(ids: number[]): Promise<void>
    // distretti abituali della patologia: preselezione della valutazione
    distretti(patologiaId: number): Promise<number[]>
    setDistretti(patologiaId: number, distrettoIds: number[]): Promise<void>
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
  followUp: {
    // I due elenchi della sezione: chi e' in trattamento e chi ha finito.
    list(): Promise<{ trattamento: PazienteDettaglio[]; concluso: PazienteDettaglio[] }>
    // Sposta il paziente fra i due elenchi. Passando una data la imposta come
    // primo contatto da fare.
    setStato(id: number, stato: StatoPaziente, followUpIl: string | null): Promise<void>
    setFollowUp(id: number, followUpIl: string | null): Promise<void>
    // Segna il contatto fatto oggi e svuota la data del prossimo.
    segnaContattato(id: number, contattato: boolean): Promise<void>
    setRecensione(id: number, recensione: boolean): Promise<void>
  }
  esporta: {
    // HTML della seduta per la sola anteprima a schermo (nessun file salvato).
    anteprima(sedutaId: number): Promise<string>
    // Cartella completa: si scelgono le sezioni da includere.
    // L'anteprima si apre in una finestra a parte, il PDF si salva su file.
    anteprimaCartella(pazienteId: number, sezioni: SezioneCartella[]): Promise<void>
    cartella(pazienteId: number, sezioni: SezioneCartella[]): Promise<string | null>
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
    // Riscrive risposte e punteggi di una compilazione gia' salvata.
    update(id: number, dati: CompilazioneInput): Promise<void>
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
  screening: {
    // Gli sport gia' usati, per proporli invece di farli riscrivere.
    sport(): Promise<string[]>
    list(sport: string | null): Promise<ProtocolloScreening[]>
    get(id: number): Promise<ProtocolloScreeningCompleto>
    create(nome: string, sport: string): Promise<number>
    rinomina(id: number, nome: string): Promise<void>
    // Salva protocollo, sezioni e voci in blocco: quelle sparite si eliminano.
    salva(dati: ProtocolloScreeningCompleto): Promise<void>
    duplica(id: number, nome: string): Promise<number>
    remove(id: number): Promise<void>
    reorder(ids: number[]): Promise<void>
  }
  screeningSvolti: {
    // Passando null si vedono quelli di tutti i pazienti.
    list(pazienteId: number | null): Promise<ScreeningRiepilogo[]>
    get(id: number): Promise<ScreeningCompleto>
    create(pazienteId: number, protocolloId: number, data: string): Promise<number>
    // I valori si riscrivono tutti insieme.
    salva(
      id: number,
      data: string,
      note: string | null,
      valori: ValoreScreening[]
    ): Promise<void>
    collegaQuestionario(
      id: number,
      questionarioId: number,
      compilazioneId: number
    ): Promise<void>
    remove(id: number): Promise<void>
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
    attivita(pazienteId: number): Promise<AttivitaPartecipazione>
    salvaAttivita(pazienteId: number, dati: AttivitaPartecipazione): Promise<void>
    remota(pazienteId: number): Promise<AnamnesiRemota>
    salvaRemota(pazienteId: number, dati: AnamnesiRemota): Promise<void>
  }
  scheda: {
    // Apre (o riporta in primo piano) la finestra con la scheda della seduta.
    apri(sedutaId: number): Promise<void>
    dati(sedutaId: number): Promise<SchedaPaziente>
  }
  obiettiviTerapeutici: {
    list(pazienteId: number): Promise<ObiettivoTerapeutico[]>
    create(pazienteId: number, testo: string, termine: TermineObiettivo): Promise<number>
    update(id: number, testo: string, termine: TermineObiettivo): Promise<void>
    remove(id: number): Promise<void>
    // Gli id nell'ordine in cui devono comparire, tutti insieme.
    reorder(ids: number[]): Promise<void>
  }
  bioimmagini: {
    list(pazienteId: number): Promise<Bioimmagine[]>
    // Apre il dialogo file, salva il referto nell'archivio cifrato e ritorna
    // quante voci sono state aggiunte.
    aggiungi(pazienteId: number): Promise<number>
    // Scrive il file in una cartella temporanea e lo apre col programma di sistema.
    apri(id: number): Promise<void>
    remove(id: number): Promise<void>
  }
  backup: {
    info(): Promise<InfoBackup>
    cambiaCartella(): Promise<string | null>
    setAttivo(attivo: boolean): Promise<void>
    setDaTenere(n: number): Promise<void>
    // Esegue subito una copia e ritorna la cartella creata.
    eseguiOra(): Promise<string>
    apriCartella(): Promise<void>
    // Riporta indietro l'archivio: l'app si riavvia da sola.
    ripristina(nome: string): Promise<void>
  }
  impostazioni: {
    info(): Promise<{ cartella: string; cartellaExport: string }>
    apriCartella(): Promise<void>
    // Ritornano il nuovo percorso, o null se l'utente annulla.
    cambiaCartella(): Promise<string | null>
    cambiaCartellaExport(): Promise<string | null>
  }
}
