'use client';

import { useState } from 'react';

interface GenerateCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (certificateType: string, issueDate: string) => Promise<void>;
  testType: string;
  testNumber: string;
}

export default function GenerateCertificateModal({
  isOpen,
  onClose,
  onGenerate,
  testType,
  testNumber,
}: GenerateCertificateModalProps) {
  const [generating, setGenerating] = useState(false);
  const [certificateType, setCertificateType] = useState(getDefaultCertificateType(testType));
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);

  function getDefaultCertificateType(type: string): string {
    if (type === 'initial_verification') return 'eic';
    if (type === 'minor_works') return 'minor_works';
    if (type === 'eicr') return 'eicr';
    return 'eic';
  }

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await onGenerate(certificateType, issueDate);
      onClose();
    } catch (err) {
      // Error handling done in parent
    } finally {
      setGenerating(false);
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
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg className="h-6 w-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Generate Certificate
                </h3>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-4">
                      Generate an official BS 7671 compliance certificate for test <strong>{testNumber}</strong>
                    </p>
                  </div>

                  {/* Certificate Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Certificate Type
                    </label>
                    <select
                      value={certificateType}
                      onChange={(e) => setCertificateType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="eic">Electrical Installation Certificate (EIC)</option>
                      <option value="minor_works">Minor Works Certificate</option>
                      <option value="eicr">Electrical Installation Condition Report (EICR)</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      {certificateType === 'eic' && 'For new circuit installations and initial verifications'}
                      {certificateType === 'minor_works' && 'For additions and alterations to existing installations'}
                      {certificateType === 'eicr' && 'For periodic inspection and testing'}
                    </p>
                  </div>

                  {/* Issue Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Issue Date
                    </label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  {/* Info Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-xs text-blue-700">
                          The certificate will include all test results, circuit measurements, and inspection checklist data.
                          Make sure all required fields are complete before generating.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              {generating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                'Generate Certificate'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={generating}
              className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
