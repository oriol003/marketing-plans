-- Add image fields to blocks table
ALTER TABLE blocks 
ADD COLUMN IF NOT EXISTS image TEXT,
ADD COLUMN IF NOT EXISTS image_position TEXT CHECK (image_position IN ('above', 'below'));
