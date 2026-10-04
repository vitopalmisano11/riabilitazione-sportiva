// Quanto e' robusta una password nuova.
//
// Le copie dell'archivio possono finire fuori dal computer (OneDrive, una
// chiavetta). Chi se ne procura una puo' provare password all'infinito, sul suo
// computer, senza che nessuno se ne accorga: l'unica difesa e' una password che
// non si indovina in fretta. Le regole valgono per le password nuove; quelle
// gia' in uso continuano ad aprire l'archivio.
//
// Sta in shared: la stessa regola la usa l'interfaccia mentre si scrive, e il
// processo principale prima di accettarla.
export const LUNGHEZZA_MINIMA = 10

// Le parole che chi prova password prova per prime. Si confrontano con la
// password senza numeri e simboli: "Juventus2024!" e' "juventus".
const COMUNI = new Set([
  'password',
  'passwordpassword',
  'qwerty',
  'qwertyuiop',
  'asdfghjkl',
  'iloveyou',
  'admin',
  'letmein',
  'benvenuto',
  'ciao',
  'amore',
  'ti amo',
  'tiamo',
  'juventus',
  'inter',
  'milan',
  'roma',
  'napoli',
  'lazio',
  'fisioterapia',
  'fisioterapista',
  'riabilitazione',
  'gestionale',
  'sportiva'
])

// abcd..., 4321..., aaaa...: ogni carattere a un passo fisso dal precedente.
function sequenza(p: string): boolean {
  if (p.length < 3) return false
  const passo = p.charCodeAt(1) - p.charCodeAt(0)
  if (Math.abs(passo) > 1) return false
  for (let i = 2; i < p.length; i++) {
    if (p.charCodeAt(i) - p.charCodeAt(i - 1) !== passo) return false
  }
  return true
}

// Cosa non va in una password nuova, o null se va bene.
export function controllaPassword(password: string): string | null {
  const p = password.trim()
  if (p.length < LUNGHEZZA_MINIMA) {
    return `La password deve avere almeno ${LUNGHEZZA_MINIMA} caratteri. Una frase di tre o quattro parole è facile da ricordare e difficile da indovinare.`
  }
  if (/^\d+$/.test(p)) {
    return 'Una password di soli numeri si indovina in fretta: aggiungi delle lettere, o usa una frase.'
  }
  if (sequenza(p.toLowerCase()) || new Set(p.toLowerCase()).size < 5) {
    return 'Troppi caratteri ripetuti o in fila (aaaa, abcd, 1234): si indovina in fretta.'
  }
  const nucleo = p.toLowerCase().replace(/[^a-zàèéìòù ]/g, '').trim()
  if (COMUNI.has(nucleo) || COMUNI.has(nucleo.replace(/ /g, ''))) {
    return 'È una delle prime password che si provano: scegline una meno comune, meglio una frase.'
  }
  return null
}
