-- Add color and cover image fields to sections
ALTER TABLE blocks 
ADD COLUMN IF NOT EXISTS color TEXT,
ADD COLUMN IF NOT EXISTS cover_image TEXT;
