import { useCallback, useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import type { Promemoria } from '../../../shared/types'
import CompilaQuestionario from './CompilaQuestionario'
import RifarloFra from './RifarloFra'
import { toastErrore } from './Toast'
import { aggiungiGiorni, errMsg, etichettaPromemoria, formatData, oggiIso } from '../lib'

// I promemoria del paziente che sono arrivati a scadenza (o stanno per), davanti
// a chi sta per vederlo: in cima alla seduta e nel Quadro. Il promemoria serve
// quando il paziente e' li', non quando ci si ricorda di andare a cercarlo in
// Follow-up. Per un questionario c'e' il pulsante per compilarlo subito, e
// compilato si chiude da solo.
const GIORNI_PRIMA = 7

export default function PromemoriaInVista({
  pazienteId,
  giorno
}: {
  pazienteId: number
  // il giorno della seduta, se non e' oggi
  giorno?: string
}): React.JSX.Element | null {
  const [aperti, setAperti] = useState<Promemoria[]>([])
  const [compila, setCompila] = useState<Promemoria | null>(null)
  const [rifare, setRifare] = useState<Promemoria | null>(null)

  const carica = useCallback((): void => {
    const limite = aggiungiGiorni(giorno ?? oggiIso(), GIORNI_PRIMA)
    window.api.promemoria
      .list(pazienteId)
      .then((l) => setAperti(l.filter((p) => p.fatto_il == null && p.scadenza <= limite)))
      .catch((e) => toastErrore(errMsg(e)))
  }, [pazienteId, giorno])

  useEffect(carica, [carica])

  if (aperti.length === 0 && !compila && !rifare) return null
  const oggi = oggiIso()

  return (
    <>
      {aperti.length > 0 && (
        <section className="card promemoria-in-vista">
          <h3>
            <BellRing size={18} className="icona-titolo" aria-hidden="true" />
            Da rifare
          </h3>
          <ul className="sedute-list elenco-promemoria">
            {aperti.map((p) => (
              <li key={p.id}>
                <span className="promemoria-cosa">
                  {etichettaPromemoria(p.tipo)}: {p.riferimento_nome}
                  {p.nota && <span className="sotto-riga">{p.nota}</span>}
                </span>
                <span className={p.scadenza <= oggi ? 'data-scaduta promemoria-data' : 'promemoria-data'}>
                  {p.scadenza <= oggi ? 'scaduto il' : 'entro il'} {formatData(p.scadenza)}
                </span>
                {p.tipo === 'questionario' && p.questionario_id != null && (
                  <button onClick={() => setCompila(p)}>Compila</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {compila && compila.questionario_id != null && (
        <CompilaQuestionario
          pazienteId={pazienteId}
          questionarioId={compila.questionario_id}
          compilazione={null}
          soloLettura={false}
          onChiudi={(id) => {
            const fatto = compila
            setCompila(null)
            carica()
            // compilato: si propone il giro dopo
            if (id != null) setRifare(fatto)
          }}
        />
      )}

      {rifare && rifare.questionario_id != null && (
        <RifarloFra
          pazienteId={pazienteId}
          tipo="questionario"
          riferimentoId={rifare.questionario_id}
          nome={rifare.riferimento_nome}
          onChiudi={() => {
            setRifare(null)
            carica()
          }}
        />
      )}
    </>
  )
}
