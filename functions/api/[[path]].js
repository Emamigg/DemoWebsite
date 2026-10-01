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
/**
 * Steinwerk — Cloudflare Pages Function
 * ------------------------------------------------------------------
 * Cloudflare-Version des Backends. Gegenstück zu `server/server.js`,
 * läuft aber ohne Dateisystem: das Protokoll liegt in D1.
 *
 * Wird von Pages automatisch erkannt:
 *   /api/*        → diese Datei
 *   /admin*       → `functions/admin/[[path]].js` (Anmeldung)
 *   alles andere  → statische Dateien aus dem Build-Ordner
 *
 * Konfiguration kommt aus den Pages-Secrets, nicht aus einer .env:
 *   RESEND_KEY, MAIL_MODE, MAIL_FROM, MAIL_DOMAIN, MAIL_TO,
 *   ADMIN_TOKEN, SMS_WEBHOOK, SMS_TO
 *
 * Die D1-Bindung heißt `DB`, siehe `wrangler.toml`.
 *
 * `ADMIN_TOKEN` ist das **Admin-Passwort**, kein API-Schlüssel. Es wird nie
 * in HTML geschrieben und nicht im Browser benutzt — die Anmeldung setzt ein
 * signiertes HttpOnly-Cookie, siehe `functions/admin/[[path]].js`.
 */

'use strict';

/* ------------------------------------------------------------------ */
/* Hilfsfunktionen                                                     */
/* ------------------------------------------------------------------ */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

async function sha256Hex(text) {
  const buf = new TextEncoder().encode(String(text));
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function clientIp(request) {
  return request.headers.get('cf-connecting-ip')
    || (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || 'unbekannt';
}

/* ------------------------------------------------------------------ */
/* Anmeldung                                                            */
/* ------------------------------------------------------------------ */

async function loginAntwort(env, status = 200) {
  return new Response(JSON.stringify({ ok: status === 200 }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': status === 200 ? await sessionCookie(env) : ''
    }
  });
}

/**
 * Anmeldung und Abmeldung.
 *
 * Antwortet auf Formular-POST aus der Anmeldeseite wie auch auf JSON,
 * damit beides ohne Zusatzcode funktioniert.
 */
async function handleLogin({ request, env }) {
  const url = new URL(request.url);

  if (url.pathname === '/api/logout') {
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': sessionCookieLoeschen()
      }
    });
  }

  let passwort = '';

  const typ = (request.headers.get('Content-Type') || '').split(';')[0].trim();
  if (typ === 'application/json') {
    try {
      passwort = (await request.json()).password || '';
    } catch {
      return jsonResponse({ ok: false, error: 'ungueltiges Format' }, 400);
    }
  } else {
    try {
      const form = await request.formData();
      passwort = form.get('password') || '';
    } catch {
      return jsonResponse({ ok: false, error: 'ungueltiges Format' }, 400);
    }
  }

  if (!(await passwortGueltig(passwort, env))) {
    // Formularnutzer bekommen die Anmeldeseite zurück, JSON-Nutzer einen Code.
    if (typ === 'application/json') {
      return jsonResponse({ ok: false, error: 'falsches Passwort' }, 401);
    }
    return new Response(loginSeite('Das Passwort stimmt nicht.'), {
      status: 401,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'DENY'
      }
    });
  }

  if (typ !== 'application/json') {
    // Erfolgreiche Formularanmeldung: zurück in den Adminbereich.
    return new Response(null, {
      status: 302,
      headers: {
        'Set-Cookie': await sessionCookie(env),
        Location: '/admin'
      }
    });
  }

  return loginAntwort(env);
}

/* ------------------------------------------------------------------ */
/* Mail                                                                */
/* ------------------------------------------------------------------ */

function buildMail(entry) {
  const rows = [
    ['Name', entry.name],
    ['Telefon', entry.tel],
    ['E-Mail', entry.mail],
    ['Vorhaben', entry.vorhaben],
    ['Nachricht', entry.nachricht]
  ]
    .map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#7a6f65;">${k}</td>
        <td style="padding:6px 0;color:#17130f;">${escapeHtml(v)}</td></tr>`)
    .join('');

  return {
    subject: `Neue Anfrage: ${entry.vorhaben} — ${entry.name}`,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;">
  <h2 style="color:#17130f;margin:0 0 4px;">Neue Website-Anfrage</h2>
  <p style="color:#7a6f65;margin:0 0 20px;font-size:14px;">
    Eingegangen am ${entry.createdAt} · Referenz ${entry.id}
  </p>
  <table style="border-collapse:collapse;width:100%;font-size:15px;">${rows}</table>
  <p style="margin-top:24px;font-size:13px;color:#7a6f65;">
    Gesendet über das Steinwerk-Formular.
  </p>
</div>`
  };
}

