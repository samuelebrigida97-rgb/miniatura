// Su che dispositivo sta girando Jarvis. Serve perché Apple e Android trattano
// microfono, voce e schermo in modo diverso.
const ua = navigator.userAgent || '';

// iPadOS si presenta come un Mac: lo si riconosce dal touch.
export const IOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
export const ANDROID = /Android/i.test(ua);
export const MOBILE = IOS || ANDROID;

// Aperto dall'icona sulla schermata Home (a tutto schermo, senza barra del browser).
export const STANDALONE = window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)').matches;

// Su iPhone e iPad il microfono funziona solo con Safari: Chrome, Firefox ed Edge per Apple non lo offrono.
export const IOS_OTHER_BROWSER = IOS && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);

export function deviceName() {
  if (IOS) return /iPhone|iPod/i.test(ua) ? 'iPhone' : 'iPad';
  if (ANDROID) return /Mobile/i.test(ua) ? 'telefono Android' : 'tablet Android';
  return 'computer';
}
