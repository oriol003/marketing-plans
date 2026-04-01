-- Renamed table from "references" to "plan_references" to avoid PostgreSQL reserved keyword
CREATE TABLE IF NOT EXISTS plan_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE plan_references ENABLE ROW LEVEL SECURITY;

-- Create policies for plan_references
CREATE POLICY plan_references_select_all ON plan_references FOR SELECT USING (true);
CREATE POLICY plan_references_insert_all ON plan_references FOR INSERT WITH CHECK (true);
CREATE POLICY plan_references_update_all ON plan_references FOR UPDATE USING (true);
CREATE POLICY plan_references_delete_all ON plan_references FOR DELETE USING (true);

-- Create index on plan_id for faster queries
CREATE INDEX IF NOT EXISTS idx_plan_references_plan_id ON plan_references(plan_id);

-- Create index on order for sorting
CREATE INDEX IF NOT EXISTS idx_plan_references_order ON plan_references("order");
