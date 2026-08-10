import { useState } from 'react'
import PatologiePage from './pages/PatologiePage'
import CategoriePage from './pages/CategoriePage'
import EserciziPage from './pages/EserciziPage'
import PazientiPage from './pages/PazientiPage'

type Sezione = 'patologie' | 'categorie' | 'esercizi' | 'pazienti'

const SEZIONI: { key: Sezione; label: string }[] = [
  { key: 'patologie', label: 'Patologie e fasi' },
  { key: 'categorie', label: 'Categorie esercizi' },
  { key: 'esercizi', label: 'Libreria esercizi' }
]

export default function App(): React.JSX.Element {
  const [sezione, setSezione] = useState<Sezione>('pazienti')

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Riabilitazione</h1>
        <div className="nav-group-label">Configurazione</div>
        <nav>
          {SEZIONI.map((s) => (
            <button
              key={s.key}
              className={sezione === s.key ? 'active' : ''}
              onClick={() => setSezione(s.key)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="nav-group-label">Lavoro quotidiano</div>
        <nav>
          <button
            className={sezione === 'pazienti' ? 'active' : ''}
            onClick={() => setSezione('pazienti')}
          >
            Pazienti e sedute
          </button>
        </nav>
      </aside>
      <main className="content">
        {sezione === 'patologie' && <PatologiePage />}
        {sezione === 'categorie' && <CategoriePage />}
        {sezione === 'esercizi' && <EserciziPage />}
        {sezione === 'pazienti' && <PazientiPage />}
      </main>
    </div>
  )
}
