import { useCallback, useEffect, useState } from 'react'
import { Copy, Minus, Square, X } from 'lucide-react'

// La barra in cima alla finestra, disegnata da noi invece che da Windows.
//
// Quella di Windows e' alta circa 32 e non si puo' cambiare; e con i colori
// dell'app i suoi pulsanti riduci e ingrandisci non si illuminavano al
// passaggio del mouse, solo la X. Qui c'e' tutto: il titolo, la striscia da
// cui si trascina la finestra (un doppio clic la ingrandisce), e i tre pulsanti,
// che al passaggio del mouse si accendono tutti — la X di rosso, come in
// Windows.
//
// Il titolo, se non lo si passa, e' quello della pagina: la scheda del paziente
// aperta lo cambia, e la barra lo segue.
export default function BarraFinestra({ titolo }: { titolo?: string }): React.JSX.Element {
  const [titoloPagina, setTitoloPagina] = useState(document.title)
  const [ingrandita, setIngrandita] = useState(false)

  useEffect(() => {
    if (titolo != null) return
    const osserva = new MutationObserver(() => setTitoloPagina(document.title))
    const testa = document.querySelector('title')
    if (testa) osserva.observe(testa, { childList: true, characterData: true, subtree: true })
    return () => osserva.disconnect()
  }, [titolo])

  // Il pulsante di mezzo cambia disegno fra "ingrandisci" e "ripristina":
  // si richiede a ogni cambio di misura, perche' la finestra si puo'
  // ingrandire anche col doppio clic o trascinandola in cima allo schermo.
  const controlla = useCallback((): void => {
    window.api.finestra
      .ingrandita()
      .then(setIngrandita)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    controlla()
    window.addEventListener('resize', controlla)
    return () => window.removeEventListener('resize', controlla)
  }, [controlla])

  const comando = (c: 'riduci' | 'ingrandisci' | 'chiudi'): void =>
    void window.api.finestra.comando(c).catch(() => undefined)

  return (
    <div className="barra-finestra">
      <span className="titolo-barra">{titolo ?? titoloPagina}</span>
      <div className="comandi-finestra">
        <button
          type="button"
          className="comando-finestra"
          title="Riduci a icona"
          onClick={() => comando('riduci')}
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          className="comando-finestra"
          title={ingrandita ? 'Ripristina' : 'Ingrandisci'}
          onClick={() => comando('ingrandisci')}
        >
          {ingrandita ? <Copy size={13} /> : <Square size={13} />}
        </button>
        <button
          type="button"
          className="comando-finestra chiudi"
          title="Chiudi"
          onClick={() => comando('chiudi')}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
