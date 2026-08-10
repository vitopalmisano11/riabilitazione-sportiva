import { useEffect, useState } from 'react'
import type { Categoria } from '../../../shared/types'
import CrudList from '../components/CrudList'

export default function CategoriePage(): React.JSX.Element {
  const [categorie, setCategorie] = useState<Categoria[]>([])

  const load = (): Promise<void> => window.api.categorie.list().then(setCategorie)

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="page">
      <header className="page-header">
        <h2>Categorie esercizi</h2>
        <p>
          Le categorie raggruppano gli esercizi della libreria (es. Mobilizzazione, Rinforzo,
          Corsa) e vengono associate agli obiettivi delle fasi in &ldquo;Patologie e fasi&rdquo;.
        </p>
      </header>
      <div className="single-col">
        <CrudList
          title="Categorie"
          items={categorie}
          onAdd={async (n) => {
            await window.api.categorie.create(n)
            await load()
          }}
          onRename={async (id, n) => {
            await window.api.categorie.update(id, n)
            await load()
          }}
          onDelete={async (id) => {
            await window.api.categorie.remove(id)
            await load()
          }}
          addPlaceholder="Nuova categoria…"
          emptyHint="Nessuna categoria: creane una qui sotto."
        />
      </div>
    </div>
  )
}
