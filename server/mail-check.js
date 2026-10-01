/**
 * Steinwerk — Mail-Versand prüfen
 * ------------------------------------------------------------------
 * Prüft vor dem Livegang, ob eine Domain wirklich Mails empfangen und
 * versenden kann. Drei Dinge müssen stimmen, sonst landen die Mails im Spam:
 *
 *   1. SPF   — welche Server die Domain versenden dürfen
 *   2. DKIM  — digitale Signatur jeder einzelnen Mail
 *   3. DMARC — sagt Empfängern, was bei Fehlschlag passieren soll
 *
 * Ohne diese drei Einträge funktioniert der Versand technisch, landet aber
 * im Junk. Genau das ist der Fehler, der im Livegang auffällt.
 *
 * Aufruf:
 *   node server/mail-check.js --domain firma.de --to du@deine-mail.de
 *
 * Optionen:
 *   --domain <name>        zu prüfende Domain (ohne https://, ohne /pfad)
 *   --to <adresse>         Empfänger des Testversands
 *   --key <resend_key>     API-Key, sonst aus RESEND_KEY
 *   --from <absender>      sonst automatisch: "Website <anfrage@domain>"
 *   --dkim-selector <sel>  DKIM-Selektor, Standard "resend"
 *   --no-send              nur prüfen, keine Testmail verschicken
 *
 * Alternativ alles über Umgebungsvariablen:
 *   MAIL_DOMAIN=... RESEND_KEY=... MAIL_TO=... node server/mail-check.js
 */

'use strict';

const { spawn } = require('child_process');

require('./env').load();

/* ------------------------------------------------------------------ */
/* Argumente                                                            */
/* ------------------------------------------------------------------ */

function arg(name, fallback = '') {
  const i = process.argv.indexOf('--' + name);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1];
  }
  return fallback;
}

