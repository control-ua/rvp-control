/*
# Create contractors and applications tables (read-only phase)

## Overview
Creates two tables — `contractors` and `applications` — to back the RVP Admin
frontend with real Supabase data. This is the READ-ONLY connection phase: the
frontend only reads from these tables. No create/update/delete actions are
enabled in the app yet.

## Tables

### 1. `contractors`
- `id` (text, primary key)
- `first_name` (text, not null) — contractor first name
- `last_name` (text, not null) — contractor last name
- `phone` (text, not null) — contractor phone number
- `region_name` (text, not null) — contractor region (e.g. "Київ", "Дніпро")
- `status` (text, not null) — "Активний" | "Неактивний"
- `telegram_id` (text) — optional Telegram handle
- `total_applications` (int, default 0)
- `completed_applications` (int, default 0)
- `total_payout` (numeric, default 0)
- `created_at` (timestamptz, default now())

### 2. `applications`
- `id` (text, primary key)
- `application_number` (text, unique, not null) — e.g. "RVP-2024-001"
- `azk_code` (text) — optional AZK code
- `order_date_text` (text, not null) — order date "YYYY-MM-DD"
- `title` (text, not null) — customer / order title
- `description` (text) — work description
- `address` (text, not null) — work address
- `status` (text, not null) — "Нова" | "Прийнята" | "В роботі" | "Виконана" | "Скасована"
- `deadline_at` (text) — deadline date string
- `customer_phone` (text) — customer phone
- `amount` (numeric, default 0) — order amount
- `payout_amount` (numeric, default 0) — contractor payout amount
- `payout_status` (text) — "Очікує" | "Виплачено"
- `scheduled_date` (text) — scheduled visit datetime
- `manager_comment` (text)
- `actual_volume` (numeric, default 0)
- `unit_price` (numeric, default 0)
- `act_photo` (text) — URL to act photo
- `payout_receipt` (text) — receipt file name
- `act_upload_date` (text)
- `contractor_id` (text, foreign key → contractors.id ON DELETE SET NULL)
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on both tables.
- SELECT-only policies scoped to `anon, authenticated` (no-auth app — the
  frontend uses the anon key with no sign-in screen).
- No INSERT / UPDATE / DELETE policies — the app is read-only in this phase.

## Seed data
- 6 contractors and 11 applications matching the existing mock data so the
  frontend renders identically after switching from mock to Supabase.
*/

