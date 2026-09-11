
-- 1. application_files
CREATE TABLE IF NOT EXISTS public.application_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  file_name text NOT NULL DEFAULT '—',
  file_type text NOT NULL DEFAULT 'image/jpeg',
  storage_path text,
  telegram_file_id text,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('before','after','act','receipt','other')),
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.application_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_application_files" ON public.application_files
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_application_files" ON public.application_files
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_application_files" ON public.application_files
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_application_files" ON public.application_files
  FOR DELETE TO authenticated USING (true);

-- 2. application_comments
CREATE TABLE IF NOT EXISTS public.application_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.application_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_application_comments" ON public.application_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_application_comments" ON public.application_comments
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "delete_application_comments" ON public.application_comments
  FOR DELETE TO authenticated USING (true);

-- 3. automation_rules
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_automation_rules" ON public.automation_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "update_automation_rules" ON public.automation_rules
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.automation_rules (id, code, name, description, enabled) VALUES
  ('no_contractor_15min', 'no_contractor_15min', 'Заявка без підрядника >15 хв', 'Нова заявка без призначеного підрядника понад 15 хвилин', true),
  ('deadline_1h', 'deadline_1h', 'Дедлайн <1 год', 'До дедлайну залишилося менше години', true),
  ('overdue', 'overdue', 'Заявка прострочена', 'Дедлайн минув, заявка не виконана', true),
  ('contractor_problem', 'contractor_problem', 'Підрядник повідомив problem', 'Підрядник повідомив про проблему', true),
  ('act_long_pending', 'act_long_pending', 'Акт довго на перевірці', 'Акт очікує перевірки понад 24 години', true),
  ('payout_long_pending', 'payout_long_pending', 'Виплата довго очікує', 'Виплата очікує оплати понад 48 годин', true)
ON CONFLICT (code) DO NOTHING;

-- 4. Expand admin_users role constraint
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('owner', 'admin', 'dispatcher', 'accountant', 'viewer'));
