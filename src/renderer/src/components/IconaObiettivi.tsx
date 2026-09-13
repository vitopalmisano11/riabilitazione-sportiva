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
    <path d="M16.36 7.64 L18.98 8.13 L21.46 5.66 L18.84 5.16 L18.34 2.55 L15.87 5.02 Z" />
  )

  return (
    <svg className="icona-obiettivi" width={size} height={size} viewBox="0 0 24 24">
      <circle cx="10" cy="14" r="8" />
      <circle cx="10" cy="14" r="4.5" />
      <circle cx="10" cy="14" r="1.2" />
      {/* prima il contorno del fondo, poi l'asta, cosi' l'asta non si
          interrompe, e per ultime le penne */}
      <g className="io-alone">{penne}</g>
      <path d="M10 14 L17.1 6.9" />
      {penne}
    </svg>
  )
}
