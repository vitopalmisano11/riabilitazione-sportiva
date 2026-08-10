// Ripulisce i messaggi d'errore che arrivano via IPC dal prefisso tecnico di Electron.
export function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  return m.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
