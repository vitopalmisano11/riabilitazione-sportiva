import { X } from 'lucide-react'

// La guida della sezione "Dati e backup".
//
// Qui dentro ci sono i pulsanti che decidono se i dati di una vita si perdono
// o no, e non sono tutti evidenti: la differenza fra una copia da cui si
// ripristina e delle tabelle leggibili, per esempio, si capisce solo se
// qualcuno la spiega. Sta in una finestra a parte perche' e' roba da leggere
// una volta e ritrovare quando serve, non da tenere sotto agli occhi ogni
// giorno.
export default function GuidaDati({ onChiudi }: { onChiudi: () => void }): React.JSX.Element {
  return (
    <div className="modal-overlay" onClick={onChiudi}>
      <div className="modal modal-lg guida-dati" onClick={(e) => e.stopPropagation()}>
        <div className="card-header-row">
          <h3>Come vengono conservati i tuoi dati</h3>
          <button title="Chiudi" onClick={onChiudi}>
            <X size={18} />
          </button>
        </div>

        <div className="sotto-titolo">Dove stanno i dati</div>
        <p>
          Tutto quello che scrivi — pazienti, sedute, anamnesi, valutazioni, questionari,
          screening, foto e referti — vive in <b>due soli file</b>, dentro la cartella indicata qui
          sopra in <i>Cartella dei dati</i>:
        </p>
        <ul>
          <li>
            <b>riabilitazione.db</b> è l&apos;archivio vero e proprio, ed è <b>cifrato</b>: aperto
            senza l&apos;app non si legge niente, nemmeno con Word o Excel.
          </li>
          <li>
            <b>auth.json</b> contiene le chiavi che lo aprono, chiuse a loro volta dalla tua
            password.
          </li>
        </ul>
        <p>
          <b>Servono tutti e due insieme.</b> Con il solo archivio non si apre niente, nemmeno
          sapendo la password. Quando copi qualcosa a mano, copia la cartella intera.
        </p>
        <p>
          Il programma in sé sta altrove e <b>non contiene dati</b>: si può disinstallare e
          rimettere senza toccare la cartella. È per questo che posso aggiornarti l&apos;app senza
          rischi per l&apos;archivio.
        </p>

        <div className="sotto-titolo">Le copie di sicurezza</div>
        <p>
          L&apos;app fa una copia <b>da sola</b>: una al primo avvio della giornata e una alla
          chiusura, che sostituisce quella del giorno così contiene anche il lavoro appena fatto.
          In pratica hai <b>una copia per ogni giornata in cui lavori</b>. Quante tenerne lo
          decidi tu con <i>Copie da tenere</i>: le più vecchie si cancellano da sole.
        </p>
        <p>
          Ogni copia è una cartella con la data nel nome, e dentro ci sono <b>entrambi</b> i file:
          è una copia da cui si ripristina davvero.
        </p>
        <p>
          <b>Metti in OneDrive</b> sposta la cartella delle copie dentro OneDrive: da quel momento
          le copie vanno online da sole, senza che tu debba ricordarti niente. Si preme{' '}
          <b>una volta sola</b>. Online finisce l&apos;archivio cifrato, cioè un file illeggibile
          per chiunque non abbia la tua password.
        </p>
        <p>
          <b>Controlla</b>, accanto a ogni copia, la apre davvero in disparte e ti dice se è
          buona e quanti pazienti contiene, senza toccare l&apos;archivio che stai usando. È
          l&apos;unica verifica che una copia automatica non può fare da sé: fallo ogni tanto.
        </p>
        <p>
          <b>Ripristina</b> riporta l&apos;archivio a com&apos;era in quella copia. Tutto quello
          che hai fatto dopo quella data sparisce, quindi prima l&apos;app mette da parte anche lo
          stato attuale: se sbagli copia, si torna indietro.
        </p>

        <div className="sotto-titolo">I tre modi di portare i dati fuori</div>
        <p>
          Il pulsante <b>Fai una copia</b> apre tre strade che servono a cose diverse:
        </p>
        <ul>
          <li>
            <b>Qui, nella cartella delle copie</b>: una copia in più, adesso, insieme alle
            automatiche. Utile prima di fare qualcosa di grosso.
          </li>
          <li>
            <b>Su chiavetta o disco esterno</b>: la stessa cosa, ma dove dici tu. È la copia da
            tenere fuori casa: quelle automatiche stanno sullo stesso disco dell&apos;archivio e
            se il disco si rompe se ne vanno insieme.
          </li>
          <li>
            <b>In tabelle Excel</b>: qui cambia tutto. Non è una copia da cui si ripristina, è
            l&apos;archivio riscritto in tabelle <b>leggibili senza il programma</b> — pazienti
            con i contatti, sedute, valutazioni, questionari, screening. Serve a garantire che i
            dati restino tuoi anche fra dieci anni, qualunque cosa succeda all&apos;app.{' '}
            <b>Attenzione</b>: queste tabelle sono in chiaro, chiunque le apra legge nomi,
            telefoni e diagnosi. Tienile su una chiavetta in un cassetto, non in cloud.
          </li>
        </ul>

        <div className="sotto-titolo">Il cestino</div>
        <p>
          Quello che elimini non sparisce subito: resta nel cestino <b>un mese</b>, poi se ne va da
          solo. Vale sia per i dati dei pazienti sia per la libreria (esercizi, patologie,
          questionari, test). Da lì si rimette a posto com&apos;era, con tutto quello che ci stava
          attaccato.
        </p>

        <div className="sotto-titolo">La chiave di recupero</div>
        <p>
          Se dimentichi la password, la chiave di recupero è l&apos;unico modo di rientrare.{' '}
          <b>Se perdi tutte e due, l&apos;archivio non si apre più</b>: non c&apos;è nessuno che
          possa recuperarlo, ed è la stessa protezione che tiene fuori chiunque altro.
        </p>
        <p>
          Tienila dove tieni i documenti importanti, e <b>non nello stesso posto dove finiscono le
          copie</b>: chiave e archivio insieme sono come lasciare la chiave nella toppa.
        </p>

        <div className="sotto-titolo">Se il computer si rompe</div>
        <p>
          Si installa l&apos;app su un altro computer, si copiano i due file da una copia di
          sicurezza nella cartella dei dati, e si entra con la solita password. Non si perde
          niente: quello che manca è solo il lavoro fatto dopo l&apos;ultima copia.
        </p>

        <div className="modal-actions">
          <button className="primary" onClick={onChiudi}>
            Ho capito
          </button>
        </div>
      </div>
    </div>
  )
}
