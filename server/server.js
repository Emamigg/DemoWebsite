/**
 * Steinwerk — Demo-Backend
 * ------------------------------------------------------------------
 * Nimmt Anfragen aus dem Kontaktformular entgegen, speichert sie im
 * Protokoll (JSONL + JSON) und stellt die Benachrichtigung zu.
 *
 * Bewusst ohne npm-Abhängigkeiten: läuft mit `node server/server.js`
 * auf jedem Rechner mit Node 18+.
 *
 * Modi für den Versand (Umgebungsvariable MAIL_MODE):
 *   outbox  (Standard)  — schreibt die Mail in data/outbox.log + Dashboard
 *   resend              — echter Versand via Resend-API (RESEND_KEY nötig)
 *   sendmail            — übergibt an das lokale sendmail-Binary
 *
 * Lauscht standardmäßig nur auf 127.0.0.1 — das Dashboard ist damit
 * nicht aus dem Internet erreichbar.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

require('./env').load();

/* ------------------------------------------------------------------ */
/* Konfiguration                                                       */
/* ------------------------------------------------------------------ */

const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'data');
const PORT = Number(process.env.PORT || 8765);
const HOST = process.env.HOST || '127.0.0.1';

const MAIL_MODE = process.env.MAIL_MODE || 'outbox';
const RESEND_KEY = process.env.RESEND_KEY || '';
const MAIL_DOMAIN = (process.env.MAIL_DOMAIN || '').trim();

// Absender automatisch bilden, sobald eine Domain eingetragen ist —
// sonst muss MAIL_FROM nicht von Hand gesetzt werden.
const MAIL_FROM = (process.env.MAIL_FROM || '').trim()
  || (MAIL_DOMAIN ? `Website <anfrage@${MAIL_DOMAIN}>` : 'Anfrage <anfragen@example.com>');
const MAIL_TO = (process.env.MAIL_TO || '').trim() || 'inhaber@example.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'demo';

fs.mkdirSync(DATA, { recursive: true });
const LOG_FILE = path.join(DATA, 'anfragen.jsonl');
const OUTBOX = path.join(DATA, 'outbox.log');

/* ------------------------------------------------------------------ */
/* Protokoll                                                           */
/* ------------------------------------------------------------------ */

function appendLog(entry) {
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
}

