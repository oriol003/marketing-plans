-- Drop the old constraint
ALTER TABLE public.blocks 
  DROP CONSTRAINT IF EXISTS blocks_content_required_for_text_tactic;

-- Add updated constraint that handles section blocks and allows empty strings
ALTER TABLE public.blocks 
  ADD CONSTRAINT blocks_content_required_for_text_tactic 
  CHECK (
    (type IN ('table', 'timeline', 'section')) OR 
    (type IN ('text', 'tactic') AND content IS NOT NULL)
  );
