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

export type EsercizioConCategoria = Esercizio & { categoria_nome: string }

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

export interface Api {
  // apre un URL http/https nel browser predefinito
  apriLink(url: string): Promise<void>
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
    info(): Promise<{ cartella: string; cartellaExport: string }>
    apriCartella(): Promise<void>
    // Ritornano il nuovo percorso, o null se l'utente annulla.
    cambiaCartella(): Promise<string | null>
    cambiaCartellaExport(): Promise<string | null>
  }
}
