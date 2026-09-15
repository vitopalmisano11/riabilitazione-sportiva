// L'icona degli obiettivi terapeutici: il bersaglio con la freccia piantata al
// centro.
//
// Disegnata sulla stessa griglia di 24 delle icone lucide che le stanno accanto
// (anamnesi prossima, remota, body chart): cosi' a parita' di misura si vede
// grande uguale. I cerchi hanno il tratto un po' piu' fine, perche' sono tre
// uno dentro l'altro e con quello pieno si impastavano. Le penne della freccia
// stanno appena fuori dal cerchio esterno e sotto hanno un contorno del colore
// del fondo, che le stacca dal cerchio invece di farle toccare.
// Il centro del bersaglio e' il centro della griglia (12, 12): cosi' nel
// pulsante il bersaglio sta in mezzo, e la freccia va verso l'angolo.
export default function IconaObiettivi({ size = 24 }: { size?: number }): React.JSX.Element {
  const penne = (
    <path d="M19.21 4.79 L21.41 5.14 L23.1 3.44 L20.91 3.09 L20.56 0.9 L18.86 2.6 Z" />
  )

  return (
    <svg className="icona-obiettivi" width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9.4" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2.6" />
      {/* prima il contorno del fondo, poi l'asta, cosi' l'asta non si
          interrompe, e per ultime le penne */}
      <g className="io-alone">{penne}</g>
      <path d="M12 12 L20.13 3.87" />
      {penne}
    </svg>
  )
}
