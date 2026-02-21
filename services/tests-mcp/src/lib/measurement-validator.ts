/**
 * Measurement Validator for BS 7671:2018+A3:2024 Compliance
 * Validates electrical test measurements against acceptable ranges
 */

import { query } from './database.js';

export interface CircuitDetails {
  circuit_type?: string;
  overcurrent_device_rating?: string;
  circuit_rating?: string;
}

export interface ValidationResult {
  pass: boolean;
  status: 'pass' | 'fail' | 'warning' | 'unknown';
  message: string;
  standard_reference?: string;
  min_acceptable?: number;
  max_acceptable?: number;
  actual_value: number;
}

/**
 * Validate a measurement against BS 7671 standards
 */
export async function validateMeasurement(
  measurementType: string,
  value: number,
  circuitDetails?: CircuitDetails,
  tenantId?: string
): Promise<ValidationResult> {
  // Query database for applicable standard
  const circuitType = circuitDetails?.circuit_type || 'final_circuit';
  const circuitRating = circuitDetails?.circuit_rating || circuitDetails?.overcurrent_device_rating;

  // Try to find specific standard for this combination
  let standard = await query(
    `SELECT * FROM test_measurement_standards
     WHERE measurement_type = $1
     AND (circuit_type = $2 OR circuit_type IS NULL)
     AND (circuit_rating = $3 OR circuit_rating IS NULL)
     ORDER BY
       (circuit_type IS NOT NULL)::int DESC,
       (circuit_rating IS NOT NULL)::int DESC
     LIMIT 1`,
    [measurementType, circuitType, circuitRating]
  );

  if (standard.rows.length === 0) {
    // No standard found - return unknown
    return {
      pass: false,
      status: 'unknown',
      message: `No BS 7671 standard found for ${measurementType}`,
      actual_value: value
    };
  }

  const std = standard.rows[0];
  const minAcceptable = std.min_acceptable ? parseFloat(std.min_acceptable) : null;
  const maxAcceptable = std.max_acceptable ? parseFloat(std.max_acceptable) : null;

  // Validate against min
  if (minAcceptable !== null && value < minAcceptable) {
    return {
      pass: false,
      status: 'fail',
      message: `${value} is below minimum acceptable ${minAcceptable} (${std.standard_reference})`,
      standard_reference: std.standard_reference,
      min_acceptable: minAcceptable,
      max_acceptable: maxAcceptable || undefined,
      actual_value: value
    };
  }

  // Validate against max
  if (maxAcceptable !== null && value > maxAcceptable) {
    return {
      pass: false,
      status: 'fail',
      message: `${value} exceeds maximum acceptable ${maxAcceptable} (${std.standard_reference})`,
      standard_reference: std.standard_reference,
      min_acceptable: minAcceptable || undefined,
      max_acceptable: maxAcceptable,
      actual_value: value
    };
  }

  // Check for borderline warning (within 10% of limit)
  let warningMessage = '';
  if (minAcceptable !== null && value < minAcceptable * 1.1) {
    warningMessage = `Value is close to minimum limit of ${minAcceptable}`;
  } else if (maxAcceptable !== null && value > maxAcceptable * 0.9) {
    warningMessage = `Value is close to maximum limit of ${maxAcceptable}`;
  }

  if (warningMessage) {
    return {
      pass: true,
      status: 'warning',
      message: `${value} passes but ${warningMessage} (${std.standard_reference})`,
      standard_reference: std.standard_reference,
      min_acceptable: minAcceptable || undefined,
      max_acceptable: maxAcceptable || undefined,
      actual_value: value
    };
  }

  // Pass
  return {
    pass: true,
    status: 'pass',
    message: `${value} is within acceptable range (${std.standard_reference})`,
    standard_reference: std.standard_reference,
    min_acceptable: minAcceptable || undefined,
    max_acceptable: maxAcceptable || undefined,
    actual_value: value
  };
}

/**
 * Validate insulation resistance
 * Special handling per BS 7671 Table 61
 */
export async function validateInsulationResistance(
  value: number,
  circuitVoltage: number = 230,
  circuitType: string = 'final_circuit'
): Promise<ValidationResult> {
  // BS 7671 Table 61:
  // SELV/PELV (≤50V): ≥0.5 MΩ @ 250V DC
  // Up to 500V: ≥1.0 MΩ @ 500V DC
  // Above 500V: ≥1.0 MΩ @ 1000V DC

  const minRequired = circuitVoltage <= 50 ? 0.5 : 1.0;

  if (value < minRequired) {
    return {
      pass: false,
      status: 'fail',
      message: `Insulation resistance ${value} MΩ is below minimum ${minRequired} MΩ (BS 7671 Table 61)`,
      standard_reference: 'BS 7671 Table 61',
      min_acceptable: minRequired,
      actual_value: value
    };
  }

  // Warning if below 2 MΩ (good practice threshold)
  if (value < 2.0) {
    return {
      pass: true,
      status: 'warning',
      message: `Insulation resistance ${value} MΩ passes but below recommended 2 MΩ for good condition`,
      standard_reference: 'BS 7671 Table 61',
      min_acceptable: minRequired,
      actual_value: value
    };
  }

  return {
    pass: true,
    status: 'pass',
    message: `Insulation resistance ${value} MΩ is satisfactory (≥${minRequired} MΩ required)`,
    standard_reference: 'BS 7671 Table 61',
    min_acceptable: minRequired,
    actual_value: value
  };
}

