import { useCallback, useEffect, useState } from 'react'
import type { Categoria, Fase, Obiettivo, Patologia } from '../../../shared/types'
import CrudList from '../components/CrudList'
import { errMsg } from '../lib'

export default function PatologiePage(): React.JSX.Element {
  const [patologie, setPatologie] = useState<Patologia[]>([])
  const [selPat, setSelPat] = useState<number | null>(null)

  const [fasi, setFasi] = useState<Fase[]>([])
  const [selFase, setSelFase] = useState<number | null>(null)

  const [obiettivi, setObiettivi] = useState<Obiettivo[]>([])
  const [selOb, setSelOb] = useState<number | null>(null)

  const [categorie, setCategorie] = useState<Categoria[]>([])
  const [obCats, setObCats] = useState<number[]>([])

  const loadPatologie = useCallback(
    (): Promise<void> => window.api.patologie.list().then(setPatologie),
    []
  )
  const loadFasi = useCallback((): Promise<void> => {
    if (selPat == null) {
      setFasi([])
      return Promise.resolve()
    }
    return window.api.fasi.list(selPat).then(setFasi)
  }, [selPat])
  const loadObiettivi = useCallback((): Promise<void> => {
    if (selFase == null) {
      setObiettivi([])
      return Promise.resolve()
    }
    return window.api.obiettivi.list(selFase).then(setObiettivi)
  }, [selFase])
  const loadObCats = useCallback((): Promise<void> => {
    if (selOb == null) {
      setObCats([])
      return Promise.resolve()
    }
    return window.api.obiettivi.categorie(selOb).then(setObCats)
  }, [selOb])

  useEffect(() => {
    void loadPatologie()
    void window.api.categorie.list().then(setCategorie)
  }, [loadPatologie])

  useEffect(() => {
    setSelFase(null)
    void loadFasi()
  }, [selPat, loadFasi])

  useEffect(() => {
    setSelOb(null)
    void loadObiettivi()
  }, [selFase, loadObiettivi])

  useEffect(() => {
    void loadObCats()
  }, [selOb, loadObCats])

  const toggleCat = async (categoriaId: number, attiva: boolean): Promise<void> => {
    if (selOb == null) return
    try {
      await window.api.obiettivi.setCategoria(selOb, categoriaId, attiva)
      await loadObCats()
    } catch (e) {
      alert(errMsg(e))
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h2>Patologie e fasi</h2>
        <p>
          Qui definisci i template: per ogni patologia le sue fasi (in ordine), per ogni fase gli
          obiettivi, e per ogni obiettivo le categorie di esercizi da proporre durante la seduta.
        </p>
      </header>
      <div className="columns-4">
        <CrudList
          title="Patologie"
          items={patologie}
          selectedId={selPat}
          onSelect={setSelPat}
          onAdd={async (n) => {
            await window.api.patologie.create(n)
            await loadPatologie()
          }}
          onRename={async (id, n) => {
            await window.api.patologie.update(id, n)
            await loadPatologie()
          }}
          onDelete={async (id) => {
            await window.api.patologie.remove(id)
            if (selPat === id) setSelPat(null)
            await loadPatologie()
          }}
          addPlaceholder="Nuova patologia…"
          emptyHint="Es. Ricostruzione LCA"
        />

        {selPat != null ? (
          <CrudList
            title="Fasi"
            items={fasi}
            selectedId={selFase}
            onSelect={setSelFase}
            onAdd={async (n) => {
              await window.api.fasi.create(selPat, n)
              await loadFasi()
            }}
            onRename={async (id, n) => {
              await window.api.fasi.update(id, n)
              await loadFasi()
            }}
            onDelete={async (id) => {
              await window.api.fasi.remove(id)
              if (selFase === id) setSelFase(null)
              await loadFasi()
            }}
            onReorder={async (ids) => {
              await window.api.fasi.reorder(ids)
              await loadFasi()
            }}
            addPlaceholder="Nuova fase…"
            emptyHint="Es. Fase iniziale"
          />
        ) : (
          <section className="crud-list placeholder">
            <h3>Fasi</h3>
            <p className="hint">Seleziona una patologia</p>
          </section>
        )}

        {selFase != null ? (
          <CrudList
            title="Obiettivi"
            items={obiettivi}
            selectedId={selOb}
            onSelect={setSelOb}
            onAdd={async (n) => {
              await window.api.obiettivi.create(selFase, n)
              await loadObiettivi()
            }}
            onRename={async (id, n) => {
              await window.api.obiettivi.update(id, n)
              await loadObiettivi()
            }}
            onDelete={async (id) => {
              await window.api.obiettivi.remove(id)
              if (selOb === id) setSelOb(null)
              await loadObiettivi()
            }}
            onReorder={async (ids) => {
              await window.api.obiettivi.reorder(ids)
              await loadObiettivi()
            }}
            addPlaceholder="Nuovo obiettivo…"
            emptyHint="Es. Controllo del dolore"
          />
        ) : (
          <section className="crud-list placeholder">
            <h3>Obiettivi</h3>
            <p className="hint">Seleziona una fase</p>
          </section>
        )}

        <section className="crud-list">
          <h3>Categorie associate</h3>
          {selOb == null ? (
            <p className="hint">Seleziona un obiettivo</p>
          ) : categorie.length === 0 ? (
            <p className="hint">
              Nessuna categoria disponibile: creale in &ldquo;Categorie esercizi&rdquo;.
            </p>
          ) : (
            <ul className="checkbox-list">
              {categorie.map((c) => (
                <li key={c.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={obCats.includes(c.id)}
                      onChange={(e) => void toggleCat(c.id, e.target.checked)}
                    />
                    {c.nome}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
