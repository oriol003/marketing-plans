-- Add branding and badge label fields to blocks table for cover blocks
ALTER TABLE blocks
ADD COLUMN IF NOT EXISTS branding TEXT,
ADD COLUMN IF NOT EXISTS badge_label TEXT;
