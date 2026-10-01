/**
 * Steinwerk — Cloudflare Pages Function
 * ------------------------------------------------------------------
 * Cloudflare-Version des Backends. Gegenstück zu `server/server.js`,
 * läuft aber ohne Dateisystem: das Protokoll liegt in D1.
 *
 * Wird von Pages automatisch erkannt:
 *   /api/*        → diese Datei
 *   alles andere  → statische Dateien aus dem Build-Ordner
 *
 * Konfiguration kommt aus den Pages-Secrets, nicht aus einer .env:
 *   RESEND_KEY, MAIL_MODE, MAIL_FROM, MAIL_DOMAIN, MAIL_TO,
 *   ADMIN_TOKEN, SMS_WEBHOOK, SMS_TO
 *
 * Die D1-Bindung heißt `DB`, siehe `wrangler.toml`.
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
    const ADMIN_TOKEN = env.ADMIN_TOKEN || 'demo';
    if (url.searchParams.get('token') !== ADMIN_TOKEN) {
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

  /* --- Adminbereich --- */
  if (pathname === '/admin.html') {
    // Wie lokal: Token wird beim Ausliefern eingesetzt, Seite ist nicht öffentlich.
    // In der Cloud ist das ein Kompromiss — für den Produktivbetrieb eine
    // echte Anmeldung mit Cloudflare Access davor setzen.
    const html = await env.ASSETS.fetch(new Request(new URL('/admin.html', url).toString()));
    if (!html.ok) return new Response('404 — nicht gefunden', { status: 404 });

    const text = (await html.text())
      .replace(/var\s+TOKEN\s*=\s*'[^']*';/, `var TOKEN = ${JSON.stringify(env.ADMIN_TOKEN || 'demo')};`);

    return new Response(text, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  return env.ASSETS.fetch(request);
}