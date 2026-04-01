-- Add section_number column to blocks table for document-style section numbering
ALTER TABLE blocks 
ADD COLUMN section_number TEXT;
