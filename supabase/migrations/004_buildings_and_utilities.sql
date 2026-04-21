-- =====================
-- rooms: name を building_name + room_number に分割
-- =====================
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS building_name TEXT,
  ADD COLUMN IF NOT EXISTS room_number   TEXT;

-- 既存データは name → building_name に移行
UPDATE rooms SET building_name = name WHERE building_name IS NULL;

ALTER TABLE rooms ALTER COLUMN building_name SET NOT NULL;

-- name 列は削除（移行後に実行）
ALTER TABLE rooms DROP COLUMN IF EXISTS name;

-- 水道光熱費の概算値（部屋ごとのベース）
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS utility_electricity_estimate INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS utility_water_estimate       INTEGER NOT NULL DEFAULT 0;

-- =====================
-- utility_costs テーブル（実績）
-- =====================
CREATE TABLE IF NOT EXISTS utility_costs (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL CHECK (year_month ~ '^\d{4}-\d{2}$'),
  electricity INTEGER,
  water       INTEGER,
  memo        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, year_month)
);

ALTER TABLE utility_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_utility_costs" ON utility_costs FOR ALL USING (true) WITH CHECK (true);
