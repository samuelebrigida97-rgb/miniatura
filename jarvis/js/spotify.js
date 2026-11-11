// Controllo completo di Spotify tramite Web API (login PKCE, nessun server necessario).
// Richiede: Spotify Premium + un'app gratuita creata su developer.spotify.com (Client ID).
import { store, getSettings } from './store.js';

const AUTH = 'https://accounts.spotify.com/authorize';
const TOKEN = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';

export function redirectUri() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const spotify = {
  isConnected() {
    return !!store.get('spotifyToken', null);
  },

  async connect() {
    const { spotifyClientId } = getSettings();
    if (!spotifyClientId) throw new Error('Manca il Client ID di Spotify nelle impostazioni.');
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    store.set('spotifyVerifier', verifier);
    const params = new URLSearchParams({
      client_id: spotifyClientId,
      response_type: 'code',
      redirect_uri: redirectUri(),
      code_challenge_method: 'S256',
      code_challenge: challenge,
      scope: SCOPES,
    });
    location.href = `${AUTH}?${params}`;
  },

  disconnect() {
    store.remove('spotifyToken');
  },

  // Da chiamare all'avvio: se Spotify ci ha rimandato qui con ?code=..., completa il login.
  async handleRedirect() {
    const url = new URL(location.href);
    const code = url.searchParams.get('code');
    const err = url.searchParams.get('error');
    if (!code && !err) return null;
    history.replaceState(null, '', redirectUri());
    if (err) return { ok: false, error: err };
    const { spotifyClientId } = getSettings();
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: spotifyClientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(),
        code_verifier: store.get('spotifyVerifier', ''),
      }),
    });
    if (!res.ok) return { ok: false, error: await res.text() };
    this._saveToken(await res.json());
    return { ok: true };
  },

  _saveToken(t) {
    const old = store.get('spotifyToken', {}) || {};
    store.set('spotifyToken', {
      access: t.access_token,
      refresh: t.refresh_token || old.refresh,
      expires: Date.now() + (t.expires_in - 60) * 1000,
    });
  },

  async _token() {
    const t = store.get('spotifyToken', null);
    if (!t) throw new Error('Spotify non è collegato. Collegalo dalle impostazioni.');
    if (Date.now() < t.expires) return t.access;
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: getSettings().spotifyClientId,
        grant_type: 'refresh_token',
        refresh_token: t.refresh,
      }),
    });
    if (!res.ok) {
      this.disconnect();
      throw new Error('La sessione Spotify è scaduta: ricollegalo dalle impostazioni.');
    }
    this._saveToken(await res.json());
    return store.get('spotifyToken').access;
  },

  async api(method, path, body) {
    const token = await this._token();
    const res = await fetch(API + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204 || res.status === 202) return null;
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const msg = data?.error?.message || res.statusText;
      if (res.status === 403) throw new Error(`Spotify ha rifiutato il comando (serve Premium?): ${msg}`);
      if (res.status === 404) throw new Error('Nessun dispositivo Spotify attivo: apri l\'app Spotify sul tablet e fai partire un brano una volta.');
      throw new Error(`Errore Spotify: ${msg}`);
    }
    return data;
  },

  async _device() {
    const { devices = [] } = (await this.api('GET', '/me/player/devices')) || {};
    if (!devices.length) {
      throw new Error('Nessun dispositivo Spotify trovato: apri l\'app Spotify sul tablet (o sull\'Alexa) e riprova.');
    }
    return devices.find((d) => d.is_active) || devices.find((d) => /tablet|smartphone/i.test(d.type)) || devices[0];
  },

  async play(query, type = 'track') {
    const kind = ['track', 'artist', 'album', 'playlist'].includes(type) ? type : 'track';
    const q = new URLSearchParams({ q: query, type: kind, limit: '1' });
    const data = await this.api('GET', `/search?${q}`);
    const item = data?.[`${kind}s`]?.items?.find(Boolean);
    if (!item) return { ok: false, messaggio: `Non ho trovato "${query}" su Spotify.` };
    const device = await this._device();
    const body = kind === 'track' ? { uris: [item.uri] } : { context_uri: item.uri };
    await this.api('PUT', `/me/player/play?device_id=${device.id}`, body);
    const who = item.artists ? ` di ${item.artists.map((a) => a.name).join(', ')}` : '';
    return { ok: true, in_riproduzione: `${item.name}${who}`, dispositivo: device.name };
  },

  async control(action, value) {
    switch (action) {
      case 'pausa': await this.api('PUT', '/me/player/pause'); break;
      case 'riprendi': await this.api('PUT', '/me/player/play'); break;
      case 'successivo': await this.api('POST', '/me/player/next'); break;
      case 'precedente': await this.api('POST', '/me/player/previous'); break;
      case 'volume': {
        const v = Math.max(0, Math.min(100, Math.round(Number(value) || 50)));
        await this.api('PUT', `/me/player/volume?volume_percent=${v}`);
        break;
      }
      case 'shuffle': await this.api('PUT', `/me/player/shuffle?state=${value !== 'off'}`); break;
      default: return { ok: false, messaggio: `Azione sconosciuta: ${action}` };
    }
    return { ok: true };
  },

  async nowPlaying() {
    const d = await this.api('GET', '/me/player');
    if (!d || !d.item) return { in_riproduzione: false };
    return {
      in_riproduzione: d.is_playing,
      brano: d.item.name,
      artista: (d.item.artists || []).map((a) => a.name).join(', '),
      volume: d.device?.volume_percent,
      dispositivo: d.device?.name,
    };
  },

  // Abbassa la musica mentre parliamo, e la rialza dopo.
  async duck() {
    if (!this.isConnected() || this._ducked != null) return;
    try {
      const d = await this.api('GET', '/me/player');
      if (d?.is_playing && d.device?.volume_percent > 25) {
        this._ducked = d.device.volume_percent;
        await this.api('PUT', '/me/player/volume?volume_percent=20');
      }
    } catch { /* non fondamentale */ }
  },

  async unduck() {
    if (this._ducked == null) return;
    const v = this._ducked;
    this._ducked = null;
    try { await this.api('PUT', `/me/player/volume?volume_percent=${v}`); } catch { /* ignore */ }
  },
};
