-- Steinwerk — D1 Schema
-- Speichert Anfragen im Protokoll (JSON-ähnlich, aber abfragbar)
-- Erstellt mit: wrangler d1 migrations create steinwerk-anfragen init
-- Ausgeführt mit: wrangler d1 migrations apply steinwerk-anfragen --local (Test)
-- Produktiv: wrangler d1 migrations apply steinwerk-anfragen --remote

CREATE TABLE IF NOT EXISTS anfragen (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,        -- ISO 8601
  created_at_local TEXT NOT NULL,  -- de-DE formatiert
  name TEXT NOT NULL,
  tel TEXT NOT NULL,
  mail TEXT NOT NULL,
  vorhaben TEXT NOT NULL,
  nachricht TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'neu',
  source TEXT,
  ip_hash TEXT,                    -- Hash der IP (Rate-Limit ohne Roh-IP zu speichern)
  sms_result TEXT,                 -- JSON-String falls SMS probiert wurde
  mail_result TEXT                 -- JSON-String Resultat Benachrichtigung
);

CREATE INDEX IF NOT EXISTS idx_anfragen_created_at ON anfragen(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anfragen_status ON anfragen(status);
