import { useState } from 'react'
import { ImageIcon, Pencil, Plus, Video, X } from 'lucide-react'
import type { Categoria, EsercizioConCategoria, StatoProgressione, UltimaVolta } from '../../../../shared/types'
import type { Riordino } from '../../riordino'
import { volumeTesto } from '../../../../shared/dosaggio'
import { errMsg } from '../../lib'
import { chiedi } from '../Conferma'
import { toast, toastErrore } from '../Toast'
import Aiuto from '../Aiuto'
import RigaSeduta from './RigaSeduta'
import SuggerimentiProgressioni from './SuggerimentiProgressioni'
import {
  daProporre,
  mostraCluster,
  mostraRir,
  testoUltima,
  type AzioneSezioni,
  type SezioneBuilder
} from './modello'

interface Props {
  sezione: SezioneBuilder
  indice: number
  categorie: Categoria[]
  templateCats: Record<number, number[]>
  libreria: EsercizioConCategoria[]
  ultime: Record<number, UltimaVolta>
  ricopiate: string[]
  // le progressioni della fase con lo step del paziente, e gli esercizi gia'
  // messi in seduta (in qualunque sezione)
  progressioni: StatoProgressione[]
  inSeduta: Set<number>
  onSpecchietto: () => void
  // la ricerca degli esercizi e' aperta in questa sezione (una per volta)
  aperta: boolean
  onApri: (indice: number | null) => void
  riordinoSezioni: Riordino<number>
  riordinoRighe: Riordino<string>
  invia: (a: AzioneSezioni) => void
  nuovaChiaveVolo: () => number
  onRicopiata: (chiave: string) => void
  onImmagine: (esercizio: { id: number; nome: string }) => void
}

// Una sezione della seduta: il titolo con i suoi comandi, gli esercizi, e la
// ricerca per aggiungerne quando la si apre.
export default function SezioneSeduta({
  sezione: s,
  indice: idxSez,
  categorie,
  templateCats,
  libreria,
  ultime,
  ricopiate,
  progressioni,
  inSeduta,
  onSpecchietto,
  aperta,
  onApri,
  riordinoSezioni,
  riordinoRighe,
  invia,
  nuovaChiaveVolo,
  onRicopiata,
  onImmagine
}: Props): React.JSX.Element {
  // window.prompt non è supportato in Electron: la sezione si rinomina sul posto
  const [nomeInModifica, setNomeInModifica] = useState<string | null>(null)
  const [ricerca, setRicerca] = useState('')

  const rinomina = (): void => {
    if (nomeInModifica?.trim()) invia({ tipo: 'rinomina', sez: idxSez, nome: nomeInModifica })
    setNomeInModifica(null)
  }

  const rimuovi = async (): Promise<void> => {
    if (
      s.righe.length > 0 &&
      !(await chiedi(`Rimuovere la sezione "${s.nome}" e i suoi ${s.righe.length} esercizi da questa seduta?`))
    ) {
      return
    }
    invia({ tipo: 'togliSezione', sez: idxSez })
    toast(`Sezione "${s.nome}" tolta. Ctrl+Z per rimetterla.`)
  }

  const testoRicerca = ricerca.trim()
  const nomeCategoria = (cid: number): string => categorie.find((c) => c.id === cid)?.nome ?? '?'
  const dndSez = riordinoSezioni.contenitore(idxSez)

  return (
    <section
      {...dndSez}
      {...riordinoSezioni.presa(idxSez)}
      className={['card sezione-card', dndSez.className].filter(Boolean).join(' ')}
    >
      <div className="sezione-testata">
        {nomeInModifica != null ? (
          <span className="edit-row">
            <input
              autoFocus
              value={nomeInModifica}
              onChange={(e) => setNomeInModifica(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nomeInModifica.trim()) rinomina()
                if (e.key === 'Escape') setNomeInModifica(null)
              }}
            />
            <button onClick={rinomina}>OK</button>
          </span>
        ) : (
          <h3>{s.nome}</h3>
        )}
        <span className="item-actions-static">
          <button
            className="btn-aggiungi-sezione"
            title="Aggiungi un esercizio a questa sezione"
            onClick={() => onApri(idxSez)}
          >
            <Plus size={16} /> Esercizio
          </button>
          <button title="Rinomina" onClick={() => setNomeInModifica(s.nome)}>
            <Pencil size={16} />
          </button>
          <button title="Rimuovi sezione" className="danger" onClick={() => void rimuovi()}>
            <X size={16} />
          </button>
        </span>
      </div>

      {s.righe.length > 0 && (
        <ul className="righe-seduta">
          {s.righe.map((r, idxRiga) => {
            const chiave = `${idxSez}:${idxRiga}`
            const id = r.esercizio_id
            const ultima =
              id != null &&
              ultime[id] &&
              !ricopiate.includes(`${idxSez}:${id}`) &&
              testoUltima(r, ultime[id]) !== ''
                ? ultime[id]
                : undefined
            // Gli esercizi della stessa categoria restano vicini perche' e' li'
            // che vengono inseriti, ma senza scriverne il nome: con categorie
            // fini le intestazioni erano piu' delle righe.
            return (
              <RigaSeduta
                key={r.esercizio_id ?? r.chiaveVolo}
                riga={r}
                sez={idxSez}
                indice={idxRiga}
                cluster={mostraCluster(r, categorie)}
                rir={mostraRir(r, categorie)}
                ultima={ultima}
                dnd={riordinoRighe.contenitore(chiave)}
                presa={riordinoRighe.presa(chiave)}
                invia={invia}
                onRicopiata={onRicopiata}
                onImmagine={onImmagine}
              />
            )
          })}
        </ul>
      )}

      {/* Le proposte si calcolano solo per la sezione aperta: prima si
          filtrava tutta la libreria per ogni sezione a ogni lettera scritta. */}
      {aperta && (
        <div className="aggiungi-area">
          <div className="testata-aggiungi">
            <span className="hint">
              Scegli un esercizio da aggiungere a “{s.nome}”
              <Aiuto testo="Non trovi l'esercizio che ti serve? Scrivi il suo nome nella casella e aggiungilo con il pulsante che compare sotto: resta solo per questa seduta, senza salvarlo in libreria." />
            </span>
            <button title="Chiudi" onClick={() => onApri(null)}>
              <X size={16} />
            </button>
          </div>
          <input
            autoFocus
            type="search"
            className="filtro-esercizi"
            placeholder={
              s.sezione_id != null
                ? 'Filtra i proposti o cerca in tutta la libreria…'
                : 'Cerca un esercizio nella libreria (min 2 lettere)…'
            }
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />
          {/* L'esercizio "al volo": una variante scritta li' per li', che non
              e' in libreria e non ci finisce nemmeno lei. Si propone se quello
              che hai scritto non e' gia' il nome di un esercizio della libreria. */}
          {testoRicerca !== '' && !libreria.some((e) => e.nome.toLowerCase() === testoRicerca.toLowerCase()) && (
            <button
              className="btn-al-volo"
              onClick={() => {
                invia({ tipo: 'alVolo', sez: idxSez, nome: testoRicerca, chiave: nuovaChiaveVolo() })
                setRicerca('')
              }}
            >
              <Plus size={16} /> Aggiungi «{testoRicerca}» come esercizio solo per questa seduta
            </button>
          )}
          {/* Cercando per nome i suggerimenti si tolgono di mezzo: chi scrive
              sa gia' cosa vuole. */}
          {testoRicerca.length < 2 && (
            <SuggerimentiProgressioni
              stati={progressioni}
              libreria={libreria}
              inSeduta={inSeduta}
              onAggiungi={(e) => invia({ tipo: 'aggiungi', sez: idxSez, esercizio: e })}
              onSpecchietto={onSpecchietto}
            />
          )}
          <ElencoProposte
            esercizi={daProporre(s, ricerca, templateCats, categorie, libreria)}
            nomeCategoria={nomeCategoria}
            onAggiungi={(e) => invia({ tipo: 'aggiungi', sez: idxSez, esercizio: e })}
            onImmagine={onImmagine}
          />
        </div>
      )}
    </section>
  )
}

