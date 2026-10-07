// Il contratto fra la pagina e il processo principale: ogni canale, con i suoi
// argomenti e quello che restituisce, scritto una volta sola.
//
// Da qui si ricavano tre cose, che prima andavano tenute d'accordo a mano:
//  - il tipo di window.api (Api, in types.ts), dalla MAPPA_API qui sotto;
//  - il ponte (src/preload/index.ts), che costruisce window.api dalla stessa
//    mappa: ogni metodo chiama il suo canale con gli stessi argomenti;
//  - i gestori (src/main/ipc.ts): handle() accetta solo canali di questo
//    elenco, con gli argomenti giusti, e all'avvio controlla che ognuno abbia
//    il suo gestore.
//
// Per una funzione nuova: la firma qui in Canali, il metodo in MAPPA_API, il
// gestore in ipc.ts. Il typecheck dice se manca qualcosa.
import type {
  Promemoria,
  PromemoriaInput,
  AnamnesiProssima,
  AnamnesiRemota,
  AndamentoSegno,
  AnteprimaScheda,
  AttivitaPartecipazione,
  Bioimmagine,
  BodyChartCompleta,
  BodyChartRiepilogo,
  Categoria,
  CategoriaQuestionario,
  CategoriaTest,
  CertificatoInput,
  CompilazioneInput,
  CompilazioneRiepilogo,
  Distretto,
  DistrettoCompleto,
  EsercizioConCategoria,
  EsercizioInput,
  EsitoArchivio,
  EsitoControllo,
  Fase,
  Gruppo,
  Indicazione,
  InfoAccesso,
  InfoBackup,
  Massimale,
  Obiettivo,
  ObiettivoTerapeutico,
  Patologia,
  PazienteCreateInput,
  PazienteDettaglio,
  PazienteInput,
  Profilo,
  ProtocolloScreening,
  ProtocolloScreeningCompleto,
  PuntoAndamentoDolore,
  Questionario,
  QuestionarioCompleto,
  RispostaQuestionario,
  RisultatoPunteggio,
  RisultatoRicerca,
  SchedaPaziente,
  ScreeningCompleto,
  ScreeningRiepilogo,
  SedutaDettaglio,
  SedutaInput,
  SedutaPrecedente,
  SedutaRiepilogo,
  SedutaSettimana,
  Segno,
  SezioneCartella,
  SezioneConCategorie,
  StatoAggiornamento,
  StatoPaziente,
  Tecnica,
  TermineObiettivo,
  TestAvanzamento,
  TestValore,
  TestValutazione,
  TestValutazioneCompleto,
  TipoChart,
  TipoRelazione,
  UltimaVolta,
  ValoreScreening,
  ValutazioneCompleta,
  ValutazioneRiepilogo,
  VoceCestino,
} from './types'
import type {
  Tema,
} from './temi'

