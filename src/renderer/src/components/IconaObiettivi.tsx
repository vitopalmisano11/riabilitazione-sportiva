// L'icona degli obiettivi terapeutici: il bersaglio con la freccia piantata al
// centro.
//
// Disegnata sulla stessa griglia di 24 delle icone lucide che le stanno accanto
// (anamnesi prossima, remota, body chart), con lo stesso spessore di tratto:
// cosi' a parita' di misura si vede grande uguale. Le penne della freccia
// stanno appena fuori dal cerchio esterno e sotto hanno un contorno del colore
// del fondo, che le stacca dal cerchio invece di farle toccare.
export default function IconaObiettivi({ size = 24 }: { size?: number }): React.JSX.Element {
  const penne = (
    <path d="M17.43 6.57 L19.83 6.99 L21.81 5.02 L19.41 4.59 L18.99 2.19 L17.01 4.17 Z" />
  )

  return (
    <svg className="icona-obiettivi" width={size} height={size} viewBox="0 0 24 24">
      <circle cx="10.5" cy="13.5" r="9" />
      <circle cx="10.5" cy="13.5" r="5.5" />
      <circle cx="10.5" cy="13.5" r="2" />
      {/* prima il contorno del fondo, poi l'asta, cosi' l'asta non si
          interrompe, e per ultime le penne */}
      <g className="io-alone">{penne}</g>
      <path d="M10.5 13.5 L18.42 5.58" />
      {penne}
    </svg>
  )
}