function ElencoProposte({
  esercizi,
  nomeCategoria,
  onAggiungi,
  onImmagine
}: {
  esercizi: EsercizioConCategoria[]
  nomeCategoria: (id: number) => string
  onAggiungi: (e: EsercizioConCategoria) => void
  onImmagine: (esercizio: { id: number; nome: string }) => void
}): React.JSX.Element | null {
  if (esercizi.length === 0) return null
  return (
    <ul className="esercizi-proposti">
      {esercizi.map((e) => (
        <li key={e.id}>
          {/* Prima stava in fondo alla riga, e con i nomi lunghi finiva
              lontanissimo da quello che si stava leggendo. */}
          <button className="btn-aggiungi-riga" title={`Aggiungi ${e.nome}`} onClick={() => onAggiungi(e)}>
            <Plus size={16} />
          </button>
          <span className="item-nome">
            {e.nome}
            {e.link && (
              <button
                className="icona-esercizio"
                title="Apri video"
                onClick={(ev) => {
                  ev.stopPropagation()
                  window.api.apriLink(e.link!).catch((err) => toastErrore(errMsg(err)))
                }}
              >
                <Video size={16} />
              </button>
            )}
            {e.ha_immagine === 1 && (
              <button
                className="icona-esercizio"
                title="Vedi immagine"
                onClick={(ev) => {
                  ev.stopPropagation()
                  onImmagine({ id: e.id, nome: e.nome })
                }}
              >
                <ImageIcon size={16} />
              </button>
            )}
          </span>
          <span className="default-hint">
            {[
              nomeCategoria(e.categoria_id),
              volumeTesto({ serie: e.serie_default, cluster: e.cluster_default, ripetizioni: e.ripetizioni_default }) ??
                ''
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </li>
      ))}
    </ul>
  )
}
