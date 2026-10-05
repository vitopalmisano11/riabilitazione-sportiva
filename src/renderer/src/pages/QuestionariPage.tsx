import { useCallback, useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { CategoriaQuestionario, Questionario } from '../../../shared/types'
import ElencoCategorie from '../components/ElencoCategorie'
import { useRileggiDopoSalvataggio } from '../salvaUscendo'
import { ElencoQuestionari } from './questionari/ElencoQuestionari'
import { EditorQuestionario } from './questionari/EditorQuestionario'

export default function QuestionariPage(): React.JSX.Element {
  const [categorie, setCategorie] = useState<CategoriaQuestionario[]>([])
  const [questionari, setQuestionari] = useState<Questionario[]>([])
  const [catId, setCatId] = useState<number | null>(null)
  const [apertoId, setApertoId] = useState<number | null>(null)

  const loadCategorie = useCallback(
    (): Promise<void> => window.api.questionariCategorie.list().then(setCategorie),
    []
  )
  const loadQuestionari = useCallback(
    (): Promise<void> => window.api.questionari.list(false).then(setQuestionari),
    []
  )

  useEffect(() => {
    void loadCategorie()
    void loadQuestionari()
  }, [loadCategorie, loadQuestionari])
  useRileggiDopoSalvataggio(loadQuestionari)

  const categoria = categorie.find((c) => c.id === catId) ?? null
  const aperto = questionari.find((q) => q.id === apertoId) ?? null

  return (
    <div className="page step-flow">
      <header className="page-header">
        <h2>Questionari</h2>
      </header>

      {categoria && (
        <div className="briciole">
          <button
            className="briciola"
            onClick={() => {
              setApertoId(null)
              setCatId(null)
            }}
          >
            Categorie
          </button>
          <ChevronRight size={16} />
          <button className="briciola" disabled={aperto == null} onClick={() => setApertoId(null)}>
            {categoria.nome}
          </button>
          {aperto && (
            <>
              <ChevronRight size={16} />
              <span className="briciola corrente">{aperto.nome}</span>
            </>
          )}
        </div>
      )}

      {categoria == null ? (
        <ElencoCategorie
          categorie={categorie}
          api={window.api.questionariCategorie}
          etichettaNuova="Nuova categoria di questionari"
          esempio="es. Rachide"
          avvisoElimina="Verranno eliminati anche i questionari che contiene e le compilazioni dei pazienti."
          onApri={setCatId}
          onChanged={loadCategorie}
        />
      ) : aperto == null ? (
        <ElencoQuestionari
          categoriaId={categoria.id}
          questionari={questionari.filter((q) => q.categoria_id === categoria.id)}
          onApri={setApertoId}
          onChanged={loadQuestionari}
        />
      ) : (
        <EditorQuestionario key={aperto.id} id={aperto.id} onChanged={loadQuestionari} />
      )}
    </div>
  )
}
