import { contextBridge, ipcRenderer } from 'electron'
import type {
  AnamnesiProssima,
  AnamnesiRemota,
  AttivitaPartecipazione,
  Api,
  BodyChartCompleta,
  CompilazioneInput,
  EsercizioInput,
  PazienteCreateInput,
  PazienteInput,
  DistrettoCompleto,
  QuestionarioCompleto,
  SedutaInput,
  TestValutazioneCompleto,
  ValutazioneCompleta
} from '../shared/types'

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
  valutazioni: {
    list: (pazienteId: number) => invoke('valutazioni:list', pazienteId),
    get: (id: number) => invoke('valutazioni:get', id),
    create: (pazienteId: number, data: string, distrettoIds: number[]) =>
      invoke('valutazioni:create', pazienteId, data, distrettoIds),
    salva: (dati: ValutazioneCompleta) => invoke('valutazioni:salva', dati),
    remove: (id: number) => invoke('valutazioni:delete', id)
  },
  patologie: {
    list: () => invoke('patologie:list'),
    create: (nome: string) => invoke('patologie:create', nome),
    update: (id: number, nome: string) => invoke('patologie:update', id, nome),
    remove: (id: number) => invoke('patologie:delete', id),
    reorder: (ids: number[]) => invoke('patologie:reorder', ids),
    distretti: (patologiaId: number) => invoke('patologie:distretti', patologiaId),
    setDistretti: (patologiaId: number, ids: number[]) =>
      invoke('patologie:setDistretti', patologiaId, ids)
  },
  fasi: {
    list: (patologiaId: number) => invoke('fasi:list', patologiaId),
    create: (patologiaId: number, nome: string) => invoke('fasi:create', patologiaId, nome),
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
    get: (id: number) => invoke('sedute:get', id),
    create: (data: SedutaInput) => invoke('sedute:create', data),
    update: (id: number, data: SedutaInput) => invoke('sedute:update', id, data),
    remove: (id: number) => invoke('sedute:delete', id)
  },
  esporta: {
    anteprima: (sedutaId: number) => invoke('esporta:anteprima', sedutaId),
    seduta: (sedutaId: number, formato: 'pdf' | 'docx') =>
      invoke('esporta:seduta', sedutaId, formato),
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
  bodyChart: {
    list: (pazienteId: number) => invoke('bodyChart:list', pazienteId),
    get: (id: number) => invoke('bodyChart:get', id),
    create: (pazienteId: number, data: string) => invoke('bodyChart:create', pazienteId, data),
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
  bioimmagini: {
    list: (pazienteId: number) => invoke('bioimmagini:list', pazienteId),
    aggiungi: (pazienteId: number) => invoke('bioimmagini:aggiungi', pazienteId),
    apri: (id: number) => invoke('bioimmagini:apri', id),
    remove: (id: number) => invoke('bioimmagini:delete', id)
  },
  impostazioni: {
    info: () => invoke('impostazioni:info'),
    apriCartella: () => invoke('impostazioni:apriCartella'),
    cambiaCartella: () => invoke('impostazioni:cambiaCartella'),
    cambiaCartellaExport: () => invoke('impostazioni:cambiaCartellaExport')
  }
}

contextBridge.exposeInMainWorld('api', api)
