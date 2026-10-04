// La seduta stampata: PDF (HTML) e Word.
import { test } from 'vitest'
import { pazExport, seduteExport } from './fixture-seduta'
import assert from 'node:assert/strict'
import { generaDocx, generaHtml } from '../src/main/export-doc'

test('La scheda della seduta: tabella, dosaggi, escaping', () => {
  const html = generaHtml(pazExport, seduteExport)
  assert.ok(html.includes('Rossi') && html.includes('Seduta del 10/08/2026'))
  assert.ok(html.includes('Mobilizzazione &amp; scivolamenti rotulei')) // escaping HTML
  // La seduta si stampa con la stessa tabella della finestra che si mostra al
  // paziente: fascetta della sezione, e quattro colonne incolonnate.
  assert.ok(html.includes('Riscaldamento'))
  assert.ok(html.includes('class="fascetta"'), 'fascetta della sezione')
  assert.ok(html.includes('tabella-scheda'), 'tabella come quella a schermo')
  assert.ok(html.includes('<th>Recupero</th>'), 'intestazioni delle colonne')
  // nella sua colonna il recupero si scrive corto: "rec." lo dice gia'
  // l'intestazione
  assert.ok(html.includes('1 min'))
  assert.ok(!html.includes('rec. 1 min'), 'nella tabella il recupero non ripete rec.')
  assert.ok(html.includes('3 × 10'))
  // il RIR sta nella colonna del carico, accanto ai chili
  assert.ok(html.includes('60 kg · RIR 2'), 'carico e RIR nella stessa colonna')
  // il cluster: 4 x (3 x 2), e i due recuperi separati dalla barra
  assert.ok(html.includes('4 × (3 × 2)'), 'volume a cluster')
  // (le virgolette nel testo si scrivono &quot;: sullo schermo e' lo stesso segno)
  assert.ok(html.includes(`15&quot; / 2'`), 'recuperi a cluster nella colonna')
  // La scheda normale non porta mai foto, spiegazioni o link, anche se
  // l'esercizio li ha: e' quella corta per chi sa gia' cosa fare.
  assert.ok(!html.includes('<div class="scheda-es">'))
})

// La scheda illustrata, da consegnare a chi si allena da solo: foto, come si
// esegue e il link al video, che nel PDF resta cliccabile.
const conFoto = [
  {
    ...seduteExport[0],
    sezioni: [
      {
        nome: 'A casa',
        esercizi: [
          {
            ...seduteExport[0].sezioni[0].esercizi[0],
            nota_tecnica: 'Scendi lentamente, senza inarcare la schiena.',
            link: 'https://www.youtube.com/watch?v=abc',
            immagine: 'data:image/png;base64,iVBORw0KGgo='
          },
          { ...seduteExport[0].sezioni[0].esercizi[0], nome: 'Senza foto' }
        ]
      }
    ]
  }
]

test('La scheda illustrata: foto, come si esegue, link', () => {
  const illustrata = generaHtml(pazExport, conFoto, true)
  assert.ok(illustrata.includes('data:image/png;base64,iVBORw0KGgo='))
  assert.ok(illustrata.includes('Scendi lentamente'))
  // anche nella scheda illustrata i numeri si leggono come le colonne della
  // tabella: etichetta sopra, valore sotto
  assert.ok(illustrata.includes('class="numeri"'), 'numeri incolonnati')
  assert.ok(illustrata.includes('Serie × rip.'), 'etichette dei numeri')
  assert.ok(illustrata.includes('1 min'), 'il valore del recupero')
  // gli esercizi sono numerati, come in un programma da portare a casa
  assert.ok(illustrata.includes('<span class="num">1</span>'))
  assert.ok(illustrata.includes('<span class="num">2</span>'))
  assert.ok(illustrata.includes('href="https://www.youtube.com/watch?v=abc"'))
  // il riquadro della foto resta anche dove la foto manca: i cartelli della
  // stessa riga devono restare allineati
  assert.equal(illustrata.split('<div class="foto">').length - 1, 2)
  // ma se nella sezione non c'e' nessuna foto, i riquadri vuoti spariscono
  const senzaFoto = generaHtml(pazExport, [seduteExport[0]], true)
  assert.ok(
    senzaFoto.includes('<div class="scheda-es">') && !senzaFoto.includes('<div class="foto">')
  )
})

// un link che non e' web (javascript:, file:) non diventa cliccabile, e le
// virgolette dentro un attributo non lo chiudono prima del tempo
test('Un link che non e\' web non diventa cliccabile', () => {
  const es0 = conFoto[0].sezioni[0].esercizi[0]
  const cattivi = generaHtml(
    pazExport,
    [
      {
        ...conFoto[0],
        sezioni: [
          {
            nome: 'A casa',
            esercizi: [
              { ...es0, link: 'javascript:alert(1)' },
              { ...es0, nome: 'Squat', link: 'https://a.it/x"onmouseover="alert(1)' },
              { ...es0, nome: 'Foto', immagine: 'x" onerror="alert(1)' }
            ]
          }
        ]
      }
    ],
    true
  )
  assert.ok(!cattivi.includes('href="javascript'), 'un link javascript non e\' cliccabile')
  assert.ok(!cattivi.includes('"onmouseover="'), 'le virgolette non chiudono l\'attributo')
  assert.ok(!cattivi.includes('" onerror="'), 'nemmeno nell\'immagine')
  assert.ok(cattivi.includes('x&quot;onmouseover=&quot;'), 'le virgolette del link diventano testo')
  assert.ok(cattivi.includes('x&quot; onerror=&quot;'), 'e quelle dell\'immagine')
})

test('Il Word della seduta e\' un file vero', async () => {
  const docxBuf = await generaDocx(pazExport, seduteExport)
  assert.ok(docxBuf.length > 1000 && docxBuf[0] === 0x50 && docxBuf[1] === 0x4b) // magic 'PK' (zip)
})
