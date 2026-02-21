-- Create test_circuits table for per-circuit documentation
-- This enables Schedule of Test Results with circuit-specific details

CREATE TABLE IF NOT EXISTS test_circuits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  circuit_reference VARCHAR(100) NOT NULL, -- e.g., 'Ring Final 1', 'Lighting Circuit 2', 'Cooker Circuit'
  circuit_description VARCHAR(255), -- e.g., 'Kitchen sockets', 'Downstairs lighting'
  location VARCHAR(255), -- e.g., 'Ground floor', 'First floor bedrooms'

  -- Circuit details per BS 7671
  circuit_type VARCHAR(100), -- 'ring_final', 'radial', 'lighting', 'cooker', 'shower', 'immersion', 'other'
  conductor_csa VARCHAR(50), -- e.g., '2.5mm²', '4.0mm²', '6.0mm²', '10.0mm²'
  cpc_csa VARCHAR(50), -- Protective conductor cross-sectional area (e.g., '1.5mm²', '2.5mm²')

  -- Overcurrent protection device
  overcurrent_device_type VARCHAR(100), -- e.g., 'MCB Type B', 'MCB Type C', 'RCBO', 'Fuse BS88'
  overcurrent_device_rating VARCHAR(50), -- e.g., '6A', '16A', '32A', '40A'
  overcurrent_device_location VARCHAR(255), -- e.g., 'Main consumer unit', 'Sub-board garage'

  -- RCD protection
  rcd_protected BOOLEAN DEFAULT false,
  rcd_rating VARCHAR(50), -- e.g., '30mA', '100mA', '300mA'
  rcd_type VARCHAR(50), -- e.g., 'Type A', 'Type AC', 'Type B'

  -- Maximum demand and length
  max_demand_amps DECIMAL(10, 2), -- Maximum demand in amps
  circuit_length_meters DECIMAL(10, 2), -- Cable run length

  -- Test results summary (detailed measurements in test_measurements table)
  continuity_r1_r2 DECIMAL(10, 3), -- Ohms
  insulation_resistance DECIMAL(10, 3), -- MegaOhms
  earth_loop_impedance DECIMAL(10, 3), -- Ohms (Zs)
  polarity_correct BOOLEAN,

  -- Overall assessment
  test_result VARCHAR(50), -- 'satisfactory', 'unsatisfactory', 'requires_improvement', 'not_tested'
  defects_noted TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Ensure unique circuit reference per test
  CONSTRAINT test_circuits_unique_reference
  UNIQUE (test_id, circuit_reference)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_test_circuits_tenant
ON test_circuits(tenant_id);

CREATE INDEX IF NOT EXISTS idx_test_circuits_test
ON test_circuits(test_id);

CREATE INDEX IF NOT EXISTS idx_test_circuits_type
ON test_circuits(circuit_type);

CREATE INDEX IF NOT EXISTS idx_test_circuits_reference
ON test_circuits(circuit_reference);

CREATE INDEX IF NOT EXISTS idx_test_circuits_result
ON test_circuits(test_result);

-- Add comments for documentation
COMMENT ON TABLE test_circuits IS
  'Individual electrical circuits tested per BS 7671 Schedule of Test Results';

COMMENT ON COLUMN test_circuits.circuit_reference IS
  'Unique circuit identifier (e.g., "Ring Final 1", "Lighting Circuit 2")';

COMMENT ON COLUMN test_circuits.conductor_csa IS
  'Cross-sectional area of live conductors (e.g., "2.5mm²", "4.0mm²")';

COMMENT ON COLUMN test_circuits.cpc_csa IS
  'Cross-sectional area of circuit protective conductor (earth wire)';

COMMENT ON COLUMN test_circuits.overcurrent_device_type IS
  'Type of overcurrent protection: MCB Type B, MCB Type C, RCBO, Fuse BS88, etc.';

COMMENT ON COLUMN test_circuits.rcd_rating IS
  'RCD sensitivity rating if RCD protected: 30mA (general), 100mA (fire), 300mA (fire)';

COMMENT ON COLUMN test_circuits.continuity_r1_r2 IS
  'Combined resistance of phase conductor and protective conductor (Ohms)';

COMMENT ON COLUMN test_circuits.earth_loop_impedance IS
  'Earth fault loop impedance Zs (Ohms). Must be below BS 7671 Appendix 3 maximums.';

-- Add check constraints
ALTER TABLE test_circuits
ADD CONSTRAINT test_circuits_type_check
CHECK (circuit_type IS NULL OR circuit_type IN (
  'ring_final',
  'radial',
  'lighting',
  'cooker',
  'shower',
  'immersion',
  'ev_charger',
  'other'
));

ALTER TABLE test_circuits
ADD CONSTRAINT test_circuits_result_check
CHECK (test_result IN (
  'satisfactory',
  'unsatisfactory',
  'requires_improvement',
  'not_tested'
));

-- Add updated_at trigger
CREATE TRIGGER trigger_test_circuits_updated_at
BEFORE UPDATE ON test_circuits
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