export interface Canali {
  // apre un URL http/https nel browser predefinito
  'apriLink': (url: string) => void
  'aggiornamento:stato': () => StatoAggiornamento
  // Chiude il programma (salvando), installa e lo riapre.
  'aggiornamento:installa': () => void
  'finestra:comando': (c: 'riduci' | 'ingrandisci' | 'chiudi') => void
  'finestra:ingrandita': () => boolean
  // Apre il dialogo file e ritorna l'immagine gia' ridimensionata, o null.
  'scegliImmagine': () => string | null
  'auth:status': () => InfoAccesso
  // Prima dell'accesso, quando l'archivio non si trova: si indica la cartella
  // che contiene riabilitazione.db. null se si annulla.
  'auth:scegliCartellaDati': () => InfoAccesso | null
  // Prima dell'accesso, quando accanto all'archivio manca auth.json: lo si
  // prende da una copia di sicurezza. null se si annulla.
  'auth:prendiChiavi': () => InfoAccesso | null
  // ritorna la recovery key
  'auth:setup': (password: string) => string
  'auth:login': (password: string) => void
  'auth:recover': (recoveryKey: string, nuovaPassword: string) => void
  'auth:cambiaPassword': (vecchia: string, nuova: string) => void
  // La domanda per recuperare la password: il testo, o null se non c'e'.
  'auth:domanda': () => string | null
  'auth:impostaDomanda': (password: string, domanda: string, risposta: string) => void
  'auth:togliDomanda': (password: string) => void
  'auth:recoverDomanda': (risposta: string, nuovaPassword: string) => void
  // La password usata per entrare non reggerebbe le regole di oggi per una
  // password nuova (vedi shared/password.ts): da cambiare prima di mettere le
  // copie online.
  'auth:passwordDebole': () => boolean
  'distretti:list': () => Distretto[]
  'distretti:get': (id: number) => DistrettoCompleto
  'distretti:create': (nome: string) => number
  'distretti:salva': (dati: DistrettoCompleto) => void
  'distretti:delete': (id: number) => void
  'distretti:reorder': (ids: number[]) => void
  'sicurezza:blocco': () => { attivo: boolean; minuti: number }
  'sicurezza:setBlocco': (b: { attivo: boolean; minuti: number }) => void
  // true se la password e' quella giusta; non riapre il database.
  'sicurezza:verificaPassword': (password: string) => boolean
  'indicazioni:list': () => Indicazione[]
  'indicazioni:create': (testo: string) => number
  'indicazioni:rinomina': (id: number, testo: string) => void
  'indicazioni:delete': (id: number) => void
  // Quelle scelte per un paziente, con ogni quanto deve fare il programma.
  'indicazioni:delPaziente': (pazienteId: number) => number[]
  'indicazioni:setDelPaziente': (
    pazienteId: number,
    ids: number[],
    frequenza: string | null,
  ) => void
  'massimali:list': (pazienteId: number) => Massimale[]
  'massimali:create': (
    pazienteId: number,
    esercizio: string,
    valore: number,
    unita: string | null,
    data: string,
  ) => number
  'massimali:delete': (id: number) => void
  // Peso e altezza stanno sul paziente: sono una cosa sola, non una storia.
  'massimali:setMisure': (pazienteId: number, peso: number | null, altezza: number | null) => void
  'segni:list': (pazienteId: number) => Segno[]
  'segni:andamento': (pazienteId: number) => AndamentoSegno[]
  'segni:create': (pazienteId: number, nome: string, unita: string | null) => number
  'segni:rinomina': (id: number, nome: string, unita: string | null) => void
  'segni:delete': (id: number) => void
  // I valori misurati in una seduta, per riaprirla e ritoccarli.
  'segni:dellaSeduta': (sedutaId: number) => { segno_id: number; valore: number }[]
  'profilo:leggi': () => Profilo
  'profilo:salva': (p: Profilo) => void
  'registro:ultimi': () => string
  'registro:apri': () => void
  'ricerca:cerca': (testo: string) => RisultatoRicerca[]
  'cestino:list': () => VoceCestino[]
  'cestino:ripristina': (id: number) => void
  // Senza id svuota tutto.
  'cestino:svuota': (id?: number) => void
  'bozze:leggi': (pazienteId: number) => { aggiornata_il: string; contenuto: string } | null
  'bozze:salva': (pazienteId: number, contenuto: string) => void
  'bozze:elimina': (pazienteId: number) => void
  'valutazioni:list': (pazienteId: number) => ValutazioneRiepilogo[]
  'valutazioni:get': (id: number) => ValutazioneCompleta
  'valutazioni:create': (pazienteId: number, data: string, distrettoIds: number[]) => number
  // Nuova valutazione che riparte dai rilievi di una precedente.
  'valutazioni:duplica': (id: number, data: string) => number
  'valutazioni:salva': (dati: ValutazioneCompleta) => void
  'valutazioni:delete': (id: number) => void
  'patologie:list': () => Patologia[]
  'patologie:create': (nome: string) => number
  'patologie:update': (id: number, nome: string) => void
  // Accende o spegne il percorso al campo per questa patologia.
  'patologie:setCampo': (id: number, attivo: boolean) => void
  'patologie:delete': (id: number) => void
  'patologie:reorder': (ids: number[]) => void
  // distretti abituali della patologia: preselezione della valutazione
  'patologie:distretti': (patologiaId: number) => number[]
  'patologie:setDistretti': (patologiaId: number, distrettoIds: number[]) => void
  'gruppi:list': () => Gruppo[]
  'gruppi:create': (nome: string) => number
  'gruppi:update': (id: number, nome: string) => void
  'gruppi:delete': (id: number) => void
  'gruppi:reorder': (ids: number[]) => void
  'fasi:list': (patologiaId: number) => Fase[]
  'fasi:create': (patologiaId: number, nome: string, campo?: boolean) => number
  'fasi:update': (id: number, nome: string) => void
  'fasi:delete': (id: number) => void
  'fasi:reorder': (ids: number[]) => void
  'obiettivi:list': (faseId: number) => Obiettivo[]
  'obiettivi:create': (faseId: number, nome: string) => number
  'obiettivi:update': (id: number, nome: string) => void
  'obiettivi:delete': (id: number) => void
  'obiettivi:reorder': (ids: number[]) => void
  'sezioni:list': (faseId: number) => SezioneConCategorie[]
  'sezioni:create': (faseId: number, nome: string) => number
  'sezioni:update': (id: number, nome: string) => void
  'sezioni:delete': (id: number) => void
  'sezioni:reorder': (ids: number[]) => void
  // sostituisce l'elenco ordinato delle categorie associate alla sezione
  'sezioni:setCategorie': (sezioneId: number, categoriaIds: number[]) => void
  'testAvanzamento:list': (faseId: number) => TestAvanzamento[]
  'testAvanzamento:create': (faseId: number, nome: string) => number
  'testAvanzamento:update': (id: number, nome: string) => void
  'testAvanzamento:delete': (id: number) => void
  'testAvanzamento:reorder': (ids: number[]) => void
  'categorie:list': () => Categoria[]
  'categorie:create': (nome: string) => number
  'categorie:update': (id: number, nome: string) => void
  // Accende o spegne il dosaggio a cluster per gli esercizi di questa categoria.
  'categorie:setCluster': (id: number, attivo: boolean) => void
  'categorie:setRir': (id: number, attivo: boolean) => void
  // Sposta una categoria dentro a un'altra, o la riporta al primo livello.
  'categorie:setPadre': (id: number, padreId: number | null) => void
  'categorie:delete': (id: number) => void
  'categorie:reorder': (ids: number[]) => void
  'esercizi:list': (includiArchiviati: boolean) => EsercizioConCategoria[]
  'esercizi:create': (data: EsercizioInput) => number
  'esercizi:update': (id: number, data: EsercizioInput) => void
  'esercizi:setArchiviato': (id: number, archiviato: boolean) => void
  'esercizi:delete': (id: number) => void
  // L'immagine viaggia a parte: e' pesante e serve solo quando la si guarda.
  'esercizi:immagine': (id: number) => string | null
  'esercizi:setImmagine': (id: number, dataUrl: string | null) => void
  'pazienti:list': () => PazienteDettaglio[]
  'pazienti:create': (data: PazienteCreateInput) => number
  'pazienti:update': (id: number, data: PazienteInput) => void
  'pazienti:setPatologiaFase': (
    id: number,
    patologiaId: number | null,
    faseId: number | null,
  ) => void
  'pazienti:delete': (id: number) => void
  // via subito dall'archivio e dal cestino (diritto alla cancellazione)
  'pazienti:deleteForever': (id: number) => void
  // obiettivi raggiunti (stato persistente sul paziente)
  'pazienti:obiettiviRaggiunti': (pazienteId: number) => number[]
  'pazienti:setObiettivoRaggiunto': (
    pazienteId: number,
    obiettivoId: number,
    raggiunto: boolean,
  ) => void
  // Il dolore nel tempo, per la linguetta "Quadro": sedute svolte e punti
  // dell'anamnesi iniziale, gia' uniti e ordinati per data.
  'pazienti:andamentoDolore': (pazienteId: number) => PuntoAndamentoDolore[]
  // test di avanzamento della fase, con stato/valore del paziente
  'pazienti:testValori': (pazienteId: number, faseId: number) => TestValore[]
  'pazienti:setTestValore': (
    pazienteId: number,
    testId: number,
    eseguito: boolean,
    valore: string | null,
  ) => void
  'sedute:list': (pazienteId: number) => SedutaRiepilogo[]
  // Le sedute di tutti i pazienti fra due date, per la settimana.
  'sedute:settimana': (dal: string, al: string) => SedutaSettimana[]
  // I focus gia' usati, dal piu' recente: si suggeriscono invece di
  // riscriverli.
  'sedute:focusUsati': () => string[]
  // L'ultima volta che questo paziente ha fatto ciascun esercizio, con i
  // numeri di quella volta. Serve a decidere la progressione guardando il
  // dato invece che a memoria. `escludi` e' la seduta che si sta
  // modificando: se stessa non e' "l'ultima volta".
  'sedute:ultimaVolta': (pazienteId: number, escludi: number | null) => UltimaVolta[]
  // La seduta prima di questa: cosa riferiva, il trattamento, i segni.
  'sedute:precedente': (
    pazienteId: number,
    escludi: number | null,
    finoAl: string,
  ) => SedutaPrecedente | null
  'sedute:get': (id: number) => SedutaDettaglio
  'sedute:create': (data: SedutaInput) => number
  'sedute:update': (id: number, data: SedutaInput) => void
  // Copia una seduta su piu' date: e' il programma della settimana.
  'sedute:programma': (origineId: number, date: string[], ora?: string | null) => number[]
  'sedute:delete': (id: number) => void
  // I due elenchi della sezione: chi e' in trattamento e chi ha finito.
  'followUp:list': () => { trattamento: PazienteDettaglio[]; concluso: PazienteDettaglio[] }
  // Sposta il paziente fra i due elenchi. Passando una data la imposta come
  // primo contatto da fare.
  'followUp:setStato': (id: number, stato: StatoPaziente, followUpIl: string | null) => void
  'followUp:setFollowUp': (id: number, followUpIl: string | null) => void
  // Segna il contatto fatto oggi e svuota la data del prossimo.
  'followUp:segnaContattato': (id: number, contattato: boolean) => void
  'followUp:setRecensione': (id: number, recensione: boolean) => void
  // Promemoria "ripeti questo questionario / screening". Con un paziente
  // torna tutto il suo, senza gli aperti di tutti gli altri; senza, gli aperti
  // di tutti (per la pagina Follow-up).
  'promemoria:list': (pazienteId: number | null) => Promemoria[]
  'promemoria:create': (dati: PromemoriaInput) => number
  'promemoria:setFatto': (id: number, fatto: boolean) => void
  'promemoria:delete': (id: number) => void
  // Quanti sono da fare oggi o in ritardo: il numerino del menu.
  'promemoria:conta': () => number
  // HTML della seduta per la sola anteprima a schermo (nessun file salvato).
  // Scheda illustrata: foto, spiegazione e link al video, per il paziente che
  // si allena da solo. Torna anche l'elenco di cosa manca da riempire.
  'esporta:schedaIllustrata': (sedutaId: number) => AnteprimaScheda
  // Il certificato di presenza, in PDF. Il percorso, o null se annulli.
  'esporta:certificato': (dati: CertificatoInput) => string | null
  // Cartella completa: si scelgono le sezioni da includere.
  // L'anteprima si apre in una finestra a parte, il PDF si salva su file.
  'esporta:anteprimaCartella': (pazienteId: number, sezioni: SezioneCartella[]) => void
  // La relazione scritta dell'anamnesi: un documento a parte, non una
  // sezione della cartella.
  'esporta:anteprimaRelazione': (pazienteId: number, tipo: TipoRelazione) => void
  'esporta:relazione': (pazienteId: number, tipo: TipoRelazione) => string | null
  'esporta:cartella': (pazienteId: number, sezioni: SezioneCartella[]) => string | null
  // Ritornano il percorso del file salvato, o null se l'utente annulla.
  'esporta:seduta': (
    sedutaId: number,
    formato: 'pdf' | 'docx',
    illustrata?: boolean,
  ) => string | null
  'esporta:storico': (
    pazienteId: number,
    dal: string,
    al: string,
    formato: 'pdf' | 'docx',
  ) => string | null
  'questionariCategorie:list': () => CategoriaQuestionario[]
  'questionariCategorie:create': (nome: string) => number
  'questionariCategorie:update': (id: number, nome: string) => void
  'questionariCategorie:delete': (id: number) => void
  'questionariCategorie:reorder': (ids: number[]) => void
  // Ritorna tutti i questionari con la loro categoria: sono pochi, il filtro
  // per categoria si fa nell'interfaccia.
  'questionari:list': (includiArchiviati: boolean) => Questionario[]
  'questionari:get': (id: number) => QuestionarioCompleto
  'questionari:create': (nome: string, categoriaId: number) => number
  // Crea nella categoria un questionario gia' scritto (es. 'ikdc').
  'questionari:daModello': (chiave: string, categoriaId: number) => number
  // Salva il questionario intero in una volta: le domande conservano il
  // proprio id, quelle sparite vengono eliminate. Cosi' le compilazioni gia'
  // fatte continuano a puntare alle domande giuste.
  'questionari:salva': (dati: QuestionarioCompleto) => void
  // Quante compilazioni gia' fatte darebbero un risultato diverso con le
  // regole di oggi, e il ricalcolo di tutte quelle (ritorna quante).
  'questionari:daRicalcolare': (id: number) => number
  'questionari:ricalcolaCompilazioni': (id: number) => number
  'questionari:setArchiviato': (id: number, archiviato: boolean) => void
  'questionari:delete': (id: number) => void
  'questionari:reorder': (ids: number[]) => void
  'compilazioni:list': (pazienteId: number) => CompilazioneRiepilogo[]
  'compilazioni:risposte': (compilazioneId: number) => RispostaQuestionario[]
  // Calcola punteggi e fascia lato principale e li memorizza con le risposte.
  'compilazioni:create': (dati: CompilazioneInput) => number
  // Riscrive risposte e punteggi di una compilazione gia' salvata.
  'compilazioni:update': (id: number, dati: CompilazioneInput) => void
  // Ricalcola punteggi e fascia con le regole di oggi del questionario.
  'compilazioni:ricalcola': (id: number) => void
  'compilazioni:delete': (id: number) => void
  'testCategorie:list': () => CategoriaTest[]
  'testCategorie:create': (nome: string) => number
  'testCategorie:update': (id: number, nome: string) => void
  'testCategorie:delete': (id: number) => void
  'testCategorie:reorder': (ids: number[]) => void
  'testValutazione:list': (includiArchiviati: boolean) => TestValutazione[]
  'testValutazione:get': (id: number) => TestValutazioneCompleto
  'testValutazione:create': (nome: string, categoriaId: number) => number
  'testValutazione:salva': (dati: TestValutazioneCompleto) => void
  'testValutazione:delete': (id: number) => void
  'testValutazione:reorder': (ids: number[]) => void
  // Gli sport gia' usati, per proporli invece di farli riscrivere.
  'screening:sport': () => string[]
  'screening:list': (sport: string | null) => ProtocolloScreening[]
  'screening:get': (id: number) => ProtocolloScreeningCompleto
  'screening:create': (nome: string, sport: string) => number
  'screening:rinomina': (id: number, nome: string) => void
  // Salva protocollo, sezioni e voci in blocco: quelle sparite si eliminano.
  'screening:salva': (dati: ProtocolloScreeningCompleto) => void
  'screening:duplica': (id: number, nome: string) => number
  'screening:delete': (id: number) => void
  'screening:reorder': (ids: number[]) => void
  // Passando null si vedono quelli di tutti i pazienti.
  'screeningSvolti:list': (pazienteId: number | null) => ScreeningRiepilogo[]
  'screeningSvolti:get': (id: number) => ScreeningCompleto
  'screeningSvolti:create': (pazienteId: number, protocolloId: number, data: string) => number
  // I valori si riscrivono tutti insieme.
  'screeningSvolti:salva': (
    id: number,
    data: string,
    note: string | null,
    valori: ValoreScreening[],
  ) => void
  'screeningSvolti:collegaQuestionario': (
    id: number,
    questionarioId: number,
    compilazioneId: number,
  ) => void
  // Il punteggio del cluster sui valori salvati; null se il protocollo non ne ha.
  'screeningSvolti:punteggio': (id: number) => RisultatoPunteggio | null
  // Il report: gli screening da confrontare, dal piu' vecchio al piu' recente.
  // L'ultimo e' quello che si legge nelle tabelle, gli altri fanno l'andamento.
  'screeningSvolti:anteprimaReport': (ids: number[]) => void
  'screeningSvolti:report': (ids: number[]) => string | null
  'screeningSvolti:delete': (id: number) => void
  'bodyChart:list': (pazienteId: number) => BodyChartRiepilogo[]
  'bodyChart:get': (id: number) => BodyChartCompleta
  'bodyChart:create': (pazienteId: number, data: string, tipo: TipoChart) => number
  // Salva tutto in blocco: i segni si riscrivono ogni volta, non sono citati
  // da nessun'altra tabella.
  'bodyChart:salva': (dati: BodyChartCompleta) => void
  'bodyChart:delete': (id: number) => void
  'anamnesi:get': (pazienteId: number) => AnamnesiProssima
  'anamnesi:salva': (pazienteId: number, dati: AnamnesiProssima) => void
  'anamnesi:attivita': (pazienteId: number) => AttivitaPartecipazione
  'anamnesi:salvaAttivita': (pazienteId: number, dati: AttivitaPartecipazione) => void
  'anamnesi:remota': (pazienteId: number) => AnamnesiRemota
  'anamnesi:salvaRemota': (pazienteId: number, dati: AnamnesiRemota) => void
  // Apre (o riporta in primo piano) la finestra con la scheda della seduta.
  'scheda:apri': (sedutaId: number) => void
  'scheda:dati': (sedutaId: number) => SchedaPaziente
  'obiettiviTerapeutici:list': (pazienteId: number) => ObiettivoTerapeutico[]
  // Quello che il paziente si aspetta, con parole sue: una casella sola.
  'obiettiviTerapeutici:aspettative': (pazienteId: number) => string | null
  'obiettiviTerapeutici:salvaAspettative': (pazienteId: number, testo: string | null) => void
  'obiettiviTerapeutici:create': (
    pazienteId: number,
    testo: string,
    termine: TermineObiettivo,
  ) => number
  'obiettiviTerapeutici:update': (id: number, testo: string, termine: TermineObiettivo) => void
  'obiettiviTerapeutici:remove': (id: number) => void
  // Gli id nell'ordine in cui devono comparire, tutti insieme.
  'obiettiviTerapeutici:reorder': (ids: number[]) => void
  'bioimmagini:list': (pazienteId: number) => Bioimmagine[]
  // Apre il dialogo file, salva il referto nell'archivio cifrato e ritorna
  // quante voci sono state aggiunte.
  'bioimmagini:aggiungi': (pazienteId: number) => number
  // Scrive il file in una cartella temporanea e lo apre col programma di sistema.
  'bioimmagini:apri': (id: number) => void
  'bioimmagini:delete': (id: number) => void
  // Controlla che il file dell'archivio sia sano e i collegamenti interi.
  'archivio:controlla': () => EsitoArchivio
  'backup:info': () => InfoBackup
  'backup:cambiaCartella': () => string | null
  // Sposta le copie in una cartella di OneDrive: da li' vanno online da sole.
  'backup:usaOneDrive': () => string
  'backup:setAttivo': (attivo: boolean) => void
  'backup:setDaTenere': (n: number) => void
  // Esegue subito una copia e ritorna la cartella creata.
  'backup:eseguiOra': () => string
  'backup:apriCartella': () => void
  // Apre la copia in disparte e dice se e' leggibile e cosa contiene.
  'backup:controlla': (nome: string) => EsitoControllo
  // Riporta indietro l'archivio: l'app si riavvia da sola.
  'backup:ripristina': (nome: string) => void
  // Copia dell'archivio in una cartella scelta (chiavetta, disco esterno).
  // Torna il percorso della copia, o null se si annulla.
  'backup:copiaFuori': () => string | null
  // Tabelle CSV leggibili senza l'app (non e' un backup ripristinabile).
  'backup:esportaArchivio': () => string | null
  'tecniche:list': (includiArchiviate: boolean) => Tecnica[]
  'tecniche:crea': (nome: string) => number
  'tecniche:setArchiviata': (id: number, archiviata: boolean) => void
  'impostazioni:setTema': (t: Tema) => void
  'impostazioni:setScuro': (valore: boolean) => void
  // scura dalle ... alle ..., ogni giorno
  'impostazioni:setScuroAutomatico': (dalle: string, alle: string) => void
  'impostazioni:setBarraScura': (valore: boolean) => void
  'impostazioni:setIngrandimento': (valore: number) => void
  'impostazioni:info': () => {
    cartella: string
    cartellaExport: string
    tema: Tema
    scuro: boolean
    // scura in questo momento, anche con gli orari fissi
    scuroAdesso: boolean
    orariScuro: { automatico: boolean; dalle: string; alle: string }
    barraScura: boolean
    // 1 e' la misura normale dei caratteri; 1.2 vuol dire "un quinto piu'
    // grandi", e con loro cresce tutto il resto della pagina.
    ingrandimento: number
  }
  'impostazioni:apriCartella': () => void
  // Ritornano il nuovo percorso, o null se l'utente annulla.
  'impostazioni:cambiaCartella': () => string | null
  'impostazioni:cambiaCartellaExport': () => string | null
}

