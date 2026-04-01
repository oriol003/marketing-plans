-- Add support for new block types (table and timeline)
-- No schema changes needed as the 'type' column already exists
-- This is just a documentation script to mark the addition of these types

-- The blocks table already supports any type value
-- We're adding these new types: 'table' and 'timeline'
-- These are computed/display-only blocks that read from tactic blocks

-- No migration needed, just documenting the new block types
