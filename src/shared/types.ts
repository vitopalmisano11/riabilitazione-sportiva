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

export interface Api {
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
}
