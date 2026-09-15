// La modalita' scura a orari fissi: dalle 20 alle 7, per esempio.
//
// Le ore sono scritte come "20:00". La fascia puo' passare la mezzanotte (dalle
// 20 alle 7) oppure no (dalle 13 alle 15); se inizio e fine coincidono non e'
// mai scura.

function minuti(ora: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(ora.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

export function nellaFascia(dalle: string, alle: string, adesso: Date): boolean {
  const inizio = minuti(dalle)
  const fine = minuti(alle)
  if (inizio == null || fine == null || inizio === fine) return false
  const ora = adesso.getHours() * 60 + adesso.getMinutes()
  return inizio < fine ? ora >= inizio && ora < fine : ora >= inizio || ora < fine
}
