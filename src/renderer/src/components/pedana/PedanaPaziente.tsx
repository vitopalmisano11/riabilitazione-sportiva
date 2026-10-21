import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ChevronRight, FileText, Trash2, Upload } from 'lucide-react'
import type { PazienteDettaglio } from '../../../../shared/types'
import {
  riepilogoPedana,
  type AnteprimaPedana,
  type ArchivioPedana,
  type GiornoPedana,
  type GruppoPedana,
  type LatoPedana
} from '../../../../shared/pedana'
import Aiuto from '../Aiuto'
import { toastErrore } from '../Toast'
import { chiedi } from '../Conferma'
import { errMsg, formatData } from '../../lib'
import DettaglioPedana, { dataDellaRiga } from './DettaglioPedana'
import ImportaPedana from './ImportaPedana'
import ReportPedana, { type VocePedana } from './ReportPedana'

const chiaveVoce = (g: GruppoPedana, r: GiornoPedana): string =>
  `${g.chiave}|${r.test.map((t) => t.id).join(',')}`

// "destro e sinistro", "destro", "sinistro" o niente (test bilaterali).
function latiDi(r: GiornoPedana): string {
  const lati = new Set(r.test.map((t) => t.lato))
  if (lati.has('dx') && lati.has('sx')) return 'destro e sinistro'
  if (lati.has('dx')) return 'destro'
  if (lati.has('sx')) return 'sinistro'
  return ''
}

// I test fatti con la pedana di forza: importati dal file dell'app della
// pedana, uno storico per test con il confronto fra i due lati e nel tempo.
export default function PedanaPaziente({
  paziente
}: {
  paziente: PazienteDettaglio
}): React.JSX.Element {
  const [archivio, setArchivio] = useState<ArchivioPedana | null>(null)
  const [anteprima, setAnteprima] = useState<AnteprimaPedana | null>(null)
  const [aperta, setAperta] = useState<string | null>(null)
  const [reportAperto, setReportAperto] = useState(false)

  const carica = useCallback((): void => {
    window.api.pedana
      .archivio(paziente.id)
      .then(setArchivio)
      .catch((e) => toastErrore(errMsg(e)))
  }, [paziente.id])

  useEffect(carica, [carica])

  const scegliFile = async (): Promise<void> => {
    try {
      const a = await window.api.pedana.scegliFile(paziente.id)
      if (a) setAnteprima(a)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const elimina = async (v: VocePedana): Promise<void> => {
    const quanti = v.giorno.test.length
    if (
      !(await chiedi({
        titolo: 'Eliminare questo test?',
        testo: `${v.gruppo.nome} del ${formatData(v.giorno.data)}${quanti > 1 ? ` (${quanti} registrazioni)` : ''} sparisce dall'archivio. Si può importare di nuovo dal file della pedana.`,
        conferma: 'Elimina'
      }))
    ) {
      return
    }
    try {
      for (const t of v.giorno.test) await window.api.pedana.remove(t.id)
      setAperta(null)
      carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const cambiaLato = async (chiave: string, lato: LatoPedana | null): Promise<void> => {
    try {
      await window.api.pedana.setLatoInteressato(paziente.id, chiave, lato)
      carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const gruppi = archivio ? riepilogoPedana(archivio) : []
  // dal test piu' recente al piu' vecchio, tutti insieme
  const voci: VocePedana[] = gruppi
    .flatMap((g) => g.giorni.map((r) => ({ chiave: chiaveVoce(g, r), gruppo: g, giorno: r })))
    .sort(
      (a, b) =>
        b.giorno.data.localeCompare(a.giorno.data) || a.gruppo.nome.localeCompare(b.gruppo.nome)
    )
  const voceAperta = voci.find((v) => v.chiave === aperta) ?? null

  return (
    <section className="card">
      <div className="card-header-row">
        <h3>
          Test con pedana
          <Aiuto testo="I test fatti con la pedana di forza, importati dal file che esporta l'app della pedana. Ogni riga è un test: clicca per aprirlo e vedere il risultato, tutte le misure, i grafici, come è stato fatto e come cambia nel tempo. Una destra e una sinistra fatte a meno di una settimana di distanza stanno nella stessa riga. Il lato interessato (per l'LSI) è l'arto operato della scheda del paziente, ma lo puoi cambiare solo per un test dentro la finestra del test." />
        </h3>
        <span className="row-actions">
          <button
            title="Report dei test scelti, singolo o a confronto"
            disabled={voci.length === 0}
            onClick={() => setReportAperto(true)}
          >
            <FileText size={18} /> Report
          </button>
          <button
            className="primary"
            title="Importa dal file della pedana"
            onClick={() => void scegliFile()}
          >
            <Upload size={18} /> Importa
          </button>
        </span>
      </div>

      {archivio && voci.length === 0 && (
        <p className="hint">
          Nessun test della pedana per questo paziente. Esporta il file dall&apos;app della pedana e
          importalo qui.
        </p>
      )}

      {voci.length > 0 && (
        <ul className="sedute-list elenco-pedana">
          {voci.map((v) => {
            const lati = latiDi(v.giorno)
            return (
              <li key={v.chiave}>
                <button className="riga-pedana" onClick={() => setAperta(v.chiave)}>
                  <span className="seduta-data">{dataDellaRiga(v.giorno)}</span>
                  <span className="nome-test-pedana">
                    {v.gruppo.nome}
                    {lati && <span className="seduta-meta"> — {lati}</span>}
                  </span>
                  {v.giorno.avvertenze.length > 0 && (
                    <span className="avviso-riga-pedana" title={v.giorno.avvertenze.join(' · ')}>
                      <AlertTriangle size={15} />
                    </span>
                  )}
                  <ChevronRight size={16} />
                </button>
                <button
                  className="danger"
                  title="Elimina questo test"
                  onClick={() => void elimina(v)}
                >
                  <Trash2 size={18} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {voceAperta && archivio && (
        <DettaglioPedana
          gruppo={voceAperta.gruppo}
          giorno={voceAperta.giorno}
          armoOperato={archivio.arto_operato}
          onLato={(l: LatoPedana | null) => void cambiaLato(voceAperta.gruppo.chiave, l)}
          onElimina={() => void elimina(voceAperta)}
          onChiudi={() => setAperta(null)}
        />
      )}

      {reportAperto && (
        <ReportPedana
          pazienteId={paziente.id}
          voci={voci}
          onChiudi={() => setReportAperto(false)}
        />
      )}

      {anteprima && (
        <ImportaPedana
          anteprima={anteprima}
          pazienteCorrente={{ id: paziente.id, nome: paziente.nome, cognome: paziente.cognome }}
          onFinito={(importatoIn) => {
            setAnteprima(null)
            // se si e' importato in un altro paziente la pagina qui non cambia
            if (importatoIn === paziente.id) carica()
          }}
        />
      )}
    </section>
  )
}
