-- Add source_context column to blocks table for outline planning
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS source_context TEXT;

-- Update existing blocks to have empty source_context
UPDATE blocks SET source_context = '' WHERE source_context IS NULL;
