-- Drop the old constraint that doesn't account for cover blocks
ALTER TABLE public.blocks 
  DROP CONSTRAINT IF EXISTS blocks_content_required_for_text_tactic;

-- Add updated constraint that handles all block types properly
ALTER TABLE public.blocks 
  ADD CONSTRAINT blocks_content_required_for_text_tactic 
  CHECK (
    -- These block types don't require content
    (type IN ('table', 'timeline', 'section', 'cover')) OR 
    -- These block types must have content
    (type IN ('text', 'tactic') AND content IS NOT NULL AND content != '')
  );

-- Update type constraint to include cover
ALTER TABLE public.blocks 
  DROP CONSTRAINT IF EXISTS blocks_type_check;

ALTER TABLE public.blocks 
  ADD CONSTRAINT blocks_type_check 
  CHECK (type IN ('text', 'tactic', 'table', 'timeline', 'section', 'cover'));
