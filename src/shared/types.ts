export interface Patologia {
  id: number
  nome: string
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
}

export interface Esercizio {
  id: number
  nome: string
  categoria_id: number
  serie_default: string | null
  ripetizioni_default: string | null
  carico_default: string | null
  nota_tecnica: string | null
  archiviato: 0 | 1
}

export type EsercizioConCategoria = Esercizio & { categoria_nome: string }

export interface EsercizioInput {
  nome: string
  categoria_id: number
  serie_default: string | null
  ripetizioni_default: string | null
  carico_default: string | null
  nota_tecnica: string | null
}

export interface Paziente {
  id: number
  nome: string
  cognome: string
  tipo_intervento: string | null
  data_intervento: string | null
  patologia_id: number | null
  fase_corrente_id: number | null
}

export type PazienteDettaglio = Paziente & {
  patologia_nome: string | null
  fase_nome: string | null
}

export interface PazienteInput {
  nome: string
  cognome: string
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
  nota: string | null
}

export interface SedutaInput {
  paziente_id: number
  data: string
  fase_id: number | null
  note: string | null
  obiettivi: number[]
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

export type SedutaEsercizioDettaglio = SedutaEsercizioInput & {
  nome: string
  categoria_nome: string
}

export interface SedutaDettaglio {
  id: number
  paziente_id: number
  data: string
  fase_id: number | null
  fase_nome: string | null
  note: string | null
  obiettivi: number[]
  esercizi: SedutaEsercizioDettaglio[]
}

export interface Api {
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
    categorie(obiettivoId: number): Promise<number[]>
    setCategoria(obiettivoId: number, categoriaId: number, attiva: boolean): Promise<void>
  }
  categorie: {
    list(): Promise<Categoria[]>
    create(nome: string): Promise<number>
    update(id: number, nome: string): Promise<void>
    remove(id: number): Promise<void>
  }
  esercizi: {
    list(includiArchiviati: boolean): Promise<EsercizioConCategoria[]>
    create(data: EsercizioInput): Promise<number>
    update(id: number, data: EsercizioInput): Promise<void>
    setArchiviato(id: number, archiviato: boolean): Promise<void>
    remove(id: number): Promise<void>
  }
  pazienti: {
    list(): Promise<PazienteDettaglio[]>
    create(data: PazienteCreateInput): Promise<number>
    update(id: number, data: PazienteInput): Promise<void>
    setPatologiaFase(id: number, patologiaId: number | null, faseId: number | null): Promise<void>
    remove(id: number): Promise<void>
  }
  sedute: {
    list(pazienteId: number): Promise<SedutaRiepilogo[]>
    get(id: number): Promise<SedutaDettaglio>
    create(data: SedutaInput): Promise<number>
    update(id: number, data: SedutaInput): Promise<void>
    remove(id: number): Promise<void>
  }
  esporta: {
    // Ritornano il percorso del file salvato, o null se l'utente annulla.
    seduta(sedutaId: number, formato: 'pdf' | 'docx'): Promise<string | null>
    storico(
      pazienteId: number,
      dal: string,
      al: string,
      formato: 'pdf' | 'docx'
    ): Promise<string | null>
  }
  impostazioni: {
    info(): Promise<{ cartella: string }>
    apriCartella(): Promise<void>
    // Ritorna il nuovo percorso, o null se l'utente annulla.
    cambiaCartella(): Promise<string | null>
  }
}
