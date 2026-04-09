-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- rooms テーブル
-- =====================
CREATE TABLE IF NOT EXISTS rooms (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name          TEXT NOT NULL,
  nearest_station TEXT,
  address       TEXT,
  contract_start DATE,
  key_location  TEXT,
  features      TEXT,
  current_price INTEGER NOT NULL DEFAULT 0,
  initial_costs JSONB   NOT NULL DEFAULT '{}',
  monthly_costs JSONB   NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================
-- reservations テーブル
-- =====================
CREATE TABLE IF NOT EXISTS reservations (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  guest_name    TEXT NOT NULL,
  check_in      DATE NOT NULL,
  check_out     DATE NOT NULL,
  room_fee      INTEGER NOT NULL DEFAULT 0,
  cleaning_fee  INTEGER NOT NULL DEFAULT 0,
  cleaning_cost INTEGER NOT NULL DEFAULT 0,
  checklist     JSONB   NOT NULL DEFAULT '[]',
  memo          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reservations_room_id   ON reservations(room_id);
CREATE INDEX IF NOT EXISTS idx_reservations_check_in  ON reservations(check_in);
CREATE INDEX IF NOT EXISTS idx_reservations_check_out ON reservations(check_out);

-- =====================
-- Row Level Security
-- =====================
ALTER TABLE rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth required for this app)
CREATE POLICY "allow_all_rooms"        ON rooms        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_reservations" ON reservations FOR ALL USING (true) WITH CHECK (true);
