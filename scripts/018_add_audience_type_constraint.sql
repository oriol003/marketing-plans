-- Add 'audience' to the allowed block types
ALTER TABLE blocks DROP CONSTRAINT IF EXISTS blocks_type_check;
ALTER TABLE blocks ADD CONSTRAINT blocks_type_check 
  CHECK (type = ANY (ARRAY['text'::text, 'tactic'::text, 'table'::text, 'timeline'::text, 'section'::text, 'cover'::text, 'audience'::text]));

-- Update the content requirement constraint to exclude audience blocks
ALTER TABLE blocks DROP CONSTRAINT IF EXISTS blocks_content_required_for_text_tactic;
ALTER TABLE blocks ADD CONSTRAINT blocks_content_required_for_text_tactic 
  CHECK (
    (type = ANY (ARRAY['table'::text, 'timeline'::text, 'section'::text, 'cover'::text, 'audience'::text])) 
    OR 
    ((type = ANY (ARRAY['text'::text, 'tactic'::text])) AND (content IS NOT NULL) AND (content <> ''::text))
  );
