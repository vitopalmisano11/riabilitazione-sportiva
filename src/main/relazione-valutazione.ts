// La relazione scritta della valutazione obiettiva: i rilievi messi in frasi.
//
// Come quella dell'anamnesi non c'e' nessuna intelligenza artificiale: frasi
// fisse riempite con quello che e' stato segnato, nell'ordine della scheda.
// Quello che non e' segnato non compare; "nella norma" si scrive solo dove lo
// si e' detto.
//
// I movimenti sono tutti nomi femminili (flessione, estensione, rotazione,
// abduzione, inclinazione): gli aggettivi si accordano cosi'.
import { getDb } from './db'
import { GRUPPI } from '../shared/distretti'

type Riga = Record<string, unknown>

export interface ParagrafoValutazione {
  // "Valutazione del 10/09/2026"
  titolo: string
  paragrafi: string[]
}

function data(iso: unknown): string {
  const [y, m, d] = String(iso ?? '').split('-')
  return d && m && y ? `${d}/${m}/${y}` : String(iso ?? '')
}

function testoLibero(v: unknown): string | null {
  if (v == null) return null
  const t = String(v).trim().replace(/[.;,\s]+$/, '')
  return t === '' ? null : t
}

function frase(t: string): string {
  const s = t.trim()
  return s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? '' : '.')
}

function elenco(voci: string[]): string {
  if (voci.length <= 1) return voci.join('')
  return `${voci.slice(0, -1).join(', ')} e ${voci[voci.length - 1]}`
}

const LIMITAZIONE = ['', 'lievemente limitata', 'moderatamente limitata', 'severamente limitata']

// Un movimento, attivo o passivo: "flessione moderatamente limitata e
// dolorosa (110°)". Null se su quel lato non c'e' niente da dire.
function rilievo(nome: string, r: Riga, tipo: 'attivo' | 'passivo'): string | null {
  const restrizione = r[`${tipo}_restrizione`]
  const dolore = Number(r[`${tipo}_dolore`] ?? 0) > 0
  const gradi = r[`${tipo}_gradi`]
  const qualita: string[] = []
  if (restrizione != null && Number(restrizione) > 0) qualita.push(LIMITAZIONE[Number(restrizione)] ?? 'limitata')
  if (dolore) qualita.push('dolorosa')
  const misura = gradi == null ? '' : ` (${gradi}°)`
  if (qualita.length === 0 && misura === '') return null
  return `${nome}${qualita.length ? ` ${qualita.join(' e ')}` : ''}${misura}`
}

// I movimenti di un lato (o di un distretto senza lato) in una frase sola:
// prima quelli con qualcosa da dire, poi quelli nella norma tutti insieme.
function movimentiDi(righe: Riga[], tipo: 'attivo' | 'passivo'): string | null {
  const segnati: string[] = []
  const normali: string[] = []
  for (const r of righe) {
    const nome = String(r.nome).toLowerCase()
    const normale = Number(r.norma) === 1
    const gradi = r[`${tipo}_gradi`]
    if (normale) {
      // nella norma, con i gradi se sono stati misurati
      if (gradi != null) segnati.push(`${nome} nella norma (${gradi}°)`)
      else normali.push(nome)
      continue
    }
    const detto = rilievo(nome, r, tipo)
    if (detto) segnati.push(detto)
  }
  const parti = [...segnati]
  if (normali.length > 0) parti.push(`${elenco(normali)} nella norma`)
  return parti.length > 0 ? parti.join('; ') : null
}