// La forma di window.api: gruppo -> metodo -> canale.
export const MAPPA_API = {
  apriLink: 'apriLink',
  aggiornamenti: {
    stato: 'aggiornamento:stato',
    installa: 'aggiornamento:installa'
  },
  // I pulsanti della barra disegnata in cima alla finestra.
  finestra: {
    comando: 'finestra:comando',
    ingrandita: 'finestra:ingrandita'
  },
  scegliImmagine: 'scegliImmagine',
  auth: {
    status: 'auth:status',
    scegliCartellaDati: 'auth:scegliCartellaDati',
    prendiChiavi: 'auth:prendiChiavi',
    setup: 'auth:setup',
    login: 'auth:login',
    recover: 'auth:recover',
    cambiaPassword: 'auth:cambiaPassword',
    domanda: 'auth:domanda',
    impostaDomanda: 'auth:impostaDomanda',
    togliDomanda: 'auth:togliDomanda',
    recoverDomanda: 'auth:recoverDomanda',
    passwordDebole: 'auth:passwordDebole'
  },
  distretti: {
    list: 'distretti:list',
    get: 'distretti:get',
    create: 'distretti:create',
    salva: 'distretti:salva',
    remove: 'distretti:delete',
    reorder: 'distretti:reorder'
  },
  // Blocco automatico dopo un po' che non tocchi niente, e rientro.
  sicurezza: {
    blocco: 'sicurezza:blocco',
    setBlocco: 'sicurezza:setBlocco',
    verificaPassword: 'sicurezza:verificaPassword'
  },
  // Chi firma i fogli: nome, qualifica e contatti in cima ai documenti.
  profilo: {
    leggi: 'profilo:leggi',
    salva: 'profilo:salva'
  },
  // Il registro degli errori: solo nomi di operazioni e messaggi, niente dati.
  registro: {
    ultimi: 'registro:ultimi',
    apri: 'registro:apri'
  },
  // Cerca in tutto l'archivio: pazienti, diario delle sedute, anamnesi.
  ricerca: {
    cerca: 'ricerca:cerca'
  },
  // Quello che e' stato eliminato di recente e si puo' ancora rimettere.
  cestino: {
    list: 'cestino:list',
    ripristina: 'cestino:ripristina',
    svuota: 'cestino:svuota'
  },
  // Bozza della seduta che si sta costruendo: una per paziente, ritrovata alla
  // riapertura se l'app si e' chiusa a meta'.
  bozze: {
    leggi: 'bozze:leggi',
    salva: 'bozze:salva',
    elimina: 'bozze:elimina'
  },
  valutazioni: {
    list: 'valutazioni:list',
    get: 'valutazioni:get',
    create: 'valutazioni:create',
    duplica: 'valutazioni:duplica',
    salva: 'valutazioni:salva',
    remove: 'valutazioni:delete'
  },
  patologie: {
    list: 'patologie:list',
    create: 'patologie:create',
    update: 'patologie:update',
    setCampo: 'patologie:setCampo',
    remove: 'patologie:delete',
    reorder: 'patologie:reorder',
    distretti: 'patologie:distretti',
    setDistretti: 'patologie:setDistretti'
  },
  gruppi: {
    list: 'gruppi:list',
    create: 'gruppi:create',
    update: 'gruppi:update',
    remove: 'gruppi:delete',
    reorder: 'gruppi:reorder'
  },
  fasi: {
    list: 'fasi:list',
    create: 'fasi:create',
    update: 'fasi:update',
    remove: 'fasi:delete',
    reorder: 'fasi:reorder'
  },
  obiettivi: {
    list: 'obiettivi:list',
    create: 'obiettivi:create',
    update: 'obiettivi:update',
    remove: 'obiettivi:delete',
    reorder: 'obiettivi:reorder'
  },
  sezioni: {
    list: 'sezioni:list',
    create: 'sezioni:create',
    update: 'sezioni:update',
    remove: 'sezioni:delete',
    reorder: 'sezioni:reorder',
    setCategorie: 'sezioni:setCategorie'
  },
  testAvanzamento: {
    list: 'testAvanzamento:list',
    create: 'testAvanzamento:create',
    update: 'testAvanzamento:update',
    remove: 'testAvanzamento:delete',
    reorder: 'testAvanzamento:reorder'
  },
  categorie: {
    list: 'categorie:list',
    create: 'categorie:create',
    update: 'categorie:update',
    setCluster: 'categorie:setCluster',
    setRir: 'categorie:setRir',
    setPadre: 'categorie:setPadre',
    remove: 'categorie:delete',
    reorder: 'categorie:reorder'
  },
  esercizi: {
    list: 'esercizi:list',
    create: 'esercizi:create',
    update: 'esercizi:update',
    setArchiviato: 'esercizi:setArchiviato',
    remove: 'esercizi:delete',
    immagine: 'esercizi:immagine',
    setImmagine: 'esercizi:setImmagine'
  },
  pazienti: {
    list: 'pazienti:list',
    create: 'pazienti:create',
    update: 'pazienti:update',
    setPatologiaFase: 'pazienti:setPatologiaFase',
    remove: 'pazienti:delete',
    removeForever: 'pazienti:deleteForever',
    obiettiviRaggiunti: 'pazienti:obiettiviRaggiunti',
    setObiettivoRaggiunto: 'pazienti:setObiettivoRaggiunto',
    andamentoDolore: 'pazienti:andamentoDolore',
    testValori: 'pazienti:testValori',
    setTestValore: 'pazienti:setTestValore'
  },
  // Le frasi per il foglio da portare a casa: l'elenco e chi le ha.
  indicazioni: {
    list: 'indicazioni:list',
    create: 'indicazioni:create',
    rinomina: 'indicazioni:rinomina',
    remove: 'indicazioni:delete',
    delPaziente: 'indicazioni:delPaziente',
    setDelPaziente: 'indicazioni:setDelPaziente'
  },
  // I massimali del paziente, per prescrivere il carico in percentuale.
  massimali: {
    list: 'massimali:list',
    create: 'massimali:create',
    remove: 'massimali:delete',
    setMisure: 'massimali:setMisure'
  },
  // I segni di riferimento del paziente e le loro misure.
  segni: {
    list: 'segni:list',
    andamento: 'segni:andamento',
    create: 'segni:create',
    rinomina: 'segni:rinomina',
    remove: 'segni:delete',
    dellaSeduta: 'segni:dellaSeduta'
  },
  sedute: {
    list: 'sedute:list',
    focusUsati: 'sedute:focusUsati',
    ultimaVolta: 'sedute:ultimaVolta',
    precedente: 'sedute:precedente',
    settimana: 'sedute:settimana',
    get: 'sedute:get',
    create: 'sedute:create',
    update: 'sedute:update',
    programma: 'sedute:programma',
    remove: 'sedute:delete'
  },
  followUp: {
    list: 'followUp:list',
    setStato: 'followUp:setStato',
    setFollowUp: 'followUp:setFollowUp',
    segnaContattato: 'followUp:segnaContattato',
    setRecensione: 'followUp:setRecensione'
  },
  promemoria: {
    list: 'promemoria:list',
    create: 'promemoria:create',
    setFatto: 'promemoria:setFatto',
    remove: 'promemoria:delete',
    conta: 'promemoria:conta'
  },
  esporta: {
    schedaIllustrata: 'esporta:schedaIllustrata',
    anteprimaCartella: 'esporta:anteprimaCartella',
    anteprimaRelazione: 'esporta:anteprimaRelazione',
    relazione: 'esporta:relazione',
    cartella: 'esporta:cartella',
    seduta: 'esporta:seduta',
    storico: 'esporta:storico',
    certificato: 'esporta:certificato'
  },
  questionariCategorie: {
    list: 'questionariCategorie:list',
    create: 'questionariCategorie:create',
    update: 'questionariCategorie:update',
    remove: 'questionariCategorie:delete',
    reorder: 'questionariCategorie:reorder'
  },
  questionari: {
    list: 'questionari:list',
    get: 'questionari:get',
    create: 'questionari:create',
    daModello: 'questionari:daModello',
    salva: 'questionari:salva',
    daRicalcolare: 'questionari:daRicalcolare',
    ricalcolaCompilazioni: 'questionari:ricalcolaCompilazioni',
    setArchiviato: 'questionari:setArchiviato',
    remove: 'questionari:delete',
    reorder: 'questionari:reorder'
  },
  compilazioni: {
    list: 'compilazioni:list',
    risposte: 'compilazioni:risposte',
    create: 'compilazioni:create',
    update: 'compilazioni:update',
    ricalcola: 'compilazioni:ricalcola',
    remove: 'compilazioni:delete'
  },
  testCategorie: {
    list: 'testCategorie:list',
    create: 'testCategorie:create',
    update: 'testCategorie:update',
    remove: 'testCategorie:delete',
    reorder: 'testCategorie:reorder'
  },
  testValutazione: {
    list: 'testValutazione:list',
    get: 'testValutazione:get',
    create: 'testValutazione:create',
    salva: 'testValutazione:salva',
    remove: 'testValutazione:delete',
    reorder: 'testValutazione:reorder'
  },
  screening: {
    sport: 'screening:sport',
    list: 'screening:list',
    get: 'screening:get',
    create: 'screening:create',
    rinomina: 'screening:rinomina',
    salva: 'screening:salva',
    duplica: 'screening:duplica',
    remove: 'screening:delete',
    reorder: 'screening:reorder'
  },
  screeningSvolti: {
    list: 'screeningSvolti:list',
    get: 'screeningSvolti:get',
    create: 'screeningSvolti:create',
    salva: 'screeningSvolti:salva',
    collegaQuestionario: 'screeningSvolti:collegaQuestionario',
    punteggio: 'screeningSvolti:punteggio',
    anteprimaReport: 'screeningSvolti:anteprimaReport',
    report: 'screeningSvolti:report',
    remove: 'screeningSvolti:delete'
  },
  bodyChart: {
    list: 'bodyChart:list',
    get: 'bodyChart:get',
    create: 'bodyChart:create',
    salva: 'bodyChart:salva',
    remove: 'bodyChart:delete'
  },
  anamnesi: {
    get: 'anamnesi:get',
    salva: 'anamnesi:salva',
    attivita: 'anamnesi:attivita',
    salvaAttivita: 'anamnesi:salvaAttivita',
    remota: 'anamnesi:remota',
    salvaRemota: 'anamnesi:salvaRemota'
  },
  scheda: {
    apri: 'scheda:apri',
    dati: 'scheda:dati'
  },
  obiettiviTerapeutici: {
    list: 'obiettiviTerapeutici:list',
    aspettative: 'obiettiviTerapeutici:aspettative',
    salvaAspettative: 'obiettiviTerapeutici:salvaAspettative',
    create: 'obiettiviTerapeutici:create',
    update: 'obiettiviTerapeutici:update',
    remove: 'obiettiviTerapeutici:remove',
    reorder: 'obiettiviTerapeutici:reorder'
  },
  bioimmagini: {
    list: 'bioimmagini:list',
    aggiungi: 'bioimmagini:aggiungi',
    apri: 'bioimmagini:apri',
    remove: 'bioimmagini:delete'
  },
  archivio: {
    controlla: 'archivio:controlla'
  },
  backup: {
    info: 'backup:info',
    cambiaCartella: 'backup:cambiaCartella',
    usaOneDrive: 'backup:usaOneDrive',
    setAttivo: 'backup:setAttivo',
    setDaTenere: 'backup:setDaTenere',
    eseguiOra: 'backup:eseguiOra',
    apriCartella: 'backup:apriCartella',
    controlla: 'backup:controlla',
    ripristina: 'backup:ripristina',
    copiaFuori: 'backup:copiaFuori',
    esportaArchivio: 'backup:esportaArchivio'
  },
  tecniche: {
    list: 'tecniche:list',
    crea: 'tecniche:crea',
    setArchiviata: 'tecniche:setArchiviata'
  },
  impostazioni: {
    setTema: 'impostazioni:setTema',
    setScuro: 'impostazioni:setScuro',
    setScuroAutomatico: 'impostazioni:setScuroAutomatico',
    setBarraScura: 'impostazioni:setBarraScura',
    setIngrandimento: 'impostazioni:setIngrandimento',
    info: 'impostazioni:info',
    apriCartella: 'impostazioni:apriCartella',
    cambiaCartella: 'impostazioni:cambiaCartella',
    cambiaCartellaExport: 'impostazioni:cambiaCartellaExport'
  }
} as const satisfies MappaValida

