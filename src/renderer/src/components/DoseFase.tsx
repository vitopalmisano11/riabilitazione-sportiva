import { useCallback, useEffect, useState } from 'react'
import type { Categoria } from '../../../shared/types'
import {
  chiaveDose,
  MODELLI_DOSE,
  TIPI_LAVORO,
  tipoDiCategoria,
  type DoseFase,
  type TipoLavoro
} from '../../../shared/dose'
import { errMsg } from '../lib'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import Aiuto from './Aiuto'

// La dose della fase: quanti contatti di pliometria e quante serie di forza e
// di potenza per seduta. In seduta una riga sola dice se ci siamo; la forza si
// moltiplica per le sedute a settimana del paziente e si divide su quelle che
// restano. Le voci sono le categorie che in libreria hanno «Nel conto della
// dose»: la forza una per muscolo (quadricipite, hamstring).

type Valori = Record<string, { da: string; a: string }>

const comeTesto = (n: number | null): string => (n == null ? '' : String(n))
const comeNumero = (t: string): number | null => (t.trim() === '' ? null : Number(t))

export default function DoseFaseTab({ faseId }: { faseId: number }): React.JSX.Element {
  const [categorie, setCategorie] = useState<Categoria[]>([])
  const [valori, setValori] = useState<Valori>({})

  const carica = useCallback(async (): Promise<void> => {
    try {
      const [cats, dosi] = await Promise.all([window.api.categorie.list(), window.api.dose.fase(faseId)])
      setCategorie(cats)
      setValori(
        Object.fromEntries(dosi.map((d) => [d.chiave, { da: comeTesto(d.minimo), a: comeTesto(d.massimo) }]))
      )
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [faseId])

  useEffect(() => {
    void carica()
  }, [carica])

  // I tipi usati da almeno una categoria; per la forza, i muscoli: le categorie
  // di forza che non ne contengono altre.
  const usati = new Set(categorie.map((c) => tipoDiCategoria(c.id, categorie)).filter(Boolean))
  const tipi = TIPI_LAVORO.filter((t) => t.tipo !== 'forza' && usati.has(t.tipo))
  const muscoli = categorie
    .filter((c) => tipoDiCategoria(c.id, categorie) === 'forza' && !categorie.some((f) => f.padre_id === c.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'))

  const salva = async (nuovi: Valori): Promise<void> => {
    const dosi: DoseFase[] = Object.entries(nuovi).map(([chiave, v]) => ({
      chiave,
      minimo: comeNumero(v.da),
      massimo: comeNumero(v.a)
    }))
    try {
      await window.api.dose.impostaFase(faseId, dosi)
    } catch (e) {
      toastErrore(errMsg(e))
      await carica()
    }
  }

  const cambia = (chiave: string, campo: 'da' | 'a', testo: string): void =>
    setValori((v) => ({ ...v, [chiave]: { ...(v[chiave] ?? { da: '', a: '' }), [campo]: testo } }))

  const riempi = async (modello: (typeof MODELLI_DOSE)[number]): Promise<void> => {
    const pieni = Object.values(valori).some((v) => v.da.trim() !== '' || v.a.trim() !== '')
    if (pieni && !(await chiedi(`Sostituire i numeri di questa fase con quelli di «${modello.nome}»?`))) return
    const nuovi: Valori = {}
    const metti = (chiave: string, tipo: TipoLavoro): void => {
      const coppia = modello.valori[tipo]
      if (coppia) nuovi[chiave] = { da: comeTesto(coppia[0]), a: comeTesto(coppia[1]) }
    }
    for (const t of tipi) metti(t.tipo, t.tipo)
    for (const m of muscoli) metti(chiaveDose('forza', m.id), 'forza')
    setValori(nuovi)
    await salva(nuovi)
  }

  const riga = (chiave: string, nome: string, unita: string): React.JSX.Element => (
    <tr key={chiave}>
      <td>{nome}</td>
      {(['da', 'a'] as const).map((campo) => (
        <td key={campo}>
          <input
            type="number"
            min={0}
            aria-label={`${nome}, ${campo}`}
            value={valori[chiave]?.[campo] ?? ''}
            onChange={(e) => cambia(chiave, campo, e.target.value)}
            onBlur={() => void salva(valori)}
          />
        </td>
      ))}
      <td className="hint">{unita}</td>
    </tr>
  )

  return (
    <div>
      <h3>
        Dose della fase
        <Aiuto testo="Quanto lavoro serve in una seduta di questa fase. In seduta una riga sopra agli esercizi dice se ci sei. La pliometria si conta in contatti (un esercizio a una gamba vale doppio), la forza in serie per muscolo: il numero di qui vale per seduta, si moltiplica per le sedute a settimana del paziente e si divide su quelle che restano. Lascia vuoto quello che non vuoi controllare." />
      </h3>

      {tipi.length === 0 && muscoli.length === 0 ? (
        <p className="hint">
          Nessuna categoria si conta ancora. In &ldquo;Libreria esercizi&rdquo; apri una categoria (Pliometria,
          Rinforzo…), premi la matita e scegli &ldquo;Nel conto della dose&rdquo;.
        </p>
      ) : (
        <>
          <div className="modelli-dose">
            <span className="hint">Riempi con:</span>
            {MODELLI_DOSE.map((m) => (
              <button key={m.nome} className="btn-piccolo" title={m.spiega} onClick={() => void riempi(m)}>
                {m.nome}
              </button>
            ))}
          </div>
          <table className="tabella-dose">
            <thead>
              <tr>
                <th />
                <th>da</th>
                <th>a</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tipi.map((t) => riga(t.tipo, t.nome, `${t.unita} per seduta`))}
              {muscoli.length > 0 && (
                <tr className="sotto-titolo-dose">
                  <td colSpan={4}>Forza, per muscolo</td>
                </tr>
              )}
              {muscoli.map((m) => riga(chiaveDose('forza', m.id), m.nome, 'serie per seduta × sedute a settimana'))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
