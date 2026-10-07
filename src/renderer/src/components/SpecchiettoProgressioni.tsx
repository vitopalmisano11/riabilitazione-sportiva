import { Check, Lock } from 'lucide-react'
import type { StatoProgressione } from '../../../shared/types'
import { formatData } from '../lib'

// Dove e' arrivato il paziente nelle progressioni: ogni progressione e' una
// scala. Gli step fatti sono pieni, quello da lavorare adesso e' evidenziato e
// gli altri sono trasparenti, "da sbloccare", con quello che serve per
// arrivarci. Serve solo a programmare: non va mai in cartella o nei referti.
export default function SpecchiettoProgressioni({
  stati
}: {
  stati: StatoProgressione[]
}): React.JSX.Element {
  // Le progressioni arrivano gia' in ordine di gruppo: si raggruppano al volo.
  const gruppi: { nome: string | null; elenco: StatoProgressione[] }[] = []
  for (const p of stati) {
    const ultimo = gruppi[gruppi.length - 1]
    if (ultimo && ultimo.nome === p.gruppo_nome) ultimo.elenco.push(p)
    else gruppi.push({ nome: p.gruppo_nome, elenco: [p] })
  }

  return (
    <div className="specchietto-prog">
      {gruppi.map((g) => (
        <section key={g.nome ?? ''}>
          {g.nome && <div className="sotto-titolo">{g.nome}</div>}
          {g.elenco.map((p) => (
            <div className="scala-prog" key={p.id}>
              <div className="scala-testata">
                <h4>{p.nome}</h4>
                <span className="hint">
                  {p.completata ? 'scala completata' : `step ${p.posizione + 1} di ${p.step.length}`}
                </span>
              </div>
              {p.criteri && <p className="scala-criteri">{p.criteri}</p>}
              <ol className="scala-step">
                {p.step.map((s, i) => (
                  <li key={s.id} className={`step-prog ${s.stato}`}>
                    <span className="step-pallino">
                      {s.stato === 'fatto' ? (
                        <Check size={14} />
                      ) : s.stato === 'da_sbloccare' ? (
                        <Lock size={12} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="step-nome">
                      {s.esercizio_nome}
                      {s.archiviato === 1 && <em> (archiviato)</em>}
                    </span>
                    <span className="step-nota">
                      {s.stato === 'fatto' && s.superato_il && formatData(s.superato_il)}
                      {s.stato === 'attuale' && (
                        <>
                          <b>siamo qui</b>
                          {p.attuale_dal && ` · dal ${formatData(p.attuale_dal)}`}
                          {s.rivisto_il && ` · ↓ rivisto il ${formatData(s.rivisto_il)}`}
                        </>
                      )}
                    </span>
                    {s.stato !== 'fatto' && s.requisito && (
                      <span className="step-requisito">Requisito: {s.requisito}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
