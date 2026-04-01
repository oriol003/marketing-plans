-- Allow new block types and make content nullable for computed blocks
ALTER TABLE public.blocks 
  DROP CONSTRAINT IF EXISTS blocks_type_check;

ALTER TABLE public.blocks 
  ADD CONSTRAINT blocks_type_check 
  CHECK (type IN ('text', 'tactic', 'table', 'timeline'));

-- Make content nullable since computed blocks don't store content
ALTER TABLE public.blocks 
  ALTER COLUMN content DROP NOT NULL;

-- Add a constraint to ensure text and tactic blocks have content
ALTER TABLE public.blocks 
  ADD CONSTRAINT blocks_content_required_for_text_tactic 
  CHECK (
    (type IN ('table', 'timeline')) OR 
    (type IN ('text', 'tactic') AND content IS NOT NULL)
  );
