import { Check } from 'lucide-react'
import type {
  MovimentoDistretto,
  NoteMovimenti,
  Grado,
  LatoRilievo,
  RilievoMovimento
} from '../../../../shared/types'
import Aiuto from '../Aiuto'

// I movimenti in due riquadri, uno sotto l'altro: prima l'attivo, poi il
// passivo, come si valutano. Dentro a ognuno una riga per movimento e, con i due
// lati, destra e sinistra una accanto all'altra: il confronto fra i lati si fa
// sulla stessa riga, e il nome del movimento si scrive una volta sola. Le note
// stanno in fondo al loro riquadro, larghe quanto lui: prima erano sotto a una
// meta' della tabella e non si capiva a cosa appartenessero.
//
// La restrizione si segna con +, ++ e +++ invece che con un menu: sono i segni
// che si usano a mano sul foglio e si clicca una volta sola. Il dolore e' una
// spunta: c'e' o non c'e'.
const SEGNI: { valore: Grado; segno: string; titolo: string }[] = [
  { valore: 1, segno: '+', titolo: 'Restrizione lieve' },
  { valore: 2, segno: '++', titolo: 'Restrizione moderata' },
  { valore: 3, segno: '+++', titolo: 'Restrizione severa' }
]

export type TipoMovimento = 'attivo' | 'passivo'

const TIPI = [
  {
    tipo: 'attivo',
    titolo: 'Movimento attivo',
    restrizione: 'attivo_restrizione',
    dolore: 'attivo_dolore',
    gradi: 'attivo_gradi'
  },
  {
    tipo: 'passivo',
    titolo: 'Movimento passivo',
    restrizione: 'passivo_restrizione',
    dolore: 'passivo_dolore',
    gradi: 'passivo_gradi'
  }
] as const

