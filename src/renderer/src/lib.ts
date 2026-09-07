// Ripulisce i messaggi d'errore che arrivano via IPC dal prefisso tecnico di Electron.
export function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  return m.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

// 'aaaa-mm-gg' → 'gg/mm/aaaa'
export function formatData(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

// Data odierna locale in formato ISO (senza passare da UTC)
export function oggiIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

// Una data scritta 'aaaa-mm-gg' va letta come mezzanotte di qui, non di
// Greenwich: 'new Date("2026-08-29")' vale le due di notte italiane, e nelle
// prime ore del giorno i conti sui giorni finivano sballati di uno.
function mezzanotteLocale(data: string): Date {
  return new Date(`${data.slice(0, 10)}T00:00:00`)
}

// L'eta' non si memorizza mai: si calcola, altrimenti dopo un anno e' sbagliata.
// Quanto tempo e' passato da una data, in mesi e settimane: "1 mese e 3
// settimane". E' il modo in cui si ragiona in riabilitazione — i protocolli
// parlano di settimane, non di giorni — quindi i giorni che avanzano si
// buttano via, arrotondando per difetto alla settimana.
export function daQuando(data: string | null, riferimento?: Date): string | null {
  if (!data) return null
  const inizio = mezzanotteLocale(data)
  if (Number.isNaN(inizio.getTime())) return null
  // Si contano giorni interi: da che ora e' adesso non deve dipendere niente.
  // Il riferimento si puo' passare per provare la funzione su date fisse.
  const oggi = new Date(riferimento ?? new Date())
  oggi.setHours(0, 0, 0, 0)
  if (inizio > oggi) return null

  // Mesi interi: quanti mesi sono passati, meno uno se il giorno del mese non
  // e' ancora arrivato.
  let mesi =
    (oggi.getFullYear() - inizio.getFullYear()) * 12 + (oggi.getMonth() - inizio.getMonth())
  if (oggi.getDate() < inizio.getDate()) mesi -= 1
  if (mesi < 0) return null

  // La data "stesso giorno, mesi dopo", senza farsi scavalcare dai mesi corti:
  // il 31 agosto piu' un mese non e' il 31 settembre (non esiste), e sommando
  // i mesi a mano JavaScript scivolerebbe al 1 ottobre falsando il conto.
  const stessoGiorno = new Date(inizio.getFullYear(), inizio.getMonth() + mesi, 1)
  const ultimoDelMese = new Date(
    stessoGiorno.getFullYear(),
    stessoGiorno.getMonth() + 1,
    0
  ).getDate()
  stessoGiorno.setDate(Math.min(inizio.getDate(), ultimoDelMese))

  const giorni = Math.floor((oggi.getTime() - stessoGiorno.getTime()) / 86400000)
  const settimane = Math.floor(giorni / 7)

  const pezzi: string[] = []
  if (mesi > 0) pezzi.push(mesi === 1 ? '1 mese' : `${mesi} mesi`)
  if (settimane > 0) pezzi.push(settimane === 1 ? '1 settimana' : `${settimane} settimane`)
  if (pezzi.length === 0) return 'meno di una settimana'
  return pezzi.join(' e ')
}

export function eta(dataNascita: string | null): number | null {
  if (!dataNascita) return null
  const nato = mezzanotteLocale(dataNascita)
  if (Number.isNaN(nato.getTime())) return null
  const oggi = new Date()
  let anni = oggi.getFullYear() - nato.getFullYear()
  const compiuto =
    oggi.getMonth() > nato.getMonth() ||
    (oggi.getMonth() === nato.getMonth() && oggi.getDate() >= nato.getDate())
  if (!compiuto) anni -= 1
  return anni >= 0 ? anni : null
}