interface MappaValida {
  [nome: string]: keyof Canali | { [metodo: string]: keyof Canali }
}

// Un metodo di window.api: gli argomenti del canale, e una promessa di quello
// che il canale restituisce.
export type Metodo<K extends keyof Canali> = (
  ...argomenti: Parameters<Canali[K]>
) => Promise<Awaited<ReturnType<Canali[K]>>>

type Forma<M> = {
  [N in keyof M]: M[N] extends keyof Canali ? Metodo<M[N]> : Forma<M[N]>
}

export type ApiDaCanali = Forma<typeof MAPPA_API>

// Ogni canale dell'elenco sta nella mappa: un canale dimenticato qui sarebbe
// un gestore che nessuno puo' chiamare.
type Valori<M> = { [N in keyof M]: M[N] extends string ? M[N] : Valori<M[N]> }[keyof M]
type CanaliNonUsati = Exclude<keyof Canali, Valori<typeof MAPPA_API>>
export const TUTTI_I_CANALI_NELLA_MAPPA: [CanaliNonUsati] extends [never] ? true : CanaliNonUsati = true

// L'elenco dei canali, per il controllo all'avvio (vedi ipc.ts).
export function canaliDellaMappa(mappa: MappaValida = MAPPA_API): (keyof Canali)[] {
  return Object.values(mappa).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v)))
}
