// Esportazione dell'intero archivio in tabelle leggibili senza l'app.
//
// I dati vivono in un database cifrato che apre solo questo programma: comodo e
// sicuro, ma vuol dire che senza l'app non si leggono. Questa funzione ne scrive
// una copia in file CSV — quelli che Excel apre con un doppio clic — cosi' i
// dati restano tuoi anche se un domani l'app non partisse piu' o volessi
// cambiare programma.
//
// Non e' un backup: il backup e' la copia del database, ed e' quello che si
// ripristina. Questa e' una copia leggibile, che non si puo' rimettere dentro.
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getDb } from './db'

type Riga = Record<string, unknown>

// Una cella: le virgolette si raddoppiano, e si racchiude sempre fra virgolette
// il testo che contiene il separatore, le virgolette o un a capo.
function cella(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Separatore ';' e BOM in testa: e' quello che Excel in italiano si aspetta, e
// senza BOM le lettere accentate escono sbagliate.
function scriviCsv(percorso: string, righe: Riga[], colonne: string[]): void {
  const testo = [
    colonne.join(';'),
    ...righe.map((r) => colonne.map((c) => cella(r[c])).join(';'))
  ].join('\r\n')
  writeFileSync(percorso, '﻿' + testo, 'utf-8')
}

const LEGGIMI = `Archivio esportato da Riabilitazione Sportiva
================================================

Questi file sono tabelle in formato CSV: si aprono con un doppio clic in Excel
(o in qualunque foglio di calcolo) senza bisogno dell'app.

  pazienti.csv       anagrafica e contatti, patologia, fase, stato
  anamnesi.csv       anamnesi prossima e remota, una riga per paziente
  sintomi.csv        i sintomi raccolti nell'anamnesi
  obiettivi.csv      obiettivi terapeutici concordati
  sedute.csv         una riga per esercizio di ogni seduta
  valutazioni.csv    una riga per movimento di ogni valutazione obiettiva
  questionari.csv    i questionari compilati, con punteggi ed esito
  screening.csv      i valori misurati negli screening

Attenzione: contengono dati sanitari. Tienili dove tieni le cartelle dei
pazienti, e non lasciarli su una chiavetta che gira.

Questa non e' una copia di sicurezza: le copie da cui si ripristina sono quelle
che l'app fa da sola (database + chiavi). Questa e' una copia da leggere.
`

export function esportaArchivio(cartella: string): string {
  const db = getDb()
  const oggi = new Date().toISOString().slice(0, 10)
  const dest = join(cartella, `archivio_riabilitazione_${oggi}`)
  mkdirSync(dest, { recursive: true })

  const q = (sql: string): Riga[] => db.prepare(sql).all() as Riga[]

  scriviCsv(
    join(dest, 'pazienti.csv'),
    q(`SELECT p.cognome, p.nome, p.data_nascita, p.telefono, p.email, p.lavoro,
              p.inviato_da, p.diagnosi, p.tipo_intervento, p.data_intervento,
              p.arto_operato, pat.nome AS patologia, f.nome AS fase_corrente,
              p.stato, p.follow_up_il, p.contattato_il,
              (SELECT COUNT(*) FROM sedute s WHERE s.paziente_id = p.id) AS sedute,
              (SELECT MAX(s.data) FROM sedute s WHERE s.paziente_id = p.id) AS ultima_seduta
       FROM pazienti p
       LEFT JOIN patologie pat ON pat.id = p.patologia_id
       LEFT JOIN fasi f ON f.id = p.fase_corrente_id
       ORDER BY p.cognome, p.nome`),
    [
      'cognome',
      'nome',
      'data_nascita',
      'telefono',
      'email',
      'lavoro',
      'inviato_da',
      'diagnosi',
      'tipo_intervento',
      'data_intervento',
      'arto_operato',
      'patologia',
      'fase_corrente',
      'stato',
      'follow_up_il',
      'contattato_il',
      'sedute',
      'ultima_seduta'
    ]
  )

  scriviCsv(
    join(dest, 'anamnesi.csv'),
    q(`SELECT p.cognome, p.nome, a.motivo_consulto, a.dolore_notturno, a.disturbi_sonno,
              a.tosse_starnuto, a.sintomi_neurologici, a.relazione_sintomi, a.note,
              att.attivita, att.partecipazione, att.fattori_interni,
              r.traumi, r.interventi, r.riabilitazioni, r.bioimmagini_note
       FROM pazienti p
       LEFT JOIN anamnesi_prossima a ON a.paziente_id = p.id
       LEFT JOIN anamnesi_attivita att ON att.paziente_id = p.id
       LEFT JOIN anamnesi_remota r ON r.paziente_id = p.id
       ORDER BY p.cognome, p.nome`),
    [
      'cognome',
      'nome',
      'motivo_consulto',
      'dolore_notturno',
      'disturbi_sonno',
      'tosse_starnuto',
      'sintomi_neurologici',
      'relazione_sintomi',
      'note',
      'attivita',
      'partecipazione',
      'fattori_interni',
      'traumi',
      'interventi',
      'riabilitazioni',
      'bioimmagini_note'
    ]
  )

  scriviCsv(
    join(dest, 'sintomi.csv'),
    q(`SELECT p.cognome, p.nome, s.descrizione, s.andamento, s.da_quanto, s.episodio,
              s.esordio, s.traumatico, s.comportamento, s.aggrava, s.allevia
       FROM anamnesi_sintomi s JOIN pazienti p ON p.id = s.paziente_id
       ORDER BY p.cognome, p.nome, s.ordine, s.id`),
    [
      'cognome',
      'nome',
      'descrizione',
      'andamento',
      'da_quanto',
      'episodio',
      'esordio',
      'traumatico',
      'comportamento',
      'aggrava',
      'allevia'
    ]
  )

  scriviCsv(
    join(dest, 'obiettivi.csv'),
    q(`SELECT p.cognome, p.nome, o.testo, o.termine
       FROM obiettivi_terapeutici o JOIN pazienti p ON p.id = o.paziente_id
       ORDER BY p.cognome, p.nome, o.ordine, o.id`),
    ['cognome', 'nome', 'testo', 'termine']
  )

  scriviCsv(
    join(dest, 'sedute.csv'),
    q(`SELECT p.cognome, p.nome, s.data, f.nome AS fase, sez.nome AS sezione,
              e.nome AS esercizio, c.nome AS categoria, se.serie, se.cluster, se.ripetizioni,
              se.carico, se.recupero_cluster, se.recupero, se.nota, s.note AS note_seduta
       FROM seduta_esercizi se
       JOIN sedute s ON s.id = se.seduta_id
       JOIN pazienti p ON p.id = s.paziente_id
       JOIN esercizi e ON e.id = se.esercizio_id
       JOIN categorie c ON c.id = e.categoria_id
       LEFT JOIN fasi f ON f.id = s.fase_id
       LEFT JOIN seduta_sezioni sez ON sez.id = se.seduta_sezione_id
       ORDER BY p.cognome, p.nome, s.data, se.ordine, se.id`),
    [
      'cognome',
      'nome',
      'data',
      'fase',
      'sezione',
      'esercizio',
      'categoria',
      'serie',
      'cluster_per_serie',
      'ripetizioni',
      'carico',
      'recupero_tra_i_cluster',
      'recupero',
      'nota',
      'note_seduta'
    ]
  )

  scriviCsv(
    join(dest, 'valutazioni.csv'),
    q(`SELECT p.cognome, p.nome, v.data, d.nome AS distretto, m.nome AS movimento,
              vm.attivo_restrizione, vm.attivo_dolore, vm.attivo_gradi,
              vm.passivo_restrizione, vm.passivo_dolore, vm.passivo_gradi,
              vd.nota_attivo, vd.nota_passivo, v.ispezione, v.note
       FROM valutazione_movimenti vm
       JOIN valutazioni v ON v.id = vm.valutazione_id
       JOIN pazienti p ON p.id = v.paziente_id
       JOIN distretto_movimenti m ON m.id = vm.movimento_id
       JOIN distretti d ON d.id = m.distretto_id
       LEFT JOIN valutazione_distretti vd
         ON vd.valutazione_id = v.id AND vd.distretto_id = d.id
       ORDER BY p.cognome, p.nome, v.data, d.nome, m.ordine, m.id`),
    [
      'cognome',
      'nome',
      'data',
      'distretto',
      'movimento',
      'attivo_restrizione',
      'attivo_dolore',
      'attivo_gradi',
      'passivo_restrizione',
      'passivo_dolore',
      'passivo_gradi',
      'nota_attivo',
      'nota_passivo',
      'ispezione',
      'note'
    ]
  )

  scriviCsv(
    join(dest, 'questionari.csv'),
    q(`SELECT p.cognome, p.nome, pq.data, q.nome AS questionario, pq.fascia AS esito,
              (SELECT group_concat(cp.nome || ' ' || cp.valore, ' · ')
               FROM compilazione_punteggi cp WHERE cp.compilazione_id = pq.id) AS punteggi,
              pq.note
       FROM paziente_questionari pq
       JOIN pazienti p ON p.id = pq.paziente_id
       JOIN questionari q ON q.id = pq.questionario_id
       ORDER BY p.cognome, p.nome, pq.data`),
    ['cognome', 'nome', 'data', 'questionario', 'punteggi', 'esito', 'note']
  )

  scriviCsv(
    join(dest, 'screening.csv'),
    q(`SELECT p.cognome, p.nome, ss.data, ss.protocollo_nome AS protocollo, ss.sport,
              t.nome AS test, mi.nome AS misura, mi.unita, sv.lato, sv.prova, sv.valore,
              ss.note
       FROM screening_valori sv
       JOIN screening_sessioni ss ON ss.id = sv.sessione_id
       JOIN pazienti p ON p.id = ss.paziente_id
       JOIN test_misure mi ON mi.id = sv.misura_id
       JOIN test_valutazione t ON t.id = mi.test_id
       ORDER BY p.cognome, p.nome, ss.data, t.nome, mi.ordine, sv.prova`),
    [
      'cognome',
      'nome',
      'data',
      'protocollo',
      'sport',
      'test',
      'misura',
      'unita',
      'lato',
      'prova',
      'valore',
      'note'
    ]
  )

  writeFileSync(join(dest, 'leggimi.txt'), LEGGIMI, 'utf-8')
  return dest
}