-- ───────────────────────── contractors ─────────────────────────
CREATE TABLE IF NOT EXISTS contractors (
  id text PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  region_name text NOT NULL,
  status text NOT NULL DEFAULT 'Активний',
  telegram_id text,
  total_applications int NOT NULL DEFAULT 0,
  completed_applications int NOT NULL DEFAULT 0,
  total_payout numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_contractors" ON contractors;
CREATE POLICY "anon_read_contractors"
  ON contractors FOR SELECT
  TO anon, authenticated
  USING (true);

-- ───────────────────────── applications ─────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id text PRIMARY KEY,
  application_number text UNIQUE NOT NULL,
  azk_code text,
  order_date_text text NOT NULL,
  title text NOT NULL,
  description text,
  address text NOT NULL,
  status text NOT NULL,
  deadline_at text,
  customer_phone text,
  amount numeric NOT NULL DEFAULT 0,
  payout_amount numeric NOT NULL DEFAULT 0,
  payout_status text,
  scheduled_date text,
  manager_comment text,
  actual_volume numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  act_photo text,
  payout_receipt text,
  act_upload_date text,
  contractor_id text REFERENCES contractors(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_applications" ON applications;
CREATE POLICY "anon_read_applications"
  ON applications FOR SELECT
  TO anon, authenticated
  USING (true);

-- index for the contractor join
CREATE INDEX IF NOT EXISTS idx_applications_contractor_id ON applications(contractor_id);

-- ───────────────────────── seed contractors ─────────────────────────
INSERT INTO contractors (id, first_name, last_name, phone, region_name, status, telegram_id, total_applications, completed_applications, total_payout)
VALUES
  ('c1', 'Олексій', 'Іваненко Петрович', '+380 67 123 4567', 'Київ', 'Активний', '@ivnk_alex', 34, 29, 87400),
  ('c2', 'Василь', 'Мельник Іванович', '+380 50 234 5678', 'Київ', 'Активний', '@melnyk_vas', 27, 24, 72100),
  ('c3', 'Андрій', 'Шевченко Олегович', '+380 63 345 6789', 'Дніпро', 'Активний', '@shevch_and', 19, 17, 51000),
  ('c4', 'Сергій', 'Бондаренко Миколайович', '+380 98 456 7890', 'Київ', 'Активний', '@bond_serg', 22, 20, 64500),
  ('c5', 'Дмитро', 'Коваленко Олександрович', '+380 66 567 8901', 'Дніпро', 'Неактивний', '@koval_dm', 8, 6, 18200),
  ('c6', 'Роман', 'Поліщук Вікторович', '+380 73 678 9012', 'Київ', 'Активний', '@pol_roman', 15, 14, 42000)
ON CONFLICT (id) DO NOTHING;

-- ───────────────────────── seed applications ─────────────────────────
INSERT INTO applications (id, application_number, azk_code, order_date_text, title, description, address, status, deadline_at, customer_phone, amount, payout_amount, payout_status, scheduled_date, manager_comment, actual_volume, unit_price, act_photo, payout_receipt, act_upload_date, contractor_id)
VALUES
  ('a1', 'RVP-2024-001', 'AZK-001', '2024-08-01', 'ТОВ "Будінвест"', 'Прибирання будівельного сміття після ремонту офісних приміщень. Площа — 450 м².', 'вул. Хрещатик, 22, Київ', 'Виконана', '2024-08-05', '+380 44 100 2200', 12500, 8500, 'Виплачено', '2024-08-05T09:00', 'Замовник задоволений якістю роботи.', 25, 500, 'https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg?w=400', 'receipt_001.pdf', '2024-08-06', 'c1'),
  ('a2', 'RVP-2024-002', 'AZK-002', '2024-08-03', 'ФОП Петренко В.О.', 'Вивіз будівельних відходів. Демонтаж старих перегородок.', 'просп. Перемоги, 44, Київ', 'В роботі', '2024-08-10', '+380 67 300 1122', 8200, 6100, 'Очікує', '2024-08-10T10:00', 'Підрядник підтвердив виїзд.', 18, 450, NULL, NULL, '2024-08-11', 'c2'),
  ('a3', 'RVP-2024-003', 'AZK-003', '2024-08-05', 'ТОВ "Альфабуд"', 'Масштабне прибирання після будівництва ТРЦ. Площа — 1200 м².', 'вул. Велика Васильківська, 55, Київ', 'Нова', '2024-08-15', '+380 50 400 3344', 15000, 0, 'Очікує', '2024-08-15T08:00', '', 0, 600, NULL, NULL, NULL, 'c3'),
  ('a4', 'RVP-2024-004', 'AZK-004', '2024-08-07', 'ПАТ "Укрнафта"', 'Прибирання складського приміщення. Вивіз металобрухту та паперових відходів.', 'вул. Саксаганського, 12, Київ', 'Прийнята', '2024-08-12', '+380 44 500 6600', 9800, 0, 'Очікує', '2024-08-12T11:00', 'Підтверджено телефоном.', 0, 490, NULL, NULL, NULL, 'c4'),
  ('a5', 'RVP-2024-005', 'AZK-005', '2024-08-08', 'ТОВ "Зеленбуд"', 'Прибирання після демонтажу паркану та висадки дерев.', 'вул. Антоновича, 3, Київ', 'Виконана', '2024-08-09', '+380 63 700 8899', 6700, 4800, 'Виплачено', '2024-08-09T09:30', 'Виконано достроково.', 14, 480, 'https://images.pexels.com/photos/3990359/pexels-photo-3990359.jpeg?w=400', 'receipt_005.pdf', '2024-08-10', 'c1'),
  ('a6', 'RVP-2024-006', 'AZK-006', '2024-08-10', 'ФОП Коваль Н.С.', 'Прибирання після дрібного ремонту квартири.', 'Харківське шосе, 201, Київ', 'Скасована', '2024-08-13', '+380 50 900 0011', 4200, 0, 'Очікує', '2024-08-13T14:00', 'Замовник скасував заявку самостійно.', 0, 420, NULL, NULL, NULL, 'c6'),
  ('a7', 'RVP-2024-007', 'AZK-007', '2024-08-12', 'ТОВ "МегаСтрой"', 'Прибирання після зведення каркасного будинку.', 'бул. Лесі Українки, 34, Київ', 'В роботі', '2024-08-14', '+380 44 300 2211', 11200, 7500, 'Очікує', '2024-08-14T10:00', 'Потрібно взяти спецтехніку.', 22, 510, NULL, NULL, '2024-08-15', 'c2'),
  ('a8', 'RVP-2024-008', 'AZK-008', '2024-08-14', 'ТОВ "Престиж"', 'Прибирання після косметичного ремонту офісу.', 'вул. Ярославів Вал, 9, Київ', 'Нова', '2024-08-20', '+380 67 200 3344', 7600, 0, 'Очікує', '2024-08-20T09:00', '', 0, 460, NULL, NULL, NULL, 'c3'),
  ('a9', 'RVP-2024-009', 'AZK-009', '2024-08-15', 'ЖЕК "Оболонь"', 'Прибирання підвальних приміщень та входів до будинку.', 'просп. Оболонський, 17, Київ', 'Виконана', '2024-08-16', '+380 44 600 7788', 5500, 3800, 'Виплачено', '2024-08-16T08:00', 'Виконано якісно.', 11, 500, 'https://images.pexels.com/photos/6195951/pexels-photo-6195951.jpeg?w=400', 'receipt_009.pdf', '2024-08-17', 'c4'),
  ('a10', 'RVP-2024-010', 'AZK-010', '2024-08-16', 'ТОВ "Крокус"', 'Прибирання промислового цеху після реконструкції.', 'вул. Польова, 55, Бровари', 'Прийнята', '2024-08-22', '+380 50 800 9900', 13400, 0, 'Очікує', '2024-08-22T10:00', 'Виїзд погоджено.', 0, 670, NULL, NULL, NULL, 'c6'),
  ('a11', 'RVP-2024-011', 'AZK-011', '2024-08-17', 'ФОП Ткаченко Р.В.', 'Прибирання після дрібного ремонту магазину.', 'вул. Богдана Хмельницького, 28, Київ', 'Нова', '2024-08-21', '+380 63 100 2233', 3900, 0, 'Очікує', '2024-08-21T13:00', '', 0, 390, NULL, NULL, NULL, 'c1')
ON CONFLICT (id) DO NOTHING;
