import { useCallback, useEffect, useState } from 'react'
import type { Gruppo } from '../../../shared/types'
import CrudList from '../components/CrudList'
import { daPrecarico, ricorda } from '../precarico'

// I gruppi dei pazienti: dove li segui (Centro, Studio, Domicilio...). Una
// lista semplice come le patologie, ma senza fasi o distretti sotto: qui c'e'
// solo il nome.
export default function GruppiPage(): React.JSX.Element {
  const [gruppi, setGruppi] = useState<Gruppo[]>(() => daPrecarico('gruppi', []))

  const load = useCallback((): Promise<void> => window.api.gruppi.list().then(ricorda('gruppi')).then(setGruppi), [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="page step-flow">
      <header className="page-header">
        <h2>Gruppi</h2>
      </header>
      <CrudList
        title="Gruppi dei pazienti"
        aiuto="Dove segui il paziente: Centro, Studio, Domicilio, o come preferisci chiamarli. Assegnalo dalla scheda del paziente. Chi non ne crea nessuno non vede nessun cambiamento nell'elenco pazienti."
        items={gruppi}
        onAdd={async (n) => {
          await window.api.gruppi.create(n)
          await load()
        }}
        onRename={async (id, n) => {
          await window.api.gruppi.update(id, n)
          await load()
        }}
        onDelete={async (id) => {
          await window.api.gruppi.remove(id)
          await load()
        }}
        onReorder={async (ids) => {
          await window.api.gruppi.reorder(ids)
          await load()
        }}
        etichettaAggiungi="Nuovo gruppo"
        addPlaceholder="es. Centro"
        emptyHint="Nessun gruppo."
      />
    </div>
  )
}
