@echo off
title Riabilitazione - VERSIONE DI PROVA (non chiudere questa finestra)
cd /d "%~dp0.."

rem Se npm non e' nel percorso (finestra aperta prima di installare Node), lo aggiungo.
where npm >nul 2>&1 || set "PATH=%PATH%;%ProgramFiles%\nodejs"
where npm >nul 2>&1 || (
  echo.
  echo   ERRORE: non trovo Node.js. Riavvia il computer e riprova.
  echo.
  pause
  exit /b 1
)

echo.
echo   Sto avviando la versione di PROVA di Riabilitazione Sportiva.
echo   Ci vogliono una decina di secondi: la finestra dell app si apre da sola.
echo.
echo   NON chiudere questa finestra nera mentre usi l app.
echo   Per spegnere tutto: chiudi l app, poi chiudi questa finestra.
echo.
call npm run dev
echo.
echo   Versione di prova chiusa. Puoi chiudere questa finestra.
pause
