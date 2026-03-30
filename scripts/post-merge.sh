#!/bin/bash
set -e
pnpm install --frozen-lockfile

# ── Idempotent migrations ────────────────────────────────────────────────────
# Task #9: Add user_id to categories and subcategories (multi-user isolation)
# Safe to run multiple times.
psql "$DATABASE_URL" <<'SQL'
-- Add user_id to categories if it does not exist
DO $$
DECLARE
  fallback_id integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'user_id'
  ) THEN
    -- 1. Add nullable column
    ALTER TABLE categories ADD COLUMN user_id integer;

    -- 2. Pick a fallback user: prefer admin, else first user, else skip
    SELECT id INTO fallback_id
    FROM users
    ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, id
    LIMIT 1;

    IF fallback_id IS NOT NULL THEN
      -- 3. Backfill existing rows to fallback user
      UPDATE categories SET user_id = fallback_id WHERE user_id IS NULL;
      -- 4. Apply NOT NULL constraint
      ALTER TABLE categories ALTER COLUMN user_id SET NOT NULL;
      -- 5. Add FK
      ALTER TABLE categories ADD CONSTRAINT categories_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END$$;

-- Add user_id to subcategories if it does not exist
DO $$
DECLARE
  fallback_id integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subcategories' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE subcategories ADD COLUMN user_id integer;

    SELECT id INTO fallback_id
    FROM users
    ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, id
    LIMIT 1;

    IF fallback_id IS NOT NULL THEN
      UPDATE subcategories SET user_id = fallback_id WHERE user_id IS NULL;
      ALTER TABLE subcategories ALTER COLUMN user_id SET NOT NULL;
      ALTER TABLE subcategories ADD CONSTRAINT subcategories_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END$$;

-- Seed default categories for any existing users who have none yet
-- (handles existing non-admin users from before this migration)
DO $$
DECLARE
  u record;
  cat_count integer;
  cat_id integer;