function readLog(limit = 200) {
  if (!fs.existsSync(LOG_FILE)) return [];
  const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
  return lines
    .slice(-limit)
    .reverse()
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Benachrichtigung                                                    */
/* ------------------------------------------------------------------ */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

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
    Gesendet über das Demo-Formular. Nicht als Supportanfrage zu behandeln.
  </p>
</div>`
  };
}

async function notify(entry) {
  const mail = buildMail(entry);

  if (MAIL_MODE === 'resend' && RESEND_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to: [MAIL_TO], subject: mail.subject, html: mail.html })
    });
    if (!res.ok) throw new Error(`Resend: HTTP ${res.status} ${await res.text()}`);
    return { channel: 'resend', status: 'gesendet' };
  }

  if (MAIL_MODE === 'sendmail') {
    await new Promise((resolve, reject) => {
      const raw = `From: ${MAIL_FROM}\r\nTo: ${MAIL_TO}\r\nSubject: ${mail.subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${mail.html}`;
      const p = spawn('sendmail', ['-t', '-oi'], { stdio: ['pipe', 'inherit', 'inherit'] });
      p.on('error', reject);
      p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`sendmail exit ${code}`))));
      p.stdin.end(raw);
    });
    return { channel: 'sendmail', status: 'gesendet' };
  }

  fs.appendFileSync(OUTBOX, `\n===== ${entry.createdAt} | ${entry.id} =====\n` +
    `An: ${MAIL_TO}\nBetreff: ${mail.subject}\n\n${mail.html}\n`, 'utf8');
  return { channel: 'outbox', status: 'in Postausgabe geschrieben' };
}

/* ------------------------------------------------------------------ */
/* SMS (optional)                                                      */
/* ------------------------------------------------------------------ */

async function sendSms(entry) {
  const hook = process.env.SMS_WEBHOOK;
  if (!hook) {
    return { channel: 'sms', status: 'nicht konfiguriert (SMS_WEBHOOK fehlt)' };
  }
  const body = `Neue Anfrage: ${entry.name}, ${entry.tel}, ${entry.vorhaben}`;
  try {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: process.env.SMS_TO || '', text: body, ref: entry.id })
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
/* Rate-Limit (In-Memory, pro IP)                                      */
/* ------------------------------------------------------------------ */

const hits = new Map();
const LIMIT = 5;          // Anfragen …
const WINDOW = 10 * 60e3; // … pro 10 Minuten

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
  if (list.length >= LIMIT) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  return false;
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';

  const file = path.join(ROOT, rel);
  // Pfad-Traversal verhindern
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 — nicht gefunden');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(buf);
  });
}

/**
 * Adminbereich nur von lokal ausliefern — und mit dem echten Token.
 *
 * Sonst zwei Probleme: das Dashboard ist öffentlich erreichbar, und der
 * fest verdrahtete Token in admin.html passt nicht zu ADMIN_TOKEN aus .env.
 * Beides löst sich hier: von außen 403, von innen wird der Wert ersetzt.
 */
function isLocal(req) {
  const ip = req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function serveAdmin(req, res) {
  if (!isLocal(req)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 — der Adminbereich ist nur lokal erreichbar.');
  }

  // Lokal gibt es keine Anmeldung: die Schleife hängt an 127.0.0.1. In der
  // Cloud läuft die Anmeldung über `functions/admin/[[path]].js`.
  fs.readFile(path.join(ROOT, 'admin.html'), 'utf8', (err, html) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 — nicht gefunden');
    }
    res.writeHead(200, {
      'Content-Type': MIME['.html'],
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(html);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;

  /* --- Formular-Empfang --- */
  if (pathname === '/api/anfrage' && req.method === 'POST') {
    const ip = req.socket.remoteAddress || 'unknown';

    if (rateLimited(ip)) {
      return sendJson(res, 429, { ok: false, errors: { _all: 'Zu viele Anfragen. Bitte rufen Sie uns an.' } });
    }

    let raw = '';
    let tooBig = false;
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 50_000) { tooBig = true; req.destroy(); }
    });

    req.on('end', async () => {
      if (tooBig) return sendJson(res, 413, { ok: false, errors: { _all: 'Anfrage zu groß.' } });

      let body;
      try { body = JSON.parse(raw || '{}'); }
      catch { return sendJson(res, 400, { ok: false, errors: { _all: 'Ungültiges Format.' } }); }

      // Honeypot: von Menschen unsichtbar, von Bots meist ausgefüllt
      if (body.firma) {
        return sendJson(res, 200, { ok: true, id: 'blocked' });
      }

      const { ok, errors, values } = validate(body);
      if (!ok) return sendJson(res, 422, { ok: false, errors });

      const entry = {
        id: crypto.randomBytes(4).toString('hex').toUpperCase(),
        createdAt: new Date().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' }),
        timestamp: new Date().toISOString(),
        ...values,
        status: 'neu',
        source: req.headers['referer'] || 'direkt'
      };

      appendLog(entry);                       // Protokoll IMMER zuerst

      let mailResult = { channel: '-', status: '-' };
      try { mailResult = await notify(entry); }
      catch (err) { mailResult = { channel: 'fehler', status: err.message }; }

      if (body.sms === true || body.sms === 'true' || body.sms === 'on') {
        const smsResult = await sendSms(entry);
        entry.sms = smsResult;
        appendLog({ ...entry, note: 'SMS-Status nachträglich' });
      }

      console.log(`[${entry.createdAt}] ${entry.id} ${entry.vorhaben} | ${entry.name} | Mail: ${mailResult.status}`);

      sendJson(res, 200, {
        ok: true,
        id: entry.id,
        mail: mailResult
      });
    });
    return;
  }

  /* --- Protokoll als JSON --- */
  if (pathname === '/api/anfragen') {
    // Lokal ist die Schleife an 127.0.0.1 der Schutz, deshalb ohne Token-Dialog.
    // Der Token bleibt für Skripte und Cronjobs möglich.
    if (!isLocal(req)) return sendJson(res, 401, { ok: false, error: 'unauthorized' });
    const token = url.searchParams.get('token');
    if (token && token !== ADMIN_TOKEN) {
      return sendJson(res, 401, { ok: false, error: 'unauthorized' });
    }
    return sendJson(res, 200, {
      ok: true,
      mode: MAIL_MODE,
      count: readLog().length,
      entries: readLog()
    });
  }

  /* --- Status --- */
  if (pathname === '/api/status') {
    return sendJson(res, 200, {
      ok: true,
      mailMode: MAIL_MODE,
      mailTo: MAIL_TO,
      sms: process.env.SMS_WEBHOOK ? 'konfiguriert' : 'nicht konfiguriert',
      protokoll: readLog().length
    });
  }

  /* --- Adminbereich (nur lokal, kein Login) --- */
  if (pathname === '/admin.html' || pathname === '/admin') return serveAdmin(req, res);
  if (pathname === '/api/logout') {
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    return res.end();
  }

  /* --- Statische Dateien --- */
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, pathname);

  res.writeHead(405); res.end();
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  Steinwerk — Demo-Server');
  console.log('  ──────────────────────────────────────────');
  console.log(`  Website    http://${HOST}:${PORT}/`);
  console.log(`  Protokoll  http://${HOST}:${PORT}/admin.html`);
  console.log(`  Versand    ${MAIL_MODE} → ${MAIL_TO}`);
  console.log(`  SMS        ${process.env.SMS_WEBHOOK ? 'konfiguriert' : 'aus (optional)'}`);
  console.log('  Beenden    Strg + C');
  console.log('');
});
