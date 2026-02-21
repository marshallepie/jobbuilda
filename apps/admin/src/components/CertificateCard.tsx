'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Certificate {
  id: string;
  certificate_number: string;
  certificate_type: string;
  issue_date: string;
  expiry_date?: string;
  storage_url?: string;
  file_size_bytes?: number;
  generated_at: string;
  generated_by: string;
}

interface CertificateCardProps {
  certificate: Certificate;
  onRegenerate?: () => void;
  onDownloadSuccess?: () => void;
}

export default function CertificateCard({
  certificate,
  onRegenerate,
  onDownloadSuccess,
}: CertificateCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCertificateTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      eic: 'Electrical Installation Certificate',
      minor_works: 'Minor Works Certificate',
      eicr: 'Electrical Installation Condition Report',
      pat: 'PAT Testing Certificate',
    };
    return labels[type] || type.toUpperCase();
  };

  const getCertificateTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      eic: 'bg-blue-100 text-blue-800',
      minor_works: 'bg-green-100 text-green-800',
      eicr: 'bg-purple-100 text-purple-800',
      pat: 'bg-yellow-100 text-yellow-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${kb.toFixed(2)} KB`;
  };

  const handleDownload = async () => {
    if (!certificate.storage_url) {
      setError('No file URL available');
      return;
    }

    setDownloading(true);
    setError(null);

    try {
      // If the storage_url is already a full URL (from Supabase), use it directly
      if (certificate.storage_url.startsWith('http')) {
        // Open in new tab
        window.open(certificate.storage_url, '_blank');
      } else {
        // Otherwise, fetch through our API (which should generate presigned URL)
        const mockAuth = {
          token: 'mock-jwt-token',
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          user_id: '550e8400-e29b-41d4-a716-446655440001',
        };
        api.setAuth(mockAuth);

        // TODO: Implement presigned URL endpoint
        // const response = await api.get(`/api/certificates/${certificate.id}/download`);
        // window.open(response.download_url, '_blank');

        // For now, use the storage URL directly
        window.open(certificate.storage_url, '_blank');
      }

      onDownloadSuccess?.();
    } catch (err: any) {
      console.error('Failed to download certificate:', err);
      setError(err.message || 'Failed to download certificate');
    } finally {
      setDownloading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('Generate a new version of this certificate? The previous version will remain accessible.')) {
      return;
    }

    setRegenerating(true);
    setError(null);

    try {
      const mockAuth = {
        token: 'mock-jwt-token',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
      };
      api.setAuth(mockAuth);

      // Regenerate certificate (this will create a new version)
      await api.post(`/api/tests/${certificate.id}/certificate`, {
        certificate_type: certificate.certificate_type,
        issue_date: new Date().toISOString().split('T')[0],
      });

      alert('Certificate regenerated successfully!');
      onRegenerate?.();
    } catch (err: any) {
      console.error('Failed to regenerate certificate:', err);
      setError(err.message || 'Failed to regenerate certificate');
    } finally {
      setRegenerating(false);
    }
  };

  const handleEmailToClient = () => {
    // Future feature
    alert('Email to client feature coming soon!');
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* Certificate Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 rounded-md text-xs font-medium ${getCertificateTypeBadge(certificate.certificate_type)}`}>
              {certificate.certificate_type.toUpperCase()}
            </span>
            <span className="text-sm font-medium text-gray-900">{certificate.certificate_number}</span>
          </div>

          <h4 className="font-medium text-gray-900 mb-1">
            {getCertificateTypeLabel(certificate.certificate_type)}
          </h4>

          <dl className="text-sm space-y-1">
            <div className="flex gap-2">
              <dt className="text-gray-600">Issued:</dt>
              <dd className="text-gray-900 font-medium">{formatDate(certificate.issue_date)}</dd>
            </div>
            {certificate.expiry_date && (
              <div className="flex gap-2">
                <dt className="text-gray-600">Expires:</dt>
                <dd className="text-gray-900 font-medium">{formatDate(certificate.expiry_date)}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-gray-600">Generated:</dt>
              <dd className="text-gray-900">{formatDate(certificate.generated_at)}</dd>
            </div>
            {certificate.file_size_bytes && (
              <div className="flex gap-2">
                <dt className="text-gray-600">File size:</dt>
                <dd className="text-gray-900">{formatFileSize(certificate.file_size_bytes)}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Certificate Icon/Preview */}
        <div className="flex-shrink-0">
          <div className="w-16 h-20 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg flex items-center justify-center shadow-sm">
            <svg className="w-10 h-10 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleDownload}
          disabled={downloading || !certificate.storage_url}
          className="flex-1 min-w-[120px] px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2"
        >
          {downloading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Downloading...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </>
          )}
        </button>

        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-1"
        >
          {regenerating ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Regenerating...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerate
            </>
          )}
        </button>

        <button
          onClick={handleEmailToClient}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium flex items-center gap-1"
          title="Coming soon"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Email
        </button>
      </div>
    </div>
  );
}
