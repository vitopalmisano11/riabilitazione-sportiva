// La relazione scritta dell'anamnesi: quello che si e' raccolto nel colloquio,
// messo in frasi invece che in caselle.
//
// Non c'e' nessuna intelligenza artificiale e niente esce dal computer: sono
// frasi fisse, riempite con quello che e' scritto e selezionato, nell'ordine
// del colloquio. Quello che non e' compilato non compare, e il programma non
// aggiunge giudizi suoi. Il tono e' quello delle relazioni cliniche
// ("riferisce", "nega"), che non ha bisogno di sapere se il paziente e' un
// uomo o una donna.
import { getDb } from './db'
import { durataTesto, faseDurata, type UnitaDurata } from '../shared/sintomi'

type Riga = Record<string, unknown>

// Il testo scritto a mano, pulito per stare dentro a una frase: senza spazi e
// senza il punto finale (lo mette la frase), e con l'iniziale minuscola quando
// e' una parola normale. "LCA" o "Achille" restano come sono.
function pezzo(v: unknown): string | null {
  if (v == null) return null
  const t = String(v).trim().replace(/[.;,\s]+$/, '')
  if (t === '') return null
  const [a, b] = [t.charAt(0), t.charAt(1)]
  return b !== '' && b === b.toLowerCase() ? a.toLowerCase() + t.slice(1) : t
}

// Una frase: maiuscola in testa e punto in fondo.
function frase(t: string): string {
  const s = t.trim()
  return s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? '' : '.')
}

// Un elenco in italiano: "a", "a e b", "a, b e c".
function elenco(voci: string[], congiunzione = 'e'): string {
  if (voci.length <= 1) return voci.join('')
  return `${voci.slice(0, -1).join(', ')} ${congiunzione} ${voci[voci.length - 1]}`
}

// Le domande del quadro generale hanno una risposta scritta a mano: se e' un
// semplice si' o no la si dice con "riferisce" o "nega", altrimenti la si
// riporta com'e'.
const SI = /^(s[iì]|presente|presenti|positivo|positiva)$/i
const NO = /^(no|assente|assenti|negativo|negativa|nessuno|nessuna|niente)$/i

function siNo(v: unknown): 'si' | 'no' | string | null {
  const t = pezzo(v)
  if (t == null) return null
  if (SI.test(t)) return 'si'
  if (NO.test(t)) return 'no'
  return t
}

export interface RelazioneAnamnesi {
  prossima: string[]
  remota: string[]
}

