-- Create test measurement standards table for BS 7671 validation
-- This enables real-time validation during test recording

CREATE TABLE IF NOT EXISTS test_measurement_standards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  measurement_type VARCHAR(100) NOT NULL,
  circuit_type VARCHAR(100),
  circuit_rating VARCHAR(50), -- e.g., '6A', '32A', '40A'
  min_acceptable DECIMAL(10, 3),
  max_acceptable DECIMAL(10, 3),
  standard_reference VARCHAR(255) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Ensure unique combination of measurement, circuit type, and rating
  CONSTRAINT test_measurement_standards_unique
  UNIQUE (measurement_type, circuit_type, circuit_rating)
);

CREATE INDEX IF NOT EXISTS idx_measurement_standards_type
ON test_measurement_standards(measurement_type);

CREATE INDEX IF NOT EXISTS idx_measurement_standards_circuit
ON test_measurement_standards(circuit_type);

-- Add comments for documentation
COMMENT ON TABLE test_measurement_standards IS
  'BS 7671:2018+A3:2024 acceptable ranges for electrical test measurements';

COMMENT ON COLUMN test_measurement_standards.measurement_type IS
  'Type of measurement: insulation, earth_loop, rcd_trip_time, continuity, etc.';

COMMENT ON COLUMN test_measurement_standards.circuit_type IS
  'Type of circuit: final_circuit, socket_circuit, lighting_circuit, cooker_circuit, etc.';

COMMENT ON COLUMN test_measurement_standards.circuit_rating IS
  'Overcurrent protection device rating: 6A, 16A, 32A, 40A, etc.';

COMMENT ON COLUMN test_measurement_standards.standard_reference IS
  'BS 7671 reference (e.g., "Table 61", "Appendix 3", "411.3.2.2")';

-- ============================================================================
-- POPULATE BS 7671:2018+A3:2024 STANDARD VALUES
-- ============================================================================

-- INSULATION RESISTANCE (BS 7671 Table 61)
-- Minimum 1.0 MΩ for circuits up to 500V (final circuits)
INSERT INTO test_measurement_standards
  (measurement_type, circuit_type, circuit_rating, min_acceptable, max_acceptable, standard_reference, notes)
VALUES
  ('insulation', 'final_circuit', NULL, 1.0, NULL, 'BS 7671 Table 61',
   'Minimum insulation resistance for circuits up to 500V AC. Test at 500V DC.'),

  ('insulation', 'SELV_circuit', NULL, 0.5, NULL, 'BS 7671 Table 61',
   'Minimum insulation resistance for SELV circuits. Test at 250V DC.'),

  ('insulation', 'ring_final', NULL, 1.0, NULL, 'BS 7671 Table 61',
   'Ring final circuits must meet 1.0 MΩ minimum for entire ring.');

-- EARTH LOOP IMPEDANCE (BS 7671 Appendix 3 - Maximum Zs values)
-- Values for Type B MCBs with instant disconnection (0.4s for socket circuits, 5s for fixed equipment)

-- Socket circuits (Type B MCBs, 0.4s disconnection)
INSERT INTO test_measurement_standards
  (measurement_type, circuit_type, circuit_rating, min_acceptable, max_acceptable, standard_reference, notes)
VALUES
  ('earth_loop', 'socket_circuit', '6A', NULL, 7.66, 'BS 7671 Appendix 3 Table 3A',
   'Maximum Zs for 6A Type B MCB (230V, 0.4s disconnection)'),

  ('earth_loop', 'socket_circuit', '10A', NULL, 4.60, 'BS 7671 Appendix 3 Table 3A',
   'Maximum Zs for 10A Type B MCB (230V, 0.4s disconnection)'),

  ('earth_loop', 'socket_circuit', '16A', NULL, 2.87, 'BS 7671 Appendix 3 Table 3A',
   'Maximum Zs for 16A Type B MCB (230V, 0.4s disconnection)'),

  ('earth_loop', 'socket_circuit', '20A', NULL, 2.30, 'BS 7671 Appendix 3 Table 3A',
   'Maximum Zs for 20A Type B MCB (230V, 0.4s disconnection)'),

  ('earth_loop', 'socket_circuit', '32A', NULL, 1.44, 'BS 7671 Appendix 3 Table 3A',
   'Maximum Zs for 32A Type B MCB (230V, 0.4s disconnection). Most common for socket rings.');

-- Fixed equipment circuits (Type B MCBs, 5s disconnection allowed)
INSERT INTO test_measurement_standards
  (measurement_type, circuit_type, circuit_rating, min_acceptable, max_acceptable, standard_reference, notes)
