import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { ArgomentoGuida, ElementoGuida } from './guida/modello'
import { ARGOMENTI } from './guida/contenuti'
import { cercaArgomenti, evidenzia, paroleCercate, vociPercorso } from './guida/ricerca'

// La guida: per le funzioni che si usano di rado e si dimenticano. A sinistra
// l'elenco degli argomenti e il campo per cercare, a destra la voce scelta.
// I testi sono in guida/contenuti.ts.

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
  const [scelto, setScelto] = useState(ARGOMENTI[0].id)
  const testoRef = useRef<HTMLDivElement>(null)

  // Scrivendo si apre la voce che risponde meglio; cancellando tutto resta
  // aperta quella che si stava leggendo.
  const cambiaRicerca = (testo: string): void => {
    setRicerca(testo)
    const migliore = cercaArgomenti(ARGOMENTI, testo)[0]
    if (migliore && paroleCercate(testo).length > 0) setScelto(migliore.id)
  }

  const trovati = useMemo(() => cercaArgomenti(ARGOMENTI, ricerca), [ricerca])
  const parole = useMemo(() => paroleCercate(ricerca), [ricerca])
  // Se la voce aperta non risponde piu' alla ricerca si apre la prima che risponde.
  const aperta: ArgomentoGuida | undefined = trovati.find((a) => a.id === scelto) ?? trovati[0]

  // Cambiando voce il testo riparte dall'alto.
  useEffect(() => {
    testoRef.current?.scrollTo({ top: 0 })
  }, [aperta?.id])

  return (
    <section className="card guida">
      <div className="guida-elenco">
        <div className="guida-ricerca">
          <Search size={15} />
          <input
            type="text"
            value={ricerca}
            placeholder="Cerca nella guida…"
            aria-label="Cerca nella guida"
            onChange={(e) => cambiaRicerca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && ricerca !== '') {
                e.stopPropagation()
                cambiaRicerca('')
              }
            }}
          />
          {ricerca !== '' && (
            <button className="guida-svuota" title="Cancella la ricerca" onClick={() => cambiaRicerca('')}>
              <X size={14} />
            </button>
          )}
        </div>
        <p className="guida-legenda">
          <Testo testo="Dove vedi [[A > B > C]] clicca in questo ordine." parole={[]} />
        </p>
        {trovati.length === 0 ? (
          <p className="guida-nessuno">Nessun argomento parla di «{ricerca.trim()}».</p>
        ) : (
          <nav className="guida-voci" aria-label="Argomenti della guida">
            {trovati.map((a) => (
              <button
                key={a.id}
                className={a.id === aperta?.id ? 'guida-voce attiva' : 'guida-voce'}
                onClick={() => setScelto(a.id)}
              >
                <span className="guida-voce-titolo">{a.titolo}</span>
                <span className="guida-voce-breve">{a.breve}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="guida-testo" ref={testoRef}>
        {aperta && (
          <>
            <h3>{aperta.titolo}</h3>
            {aperta.blocchi.map((b) => (
              <div key={b.titolo} className="guida-blocco">
                <div className="sotto-titolo">
                  <Testo testo={b.titolo} parole={parole} />
                </div>
                {b.elementi.map((e, i) => (
                  <Elemento key={i} e={e} parole={parole} />
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  )
}
