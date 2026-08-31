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

// L'eta' non si memorizza mai: si calcola, altrimenti dopo un anno e' sbagliata.
export function eta(dataNascita: string | null): number | null {
  if (!dataNascita) return null
  const nato = new Date(dataNascita)
  if (Number.isNaN(nato.getTime())) return null
  const oggi = new Date()
  let anni = oggi.getFullYear() - nato.getFullYear()
  const compiuto =
    oggi.getMonth() > nato.getMonth() ||
    (oggi.getMonth() === nato.getMonth() && oggi.getDate() >= nato.getDate())
  if (!compiuto) anni -= 1
  return anni >= 0 ? anni : null
}
