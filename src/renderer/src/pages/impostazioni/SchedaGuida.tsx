import { Fragment, useMemo, useState } from 'react'
import { ChevronRight, Search, X } from 'lucide-react'
import type { ArgomentoGuida, ElementoGuida } from './guida/modello'
import { ARGOMENTI } from './guida/contenuti'
import { cercaArgomenti, evidenzia, paroleCercate, vociPercorso } from './guida/ricerca'
import Modale from '../../components/Modale'
import { useScorciatoie } from '../../scorciatoie'

// La guida: per le funzioni che si usano di rado e si dimenticano. Un elenco di
// argomenti (come quello dei pazienti) con il campo per cercare: un clic su un
// titolo apre la finestra con la spiegazione. I testi sono in guida/contenuti.ts.

// Le parole cercate colorate dentro un pezzo di testo.
function Colorato({ testo, parole }: { testo: string; parole: string[] }): React.JSX.Element {
  return (
    <>
      {evidenzia(testo, parole).map(([t, trovato], k) =>
        trovato ? <mark key={k}>{t}</mark> : <Fragment key={k}>{t}</Fragment>
      )}
    </>
  )
}

// Un testo con il grassetto (**cosi'**), le sequenze di clic ([[A > B]], tasti
// uniti da frecce) e le parole cercate colorate. Vedi guida/modello.ts.
function Testo({ testo, parole }: { testo: string; parole: string[] }): React.JSX.Element {
  // diviso sulle sequenze: i pezzi pari sono testo, i dispari sono sequenze
  return (
    <>
      {testo.split(/\[\[(.+?)\]\]/).map((pezzo, n) =>
        n % 2 === 1 ? (
          <span key={n} className="guida-percorso">
            {vociPercorso(pezzo).map((voce, i) => (
              <Fragment key={i}>
                {i > 0 && (
                  <span className="guida-freccia" aria-hidden="true">
                    →
                  </span>
                )}
                <span className="guida-tasto">
                  <Colorato testo={voce} parole={parole} />
                </span>
              </Fragment>
            ))}
          </span>
        ) : (
          <Fragment key={n}>
            {pezzo.split('**').map((parte, i) =>
              i % 2 === 1 ? (
                <b key={i}>
                  <Colorato testo={parte} parole={parole} />
                </b>
              ) : (
                <Colorato key={i} testo={parte} parole={parole} />
              )
            )}
          </Fragment>
        )
      )}
    </>
  )
}

function Elemento({
  e,
  parole
}: {
  e: ElementoGuida
  parole: string[]
}): React.JSX.Element {
  if (typeof e === 'string') {
    return (
      <p>
        <Testo testo={e} parole={parole} />
      </p>
    )
  }
  const voci = 'passi' in e ? e.passi : e.punti
  const Lista = 'passi' in e ? 'ol' : 'ul'
  return (
    <Lista className={'passi' in e ? 'guida-passi' : undefined}>
      {voci.map((v, i) => (
        <li key={i}>
          <Testo testo={v} parole={parole} />
        </li>
      ))}
    </Lista>
  )
}

export function SchedaGuida(): React.JSX.Element {
  const [ricerca, setRicerca] = useState('')
  const [apertoId, setApertoId] = useState<string | null>(null)

  const trovati = useMemo(() => cercaArgomenti(ARGOMENTI, ricerca), [ricerca])
  const parole = useMemo(() => paroleCercate(ricerca), [ricerca])
  const aperto: ArgomentoGuida | undefined = ARGOMENTI.find((a) => a.id === apertoId)

  useScorciatoie([{ tasto: 'Escape', azione: () => setApertoId(null), attiva: aperto != null }])

  return (
    <section className="card guida">
      <div className="guida-ricerca">
        <Search size={15} />
        <input
          type="text"
          value={ricerca}
          placeholder="Cerca nella guida…"
          aria-label="Cerca nella guida"
          onChange={(e) => setRicerca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && ricerca !== '') {
              e.stopPropagation()
              setRicerca('')
            }
          }}
        />
        {ricerca !== '' && (
          <button className="guida-svuota" title="Cancella la ricerca" onClick={() => setRicerca('')}>
            <X size={14} />
          </button>
        )}
      </div>
      <p className="guida-legenda">
        <Testo testo="Clicca un argomento per leggerlo. Dove vedi [[A > B > C]] clicca in questo ordine." parole={[]} />
      </p>

      {trovati.length === 0 ? (
        <p className="guida-nessuno">Nessun argomento parla di «{ricerca.trim()}».</p>
      ) : (
        <nav className="guida-righe" aria-label="Argomenti della guida">
          {trovati.map((a) => (
            <button key={a.id} className="guida-riga" onClick={() => setApertoId(a.id)}>
              <span className="guida-riga-titolo">{a.titolo}</span>
              <span className="guida-riga-breve">{a.breve}</span>
              <ChevronRight size={18} className="guida-riga-freccia" aria-hidden="true" />
            </button>
          ))}
        </nav>
      )}

      {aperto && (
        <Modale
          className="modal-lg modal-guida"
          overlayClassName="modal-overlay-contenuto"
          onConferma={() => setApertoId(null)}
        >
          <div className="modal-testata">
            <h3>{aperto.titolo}</h3>
            <button className="primary" onClick={() => setApertoId(null)}>
              Chiudi
            </button>
          </div>
          <div className="guida-testo">
            {aperto.blocchi.map((b) => (
              <div key={b.titolo} className="guida-blocco">
                <div className="sotto-titolo">
                  <Testo testo={b.titolo} parole={parole} />
                </div>
                {b.elementi.map((e, i) => (
                  <Elemento key={i} e={e} parole={parole} />
                ))}
              </div>
            ))}
          </div>
        </Modale>
      )}
    </section>
  )
}
