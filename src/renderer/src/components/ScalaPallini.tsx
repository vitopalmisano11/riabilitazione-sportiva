// Una scala numerica come quella di carta: una fascia di pallini in fila, il
// numero dentro, e si preme quello che il paziente indica.
//
// Con undici pulsanti squadrati uno accanto all'altro non si legge che sono una
// scala: sembrano undici scelte separate. Cosi' invece si vede il percorso da
// un estremo all'altro, e dove sta il segno di oggi.
export default function ScalaPallini({
  min,
  max,
  valore,
  soloLettura,
  onCambia
}: {
  min: number
  max: number
  // null = non ha ancora risposto.
  valore: number | null
  soloLettura?: boolean
  onCambia: (v: number) => void
}): React.JSX.Element {
  const passi: number[] = []
  for (let v = min; v <= max; v++) passi.push(v)

  return (
    <div className="scala-pallini">
      {passi.map((v) => (
        <button
          key={v}
          type="button"
          disabled={soloLettura}
          className={valore === v ? 'pallino scelto' : 'pallino'}
          // La riga sotto ai pallini e' disegnata dal contenitore: il pallino
          // ci sta sopra, cosi' si legge come una scala e non come una fila di
          // pulsanti.
          onClick={() => onCambia(v)}
        >
          {v}
        </button>
      ))}
    </div>
  )
}
