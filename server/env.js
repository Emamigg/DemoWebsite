/**
 * Steinwerk — minimale .env-Laden
 * ------------------------------------------------------------------
 * Liest die Datei `.env` im Projektverzeichnis und schreibt sie in
 * `process.env`, ohne bestehende Variablen zu überschreiben.
 *
 * Damit landet der API-Key in einer Datei auf deinem Rechner und nicht
 * im Chatverlauf, in der Terminal-History oder in Logs.
 *
 * Kein npm nötig — die .env ist ein simples Format aus Zeilen.
 */
'use strict';

const fs = require('fs');
const path = require('path');

function parse(text) {
  const out = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();

    // Anführungszeichen entfernen, damit Werte mit Leerzeichen funktionieren
    const quoted = (val.startsWith('"') && val.endsWith('"') && val.length > 1)
      || (val.startsWith("'") && val.endsWith("'") && val.length > 1);
    if (quoted) val = val.slice(1, -1);

    if (key) out[key] = val;
  }
  return out;
}

function load(file) {
  const target = file || process.env.ENV_FILE || path.join(__dirname, '..', '.env');
  if (!fs.existsSync(target)) return {};

  const parsed = parse(fs.readFileSync(target, 'utf8'));

  // Shell-Variablen gewinnen — .env ist nur der Fallback
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  return parsed;
}

module.exports = { load, parse };
