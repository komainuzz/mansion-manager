ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS nearest_station_transport TEXT NOT NULL DEFAULT '徒歩',
  ADD COLUMN IF NOT EXISTS contract_end DATE;