export function TabellaMovimenti({
  movimenti,
  lati,
  latoInteressato,
  soloLettura,
  rilievo,
  onCambia,
  onRestoNellaNorma,
  restoFatto,
  note,
  onNote
}: {
  movimenti: MovimentoDistretto[]
  lati: LatoRilievo[]
  latoInteressato: 'dx' | 'sx' | null
  soloLettura: boolean
  rilievo: (id: number, lato: LatoRilievo) => RilievoMovimento
  onCambia: (id: number, lato: LatoRilievo, patch: Partial<RilievoMovimento>) => void
  onRestoNellaNorma: (lato: LatoRilievo, tipo: TipoMovimento) => void
  restoFatto: (lato: LatoRilievo, tipo: TipoMovimento) => boolean
  note: NoteMovimenti
  onNote: (patch: Partial<NoteMovimenti>) => void
}): React.JSX.Element {
  const conGradi = movimenti.some((m) => m.gradi === 1)
  const dueLati = lati.length > 1

  const nomeLato = (lato: LatoRilievo): string =>
    lato === 'dx' ? 'a destra' : lato === 'sx' ? 'a sinistra' : ''

  // I rilievi di un movimento, da un lato, per l'attivo o il passivo. Titoli e
  // rilievi hanno le stesse colonnine, quindi cadono uno sotto all'altro.
  const cella = (m: MovimentoDistretto, lato: LatoRilievo, t: (typeof TIPI)[number]): React.JSX.Element => {
    const id = m.id as number
    const r = rilievo(id, lato)
    const restrizione = r[t.restrizione]
    const norma = r[t.tipo === 'attivo' ? 'norma' : 'passivo_norma'] === 1
    const campoNorma = t.tipo === 'attivo' ? 'norma' : 'passivo_norma'
    return (
      <div
        key={lato}
        className={['gm-rilievi', norma ? 'in-norma' : '', lato === 'dx' && dueLati ? 'secondo-lato' : '']
          .filter(Boolean)
          .join(' ')}
      >
        {/* La spunta "nella norma" vale solo per questo riquadro: attivo o
            passivo. Mettendola si tolgono intensita' e dolore di qui. */}
        <button
          type="button"
          className={norma ? 'btn-norma scelta-attiva' : 'btn-norma'}
          title="Nella norma"
          disabled={soloLettura}
          onClick={() =>
            onCambia(
              id,
              lato,
              norma
                ? { [campoNorma]: null }
                : { [campoNorma]: 1, [t.restrizione]: null, [t.dolore]: null }
            )
          }
        >
          <Check size={14} />
        </button>
        <span className="scala-segni">
          {SEGNI.map((g) => (
            <button
              key={g.valore}
              type="button"
              title={g.titolo}
              disabled={soloLettura}
              className={restrizione === g.valore ? 'scelta-attiva' : ''}
              // ripremendo lo stesso segno si toglie: e' il modo piu' veloce
              // per correggere un clic sbagliato
              onClick={() =>
                onCambia(id, lato, { [t.restrizione]: restrizione === g.valore ? null : g.valore })
              }
            >
              {g.segno}
            </button>
          ))}
        </span>
        <span className="gm-dolore">
          <input
            type="checkbox"
            title="Dolore durante il movimento"
            disabled={soloLettura}
            // i rilievi vecchi avevano il dolore graduato: qualunque valore
            // diverso da zero vuol dire che il dolore c'era
            checked={(r[t.dolore] ?? 0) > 0}
            onChange={(e) => onCambia(id, lato, { [t.dolore]: e.target.checked ? 1 : null })}
          />
        </span>
        {conGradi &&
          (m.gradi === 1 ? (
            <input
              type="number"
              className="campo-gradi"
              title="Gradi"
              disabled={soloLettura}
              value={r[t.gradi] ?? ''}
              onChange={(e) =>
                onCambia(id, lato, {
                  [t.gradi]: e.target.value === '' ? null : Number(e.target.value)
                })
              }
            />
          ) : (
            <span className="hint">&mdash;</span>
          ))}
      </div>
    )
  }

  const classeGriglia = ['griglia-movimenti', dueLati ? 'due-lati' : '', conGradi ? 'con-gradi' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className="movimenti">
      {TIPI.map((t) => (
        <div key={t.tipo} className="riquadro-test blocco-movimenti">
          <div className="sotto-titolo">{t.titolo}</div>
          {/* Un clic per dire che quello che non hai segnato e' nella norma: la
              relazione e la cartella lo scrivono, invece di lasciare il dubbio
              fra "normale" e "non valutato". Ripremuto, toglie le spunte. */}
          {!soloLettura && (
            <div className="azioni-norma">
              {lati.map((lato) => {
                const fatto = restoFatto(lato, t.tipo)
                return (
                  <button
                    key={lato}
                    type="button"
                    className={fatto ? 'btn-piccolo scelta-attiva' : 'btn-piccolo'}
                    onClick={() => onRestoNellaNorma(lato, t.tipo)}
                  >
                    <Check size={14} /> Il resto {nomeLato(lato)} nella norma
                    {lato !== '' && lato === latoInteressato ? ' (lato interessato)' : ''}
                  </button>
                )
              })}
              <Aiuto testo="Segna nella norma tutti i movimenti di questo riquadro in cui non hai messo né l'intensità né il dolore; quelli che hai già segnato restano come sono. Ripremendo il pulsante le spunte si tolgono. L'attivo e il passivo hanno le loro spunte: un movimento può essere limitato in attivo e nella norma in passivo. La spunta nella colonna Norma fa la stessa cosa per un movimento solo; se poi segni un'intensità o il dolore, si toglie da sola." />
            </div>
          )}
          <div className={classeGriglia}>
            {dueLati && (
              <>
                <span className="gm-angolo" />
                {lati.map((lato) => (
                  <div
                    key={lato}
                    className={[
                      'gm-lato',
                      lato === latoInteressato ? 'interessato' : '',
                      lato === 'dx' ? 'secondo-lato' : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {lato === 'dx' ? 'Destra' : 'Sinistra'}
                    {lato === latoInteressato && <span className="nota-lato">lato interessato</span>}
                  </div>
                ))}
              </>
            )}

            <div className="gm-titolo">Movimento</div>
            {lati.map((lato) => (
              <div
                key={lato}
                className={lato === 'dx' && dueLati ? 'gm-sotto secondo-lato' : 'gm-sotto'}
              >
                <span>Norma</span>
                <span>Intensità</span>
                <span>Dolore</span>
                {conGradi && <span>Gradi</span>}
              </div>
            ))}

            {movimenti.map((m, i) => (
              <div key={m.id} className={i % 2 === 1 ? 'gm-riga pari' : 'gm-riga'}>
                <div className="gm-nome">{m.nome}</div>
                {lati.map((lato) => cella(m, lato, t))}
              </div>
            ))}
          </div>

          <label className="gm-nota">
            Note sul {t.titolo.toLowerCase()}
            <textarea
              rows={2}
              className="cresce"
              disabled={soloLettura}
              value={note[t.tipo] ?? ''}
              onChange={(e) => onNote({ [t.tipo]: e.target.value || null })}
            />
          </label>
        </div>
      ))}
    </div>
  )
}
