-- Add cover block support to the blocks table
-- This migration adds the necessary fields for cover page blocks

-- The cover block reuses existing columns:
-- - title: main title
-- - description: subtitle/description  
-- - content: additional content (JSON for clientName, executionPeriod, brandColors)

-- No schema changes needed as existing columns support cover block data
-- Just documenting that 'cover' is now a valid block type
