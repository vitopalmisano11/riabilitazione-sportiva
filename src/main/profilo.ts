// Chi firma i fogli stampati.
//
// Nome, qualifica e contatti di chi lavora con l'app: una riga sola nel
// database, che i generatori dei documenti leggono per metterla in cima alla
// pagina. Prima ogni foglio usciva anonimo, e chi lo riceveva non sapeva da
// chi arrivava.
//
// Senza niente di Electron dentro: i documenti si generano anche fuori
// dall'app (lo smoke test), e devono poterlo leggere.
import { getDb } from './db'
import type { Profilo } from '../shared/types'

const VUOTO: Profilo = {
  nome: null,
  qualifica: null,
  studio: null,
  indirizzo: null,
  codice_fiscale: null,
  partita_iva: null,
  telefono: null,
  email: null
}

export function leggiProfilo(): Profilo {
  try {
    return (getDb().prepare('SELECT * FROM profilo WHERE id = 1').get() as Profilo) ?? VUOTO
  } catch {
    // Il profilo e' un di piu': se non si riesce a leggerlo, il documento esce
    // come usciva prima invece di non uscire affatto.
    return VUOTO
  }
}

export function salvaProfilo(p: Profilo): void {
  const pulito = (v: string | null): string | null => {
    const t = (v ?? '').trim()
    return t === '' ? null : t
  }
  getDb()
    .prepare(
      `UPDATE profilo SET nome = ?, qualifica = ?, studio = ?, indirizzo = ?,
                          codice_fiscale = ?, partita_iva = ?,
                          telefono = ?, email = ? WHERE id = 1`
    )
    .run(
      pulito(p.nome),
      pulito(p.qualifica),
      pulito(p.studio),
      pulito(p.indirizzo),
      pulito(p.codice_fiscale),
      pulito(p.partita_iva),
      pulito(p.telefono),
      pulito(p.email)
    )
}

// Le due righe dell'intestazione: chi sei e come ti si trova. Tornano vuote se
// il profilo non e' stato compilato, e allora il foglio resta com'era.
export function righeProfilo(p: Profilo = leggiProfilo()): { chi: string; dove: string } {
  const chi = [p.nome, p.qualifica].filter(Boolean).join(' · ')
  const dove = [
    p.studio,
    p.indirizzo,
    p.codice_fiscale ? `C.F. ${p.codice_fiscale}` : null,
    p.partita_iva ? `P. IVA ${p.partita_iva}` : null,
    p.telefono,
    p.email
  ]
    .filter(Boolean)
    .join(' · ')
  return { chi, dove }
}
