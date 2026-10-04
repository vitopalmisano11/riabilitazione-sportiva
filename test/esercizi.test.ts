// La libreria degli esercizi e le sue categorie (esercizi.ts).
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { archivioDiProva } from './archivio-di-prova'
import { getDb } from '../src/main/db'
import {
  aggiornaEsercizio,
  archiviaEsercizio,
  creaCategoria,
  creaEsercizio,
  elencoCategorie,
  elencoEsercizi,
  eliminaCategoria,
  eliminaEsercizio,
  impostaCluster,
  impostaImmagine,
  impostaPadre,
  impostaRir,
  leggiImmagine,
  rinominaCategoria
} from '../src/main/esercizi'
import { elencoCestino, ripristina } from '../src/main/cestino'
import type { EsercizioInput } from '../src/shared/types'

// Un archivio cifrato tutto suo, in una cartella temporanea.
archivioDiProva()

function esercizio(categoria_id: number, nome: string, extra: Partial<EsercizioInput> = {}): EsercizioInput {
  return {
    nome,
    categoria_id,
    serie_default: '3',
    cluster_default: null,
    ripetizioni_default: '10',
    rir_default: null,
    carico_default: null,
    unita_carico: null,
    recupero_cluster_default: null,
    recupero_default: null,
    nota_tecnica: null,
    link: null,
    ...extra
  } as EsercizioInput
}
type Categoria = { id: number; nome: string; padre_id: number | null; dosaggio_cluster: number; dosaggio_rir: number }
const categorie = (): Categoria[] => elencoCategorie() as Categoria[]

test('Le categorie stanno in ordine alfabetico italiano, accenti compresi', () => {
  for (const n of ['Zeta cat', 'Mobilità cat', 'Mobilita cat bis', 'Forza cat', 'Équipe cat']) creaCategoria(n)
  const mie = categorie().map((c) => c.nome).filter((n) => n.endsWith('cat') || n.endsWith('cat bis'))
  // "Mobilità" non finisce fuori posto come con COLLATE NOCASE; "Équipe" sta fra le E
  assert.deepEqual(mie, ['Équipe cat', 'Forza cat', 'Mobilità cat', 'Mobilita cat bis', 'Zeta cat'].sort((a, b) => a.localeCompare(b, 'it')))
  const forza = categorie().find((c) => c.nome === 'Forza cat')!
  rinominaCategoria(forza.id, '  Forza massimale cat ')
  assert.ok(categorie().some((c) => c.nome === 'Forza massimale cat'))
})

test('Le due spunte della categoria: cluster e ripetizioni di riserva', () => {
  const id = creaCategoria('Pliometria spunte')
  const leggi = (): Categoria => categorie().find((c) => c.id === id)!
  assert.deepEqual([leggi().dosaggio_cluster, leggi().dosaggio_rir], [0, 0])
  impostaCluster(id, true)
  impostaRir(id, true)
  assert.deepEqual([leggi().dosaggio_cluster, leggi().dosaggio_rir], [1, 1])
  impostaCluster(id, false)
  assert.deepEqual([leggi().dosaggio_cluster, leggi().dosaggio_rir], [0, 1])
})