/**
 * Validate earth loop impedance (Zs)
 * Critical for automatic disconnection of supply
 */
export async function validateEarthLoopImpedance(
  value: number,
  deviceType: string,
  deviceRating: string,
  disconnectionTime: number = 0.4
): Promise<ValidationResult> {
  // Parse rating (e.g., "32A" -> 32)
  const rating = parseInt(deviceRating.replace(/[^0-9]/g, ''));

  // Lookup maximum Zs from BS 7671 Appendix 3
  return validateMeasurement('earth_loop', value, {
    circuit_type: disconnectionTime <= 0.4 ? 'socket_circuit' : 'lighting_circuit',
    circuit_rating: `${rating}A`
  });
}

/**
 * Validate RCD trip time
 * Critical safety requirement per BS 7671 411.3.2.2
 */
export async function validateRCDTripTime(
  value: number,
  rcdRating: string,
  testMultiplier: number
): Promise<ValidationResult> {
  // BS 7671 Requirements:
  // - At 1x rated current: must trip within 300ms
  // - At 5x rated current: must trip within 40ms

  const maxTime = testMultiplier === 1 ? 300 : 40;

  if (value > maxTime) {
    return {
      pass: false,
      status: 'fail',
      message: `RCD trip time ${value}ms exceeds maximum ${maxTime}ms at ${testMultiplier}x (BS 7671 411.3.2.2)`,
      standard_reference: 'BS 7671 411.3.2.2',
      max_acceptable: maxTime,
      actual_value: value
    };
  }

  // Warning if close to limit (>80% of max time)
  if (value > maxTime * 0.8) {
    return {
      pass: true,
      status: 'warning',
      message: `RCD trip time ${value}ms is within limits but approaching maximum ${maxTime}ms`,
      standard_reference: 'BS 7671 411.3.2.2',
      max_acceptable: maxTime,
      actual_value: value
    };
  }

  return {
    pass: true,
    status: 'pass',
    message: `RCD trip time ${value}ms is satisfactory (≤${maxTime}ms required)`,
    standard_reference: 'BS 7671 411.3.2.2',
    max_acceptable: maxTime,
    actual_value: value
  };
}

/**
 * Validate continuity (R1+R2)
 * Protective conductor resistance
 */
export async function validateContinuity(
  value: number,
  circuitType: string,
  cableCSA: string
): Promise<ValidationResult> {
  // Typical acceptable values based on circuit type and length
  // Ring final: typically < 0.05Ω
  // Radials: depends on length, but generally < 0.3Ω for domestic

  let maxExpected = 0.5; // Conservative default

  if (circuitType.includes('ring')) {
    maxExpected = 0.05;
  } else if (circuitType.includes('lighting')) {
    maxExpected = 0.3;
  } else if (circuitType.includes('socket') || circuitType.includes('radial')) {
    maxExpected = 0.4;
  }

  if (value > maxExpected * 2) {
    return {
      pass: false,
      status: 'fail',
      message: `R1+R2 value of ${value}Ω is unusually high - check for poor connections or incorrect cable`,
      max_acceptable: maxExpected * 2,
      actual_value: value
    };
  }

  if (value > maxExpected) {
    return {
      pass: true,
      status: 'warning',
      message: `R1+R2 value of ${value}Ω is higher than typical ${maxExpected}Ω - verify cable length and CSA`,
      max_acceptable: maxExpected,
      actual_value: value
    };
  }

  return {
    pass: true,
    status: 'pass',
    message: `R1+R2 value of ${value}Ω is satisfactory`,
    actual_value: value
  };
}

/**
 * Validate supply voltage
 * UK mains voltage 230V +10% / -6% per BS EN 60038
 */
export async function validateSupplyVoltage(value: number): Promise<ValidationResult> {
  const minVoltage = 216.2; // 230V - 6%
  const maxVoltage = 253.0; // 230V + 10%

  if (value < minVoltage || value > maxVoltage) {
    return {
      pass: false,
      status: 'fail',
      message: `Supply voltage ${value}V is outside acceptable range ${minVoltage}V - ${maxVoltage}V (BS EN 60038)`,
      standard_reference: 'BS EN 60038',
      min_acceptable: minVoltage,
      max_acceptable: maxVoltage,
      actual_value: value
    };
  }

  return {
    pass: true,
    status: 'pass',
    message: `Supply voltage ${value}V is within acceptable range`,
    standard_reference: 'BS EN 60038',
    min_acceptable: minVoltage,
    max_acceptable: maxVoltage,
    actual_value: value
  };
}