VALUES
  ('earth_loop', 'lighting_circuit', '6A', NULL, 9.58, 'BS 7671 Appendix 3 Table 3A',
   'Maximum Zs for 6A Type B MCB (230V, 5s disconnection)'),

  ('earth_loop', 'lighting_circuit', '10A', NULL, 5.75, 'BS 7671 Appendix 3 Table 3A',
   'Maximum Zs for 10A Type B MCB (230V, 5s disconnection)'),

  ('earth_loop', 'immersion_heater', '16A', NULL, 3.59, 'BS 7671 Appendix 3 Table 3A',
   'Maximum Zs for 16A Type B MCB (230V, 5s disconnection)'),

  ('earth_loop', 'cooker_circuit', '32A', NULL, 1.80, 'BS 7671 Appendix 3 Table 3A',
   'Maximum Zs for 32A Type B MCB (230V, 5s disconnection)'),

  ('earth_loop', 'shower_circuit', '40A', NULL, 1.44, 'BS 7671 Appendix 3 Table 3A',
   'Maximum Zs for 40A Type B MCB (230V, 5s disconnection)'),

  ('earth_loop', 'shower_circuit', '45A', NULL, 1.28, 'BS 7671 Appendix 3 Table 3A',
   'Maximum Zs for 45A Type B MCB (230V, 5s disconnection)');

-- RCD TESTING (BS 7671 411.3.2.2, 411.4.9, 411.5.3)
INSERT INTO test_measurement_standards
  (measurement_type, circuit_type, circuit_rating, min_acceptable, max_acceptable, standard_reference, notes)
VALUES
  ('rcd_trip_time', '30mA_general', '1x', NULL, 300, 'BS 7671 411.3.2.2',
   'General purpose RCD (30mA) must trip within 300ms at 1x rated current (30mA)'),

  ('rcd_trip_time', '30mA_general', '5x', NULL, 40, 'BS 7671 411.3.2.2',
   'General purpose RCD (30mA) must trip within 40ms at 5x rated current (150mA)'),

  ('rcd_trip_time', '30mA_socket', '1x', NULL, 300, 'BS 7671 411.3.3',
   'Socket RCD protection must trip within 300ms at 1x rated current'),

  ('rcd_trip_time', '100mA_fire', '1x', NULL, 300, 'BS 7671 411.3.3',
   '100mA RCD for fire protection must trip within 300ms'),

  ('rcd_trip_time', '300mA_fire', '1x', NULL, 40, 'BS 7671 531.3.2.1',
   '300mA RCD for fire protection must trip within 40ms');

-- RCD TRIP CURRENT
INSERT INTO test_measurement_standards
  (measurement_type, circuit_type, circuit_rating, min_acceptable, max_acceptable, standard_reference, notes)
VALUES
  ('rcd_trip_current', '30mA', NULL, 15, 30, 'BS 7671 Annex A',
   '30mA RCD should trip between 50% (15mA) and 100% (30mA) of rated current'),

  ('rcd_trip_current', '100mA', NULL, 50, 100, 'BS 7671 Annex A',
   '100mA RCD should trip between 50% (50mA) and 100% (100mA) of rated current'),

  ('rcd_trip_current', '300mA', NULL, 150, 300, 'BS 7671 Annex A',
   '300mA RCD should trip between 50% (150mA) and 100% (300mA) of rated current');

-- CONTINUITY OF PROTECTIVE CONDUCTORS (R1+R2)
INSERT INTO test_measurement_standards
  (measurement_type, circuit_type, circuit_rating, min_acceptable, max_acceptable, standard_reference, notes)
VALUES
  ('continuity', 'ring_final_r1_r2', NULL, NULL, 0.05, 'BS 7671 612.2.2',
   'Ring final R1+R2 values typically < 0.05Ω for copper conductors. Varies by cable length.'),

  ('continuity', 'radial_r1_r2', '2.5mm_lighting', NULL, 0.30, 'BS 7671 612.2.2',
   'Typical maximum R1+R2 for 2.5mm² lighting radial (20m max length, 1.5mm² cpc)'),

  ('continuity', 'radial_r1_r2', '2.5mm_socket', NULL, 0.40, 'BS 7671 612.2.2',
   'Typical maximum R1+R2 for 2.5mm² socket radial (25m max length)');

-- POLARITY
INSERT INTO test_measurement_standards
  (measurement_type, circuit_type, circuit_rating, min_acceptable, max_acceptable, standard_reference, notes)
VALUES
  ('polarity', 'all_circuits', NULL, NULL, NULL, 'BS 7671 612.6',
   'Visual and test verification that all single-pole devices are in phase conductor only. Pass/Fail check.');

-- SUPPLY VOLTAGE
INSERT INTO test_measurement_standards
  (measurement_type, circuit_type, circuit_rating, min_acceptable, max_acceptable, standard_reference, notes)
VALUES
  ('voltage', 'supply_voltage', NULL, 216.2, 253.0, 'BS EN 60038',
   'UK mains voltage 230V +10% / -6% (216.2V to 253.0V acceptable range)');

-- FUNCTIONAL TESTING
INSERT INTO test_measurement_standards
  (measurement_type, circuit_type, circuit_rating, min_acceptable, max_acceptable, standard_reference, notes)
VALUES
  ('functional', 'switchgear', NULL, NULL, NULL, 'BS 7671 612.13',
   'All switchgear, control gear and interlocks must be functionally tested. Pass/Fail check.');
