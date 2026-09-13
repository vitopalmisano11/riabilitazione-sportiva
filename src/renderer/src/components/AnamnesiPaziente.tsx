import { useCallback, useEffect, useRef, useState } from 'react'
import { ClipboardList, Eye, FileClock, Pencil, Trash2 } from 'lucide-react'
import type { BodyChartRiepilogo, PazienteDettaglio, TipoChart } from '../../../shared/types'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import { errMsg, formatData, oggiIso } from '../lib'
import BodyChartEditor from './BodyChartEditor'
import { SagomaIcona } from './FiguraUmana'
import IconaObiettivi from './IconaObiettivi'
import AnamnesiProssima from './AnamnesiProssima'
import AnamnesiRemota from './AnamnesiRemota'
import ObiettiviTerapeutici from './ObiettiviTerapeutici'

// Raccolta anamnestica. Ogni parte si compila per conto suo, in qualunque
// ordine: non c'e' una sequenza obbligata da seguire durante il colloquio.
export default function AnamnesiPaziente({
  paziente
}: {
  paziente: PazienteDettaglio
}): React.JSX.Element {
  const [charts, setCharts] = useState<BodyChartRiepilogo[]>([])
  const [aperta, setAperta] = useState<{ id: number; soloLettura: boolean } | null>(null)
  const [prossima, setProssima] = useState(false)
  const [remota, setRemota] = useState(false)
  const [obiettivi, setObiettivi] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    try {
      setCharts(await window.api.bodyChart.list(paziente.id))
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [paziente.id])

  useEffect(() => {
    void load()
  }, [load])

  // La riga nasce subito perche' l'editor lavora su una body chart esistente,
  // ma se si chiude senza salvare niente viene tolta: un clic per sbaglio non
  // deve lasciare schede vuote da ripulire.
  const appenaCreata = useRef<number | null>(null)
  const [menuNuova, setMenuNuova] = useState(false)

  const nuova = async (tipo: TipoChart): Promise<void> => {
    setMenuNuova(false)
    try {
      const id = await window.api.bodyChart.create(paziente.id, oggiIso(), tipo)
      appenaCreata.current = id
      await load()
      setAperta({ id, soloLettura: false })
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const elimina = async (c: BodyChartRiepilogo): Promise<void> => {
    if (!(await chiedi(`Eliminare la body chart del ${formatData(c.data)}?`))) return
    try {
      await window.api.bodyChart.remove(c.id)
      await load()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <section className="card">
      <h3>Anamnesi</h3>

      {/* Le sotto-sezioni stanno affiancate sotto al titolo: body chart ora,
          poi anamnesi prossima, remota e informazioni cliniche complementari. */}
      <div className="sotto-sezioni">
        <button
          className="btn-sagoma"
          title="Anamnesi prossima"
          onClick={() => setProssima(true)}
        >
          <ClipboardList size={24} />
        </button>
        <button className="btn-sagoma" title="Anamnesi remota" onClick={() => setRemota(true)}>
          {/* Una cartella con l'orologio: sono i fatti clinici di prima, non
              una cronologia di modifiche come diceva la freccia all'indietro. */}
          <FileClock size={24} />
        </button>
        {/* Le body chart sono piu' d'una: il corpo intero per il quadro
            generale, il piede quando il problema e' li' e serve segnare in
            piccolo. Si sceglie qui, perche' cambia le figure su cui si segna. */}
        <span className="menu-wrapper">
          <button
            className="btn-sagoma"
            title="Nuova body chart"
            onClick={() => setMenuNuova(!menuNuova)}
          >
            <SagomaIcona size={24} />
          </button>
          {menuNuova && (
            <>
              <div className="menu-chiudi" onClick={() => setMenuNuova(false)} />
              <div className="menu-tendina">
                <button onClick={() => void nuova('corpo')}>Corpo intero</button>
                <button onClick={() => void nuova('piede')}>Piede e caviglia</button>
              </div>
            </>
          )}
        </span>
        <button
          className="btn-sagoma"
          title="Obiettivi terapeutici"
          onClick={() => setObiettivi(true)}
        >
          <IconaObiettivi size={24} />
        </button>
      </div>
      {charts.length === 0 ? (
        <p className="hint">
          Nessuna body chart. Creane una per segnare dove e come il paziente sente il dolore; le
          successive restano in elenco per confrontare com&apos;è cambiato.
        </p>
      ) : (
        <ul className="sedute-list">
          {charts.map((c) => (
            <li key={c.id}>
              <div className="seduta-info">
                <span className="seduta-data">
                  {c.tipo === 'piede' ? 'Body chart piede' : 'Body chart'} · {formatData(c.data)}
                </span>
                <span className="seduta-meta">
                  {c.num_segni === 1 ? '1 segno' : `${c.num_segni} segni`}
                </span>
                {c.note && <span className="seduta-obiettivi">{c.note}</span>}
              </div>
              <span className="row-actions">
                <button
                  title="Anteprima"
                  onClick={() => setAperta({ id: c.id, soloLettura: true })}
                >
                  <Eye size={18} />
                </button>
                <button
                  title="Modifica"
                  onClick={() => setAperta({ id: c.id, soloLettura: false })}
                >
                  <Pencil size={18} />
                </button>
                <button className="danger" title="Elimina" onClick={() => void elimina(c)}>
                  <Trash2 size={18} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {prossima && (
        <AnamnesiProssima pazienteId={paziente.id} onChiudi={() => setProssima(false)} />
      )}

      {remota && <AnamnesiRemota pazienteId={paziente.id} onChiudi={() => setRemota(false)} />}

      {obiettivi && (
        <ObiettiviTerapeutici pazienteId={paziente.id} onChiudi={() => setObiettivi(false)} />
      )}

      {aperta && (
        <BodyChartEditor
          key={aperta.id}
          chartId={aperta.id}
          soloLettura={aperta.soloLettura}
          onChiudi={(salvata) => {
            const daTogliere = !salvata ? appenaCreata.current : null
            appenaCreata.current = null
            setAperta(null)
            if (daTogliere != null) {
              void window.api.bodyChart.remove(daTogliere).then(load)
            } else if (salvata) {
              void load()
            }
          }}
        />
      )}
    </section>
  )
}
