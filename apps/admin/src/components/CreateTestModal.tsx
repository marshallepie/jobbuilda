'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface CreateTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  clientId: string;
  siteId: string;
  electricalWorkType?: string;
}

export default function CreateTestModal({
  isOpen,
  onClose,
  jobId,
  clientId,
  siteId,
  electricalWorkType,
}: CreateTestModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    test_type: getDefaultTestType(electricalWorkType),
    title: '',
    test_date: new Date().toISOString().split('T')[0],
    inspector_name: '',
    inspector_registration_number: '',
  });

  function getDefaultTestType(workType?: string): string {
    if (workType === 'new_circuit') return 'eic';
    if (workType === 'minor_works') return 'minor_works';
    if (workType === 'inspection_only') return 'eicr';
    return 'eic';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      // Create test
      const test: any = await api.request('/api/tests', {
        method: 'POST',
        body: JSON.stringify({
          job_id: jobId,
          client_id: clientId,
          site_id: siteId,
          test_type: formData.test_type,
          title: formData.title,
          test_date: formData.test_date,
        }),
      });

      // Bulk create circuits from job if available
      if (test.id) {
        try {
          await api.request(`/api/tests/${test.id}/circuits/bulk`, {
            method: 'POST',
            body: JSON.stringify({
              job_id: jobId,
            }),
          });
        } catch (bulkError) {
          console.warn('Failed to bulk create circuits:', bulkError);
          // Continue anyway - circuits can be added manually
        }
      }

      router.push(`/tests/${test.id}`);
    } catch (err: any) {
      console.error('Failed to create test:', err);
      setError(err.message || 'Failed to create test');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        ></div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="w-full">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Create Electrical Test
                  </h3>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Test Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Test Type
                      </label>
                      <select
                        value={formData.test_type}
                        onChange={(e) => setFormData({ ...formData, test_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                        required
                      >
                        <option value="eic">Electrical Installation Certificate (EIC)</option>
                        <option value="minor_works">Minor Works Certificate</option>
                        <option value="eicr">Electrical Installation Condition Report (EICR)</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        {formData.test_type === 'eic' && 'For new circuit installations'}
                        {formData.test_type === 'minor_works' && 'For minor alterations'}
                        {formData.test_type === 'eicr' && 'For periodic inspections'}
                      </p>
                    </div>

                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Test Title
                      </label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder={`${formData.test_type.toUpperCase()} for Job`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>

                    {/* Test Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Scheduled Test Date
                      </label>
                      <input
                        type="date"
                        value={formData.test_date}
                        onChange={(e) => setFormData({ ...formData, test_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>

                    {/* Inspector Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Inspector Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.inspector_name}
                        onChange={(e) => setFormData({ ...formData, inspector_name: e.target.value })}
                        placeholder="John Smith"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>

                    {/* Inspector Registration */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Registration Number (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.inspector_registration_number}
                        onChange={(e) => setFormData({ ...formData, inspector_registration_number: e.target.value })}
                        placeholder="NICEIC/NAPIT/ECA number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Test'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
