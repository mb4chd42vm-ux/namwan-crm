-- Migration 003: Add LINE LIFF picture_url to customers
-- The line_id column already exists (from schema.sql).
-- We only need to add picture_url for caching the LINE profile picture.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS picture_url TEXT;

COMMENT ON COLUMN customers.line_id    IS 'LINE userId from LIFF — unique per LINE account';
COMMENT ON COLUMN customers.picture_url IS 'Cached LINE profile picture URL';
