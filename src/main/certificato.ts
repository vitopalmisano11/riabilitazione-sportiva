// Certificato di presenza: il foglio che il paziente porta al datore di lavoro
// per giustificare l'assenza durante la seduta.
//
// Tutto quello che si stampa arriva gia' nei dati: chi lo genera (la finestra
// nella scheda del paziente) ha gia' fatto compilare quello che mancava. Qui si
// controlla solo che il foglio abbia senso e si compone l'HTML. Senza niente di
// Electron dentro, cosi' si prova anche fuori dall'app (lo smoke test).
import { coloriTema } from '../shared/temi'
import type { CertificatoInput } from '../shared/types'
import { esc } from './html'

const ORA = /^([01]\d|2[0-3]):[0-5]\d$/
const DATA = /^\d{4}-\d{2}-\d{2}$/

function data(iso: string): string {
  const [a, m, g] = iso.split('-')
  return `${g}/${m}/${a}`
}

// Un foglio sbagliato finisce in mano al datore di lavoro: meglio fermarsi qui
// con una frase chiara che stamparlo incompleto.
export function validaCertificato(c: CertificatoInput): void {
  const pieno = (v: string | null): boolean => (v ?? '').trim() !== ''
  if (!pieno(c.professionista.nome)) throw new Error('Manca il tuo nome e cognome.')
  if (!pieno(c.professionista.numero_iscrizione)) {
    throw new Error("Manca il numero di iscrizione all'Ordine (OFI).")
  }
  if (!pieno(c.paziente.nome) || !pieno(c.paziente.cognome)) {
    throw new Error('Mancano nome e cognome del paziente.')
  }
  if (!c.paziente.data_nascita || !DATA.test(c.paziente.data_nascita)) {
    throw new Error('Manca la data di nascita del paziente.')
  }
  if (!pieno(c.paziente.codice_fiscale)) throw new Error('Manca il codice fiscale del paziente.')
  if (!DATA.test(c.data)) throw new Error('Manca la data della seduta.')
  if (!ORA.test(c.ora_inizio) || !ORA.test(c.ora_fine)) {
    throw new Error("Scrivi l'ora di inizio e quella di fine della seduta.")
  }
  if (c.ora_fine <= c.ora_inizio) {
    throw new Error("L'ora di fine deve essere dopo quella di inizio.")
  }
  if (!DATA.test(c.data_emissione)) throw new Error('Manca la data di emissione.')
}

export function generaCertificatoHtml(c: CertificatoInput): string {
  validaCertificato(c)
  const { accento } = coloriTema()
  const pr = c.professionista
  const contatti = [pr.indirizzo, pr.telefono, pr.email]
    .filter((v) => (v ?? '').trim() !== '')
    .map((v) => esc(String(v)))
    .join(' &nbsp;·&nbsp; ')
  const nomePaziente = `${c.paziente.nome.trim()} ${c.paziente.cognome.trim()}`

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 22mm 20mm; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1f2733; font-size: 13.5px;
         line-height: 1.55; margin: 0; }
  .pagina { min-height: 250mm; display: flex; flex-direction: column; }
  .intestazione { border-bottom: 2px solid ${accento}; padding-bottom: 10px; }
  .intestazione .nome { font-size: 19px; font-weight: 700; color: ${accento}; }
  .intestazione .titolo { font-size: 14px; font-weight: 600; margin-top: 2px; }
  .intestazione .iscrizione { font-size: 12.5px; color: #555b66; }
  .intestazione .contatti { font-size: 12px; color: #555b66; margin-top: 6px; }
  h1 { font-size: 19px; text-align: center; letter-spacing: 0.08em; margin: 34px 0 26px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: ${accento};
       margin: 0 0 8px; }
  table.dati { border-collapse: collapse; margin-bottom: 26px; }
  table.dati td { padding: 3px 18px 3px 0; vertical-align: top; border: none; }
  table.dati td.et { color: #6b7280; width: 150px; }
  .attestazione { margin: 0 0 12px; text-align: justify; }
  .attestazione strong { font-weight: 600; }
  .nota-viaggio { color: #555b66; font-size: 12.5px; }
  .fondo { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end;
           gap: 40px; padding-top: 60px; }
  .fondo .emissione { font-size: 13px; }
  .fondo .firma { width: 230px; text-align: center; }
  .fondo .firma .riga { border-top: 1px solid #1f2733; padding-top: 4px; font-size: 12px;
                        color: #555b66; }
</style>
</head>
<body>
<div class="pagina">
  <div class="intestazione">
    <div class="nome">${esc(pr.nome ?? '')}</div>
    ${(pr.qualifica ?? '').trim() ? `<div class="titolo">${esc(pr.qualifica ?? '')}</div>` : ''}
    <div class="iscrizione">Iscritto all'Ordine dei Fisioterapisti (OFI) · n. ${esc(
      pr.numero_iscrizione ?? ''
    )}</div>
    ${contatti ? `<div class="contatti">${contatti}</div>` : ''}
  </div>

  <h1>CERTIFICATO DI PRESENZA</h1>

  <h2>Dati del paziente</h2>
  <table class="dati">
    <tr><td class="et">Nome e cognome</td><td>${esc(nomePaziente)}</td></tr>
    <tr><td class="et">Data di nascita</td><td>${esc(data(c.paziente.data_nascita ?? ''))}</td></tr>
    <tr><td class="et">Codice fiscale</td><td>${esc((c.paziente.codice_fiscale ?? '').trim().toUpperCase())}</td></tr>
  </table>

  <h2>Prestazione</h2>
  <p class="attestazione">Si certifica che la persona sopra indicata ha effettuato
    una <strong>seduta di fisioterapia</strong> (trattamento riabilitativo) in data
    <strong>${esc(data(c.data))}</strong>, dalle ore <strong>${esc(c.ora_inizio)}</strong>
    alle ore <strong>${esc(c.ora_fine)}</strong>.</p>
  ${
    c.comprende_viaggio
      ? '<p class="nota-viaggio">La fascia oraria indicata comprende il tempo stimato per il viaggio.</p>'
      : ''
  }

  <div class="fondo">
    <div class="emissione">Data di emissione: <strong>${esc(data(c.data_emissione))}</strong></div>
    <div class="firma"><div class="riga">Firma</div></div>
  </div>
</div>
</body>
</html>`
}
