import { memo } from 'react'
import { CornerDownLeft, ImageIcon, Video, X } from 'lucide-react'
import type { UltimaVolta } from '../../../../shared/types'
import type { PropsContenitore, PropsPresa } from '../../riordino'
import { errMsg, formatData } from '../../lib'
import { toast, toastErrore } from '../Toast'
import { testoUltima, type AzioneSezioni, type CampoRiga, type RigaBuilder } from './modello'

interface Props {
  riga: RigaBuilder
  sez: number
  indice: number
  // quali caselle in piu' mostrare (vedi mostraCluster e mostraRir)
  cluster: boolean
  rir: boolean
  // cosa aveva fatto l'ultima volta, se c'e' da mostrarlo
  ultima: UltimaVolta | undefined
  dnd: PropsContenitore
  presa: PropsPresa
  invia: (a: AzioneSezioni) => void
  onRicopiata: (chiave: string) => void
  onImmagine: (esercizio: { id: number; nome: string }) => void
}

// Un esercizio della seduta: nome, i numeri di oggi, e l'ultima volta.
//
// Si ridisegna solo quando cambia lui: prima ogni lettera scritta in una
// casella ridisegnava tutte le righe di tutte le sezioni. Le funzioni del
// trascinamento cambiano a ogni disegno della seduta ma leggono solo
// riferimenti e mandano azioni, quindi una riga ferma puo' tenere le sue; dal
// trascinamento contano solo `draggable` e la classe, che si confrontano.
function RigaSeduta({
  riga: r,
  sez,
  indice,
  cluster,
  rir,
  ultima,
  dnd,
  presa,
  invia,
  onRicopiata,
  onImmagine
}: Props): React.JSX.Element {
  const cambia = (campo: CampoRiga) => (e: { target: { value: string } }) =>
    invia({ tipo: 'valore', sez, riga: indice, campo, valore: e.target.value })

  return (
    <li {...dnd} {...presa} className={dnd.className}>
      <div className="riga-testata">
        <span className="item-nome">
          {r.nome}
          {r.link && (
            <button
              className="icona-esercizio"
              title="Apri video"
              onClick={() => window.api.apriLink(r.link!).catch((err) => toastErrore(errMsg(err)))}
            >
              <Video size={16} />
            </button>
          )}
          {/* Il pulsante compare solo con ha_immagine === 1, cosa vera solo per
              un esercizio di libreria: qui esercizio_id c'e' sempre. */}
          {r.ha_immagine === 1 && (
            <button
              className="icona-esercizio"
              title="Vedi immagine"
              onClick={() => onImmagine({ id: r.esercizio_id!, nome: r.nome })}
            >
              <ImageIcon size={16} />
            </button>
          )}
        </span>
      </div>
      {/* Parametri e nota sulla stessa riga del nome: le etichette sono nei
          segnaposto, cosi' un esercizio occupa una riga invece di tre. */}
      <div className="riga-params">
        <input title="Serie" placeholder="serie" value={r.serie ?? ''} onChange={cambia('serie')} />
        {cluster && (
          <input
            className="campo-cluster"
            title="Cluster per serie"
            placeholder="cluster"
            value={r.cluster ?? ''}
            onChange={cambia('cluster')}
          />
        )}
        <input
          title={cluster ? 'Ripetizioni per cluster' : 'Ripetizioni'}
          placeholder="rip."
          value={r.ripetizioni ?? ''}
          onChange={cambia('ripetizioni')}
        />
        {rir && (
          <input
            className="campo-cluster"
            title="Ripetizioni di riserva"
            placeholder="RIR"
            value={r.rir ?? ''}
            onChange={cambia('rir')}
          />
        )}
        <input title="Carico" placeholder="carico" value={r.carico ?? ''} onChange={cambia('carico')} />
        {cluster && (
          <input
            className="campo-cluster"
            title="Recupero tra i cluster"
            placeholder="rec. cl."
            value={r.recupero_cluster ?? ''}
            onChange={cambia('recupero_cluster')}
          />
        )}
        <input
          title={cluster ? 'Recupero tra le serie' : 'Recupero'}
          placeholder="rec."
          value={r.recupero ?? ''}
          onChange={cambia('recupero')}
        />
        <input
          className="riga-nota"
          title="Nota"
          placeholder="nota…"
          value={r.nota ?? ''}
          onChange={cambia('nota')}
        />
      </div>
      {/* Il pulsante che toglie la riga sta in fondo alla riga del nome, sempre
          nello stesso posto: messo dopo la riga dell'ultima volta finiva a
          capo, in basso a sinistra. */}
      <button
        title="Rimuovi"
        className="danger btn-togli"
        onClick={() => {
          invia({ tipo: 'togliRiga', sez, riga: indice })
          toast(`${r.nome} tolto dalla seduta. Ctrl+Z per rimetterlo.`)
        }}
      >
        <X size={16} />
      </button>
      {/* Cosa aveva fatto l'ultima volta con questo esercizio. Sta sotto ai
          numeri di oggi, dove serve: la progressione si decide guardando il
          dato, non a memoria. Il pulsante li rimette in riga tutti insieme,
          poi si ritocca — e da quel momento la riga sparisce, perche' quei
          numeri sono gia' li' sopra. Un esercizio "al volo" non ha uno storico. */}
      {ultima && (
        <div className="ultima-volta">
          <span className="ultima-quando">l&apos;ultima volta, {formatData(ultima.data)}:</span>
          <span className="ultima-dose">{testoUltima(r, ultima)}</span>
          <button
            className="btn-piccolo"
            title="Rimetti questi numeri nella riga"
            onClick={() => {
              invia({ tipo: 'ricopia', sez, riga: indice, ultima })
              onRicopiata(`${sez}:${r.esercizio_id}`)
            }}
          >
            <CornerDownLeft size={14} /> Ricopia
          </button>
        </div>
      )}
    </li>
  )
}

const uguali = (a: Props, b: Props): boolean =>
  a.riga === b.riga &&
  a.sez === b.sez &&
  a.indice === b.indice &&
  a.cluster === b.cluster &&
  a.rir === b.rir &&
  a.ultima === b.ultima &&
  a.dnd.draggable === b.dnd.draggable &&
  a.dnd.className === b.dnd.className &&
  a.invia === b.invia &&
  a.onRicopiata === b.onRicopiata &&
  a.onImmagine === b.onImmagine

export default memo(RigaSeduta, uguali)
