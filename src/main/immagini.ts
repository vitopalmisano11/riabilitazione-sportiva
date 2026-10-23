// Rimpicciolire le immagini che entrano nell'archivio.
//
// Prima si guardava solo la larghezza: una foto molto alta (uno screenshot
// lungo, un panorama girato in verticale) restava enorme anche dopo il limite.
// Qui l'immagine entra in un riquadro, larghezza e altezza insieme, senza mai
// ingrandirla e senza deformarla. Le misure normali (un'immagine larga, una
// pagina A4 fotografata) restano come prima.
import type { NativeImage } from 'electron'

export function entraNelRiquadro(img: NativeImage, larghezzaMax: number, altezzaMax: number): NativeImage {
  const { width, height } = img.getSize()
  if (width <= larghezzaMax && height <= altezzaMax) return img
  // quale dei due limiti stringe di piu'
  const perLarghezza = larghezzaMax / width
  const perAltezza = altezzaMax / height
  return perLarghezza <= perAltezza
    ? img.resize({ width: larghezzaMax, quality: 'good' })
    : img.resize({ height: altezzaMax, quality: 'good' })
}
