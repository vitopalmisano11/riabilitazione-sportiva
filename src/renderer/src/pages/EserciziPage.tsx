import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  ImageIcon,
  Pencil,
  Trash2,
  Video
} from 'lucide-react'
import type { Categoria, EsercizioConCategoria, EsercizioInput } from '../../../shared/types'
import { toastErrore } from '../components/Toast'
import { chiedi } from '../components/Conferma'
import CrudList from '../components/CrudList'
import Aiuto from '../components/Aiuto'
import SceltaConRicerca from '../components/SceltaConRicerca'
import ImmagineEsercizio from '../components/ImmagineEsercizio'
import { errMsg } from '../lib'
import type { Dosaggio } from '../../../shared/dosaggio'
import {
  aCluster,
  caricoTesto,
  recuperoEsteso,
  recuperoTesto,
  ripetizioniTesto,
  volumeTesto
} from '../../../shared/dosaggio'

interface FormState {
  id: number | null
  nome: string
  categoria_id: number | ''
  serie_default: string
  cluster_default: string
  ripetizioni_default: string
  rir_default: string
  carico_default: string
  unita_carico: string
  recupero_cluster_default: string
  recupero_default: string
  nota_tecnica: string
  link: string
  // null = nessuna immagine. `immagineCambiata` evita di riscrivere il campo
  // (pesante) quando si salva un esercizio senza aver toccato l'immagine.
  immagine: string | null
  immagineCambiata: boolean
}

const FORM_VUOTO: FormState = {
  id: null,
  nome: '',
  categoria_id: '',
  serie_default: '',
  cluster_default: '',
  ripetizioni_default: '',
  rir_default: '',
  carico_default: '',
  unita_carico: '',
  recupero_cluster_default: '',
  recupero_default: '',
  nota_tecnica: '',
  link: '',
  immagine: null,
  immagineCambiata: false
}

