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
    reorder: (ids: number[]) => invoke('obiettivi:reorder', ids),
    categorie: (obiettivoId: number) => invoke('obiettivi:categorie', obiettivoId),
    setCategoria: (obiettivoId: number, categoriaId: number, attiva: boolean) =>
      invoke('obiettivi:setCategoria', obiettivoId, categoriaId, attiva)
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
    remove: (id: number) => invoke('pazienti:delete', id)
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
  }
}

contextBridge.exposeInMainWorld('api', api)
