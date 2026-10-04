// Ricerca in tutto l'archivio: pazienti, diario delle sedute, anamnesi.
//
// Senza niente di Electron (modello: sedute.ts): in ipc.ts c'e' solo il canale,
// e le prove chiamano questo codice (test/ricerca.test.ts).
//
// Si legge il testo e si confronta qui invece che con LIKE: LIKE di SQLite non
// distingue le maiuscole solo per le lettere senza accento, e "perche" non
// troverebbe "Perché". Qui maiuscole e accenti non contano. Per l'archivio di un
// ambulatorio (qualche migliaio di sedute) e' un attimo.
import { getDb } from './db'
import type { RisultatoRicerca } from '../shared/types'

const MINIMO_LETTERE = 2
const MASSIMO_PER_TIPO = 25
const DINTORNO = 45

// Minuscolo e senza accenti, lettera per lettera: la posizione di una lettera nel
// testo normalizzato e' la stessa che ha nell'originale, e serve per ritagliare
// l'estratto.
function normalizza(testo: string): string[] {
  return Array.from(testo).map((c) => c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()[0] ?? c)
}

// Una parola per volta: devono esserci tutte nello stesso campo ("rossi ginocchio"
// non trova un campo che ha solo "rossi").
function cerca(testo: string, parole: string[]): number | null {
  const n = normalizza(testo).join('')
  let primo = -1
  for (const p of parole) {
    const i = n.indexOf(p)
    if (i === -1) return null
    if (primo === -1 || i < primo) primo = i
  }
  return primo
}

function estratto(testo: string, posizione: number): string {
  const lettere = Array.from(testo.replace(/\s+/g, ' '))
  const da = Math.max(0, posizione - DINTORNO)
  const a = Math.min(lettere.length, posizione + DINTORNO)
  return `${da > 0 ? '…' : ''}${lettere.slice(da, a).join('').trim()}${a < lettere.length ? '…' : ''}`
}

// Le posizioni cambiano se gli spazi vengono compattati: si cerca sul testo gia'
// compattato, cosi' coincidono.
const compatta = (t: string): string => t.replace(/\s+/g, ' ')

interface Campo {
  etichetta: string
  testo: string | null
}

export function cercaInArchivio(domanda: string): RisultatoRicerca[] {
  const parole = normalizza(domanda.trim()).join('').split(/\s+/).filter(Boolean)
  if (parole.join('').length < MINIMO_LETTERE) return []
  const db = getDb()
  const trovati: Record<RisultatoRicerca['tipo'], RisultatoRicerca[]> = {
    paziente: [],
    seduta: [],
    anamnesi: []
  }
  const aggiungi = (r: RisultatoRicerca): void => {
    if (trovati[r.tipo].length < MASSIMO_PER_TIPO) trovati[r.tipo].push(r)
  }

  // Pazienti: prima il nome intero (nome e cognome si cercano insieme), poi gli
  // altri campi che servono a ritrovare una persona.
  const pazienti = db
    .prepare(
      `SELECT id, nome, cognome, diagnosi, sport, lavoro, telefono, email, inviato_da,
              tipo_intervento, aspettative, precauzioni
       FROM pazienti ORDER BY cognome, nome`
    )
    .all() as Record<string, string | number | null>[]
  for (const p of pazienti) {
    const nome = `${p.cognome} ${p.nome}`
    const campi: Campo[] = [
      { etichetta: '', testo: `${nome} ${p.nome} ${p.cognome}` },
      { etichetta: 'Diagnosi', testo: p.diagnosi as string | null },
      { etichetta: 'Sport', testo: p.sport as string | null },
      { etichetta: 'Lavoro', testo: p.lavoro as string | null },
      { etichetta: 'Telefono', testo: p.telefono as string | null },
      { etichetta: 'E-mail', testo: p.email as string | null },
      { etichetta: 'Inviato da', testo: p.inviato_da as string | null },
      { etichetta: 'Intervento', testo: p.tipo_intervento as string | null },
      { etichetta: 'Aspettative', testo: p.aspettative as string | null },
      { etichetta: 'Precauzioni', testo: p.precauzioni as string | null }
    ]
    for (const c of campi) {
      if (!c.testo) continue
      const testo = compatta(c.testo)
      const pos = cerca(testo, parole)
      if (pos === null) continue
      aggiungi({
        tipo: 'paziente',
        pazienteId: p.id as number,
        paziente: nome,
        titolo: nome,
        campo: c.etichetta,
        estratto: c.etichetta === '' ? '' : estratto(testo, pos)
      })
      break
    }
  }

  // Diario: dal piu' recente.
  const sedute = db
    .prepare(
      `SELECT s.id, s.paziente_id, s.data, s.note, s.focus, s.riferito, s.riferito_andamento, s.trattamento,
              p.nome, p.cognome
       FROM sedute s JOIN pazienti p ON p.id = s.paziente_id
       ORDER BY s.data DESC, s.id DESC`
    )
    .all() as Record<string, string | number | null>[]
  for (const s of sedute) {
    const campi: Campo[] = [
      { etichetta: 'Note', testo: s.note as string | null },
      { etichetta: 'Focus', testo: s.focus as string | null },
      { etichetta: 'Riferito', testo: s.riferito as string | null },
      { etichetta: 'Andamento riferito', testo: s.riferito_andamento as string | null },
      { etichetta: 'Trattamento', testo: s.trattamento as string | null }
    ]
    for (const c of campi) {
      if (!c.testo) continue
      const testo = compatta(c.testo)
      const pos = cerca(testo, parole)
      if (pos === null) continue
      aggiungi({
        tipo: 'seduta',
        pazienteId: s.paziente_id as number,
        sedutaId: s.id as number,
        paziente: `${s.cognome} ${s.nome}`,
        titolo: `${s.cognome} ${s.nome}`,
        data: s.data as string,
        campo: c.etichetta,
        estratto: estratto(testo, pos)
      })
      break
    }
  }

  // Anamnesi prossima: il motivo della visita e le note.
  const anamnesi = db
    .prepare(
      `SELECT a.paziente_id, a.motivo_consulto, a.note, p.nome, p.cognome
       FROM anamnesi_prossima a JOIN pazienti p ON p.id = a.paziente_id
       ORDER BY p.cognome, p.nome`
    )
    .all() as Record<string, string | number | null>[]
  for (const a of anamnesi) {
    const campi: Campo[] = [
      { etichetta: 'Motivo della visita', testo: a.motivo_consulto as string | null },
      { etichetta: 'Note di anamnesi', testo: a.note as string | null }
    ]
    for (const c of campi) {
      if (!c.testo) continue
      const testo = compatta(c.testo)
      const pos = cerca(testo, parole)
      if (pos === null) continue
      aggiungi({
        tipo: 'anamnesi',
        pazienteId: a.paziente_id as number,
        paziente: `${a.cognome} ${a.nome}`,
        titolo: `${a.cognome} ${a.nome}`,
        campo: c.etichetta,
        estratto: estratto(testo, pos)
      })
      break
    }
  }

  return [...trovati.paziente, ...trovati.seduta, ...trovati.anamnesi]
}
