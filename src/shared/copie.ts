// Quando ricordare di portare una copia fuori dal computer.
//
// Le copie automatiche stanno sullo stesso disco dell'archivio: se il computer
// si rompe o sparisce se ne vanno insieme all'originale. Se le copie finiscono
// gia' in OneDrive sono fuori da sole e non c'e' niente da ricordare.
import type { InfoBackup } from './types'

export const GIORNI_PRIMA_DELL_AVVISO = 30

// Quanti giorni sono passati dall'ultima copia fuori, o null se non ce n'e'
// mai stata una. Si contano i giorni di calendario, non le 24 ore.
export function giorniDallaCopiaFuori(
  ultima: string | null,
  adesso: Date = new Date()
): number | null {
  if (!ultima) return null
  const quando = new Date(ultima)
  if (Number.isNaN(quando.getTime())) return null
  const giorno = (d: Date): number => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.max(0, Math.round((giorno(adesso) - giorno(quando)) / 86_400_000))
}

// La frase da dire, o null se va tutto bene. Con le copie gia' in OneDrive o con
// le copie spente non si dice niente: nel secondo caso c'e' un altro problema, e
// il pannello lo mostra a parte.
export function avvisoCopiaFuori(
  info: Pick<InfoBackup, 'inOneDrive' | 'attivo' | 'ultimaCopiaFuori'>,
  adesso: Date = new Date()
): string | null {
  if (info.inOneDrive) return null
  const giorni = giorniDallaCopiaFuori(info.ultimaCopiaFuori, adesso)
  if (giorni == null) {
    return 'Non hai ancora portato una copia fuori dal computer: se il computer si rompe, le copie di sicurezza vanno via con lui.'
  }
  if (giorni < GIORNI_PRIMA_DELL_AVVISO) return null
  return `L'ultima copia fuori dal computer è di ${giorni} giorni fa: ogni tanto portane una su una chiavetta o su un disco esterno.`
}
