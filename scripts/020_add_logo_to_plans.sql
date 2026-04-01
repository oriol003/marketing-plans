-- Add logo column to plans table
ALTER TABLE plans ADD COLUMN IF NOT EXISTS logo TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN plans.logo IS 'URL to the customer logo image stored in Vercel Blob';
