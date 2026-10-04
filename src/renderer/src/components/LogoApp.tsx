// Il logo dell'app dentro al programma: il riquadro bianco resta com'e', il
// disegno a cerchi prende il colore del tema (vedi .logo-app in styles.css).
// L'icona di Windows e dell'installer e' un file fisso e non puo' cambiare.
export default function LogoApp({ className }: { className: string }): React.JSX.Element {
  return <span className={className} aria-hidden="true" />
}
