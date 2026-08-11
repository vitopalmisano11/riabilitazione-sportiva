import { contextBridge, ipcRenderer } from 'electron'
import type {
  Api,
  EsercizioInput,
  PazienteCreateInput,
  PazienteInput,
  SedutaInput
} from '../shared/types'

const invoke = (channel: string, ...args: unknown[]): Promise<never> =>
  ipcRenderer.invoke(channel, ...args) as Promise<never>

const api: Api = {
  apriLink: (url: string) => invoke('apriLink', url),
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
    remove: (id: number) => invoke('categorie:delete', id)
  },
  esercizi: {
    list: (includiArchiviati: boolean) => invoke('esercizi:list', includiArchiviati),
    create: (data: EsercizioInput) => invoke('esercizi:create', data),
    update: (id: number, data: EsercizioInput) => invoke('esercizi:update', id, data),
    setArchiviato: (id: number, archiviato: boolean) => invoke('esercizi:setArchiviato', id, archiviato),
    remove: (id: number) => invoke('esercizi:delete', id)
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
    seduta: (sedutaId: number, formato: 'pdf' | 'docx') =>
      invoke('esporta:seduta', sedutaId, formato),
    storico: (pazienteId: number, dal: string, al: string, formato: 'pdf' | 'docx') =>
      invoke('esporta:storico', pazienteId, dal, al, formato)
  },
  impostazioni: {
    info: () => invoke('impostazioni:info'),
    apriCartella: () => invoke('impostazioni:apriCartella'),
    cambiaCartella: () => invoke('impostazioni:cambiaCartella'),
    cambiaCartellaExport: () => invoke('impostazioni:cambiaCartellaExport')
  }
}

contextBridge.exposeInMainWorld('api', api)
