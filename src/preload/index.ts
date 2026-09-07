import { contextBridge, ipcRenderer } from 'electron'
import type { Tema } from '../shared/temi'
import type {
  TipoChart,
  AnamnesiProssima,
  AnamnesiRemota,
  AttivitaPartecipazione,
  Api,
  BodyChartCompleta,
  CompilazioneInput,
  EsercizioInput,
  PazienteCreateInput,
  PazienteInput,
  Profilo,
  DistrettoCompleto,
  QuestionarioCompleto,
  SedutaInput,
  ProtocolloScreeningCompleto,
  ValoreScreening,
  SezioneCartella,
  StatoPaziente,
  TermineObiettivo,
  TestValutazioneCompleto,
  ValutazioneCompleta
} from '../shared/types'

// Il tema scelto si applica prima che la pagina compaia: e' l'unica cosa chiesta
// in modo immediato, perche' leggerlo dopo vorrebbe dire vedere un lampo dei
// colori di partenza ogni volta che si apre il programma.
//
// Il ponte non e' compilato con i tipi del browser (qui gira codice di sistema),
// percio' della pagina si dichiara solo il poco che serve.
interface PaginaMinima {
  readyState: string
  documentElement: { dataset: Record<string, string> }
  addEventListener(tipo: string, ascoltatore: () => void): void
}

try {
  const salvato = ipcRenderer.sendSync('impostazioni:temaSubito') as {
    tema: string
    scuro: boolean
    barraScura: boolean
  }
  const pagina = (globalThis as { document?: PaginaMinima }).document
  const applica = (): void => {
    if (!pagina) return
    pagina.documentElement.dataset.tema = salvato.tema
    pagina.documentElement.dataset.barra = salvato.barraScura ? 'scura' : 'chiara'
    if (salvato.scuro) pagina.documentElement.dataset.scuro = 'si'
  }
  if (pagina?.readyState === 'loading') pagina.addEventListener('DOMContentLoaded', applica)
  else applica()
} catch {
  // senza risposta resta il tema di partenza: non e' un motivo per non aprire
}

const invoke = (channel: string, ...args: unknown[]): Promise<never> =>
  ipcRenderer.invoke(channel, ...args) as Promise<never>

