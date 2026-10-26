// Come si scrive un esercizio con la sua variante, in un posto solo.
//
// "Equilibrio monopodalico" da solo e' l'esercizio normale; con una variante
// diventa "Equilibrio monopodalico — con conteggio all'indietro". Sta in
// `shared` perche' lo usano l'interfaccia e i documenti (che girano nel
// processo principale e non possono importare niente di React).

export function nomeConVariante(nome: string, variante: string | null | undefined): string {
  const v = (variante ?? '').trim()
  return v === '' ? nome : `${nome} — ${v}`
}
