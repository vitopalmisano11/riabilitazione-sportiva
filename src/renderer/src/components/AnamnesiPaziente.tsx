import { useCallback, useEffect, useRef, useState } from 'react'
import { ClipboardList, Eye, FileClock, Pencil, Trash2 } from 'lucide-react'
import type { BodyChartRiepilogo, PazienteDettaglio, SezioneCartella } from '../../../shared/types'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import { errMsg, formatData, oggiIso } from '../lib'
import BodyChartEditor from './BodyChartEditor'
import { SagomaIcona } from './FiguraUmana'
import IconaObiettivi from './IconaObiettivi'
import AnamnesiProssima from './AnamnesiProssima'
import AnamnesiRemota from './AnamnesiRemota'
import ObiettiviTerapeutici from './ObiettiviTerapeutici'

function RigaRiassunto({
  nome,
  testo,
  onApri,
  onAnteprima
}: {
  nome: string
  testo: string
  onApri: () => void
  onAnteprima?: () => void
}): React.JSX.Element {
  return (
    <li>
      <div className="seduta-info">
        <span className="seduta-data">{nome}</span>
        <span className="seduta-meta riga-riassunto">{testo || 'Non compilata'}</span>
      </div>
      <span className="row-actions">
        {onAnteprima && testo && (
          <button
            title="Anteprima"
            aria-label={`Anteprima di ${nome}`}
            onClick={onAnteprima}
          >
            <Eye size={18} />
          </button>
        )}
        <button aria-label={`Apri ${nome}`} onClick={onApri}>
          <Pencil size={18} />
        </button>
      </span>
    </li>
  )
}

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
  const [riassunti, setRiassunti] = useState({ prossima: '', remota: '', obiettivi: '' })

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

  // Una riga di sintesi per ciascuna scheda: si legge senza aprirla.
  const caricaRiassunti = useCallback(async (): Promise<void> => {
    try {
      const [p, r, o] = await Promise.all([
        window.api.anamnesi.get(paziente.id),
        window.api.anamnesi.remota(paziente.id),
        window.api.obiettiviTerapeutici.list(paziente.id)
      ])
      const parti = (voci: [string, string | null | undefined][]): string =>
        voci
          .filter(([, v]) => v && v.trim())
          .map(([n, v]) => `${n}: ${v!.trim()}`)
          .join(' · ')
      setRiassunti({
        prossima: [
          p?.motivo_consulto?.trim(),
          p?.sintomi?.length
            ? p.sintomi.length === 1
              ? '1 sintomo'
              : `${p.sintomi.length} sintomi`
            : ''
        ]
          .filter(Boolean)
          .join(' · '),
        remota: parti([
          ['Patologie', r?.patologie],
          ['Traumi', r?.traumi],
          ['Interventi', r?.interventi],
          ['Riabilitazioni', r?.riabilitazioni]
        ]),
        obiettivi: o.map((x) => x.testo).join(' · ')
      })
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [paziente.id])

  useEffect(() => {
    void caricaRiassunti()
  }, [caricaRiassunti])

  // La riga nasce subito perche' l'editor lavora su una body chart esistente,
  // ma se si chiude senza salvare niente viene tolta: un clic per sbaglio non
  // deve lasciare schede vuote da ripulire.
  const appenaCreata = useRef<number | null>(null)

  const nuova = async (): Promise<void> => {
    try {
      const id = await window.api.bodyChart.create(paziente.id, oggiIso(), 'corpo')
      appenaCreata.current = id
      await load()
      setAperta({ id, soloLettura: false })
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // L'anteprima di una scheda e' la sua sezione della cartella, da sola.
  const anteprima = async (sezione: SezioneCartella): Promise<void> => {
    try {
      await window.api.esporta.anteprimaCartella(paziente.id, [sezione])
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
      {/* I pulsanti delle sotto-sezioni stanno sulla riga del titolo; sotto, le
          schede riassumono quello che c'e' dentro. */}
      <div className="card-header-row">
        <h3>Anamnesi</h3>
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
        <button className="btn-sagoma" title="Nuova body chart" onClick={() => void nuova()}>
          <SagomaIcona size={24} />
        </button>
        <button
          className="btn-sagoma"
          title="Obiettivi terapeutici"
          onClick={() => setObiettivi(true)}
        >
          <IconaObiettivi size={24} />
        </button>
        </div>
      </div>

      <ul className="sedute-list">
        <RigaRiassunto
          nome="Anamnesi prossima"
          testo={riassunti.prossima}
          onApri={() => setProssima(true)}
          onAnteprima={() => void anteprima('anamnesi')}
        />
        <RigaRiassunto
          nome="Anamnesi remota"
          testo={riassunti.remota}
          onApri={() => setRemota(true)}
          onAnteprima={() => void anteprima('remota')}
        />
        <RigaRiassunto
          nome="Obiettivi terapeutici"
          testo={riassunti.obiettivi}
          onApri={() => setObiettivi(true)}
          onAnteprima={() => void anteprima('obiettivi')}
        />
      </ul>

      {charts.length > 0 && (
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
        <AnamnesiProssima
          pazienteId={paziente.id}
          onChiudi={() => {
            setProssima(false)
            void caricaRiassunti()
          }}
        />
      )}

      {remota && (
        <AnamnesiRemota
          pazienteId={paziente.id}
          onChiudi={() => {
            setRemota(false)
            void caricaRiassunti()
          }}
        />
      )}

      {obiettivi && (
        <ObiettiviTerapeutici
          pazienteId={paziente.id}
          onChiudi={() => {
            setObiettivi(false)
            void caricaRiassunti()
          }}
        />
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
