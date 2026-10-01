/**
 * Anmeldung für den Adminbereich.
 *
 * Warum eine eigene Anmeldung statt eines Tokens in der URL:
 *
 *   1. Pages liefert `admin.html` unter `/admin` direkt als Datei aus. Ein
 *      Filter in `functions/api/[[path]].js` sieht diesen Request nie, weil
 *      er nur für `/api/*` zuständig ist. Ein dort eingebauter Token wird
 *      also gar nicht erreicht.
 *   2. Ein Token in der URL landet im Verlauf, in Logs und im Referrer.
 *      Ein HttpOnly-Cookie nicht.
 *   3. Der Token musste bislang in die HTML-Datei geschrieben werden — damit
 *      war jeder Besucher des Adminbereichs im Besitz des Tokens.
 *
 * Ablauf: Passwort an `/api/login`, das Function-Login setzt ein signiertes
 * HttpOnly-Cookie, `/api/anfragen` akzeptiert das Cookie anstelle des Tokens.
 */

const SESSION_COOKIE = 'sw_admin';
const SESSION_DAUER = 8 * 60 * 60; // 8 Stunden in Sekunden

/* ------------------------------------------------------------------ */
/* Anmeldeseite                                                        */
/* ------------------------------------------------------------------ */

function loginSeite(fehler = '') {
  const hinweis = fehler
    ? `<p class="fehler" role="alert">${fehler}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Anmeldung — Steinwerk</title>
<link rel="stylesheet" href="/css/styles.css">
<link rel="icon" href="/assets/favicon.svg">
<style>
  body { display:grid; place-items:center; min-height:100vh; margin:0; }
  .karte { width:100%; max-width:380px; background:#fff; padding:34px 30px;
           border:1px solid #e6ddd2; border-radius:6px;
           box-shadow:0 12px 40px rgba(23,19,15,.10); }
  .karte h1 { font-size:1.4rem; margin:0 0 4px; color:#17130f; }
  .karte p.text { color:#7a6f65; font-size:.9rem; margin:0 0 22px; }
  label { display:block; font-size:.82rem; color:#7a6f65; margin:0 0 6px;
          letter-spacing:.02em; }
  input { width:100%; padding:11px 13px; border:1px solid #d8cec1;
          border-radius:4px; font:inherit; font-size:1rem; background:#fdfcfa;
          margin-bottom:16px; }
  input:focus { outline:2px solid #8a7a68; outline-offset:1px; border-color:#8a7a68; }
  button { width:100%; padding:12px; background:#17130f; color:#f5f1ec;
           border:0; border-radius:4px; font:inherit; font-size:.95rem;
           cursor:pointer; }
  button:hover { background:#2c2520; }
  .fehler { background:#fdecec; border:1px solid #e5b4b4; color:#8c2020;
            padding:10px 12px; border-radius:4px; font-size:.88rem;
            margin:0 0 16px; }
  .zurueck { display:block; text-align:center; margin-top:18px;
             color:#7a6f65; font-size:.85rem; }
</style>
</head>
<body>
  <div class="karte">
    <h1>Anmeldung</h1>
    <p class="text">Anfragen-Protokoll von Steinwerk</p>
    ${hinweis}
    <form method="POST" action="/api/login">
      <label for="pw">Passwort</label>
      <input id="pw" name="password" type="password" autocomplete="current-password"
             required autofocus>
      <button type="submit">Anmelden</button>
    </form>
    <a class="zurueck" href="/">&larr; Zurück zur Website</a>
  </div>
</body>
</html>`;
}

function htmlAntwort(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin'
    }
  });
}

/* ------------------------------------------------------------------ */
/* Session                                                              */
/* ------------------------------------------------------------------ */

/** Signiert eine Ablaufzeit mit dem Admin-Passwort als Schlüssel. */
async function signiere(exp, geheimnis) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(geheimnis)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(exp)));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Vergleicht zwei Zeichenketten ohne über Laufzeit zu verraten, wo sie abweichen. */
function gleichZeichenweise(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Prüft Passwort gegen das gesetzte ADMIN_TOKEN. */
export async function passwortGueltig(kandidat, env) {
  const soll = env.ADMIN_TOKEN;
  // Ohne gesetztes Passwort bleibt alles zu — lieber zu als offen.
  if (!soll) return false;
  return gleichZeichenweise(String(kandidat || ''), String(soll));
}

/** Liest ein Cookie aus dem Request-Header. */
export function cookieLesen(request, name) {
  const roh = request.headers.get('Cookie') || '';
  for (const teil of roh.split(';')) {
    const [k, ...rest] = teil.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/** True, wenn eine gültige, nicht abgelaufene Session vorliegt. */
export async function sessionGueltig(request, env) {
  const wert = cookieLesen(request, SESSION_COOKIE);
  if (!wert || !env.ADMIN_TOKEN) return false;

  const punkt = wert.lastIndexOf('.');
  if (punkt < 1) return false;

  const exp = Number(wert.slice(0, punkt));
  const sig = wert.slice(punkt + 1);
  if (!Number.isFinite(exp) || Date.now() / 1000 > exp) return false;

  return gleichZeichenweise(sig, await signiere(exp, env.ADMIN_TOKEN));
}

/** Baut den Set-Cookie-Header für eine neue Anmeldung. */
export async function sessionCookie(env, dauer = SESSION_DAUER) {
  const exp = Math.floor(Date.now() / 1000) + dauer;
  const wert = `${exp}.${await signiere(exp, env.ADMIN_TOKEN)}`;

  return `${SESSION_COOKIE}=${encodeURIComponent(wert)}; Max-Age=${dauer}; Path=/; `
    + 'HttpOnly; Secure; SameSite=Strict';
}

/** Baut den Header, der das Cookie wieder entfernt. */
export function sessionCookieLoeschen() {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export function sessionCookieName() {
  return SESSION_COOKIE;
}

/* ------------------------------------------------------------------ */
/* Anfrage                                                              */
/* ------------------------------------------------------------------ */

/**
 * Fängt `/admin` und `/admin/…` ab. Ohne gültige Session gibt es nur die
 * Anmeldeseite, mit Session die Protokoll-Ansicht.
 */
export async function onRequest({ request, env, next }) {
  if (await sessionGueltig(request, env)) {
    // Kopfzeilen auch auf der Protokollseite setzen.
    const antwort = await next();
    const kopf = new Headers(antwort.headers);
    kopf.set('Cache-Control', 'no-store');
    kopf.set('X-Frame-Options', 'DENY');
    kopf.set('Referrer-Policy', 'same-origin');
    return new Response(antwort.body, { status: antwort.status, headers: kopf });
  }

  // `/admin.html` existiert zusätzlich als Datei. Wer sie direkt ansteuert,
  // soll nicht am Login vorbeikommen, deshalb wird sie weitergeleitet.
  if (new URL(request.url).pathname.endsWith('.html')) {
    return Response.redirect(new URL('/admin', request.url).toString(), 302);
  }

  return htmlAntwort(loginSeite());
}