import Aiuto from '../../components/Aiuto'
import type { Tema } from '../../../../shared/temi'
import { TEMI } from '../../../../shared/temi'

export type ModoScuro = 'chiaro' | 'scuro' | 'orari'

export function SchedaAspetto({
  tema,
  onTema,
  scuro,
  modoScuro,
  orariScuro,
  onScuro,
  barraScura,
  onBarraScura
}: {
  tema: Tema
  onTema: (t: Tema) => void
  scuro: boolean
  modoScuro: ModoScuro
  orariScuro: { dalle: string; alle: string }
  onScuro: (modo: ModoScuro, orari?: { dalle: string; alle: string }) => void
  barraScura: boolean
  onBarraScura: (valore: boolean) => void
}): React.JSX.Element {
  return (
    <section className="card single-col">
      <div className="sotto-titolo">
        Colore dell&apos;app
        <Aiuto testo="Il colore cambia subito, e vale anche per i documenti che stampi: intestazioni delle sezioni e righe dei titoli nelle tabelle." />
      </div>
      <div className="scelta-tema">
        {TEMI.map((t) => (
          <button
            key={t.valore}
            className={tema === t.valore ? 'scelta-attiva' : ''}
            onClick={() => onTema(t.valore)}
          >
            <span className="pallino-tema" style={{ background: t.colore }} />
            {t.etichetta}
          </button>
        ))}
      </div>

      {/* Prima la barra scura era una caratteristica del blu: gli altri due
          colori non potevano averla, e il blu non poteva farne a meno. Adesso
          e' una scelta a se', valida con qualunque colore. */}
      <label className="riga-interruttore riga-staccata">
        <span className="nome-interruttore">
          Colonna laterale scura
          <Aiuto testo="La striscia con i pulsanti delle sezioni, a sinistra: scura stacca di più dal contenuto, chiara è più leggera. Il colore che hai scelto resta quello. Con la modalità scura la colonna è sempre scura, e questo interruttore resta acceso." />
        </span>
        {/* Con la modalita' scura la colonna e' scura comunque: l'interruttore
            lo dice restando acceso, invece di sembrare spento e non fare
            niente. */}
        <input
          type="checkbox"
          className="interruttore"
          checked={barraScura || scuro}
          disabled={scuro}
          onChange={(e) => onBarraScura(e.target.checked)}
        />
      </label>

      {/* La modalita' scura non e' una tavolozza a parte: si accende sopra a
          quella scelta, e sta nello stesso riquadro perche' e' la stessa
          domanda — che aspetto ha l'app. */}
      <div className="riga-interruttore riga-luce">
        <span className="nome-interruttore">
          Modalità scura
          <Aiuto testo="Fondi scuri e scritte chiare, con il colore che hai scelto. Con A orari diventa scura da sola all'ora che scegli e torna chiara la mattina, anche con il programma aperto. I documenti che stampi restano chiari: vanno sulla carta." />
        </span>
        <span className="scelta-coppia segmentata">
          {(
            [
              ['chiaro', 'Chiara'],
              ['scuro', 'Scura'],
              ['orari', 'A orari']
            ] as const
          ).map(([modo, nome]) => (
            <button
              key={modo}
              type="button"
              className={modoScuro === modo ? 'scelta-attiva' : ''}
              onClick={() => onScuro(modo)}
            >
              {nome}
            </button>
          ))}
        </span>
      </div>
      {modoScuro === 'orari' && (
        <div className="orari-scuro">
          <span>Scura dalle</span>
          <input
            type="time"
            value={orariScuro.dalle}
            onChange={(e) => e.target.value && onScuro('orari', { ...orariScuro, dalle: e.target.value })}
          />
          <span>alle</span>
          <input
            type="time"
            value={orariScuro.alle}
            onChange={(e) => e.target.value && onScuro('orari', { ...orariScuro, alle: e.target.value })}
          />
        </div>
      )}
    </section>
  )
}
