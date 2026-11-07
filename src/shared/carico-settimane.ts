// Il carico settimana per settimana, confrontato con la dose della fase: per la
// linguetta Percorso del paziente. Come la dose serve SOLO a programmare e non
// finisce in nessun documento. Il conto delle righe e' lo stesso della seduta
// (contaRighe in shared/dose.ts); qui si sommano le sedute di ogni settimana.
// Le prove stanno in test/carico-settimane.test.ts.
//
// Quanto ci vorrebbe in una settimana:
//  - pliometria e potenza: la dose e' per seduta, quindi si moltiplica per le
//    sedute fatte quella settimana (due sedute invece di tre non sono "poco":
//    conta se ogni seduta aveva la sua dose);
//  - forza: la dose e' per seduta ma si ragiona sulla settimana (shared/dose.ts),
//    quindi si moltiplica per le sedute a settimana del paziente, o per quelle
//    fatte se non sono scritte.
// La fase della settimana e' quella dell'ultima seduta che ne ha una. Le sedute
// al campo non contano nel carico, ma dolore e sforzo si' (sono del paziente).
import {
  contaRighe,
  settimanaDi,
  type CategoriaConto,
  type DoseFase,
  type RigaConto
} from './dose'

export interface SedutaCarico {
  data: string
  fase_id: number | null
  fase_nome: string | null
  campo: 0 | 1
  dolore: number | null
  sforzo: number | null
  righe: RigaConto[]
}

export type EsitoCarico = 'ok' | 'poco' | 'troppo'

export interface VoceSettimana {
  fatto: number
  // quanto ci vorrebbe in questa settimana; tutti e due null = la fase non lo dice
  da: number | null
  a: number | null
  // null = non si giudica (niente dose, o "poco" in una settimana non finita)
  esito: EsitoCarico | null
}

export interface SettimanaCarico {
  lunedi: string
  domenica: string
  // la settimana di oggi: "poco" non si dice, puo' ancora arrivare
  inCorso: boolean
  sedute: number
  seduteCampo: number
  fase: string | null
  voci: Record<string, VoceSettimana>
  dolore: number | null
  sforzo: number | null
}

export interface AvvisoCarico {
  chiave: string
  // dalla piu' vecchia alla piu' recente, tre settimane
  valori: [number, number, number]
  dolori: [number, number, number]
}

export interface CaricoPaziente {
  // dalla piu' recente alla piu' vecchia, comprese quelle vuote in mezzo
  settimane: SettimanaCarico[]
  // le voci che hanno una dose in qualche fase o qualcosa di contato
  chiavi: string[]
  // il nome da mostrare per ogni chiave della forza (la categoria)
  nomi: Record<string, string>
  frequenza: number | null
  avviso: AvvisoCarico | null
}

const unDecimale = (n: number): number => Math.round(n * 10) / 10

const media = (valori: (number | null)[]): number | null => {
  const v = valori.filter((x): x is number => x != null)
  return v.length === 0 ? null : unDecimale(v.reduce((s, x) => s + x, 0) / v.length)
}

function piuGiorni(iso: string, giorni: number): string {
  const [y, m, g] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, g + giorni))
  return d.toISOString().slice(0, 10)
}

export function esitoCarico(fatto: number, da: number | null, a: number | null, inCorso: boolean): EsitoCarico | null {
  if (da == null && a == null) return null
  if (a != null && fatto > a) return 'troppo'
  if (da != null && fatto < da) return inCorso ? null : 'poco'
  return 'ok'
}

