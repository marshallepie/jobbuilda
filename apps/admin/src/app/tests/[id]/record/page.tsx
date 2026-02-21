'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import CircuitMeasurementForm from '@/components/CircuitMeasurementForm';
import InspectionChecklist from '@/components/InspectionChecklist';
import { api } from '@/lib/api';

interface Test {
  id: string;
  test_number: string;
  test_type: string;
  title: string;
  status: string;
  premises_type?: string;
  earthing_arrangements?: string;
  inspector_name?: string;
  inspector_registration_number?: string;
}

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

type WizardStep = 'installation' | 'circuits' | 'inspection' | 'review';

export default function RecordTestPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params?.id as string;

  const [test, setTest] = useState<Test | null>(null);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<WizardStep>('installation');
  const [selectedCircuitIndex, setSelectedCircuitIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  // Installation details form
  const [installationDetails, setInstallationDetails] = useState({
    premises_type: '',
    earthing_arrangements: '',
    inspector_name: '',
    inspector_registration_number: '',
  });

  useEffect(() => {
    if (testId) {
      loadTestData();
    }
  }, [testId]);

  const loadTestData = async () => {
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      const testData = await api.get(`/api/tests/${testId}`) as Test;
      setTest(testData);

      // Pre-fill installation details if they exist
      setInstallationDetails({
        premises_type: testData.premises_type || '',
        earthing_arrangements: testData.earthing_arrangements || '',
        inspector_name: testData.inspector_name || '',
        inspector_registration_number: testData.inspector_registration_number || '',
      });

      // TODO: Load circuits
      // const circuitsData = await api.get(`/api/tests/${testId}/circuits`);
      // setCircuits(circuitsData);

      // For now, use mock data
      setCircuits([
        {
          id: '1',
          circuit_reference: 'Ring Final 1',
          location: 'Kitchen sockets',
          circuit_type: 'ring_final',
          overcurrent_device_type: 'MCB Type B',
          overcurrent_device_rating: '32A',
          test_result: 'not_tested',
        },
        {
          id: '2',
          circuit_reference: 'Lighting 1',
          location: 'Ground floor lights',
          circuit_type: 'lighting',
          overcurrent_device_type: 'MCB Type B',
          overcurrent_device_rating: '6A',
          test_result: 'not_tested',
        },
      ]);
    } catch (err) {
      console.error('Failed to load test:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInstallationDetails = async () => {
    setSaving(true);
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      // TODO: Update test with installation details
      // await api.patch(`/api/tests/${testId}`, installationDetails);

      setCurrentStep('circuits');
    } catch (err) {
      console.error('Failed to save installation details:', err);
      alert('Failed to save installation details');
    } finally {
      setSaving(false);
    }
  };

  const handleNextCircuit = () => {
    if (selectedCircuitIndex < circuits.length - 1) {
      setSelectedCircuitIndex(prev => prev + 1);
    } else {
      setCurrentStep('inspection');
    }
  };

  const handlePrevCircuit = () => {
    if (selectedCircuitIndex > 0) {
      setSelectedCircuitIndex(prev => prev - 1);
    }
  };

  const handleCompleteTest = async () => {
    if (!confirm('Mark this test as complete? You cannot edit measurements after completion.')) {
      return;
    }

    setSaving(true);
    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      await api.post(`/api/tests/${testId}/complete`, {
        outcome: 'satisfactory',
        completion_date: new Date().toISOString().split('T')[0],
      });

      alert('Test completed successfully!');
      router.push(`/tests/${testId}`);
    } catch (err: any) {
      console.error('Failed to complete test:', err);
      alert(err.message || 'Failed to complete test');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AppLayout>
    );
  }

  if (!test) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900">Test not found</h2>
          <Link href="/tests" className="text-primary-600 hover:text-primary-900 mt-4 inline-block">
            Back to Tests
          </Link>
        </div>
      </AppLayout>
    );
  }

  const steps: { id: WizardStep; label: string; description: string }[] = [
    { id: 'installation', label: 'Installation Details', description: 'Premises and earthing information' },
    { id: 'circuits', label: 'Circuit Measurements', description: `Test ${circuits.length} circuits` },
    { id: 'inspection', label: 'Inspection Checklist', description: 'BS 7671 compliance checks' },
    { id: 'review', label: 'Review & Complete', description: 'Final review' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/tests/${testId}`}
              className="text-gray-600 hover:text-gray-900 text-sm mb-2 inline-block"
            >
              ← Back to Test Details
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Record Test Measurements</h1>
            <p className="mt-1 text-gray-600">{test.test_number} - {test.title}</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      index <= currentStepIndex
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {index < currentStepIndex ? '✓' : index + 1}
                  </div>
                  <div className="text-center mt-2">
                    <div className={`text-sm font-medium ${
                      index <= currentStepIndex ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {step.label}
                    </div>
                    <div className="text-xs text-gray-500">{step.description}</div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      index < currentStepIndex ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                    style={{ maxWidth: '60px' }}
                  ></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white shadow rounded-lg p-6">
          {/* Step 1: Installation Details */}
          {currentStep === 'installation' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Installation Details</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Premises Type <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={installationDetails.premises_type}
                    onChange={(e) => setInstallationDetails(prev => ({ ...prev, premises_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Select premises type</option>
                    <option value="domestic">Domestic (10-year inspection cycle)</option>
                    <option value="commercial">Commercial (5-year inspection cycle)</option>
                    <option value="industrial">Industrial (1-year inspection cycle)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Earthing Arrangements <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={installationDetails.earthing_arrangements}
                    onChange={(e) => setInstallationDetails(prev => ({ ...prev, earthing_arrangements: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Select earthing type</option>
                    <option value="TN-S">TN-S (Separate protective earth)</option>
                    <option value="TN-C-S">TN-C-S (PME - Combined earth and neutral)</option>
                    <option value="TT">TT (Earth electrode at installation)</option>
                    <option value="IT">IT (Isolated or impedance earthed)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Inspector Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={installationDetails.inspector_name}
                    onChange={(e) => setInstallationDetails(prev => ({ ...prev, inspector_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Full name of inspector"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    value={installationDetails.inspector_registration_number}
                    onChange={(e) => setInstallationDetails(prev => ({ ...prev, inspector_registration_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    placeholder="NICEIC/NAPIT/ECA number"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={handleSaveInstallationDetails}
                  disabled={saving || !installationDetails.premises_type || !installationDetails.earthing_arrangements || !installationDetails.inspector_name}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {saving ? 'Saving...' : 'Next: Circuit Measurements'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Circuit Measurements */}
          {currentStep === 'circuits' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Circuit Measurements</h2>
                <div className="text-sm text-gray-600">
                  Circuit {selectedCircuitIndex + 1} of {circuits.length}
                </div>
              </div>

              <CircuitMeasurementForm
                testId={testId}
                circuits={circuits}
                selectedCircuitId={circuits[selectedCircuitIndex]?.id}
                onCircuitChange={(circuitId) => {
                  const index = circuits.findIndex(c => c.id === circuitId);
                  if (index >= 0) setSelectedCircuitIndex(index);
                }}
                onSaveSuccess={loadTestData}
              />

              <div className="flex justify-between pt-4 border-t">
                <button
                  onClick={() => selectedCircuitIndex > 0 ? handlePrevCircuit() : setCurrentStep('installation')}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  ← Previous
                </button>
                <button
                  onClick={handleNextCircuit}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                >
                  {selectedCircuitIndex < circuits.length - 1 ? 'Next Circuit →' : 'Next: Inspection Checklist →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Inspection Checklist */}
          {currentStep === 'inspection' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Inspection Checklist</h2>

              <InspectionChecklist
                testId={testId}
                testType={test.test_type as 'eic' | 'minor_works' | 'eicr'}
                onSaveSuccess={loadTestData}
              />

              <div className="flex justify-between pt-4 border-t">
                <button
                  onClick={() => setCurrentStep('circuits')}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  ← Back to Circuits
                </button>
                <button
                  onClick={() => setCurrentStep('review')}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                >
                  Next: Review & Complete →
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Complete */}
          {currentStep === 'review' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Review & Complete</h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Test Summary</h3>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-blue-700">Premises Type:</dt>
                    <dd className="font-medium text-blue-900">{installationDetails.premises_type || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="text-blue-700">Earthing:</dt>
                    <dd className="font-medium text-blue-900">{installationDetails.earthing_arrangements || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="text-blue-700">Inspector:</dt>
                    <dd className="font-medium text-blue-900">{installationDetails.inspector_name || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="text-blue-700">Circuits Tested:</dt>
                    <dd className="font-medium text-blue-900">{circuits.length} circuits</dd>
                  </div>
                </dl>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Once you mark this test as complete, you will not be able to edit measurements.
                  Please ensure all data is correct before proceeding.
                </p>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <button
                  onClick={() => setCurrentStep('inspection')}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  ← Back to Inspection
                </button>
                <button
                  onClick={handleCompleteTest}
                  disabled={saving}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                >
                  {saving ? 'Completing...' : 'Complete Test ✓'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