BEGIN
  FOR u IN SELECT id FROM users LOOP
    SELECT COUNT(*) INTO cat_count FROM categories WHERE user_id = u.id;
    IF cat_count = 0 THEN
      -- Housing
      INSERT INTO categories (name, type, user_id) VALUES ('Housing', 'expense', u.id) RETURNING id INTO cat_id;
      INSERT INTO subcategories (name, category_id, type, user_id) VALUES
        ('Rent', cat_id, 'expense', u.id), ('Mortgage', cat_id, 'expense', u.id),
        ('Utilities', cat_id, 'expense', u.id), ('Home Insurance', cat_id, 'expense', u.id),
        ('HOA Fees', cat_id, 'expense', u.id), ('Home Repairs', cat_id, 'expense', u.id);
      -- Food & Dining
      INSERT INTO categories (name, type, user_id) VALUES ('Food & Dining', 'expense', u.id) RETURNING id INTO cat_id;
      INSERT INTO subcategories (name, category_id, type, user_id) VALUES
        ('Groceries', cat_id, 'expense', u.id), ('Restaurants', cat_id, 'expense', u.id),
        ('Coffee & Cafes', cat_id, 'expense', u.id), ('Fast Food', cat_id, 'expense', u.id),
        ('Takeout', cat_id, 'expense', u.id);
      -- Transportation
      INSERT INTO categories (name, type, user_id) VALUES ('Transportation', 'expense', u.id) RETURNING id INTO cat_id;
      INSERT INTO subcategories (name, category_id, type, user_id) VALUES
        ('Gas', cat_id, 'expense', u.id), ('Car Insurance', cat_id, 'expense', u.id),
        ('Parking', cat_id, 'expense', u.id), ('Public Transit', cat_id, 'expense', u.id),
        ('Rideshare', cat_id, 'expense', u.id), ('Car Maintenance', cat_id, 'expense', u.id);
      -- Health
      INSERT INTO categories (name, type, user_id) VALUES ('Health', 'expense', u.id) RETURNING id INTO cat_id;
      INSERT INTO subcategories (name, category_id, type, user_id) VALUES
        ('Doctor', cat_id, 'expense', u.id), ('Dentist', cat_id, 'expense', u.id),
        ('Pharmacy', cat_id, 'expense', u.id), ('Gym', cat_id, 'expense', u.id),
        ('Health Insurance', cat_id, 'expense', u.id);
      -- Entertainment
      INSERT INTO categories (name, type, user_id) VALUES ('Entertainment', 'expense', u.id) RETURNING id INTO cat_id;
      INSERT INTO subcategories (name, category_id, type, user_id) VALUES
        ('Movies', cat_id, 'expense', u.id), ('Music', cat_id, 'expense', u.id),
        ('Gaming', cat_id, 'expense', u.id), ('Streaming Services', cat_id, 'expense', u.id),
        ('Books & Magazines', cat_id, 'expense', u.id);
      -- Shopping
      INSERT INTO categories (name, type, user_id) VALUES ('Shopping', 'expense', u.id) RETURNING id INTO cat_id;
      INSERT INTO subcategories (name, category_id, type, user_id) VALUES
        ('Clothing', cat_id, 'expense', u.id), ('Electronics', cat_id, 'expense', u.id),
        ('Home Goods', cat_id, 'expense', u.id), ('Personal Care', cat_id, 'expense', u.id),
        ('Gifts', cat_id, 'expense', u.id);
      -- Education
      INSERT INTO categories (name, type, user_id) VALUES ('Education', 'expense', u.id) RETURNING id INTO cat_id;
      INSERT INTO subcategories (name, category_id, type, user_id) VALUES
        ('Tuition', cat_id, 'expense', u.id), ('Books & Supplies', cat_id, 'expense', u.id),
        ('Online Courses', cat_id, 'expense', u.id), ('School Fees', cat_id, 'expense', u.id);
      -- Travel
      INSERT INTO categories (name, type, user_id) VALUES ('Travel', 'expense', u.id) RETURNING id INTO cat_id;
      INSERT INTO subcategories (name, category_id, type, user_id) VALUES
        ('Flights', cat_id, 'expense', u.id), ('Hotels', cat_id, 'expense', u.id),
        ('Car Rental', cat_id, 'expense', u.id), ('Vacation Activities', cat_id, 'expense', u.id);
      -- Subscriptions
      INSERT INTO categories (name, type, user_id) VALUES ('Subscriptions', 'expense', u.id) RETURNING id INTO cat_id;
      INSERT INTO subcategories (name, category_id, type, user_id) VALUES
        ('Software', cat_id, 'expense', u.id), ('Newspapers & Magazines', cat_id, 'expense', u.id),
        ('Memberships', cat_id, 'expense', u.id);
      -- Insurance
      INSERT INTO categories (name, type, user_id) VALUES ('Insurance', 'expense', u.id) RETURNING id INTO cat_id;
      INSERT INTO subcategories (name, category_id, type, user_id) VALUES
        ('Life Insurance', cat_id, 'expense', u.id), ('Renters Insurance', cat_id, 'expense', u.id),
        ('Pet Insurance', cat_id, 'expense', u.id);
      -- Taxes
      INSERT INTO categories (name, type, user_id) VALUES ('Taxes', 'expense', u.id) RETURNING id INTO cat_id;
      INSERT INTO subcategories (name, category_id, type, user_id) VALUES
        ('Federal Tax', cat_id, 'expense', u.id), ('State Tax', cat_id, 'expense', u.id),
        ('Property Tax', cat_id, 'expense', u.id);
      -- Savings & Investments
      INSERT INTO categories (name, type, user_id) VALUES ('Savings & Investments', 'expense', u.id) RETURNING id INTO cat_id;
      INSERT INTO subcategories (name, category_id, type, user_id) VALUES
        ('Emergency Fund', cat_id, 'expense', u.id), ('Retirement Contribution', cat_id, 'expense', u.id),
        ('Investment Purchase', cat_id, 'expense', u.id);
      -- Salary & Wages
      INSERT INTO categories (name, type, user_id) VALUES ('Salary & Wages', 'income', u.id) RETURNING id INTO cat_id;
      INSERT INTO subcategories (name, category_id, type, user_id) VALUES
        ('Paycheck', cat_id, 'income', u.id), ('Bonus', cat_id, 'income', u.id),
        ('Commission', cat_id, 'income', u.id), ('Overtime', cat_id, 'income', u.id);
      -- Business Income
      INSERT INTO categories (name, type, user_id) VALUES ('Business Income', 'income', u.id) RETURNING id INTO cat_id;
      INSERT INTO subcategories (name, category_id, type, user_id) VALUES
        ('Freelance', cat_id, 'income', u.id), ('Consulting', cat_id, 'income', u.id),
        ('Contract Work', cat_id, 'income', u.id);
      -- Investment Income
      INSERT INTO categories (name, type, user_id) VALUES ('Investment Income', 'income', u.id) RETURNING id INTO cat_id;
      INSERT INTO subcategories (name, category_id, type, user_id) VALUES
        ('Dividends', cat_id, 'income', u.id), ('Capital Gains', cat_id, 'income', u.id),
        ('Interest', cat_id, 'income', u.id), ('Rental Income', cat_id, 'income', u.id);
      -- Other Income
      INSERT INTO categories (name, type, user_id) VALUES ('Other Income', 'income', u.id) RETURNING id INTO cat_id;
      INSERT INTO subcategories (name, category_id, type, user_id) VALUES
        ('Tax Refund', cat_id, 'income', u.id), ('Gifts Received', cat_id, 'income', u.id),
        ('Reimbursements', cat_id, 'income', u.id), ('Side Hustle', cat_id, 'income', u.id);
    END IF;
  END LOOP;
END$$;
SQL

pnpm --filter db push
