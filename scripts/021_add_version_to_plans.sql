-- Add version column to plans table for optimistic locking
ALTER TABLE plans ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Create index on version for faster lookups
CREATE INDEX IF NOT EXISTS idx_plans_version ON plans(version);

-- Update trigger to increment version on every update
CREATE OR REPLACE FUNCTION increment_plan_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plan_version_trigger
BEFORE UPDATE ON plans
FOR EACH ROW
EXECUTE FUNCTION increment_plan_version();
