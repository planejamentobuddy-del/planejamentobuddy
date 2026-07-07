-- Add pdf_url column to supply_packages table
ALTER TABLE supply_packages
  ADD COLUMN IF NOT EXISTS pdf_url TEXT;
