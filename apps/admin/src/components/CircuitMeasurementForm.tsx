'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Circuit {
  id: string;
  circuit_reference: string;
  circuit_description?: string;
  location?: string;
  circuit_type?: string;
  overcurrent_device_type?: string;
  overcurrent_device_rating?: string;
  test_result: string;
}

interface MeasurementStandard {
  measurement_type: string;
  min_acceptable?: number;
  max_acceptable?: number;
  standard_reference: string;
  notes?: string;
}

interface ValidationResult {
  pass: boolean;
  status: 'pass' | 'fail' | 'warning' | 'unknown';
  message: string;
  standard_reference?: string;
}

interface CircuitMeasurementFormProps {
  testId: string;
  circuits: Circuit[];
  selectedCircuitId?: string;
  onCircuitChange?: (circuitId: string) => void;
  onSaveSuccess?: () => void;
}

export default function CircuitMeasurementForm({
  testId,
  circuits,
  selectedCircuitId,
  onCircuitChange,
  onSaveSuccess,
}: CircuitMeasurementFormProps) {
  const [selectedCircuit, setSelectedCircuit] = useState<Circuit | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Measurement values
  const [measurements, setMeasurements] = useState({
    continuity_r1_r2: '',
    insulation_resistance: '',
    earth_loop_impedance: '',
    polarity_correct: true,
  });

  // Validation results
  const [validations, setValidations] = useState<Record<string, ValidationResult | null>>({
    continuity: null,
    insulation: null,
    earth_loop: null,
  });

  // Standards for display
  const [standards, setStandards] = useState<Record<string, MeasurementStandard | null>>({
    continuity: null,
    insulation: null,
    earth_loop: null,
  });

  useEffect(() => {
    if (selectedCircuitId) {
      const circuit = circuits.find(c => c.id === selectedCircuitId);
      if (circuit) {
        setSelectedCircuit(circuit);
        loadStandards(circuit);
      }
    }
  }, [selectedCircuitId, circuits]);

  const handleCircuitSelect = (circuitId: string) => {
    const circuit = circuits.find(c => c.id === circuitId);
    if (circuit) {
      setSelectedCircuit(circuit);
      setMeasurements({
        continuity_r1_r2: '',
        insulation_resistance: '',
        earth_loop_impedance: '',
        polarity_correct: true,
      });
      setValidations({
        continuity: null,
        insulation: null,
        earth_loop: null,
      });
      loadStandards(circuit);
      onCircuitChange?.(circuitId);
    }
  };

  const loadStandards = async (circuit: Circuit) => {
    setLoading(true);
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      // Load standards for each measurement type
      const [continuityStd, insulationStd, earthLoopStd] = await Promise.all([
        api.get(`/api/tests/standards?measurement_type=continuity&circuit_type=${circuit.circuit_type || ''}&circuit_rating=${circuit.overcurrent_device_rating || ''}`),
        api.get(`/api/tests/standards?measurement_type=insulation&circuit_type=${circuit.circuit_type || ''}`),
        api.get(`/api/tests/standards?measurement_type=earth_loop&circuit_type=${circuit.circuit_type || 'socket_circuit'}&circuit_rating=${circuit.overcurrent_device_rating || ''}`),
      ]) as any[];

      setStandards({
        continuity: continuityStd?.standards?.[0] || null,
        insulation: insulationStd?.standards?.[0] || null,
        earth_loop: earthLoopStd?.standards?.[0] || null,
      });
    } catch (err) {
      console.error('Failed to load standards:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateMeasurement = (type: string, value: number, standard: MeasurementStandard | null): ValidationResult => {
    if (!standard) {
      return {
        pass: false,
        status: 'unknown',
        message: 'No standard found for this measurement',
      };
    }

    const min = standard.min_acceptable;
    const max = standard.max_acceptable;

    // Check min
    if (min !== null && min !== undefined && value < min) {
      return {
        pass: false,
        status: 'fail',
        message: `${value} is below minimum ${min} (${standard.standard_reference})`,
        standard_reference: standard.standard_reference,
      };
    }

    // Check max
    if (max !== null && max !== undefined && value > max) {
      return {
        pass: false,
        status: 'fail',
        message: `${value} exceeds maximum ${max} (${standard.standard_reference})`,
        standard_reference: standard.standard_reference,
      };
    }

    // Check for borderline warning (within 10% of limit)
    if (min !== null && min !== undefined && value < min * 1.1) {
      return {
        pass: true,
        status: 'warning',
        message: `Value is close to minimum limit of ${min}`,
        standard_reference: standard.standard_reference,
      };
    }

    if (max !== null && max !== undefined && value > max * 0.9) {
      return {
        pass: true,
        status: 'warning',
        message: `Value is close to maximum limit of ${max}`,
        standard_reference: standard.standard_reference,
      };
    }

    return {
      pass: true,
      status: 'pass',
      message: 'Measurement is within acceptable range',
      standard_reference: standard.standard_reference,
    };
  };

  const handleMeasurementChange = (field: string, value: string) => {
    setMeasurements(prev => ({ ...prev, [field]: value }));

    // Real-time validation
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      let validationType = '';
      let standard: MeasurementStandard | null = null;

      if (field === 'continuity_r1_r2') {
        validationType = 'continuity';
        standard = standards.continuity;
      } else if (field === 'insulation_resistance') {
        validationType = 'insulation';
        standard = standards.insulation;
      } else if (field === 'earth_loop_impedance') {
        validationType = 'earth_loop';
        standard = standards.earth_loop;
      }

      if (validationType && standard) {
        const validation = validateMeasurement(validationType, numValue, standard);
        setValidations(prev => ({ ...prev, [validationType]: validation }));
      }
    } else {
      // Clear validation if invalid number
      if (field === 'continuity_r1_r2') {
        setValidations(prev => ({ ...prev, continuity: null }));
      } else if (field === 'insulation_resistance') {
        setValidations(prev => ({ ...prev, insulation: null }));
      } else if (field === 'earth_loop_impedance') {
        setValidations(prev => ({ ...prev, earth_loop: null }));
      }
    }
  };

  const handleSave = async () => {
    if (!selectedCircuit) {
      setError('Please select a circuit');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      const payload = {
        measurements: {
          continuity_r1_r2: measurements.continuity_r1_r2 ? parseFloat(measurements.continuity_r1_r2) : undefined,
          insulation_resistance: measurements.insulation_resistance ? parseFloat(measurements.insulation_resistance) : undefined,
          earth_loop_impedance: measurements.earth_loop_impedance ? parseFloat(measurements.earth_loop_impedance) : undefined,
          polarity_correct: measurements.polarity_correct,
        },
      };

      await api.put(`/api/tests/${testId}/circuits/${selectedCircuit.id}`, payload);

      // Success
      onSaveSuccess?.();

      // Clear form
      setMeasurements({
        continuity_r1_r2: '',
        insulation_resistance: '',
        earth_loop_impedance: '',
        polarity_correct: true,
      });
      setValidations({
        continuity: null,
        insulation: null,
        earth_loop: null,
      });
    } catch (err: any) {
      console.error('Failed to save measurements:', err);
      setError(err.message || 'Failed to save measurements');
    } finally {
      setSaving(false);
    }
  };

  const getValidationColor = (validation: ValidationResult | null) => {
    if (!validation) return 'border-gray-300';
    if (validation.status === 'pass') return 'border-green-500 bg-green-50';
    if (validation.status === 'warning') return 'border-yellow-500 bg-yellow-50';
    if (validation.status === 'fail') return 'border-red-500 bg-red-50';
    return 'border-gray-300';
  };

  const getValidationIcon = (validation: ValidationResult | null) => {
    if (!validation) return null;
    if (validation.status === 'pass') return <span className="text-green-600 font-bold">✓</span>;
    if (validation.status === 'warning') return <span className="text-yellow-600 font-bold">⚠</span>;
    if (validation.status === 'fail') return <span className="text-red-600 font-bold">✗</span>;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Circuit Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Circuit
        </label>
        <select
          value={selectedCircuit?.id || ''}
          onChange={(e) => handleCircuitSelect(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">-- Select a circuit --</option>
          {circuits.map((circuit) => (
            <option key={circuit.id} value={circuit.id}>
              {circuit.circuit_reference} - {circuit.location || 'No location'} ({circuit.test_result})
            </option>
          ))}
        </select>
      </div>

      {selectedCircuit && (
        <>
          {/* Circuit Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">{selectedCircuit.circuit_reference}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
              <div>
                <span className="font-medium">Location:</span> {selectedCircuit.location || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Type:</span> {selectedCircuit.circuit_type || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Protection:</span> {selectedCircuit.overcurrent_device_type} {selectedCircuit.overcurrent_device_rating}
              </div>
              <div>
                <span className="font-medium">Current Status:</span>{' '}
                <span className={`font-semibold ${
                  selectedCircuit.test_result === 'satisfactory' ? 'text-green-600' :
                  selectedCircuit.test_result === 'unsatisfactory' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {selectedCircuit.test_result.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Measurement Inputs */}
          <div className="space-y-4">
            {/* Continuity R1+R2 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Continuity (R1+R2) - Ohms (Ω)
              </label>
              <div className="flex items-start gap-2">
                <input
                  type="number"
                  step="0.001"
                  value={measurements.continuity_r1_r2}
                  onChange={(e) => handleMeasurementChange('continuity_r1_r2', e.target.value)}
                  className={`flex-1 px-3 py-2 border rounded-lg focus:ring-primary-500 focus:border-primary-500 ${getValidationColor(validations.continuity)}`}
                  placeholder="e.g., 0.35"
                />
                {getValidationIcon(validations.continuity)}
              </div>
              {standards.continuity && (
                <p className="text-xs text-gray-600 mt-1">
                  Standard: {standards.continuity.standard_reference}
                  {standards.continuity.max_acceptable && ` (max ${standards.continuity.max_acceptable}Ω)`}
                </p>
              )}
              {validations.continuity && (
                <p className={`text-xs mt-1 ${
                  validations.continuity.status === 'pass' ? 'text-green-600' :
                  validations.continuity.status === 'warning' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {validations.continuity.message}
                </p>
              )}
            </div>

            {/* Insulation Resistance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Insulation Resistance - Megohms (MΩ)
              </label>
              <div className="flex items-start gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={measurements.insulation_resistance}
                  onChange={(e) => handleMeasurementChange('insulation_resistance', e.target.value)}
                  className={`flex-1 px-3 py-2 border rounded-lg focus:ring-primary-500 focus:border-primary-500 ${getValidationColor(validations.insulation)}`}
                  placeholder="e.g., 150"
                />
                {getValidationIcon(validations.insulation)}
              </div>
              {standards.insulation && (
                <p className="text-xs text-gray-600 mt-1">
                  Standard: {standards.insulation.standard_reference}
                  {standards.insulation.min_acceptable && ` (min ${standards.insulation.min_acceptable}MΩ)`}
                </p>
              )}
              {validations.insulation && (
                <p className={`text-xs mt-1 ${
                  validations.insulation.status === 'pass' ? 'text-green-600' :
                  validations.insulation.status === 'warning' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {validations.insulation.message}
                </p>
              )}
            </div>

            {/* Earth Loop Impedance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Earth Loop Impedance (Zs) - Ohms (Ω)
              </label>
              <div className="flex items-start gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={measurements.earth_loop_impedance}
                  onChange={(e) => handleMeasurementChange('earth_loop_impedance', e.target.value)}
                  className={`flex-1 px-3 py-2 border rounded-lg focus:ring-primary-500 focus:border-primary-500 ${getValidationColor(validations.earth_loop)}`}
                  placeholder="e.g., 0.8"
                />
                {getValidationIcon(validations.earth_loop)}
              </div>
              {standards.earth_loop && (
                <p className="text-xs text-gray-600 mt-1">
                  Standard: {standards.earth_loop.standard_reference}
                  {standards.earth_loop.max_acceptable && ` (max ${standards.earth_loop.max_acceptable}Ω for ${selectedCircuit.overcurrent_device_rating})`}
                </p>
              )}
              {validations.earth_loop && (
                <p className={`text-xs mt-1 ${
                  validations.earth_loop.status === 'pass' ? 'text-green-600' :
                  validations.earth_loop.status === 'warning' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {validations.earth_loop.message}
                </p>
              )}
            </div>

            {/* Polarity */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={measurements.polarity_correct}
                  onChange={(e) => setMeasurements(prev => ({ ...prev, polarity_correct: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">Polarity Correct</span>
              </label>
              <p className="text-xs text-gray-600 ml-6 mt-1">
                All single-pole devices are in phase conductor only (BS 7671 612.6)
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !selectedCircuit}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? 'Saving...' : 'Save Measurements'}
            </button>
          </div>
        </>
      )}

      {!selectedCircuit && !loading && (
        <div className="text-center py-12 text-gray-500">
          <p>Select a circuit to begin recording measurements</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading standards...</p>
        </div>
      )}
    </div>
  );
}
