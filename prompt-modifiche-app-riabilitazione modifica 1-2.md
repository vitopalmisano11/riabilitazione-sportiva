# Prompt di modifica — App Riabilitazione Sportiva (v1 → v1.1)

Ho testato la prima versione dell'app e funziona bene come base. Ecco una serie di modifiche/aggiunte da implementare.

## 1. Struttura della seduta per fase (configurazione)
Nella configurazione di ogni fase di una patologia, manca la possibilità di definire la **struttura della seduta**: una sequenza ordinata di sezioni (es. Riscaldamento, Mobilità, Pliometria, Rinforzo...) a cui vengono associate le categorie di esercizi disponibili per quella fase.

- Questa struttura è il template usato di default quando creo una nuova seduta per un paziente in quella fase.
- Deve restare **modificabile nella singola seduta**: se in un caso specifico voglio uscire dallo schema (aggiungere/togliere una sezione, cambiarne l'ordine) per quella seduta, deve essere possibile senza toccare il template della fase.

## 2. Obiettivi: stato persistente "raggiunto" sul paziente
Attualmente (presumo) gli obiettivi si selezionano ad ogni seduta. Cambiare la logica:

- La spunta su un obiettivo, fatta nella sezione obiettivi del diario paziente, significa **"obiettivo raggiunto"** — è uno stato persistente sul paziente, non per singola seduta.
- Una volta flaggato come raggiunto, l'obiettivo **resta visibile ma barrato/segnato come completato** nelle sedute successive (non sparisce dalla vista).
- Gli obiettivi **non flaggati** sono quelli ancora da lavorare: sono questi a guidare la selezione delle categorie/esercizi proposti quando creo una nuova seduta.

## 3. Checklist "Test di avanzamento" per fase
Aggiungere una funzionalità di test funzionali legati al passaggio da una fase alla successiva:

- **In configurazione** (sezione Patologie e Fasi): per ogni fase, poter definire una checklist di test di avanzamento (opzionale — utile per patologie come LCA, non necessaria per tutte). Ogni test ha: nome del test + un campo per registrare un valore (es. unità di misura, numero di ripetizioni del test funzionale).
- **Nel diario paziente**, nella sezione obiettivi, aggiungere una casella cliccabile "Test di avanzamento" che apre questa checklist: posso flaggare ogni test man mano che lo eseguo e compilare il campo valore accanto.
- **Importante:** questa checklist è solo informativa/di supporto. **Non deve bloccare il cambio di fase** — resta sempre una mia decisione manuale avanzare il paziente alla fase successiva, anche se non tutti i test sono flaggati.

## 4. Campo "recupero" negli esercizi
Aggiungere un campo **recupero** (tempo di riposo) per ogni esercizio:
- Configurabile come valore di default in libreria esercizi, esattamente come serie/ripetizioni/carico.
- Modificabile per la singola seduta caso per caso.
- Va posizionato nello schema seduta **tra il campo carico e il campo note**.

## 5. Riordino categorie di esercizi
Nella configurazione della struttura di una fase, aggiungere **frecce su/giù** per riordinare le categorie di esercizi secondo la sequenza di successione riabilitativa desiderata (es. prima mobilità, poi rinforzo, poi pliometria).

## 6. Cartella di destinazione per l'export
L'export attualmente salva i file in una posizione fissa (desktop). Cambiare in modo che io possa **scegliere la cartella di destinazione** al momento dell'export (dialog di selezione cartella standard di Windows), invece di un percorso fisso.

## 7. Bug di interfaccia da correggere
- Il testo va a capo in modo poco leggibile in alcuni punti — sembra che le righe siano troppo corte rispetto al contenuto, con effetto "troppo grande"/sproporzionato. Serve rivedere il ridimensionamento/responsive del testo nei riquadri.
- Nella sezione "schema della seduta", il campo **carico** esce visivamente dal riquadro dello schema seduta (probabile problema di layout/overflow del contenitore). Va corretto in modo che resti contenuto correttamente all'interno del box.

## 8. Riorganizzazione menu laterale (home)
- Rinominare la voce "LAVORO QUOTIDIANO" nel menu a sinistra in **"DIARIO PAZIENTI"**.
- Spostare "CONFIGURAZIONE" in fondo al menu, **sopra le caselle di dati e backup**: deve restare una voce cliccabile che apre una finestra/pannello con le sotto-sezioni configurabili (patologie e fasi, categorie di esercizi, ecc.).
- In quella stessa area di configurazione, aggiungere anche l'opzione per **cambiare la cartella di destinazione dell'export** (vedi punto 6) — è il posto più logico per quell'impostazione, quindi va spostata/collocata lì se non lo è già.

## 9. Chiarezza degli esercizi: link video
Aggiungere alla libreria esercizi un campo **link** opzionale (URL incollato manualmente, es. link a un video YouTube):
- Nessuna ricerca automatica: sono io a incollare il link che preferisco per ogni esercizio.
- In visualizzazione, il link **non deve apparire come testo sottolineato**: mostrare una piccola **icona cliccabile** (es. icona "play"/videocamera) accanto al nome dell'esercizio, visibile solo se il campo è compilato, che apre il link nel browser predefinito al click.

## 10. Bug: caselle "sezioni della seduta" troppo strette
Nella configurazione della struttura della seduta, le caselle con il nome delle sezioni (es. "Mobilità") sono troppo strette: il testo va a capo dopo pochi caratteri, spezzando le parole (es. "Mob-ilità"). Allargare le caselle o gestire meglio il wrap del testo così che i nomi restino leggibili su una riga o vadano a capo per parole intere, non a metà parola.

## 11. Rifiniture — Libreria esercizi
- Dare più spazio alla colonna del nome esercizio così che il testo non vada a capo (la dimensione del carattere va bene così com'è, è solo questione di larghezza colonna).
- Centrare il numero di serie nella sua colonna (attualmente allineato a sinistra).
- Nella schermata di modifica esercizio, allineare i campi serie, ripetizioni, carico e recupero **sulla stessa riga** (attualmente sono sfalsati tra loro).

## 12. Rifiniture — Categorie esercizi e struttura seduta
- Aggiungere freccette per riordinare l'elenco delle **categorie esercizi** nella libreria generale (nota: questo è distinto dal punto successivo).
- Nella sotto-sezione "categorie della sezione" (dentro Struttura della seduta), **rimuovere** le freccette attualmente presenti ma non funzionanti — non sono necessarie in quel punto.
- Ridurre la spaziatura verticale tra le "altre categorie" elencate in quella stessa sotto-sezione, mantenendola comunque ben leggibile — allinearla alla spaziatura già usata tra le sezioni della seduta (es. distanza attuale tra "Mobilità" e "Attivazione del quadricipite").

## 13. Diario paziente: rinomina e download
- Rinominare il pulsante "Apri" in **"Modifica"** (più chiaro: apre la seduta per modificarla).
- Aggiungere un'**icona di download**: al click apre un menu a tendina con le opzioni **PDF** e **Word** per scaricare la seduta in quel formato.

---
*Nota: alcune modifiche più corpose (redesign completo della sezione Configurazione, upload immagini esercizi, libreria "Test di valutazione", anteprima seduta) sono state separate in un secondo prompt da inviare dopo aver testato questo blocco.*
