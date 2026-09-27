import { useRef, useState } from 'react'
import Modale from './Modale'

// Ritaglio quadrato stile "foto profilo": l'immagine copre sempre tutta la
// cornice (come un cover), si trascina per scegliere l'inquadratura e uno
// slider zooma senza mai lasciare bordi vuoti. Alla conferma si disegna solo
// la porzione visibile su un canvas a risoluzione fissa.
const CORNICE = 320 // misura della cornice a schermo, in pixel CSS
const ESPORTA = 640 // lato del quadrato esportato

interface Props {
  src: string
  onConferma: (dataUrlRitagliata: string) => void
  onAnnulla: () => void
  // Cliccando fuori dal riquadro si annulla il ritaglio, ma non ci si ferma
  // li': e' lo stesso gesto di cliccare fuori dalla finestra sotto, e deve
  // chiuderla (salvando) come farebbe lei. Il pulsante "Annulla" invece
  // annulla solo il ritaglio, restando nella finestra sotto a modificare
  // altro.
  onCliccaFuori?: () => void
}

export default function RitaglioImmagine({
  src,
  onConferma,
  onAnnulla,
  onCliccaFuori
}: Props): React.JSX.Element {
  const imgRef = useRef<HTMLImageElement>(null)
  const [pronta, setPronta] = useState(false)
  // scalaBase = lo zoom minimo che copre la cornice senza lasciare bordi.
  const [scalaBase, setScalaBase] = useState(1)
  const [zoom, setZoom] = useState(1)
  // Spostamento dell'immagine rispetto al centro della cornice, in pixel a schermo.
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const trascinamento = useRef<{ x: number; y: number; offset: { x: number; y: number } } | null>(
    null
  )

  const scala = scalaBase * zoom
  const naturale = imgRef.current
    ? { w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight }
    : { w: 0, h: 0 }
  const largo = naturale.w * scala
  const alto = naturale.h * scala
  const maxX = Math.max(0, (largo - CORNICE) / 2)
  const maxY = Math.max(0, (alto - CORNICE) / 2)

  const limita = (o: { x: number; y: number }, mx = maxX, my = maxY): { x: number; y: number } => ({
    x: Math.min(mx, Math.max(-mx, o.x)),
    y: Math.min(my, Math.max(-my, o.y))
  })

  const alCaricamento = (): void => {
    const img = imgRef.current
    if (!img) return
    const base = Math.max(CORNICE / img.naturalWidth, CORNICE / img.naturalHeight)
    setScalaBase(base)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setPronta(true)
  }

  const cambiaZoom = (nuovoZoom: number): void => {
    setZoom(nuovoZoom)
    const nuovaScala = scalaBase * nuovoZoom
    const nmx = Math.max(0, (naturale.w * nuovaScala - CORNICE) / 2)
    const nmy = Math.max(0, (naturale.h * nuovaScala - CORNICE) / 2)
    setOffset((o) => limita(o, nmx, nmy))
  }

  const alPuntatoreGiu = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!pronta) return
    e.currentTarget.setPointerCapture(e.pointerId)
    trascinamento.current = { x: e.clientX, y: e.clientY, offset }
  }

  const alPuntatoreMuovi = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!trascinamento.current) return
    const d = trascinamento.current
    setOffset(limita({ x: d.offset.x + (e.clientX - d.x), y: d.offset.y + (e.clientY - d.y) }))
  }

  const alPuntatoreSu = (): void => {
    trascinamento.current = null
  }

  const conferma = (): void => {
    const img = imgRef.current
    if (!img || !pronta) return
    // Punto dell'immagine sorgente che cade al centro della cornice, e lato
    // (in pixel sorgente) del quadrato inquadrato: vedi calcolo in cima al file.
    const lato = CORNICE / scala
    const cx = naturale.w / 2 - offset.x / scala
    const cy = naturale.h / 2 - offset.y / scala
    const sx = Math.min(Math.max(0, cx - lato / 2), naturale.w - lato)
    const sy = Math.min(Math.max(0, cy - lato / 2), naturale.h - lato)

    const canvas = document.createElement('canvas')
    canvas.width = ESPORTA
    canvas.height = ESPORTA
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, sx, sy, lato, lato, 0, 0, ESPORTA, ESPORTA)
    onConferma(canvas.toDataURL('image/jpeg', 0.85))
  }

  // Clic fuori (e Invio) qui annullano solo il ritaglio, non lo confermano:
  // e' lo stesso gesto di cliccare fuori dalla finestra sotto, e la cascina
  // fino a chiuderla salvando come farebbe lei (onCliccaFuori). Confermare un
  // ritaglio non ancora sistemato con un clic o un Invio finiti li' per
  // sbaglio sarebbe piu' rischioso che annullarlo.
  const annullaECascata = (): void => {
    onAnnulla()
    onCliccaFuori?.()
  }

  return (
    <Modale onConferma={annullaECascata}>
        <h3>Ritaglia la foto</h3>
        <p className="modal-testo">Trascina la foto per inquadrarla, e usa il cursore per lo zoom.</p>
        <div
          className="ritaglio-cornice"
          style={{ width: CORNICE, height: CORNICE }}
          onPointerDown={alPuntatoreGiu}
          onPointerMove={alPuntatoreMuovi}
          onPointerUp={alPuntatoreSu}
          onPointerCancel={alPuntatoreSu}
        >
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={alCaricamento}
            style={{
              width: pronta ? largo : undefined,
              height: pronta ? alto : undefined,
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
              visibility: pronta ? 'visible' : 'hidden'
            }}
          />
        </div>
        <label>
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            disabled={!pronta}
            onChange={(e) => cambiaZoom(Number(e.target.value))}
          />
        </label>
        <div className="modal-actions">
          <button onClick={onAnnulla}>Annulla</button>
          <button className="primary" disabled={!pronta} onClick={conferma}>
            Usa questa foto
          </button>
        </div>
    </Modale>
  )
}
