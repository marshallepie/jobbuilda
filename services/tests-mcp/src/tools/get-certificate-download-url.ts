import { query } from '../lib/database.js';
import { getCertificateDownloadUrl } from '../lib/storage.js';
import { trace } from '@opentelemetry/api';
import type { AuthContext } from '@jobbuilda/contracts';

const tracer = trace.getTracer('tests-mcp');

export async function getCertificateDownloadUrlTool(
  input: { certificate_id: string },
  context: AuthContext
): Promise<{ download_url: string; expires_in: number; certificate_number: string }> {
  return tracer.startActiveSpan('tool.get_certificate_download_url', async (span) => {
    try {
      span.setAttributes({ 'tenant.id': context.tenant_id, 'certificate.id': input.certificate_id });

      const result = await query(
        `SELECT id, certificate_number, storage_url FROM test_certificates
         WHERE id = $1 AND tenant_id = $2`,
        [input.certificate_id, context.tenant_id]
      );

      if (result.rows.length === 0) {
        throw new Error('Certificate not found');
      }

      const cert = result.rows[0];
      const signedUrl = await getCertificateDownloadUrl(cert.storage_url, 3600);

      return {
        download_url: signedUrl,
        expires_in: 3600,
        certificate_number: cert.certificate_number
      };
    } finally {
      span.end();
    }
  });
}
