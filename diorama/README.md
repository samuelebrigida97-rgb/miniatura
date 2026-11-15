# Il Fiume della Vita · Manuale del diorama biblico

Web app (solo HTML, CSS e JavaScript, nessuna installazione) che guida passo passo
nella costruzione di un diorama della Bibbia 80 x 50 cm, dalla Genesi all'Apocalisse.

## Cosa c'è dentro
| File | A cosa serve |
|---|---|
| `index.html` | la pagina |
| `css/style.css` | colori e impaginazione |
| `js/data.js` | **tutti i testi**: tappe, fasi, materiali (modificali qui) |
| `js/board.js` | il disegno del tabellone in SVG, strato per strato |
| `js/app.js` | pulsanti, schede, lista con le spunte |

## Provarla sul computer
Doppio clic su `index.html`: si apre nel browser.

## Pubblicarla su Netlify (il modo più semplice)
1. Vai su https://app.netlify.com/drop e crea un account gratuito.
2. Trascina **la cartella `diorama`** nel riquadro della pagina.
3. Dopo qualche secondo Netlify ti dà un indirizzo tipo `https://nome-a-caso.netlify.app`.
4. In *Site configuration → Change site name* puoi scegliere un nome più bello.

## Pubblicarla da GitHub (si aggiorna da sola a ogni modifica)
1. Su Netlify: *Add new site → Import an existing project → GitHub* e scegli il repository.
2. **Base directory**: `diorama` · **Build command**: lascia vuoto · **Publish directory**: `diorama`.
3. *Deploy*.
