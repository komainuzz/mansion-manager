-- =====================
-- user_approvals テーブル
-- =====================
CREATE TABLE IF NOT EXISTS user_approvals (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  display_name TEXT,
  avatar_url   TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE user_approvals ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のレコードを読める
CREATE POLICY "users_read_own_approval"
  ON user_approvals FOR SELECT
  USING (auth.uid() = user_id);

-- 管理者はすべて操作可能
CREATE POLICY "admin_manage_approvals"
  ON user_approvals FOR ALL
  USING (auth.email() = 'kom.kim126@gmail.com')
  WITH CHECK (auth.email() = 'kom.kim126@gmail.com');

-- =====================
-- 新規ユーザー登録時に自動でレコード作成
-- =====================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_approvals (user_id, email, display_name, avatar_url, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN NEW.email = 'kom.kim126@gmail.com' THEN 'approved' ELSE 'pending' END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================
-- 既存ユーザーのバックフィル
-- =====================
INSERT INTO public.user_approvals (user_id, email, display_name, avatar_url, status)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email),
  raw_user_meta_data->>'avatar_url',
  CASE WHEN email = 'kom.kim126@gmail.com' THEN 'approved' ELSE 'pending' END
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