export function relazioneAnamnesi(pazienteId: number): RelazioneAnamnesi {
  const db = getDb()
  const a = db.prepare('SELECT * FROM anamnesi_prossima WHERE paziente_id = ?').get(pazienteId) as
    | Riga
    | undefined
  const att = db.prepare('SELECT * FROM anamnesi_attivita WHERE paziente_id = ?').get(pazienteId) as
    | Riga
    | undefined
  const sintomi = db
    .prepare('SELECT * FROM anamnesi_sintomi WHERE paziente_id = ? ORDER BY ordine, id')
    .all(pazienteId) as Riga[]
  const r = db.prepare('SELECT * FROM anamnesi_remota WHERE paziente_id = ?').get(pazienteId) as
    | Riga
    | undefined
  const referti = db
    .prepare('SELECT nome FROM bioimmagini WHERE paziente_id = ? ORDER BY ordine, id')
    .all(pazienteId) as { nome: string }[]

  // ---- anamnesi prossima: un paragrafo per il motivo, uno per sintomo, uno
  // per il quadro generale ----
  const prossima: string[] = []

  const motivo = pezzo(a?.motivo_consulto)
  if (motivo) prossima.push(frase(`Si rivolge per ${motivo}`))

  sintomi.forEach((s, i) => {
    const frasi: string[] = []
    const descrizione = pezzo(s.descrizione)

    // Le caratteristiche scelte coi pulsanti, in fila dopo la descrizione.
    const tratti: string[] = []
    if (s.andamento === 'costante') tratti.push('costante')
    if (s.andamento === 'intermittente') tratti.push('intermittente')
    if (s.episodio === 'primo') tratti.push('al primo episodio')
    if (s.episodio === 'recidiva') tratti.push('recidivante')
    // La durata col numero, con la fase; il testo libero accanto, o da solo.
    const numero = s.durata_numero == null ? null : Number(s.durata_numero)
    const unita = (s.durata_unita as UnitaDurata | null) ?? null
    const durata = durataTesto(numero, unita)
    const fase = faseDurata(numero, unita)
    const daQuanto = pezzo(s.da_quanto)
    if (durata) {
      tratti.push(`presente da ${durata}${fase ? ` (fase ${fase})` : ''}${daQuanto ? `, ${daQuanto}` : ''}`)
    } else if (daQuanto) {
      tratti.push(/^da\s/i.test(daQuanto) ? `presente ${daQuanto}` : `presente da ${daQuanto}`)
    }
    // L'esordio in una parola sola: "a esordio improvviso e traumatico".
    const esordioParole: string[] = []
    if (s.esordio_modo === 'improvviso') esordioParole.push('improvviso')
    if (s.esordio_modo === 'graduale') esordioParole.push('graduale')
    if (s.traumatico === 1) esordioParole.push('traumatico')
    if (s.traumatico === 0) esordioParole.push('non traumatico')
    if (esordioParole.length > 0) tratti.push(`a esordio ${esordioParole.join(' e ')}`)

    const cosa = descrizione ?? (sintomi.length > 1 ? `un ${i === 0 ? 'primo' : 'altro'} sintomo` : 'un sintomo')
    if (descrizione || tratti.length > 0) {
      frasi.push(
        frase(`${i === 0 ? 'Riferisce' : 'Riferisce inoltre'} ${cosa}${tratti.length ? `, ${tratti.join(', ')}` : ''}`)
      )
    }

    const esordio = pezzo(s.esordio)
    if (esordio) frasi.push(frase(`All'insorgenza: ${esordio}`))

    const intensita = (
      [
        ['attuale', s.nprs_attuale],
        ['peggiore', s.nprs_peggiore],
        ['migliore', s.nprs_migliore]
      ] as [string, unknown][]
    )
      .filter(([, v]) => v != null)
      .map(([nome, v]) => `${nome} ${v}/10`)
    if (intensita.length > 0) frasi.push(frase(`Intensità del dolore (NPRS): ${intensita.join(', ')}`))

    const aggrava = pezzo(s.aggrava)
    const allevia = pezzo(s.allevia)
    if (aggrava && allevia) frasi.push(frase(`Peggiora con ${aggrava} e migliora con ${allevia}`))
    else if (aggrava) frasi.push(frase(`Peggiora con ${aggrava}`))
    else if (allevia) frasi.push(frase(`Migliora con ${allevia}`))

    const comportamento = pezzo(s.comportamento)
    if (comportamento) frasi.push(frase(`Finora ha gestito il disturbo con: ${comportamento}`))

    if (frasi.length > 0) prossima.push(frasi.join(' '))
  })

  // L'andamento nel tempo: le note scritte sotto ai due grafici.
  const andamento: string[] = []
  const giorno = pezzo(a?.note_giorno)
  if (giorno) andamento.push(frase(`Nell'arco delle 24 ore: ${giorno}`))
  const dallEsordio = pezzo(a?.note_esordio)
  if (dallEsordio) andamento.push(frase(`Dall'esordio a oggi: ${dallEsordio}`))
  const relazione = pezzo(a?.relazione_sintomi)
  if (relazione) andamento.push(frase(`Relazione fra i sintomi: ${relazione}`))
  if (andamento.length > 0) prossima.push(andamento.join(' '))

  // Il quadro generale: i si' insieme, i no insieme, il resto com'e' scritto.
  const riferisce: string[] = []
  const nega: string[] = []
  const altro: string[] = []
  // Le domande col si'/no: il pulsante decide, il dettaglio va tra parentesi.
  // Le schede compilate prima dei pulsanti hanno solo il testo, e si leggono
  // come le altre qui sotto.
  const conPulsanti: [string, unknown, unknown][] = [
    ['dolore o sintomi notturni', a?.notturno_sn, a?.dolore_notturno],
    ['disturbi del sonno', a?.sonno_sn, a?.disturbi_sonno]
  ]
  const quadro: [string, unknown][] = []
  for (const [nome, sn, dettaglio] of conPulsanti) {
    const d = pezzo(dettaglio)
    if (sn === 1) riferisce.push(d ? `${nome} (${d})` : nome)
    else if (sn === 0) nega.push(d ? `${nome} (${d})` : nome)
    else quadro.push([nome, dettaglio])
  }
  quadro.push(
    ['peggioramento con tosse o starnuto', a?.tosse_starnuto],
    ['sintomi neurologici', a?.sintomi_neurologici]
  )
  for (const [nome, valore] of quadro) {
    const v = siNo(valore)
    if (v == null) continue
    if (v === 'si') riferisce.push(nome)
    else if (v === 'no') nega.push(nome)
    else altro.push(frase(`${nome.charAt(0).toUpperCase() + nome.slice(1)}: ${v}`))
  }
  const generale: string[] = []
  if (riferisce.length) generale.push(frase(`Riferisce ${elenco(riferisce)}`))
  if (nega.length) generale.push(frase(`Nega ${elenco(nega)}`))
  generale.push(...altro)
  if (generale.length > 0) prossima.push(generale.join(' '))

  const vita: string[] = []
  const attivita = pezzo(att?.attivita)
  if (attivita) vita.push(frase(`Nelle attività: ${attivita}`))
  const partecipazione = pezzo(att?.partecipazione)
  if (partecipazione) vita.push(frase(`Nella partecipazione: ${partecipazione}`))
  const interni = pezzo(att?.fattori_interni)
  if (interni) vita.push(frase(`Aspetti psicologici e fattori personali: ${interni}`))
  if (vita.length > 0) prossima.push(vita.join(' '))

  const note = siNo(a?.note)
  if (note != null && note !== 'no' && note !== 'si') prossima.push(frase(`Note: ${note}`))

  // ---- anamnesi remota ----
  const remota: string[] = []

  // Anche qui un "nessuno" scritto nella casella diventa "nega": leggere
  // "Traumi precedenti: nessuno" in una relazione suona come un modulo.
  const storia: string[] = []
  const negati: string[] = []
  const voci: [string, string, unknown][] = [
    ['Altre patologie e farmaci', 'altre patologie o terapie farmacologiche', r?.patologie],
    ['Traumi precedenti', 'traumi precedenti', r?.traumi],
    ['Interventi chirurgici', 'interventi chirurgici', r?.interventi],
    ['Precedenti riabilitativi', 'precedenti riabilitativi', r?.riabilitazioni]
  ]
  for (const [titolo, negato, valore] of voci) {
    const v = siNo(valore)
    if (v == null || v === 'si') continue
    if (v === 'no') negati.push(negato)
    else storia.push(frase(`${titolo}: ${v}`))
  }
  if (negati.length) storia.push(frase(`Nega ${elenco(negati)}`))
  if (storia.length > 0) remota.push(storia.join(' '))

  const complementari: [string, unknown][] = [
    ['variazioni di peso', r?.peso],
    ['febbre', r?.febbre],
    ['sudorazione', r?.sudorazione],
    ['nausea o vomito', r?.nausea],
    ['fumo', r?.fumo],
    ['neoplasie', r?.neoplasie],
    ['gravidanza', r?.gravidanza],
    ['pacemaker', r?.pacemaker],
    ['schegge metalliche', r?.schegge]
  ]
  const presenti = complementari.filter(([, v]) => v === 1).map(([n]) => n)
  const assenti = complementari.filter(([, v]) => v === 0).map(([n]) => n)
  const clinica: string[] = []
  if (presenti.length) clinica.push(frase(`Riferisce ${elenco(presenti)}`))
  if (assenti.length) clinica.push(frase(`Nega ${elenco(assenti)}`))
  if (clinica.length > 0) remota.push(clinica.join(' '))

  const immagini: string[] = []
  const bioimmagini = pezzo(r?.bioimmagini_note)
  if (bioimmagini) immagini.push(frase(`Bioimmagini: ${bioimmagini}`))
  if (referti.length > 0) {
    immagini.push(
      frase(
        `${referti.length === 1 ? 'Referto allegato' : 'Referti allegati'}: ${elenco(referti.map((x) => x.nome))}`
      )
    )
  }
  if (immagini.length > 0) remota.push(immagini.join(' '))

  return { prossima, remota }
}
