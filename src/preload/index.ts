import { contextBridge, ipcRenderer } from 'electron'
import type {
  Api,
  CompilazioneInput,
  EsercizioInput,
  PazienteCreateInput,
  PazienteInput,
  QuestionarioCompleto,
  SedutaInput,
  TestValutazioneCompleto
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
  patologie: {
    list: () => invoke('patologie:list'),
    create: (nome: string) => invoke('patologie:create', nome),
    update: (id: number, nome: string) => invoke('patologie:update', id, nome),
    remove: (id: number) => invoke('patologie:delete', id)
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
  questionari: {
    list: (includiArchiviati: boolean) => invoke('questionari:list', includiArchiviati),
    get: (id: number) => invoke('questionari:get', id),
    create: (nome: string) => invoke('questionari:create', nome),
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
  testValutazione: {
    list: (includiArchiviati: boolean) => invoke('testValutazione:list', includiArchiviati),
    get: (id: number) => invoke('testValutazione:get', id),
    create: (nome: string) => invoke('testValutazione:create', nome),
    salva: (dati: TestValutazioneCompleto) => invoke('testValutazione:salva', dati),
    remove: (id: number) => invoke('testValutazione:delete', id),
    reorder: (ids: number[]) => invoke('testValutazione:reorder', ids)
  },
  impostazioni: {
    info: () => invoke('impostazioni:info'),
    apriCartella: () => invoke('impostazioni:apriCartella'),
    cambiaCartella: () => invoke('impostazioni:cambiaCartella'),
    cambiaCartellaExport: () => invoke('impostazioni:cambiaCartellaExport')
  }
}

contextBridge.exposeInMainWorld('api', api)