// URL vuoto -> null; senza schema -> prefissa https://
function normalizzaLink(valore: string): string | null {
  const v = valore.trim()
  if (!v) return null
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

export default function EserciziPage(): React.JSX.Element {
  const [esercizi, setEsercizi] = useState<EsercizioConCategoria[]>([])
  const [categorie, setCategorie] = useState<Categoria[]>([])
  const [mostraArchiviati, setMostraArchiviati] = useState(false)
  const [ordine, setOrdine] = useState<'alfabetico' | 'usati'>('alfabetico')
  // La categoria aperta in modifica (o una nuova, con id null): nome e
  // dosaggio si decidono insieme, in una finestra sola.
  const [formCat, setFormCat] = useState<{
    id: number | null
    nome: string
    cluster: boolean
    rir: boolean
    // Dentro a quale categoria sta ('' = e' lei stessa una categoria).
    padre: number | ''
  } | null>(null)
  const [ricerca, setRicerca] = useState('')
  // Il riquadro delle categorie si apre e si richiude, e dentro ha la sua
  // ricerca: con trenta categorie l'elenco aperto copriva tutta la pagina.
  const [categorieAperte, setCategorieAperte] = useState(false)
  const [ricercaCat, setRicercaCat] = useState('')
  const qCat = ricercaCat.trim().toLowerCase()
  const categorieTrovate =
    qCat === '' ? categorie : categorie.filter((c) => c.nome.toLowerCase().includes(qCat))

  const haFiglie = (id: number): boolean => categorie.some((c) => c.padre_id === id)

  // Nelle caselle in cui si sceglie, un distretto si scrive con la sua
  // categoria davanti: "Quadricipite" da solo non dice di che lavoro si tratta.
  const vociCategorie = categorie
    .filter((c) => c.padre_id == null)
    .flatMap((c) => [
      c,
      ...categorie
        .filter((f) => f.padre_id === c.id)
        .map((f) => ({ ...f, nome: `${c.nome} › ${f.nome}` }))
    ])
    // Rete di sicurezza: una categoria il cui padre non c'e' piu' resta
    // comunque scegliibile. Sparire da questo elenco vorrebbe dire non poterla
    // piu' usare, e nemmeno capire perche'.
    .concat(
      categorie.filter((c) => c.padre_id != null && !categorie.some((x) => x.id === c.padre_id))
    )

  // Nell'elenco i distretti stanno sotto alla loro categoria, rientrati: cosi'
  // si legge cosa contiene cosa senza aprire niente. Cercando invece si vede
  // l'elenco piatto, con il nome della categoria scritto accanto.
  const nomeCategoria = (id: number | null): string =>
    id == null ? '' : (categorie.find((c) => c.id === id)?.nome ?? '')

  const categorieInElenco =
    qCat === ''
      ? categorie
          .filter((c) => c.padre_id == null)
          .flatMap((c) => [
            c,
            ...categorie
              .filter((f) => f.padre_id === c.id)
              .map((f) => ({ ...f, nome: `— ${f.nome}` }))
          ])
      : categorieTrovate.map((c) =>
          c.padre_id == null ? c : { ...c, nome: `${nomeCategoria(c.padre_id)} › ${c.nome}` }
        )
  const [filtroCategoria, setFiltroCategoria] = useState<number | ''>('')
  const [form, setForm] = useState<FormState | null>(null)
  const [immagineAperta, setImmagineAperta] = useState<EsercizioConCategoria | null>(null)
  // La nota tecnica e' lunga quanto serve: scritta nella tabella, allargava la
  // riga e sfasava tutta la griglia. Sta dietro a un punto interrogativo e
  // compare passandoci sopra, in un cartellino che galleggia sopra la pagina
  // (posizione fissa, cosi' non lo taglia il bordo della tabella).
  const [bolla, setBolla] = useState<{ testo: string; x: number; y: number; sopra: boolean } | null>(
    null
  )

  const load = async (archiviati = mostraArchiviati): Promise<void> => {
    setEsercizi(await window.api.esercizi.list(archiviati))
  }

  const loadCategorie = (): Promise<void> => window.api.categorie.list().then(setCategorie)

  useEffect(() => {
    void load()
    void loadCategorie()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // L'elenco si puo' leggere in due modi: in ordine alfabetico, per trovare un
  // esercizio che si sa gia' come si chiama, oppure dai piu' usati, che sono
  // quelli che si rimettono in quasi tutte le schede. A parita' di utilizzi
  // resta l'alfabetico, cosi' l'ordine non balla a ogni ricarica.
  const visibili = useMemo(() => {
    const q = ricerca.trim().toLowerCase()
    const filtrati = esercizi.filter(
      (e) =>
        (q === '' || e.nome.toLowerCase().includes(q)) &&
        (filtroCategoria === '' ||
          e.categoria_id === filtroCategoria ||
          // Filtrando per "Rinforzo" si vedono anche quelli dei distretti che
          // ci stanno dentro.
          categorie.find((c) => c.id === e.categoria_id)?.padre_id === filtroCategoria)
    )
    if (ordine === 'usati') {
      return [...filtrati].sort((a, b) => b.usi - a.usi || a.nome.localeCompare(b.nome))
    }
    return filtrati
  }, [esercizi, ricerca, filtroCategoria, ordine])

  const salva = async (): Promise<void> => {
    if (!form) return
    if (!form.nome.trim()) {
      toastErrore('Il nome è obbligatorio.')
      return
    }
    if (form.categoria_id === '') {
      toastErrore('Seleziona una categoria.')
      return
    }
    const data: EsercizioInput = {
      nome: form.nome,
      categoria_id: form.categoria_id,
      serie_default: form.serie_default.trim() || null,
      // Fuori da una categoria a cluster i due campi non si vedono nemmeno:
      // si salvano vuoti, cosi' spostando l'esercizio non si porta dietro
      // numeri che nessuno ha piu' modo di correggere.
      cluster_default: clusterNelForm ? form.cluster_default.trim() || null : null,
      ripetizioni_default: form.ripetizioni_default.trim() || null,
      // Come per il cluster: fuori da una categoria che usa il RIR il campo non
      // si vede, e si salva vuoto.
      rir_default: rirNelForm ? form.rir_default.trim() || null : null,
      carico_default: form.carico_default.trim() || null,
      unita_carico: form.unita_carico.trim() || null,
      recupero_cluster_default: clusterNelForm
        ? form.recupero_cluster_default.trim() || null
        : null,
      recupero_default: form.recupero_default.trim() || null,
      nota_tecnica: form.nota_tecnica.trim() || null,
      link: normalizzaLink(form.link)
    }
    try {
      const id =
        form.id == null
          ? await window.api.esercizi.create(data)
          : (await window.api.esercizi.update(form.id, data), form.id)
      if (form.immagineCambiata) await window.api.esercizi.setImmagine(id, form.immagine)
      setForm(null)
      await load()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // Nome e dosaggio si salvano insieme: sono due domande sulla stessa cosa.
  const salvaCategoria = async (): Promise<void> => {
    if (!formCat) return
    const nome = formCat.nome.trim()
    if (nome === '') {
      toastErrore('Il nome è obbligatorio.')
      return
    }
    try {
      const id =
        formCat.id == null
          ? await window.api.categorie.create(nome)
          : (await window.api.categorie.update(formCat.id, nome), formCat.id)
      await window.api.categorie.setCluster(id, formCat.cluster)
      await window.api.categorie.setRir(id, formCat.rir)
      await window.api.categorie.setPadre(id, formCat.padre === '' ? null : formCat.padre)
      setFormCat(null)
      await loadCategorie()
      await load()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // Il dosaggio di un esercizio della libreria, nella forma che sanno leggere
  // le funzioni condivise.
  const dosaggioDi = (e: EsercizioConCategoria): Dosaggio => ({
    serie: e.serie_default,
    cluster: e.cluster_default,
    ripetizioni: e.ripetizioni_default,
    rir: e.rir_default,
    recupero_cluster: e.recupero_cluster_default,
    recupero: e.recupero_default
  })

  // I campi del cluster compaiono nel form solo se li prevede la categoria
  // scelta in quel momento: cambiando categoria, compaiono o spariscono.
  const clusterNelForm =
    form != null && categorie.find((c) => c.id === form.categoria_id)?.dosaggio_cluster === 1

  const rirNelForm =
    form != null && categorie.find((c) => c.id === form.categoria_id)?.dosaggio_rir === 1

  // Come verra' scritto il dosaggio sulla scheda: finche' i campi sono vuoti si
  // mostra un esempio, cosi' si capisce cosa ci va senza doverlo spiegare.
  const anteprimaCluster =
    form == null
      ? ''
      : [
          volumeTesto({
            serie: form.serie_default,
            cluster: form.cluster_default,
            ripetizioni: form.ripetizioni_default
          }),
          recuperoEsteso({
            recupero_cluster: form.recupero_cluster_default,
            recupero: form.recupero_default
          })
        ]
          .filter(Boolean)
          .join(' · ') || `4 × (3 × 2) · rec. 15" tra i cluster, 2' tra le serie`

  // Apre il form di modifica caricando l'immagine, che l'elenco non trasporta.
  const apriModifica = async (e: EsercizioConCategoria): Promise<void> => {
    try {
      const immagine = e.ha_immagine ? await window.api.esercizi.immagine(e.id) : null
      setForm({
        id: e.id,
        nome: e.nome,
        categoria_id: e.categoria_id,
        serie_default: e.serie_default ?? '',
        cluster_default: e.cluster_default ?? '',
        ripetizioni_default: e.ripetizioni_default ?? '',
        rir_default: e.rir_default ?? '',
        carico_default: e.carico_default ?? '',
        unita_carico: e.unita_carico ?? '',
        recupero_cluster_default: e.recupero_cluster_default ?? '',
        recupero_default: e.recupero_default ?? '',
        nota_tecnica: e.nota_tecnica ?? '',
        link: e.link ?? '',
        immagine,
        immagineCambiata: false
      })
    } catch (err) {
      toastErrore(errMsg(err))
    }
  }

  const scegliImmagine = async (): Promise<void> => {
    if (!form) return
    try {
      const dataUrl = await window.api.scegliImmagine()
      if (dataUrl) setForm({ ...form, immagine: dataUrl, immagineCambiata: true })
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const archivia = async (e: EsercizioConCategoria): Promise<void> => {
    try {
      await window.api.esercizi.setArchiviato(e.id, e.archiviato === 0)
      await load()
    } catch (err) {
      toastErrore(errMsg(err))
    }
  }

  const elimina = async (e: EsercizioConCategoria): Promise<void> => {
    if (!(await chiedi(`Eliminare "${e.nome}"?\nSe è stato usato in sedute passate non si può: in quel caso usa "Archivia".\nFinisce nel cestino: puoi rimetterlo a posto da Impostazioni entro un mese.`)))
      return
    try {
      await window.api.esercizi.remove(e.id)
      await load()
    } catch (err) {
      toastErrore(errMsg(err))
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h2>Libreria esercizi</h2>
      </header>

      <div className="blocco-apribile">
        {/* Un pulsante vero e proprio, con la freccetta che gira: si vede che
            si puo' richiudere, cosa che con il solo titolo non si capiva. */}
        <button className="riga-apribile" onClick={() => setCategorieAperte(!categorieAperte)}>
          {categorieAperte ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Categorie esercizi ({categorie.length})
        </button>
        {categorieAperte && (
        <div className="contenuto-apribile contenuto-categorie">
        <input
          type="search"
          className="cerca-categoria"
          placeholder="Cerca categoria…"
          value={ricercaCat}
          onChange={(e) => setRicercaCat(e.target.value)}
        />
        <CrudList
          title="Categorie"
          items={categorieInElenco}
          onNuovo={() =>
            setFormCat({ id: null, nome: '', cluster: false, rir: false, padre: '' })
          }
          onModifica={(item) => {
            const c = categorie.find((x) => x.id === item.id)
            setFormCat({
              id: item.id,
              nome: item.nome,
              cluster: c?.dosaggio_cluster === 1,
              rir: c?.dosaggio_rir === 1,
              padre: c?.padre_id ?? ''
            })
          }}
          onDelete={async (id) => {
            await window.api.categorie.remove(id)
            await loadCategorie()
          }}
          // Cercando si vede solo una parte dell'elenco: riordinarla
          // sposterebbe anche quelle che non si vedono, quindi la maniglia
          // sparisce finche' la ricerca e' attiva.
          onReorder={
            qCat === ''
              ? async (ids) => {
                  await window.api.categorie.reorder(ids)
                  await loadCategorie()
                }
              : undefined
          }
          etichettaAggiungi="Nuova categoria"
          emptyHint="Nessuna categoria: creane una qui sotto."
          aiuto="Ogni categoria può essere segnata come «a cluster»: gli esercizi che le appartengono si dosano spezzando la serie in blocchi con una pausa breve dentro, come nella pliometria estensiva. L'opzione si mette aprendo la categoria."
          dopoNome={(item) => {
            const c = categorie.find((x) => x.id === item.id)
            return (
              <>
                {c?.dosaggio_cluster === 1 && <span className="badge">cluster</span>}
                {c?.dosaggio_rir === 1 && <span className="badge">RIR</span>}
              </>
            )
          }}
        />
        </div>
        )}
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Cerca esercizio…"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
        />
        <div className="filtro-categorie">
          <SceltaConRicerca
            voci={vociCategorie}
            valore={filtroCategoria}
            segnaposto="Tutte le categorie"
            vuoto="Tutte le categorie"
            onCambia={setFiltroCategoria}
          />
        </div>
        {/* Due interruttori, non due scritte: l'ordine e gli archiviati sono
            stati dell'elenco, e da pulsanti occupano un quarto dello spazio. */}
        <button
          className="btn-solo-icona"
          title={
            ordine === 'alfabetico'
              ? 'Ordine alfabetico — clicca per mettere prima i più usati'
              : 'Prima i più usati — clicca per tornare all’ordine alfabetico'
          }
          onClick={() => setOrdine(ordine === 'alfabetico' ? 'usati' : 'alfabetico')}
        >
          {ordine === 'alfabetico' ? (
            <ArrowDownAZ size={18} />
          ) : (
            <ArrowDownWideNarrow size={18} />
          )}
        </button>
        <button
          className={mostraArchiviati ? 'attivo' : ''}
          title="Mostra anche gli esercizi archiviati"
          onClick={() => {
            const acceso = !mostraArchiviati
            setMostraArchiviati(acceso)
            void load(acceso)
          }}
        >
          <Archive size={16} /> Archiviati
        </button>
        <span className="spacer" />
        <button
          className="primary"
          onClick={() => {
            if (categorie.length === 0) {
              toastErrore('Prima crea almeno una categoria in "Categorie esercizi".')
              return
            }
            setForm(FORM_VUOTO)
          }}
        >
          + Nuovo esercizio
        </button>
      </div>

      {/* La tabella scorre di lato dentro al suo riquadro: con il testo
          ingrandito non ci sta piu' in larghezza, e prima usciva fuori. */}
      <div className="tabella-scorre">
        <table className="data-table tabella-esercizi">
          <thead>
            <tr>
              <th className="col-nome">Nome</th>
              <th className="col-categoria">Categoria</th>
              <th className="col-param">Serie</th>
              <th className="col-param" title="Ripetizioni">
                Rip.
              </th>
              <th className="col-param">Carico</th>
              <th className="col-param">Recupero</th>
              <th className="col-nota">Nota</th>
              <th className="col-azioni"></th>
            </tr>
          </thead>
          <tbody>
            {visibili.map((e) => (
              <tr key={e.id} className={e.archiviato ? 'archiviato' : ''}>
                <td className="col-nome">
                  {/* Nome e icone in due colonne: in linea, con un nome lungo che
                      va a capo, le icone finivano sotto la seconda riga. */}
                  <div className="cella-nome">
                    <span className="nome-esercizio" title={e.nome}>
                      {e.nome}
                    </span>
                    <span className="icone-nome">
                  {e.link && (
                    <button
                      className="icona-esercizio"
                      title="Apri video"
                      onClick={() => window.api.apriLink(e.link!).catch((err) => toastErrore(errMsg(err)))}
                    >
                      <Video size={16} />
                    </button>
                  )}
                  {e.ha_immagine === 1 && (
                    <button
                      className="icona-esercizio"
                      title="Vedi immagine"
                      onClick={() => setImmagineAperta(e)}
                    >
                      <ImageIcon size={16} />
                    </button>
                  )}
                  {e.archiviato ? <span className="badge">archiviato</span> : null}
                    </span>
                  </div>
                </td>
                <td className="col-categoria" title={e.categoria_nome}>
                  {e.categoria_nome}
                </td>
                <td className="col-param">{e.serie_default ?? '—'}</td>
                <td className="col-param" title={aCluster(dosaggioDi(e)) ? 'Cluster × ripetizioni' : undefined}>
                  {ripetizioniTesto(dosaggioDi(e)) ?? '—'}
                </td>
                <td className="col-param">
                  {caricoTesto(e.carico_default, e.unita_carico) ?? '—'}
                </td>
                <td className="col-param" title={aCluster(dosaggioDi(e)) ? 'Tra i cluster / tra le serie' : undefined}>
                  {recuperoTesto(dosaggioDi(e)) ?? '—'}
                </td>
                <td className="col-nota">
                  {e.nota_tecnica && (
                    <span
                      className="icona-esercizio nota-aiuto"
                      onMouseEnter={(ev) => {
                        const r = ev.currentTarget.getBoundingClientRect()
                        const sopra = r.bottom > window.innerHeight - 180
                        setBolla({
                          testo: e.nota_tecnica!,
                          x: r.right,
                          y: sopra ? r.top - 6 : r.bottom + 6,
                          sopra
                        })
                      }}
                      onMouseLeave={() => setBolla(null)}
                    >
                      <HelpCircle size={16} />
                    </span>
                  )}
                </td>
                <td className="row-actions col-azioni">
                  <button title="Modifica" onClick={() => void apriModifica(e)}>
                    <Pencil size={16} />
                  </button>
                  <button
                    title={
                      e.archiviato
                        ? 'Rimetti in elenco'
                        : "Togli dall'elenco, tenendo le sedute in cui l'hai usato"
                    }
                    onClick={() => void archivia(e)}
                  >
                    {e.archiviato ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                  </button>
                  <button className="danger" title="Elimina" onClick={() => void elimina(e)}>
                    <Trash2 size={16} />
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
      </div>

      {formCat && (
        <div className="modal-overlay" onClick={() => setFormCat(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{formCat.id == null ? 'Nuova categoria' : 'Modifica categoria'}</h3>
            <label>
              Nome
              <input
                autoFocus
                value={formCat.nome}
                onChange={(e) => setFormCat({ ...formCat, nome: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void salvaCategoria()
                }}
              />
            </label>
            {/* Un livello solo: qui si scelgono le categorie che non stanno
                gia' dentro a un'altra, e non se stessa. */}
            <label>
              Dentro a
              <SceltaConRicerca
                voci={categorie.filter(
                  (c) => c.padre_id == null && c.id !== formCat.id && !haFiglie(c.id)
                )}
                valore={formCat.padre}
                segnaposto="— e' una categoria a sé —"
                vuoto="— e' una categoria a sé —"
                onCambia={(id) => setFormCat({ ...formCat, padre: id })}
              />
            </label>

            <label className="checkbox-inline riga-staccata">
              <input
                type="checkbox"
                checked={formCat.cluster}
                onChange={(e) => setFormCat({ ...formCat, cluster: e.target.checked })}
              />
              Dosaggio a cluster
              <Aiuto testo="Gli esercizi di questa categoria si dosano spezzando la serie in blocchi con una pausa breve dentro: 4 serie da 3 cluster da 2 ripetizioni, 15 secondi tra i cluster e 2 minuti tra le serie. Nel loro form compaiono i campi in più; le altre categorie restano come sono." />
            </label>
            {/* Come il cluster: la spunta sta sulla categoria, cosi' la
                casellina in piu' la vedono solo gli esercizi a cui serve. */}
            <label className="checkbox-inline">
              <input
                type="checkbox"
                checked={formCat.rir}
                onChange={(e) => setFormCat({ ...formCat, rir: e.target.checked })}
              />
              Ripetizioni di riserva (RIR)
              <Aiuto testo="Quante ripetizioni restano in canna a fine serie: RIR 2 vuol dire fermarsi due prima del cedimento. Dice quanto è pesante la serie meglio del carico da solo, e serve nella forza più che nella mobilità. Spuntandola, gli esercizi di questa categoria hanno una casellina in più nella seduta." />
            </label>
            <div className="modal-actions">
              <button onClick={() => setFormCat(null)}>Annulla</button>
              <button className="primary" onClick={() => void salvaCategoria()}>
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

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
              {/* Si scrive invece di scorrere: con trenta categorie la tendina
                  di Windows si apriva lunga mezza schermata. */}
              <SceltaConRicerca
                voci={vociCategorie}
                valore={form.categoria_id}
                segnaposto="Scrivi o scegli la categoria…"
                onCambia={(id) => setForm({ ...form, categoria_id: id })}
              />
            </label>
            <p className="modal-testo">
              Valori di default, proposti quando aggiungi l&apos;esercizio a una seduta:
            </p>
            <div className={`form-row ${clusterNelForm ? 'form-row-3' : 'form-row-4'}`}>
              <label>
                Serie
                <input
                  value={form.serie_default}
                  placeholder="es. 3"
                  onChange={(e) => setForm({ ...form, serie_default: e.target.value })}
                />
              </label>
              {clusterNelForm && (
                <label>
                  Cluster per serie
                  <input
                    value={form.cluster_default}
                    placeholder="es. 3"
                    onChange={(e) => setForm({ ...form, cluster_default: e.target.value })}
                  />
                </label>
              )}
              <label>
                {clusterNelForm ? 'Ripetizioni per cluster' : 'Ripetizioni'}
                <input
                  value={form.ripetizioni_default}
                  placeholder={clusterNelForm ? 'es. 2' : 'es. 10'}
                  onChange={(e) => setForm({ ...form, ripetizioni_default: e.target.value })}
                />
              </label>
              {rirNelForm && (
                <label>
                  RIR
                  <input
                    value={form.rir_default}
                    placeholder="es. 2"
                    onChange={(e) => setForm({ ...form, rir_default: e.target.value })}
                  />
                </label>
              )}
              {/* Carico e unita' stanno nella stessa casella: sono una cosa
                  sola ("10 kg"), e come campi separati avrebbero sballato la
                  griglia del form. L'unita' e' dell'esercizio, perche' la panca
                  si carica in chili e il plank si tiene in secondi. */}
              <label>
                Carico
                <span className="campo-con-unita">
                  <input
                    value={form.carico_default}
                    placeholder="es. 10"
                    onChange={(e) => setForm({ ...form, carico_default: e.target.value })}
                  />
                  <input
                    className="casella-unita"
                    value={form.unita_carico}
                    placeholder="kg"
                    maxLength={12}
                    title="Unità di misura: kg, sec, cm… Lascia vuoto se non serve."
                    onChange={(e) => setForm({ ...form, unita_carico: e.target.value })}
                  />
                </span>
              </label>
              {clusterNelForm && (
                <label>
                  Recupero tra i cluster
                  <input
                    value={form.recupero_cluster_default}
                    placeholder={'es. 15"'}
                    onChange={(e) =>
                      setForm({ ...form, recupero_cluster_default: e.target.value })
                    }
                  />
                </label>
              )}
              <label>
                {clusterNelForm ? 'Recupero tra le serie' : 'Recupero'}
                <input
                  value={form.recupero_default}
                  placeholder="es. 1 min"
                  onChange={(e) => setForm({ ...form, recupero_default: e.target.value })}
                />
              </label>
            </div>
            {clusterNelForm && (
              <p className="hint">
                Sulla scheda: <b>{anteprimaCluster}</b>
              </p>
            )}
            <label>
              Link video (opzionale)
              <input
                value={form.link}
                placeholder="es. https://youtube.com/watch?v=…"
                onChange={(e) => setForm({ ...form, link: e.target.value })}
              />
            </label>
            <div className="campo-immagine">
              <span className="campo-immagine-etichetta">Immagine (opzionale)</span>
              {form.immagine ? (
                <>
                  <img className="immagine-anteprima" src={form.immagine} alt="" />
                  <div className="campo-immagine-azioni">
                    <button onClick={() => void scegliImmagine()}>Sostituisci…</button>
                    <button
                      className="danger"
                      onClick={() => setForm({ ...form, immagine: null, immagineCambiata: true })}
                    >
                      Rimuovi
                    </button>
                  </div>
                </>
              ) : (
                <div className="campo-immagine-azioni">
                  <button onClick={() => void scegliImmagine()}>Scegli immagine…</button>
                  <span className="hint">Viene rimpicciolita e salvata nel database cifrato.</span>
                </div>
              )}
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

      {bolla && (
        <div
          className={`bolla-nota${bolla.sopra ? ' sopra' : ''}`}
          style={{ left: bolla.x, top: bolla.y }}
        >
          {bolla.testo}
        </div>
      )}

      {immagineAperta && (
        <ImmagineEsercizio
          esercizioId={immagineAperta.id}
          nome={immagineAperta.nome}
          onClose={() => setImmagineAperta(null)}
        />
      )}
    </div>
  )
}
