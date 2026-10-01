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
  numero_iscrizione: null,
  iscrizione_in_scheda: 1,
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
                          codice_fiscale = ?, partita_iva = ?, numero_iscrizione = ?,
                          iscrizione_in_scheda = ?,
                          telefono = ?, email = ? WHERE id = 1`
    )
    .run(
      pulito(p.nome),
      pulito(p.qualifica),
      pulito(p.studio),
      pulito(p.indirizzo),
      pulito(p.codice_fiscale),
      pulito(p.partita_iva),
      pulito(p.numero_iscrizione),
      p.iscrizione_in_scheda === 0 ? 0 : 1,
      pulito(p.telefono),
      pulito(p.email)
    )
}

// Le due righe dell'intestazione: chi sei e come ti si trova. Tornano vuote se
// il profilo non e' stato compilato, e allora il foglio resta com'era.
// `soloNome` e' per il foglio che va al paziente (la scheda illustrata): bastano
// nome e qualifica, senza contatti, codice fiscale o partita IVA.
export function righeProfilo(
  p: Profilo = leggiProfilo(),
  soloNome = false
): { chi: string; dove: string } {
  const chi = [p.nome, p.qualifica].filter(Boolean).join(' · ')
  const dove = soloNome
    ? ''
    : [
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

// La dicitura dell'iscrizione all'Ordine, uguale sul certificato e in cima ai
// fogli. Vuota se manca il numero.
export function testoIscrizione(numero: string | null | undefined): string {
  const n = (numero ?? '').trim()
  return n === '' ? '' : `Iscritto all'OFI di Siena n. ${n}`
}