function absender(env) {
  if (env.MAIL_FROM) return env.MAIL_FROM;
  if (env.MAIL_DOMAIN) return `Website <anfrage@${env.MAIL_DOMAIN}>`;
  return 'Website <anfrage@example.com>';
}

async function notify(entry, env) {
  const mail = buildMail(entry);

  if (env.MAIL_MODE !== 'resend') {
    return { channel: 'outbox', status: 'nur im Protokoll, kein Versand' };
  }
  if (!env.RESEND_KEY) {
    return { channel: 'kein-versand', status: 'MAIL_MODE=resend, aber RESEND_KEY fehlt' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: absender(env),
        to: [env.MAIL_TO || 'inhaber@example.com'],
        subject: mail.subject,
        html: mail.html
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { channel: 'resend', status: 'gesendet' };
  } catch (err) {
    return { channel: 'fehler', status: err.message };
  }
}

/* ------------------------------------------------------------------ */
/* SMS (optional)                                                      */
/* ------------------------------------------------------------------ */

async function sendSms(entry, env) {
  if (!env.SMS_WEBHOOK) {
    return { channel: 'sms', status: 'nicht konfiguriert (SMS_WEBHOOK fehlt)' };
  }
  try {
    const res = await fetch(env.SMS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: env.SMS_TO || '',
        text: `Neue Anfrage: ${entry.name}, ${entry.tel}, ${entry.vorhaben}`,
        ref: entry.id
      })
    });
    return { channel: 'sms', status: res.ok ? 'gesendet' : `HTTP ${res.status}` };
  } catch (err) {
    return { channel: 'sms', status: `Fehler: ${err.message}` };
  }
}

/* ------------------------------------------------------------------ */
/* Validierung                                                         */
/* ------------------------------------------------------------------ */

const FIELDS = ['name', 'tel', 'mail', 'vorhaben', 'nachricht'];

function validate(body) {
  const errors = {};
  const v = {};

  for (const f of FIELDS) v[f] = String(body[f] ?? '').trim();

  if (v.name.length < 2) errors.name = 'Name fehlt.';
  if (!/^[\d\s+()/\-]{6,}$/.test(v.tel)) errors.tel = 'Telefonnummer ungültig.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.mail)) errors.mail = 'E-Mail ungültig.';
  if (v.vorhaben.length < 2) errors.vorhaben = 'Art des Vorhabens fehlt.';
  if (v.nachricht.length < 10) errors.nachricht = 'Nachricht zu kurz (min. 10 Zeichen).';

  return { ok: Object.keys(errors).length === 0, errors, values: v };
}

/* ------------------------------------------------------------------ */
/* Rate-Limit                                                          */
/* ------------------------------------------------------------------ */

/**
 * Achtung: `hits` lebt nur so lange, wie die Worker-Instanz lebt. Das ist
 * kein zuverlässiger Schutz, weil Anfragen auf verschiedene Instanzen
 * verteilt werden. Für den Produktivbetrieb Rate-Limit in Cloudflare
 * konfigurieren oder Durable Objects verwenden.
 */
const hits = new Map();
const LIMIT = 5;
const WINDOW = 10 * 60e3;

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
  if (list.length >= LIMIT) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  return false;
}

/* ------------------------------------------------------------------ */
/* Protokoll                                                           */
/* ------------------------------------------------------------------ */

