import { useEffect, useMemo, useState } from 'react'
import type { AnteprimaPedana } from '../../../../shared/pedana'
import type { PazienteCreateInput } from '../../../../shared/types'
import { toast, toastErrore } from '../Toast'
import Modale from '../Modale'
import { useScorciatoie } from '../../scorciatoie'
import SceltaConRicerca, { type VoceScelta } from '../SceltaConRicerca'
import { errMsg, formatData } from '../../lib'

export interface PazienteCorrente {
  id: number
  nome: string
  cognome: string
}

// Una scelta del paziente: uno dell'elenco, o uno nuovo da creare.
type Scelta =
  { tipo: 'esistente'; id: number } | { tipo: 'nuovo' } | { tipo: 'altro'; id: number | '' }

// Il nome scritto nell'app della pedana non dice quale parola e' il cognome:
// si propone "prima parola = nome, il resto = cognome" e si lascia correggere.
function dividiNome(completo: string | null): { cognome: string; nome: string } {
  const parole = (completo ?? '').trim().split(/\s+/).filter(Boolean)
  if (parole.length < 2) return { cognome: parole[0] ?? '', nome: '' }
  return { nome: parole[0], cognome: parole.slice(1).join(' ') }
}

// La finestra che mostra cosa c'e' nel file della pedana prima di importarlo.
// Il paziente non si abbina da solo: si propone chi ha un nome somigliante e
// si conferma, o si sceglie un altro, o se ne crea uno nuovo. Nulla e' scritto
// finche' non si preme "Importa": chiudere la finestra scarta il file.
export default function ImportaPedana({
  anteprima,
  pazienteCorrente,
  onFinito
}: {
  anteprima: AnteprimaPedana
  // se si importa dalla scheda di un paziente, e' lui il suggerimento
  pazienteCorrente: PazienteCorrente | null
  // chiamato a finestra chiusa: l'id del paziente in cui si e' importato, o null
  onFinito: (importatoIn: number | null) => void
}): React.JSX.Element {
  const [scelta, setScelta] = useState<Scelta>(() =>
    anteprima.proposto !== null ? { tipo: 'esistente', id: anteprima.proposto } : { tipo: 'nuovo' }
  )
  const [nuovo, setNuovo] = useState(() => dividiNome(anteprima.paziente_nome_file))
  const [elenco, setElenco] = useState<VoceScelta[] | null>(null)
  const [giaImportate, setGiaImportate] = useState<Set<string>>(
    () => new Set(anteprima.registrazioni.filter((r) => r.gia_importata).map((r) => r.id))
  )
  const [scelte, setScelte] = useState<Set<string>>(
    () => new Set(anteprima.registrazioni.filter((r) => !r.gia_importata).map((r) => r.id))
  )
  const [inCorso, setInCorso] = useState(false)

  // Le voci proposte: chi ha il nome somigliante, e il paziente da cui si e'
  // partiti se non e' gia' fra questi.
  const proposte = useMemo(() => {
    const voci = anteprima.candidati.map((c) => ({
      id: c.id,
      etichetta: `${c.cognome} ${c.nome}`,
      nota: c.somiglianza >= 1 ? 'stesso nome' : 'nome simile'
    }))
    if (pazienteCorrente && !voci.some((v) => v.id === pazienteCorrente.id)) {
      voci.unshift({
        id: pazienteCorrente.id,
        etichetta: `${pazienteCorrente.cognome} ${pazienteCorrente.nome}`,
        nota: 'il paziente aperto'
      })
    }
    return voci
  }, [anteprima.candidati, pazienteCorrente])

  // L'elenco di tutti i pazienti serve solo se si sceglie "un altro".
  useEffect(() => {
    if (scelta.tipo !== 'altro' || elenco !== null) return
    window.api.pazienti
      .list()
      .then((righe) => setElenco(righe.map((p) => ({ id: p.id, nome: `${p.cognome} ${p.nome}` }))))
      .catch((e) => toastErrore(errMsg(e)))
  }, [scelta.tipo, elenco])

  const idScelto =
    scelta.tipo === 'esistente' ? scelta.id : scelta.tipo === 'altro' ? scelta.id : null

  // Cambiando paziente cambia quello che ha gia': le sue registrazioni non si
  // importano di nuovo.
  const cambiaPaziente = (id: number): void => {
    window.api.pedana
      .giaImportate(anteprima.token, id)
      .then((ids) => {
        const dentro = new Set(ids)
        setGiaImportate(dentro)
        setScelte(
          new Set(anteprima.registrazioni.filter((r) => !dentro.has(r.id)).map((r) => r.id))
        )
      })
      .catch((e) => toastErrore(errMsg(e)))
  }

  const annulla = (): void => {
    void window.api.pedana.annulla(anteprima.token).catch(() => undefined)
    onFinito(null)
  }

  // Esc scarta il file, come "Annulla"
  useScorciatoie([{ tasto: 'Escape', azione: annulla }])

  const nuovoValido = nuovo.cognome.trim() !== '' || nuovo.nome.trim() !== ''
  const pronto =
    scelte.size > 0 &&
    !inCorso &&
    (scelta.tipo === 'nuovo' ? nuovoValido : idScelto !== null && idScelto !== '')

  const importa = async (): Promise<void> => {
    if (!pronto) return
    setInCorso(true)
    try {
      let pazienteId = idScelto as number
      if (scelta.tipo === 'nuovo') {
        pazienteId = await window.api.pazienti.create({
          nome: nuovo.nome.trim(),
          cognome: nuovo.cognome.trim(),
          data_nascita: null,
          codice_fiscale: null,
          telefono: null,
          email: null,
          lavoro: null,
          inviato_da: null,
          sport: null,
          diagnosi: null,
          tipo_intervento: null,
          data_intervento: null,
          precauzioni: null,
          arto_operato: null,
          gruppo_id: null,
          patologia_id: null,
          fase_corrente_id: null
        } satisfies PazienteCreateInput)
      }
      const esito = await window.api.pedana.importa(pazienteId, anteprima.token, [...scelte])
      const aggiunte =
        esito.importate === 1 ? 'Importato 1 test' : `Importati ${esito.importate} test`
      toast(
        esito.saltate > 0
          ? `${aggiunte}; ${esito.saltate} ${esito.saltate === 1 ? 'era già presente e non è stato aggiunto' : 'erano già presenti e non sono stati aggiunti'}.`
          : `${aggiunte}.`
      )
      onFinito(pazienteId)
    } catch (e) {
      toastErrore(errMsg(e))
      setInCorso(false)
    }
  }

  const cambiaRegistrazione = (id: string, acceso: boolean): void => {
    const copia = new Set(scelte)
    if (acceso) copia.add(id)
    else copia.delete(id)
    setScelte(copia)
  }

  const dispositivo = [anteprima.dispositivo.tipo, anteprima.dispositivo.modello]
    .filter(Boolean)
    .join(' · ')

  // Invio e clic fuori non fanno niente: importare scrive nell'archivio, e un
  // clic distratto non deve bastare. Si importa col pulsante.
  return (
    <Modale className="modal-lg" onConferma={() => undefined}>
      <h3>Importa dalla pedana</h3>
      <p className="hint">
        {anteprima.nome_file}
        {dispositivo && ` — ${dispositivo}`}
        {anteprima.app && ` — ${anteprima.app}`}
      </p>

      <div className="sotto-titolo">Di chi è</div>
      <p className="hint">
        Nel file il paziente si chiama «{anteprima.paziente_nome_file ?? 'senza nome'}». Scegli a
        quale paziente del gestionale appartiene.
      </p>
      <div className="scelta-paziente-pedana">
        {proposte.map((p) => (
          <label key={p.id} className="checkbox-inline">
            <input
              type="radio"
              name="paziente-pedana"
              checked={scelta.tipo === 'esistente' && scelta.id === p.id}
              onChange={() => {
                setScelta({ tipo: 'esistente', id: p.id })
                cambiaPaziente(p.id)
              }}
            />
            {p.etichetta} <span className="hint">({p.nota})</span>
          </label>
        ))}
        {proposte.length === 0 && (
          <p className="hint esito-attenzione">Nessun paziente con un nome simile.</p>
        )}
        <label className="checkbox-inline">
          <input
            type="radio"
            name="paziente-pedana"
            checked={scelta.tipo === 'altro'}
            onChange={() => setScelta({ tipo: 'altro', id: '' })}
          />
          Un altro paziente
        </label>
        {scelta.tipo === 'altro' && (
          <SceltaConRicerca
            voci={elenco ?? []}
            valore={scelta.id}
            segnaposto="— scegli il paziente —"
            onCambia={(id) => {
              setScelta({ tipo: 'altro', id })
              if (id !== '') cambiaPaziente(id)
            }}
          />
        )}
        <label className="checkbox-inline">
          <input
            type="radio"
            name="paziente-pedana"
            checked={scelta.tipo === 'nuovo'}
            onChange={() => {
              setScelta({ tipo: 'nuovo' })
              setGiaImportate(new Set())
              setScelte(new Set(anteprima.registrazioni.map((r) => r.id)))
            }}
          />
          Un paziente nuovo
        </label>
        {scelta.tipo === 'nuovo' && (
          <div className="form-row-2">
            <label>
              Cognome
              <input
                value={nuovo.cognome}
                onChange={(e) => setNuovo({ ...nuovo, cognome: e.target.value })}
              />
            </label>
            <label>
              Nome
              <input
                value={nuovo.nome}
                onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })}
              />
            </label>
          </div>
        )}
      </div>

      <div className="sotto-titolo">Cosa importare</div>
      <ul className="sedute-list elenco-import-pedana">
        {anteprima.registrazioni.map((r) => (
          <li key={r.id}>
            <label className="checkbox-inline">
              <input
                type="checkbox"
                checked={scelte.has(r.id)}
                disabled={giaImportate.has(r.id)}
                onChange={(e) => cambiaRegistrazione(r.id, e.target.checked)}
              />
              <span className="seduta-data">
                {formatData(r.data)}
                {r.ora ? ` ${r.ora}` : ''}
              </span>
              <span className="seduta-meta">
                {r.test_nome}
                {r.lato && ` — ${r.lato === 'dx' ? 'destro' : 'sinistro'}`}
                {` — ${r.num_valori} ${r.num_valori === 1 ? 'valore' : 'valori'}`}
              </span>
            </label>
            {giaImportate.has(r.id) && <span className="badge">già importato</span>}
            {r.ha_serie && !giaImportate.has(r.id) && <span className="badge">con grafico</span>}
            {r.avvertenze.map((a) => (
              <span key={a} className="hint esito-attenzione">
                {a}
              </span>
            ))}
          </li>
        ))}
      </ul>

      <div className="modal-actions">
        <button onClick={annulla}>Annulla</button>
        <button className="primary" disabled={!pronto} onClick={() => void importa()}>
          Importa{scelte.size > 0 ? ` (${scelte.size})` : ''}
        </button>
      </div>
    </Modale>
  )
}
