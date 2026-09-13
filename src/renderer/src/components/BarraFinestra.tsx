import { useEffect, useState } from 'react'

// La barra in cima alla finestra, disegnata da noi invece che da Windows.
//
// Quella di Windows e' alta circa 32 e non si puo' cambiare: per averla piu'
// alta la finestra nasce senza, e Windows ci mette sopra solo riduci,
// ingrandisci e chiudi. Il resto — il titolo, e la striscia da cui si trascina
// la finestra — sta qui.
//
// Il titolo, se non lo si passa, e' quello della pagina: la scheda del paziente
// aperta lo cambia, e la barra lo segue.
export default function BarraFinestra({ titolo }: { titolo?: string }): React.JSX.Element {
  const [titoloPagina, setTitoloPagina] = useState(document.title)

  useEffect(() => {
    if (titolo != null) return
    const osserva = new MutationObserver(() => setTitoloPagina(document.title))
    const testa = document.querySelector('title')
    if (testa) osserva.observe(testa, { childList: true, characterData: true, subtree: true })
    return () => osserva.disconnect()
  }, [titolo])

  // I pulsanti di Windows prendono i colori della barra, e li riprendono
  // quando cambia il tema: cosi' la striscia e' tutta uguale anche col tema
  // scuro.
  useEffect(() => {
    const colora = (): void => {
      const stile = getComputedStyle(document.documentElement)
      const sfondo = stile.getPropertyValue('--surface').trim()
      const testo = stile.getPropertyValue('--text').trim()
      if (sfondo && testo) void window.api.coloriBarra(sfondo, testo).catch(() => undefined)
    }
    colora()
    const osserva = new MutationObserver(colora)
    osserva.observe(document.documentElement, { attributes: true })
    return () => osserva.disconnect()
  }, [])

  return (
    <div className="barra-finestra">
      <span>{titolo ?? titoloPagina}</span>
    </div>
  )
}
