import { useEffect, useState } from 'react'
import Aiuto from '../../components/Aiuto'
import type { Profilo } from '../../../../shared/types'
import IndicatoreSalvataggio from '../../components/IndicatoreSalvataggio'
import { useSalvataggio } from '../../salvataggio'
import { IdCard } from 'lucide-react'
import { toast, toastErrore } from '../../components/Toast'
import { errMsg } from '../../lib'

// Chi firma i fogli stampati: si compila una volta, e da quel momento ogni
// documento esce con il tuo nome invece che anonimo.
const CAMPI_PROFILO: {
  chiave: Exclude<keyof Profilo, 'iscrizione_in_scheda'>
  etichetta: string
  esempio: string
}[] = [
  { chiave: 'nome', etichetta: 'Nome e cognome', esempio: 'es. Dott. Mario Rossi' },
  { chiave: 'qualifica', etichetta: 'Qualifica', esempio: 'es. Fisioterapista' },
  { chiave: 'studio', etichetta: 'Studio', esempio: 'es. Studio di Riabilitazione Sportiva' },
  { chiave: 'indirizzo', etichetta: 'Indirizzo', esempio: 'es. via Roma 3, Bari' },
  { chiave: 'codice_fiscale', etichetta: 'Codice fiscale', esempio: 'es. RSSMRA80A01A662X' },
  { chiave: 'partita_iva', etichetta: 'Partita IVA', esempio: 'es. 01234567890' },
  {
    chiave: 'numero_iscrizione',
    etichetta: "Numero di iscrizione all'OFI di Siena",
    esempio: 'es. 1234'
  },
  { chiave: 'telefono', etichetta: 'Telefono', esempio: 'es. 333 1234567' },
  { chiave: 'email', etichetta: 'Email', esempio: 'es. studio@esempio.it' }
]

const PROFILO_VUOTO: Profilo = {
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

export function SchedaProfilo(): React.JSX.Element {
  const [profilo, setProfilo] = useState<Profilo>(PROFILO_VUOTO)
  const [salvato, setSalvato] = useState(true)
  // uscendo dalla scheda, o chiudendo il programma, si salva da solo
  const salvataggio = useSalvataggio(!salvato)

  useEffect(() => {
    void window.api.profilo
      .leggi()
      .then((p) => setProfilo(p))
      .catch((e) => toastErrore(errMsg(e)))
  }, [])

  const cambia = (chiave: (typeof CAMPI_PROFILO)[number]['chiave'], valore: string): void => {
    setProfilo({ ...profilo, [chiave]: valore })
    setSalvato(false)
  }

  const salva = async (): Promise<boolean> => {
    try {
      await window.api.profilo.salva(profilo)
      setSalvato(true)
      toast('Profilo salvato.')
      return true
    } catch (e) {
      toastErrore(errMsg(e))
      return false
    }
  }
  salvataggio.funzione.current = salva

  // L'anteprima e' la stessa cosa che finisce in cima al foglio: cosi' si vede
  // subito com'e' venuta, senza stampare per scoprirlo.
  const chi = [profilo.nome, profilo.qualifica].filter(Boolean).join(' · ')
  // Nell'anteprima la riga c'e' appena si accende l'interruttore, anche prima
  // di aver scritto il numero: cosi' si vede dove andra' a finire.
  const iscrizione = `Iscritto all'OFI di Siena n. ${profilo.numero_iscrizione?.trim() || '…'}`
  const dove = [
    profilo.studio,
    profilo.indirizzo,
    profilo.codice_fiscale ? `C.F. ${profilo.codice_fiscale}` : null,
    profilo.partita_iva ? `P. IVA ${profilo.partita_iva}` : null,
    profilo.telefono,
    profilo.email
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="card">
      <div className="blocco-impostazione">
        <div className="sotto-titolo">
          Chi firma i fogli
          <Aiuto testo="Nome, qualifica, dati fiscali e contatti compaiono in cima a tutto quello che stampi: cartella e report; il certificato di presenza li prende da qui. Sulla scheda illustrata per il paziente restano solo nome e qualifica. Lascia vuoto quello che non ti serve, e non comparirà; finché è tutto vuoto i fogli escono come adesso, senza intestazione." />
        </div>
        <div className="form-row-2">
          {CAMPI_PROFILO.map((c) => (
            <label key={c.chiave} className="field">
              {c.etichetta}
              <input
                type="text"
                placeholder={c.esempio}
                value={profilo[c.chiave] ?? ''}
                onChange={(e) => cambia(c.chiave, e.target.value)}
              />
            </label>
          ))}
        </div>

        {/* L'iscrizione all'Ordine sta in fondo a destra della riga del nome, e
            solo sui fogli che la prevedono: qui si decide se scriverla. Sul
            certificato di presenza compare sempre. */}
        <label className="checkbox-inline riga-staccata">
          <input
            type="checkbox"
            checked={profilo.iscrizione_in_scheda !== 0}
            onChange={(e) => {
              setProfilo({ ...profilo, iscrizione_in_scheda: e.target.checked ? 1 : 0 })
              setSalvato(false)
            }}
          />
          Scrivi l&apos;iscrizione all&apos;OFI di Siena in cima ai fogli
          <Aiuto testo="Compare in fondo a destra della riga con il tuo nome, sulle schede e sugli altri documenti. Sul certificato di presenza c'è sempre. Serve il numero di iscrizione scritto qui sopra." />
        </label>

        {(chi !== '' || dove !== '' || profilo.iscrizione_in_scheda !== 0) && (
          <div className="anteprima-profilo">
            <span className="hint">Come esce in cima al foglio</span>
            <div className="foglio-finto">
              <div className="riga-chi-con-iscrizione">
                <div className="riga-chi">{chi}</div>
                {profilo.iscrizione_in_scheda !== 0 && (
                  <div className="riga-iscrizione">{iscrizione}</div>
                )}
              </div>
              {dove !== '' && <div className="riga-dove">{dove}</div>}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <IndicatoreSalvataggio stato={salvataggio.stato} errore={salvataggio.errore} />
          <button
            className="primary"
            disabled={salvato || salvataggio.stato === 'salvo'}
            onClick={() => void salvataggio.salva()}
          >
            <IdCard size={16} /> Salva il profilo
          </button>
        </div>
      </div>
    </section>
  )
}