const DOMAIN = String(arg('domain', process.env.MAIL_DOMAIN || ''))
  .replace(/^https?:\/\//, '')
  .replace(/^www\./, '')
  .replace(/\/.*$/, '');

const KEY = arg('key', process.env.RESEND_KEY || '');
const TO = arg('to', process.env.MAIL_TO || '');
const SELECTOR = arg('dkim-selector', 'resend');
const FROM = arg('from', process.env.MAIL_FROM || (DOMAIN ? `Website <anfrage@${DOMAIN}>` : ''));
const SEND = !process.argv.includes('--no-send');

/* ------------------------------------------------------------------ */
/* DNS-Abfrage                                                         */
/* ------------------------------------------------------------------ */

function dig(name, type) {
  return new Promise((resolve) => {
    const p = spawn('dig', ['+short', type, name], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    p.on('error', () => resolve(null)); // dig nicht installiert
    p.stdout.on('data', (c) => { out += c; });
    p.on('close', () => resolve(out.trim()));
  });
}

/* ------------------------------------------------------------------ */
/* Prüfungen                                                            */
/* ------------------------------------------------------------------ */

const results = [];

function record(level, label, detail) {
  results.push({ level, label, detail: detail || '' });
}

async function checkDns() {
  if (DOMAIN.includes('example.com') || !DOMAIN) {
    record('info', 'DNS', 'Keine echte Domain angegeben — übersprungen.');
    return;
  }

  // SPF
  const txt = await dig(DOMAIN, 'TXT');
  if (txt === null) {
    record('warn', 'DNS-Abfrage', 'dig nicht gefunden. Prüfe die Einträge manuell.');
    return;
  }
  const spf = txt.split('\n').find((l) => l.includes('v=spf1'));
  if (spf) {
    record('ok', 'SPF', spf.slice(0, 70));
  } else {
    record('fail', 'SPF', `Fehlt. Erwartet: v=spf1 include:amazonses.com ~all (bei Resend)`);
  }

  // DKIM
  const dkim = await dig(`${SELECTOR}._domainkey.${DOMAIN}`, 'TXT');
  if (dkim) {
    record('ok', 'DKIM', `gefunden über Selektor "${SELECTOR}"`);
  } else {
    record('fail', 'DKIM', `Fehlt. Erwartet: TXT auf ${SELECTOR}._domainkey.${DOMAIN}`);
  }

  // DMARC
  const dmarc = await dig(`_dmarc.${DOMAIN}`, 'TXT');
  if (dmarc) {
    record('ok', 'DMARC', dmarc.slice(0, 70));
  } else {
    record('warn', 'DMARC', `Fehlt. Sollte sein: v=DMARC1; p=none; rua=mailto:${DOMAIN}`);
  }

  // MX — nicht für den Versand nötig, aber gut zur Orientierung
  const mx = await dig(DOMAIN, 'MX');
  if (mx) record('info', 'MX', mx.split('\n')[0].slice(0, 70));
}

async function checkResend() {
  if (!KEY) {
    record('info', 'Resend', 'Kein API-Key (--key / RESEND_KEY) — Domain-Abgleich übersprungen.');
    return null;
  }
  if (!KEY.startsWith('re_')) {
    record('warn', 'Resend', 'Key sieht nicht wie ein Resend-Key aus (erwartet: re_...).');
  }

  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${KEY}` }
    });

    if (res.status === 401) {
      const detail = (await res.text()) || '';
      if (detail.includes('restricted_api_key')) {
        // Resends Standard-Key darf nur senden, nicht lesen. Kein Fehler.
        record('ok', 'Resend', 'Key gültig (nur Senden erlaubt — das ist normal).');
        record('info', 'Domain-Check', 'Nur im Dashboard sichtbar: resend.com/domains');
        return null;
      }
      record('fail', 'Resend', `Key abgelehnt: ${detail.slice(0, 150)}`);
      return null;
    }

    if (!res.ok) {
      record('fail', 'Resend', `Unerwartete Antwort: HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    const list = Array.isArray(json) ? json : (json.data || []);
    const hit = list.find((d) => (d.name || '').toLowerCase() === DOMAIN.toLowerCase());

    if (!hit) {
      record('fail', 'Resend', `Domain "${DOMAIN}" ist nicht bei Resend hinterlegt.`);
    } else if (hit.status === 'verified') {
      record('ok', 'Resend', `${DOMAIN} ist verifiziert.`);
    } else {
      record('warn', 'Resend', `${DOMAIN} ist angelegt, aber Status: ${hit.status}. DNS-Einträge fehlen noch.`);
    }
    return list;
  } catch (err) {
    record('warn', 'Resend', `Nicht erreichbar: ${err.message}`);
    return null;
  }
}

async function sendTest() {
  if (!SEND) {
    record('info', 'Testversand', 'übersprungen (--no-send)');
    return;
  }
  if (!KEY) { record('fail', 'Testversand', 'ohne API-Key nicht möglich'); return; }
  if (!TO) { record('fail', 'Testversand', 'keine Empfängeradresse (--to / MAIL_TO)'); return; }
  if (!FROM) { record('fail', 'Testversand', 'keine Absenderadresse'); return; }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        subject: 'Steinwerk — Versandtest erfolgreich',
        html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;">
  <h2 style="color:#17130f;margin:0 0 4px;">Versandtest erfolgreich</h2>
  <p style="color:#7a6f65;margin:0 0 20px;font-size:14px;">Absender: ${FROM}</p>
  <p style="color:#17130f;font-size:15px;">Wenn du diese Mail im Posteingang und nicht im Spam
  siehst, ist der Versand technisch fertig eingerichtet.</p>
  <p style="color:#7a6f65;font-size:13px;">Ab jetzt läuft jede Anfrage aus dem Kontaktformular
  automatisch über genau diesen Weg.</p>
</div>`
      })
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      record('fail', 'Testversand', `HTTP ${res.status} — ${detail}`);
      return;
    }
    const { id } = await res.json();
    record('ok', 'Testversand', `zugestellt an ${TO} · ID ${id}`);
  } catch (err) {
    record('fail', 'Testversand', err.message);
  }
}

/* ------------------------------------------------------------------ */
/* Ausgabe                                                              */
/* ------------------------------------------------------------------ */

const ICON = { ok: '  ok  ', warn: ' warn ', fail: ' FEHL ', info: '  ·   ' };

function report() {
  console.log('');
  console.log('  Steinwerk — Mail-Prüfung');
  console.log('  ──────────────────────────────────────────');
  if (DOMAIN) console.log(`  Domain     ${DOMAIN}`);
  if (FROM) console.log(`  Absender   ${FROM}`);
  if (TO) console.log(`  Test an    ${TO}`);
  console.log('');

  for (const r of results) {
    console.log(`  [${ICON[r.level]}] ${r.label.padEnd(14)} ${r.detail}`);
  }

  const failed = results.filter((r) => r.level === 'fail').length;
  const warned = results.filter((r) => r.level === 'warn').length;

  console.log('');
  console.log('  ──────────────────────────────────────────');
  if (failed) {
    console.log(`  ${failed} Problem(e) — bitte vor dem Livegang beheben.`);
  } else if (warned) {
    console.log('  Versand ist möglich. Offene Punkte siehe oben.');
  } else {
    console.log('  Alles in Ordnung. Der Versand ist bereit.');
  }
  console.log('');
  process.exitCode = failed ? 1 : 0;
}

(async () => {
  await checkDns();
  await checkResend();
  await sendTest();
  report();
})();