test('Una categoria sta dentro a un\'altra per un solo livello', () => {
  const a = creaCategoria('Ginocchio padre')
  const b = creaCategoria('Ginocchio figlia')
  const c = creaCategoria('Ginocchio nipote')
  assert.throws(() => impostaPadre(a, a), /dentro a se stessa/)
  impostaPadre(b, a)
  assert.equal(categorie().find((x) => x.id === b)!.padre_id, a)
  // chi ha gia' figlie non puo' finire dentro a un'altra
  assert.throws(() => impostaPadre(a, c), /ha gia' dei distretti dentro/)
  // ne' ci si puo' mettere dentro a una che e' gia' figlia
  assert.throws(() => impostaPadre(c, b), /un livello solo/)
  impostaPadre(b, null)
  assert.equal(categorie().find((x) => x.id === b)!.padre_id, null)
})

test('Un esercizio si crea, si legge in elenco, si modifica e si archivia', () => {
  const cat = creaCategoria('Esercizi elenco')
  const id = creaEsercizio(esercizio(cat, '  Squat bulgaro ', { link: ' https://esempio.it/video ' }))
  type Riga = { id: number; nome: string; link: string | null; categoria_nome: string; usi: number; archiviato: number; ha_immagine: number }
  const riga = (): Riga | undefined => (elencoEsercizi(false) as Riga[]).find((e) => e.id === id)
  assert.equal(riga()!.nome, 'Squat bulgaro')
  assert.equal(riga()!.link, 'https://esempio.it/video')
  assert.equal(riga()!.categoria_nome, 'Esercizi elenco')
  assert.equal(riga()!.ha_immagine, 0)

  aggiornaEsercizio(id, esercizio(cat, 'Squat bulgaro con elastico', { serie_default: '4' }))
  assert.equal(riga()!.nome, 'Squat bulgaro con elastico')
  assert.equal(riga()!.link, null, 'un link tolto resta tolto')

  archiviaEsercizio(id, true)
  assert.equal(riga(), undefined, 'archiviato sparisce dall\'elenco di tutti i giorni')
  assert.ok((elencoEsercizi(true) as Riga[]).some((e) => e.id === id && e.archiviato === 1))
  archiviaEsercizio(id, false)
  assert.ok(riga())

  // un link non web non si accetta
  assert.throws(() => creaEsercizio(esercizio(cat, 'Cattivo', { link: 'javascript:alert(1)' })), /http/)
  assert.throws(() => aggiornaEsercizio(id, esercizio(cat, 'Cattivo', { link: 'file:///C:/x' })), /http/)
})

test('Un esercizio usato in una seduta non si elimina; uno mai usato va nel cestino', () => {
  const c = getDb()
  const cat = creaCategoria('Esercizi eliminare')
  const usato = creaEsercizio(esercizio(cat, 'Usato in seduta'))
  const libero = creaEsercizio(esercizio(cat, 'Mai usato'))
  const pz = Number(c.prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Es', 'Usato')").run().lastInsertRowid)
  const sed = Number(c.prepare("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-01-01')").run(pz).lastInsertRowid)
  c.prepare("INSERT INTO seduta_esercizi (seduta_id, esercizio_id, serie, ordine) VALUES (?, ?, '3', 0)").run(sed, usato)
  assert.throws(() => eliminaEsercizio(usato), /usato in una seduta già registrate|usato in una seduta/)
  assert.ok((elencoEsercizi(true) as { id: number }[]).some((e) => e.id === usato), 'e resta dov\'e\'')

  eliminaEsercizio(libero)
  assert.ok(!(elencoEsercizi(true) as { id: number }[]).some((e) => e.id === libero))
  const voce = elencoCestino().find((v) => v.etichetta === 'Mai usato')!
  ripristina(voce.id)
  assert.ok((elencoEsercizi(true) as { id: number }[]).some((e) => e.id === libero))

  // una categoria con esercizi dentro non si elimina: lo dice il database
  assert.throws(() => eliminaCategoria(cat), /(utilizzato|FOREIGN|esercizi)/i)
})

test('L\'immagine dell\'esercizio: solo immagini vere e leggere, e si legge a parte', () => {
  const cat = creaCategoria('Esercizi immagine')
  const id = creaEsercizio(esercizio(cat, 'Con foto'))
  assert.equal(leggiImmagine(id), null)
  impostaImmagine(id, 'data:image/png;base64,iVBORw0KGgo=')
  assert.equal(leggiImmagine(id), 'data:image/png;base64,iVBORw0KGgo=')
  assert.equal((elencoEsercizi(false) as { id: number; ha_immagine: number }[]).find((e) => e.id === id)!.ha_immagine, 1)
  // l'elenco non si porta dietro l'immagine intera
  assert.ok(!('immagine' in (elencoEsercizi(false) as object[])[0]))
  assert.throws(() => impostaImmagine(id, 'data:text/html;base64,PHNjcmlwdD4='), /formato valido/)
  assert.throws(() => impostaImmagine(id, 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024)), /troppo pesante/)
  assert.equal(leggiImmagine(id), 'data:image/png;base64,iVBORw0KGgo=', 'un rifiuto non cambia niente')
  impostaImmagine(id, null)
  assert.equal(leggiImmagine(id), null)
  assert.throws(() => leggiImmagine(999999), /non trovato/)
})