export function caricoSettimane(input: {
  sedute: SedutaCarico[]
  dosi: Record<number, DoseFase[]>
  categorie: CategoriaConto[]
  frequenza: number | null
  oggi: string
}): Omit<CaricoPaziente, 'nomi' | 'frequenza'> {
  const { dosi, categorie, frequenza, oggi } = input
  const sedute = input.sedute.filter((s) => s.data <= oggi).sort((a, b) => a.data.localeCompare(b.data))
  if (sedute.length === 0) return { settimane: [], chiavi: [], avviso: null }

  const perSettimana = new Map<string, SedutaCarico[]>()
  for (const s of sedute) {
    const [lun] = settimanaDi(s.data)
    perSettimana.set(lun, [...(perSettimana.get(lun) ?? []), s])
  }

  // le chiavi: quelle con una dose nelle fasi usate, e quelle con qualcosa di contato
  const chiavi = new Set<string>()
  for (const id of new Set(sedute.map((s) => s.fase_id).filter((x): x is number => x != null))) {
    for (const d of dosi[id] ?? []) if (d.minimo != null || d.massimo != null) chiavi.add(d.chiave)
  }

  const settimane: SettimanaCarico[] = []
  const [primo] = settimanaDi(sedute[0].data)
  const [ultimo] = settimanaDi(sedute[sedute.length - 1].data)
  for (let lun = primo; lun <= ultimo; lun = piuGiorni(lun, 7)) {
    const tutte = perSettimana.get(lun) ?? []
    const contate = tutte.filter((s) => s.campo === 0)
    const conto = contaRighe(
      contate.flatMap((s) => s.righe),
      categorie
    )
    for (const [k, v] of Object.entries(conto)) if (v > 0) chiavi.add(k)

    const conFase = [...contate].reverse().find((s) => s.fase_id != null)
    const domenica = piuGiorni(lun, 6)
    const inCorso = domenica >= oggi
    const dose = conFase?.fase_id != null ? (dosi[conFase.fase_id] ?? []) : []
    const voci: Record<string, VoceSettimana> = {}
    for (const k of new Set([...Object.keys(conto), ...dose.map((d) => d.chiave)])) {
      const d = dose.find((x) => x.chiave === k)
      const volte = k.startsWith('forza:') ? (frequenza ?? contate.length) : contate.length
      const da = d?.minimo != null ? d.minimo * volte : null
      const a = d?.massimo != null ? d.massimo * volte : null
      const fatto = conto[k] ?? 0
      voci[k] = { fatto, da, a, esito: contate.length === 0 ? null : esitoCarico(fatto, da, a, inCorso) }
    }

    settimane.push({
      lunedi: lun,
      domenica,
      inCorso,
      sedute: contate.length,
      seduteCampo: tutte.length - contate.length,
      fase: conFase?.fase_nome ?? null,
      voci,
      dolore: media(tutte.map((s) => s.dolore)),
      sforzo: media(tutte.map((s) => s.sforzo))
    })
  }
  settimane.reverse()

  const elenco = [...chiavi]
  return { settimane, chiavi: elenco, avviso: avvisoCarico(settimane, elenco) }
}

// Un avviso solo, e solo se succede: nelle ultime tre settimane (di fila, tutte
// con sedute) il dolore medio e' salito ogni settimana, di almeno un punto in
// tutto, mentre una voce del carico cresceva. Se le voci che crescono sono
// piu' d'una si dice quella cresciuta di piu', in proporzione.
export function avvisoCarico(settimane: SettimanaCarico[], chiavi: string[]): AvvisoCarico | null {
  if (settimane.length < 3) return null
  const [w2, w1, w0] = settimane // w2 la piu' recente
  if ([w0, w1, w2].some((w) => w.sedute + w.seduteCampo === 0 || w.dolore == null)) return null
  const d = [w0.dolore!, w1.dolore!, w2.dolore!] as [number, number, number]
  if (!(d[0] < d[1] && d[1] < d[2] && d[2] - d[0] >= 1)) return null

  let scelta: AvvisoCarico | null = null
  let crescita = 0
  for (const k of chiavi) {
    const v = [w0, w1, w2].map((w) => w.voci[k]?.fatto ?? 0) as [number, number, number]
    if (!(v[2] > v[0] && v[1] >= v[0])) continue
    const quanto = v[0] === 0 ? Infinity : (v[2] - v[0]) / v[0]
    if (scelta == null || quanto > crescita) {
      scelta = { chiave: k, valori: v, dolori: d }
      crescita = quanto
    }
  }
  return scelta
}
