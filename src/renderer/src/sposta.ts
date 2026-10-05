// Sposta un elemento dalla posizione `da` alla posizione `a`, senza mutare l'originale.
export function sposta<T>(lista: T[], da: number, a: number): T[] {
  if (da === a || da < 0 || a < 0 || da >= lista.length || a >= lista.length) return lista
  const next = [...lista]
  const [elemento] = next.splice(da, 1)
  next.splice(a, 0, elemento)
  return next
}
