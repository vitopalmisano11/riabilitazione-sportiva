import { useEffect, useMemo, useState } from 'react'
import type { Categoria, EsercizioConCategoria, EsercizioInput } from '../../../shared/types'
import { errMsg } from '../lib'

interface FormState {
  id: number | null
  nome: string
  categoria_id: number | ''
  serie_default: string
  ripetizioni_default: string
  carico_default: string
  recupero_default: string
  nota_tecnica: string
}

const FORM_VUOTO: FormState = {
  id: null,
  nome: '',
  categoria_id: '',
  serie_default: '',
  ripetizioni_default: '',
  carico_default: '',
  recupero_default: '',
  nota_tecnica: ''
}

export default function EserciziPage(): React.JSX.Element {
  const [esercizi, setEsercizi] = useState<EsercizioConCategoria[]>([])
  const [categorie, setCategorie] = useState<Categoria[]>([])
  const [mostraArchiviati, setMostraArchiviati] = useState(false)
  const [ricerca, setRicerca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<number | ''>('')
  const [form, setForm] = useState<FormState | null>(null)

  const load = async (archiviati = mostraArchiviati): Promise<void> => {
    setEsercizi(await window.api.esercizi.list(archiviati))
  }

  useEffect(() => {
    void load()
    void window.api.categorie.list().then(setCategorie)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibili = useMemo(() => {
    const q = ricerca.trim().toLowerCase()
    return esercizi.filter(
      (e) =>
        (q === '' || e.nome.toLowerCase().includes(q)) &&
        (filtroCategoria === '' || e.categoria_id === filtroCategoria)
    )
  }, [esercizi, ricerca, filtroCategoria])

  const salva = async (): Promise<void> => {
    if (!form) return
    if (!form.nome.trim()) {
      alert('Il nome è obbligatorio.')
      return
    }
    if (form.categoria_id === '') {
      alert('Seleziona una categoria.')
      return
    }
    const data: EsercizioInput = {
      nome: form.nome,
      categoria_id: form.categoria_id,
      serie_default: form.serie_default.trim() || null,
      ripetizioni_default: form.ripetizioni_default.trim() || null,
      carico_default: form.carico_default.trim() || null,
      recupero_default: form.recupero_default.trim() || null,
      nota_tecnica: form.nota_tecnica.trim() || null
    }
    try {
      if (form.id == null) await window.api.esercizi.create(data)
      else await window.api.esercizi.update(form.id, data)
      setForm(null)
      await load()
    } catch (e) {
      alert(errMsg(e))
    }
  }

  const archivia = async (e: EsercizioConCategoria): Promise<void> => {
    try {
      await window.api.esercizi.setArchiviato(e.id, e.archiviato === 0)
      await load()
    } catch (err) {
      alert(errMsg(err))
    }
  }

  const elimina = async (e: EsercizioConCategoria): Promise<void> => {
    if (!confirm(`Eliminare definitivamente "${e.nome}"?\nSe è stato usato in sedute passate, usa "Archivia".`))
      return
    try {
      await window.api.esercizi.remove(e.id)
      await load()
    } catch (err) {
      alert(errMsg(err))
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h2>Libreria esercizi</h2>
        <p>
          Libreria unica e condivisa: lo stesso esercizio è richiamabile da patologie diverse. I
          valori di default (serie/ripetizioni/carico) vengono copiati nella seduta e lì restano
          modificabili.
        </p>
      </header>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Cerca esercizio…"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
        />
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">Tutte le categorie</option>
          {categorie.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={mostraArchiviati}
            onChange={(e) => {
              setMostraArchiviati(e.target.checked)
              void load(e.target.checked)
            }}
          />
          Mostra archiviati
        </label>
        <span className="spacer" />
        <button
          className="primary"
          onClick={() => {
            if (categorie.length === 0) {
              alert('Prima crea almeno una categoria in "Categorie esercizi".')
              return
            }
            setForm(FORM_VUOTO)
          }}
        >
          + Nuovo esercizio
        </button>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Categoria</th>
            <th>Serie</th>
            <th>Ripetizioni</th>
            <th>Carico</th>
            <th>Recupero</th>
            <th>Nota tecnica</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visibili.map((e) => (
            <tr key={e.id} className={e.archiviato ? 'archiviato' : ''}>
              <td>
                {e.nome}
                {e.archiviato ? <span className="badge">archiviato</span> : null}
              </td>
              <td>{e.categoria_nome}</td>
              <td>{e.serie_default ?? '—'}</td>
              <td>{e.ripetizioni_default ?? '—'}</td>
              <td>{e.carico_default ?? '—'}</td>
              <td>{e.recupero_default ?? '—'}</td>
              <td className="nota">{e.nota_tecnica ?? ''}</td>
              <td className="row-actions">
                <button
                  onClick={() =>
                    setForm({
                      id: e.id,
                      nome: e.nome,
                      categoria_id: e.categoria_id,
                      serie_default: e.serie_default ?? '',
                      ripetizioni_default: e.ripetizioni_default ?? '',
                      carico_default: e.carico_default ?? '',
                      recupero_default: e.recupero_default ?? '',
                      nota_tecnica: e.nota_tecnica ?? ''
                    })
                  }
                >
                  Modifica
                </button>
                <button onClick={() => void archivia(e)}>
                  {e.archiviato ? 'Ripristina' : 'Archivia'}
                </button>
                <button className="danger" onClick={() => void elimina(e)}>
                  Elimina
                </button>
              </td>
            </tr>
          ))}
          {visibili.length === 0 && (
            <tr>
              <td colSpan={8} className="empty">
                Nessun esercizio. Crea le categorie, poi aggiungi qui gli esercizi.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{form.id == null ? 'Nuovo esercizio' : 'Modifica esercizio'}</h3>
            <label>
              Nome *
              <input
                autoFocus
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </label>
            <label>
              Categoria *
              <select
                value={form.categoria_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    categoria_id: e.target.value === '' ? '' : Number(e.target.value)
                  })
                }
              >
                <option value="">— seleziona —</option>
                {categorie.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Serie (default)
                <input
                  value={form.serie_default}
                  placeholder="es. 3"
                  onChange={(e) => setForm({ ...form, serie_default: e.target.value })}
                />
              </label>
              <label>
                Ripetizioni (default)
                <input
                  value={form.ripetizioni_default}
                  placeholder="es. 10, oppure 30 sec"
                  onChange={(e) => setForm({ ...form, ripetizioni_default: e.target.value })}
                />
              </label>
              <label>
                Carico (default)
                <input
                  value={form.carico_default}
                  placeholder="es. 10 kg, elastico verde"
                  onChange={(e) => setForm({ ...form, carico_default: e.target.value })}
                />
              </label>
              <label>
                Recupero (default)
                <input
                  value={form.recupero_default}
                  placeholder="es. 1 min, 90 sec"
                  onChange={(e) => setForm({ ...form, recupero_default: e.target.value })}
                />
              </label>
            </div>
            <label>
              Nota tecnica
              <textarea
                rows={3}
                value={form.nota_tecnica}
                placeholder="Indicazioni sul gesto tecnico, precauzioni…"
                onChange={(e) => setForm({ ...form, nota_tecnica: e.target.value })}
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => setForm(null)}>Annulla</button>
              <button className="primary" onClick={() => void salva()}>
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
