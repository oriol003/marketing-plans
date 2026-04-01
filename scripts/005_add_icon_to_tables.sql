-- Add icon column to tactic_templates table
ALTER TABLE tactic_templates
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'Package';

-- Add icon column to blocks table (for tactic blocks)
ALTER TABLE blocks
ADD COLUMN IF NOT EXISTS icon TEXT;

-- Update existing templates with icons using name matching instead of IDs
UPDATE tactic_templates SET icon = 'Search' WHERE name = 'Competitor Analysis & Market Research';
UPDATE tactic_templates SET icon = 'Sparkles' WHERE name = 'Brand Identity Development';
UPDATE tactic_templates SET icon = 'MessageSquare' WHERE name = 'Messaging Strategy';
UPDATE tactic_templates SET icon = 'Share2' WHERE name = 'Social Media Branding';
UPDATE tactic_templates SET icon = 'FileText' WHERE name = 'Stationery Design';
UPDATE tactic_templates SET icon = 'Film' WHERE name = 'Logo Animation';
UPDATE tactic_templates SET icon = 'Camera' WHERE name = 'Team Photography';
UPDATE tactic_templates SET icon = 'Video' WHERE name = 'Location Photo/Video Set';
UPDATE tactic_templates SET icon = 'Calendar' WHERE name = 'Social Media Planning';
UPDATE tactic_templates SET icon = 'Settings' WHERE name = 'Platform Setup & Optimization';
UPDATE tactic_templates SET icon = 'Database' WHERE name = 'CRM Implementation';
UPDATE tactic_templates SET icon = 'Mail' WHERE name = 'Email Marketing Setup';
UPDATE tactic_templates SET icon = 'Newspaper' WHERE name = 'Weekly Newsletter';
UPDATE tactic_templates SET icon = 'Clock' WHERE name = 'Daily Briefing';
