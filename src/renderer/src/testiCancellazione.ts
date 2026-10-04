// Cosa succede ai dati quando si cancella per sempre, detto una volta sola: lo
// leggono la scheda del paziente e il cestino.
//
// Cancellare dall'archivio non tocca i file che stanno fuori: le copie di
// sicurezza (automatiche, su chiavetta, in OneDrive), le tabelle Excel e i PDF
// gia' creati. Chi cancella per sbaglio una cosa e la crede sparita deve saperlo.
export const COSA_RESTA_NELLE_COPIE =
  'Resta invece dove sono già finiti i dati: nelle copie di sicurezza già fatte (quelle automatiche, quelle su chiavetta o in OneDrive), nelle tabelle Excel e nei PDF che hai creato. Le copie automatiche più vecchie si scartano da sole man mano che ne fai di nuove; per il resto, se vuoi che sparisca anche da lì, vanno cancellati a mano.'
