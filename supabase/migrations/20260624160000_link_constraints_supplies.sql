-- Link constraints with supply packages
ALTER TABLE constraints ADD COLUMN IF NOT EXISTS supply_package_id UUID REFERENCES supply_packages(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_constraints_supply_package_id ON constraints(supply_package_id);
