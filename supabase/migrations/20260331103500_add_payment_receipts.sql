-- Create payment_receipts table to store individual payment entries
CREATE TABLE IF NOT EXISTS payment_receipts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  description text DEFAULT '',
  received_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read all payment_receipts
CREATE POLICY "Authenticated users can read payment_receipts"
  ON payment_receipts FOR SELECT
  TO authenticated
  USING (true);

-- Policy: authenticated users can insert payment_receipts
CREATE POLICY "Authenticated users can insert payment_receipts"
  ON payment_receipts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: authenticated users can delete payment_receipts
CREATE POLICY "Authenticated users can delete payment_receipts"
  ON payment_receipts FOR DELETE
  TO authenticated
  USING (true);
