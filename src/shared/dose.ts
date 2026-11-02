// Il conto della dose, in un posto solo e senza React: quanti contatti di
// pliometria e quante serie di forza ci sono in una seduta, e se bastano per la
// fase. Lo usano la seduta che si compone (la riga sopra agli esercizi) e il
// processo principale (le altre sedute della settimana); le prove stanno in
// test/dose.test.ts.
//
// Le regole vengono dagli appunti di programmazione del fisioterapista:
//  - la pliometria si conta in contatti per seduta (serie × cluster ×
//    ripetizioni), e un esercizio a una gamba vale doppio: 3 × 10 per gamba
//    sono 60 contatti;
//  - la forza si conta in serie per categoria (la categoria e' il muscolo:
//    "quadricipite", "hamstring"), e per settimana: la dose della fase e' per
//    seduta, moltiplicata per le sedute a settimana del paziente e divisa sulle
//    sedute che restano;
//  - la potenza con carico si conta in serie per seduta;
//  - "8-10" vale 8, e una ripetizione a tempo (30") e' un'isometria: fuori dal
//    conto.

export type TipoLavoro = 'plio_est' | 'plio_int' | 'forza' | 'potenza'

// Quante gambe: 'scelta' = in seduta si puo' segnare monopodalico; 'una' =
// lo e' sempre (single leg hop: il nome lo dice gia').
export type Gambe = 'due' | 'scelta' | 'una'

export const TIPI_LAVORO: { tipo: TipoLavoro; nome: string; breve: string; unita: string }[] = [
  { tipo: 'plio_est', nome: 'Pliometria estensiva', breve: 'Pliometria est.', unita: 'contatti' },
  { tipo: 'plio_int', nome: 'Pliometria intensiva', breve: 'Pliometria int.', unita: 'contatti' },
  { tipo: 'potenza', nome: 'Potenza con carico', breve: 'Potenza', unita: 'serie' },
  { tipo: 'forza', nome: 'Forza', breve: 'Forza', unita: 'serie' }
]

export const tipoValido = (t: unknown): t is TipoLavoro => TIPI_LAVORO.some((x) => x.tipo === t)

// La dose di una fase, per seduta. minimo o massimo vuoti = "almeno" o "al
// massimo"; tutti e due vuoti = non si controlla.
export interface DoseFase {
  chiave: string
  minimo: number | null
  massimo: number | null
}

// Le altre sedute della settimana (non quella che si compone, non quelle al
// campo): quante sono e cosa c'e' dentro, gia' contato.
export interface DoseSettimana {
  frequenza: number | null
  altreSedute: number
  altre: Record<string, number>
}

// La categoria come serve al conto.
export interface CategoriaConto {
  id: number
  padre_id: number | null
  conta_come: TipoLavoro | null
}

// Una riga di seduta come serve al conto.
export interface RigaConto {
  categoria_id: number | null
  gambe: Gambe | null
  monopodalico?: 0 | 1 | null
  serie: string | null
  cluster: string | null
  ripetizioni: string | null
}

