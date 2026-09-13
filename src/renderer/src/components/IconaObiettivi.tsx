// L'icona degli obiettivi terapeutici: il bersaglio con la freccia piantata al
// centro.
//
// Disegnata sulla stessa griglia di 24 delle icone lucide che le stanno accanto
// (anamnesi prossima, remota, body chart): cosi' a parita' di misura si vede
// grande uguale. I cerchi hanno il tratto un po' piu' fine, perche' sono tre
// uno dentro l'altro e con quello pieno si impastavano. Le penne della freccia
// stanno appena fuori dal cerchio esterno e sotto hanno un contorno del colore
// del fondo, che le stacca dal cerchio invece di farle toccare.
export default function IconaObiettivi({ size = 24 }: { size?: number }): React.JSX.Element {
  const penne = (
    <path d="M17.61 6.39 L19.81 6.74 L21.5 5.04 L19.31 4.69 L18.96 2.5 L17.26 4.2 Z" />
  )

  return (
    <svg className="icona-obiettivi" width={size} height={size} viewBox="0 0 24 24">
      <circle cx="10.4" cy="13.6" r="9.4" />
      <circle cx="10.4" cy="13.6" r="6" />
      <circle cx="10.4" cy="13.6" r="2.6" />
      {/* prima il contorno del fondo, poi l'asta, cosi' l'asta non si
          interrompe, e per ultime le penne */}
      <g className="io-alone">{penne}</g>
      <path d="M10.4 13.6 L18.53 5.47" />
      {penne}
    </svg>
  )
}
