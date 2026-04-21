ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS nearest_station_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS postal_code             TEXT,
  ADD COLUMN IF NOT EXISTS management_company      TEXT,
  ADD COLUMN IF NOT EXISTS management_company_contact TEXT,
  ADD COLUMN IF NOT EXISTS mailbox_code            TEXT,
  ADD COLUMN IF NOT EXISTS has_parking             BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_wifi                BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS price_long              INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_campaign          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS electricity             TEXT,
  ADD COLUMN IF NOT EXISTS water_heater            TEXT,
  ADD COLUMN IF NOT EXISTS gas                     TEXT;
