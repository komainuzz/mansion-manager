-- 駐車場の契約料
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS parking_fee INTEGER NOT NULL DEFAULT 0;

-- WiFi: boolean → 詳細テキストに変更（null = なし）
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS wifi_detail TEXT;

-- 既存の has_wifi=true をマイグレーション
UPDATE rooms SET wifi_detail = 'あり' WHERE has_wifi = TRUE AND wifi_detail IS NULL;

-- 給湯器の型番
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS water_heater_model TEXT;
