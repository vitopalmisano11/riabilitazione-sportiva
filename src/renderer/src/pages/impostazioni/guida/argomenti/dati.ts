import type { ArgomentoGuida } from '../modello'

// Era la finestra «Come vengono conservati i miei dati?» di Dati e backup.
export const dati: ArgomentoGuida = {
  id: 'dati',
  titolo: 'Dati, copie e chiave di recupero',
  breve: 'Dove stanno i dati, le copie di sicurezza, il cestino, cosa fare se il computer si rompe',
  parole: [
    'backup',
    'password',
    'dimenticata',
    'ripristino',
    'onedrive',
    'chiavetta',
    'excel',
    'cifrato',
    'privacy',
    'cancellare paziente',
    'nuovo computer'
  ],
  blocchi: [
    {
      titolo: 'Dove stanno i dati',
      elementi: [
        'Tutto quello che scrivi — pazienti, sedute, anamnesi, valutazioni, questionari, screening, foto e referti — vive in **due soli file**, dentro la **Cartella dei dati** ([[Impostazioni > Dati e backup]]):',
        {
          punti: [
            '**riabilitazione.db** è l’archivio vero e proprio, ed è **cifrato**: aperto senza l’app non si legge niente, nemmeno con Word o Excel.',
            '**auth.json** contiene le chiavi che lo aprono, chiuse a loro volta dalla tua password.'
          ]
        },
        '**Servono tutti e due insieme.** Con il solo archivio non si apre niente, nemmeno sapendo la password. Quando copi qualcosa a mano, copia la cartella intera.',
        'Il programma in sé sta altrove e **non contiene dati**: si può disinstallare e rimettere senza toccare la cartella. Per questo l’app si aggiorna senza rischi per l’archivio.'
      ]
    },
    {
      titolo: 'Le copie di sicurezza',
      elementi: [
        'L’app fa una copia **da sola**: una al primo avvio della giornata e una alla chiusura, che sostituisce quella del giorno così contiene anche il lavoro appena fatto. In pratica hai **una copia per ogni giornata in cui lavori**. Quante tenerne lo decidi tu con **Copie da tenere**: le più vecchie si cancellano da sole.',
        'Ogni copia è una cartella con la data nel nome, e dentro ci sono **entrambi** i file: è una copia da cui si ripristina davvero.',
        'Per ogni copia, nella scheda [[Impostazioni > Dati e backup]], trovi due pulsanti:',
        {
          punti: [
            '**Controlla** la apre davvero in disparte e ti dice se è buona e quanti pazienti contiene, senza toccare l’archivio che stai usando. È l’unica verifica che una copia automatica non può fare da sé: fallo ogni tanto.',
            '**Ripristina** riporta l’archivio a com’era in quella copia. Tutto quello che hai fatto dopo quella data sparisce, quindi prima l’app mette da parte anche lo stato attuale: se sbagli copia, si torna indietro.'
          ]
        }
      ]
    },
    {
      titolo: 'Come mandare le copie online (OneDrive)',
      elementi: [
        {
          passi: [
            'Apri [[Impostazioni > Dati e backup]].',
            'Premi **Metti in OneDrive**. Si fa **una volta sola**.'
          ]
        },
        'Da quel momento la cartella delle copie sta dentro OneDrive e le copie vanno online da sole. Online finisce l’archivio cifrato, cioè un file illeggibile per chiunque non abbia la tua password.'
      ]
    },
    {
      titolo: 'I tre modi di portare i dati fuori',
      elementi: [
        'Il pulsante **Fai una copia** ([[Impostazioni > Dati e backup > Fai una copia]]) apre tre strade che servono a cose diverse:',
        {
          punti: [
            '**Qui, nella cartella delle copie**: una copia in più, adesso, insieme alle automatiche. Utile prima di fare qualcosa di grosso.',
            '**Su chiavetta o disco esterno**: la stessa cosa, ma dove dici tu. È la copia da tenere fuori casa: quelle automatiche stanno sullo stesso disco dell’archivio e se il disco si rompe se ne vanno insieme.',
            '**In tabelle Excel**: qui cambia tutto. Non è una copia da cui si ripristina, è l’archivio riscritto in tabelle **leggibili senza il programma** — pazienti con i contatti, sedute, valutazioni, questionari, screening. Serve a garantire che i dati restino tuoi anche fra dieci anni, qualunque cosa succeda all’app. **Attenzione**: queste tabelle sono in chiaro, chiunque le apra legge nomi, telefoni e diagnosi. Tienile su una chiavetta in un cassetto, non in cloud.'
          ]
        }
      ]
    },
    {
      titolo: 'Il cestino',
      elementi: [
        'Quello che elimini non sparisce subito: resta nel cestino **un mese**, poi se ne va da solo. Vale sia per i dati dei pazienti sia per la libreria (esercizi, patologie, questionari, test). Dal cestino si rimette a posto com’era, con tutto quello che ci stava attaccato. Il cestino sta in fondo a [[Impostazioni > Dati e backup]].',
        'Se un paziente chiede di essere cancellato:',
        {
          passi: [
            'Eliminalo dalla sua scheda.',
            'Apri il cestino ([[Impostazioni > Dati e backup]]) e premi **Elimina definitivamente** accanto al suo nome. Sparisce subito dall’archivio.',
            'Cancella a mano i file che stanno fuori dall’archivio: le copie di sicurezza già fatte, le tabelle Excel e i PDF che hai creato. Le copie automatiche più vecchie si scartano da sole.'
          ]
        }
      ]
    },
    {
      titolo: 'La chiave di recupero',
      elementi: [
        'Se dimentichi la password, la chiave di recupero è l’unico modo di rientrare. **Se perdi tutte e due, l’archivio non si apre più**: non c’è nessuno che possa recuperarlo, ed è la stessa protezione che tiene fuori chiunque altro.',
        'Tienila dove tieni i documenti importanti, e **non nello stesso posto dove finiscono le copie**: chiave e archivio insieme sono come lasciare la chiave nella toppa.'
      ]
    },
    {
      titolo: 'Se il computer si rompe',
      elementi: [
        {
          passi: [
            'Installa l’app su un altro computer.',
            'Copia i **due file** (riabilitazione.db e auth.json) da una copia di sicurezza nella cartella dei dati.',
            'Entra con la solita password.'
          ]
        },
        'Non si perde niente: quello che manca è solo il lavoro fatto dopo l’ultima copia.'
      ]
    }
  ]
}
