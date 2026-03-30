#!/bin/bash
set -e
pnpm install --frozen-lockfile

# ── Idempotent migrations ────────────────────────────────────────────────────
# Task #9: Add user_id to categories and subcategories (multi-user isolation)
# These statements are safe to run multiple times.
psql "$DATABASE_URL" <<'SQL'
-- Add user_id to categories if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'user_id'
  ) THEN
    -- 1. Add nullable
    ALTER TABLE categories ADD COLUMN user_id integer;
    -- 2. Backfill to admin user
    UPDATE categories SET user_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)
      WHERE user_id IS NULL;
    -- 3. Make NOT NULL
    ALTER TABLE categories ALTER COLUMN user_id SET NOT NULL;
    -- 4. Add FK
    ALTER TABLE categories ADD CONSTRAINT categories_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Add user_id to subcategories if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subcategories' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE subcategories ADD COLUMN user_id integer;
    UPDATE subcategories SET user_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)
      WHERE user_id IS NULL;
    ALTER TABLE subcategories ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE subcategories ADD CONSTRAINT subcategories_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END$$;
SQL

pnpm --filter db push
