// L'icona degli obiettivi terapeutici: il quaderno a spirale con gli obiettivi
// scritti, e il bersaglio con la freccia che ci si appoggia sopra.
//
// Disegnata di tratto come le altre icone dell'app. Il bersaglio si stacca dal
// quaderno perche' sotto ha un contorno del colore del fondo: senza, le righe
// del foglio gli passavano attraverso.
export default function IconaObiettivi({ size = 26 }: { size?: number }): React.JSX.Element {
  const bersaglio = (
    <>
      <circle cx="66" cy="70" r="24" />
      <circle cx="66" cy="70" r="14" />
      <circle cx="66" cy="70" r="5" />
      {/* la freccia arriva dall'alto a destra, con la cocca in fondo */}
      <path d="M66,70 L97,46" />
      <path d="M86,42 L97,46 L93,57" />
    </>
  )

  return (
    <svg className="icona-obiettivi" width={size} height={size} viewBox="0 0 104 104">
      {/* il foglio, con la spirale a sinistra */}
      <rect className="io-foglio" x="20" y="8" width="60" height="70" rx="7" />
      <g className="io-spirale">
        <path d="M24,20 A7,7 0 1 0 12,20" />
        <path d="M24,36 A7,7 0 1 0 12,36" />
        <path d="M24,52 A7,7 0 1 0 12,52" />
        <path d="M24,68 A7,7 0 1 0 12,68" />
      </g>
      <g className="io-righe">
        <path d="M34,24 L68,24" />
        <path d="M34,38 L68,38" />
        <path d="M34,52 L56,52" />
      </g>
      {/* prima il contorno del colore del fondo, poi il bersaglio vero */}
      <g className="io-alone">{bersaglio}</g>
      <g className="io-bersaglio">{bersaglio}</g>
    </svg>
  )
}