// Una ripetizione scritta a tempo: 30", 45'', 1', 40 sec, 2 min.
const aTempo = (t: string): boolean => /["'’”″′]|\bsec|\bmin|\d\s*s\b/i.test(t)

// Il primo numero scritto: "8-10" → 8, "10 per gamba" → 10. null se non c'e'
// un numero, o se e' un tempo.
export function primoNumero(testo: string | null | undefined): number | null {
  const t = (testo ?? '').trim()
  if (t === '' || aTempo(t)) return null
  const m = t.match(/\d+(?:[.,]\d+)?/)
  if (!m) return null
  const n = Number(m[0].replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Come si conta una categoria: la sua scelta, o quella della categoria che la
// contiene (il "Rinforzo" vale per quadricipite e hamstring).
export function tipoDiCategoria(id: number | null, categorie: CategoriaConto[]): TipoLavoro | null {
  if (id == null) return null
  const c = categorie.find((x) => x.id === id)
  if (!c) return null
  if (c.conta_come) return c.conta_come
  const padre = c.padre_id == null ? undefined : categorie.find((x) => x.id === c.padre_id)
  return padre?.conta_come ?? null
}

export const chiaveDose = (tipo: TipoLavoro, categoriaId: number): string =>
  tipo === 'forza' ? `forza:${categoriaId}` : tipo

export const unaGamba = (r: Pick<RigaConto, 'gambe' | 'monopodalico'>): boolean =>
  r.gambe === 'una' || r.monopodalico === 1

// Quanto vale una riga: contatti per la pliometria, serie per il resto.
export function quanto(r: RigaConto, tipo: TipoLavoro): number {
  if (tipo === 'plio_est' || tipo === 'plio_int') {
    const rip = primoNumero(r.ripetizioni)
    if (rip == null) return 0
    const serie = primoNumero(r.serie) ?? 1
    const cluster = primoNumero(r.cluster) ?? 1
    return serie * cluster * rip * (unaGamba(r) ? 2 : 1)
  }
  // un'isometria a tempo non e' forza da contare
  if ((r.ripetizioni ?? '').trim() !== '' && aTempo(r.ripetizioni ?? '')) return 0
  return primoNumero(r.serie) ?? 0
}

// Il conto di un elenco di righe, per chiave ('plio_est', 'forza:12'...).
export function contaRighe(righe: RigaConto[], categorie: CategoriaConto[]): Record<string, number> {
  const conto: Record<string, number> = {}
  for (const r of righe) {
    const tipo = tipoDiCategoria(r.categoria_id, categorie)
    if (!tipo || r.categoria_id == null) continue
    const k = chiaveDose(tipo, r.categoria_id)
    conto[k] = (conto[k] ?? 0) + quanto(r, tipo)
  }
  return conto
}

export interface ControlloDose {
  chiave: string
  questa: number
  // quanto ci vorrebbe in questa seduta (gia' diviso sulle sedute che
  // restano, per la forza)
  da: number | null
  a: number | null
  esito: 'ok' | 'poco' | 'troppo'
  // solo per la forza, se si sanno le sedute a settimana
  settimana: { fatte: number; da: number | null; a: number | null; restano: number } | null
}

// La seduta che si compone confrontata con la dose della fase.
export function controllaDose(dosi: DoseFase[], questa: Record<string, number>, sett: DoseSettimana): ControlloDose[] {
  return dosi
    .filter((d) => d.minimo != null || d.massimo != null)
    .map((d) => {
      const qui = questa[d.chiave] ?? 0
      let da = d.minimo
      let a = d.massimo
      let settimana: ControlloDose['settimana'] = null
      if (d.chiave.startsWith('forza:') && sett.frequenza != null && sett.frequenza > 0) {
        const fatte = sett.altre[d.chiave] ?? 0
        // questa compresa; se ne hai gia' fatte piu' del previsto, resta questa
        const restano = Math.max(sett.frequenza - sett.altreSedute, 1)
        const totDa = d.minimo == null ? null : d.minimo * sett.frequenza
        const totA = d.massimo == null ? null : d.massimo * sett.frequenza
        da = totDa == null ? null : Math.max(0, Math.ceil((totDa - fatte) / restano))
        a = totA == null ? null : Math.max(0, Math.floor((totA - fatte) / restano))
        settimana = { fatte, da: totDa, a: totA, restano }
      }
      const esito = da != null && qui < da ? 'poco' : a != null && qui > a ? 'troppo' : 'ok'
      return { chiave: d.chiave, questa: qui, da, a, esito, settimana }
    })
}

// "da 80 a 120", "almeno 3", "al massimo 40"
export function intervalloTesto(da: number | null, a: number | null): string {
  if (da != null && a != null) return da === a ? `${da}` : `da ${da} a ${a}`
  if (da != null) return `almeno ${da}`
  if (a != null) return `al massimo ${a}`
  return ''
}

// Il lunedi' e la domenica della settimana di una data (AAAA-MM-GG).
export function settimanaDi(data: string): [string, string] {
  const [y, m, g] = data.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, g))
  const lun = new Date(d)
  lun.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  const dom = new Date(lun)
  dom.setUTCDate(lun.getUTCDate() + 6)
  const iso = (x: Date): string => x.toISOString().slice(0, 10)
  return [iso(lun), iso(dom)]
}

// I numeri degli appunti, per riempire la dose di una fase con un clic. Per
// seduta; la forza vale per ogni categoria di forza (per muscolo).
export const MODELLI_DOSE: {
  nome: string
  spiega: string
  valori: Partial<Record<TipoLavoro, [number | null, number | null]>>
}[] = [
  {
    nome: 'RTP 1',
    spiega: 'Pliometria estensiva 80–120 contatti; forza almeno 3 serie per muscolo (3 × 10 al 70%).',
    valori: { plio_est: [80, 120], forza: [3, null] }
  },
  {
    nome: 'RTP 2',
    spiega:
      'Pliometria intensiva 30–40 contatti ed estensiva 80–120; forza 4–8 serie per muscolo (4 × 6–8 al 70–80%).',
    valori: { plio_int: [30, 40], plio_est: [80, 120], forza: [4, 8] }
  },
  {
    nome: 'Preparazione atletica',
    spiega:
      'Potenza con carico 3–5 serie; pliometria estensiva 80–120 contatti; forza 2–4 serie per muscolo (dose minima efficace).',
    valori: { potenza: [3, 5], plio_est: [80, 120], forza: [2, 4] }
  }
]