const api: Api = {
  apriLink: (url: string) => invoke('apriLink', url),
  scegliImmagine: () => invoke('scegliImmagine'),
  auth: {
    status: () => invoke('auth:status'),
    setup: (password: string) => invoke('auth:setup', password),
    login: (password: string) => invoke('auth:login', password),
    recover: (recoveryKey: string, nuovaPassword: string) =>
      invoke('auth:recover', recoveryKey, nuovaPassword),
    cambiaPassword: (vecchia: string, nuova: string) =>
      invoke('auth:cambiaPassword', vecchia, nuova)
  },
  distretti: {
    list: () => invoke('distretti:list'),
    get: (id: number) => invoke('distretti:get', id),
    create: (nome: string) => invoke('distretti:create', nome),
    salva: (dati: DistrettoCompleto) => invoke('distretti:salva', dati),
    remove: (id: number) => invoke('distretti:delete', id),
    reorder: (ids: number[]) => invoke('distretti:reorder', ids)
  },
  sicurezza: {
    blocco: () => invoke('sicurezza:blocco'),
    setBlocco: (b: { attivo: boolean; minuti: number }) => invoke('sicurezza:setBlocco', b),
    verificaPassword: (password: string) => invoke('sicurezza:verificaPassword', password)
  },
  indicazioni: {
    list: () => invoke('indicazioni:list'),
    create: (testo: string) => invoke('indicazioni:create', testo),
    rinomina: (id: number, testo: string) => invoke('indicazioni:rinomina', id, testo),
    remove: (id: number) => invoke('indicazioni:delete', id),
    delPaziente: (pazienteId: number) => invoke('indicazioni:delPaziente', pazienteId),
    setDelPaziente: (pazienteId: number, ids: number[], frequenza: string | null) =>
      invoke('indicazioni:setDelPaziente', pazienteId, ids, frequenza)
  },
  massimali: {
    list: (pazienteId: number) => invoke('massimali:list', pazienteId),
    create: (
      pazienteId: number,
      esercizio: string,
      valore: number,
      unita: string | null,
      data: string
    ) => invoke('massimali:create', pazienteId, esercizio, valore, unita, data),
    remove: (id: number) => invoke('massimali:delete', id),
    setMisure: (pazienteId: number, peso: number | null, altezza: number | null) =>
      invoke('massimali:setMisure', pazienteId, peso, altezza)
  },
  segni: {
    list: (pazienteId: number) => invoke('segni:list', pazienteId),
    andamento: (pazienteId: number) => invoke('segni:andamento', pazienteId),
    create: (pazienteId: number, nome: string, unita: string | null) =>
      invoke('segni:create', pazienteId, nome, unita),
    rinomina: (id: number, nome: string, unita: string | null) =>
      invoke('segni:rinomina', id, nome, unita),
    remove: (id: number) => invoke('segni:delete', id),
    dellaSeduta: (sedutaId: number) => invoke('segni:dellaSeduta', sedutaId)
  },
  profilo: {
    leggi: () => invoke('profilo:leggi'),
    salva: (p: Profilo) => invoke('profilo:salva', p)
  },
  registro: {
    ultimi: () => invoke('registro:ultimi'),
    apri: () => invoke('registro:apri')
  },
  cestino: {
    list: () => invoke('cestino:list'),
    ripristina: (id: number) => invoke('cestino:ripristina', id),
    svuota: (id?: number) => invoke('cestino:svuota', id)
  },
  bozze: {
    leggi: (pazienteId: number) => invoke('bozze:leggi', pazienteId),
    salva: (pazienteId: number, contenuto: string) =>
      invoke('bozze:salva', pazienteId, contenuto),
    elimina: (pazienteId: number) => invoke('bozze:elimina', pazienteId)
  },
  valutazioni: {
    list: (pazienteId: number) => invoke('valutazioni:list', pazienteId),
    get: (id: number) => invoke('valutazioni:get', id),
    create: (pazienteId: number, data: string, distrettoIds: number[]) =>
      invoke('valutazioni:create', pazienteId, data, distrettoIds),
    duplica: (id: number, data: string) => invoke('valutazioni:duplica', id, data),
    salva: (dati: ValutazioneCompleta) => invoke('valutazioni:salva', dati),
    remove: (id: number) => invoke('valutazioni:delete', id)
  },
  patologie: {
    list: () => invoke('patologie:list'),
    create: (nome: string) => invoke('patologie:create', nome),
    update: (id: number, nome: string) => invoke('patologie:update', id, nome),
    setCampo: (id: number, attivo: boolean) => invoke('patologie:setCampo', id, attivo),
    remove: (id: number) => invoke('patologie:delete', id),
    reorder: (ids: number[]) => invoke('patologie:reorder', ids),
    distretti: (patologiaId: number) => invoke('patologie:distretti', patologiaId),
    setDistretti: (patologiaId: number, ids: number[]) =>
      invoke('patologie:setDistretti', patologiaId, ids)
  },
  fasi: {
    list: (patologiaId: number) => invoke('fasi:list', patologiaId),
    create: (patologiaId: number, nome: string, campo?: boolean) =>
      invoke('fasi:create', patologiaId, nome, campo === true),
    update: (id: number, nome: string) => invoke('fasi:update', id, nome),
    remove: (id: number) => invoke('fasi:delete', id),
    reorder: (ids: number[]) => invoke('fasi:reorder', ids)
  },
  obiettivi: {
    list: (faseId: number) => invoke('obiettivi:list', faseId),
    create: (faseId: number, nome: string) => invoke('obiettivi:create', faseId, nome),
    update: (id: number, nome: string) => invoke('obiettivi:update', id, nome),
    remove: (id: number) => invoke('obiettivi:delete', id),
    reorder: (ids: number[]) => invoke('obiettivi:reorder', ids)
  },
  sezioni: {
    list: (faseId: number) => invoke('sezioni:list', faseId),
    create: (faseId: number, nome: string) => invoke('sezioni:create', faseId, nome),
    update: (id: number, nome: string) => invoke('sezioni:update', id, nome),
    remove: (id: number) => invoke('sezioni:delete', id),
    reorder: (ids: number[]) => invoke('sezioni:reorder', ids),
    setCategorie: (sezioneId: number, categoriaIds: number[]) =>
      invoke('sezioni:setCategorie', sezioneId, categoriaIds)
  },
  testAvanzamento: {
    list: (faseId: number) => invoke('testAvanzamento:list', faseId),
    create: (faseId: number, nome: string) => invoke('testAvanzamento:create', faseId, nome),
    update: (id: number, nome: string) => invoke('testAvanzamento:update', id, nome),
    remove: (id: number) => invoke('testAvanzamento:delete', id),
    reorder: (ids: number[]) => invoke('testAvanzamento:reorder', ids)
  },
  categorie: {
    list: () => invoke('categorie:list'),
    create: (nome: string) => invoke('categorie:create', nome),
    update: (id: number, nome: string) => invoke('categorie:update', id, nome),
    setCluster: (id: number, attivo: boolean) => invoke('categorie:setCluster', id, attivo),
    remove: (id: number) => invoke('categorie:delete', id),
    reorder: (ids: number[]) => invoke('categorie:reorder', ids)
  },
  esercizi: {
    list: (includiArchiviati: boolean) => invoke('esercizi:list', includiArchiviati),
    create: (data: EsercizioInput) => invoke('esercizi:create', data),
    update: (id: number, data: EsercizioInput) => invoke('esercizi:update', id, data),
    setArchiviato: (id: number, archiviato: boolean) => invoke('esercizi:setArchiviato', id, archiviato),
    remove: (id: number) => invoke('esercizi:delete', id),
    immagine: (id: number) => invoke('esercizi:immagine', id),
    setImmagine: (id: number, dataUrl: string | null) =>
      invoke('esercizi:setImmagine', id, dataUrl)
  },
  pazienti: {
    list: () => invoke('pazienti:list'),
    create: (data: PazienteCreateInput) => invoke('pazienti:create', data),
    update: (id: number, data: PazienteInput) => invoke('pazienti:update', id, data),
    setPatologiaFase: (id: number, patologiaId: number | null, faseId: number | null) =>
      invoke('pazienti:setPatologiaFase', id, patologiaId, faseId),
    remove: (id: number) => invoke('pazienti:delete', id),
    obiettiviRaggiunti: (pazienteId: number) => invoke('pazienti:obiettiviRaggiunti', pazienteId),
    setObiettivoRaggiunto: (pazienteId: number, obiettivoId: number, raggiunto: boolean) =>
      invoke('pazienti:setObiettivoRaggiunto', pazienteId, obiettivoId, raggiunto),
    testValori: (pazienteId: number, faseId: number) =>
      invoke('pazienti:testValori', pazienteId, faseId),
    setTestValore: (pazienteId: number, testId: number, eseguito: boolean, valore: string | null) =>
      invoke('pazienti:setTestValore', pazienteId, testId, eseguito, valore)
  },
  sedute: {
    list: (pazienteId: number) => invoke('sedute:list', pazienteId),
    settimana: (dal: string, al: string) => invoke('sedute:settimana', dal, al),
    focusUsati: () => invoke('sedute:focusUsati'),
    ultimaVolta: (pazienteId: number, escludi: number | null) =>
      invoke('sedute:ultimaVolta', pazienteId, escludi),
    get: (id: number) => invoke('sedute:get', id),
    create: (data: SedutaInput) => invoke('sedute:create', data),
    update: (id: number, data: SedutaInput) => invoke('sedute:update', id, data),
    programma: (origineId: number, date: string[]) =>
      invoke('sedute:programma', origineId, date),
    remove: (id: number) => invoke('sedute:delete', id)
  },
  followUp: {
    list: () => invoke('followUp:list'),
    setStato: (id: number, stato: StatoPaziente, followUpIl: string | null) =>
      invoke('followUp:setStato', id, stato, followUpIl),
    setFollowUp: (id: number, followUpIl: string | null) =>
      invoke('followUp:setFollowUp', id, followUpIl),
    segnaContattato: (id: number, contattato: boolean) =>
      invoke('followUp:segnaContattato', id, contattato),
    setRecensione: (id: number, recensione: boolean) =>
      invoke('followUp:setRecensione', id, recensione)
  },
  esporta: {
    schedaIllustrata: (sedutaId: number) => invoke('esporta:schedaIllustrata', sedutaId),
    anteprimaCartella: (pazienteId: number, sezioni: SezioneCartella[]) =>
      invoke('esporta:anteprimaCartella', pazienteId, sezioni),
    cartella: (pazienteId: number, sezioni: SezioneCartella[]) =>
      invoke('esporta:cartella', pazienteId, sezioni),
    seduta: (sedutaId: number, formato: 'pdf' | 'docx', illustrata?: boolean) =>
      invoke('esporta:seduta', sedutaId, formato, illustrata),
    storico: (pazienteId: number, dal: string, al: string, formato: 'pdf' | 'docx') =>
      invoke('esporta:storico', pazienteId, dal, al, formato)
  },
  questionariCategorie: {
    list: () => invoke('questionariCategorie:list'),
    create: (nome: string) => invoke('questionariCategorie:create', nome),
    update: (id: number, nome: string) => invoke('questionariCategorie:update', id, nome),
    remove: (id: number) => invoke('questionariCategorie:delete', id),
    reorder: (ids: number[]) => invoke('questionariCategorie:reorder', ids)
  },
  questionari: {
    list: (includiArchiviati: boolean) => invoke('questionari:list', includiArchiviati),
    get: (id: number) => invoke('questionari:get', id),
    create: (nome: string, categoriaId: number) =>
      invoke('questionari:create', nome, categoriaId),
    salva: (dati: QuestionarioCompleto) => invoke('questionari:salva', dati),
    setArchiviato: (id: number, archiviato: boolean) =>
      invoke('questionari:setArchiviato', id, archiviato),
    remove: (id: number) => invoke('questionari:delete', id),
    reorder: (ids: number[]) => invoke('questionari:reorder', ids)
  },
  compilazioni: {
    list: (pazienteId: number) => invoke('compilazioni:list', pazienteId),
    risposte: (compilazioneId: number) => invoke('compilazioni:risposte', compilazioneId),
    create: (dati: CompilazioneInput) => invoke('compilazioni:create', dati),
    update: (id: number, dati: CompilazioneInput) => invoke('compilazioni:update', id, dati),
    remove: (id: number) => invoke('compilazioni:delete', id)
  },
  testCategorie: {
    list: () => invoke('testCategorie:list'),
    create: (nome: string) => invoke('testCategorie:create', nome),
    update: (id: number, nome: string) => invoke('testCategorie:update', id, nome),
    remove: (id: number) => invoke('testCategorie:delete', id),
    reorder: (ids: number[]) => invoke('testCategorie:reorder', ids)
  },
  testValutazione: {
    list: (includiArchiviati: boolean) => invoke('testValutazione:list', includiArchiviati),
    get: (id: number) => invoke('testValutazione:get', id),
    create: (nome: string, categoriaId: number) =>
      invoke('testValutazione:create', nome, categoriaId),
    salva: (dati: TestValutazioneCompleto) => invoke('testValutazione:salva', dati),
    remove: (id: number) => invoke('testValutazione:delete', id),
    reorder: (ids: number[]) => invoke('testValutazione:reorder', ids)
  },
  screening: {
    sport: () => invoke('screening:sport'),
    list: (sport: string | null) => invoke('screening:list', sport),
    get: (id: number) => invoke('screening:get', id),
    create: (nome: string, sport: string) => invoke('screening:create', nome, sport),
    rinomina: (id: number, nome: string) => invoke('screening:rinomina', id, nome),
    salva: (dati: ProtocolloScreeningCompleto) => invoke('screening:salva', dati),
    duplica: (id: number, nome: string) => invoke('screening:duplica', id, nome),
    remove: (id: number) => invoke('screening:delete', id),
    reorder: (ids: number[]) => invoke('screening:reorder', ids)
  },
  screeningSvolti: {
    list: (pazienteId: number | null) => invoke('screeningSvolti:list', pazienteId),
    get: (id: number) => invoke('screeningSvolti:get', id),
    create: (pazienteId: number, protocolloId: number, data: string) =>
      invoke('screeningSvolti:create', pazienteId, protocolloId, data),
    salva: (id: number, data: string, note: string | null, valori: ValoreScreening[]) =>
      invoke('screeningSvolti:salva', id, data, note, valori),
    collegaQuestionario: (id: number, questionarioId: number, compilazioneId: number) =>
      invoke('screeningSvolti:collegaQuestionario', id, questionarioId, compilazioneId),
    anteprimaReport: (ids: number[]) => invoke('screeningSvolti:anteprimaReport', ids),
    report: (ids: number[]) => invoke('screeningSvolti:report', ids),
    remove: (id: number) => invoke('screeningSvolti:delete', id)
  },
  bodyChart: {
    list: (pazienteId: number) => invoke('bodyChart:list', pazienteId),
    get: (id: number) => invoke('bodyChart:get', id),
    create: (pazienteId: number, data: string, tipo: TipoChart) =>
      invoke('bodyChart:create', pazienteId, data, tipo),
    salva: (dati: BodyChartCompleta) => invoke('bodyChart:salva', dati),
    remove: (id: number) => invoke('bodyChart:delete', id)
  },
  anamnesi: {
    get: (pazienteId: number) => invoke('anamnesi:get', pazienteId),
    salva: (pazienteId: number, dati: AnamnesiProssima) =>
      invoke('anamnesi:salva', pazienteId, dati),
    attivita: (pazienteId: number) => invoke('anamnesi:attivita', pazienteId),
    salvaAttivita: (pazienteId: number, dati: AttivitaPartecipazione) =>
      invoke('anamnesi:salvaAttivita', pazienteId, dati),
    remota: (pazienteId: number) => invoke('anamnesi:remota', pazienteId),
    salvaRemota: (pazienteId: number, dati: AnamnesiRemota) =>
      invoke('anamnesi:salvaRemota', pazienteId, dati)
  },
  scheda: {
    apri: (sedutaId: number) => invoke('scheda:apri', sedutaId),
    dati: (sedutaId: number) => invoke('scheda:dati', sedutaId)
  },
  obiettiviTerapeutici: {
    list: (pazienteId: number) => invoke('obiettiviTerapeutici:list', pazienteId),
    aspettative: (pazienteId: number) =>
      invoke('obiettiviTerapeutici:aspettative', pazienteId),
    salvaAspettative: (pazienteId: number, testo: string | null) =>
      invoke('obiettiviTerapeutici:salvaAspettative', pazienteId, testo),
    create: (pazienteId: number, testo: string, termine: TermineObiettivo) =>
      invoke('obiettiviTerapeutici:create', pazienteId, testo, termine),
    update: (id: number, testo: string, termine: TermineObiettivo) =>
      invoke('obiettiviTerapeutici:update', id, testo, termine),
    remove: (id: number) => invoke('obiettiviTerapeutici:remove', id),
    reorder: (ids: number[]) => invoke('obiettiviTerapeutici:reorder', ids)
  },
  bioimmagini: {
    list: (pazienteId: number) => invoke('bioimmagini:list', pazienteId),
    aggiungi: (pazienteId: number) => invoke('bioimmagini:aggiungi', pazienteId),
    apri: (id: number) => invoke('bioimmagini:apri', id),
    remove: (id: number) => invoke('bioimmagini:delete', id)
  },
  archivio: {
    controlla: () => invoke('archivio:controlla')
  },
  backup: {
    info: () => invoke('backup:info'),
    cambiaCartella: () => invoke('backup:cambiaCartella'),
    usaOneDrive: () => invoke('backup:usaOneDrive'),
    setAttivo: (attivo: boolean) => invoke('backup:setAttivo', attivo),
    setDaTenere: (n: number) => invoke('backup:setDaTenere', n),
    eseguiOra: () => invoke('backup:eseguiOra'),
    apriCartella: () => invoke('backup:apriCartella'),
    controlla: (nome: string) => invoke('backup:controlla', nome),
    ripristina: (nome: string) => invoke('backup:ripristina', nome),
    copiaFuori: () => invoke('backup:copiaFuori'),
    esportaArchivio: () => invoke('backup:esportaArchivio')
  },
  impostazioni: {
    setTema: (t: Tema) => invoke('impostazioni:setTema', t),
    setScuro: (valore: boolean) => invoke('impostazioni:setScuro', valore),
    setBarraScura: (valore: boolean) => invoke('impostazioni:setBarraScura', valore),
    setIngrandimento: (valore: number) => invoke('impostazioni:setIngrandimento', valore),
    info: () => invoke('impostazioni:info'),
    apriCartella: () => invoke('impostazioni:apriCartella'),
    cambiaCartella: () => invoke('impostazioni:cambiaCartella'),
    cambiaCartellaExport: () => invoke('impostazioni:cambiaCartellaExport')
  }
}

contextBridge.exposeInMainWorld('api', api)