async function writeEntry(env, entry) {
  await env.DB.prepare(`
    INSERT INTO anfragen
      (id, created_at, created_at_local, name, tel, mail, vorhaben, nachricht, status, source, ip_hash, mail_result, sms_result)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    entry.id,
    entry.timestamp,
    entry.createdAt,
    entry.name,
    entry.tel,
    entry.mail,
    entry.vorhaben,
    entry.nachricht,
    entry.status,
    entry.source,
    entry.ipHash,
    JSON.stringify(entry.mailResult),
    entry.smsResult ? JSON.stringify(entry.smsResult) : null
  ).run();
}

function safeParse(json) {
  try { return JSON.parse(json); } catch { return null; }
}

/* ------------------------------------------------------------------ */
/* Routen                                                              */
/* ------------------------------------------------------------------ */

export async function onRequestPost({ request, env }) {
  const { pathname } = new URL(request.url);

  /* --- Anmeldung und Abmeldung --- */
  if (pathname === '/api/login' || pathname === '/api/logout') {
    return handleLogin({ request, env });
  }

  /* --- Formular-Empfang --- */
  if (pathname === '/api/anfrage') {
    const ip = clientIp(request);

    if (rateLimited(ip)) {
      return jsonResponse({ ok: false, errors: { _all: 'Zu viele Anfragen. Bitte rufen Sie uns an.' } }, 429);
    }

    const raw = await request.text();
    if (raw.length > 50_000) {
      return jsonResponse({ ok: false, errors: { _all: 'Anfrage zu groß.' } }, 413);
    }

    let body;
    try { body = JSON.parse(raw || '{}'); }
    catch { return jsonResponse({ ok: false, errors: { _all: 'Ungültiges Format.' } }, 400); }

    // Honeypot: von Menschen unsichtbar, von Bots meist ausgefüllt
    if (body.firma) return jsonResponse({ ok: true, id: 'blocked' });

    const { ok, errors, values } = validate(body);
    if (!ok) return jsonResponse({ ok: false, errors }, 422);

    const now = new Date();
    const entry = {
      id: crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase(),
      timestamp: now.toISOString(),
      createdAt: now.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' }),
      ...values,
      status: 'neu',
      source: request.headers.get('referer') || 'direkt',
      ipHash: await sha256Hex(ip),
      mailResult: { channel: '-', status: '-' },
      smsResult: null
    };

    // Protokoll ZUERST — die Anfrage geht nicht verloren, wenn der Versand klemmt
    entry.mailResult = await notify(entry, env);

    if (body.sms === true || body.sms === 'true' || body.sms === 'on') {
      entry.smsResult = await sendSms(entry, env);
    }

    await writeEntry(env, entry);

    return jsonResponse({ ok: true, id: entry.id, mail: entry.mailResult });
  }

  return jsonResponse({ ok: false, error: 'unbekannter Pfad' }, 404);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const { pathname } = url;

  /* --- Protokoll als JSON --- */
  if (pathname === '/api/anfragen') {
    // Anmeldung läuft über ein signiertes HttpOnly-Cookie, das `/api/login`
    // setzt. Der Token in der URL wird nur noch für den lokalen Node-Server
    // und für Skripte akzeptiert.
    const perCookie = await sessionGueltig(request, env);
    const perToken = Boolean(env.ADMIN_TOKEN)
      && gleichZeichenweise(url.searchParams.get('token') || '', env.ADMIN_TOKEN);

    if (!perCookie && !perToken) {
      return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
    }

    const { results } = await env.DB.prepare(`
      SELECT id, created_at, created_at_local, name, tel, mail, vorhaben, nachricht,
             status, source, mail_result, sms_result
      FROM anfragen
      ORDER BY created_at DESC
      LIMIT 200
    `).all();

    return jsonResponse({
      ok: true,
      mode: env.MAIL_MODE || 'outbox',
      count: results.length,
      entries: results.map((r) => ({
        id: r.id,
        createdAt: r.created_at_local,
        timestamp: r.created_at,
        name: r.name,
        tel: r.tel,
        // `mail` ist die Adresse des Interessenten. Der Versandstatus steht
        // unter `mailversand` — beide dürfen nicht denselben Schlüssel nutzen.
        mail: r.mail,
        vorhaben: r.vorhaben,
        nachricht: r.nachricht,
        status: r.status,
        source: r.source,
        mailversand: safeParse(r.mail_result) || undefined,
        sms: safeParse(r.sms_result) || undefined
      }))
    });
  }

  /* --- Status --- */
  /* --- Prüft, ob eine gültige Anmeldung vorliegt --- */
  if (pathname === '/api/session') {
    const gueltig = await sessionGueltig(request, env);
    return jsonResponse({ ok: gueltig, angemeldet: gueltig });
  }

  if (pathname === '/api/status') {
    const { results } = await env.DB.prepare('SELECT COUNT(*) AS anzahl FROM anfragen').all();
    return jsonResponse({
      ok: true,
      mailMode: env.MAIL_MODE || 'outbox',
      mailTo: env.MAIL_TO || 'nicht gesetzt',
      sms: env.SMS_WEBHOOK ? 'konfiguriert' : 'nicht konfiguriert',
      protokoll: results[0] ? results[0].anzahl : 0
    });
  }

  return env.ASSETS.fetch(request);
}