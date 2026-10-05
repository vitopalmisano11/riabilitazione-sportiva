// Nelle prove, quello che si esegue dentro la pagina (pagina.evaluate) vede
// window.api come lo vede l'app.
import type { Api } from '../src/shared/types'

declare global {
  interface Window {
    api: Api
  }
}

export {}
