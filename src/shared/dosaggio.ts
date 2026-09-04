// Come si scrive un dosaggio, in un posto solo.
//
// Un esercizio normale si dosa "4 × 12, rec. 2'". Nella pliometria estensiva la
// serie si spezza in blocchi con una pausa breve dentro — il cluster — e allora
// i numeri diventano quattro: 4 serie, 3 cluster per serie, 2 ripetizioni per
// cluster, 15" tra un cluster e l'altro, 2' tra una serie e l'altra.
//
// Qui non si guarda la categoria ma il dato: se il numero dei cluster c'e', il
// dosaggio si scrive a cluster. Cosi' una scheda stampata l'anno scorso resta
// leggibile com'era, anche se nel frattempo la categoria e' cambiata.
//
// Sta in `shared` perche' lo usano tutti e tre: l'interfaccia, la finestra che
// si mostra al paziente e i documenti che si stampano (che girano nel processo
// principale e non possono importare niente di React).

// Il carico come va scritto. L'unita' e' quella dell'esercizio: se nella
// casella c'e' solo un numero gliela si aggiunge, se ci hai scritto qualcosa
// ("elastico rosso", "12 kg") resta esattamente com'e'.
export function caricoTesto(
  valore: string | null | undefined,
  unita: string | null | undefined
): string | null {
  const t = (valore ?? '').trim()
  if (t === '') return null
  const u = (unita ?? '').trim()
  if (u === '') return t
  return /^[0-9]+([.,][0-9]+)?$/.test(t) ? `${t} ${u}` : t
}

export interface Dosaggio {
  serie: string | null
  cluster: string | null
  ripetizioni: string | null
  recupero_cluster: string | null
  recupero: string | null
}

const pieno = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

export function aCluster(d: Partial<Dosaggio>): boolean {
  return pieno(d.cluster) !== null
}

// Le ripetizioni come si leggono in una casella stretta: "3 × 2" a cluster,
// altrimenti il numero e basta.
export function ripetizioniTesto(d: Partial<Dosaggio>): string | null {
  const cluster = pieno(d.cluster)
  const rip = pieno(d.ripetizioni)
  if (!cluster) return rip
  return rip ? `${cluster} × ${rip}` : cluster
}

// Il volume per esteso: "4 × (3 × 2)" a cluster, "4 × 12" altrimenti.
export function volumeTesto(d: Partial<Dosaggio>): string | null {
  const serie = pieno(d.serie)
  const rip = ripetizioniTesto(d)
  if (aCluster(d)) {
    const dentro = rip ? `(${rip})` : null
    return [serie, dentro].filter(Boolean).join(' × ') || null
  }
  return [serie, rip].filter(Boolean).join(' × ') || null
}

// Il recupero in una casella stretta: "15\" / 2'" quando ce ne sono due.
export function recuperoTesto(d: Partial<Dosaggio>): string | null {
  const tra = pieno(d.recupero_cluster)
  const serie = pieno(d.recupero)
  if (!tra) return serie
  return serie ? `${tra} / ${serie}` : tra
}

// Il recupero spiegato, per la scheda che legge il paziente: li' lo spazio c'e'
// e "15\" / 2'" da solo non si capisce.
export function recuperoEsteso(d: Partial<Dosaggio>): string | null {
  const tra = pieno(d.recupero_cluster)
  const serie = pieno(d.recupero)
  if (!tra) return serie ? `rec. ${serie}` : null
  const parti = [`${tra} tra i cluster`]
  if (serie) parti.push(`${serie} tra le serie`)
  return `rec. ${parti.join(', ')}`
}