export function relazioneValutazione(pazienteId: number): ParagrafoValutazione[] {
  const db = getDb()
  const paziente = db.prepare('SELECT arto_operato FROM pazienti WHERE id = ?').get(pazienteId) as
    | { arto_operato: 'dx' | 'sx' | null }
    | undefined
  if (!paziente) throw new Error('Paziente non trovato.')
  const interessato = paziente.arto_operato

  const valutazioni = db
    .prepare('SELECT * FROM valutazioni WHERE paziente_id = ? ORDER BY data DESC, id DESC')
    .all(pazienteId) as Riga[]

  const distrettiStmt = db.prepare(
    `SELECT d.id, d.nome, vd.nota_attivo, vd.nota_passivo FROM valutazione_distretti vd
     JOIN distretti d ON d.id = vd.distretto_id
     WHERE vd.valutazione_id = ? ORDER BY d.ordine, d.nome`
  )
  const movimentiStmt = db.prepare(
    `SELECT m.id, m.nome, vm.* FROM distretto_movimenti m
     JOIN valutazione_movimenti vm ON vm.movimento_id = m.id AND vm.valutazione_id = ?
     WHERE m.distretto_id = ? ORDER BY m.ordine, m.id`
  )
  const testStmt = db.prepare(
    `SELECT t.id, t.nome, t.gruppo, t.risposta, vt.lato, vt.valore, vt.nota FROM distretto_test t
     JOIN valutazione_test vt ON vt.test_id = t.id AND vt.valutazione_id = ?
     WHERE t.distretto_id = ? ORDER BY t.ordine, t.id, vt.lato`
  )

  const nomeLato = (l: unknown): string => {
    const nome = l === 'dx' ? 'a destra' : 'a sinistra'
    return l === interessato ? `${nome} (lato interessato)` : nome
  }

  return valutazioni.map((v): ParagrafoValutazione => {
    const paragrafi: string[] = []

    const ispezione = testoLibero(v.ispezione)
    if (ispezione) paragrafi.push(frase(`All'ispezione, osservazione e palpazione: ${ispezione}`))

    for (const d of distrettiStmt.all(v.id) as Riga[]) {
      const frasi: string[] = []
      const movimenti = movimentiStmt.all(v.id, d.id) as Riga[]
      const conLati = movimenti.some((m) => m.lato === 'dx' || m.lato === 'sx')

      for (const tipo of ['attivo', 'passivo'] as const) {
        const titolo = tipo === 'attivo' ? 'Movimenti attivi' : 'Movimenti passivi'
        if (conLati) {
          // una frase per lato: con i due lati nella stessa frase non si
          // capiva dove finiva la destra
          for (const l of ['dx', 'sx'] as const) {
            const detto = movimentiDi(movimenti.filter((m) => m.lato === l), tipo)
            if (detto) frasi.push(frase(`${titolo} ${nomeLato(l)}: ${detto}`))
          }
        } else {
          const detto = movimentiDi(movimenti, tipo)
          if (detto) frasi.push(frase(`${titolo}: ${detto}`))
        }
        const nota = testoLibero(d[`nota_${tipo}`])
        if (nota) frasi.push(frase(`Note sul movimento ${tipo}: ${nota}`))
      }

      // Il confronto dei gradi fra i due lati, dove ci sono tutti e due.
      if (conLati) {
        const confronti: string[] = []
        const ids = [...new Set(movimenti.map((m) => Number(m.id)))]
        for (const id of ids) {
          const dx = movimenti.find((m) => Number(m.id) === id && m.lato === 'dx')
          const sx = movimenti.find((m) => Number(m.id) === id && m.lato === 'sx')
          if (!dx || !sx) continue
          for (const tipo of ['attivo', 'passivo'] as const) {
            const a = dx[`${tipo}_gradi`]
            const b = sx[`${tipo}_gradi`]
            if (a == null || b == null) continue
            const nA = Number(a)
            const nB = Number(b)
            let esito = ''
            if (interessato) {
              const int = interessato === 'dx' ? nA : nB
              const sano = interessato === 'dx' ? nB : nA
              if (sano !== 0) {
                const diff = Math.round(((int - sano) / Math.abs(sano)) * 100)
                esito = diff === 0 ? ', uguali' : `, ${diff < 0 ? '−' : '+'}${Math.abs(diff)}% sul lato interessato`
              }
            } else if (Math.max(nA, nB) !== 0) {
              esito = `, differenza del ${Math.round((Math.abs(nA - nB) / Math.max(nA, nB)) * 100)}%`
            }
            confronti.push(
              `${String(dx.nome).toLowerCase()} ${tipo === 'attivo' ? 'attiva' : 'passiva'} ${nA}° a destra e ${nB}° a sinistra${esito}`
            )
          }
        }
        if (confronti.length > 0) frasi.push(frase(`Confronto fra i lati: ${confronti.join('; ')}`))
      }

      // I test, gruppo per gruppo: "Stabilità legamentosa: Lachman positivo
      // a destra e negativo a sinistra; cassetto anteriore negativo."
      const test = testStmt.all(v.id, d.id) as Riga[]
      const esito = (t: Riga): string | null => {
        const valore = testoLibero(t.valore)
        if (valore == null) return null
        return t.risposta === 'scala5' ? `${valore}/5` : valore
      }
      const gruppi = [...GRUPPI.map((g) => g.valore as string), ...new Set(test.map((t) => String(t.gruppo)))]
      for (const gruppo of [...new Set(gruppi)]) {
        const delGruppo = test.filter((t) => t.gruppo === gruppo)
        if (delGruppo.length === 0) continue
        const voci: string[] = []
        for (const id of [...new Set(delGruppo.map((t) => Number(t.id)))]) {
          const righe = delGruppo.filter((t) => Number(t.id) === id)
          const nome = String(righe[0].nome)
          const detti = righe
            .map((t) => {
              const e = esito(t)
              const nota = testoLibero(t.nota)
              const lato = t.lato === 'dx' || t.lato === 'sx' ? ` ${nomeLato(t.lato)}` : ''
              if (!e && !nota) return null
              return `${e ?? ''}${lato}${nota ? ` (${nota})` : ''}`.trim()
            })
            .filter((x): x is string => x != null)
          if (detti.length > 0) voci.push(`${nome} ${elenco(detti)}`)
        }
        if (voci.length > 0) {
          const titolo = GRUPPI.find((g) => g.valore === gruppo)?.etichetta ?? 'Test'
          frasi.push(frase(`${titolo}: ${voci.join('; ')}`))
        }
      }

      if (frasi.length > 0) paragrafi.push(`${d.nome}. ${frasi.join(' ')}`)
    }

    // Carico e capacita' di carico: il carico e' maschile, la capacita'
    // femminile.
    const carico: string[] = []
    const valori: [string, unknown, boolean][] = [
      ['carico locale', v.carico_locale, false],
      ['carico generale', v.carico_generale, false],
      ['capacità di carico locale', v.capacita_locale, true],
      ['capacità di carico generale', v.capacita_generale, true]
    ]
    for (const [nome, valore, femminile] of valori) {
      if (valore == null || valore === '') continue
      const parola = String(valore)
      carico.push(`${nome} ${femminile ? parola.replace(/o$/, 'a') : parola}`)
    }
    if (carico.length > 0) paragrafi.push(frase(carico.join(', ')))

    const note = testoLibero(v.note)
    if (note) paragrafi.push(frase(`Note: ${note}`))

    return { titolo: `Valutazione del ${data(v.data)}`, paragrafi }
  })
}
