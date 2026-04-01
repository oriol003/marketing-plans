-- Seed initial tactic templates from the existing template library
insert into public.tactic_templates (name, description, category, default_hours, default_duration, icon) values
  -- Strategy & Research
  ('Competitor Analysis & Market Research', 'Research industry trends, competitor insights, and audience expectations to build data-driven strategy', 'Strategy & Research', 4, 3, '🔍'),
  ('Brand Identity Development', 'Define brand values, positioning, tone of voice, and strategic differentiation', 'Strategy & Research', 2, 8, '✨'),
  ('Messaging Strategy', 'Create consistent brand messaging script including tone, benefits, and positioning', 'Strategy & Research', 6, 11, '📝'),
  
  -- Brand & Creative
  ('Social Media Branding', 'Design platform-ready assets for LinkedIn, Facebook, Instagram, X, YouTube, and TikTok', 'Brand & Creative', 3, 11, '🎨'),
  ('Stationery Design', 'Create branded letterhead, envelopes, folders, and QR-enabled business cards', 'Brand & Creative', 5, 12, '📄'),
  ('Logo Animation', 'Produce short animated logo sequence with audio for videos and podcasts', 'Brand & Creative', 3, 3, '🎬'),
  ('Team Photography', 'Professional photography of leadership and editorial team for authentic brand presence', 'Brand & Creative', 3, 8, '📸'),
  ('Location Photo/Video Set', 'Curated library of original photography and video clips including drone aerials', 'Brand & Creative', 8, 19, '🎥'),
  
  -- Social Media
  ('Social Media Planning', 'Develop content plan with platform priorities, posting cadence, and hashtag guide', 'Social Media', 8, 12, '📱'),
  ('Platform Setup & Optimization', 'Finalize all brand accounts with visual kits, bios, and CTAs', 'Social Media', 4, 4, '⚙️'),
  
  -- Direct Marketing
  ('CRM Implementation', 'Setup and configure CRM system with pipelines, automations, and dashboards', 'Direct Marketing', 4, 3, '🗂️'),
  ('Email Marketing Setup', 'Configure ESP with authentication, templates, and automated sequences', 'Direct Marketing', 1, 2, '📧'),
  ('Weekly Newsletter', 'Design and launch branded weekly newsletter as lead magnet', 'Direct Marketing', 4, 31, '📰'),
  ('Daily Briefing', 'Setup automated daily email with top stories and updates', 'Direct Marketing', 4, 12, '☀️')
on conflict do nothing;
