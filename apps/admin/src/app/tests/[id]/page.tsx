'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import CertificateCard from '@/components/CertificateCard';
import GenerateCertificateModal from '@/components/GenerateCertificateModal';
import { api } from '@/lib/api';
import { formatDate, getStatusColor } from '@/lib/utils';

interface Test {
  id: string;
  test_number: string;
  test_type: string;
  title: string;
  description?: string;
  status: string;
  outcome?: string;
  test_date?: string;
  completion_date?: string;
  next_inspection_date?: string;
  job_id: string;
  client_id: string;
  site_id: string;
  premises_type?: string;
  earthing_arrangements?: string;
  inspector_name?: string;
  inspector_registration_number?: string;
  schedule_of_inspections?: {
    items: Array<{
      item_code: string;
      result?: string;
      notes?: string;
    }>;
  };
  notes?: string;
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
  continuity_r1_r2?: number;
  insulation_resistance?: number;
  earth_loop_impedance?: number;
  polarity_correct?: boolean;
}

interface Certificate {
  id: string;
  certificate_number: string;
  certificate_type: string;
  issue_date: string;
  storage_url?: string;
  generated_at: string;
  generated_by: string;
}

export default function TestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params?.id as string;

  const [test, setTest] = useState<Test | null>(null);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

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

      // TODO: Load circuits and certificates
      // const circuitsData = await api.get(`/api/tests/${testId}/circuits`);
      // setCircuits(circuitsData);

      // const certificatesData = await api.get(`/api/tests/${testId}/certificates`);
      // setCertificates(certificatesData);
    } catch (err) {
      console.error('Failed to load test:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCertificate = async (certificateType: string, issueDate: string) => {
    if (!test) return;

    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      await api.post(`/api/tests/${testId}/certificate`, {
        certificate_type: certificateType,
        issue_date: issueDate,
      });

      alert('Certificate generated successfully!');
      await loadTestData(); // Reload to show new certificate
    } catch (err: any) {
      console.error('Failed to generate certificate:', err);
      alert(`Failed to generate certificate: ${err.message}`);
      throw err; // Re-throw so modal can handle it
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

  const getTestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      eicr: 'Electrical Installation Condition Report',
      eic: 'Electrical Installation Certificate',
      initial_verification: 'Electrical Installation Certificate',
      minor_works: 'Minor Works Certificate',
      pat: 'PAT Testing',
    };
    return labels[type] || type;
  };

  const inspectionProgress = test.schedule_of_inspections?.items || [];
  const completedInspections = inspectionProgress.filter(i => i.result).length;
  const totalInspections = inspectionProgress.length;
  const inspectionPercent = totalInspections > 0 ? Math.round((completedInspections / totalInspections) * 100) : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/tests" className="text-gray-600 hover:text-gray-900">
              ← Back to Tests
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{test.test_number}</h1>
              <p className="mt-1 text-gray-600">{getTestTypeLabel(test.test_type)}</p>
            </div>
          </div>
          <div className="flex space-x-3">
            {test.status !== 'completed' && (
              <Link
                href={`/tests/${testId}/record`}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Record Measurements
              </Link>
            )}
            {test.status === 'completed' && (
              <button
                onClick={() => setShowGenerateModal(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Generate Certificate
              </button>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-600">Status</div>
              <div className="mt-1">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(test.status)}`}>
                  {test.status.replace('_', ' ')}
                </span>
              </div>
            </div>
            {test.outcome && (
              <div>
                <div className="text-sm font-medium text-gray-600">Outcome</div>
                <div className="mt-1">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    test.outcome === 'satisfactory' ? 'bg-green-100 text-green-800' :
                    test.outcome === 'unsatisfactory' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {test.outcome.replace('_', ' ')}
                  </span>
                </div>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-gray-600">Test Date</div>
              <div className="mt-1 text-gray-900">
                {test.test_date ? formatDate(test.test_date) : 'Not scheduled'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Completion Date</div>
              <div className="mt-1 text-gray-900">
                {test.completion_date ? formatDate(test.completion_date) : 'Not completed'}
              </div>
            </div>
          </div>
        </div>

        {/* Test Details */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Test Details</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-600">Job</dt>
              <dd className="mt-1">
                <Link href={`/jobs/${test.job_id}`} className="text-primary-600 hover:text-primary-900">
                  View Job
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">Premises Type</dt>
              <dd className="mt-1 text-gray-900">{test.premises_type || 'Not specified'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">Earthing Arrangements</dt>
              <dd className="mt-1 text-gray-900">{test.earthing_arrangements || 'Not specified'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">Inspector</dt>
              <dd className="mt-1 text-gray-900">
                {test.inspector_name || 'Not assigned'}
                {test.inspector_registration_number && (
                  <span className="text-sm text-gray-600 ml-2">({test.inspector_registration_number})</span>
                )}
              </dd>
            </div>
            {test.next_inspection_date && (
              <div>
                <dt className="text-sm font-medium text-gray-600">Next Inspection Due</dt>
                <dd className="mt-1 text-gray-900">{formatDate(test.next_inspection_date)}</dd>
              </div>
            )}
          </dl>
          {test.description && (
            <div className="mt-4">
              <dt className="text-sm font-medium text-gray-600">Description</dt>
              <dd className="mt-1 text-gray-900">{test.description}</dd>
            </div>
          )}
        </div>

        {/* Circuits */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Circuits</h2>
          {circuits.length === 0 ? (
            <p className="text-gray-600">No circuits recorded yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Protection</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {circuits.map((circuit) => (
                    <tr key={circuit.id}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{circuit.circuit_reference}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{circuit.location || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{circuit.circuit_type || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {circuit.overcurrent_device_type} {circuit.overcurrent_device_rating}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          circuit.test_result === 'satisfactory' ? 'bg-green-100 text-green-800' :
                          circuit.test_result === 'unsatisfactory' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {circuit.test_result.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Inspection Progress */}
        {totalInspections > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Inspection Checklist Progress</h2>
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-green-600 h-4 rounded-full transition-all"
                    style={{ width: `${inspectionPercent}%` }}
                  ></div>
                </div>
              </div>
              <div className="text-sm font-medium text-gray-900">
                {completedInspections} / {totalInspections} ({inspectionPercent}%)
              </div>
            </div>
          </div>
        )}

        {/* Certificates */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Certificates</h2>
            {certificates.length > 0 && (
              <span className="text-sm text-gray-600">
                {certificates.length} {certificates.length === 1 ? 'certificate' : 'certificates'}
              </span>
            )}
          </div>
          {certificates.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">📄</div>
              <p className="text-gray-600 mb-2">No certificates generated yet</p>
              {test.status === 'completed' && (
                <p className="text-sm text-gray-500">
                  Use the "Generate Certificate" button above to create a certificate
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {certificates.map((cert) => (
                <CertificateCard
                  key={cert.id}
                  certificate={cert}
                  onRegenerate={loadTestData}
                  onDownloadSuccess={() => {
                    console.log('Certificate downloaded successfully');
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        {test.notes && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Notes</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{test.notes}</p>
          </div>
        )}
      </div>

      {/* Generate Certificate Modal */}
      <GenerateCertificateModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerate={handleGenerateCertificate}
        testType={test.test_type}
        testNumber={test.test_number}
      />
    </AppLayout>
  );
}
