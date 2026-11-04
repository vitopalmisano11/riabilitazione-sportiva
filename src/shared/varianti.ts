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

// Un esercizio risponde a una ricerca col suo nome o con il nome alternativo
// (di solito l'inglese). `ricerca` e' gia' in minuscolo e senza spazi ai lati.
// Il nome alternativo serve solo qui: sulla scheda si scrive sempre `nome`.
export function esercizioCorrisponde(
  e: { nome: string; nome_alternativo?: string | null },
  ricerca: string
): boolean {
  return (
    e.nome.toLowerCase().includes(ricerca) ||
    (e.nome_alternativo ?? '').toLowerCase().includes(ricerca)
  )
}

// "Squat monopodalico": il segno messo in seduta si legge accanto al nome.
// Senza segno (o per un esercizio che e' sempre a una gamba, dove il nome lo
// dice gia') il nome resta com'e'.
export function nomeConMonopodalico(nome: string, monopodalico: number | null | undefined): string {
  return monopodalico === 1 ? `${nome} monopodalico` : nome
}
