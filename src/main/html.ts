// Testo che finisce dentro a un HTML generato (fogli stampati, referti, PDF).
// Le virgolette si scrivono anche loro: lo stesso testo puo' finire dentro a un
// attributo (href, src), dove una virgoletta chiuderebbe il valore.
export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
