/**
 * Supabase Storage Integration for Certificate PDFs
 * Handles upload and retrieval of generated certificates
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Initialize Supabase client (lazy initialization)
 */
function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables'
      );
    }

    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return supabaseClient;
}

/**
 * Upload a certificate PDF to Supabase Storage
 * @param tenantId - Tenant ID for folder organization
 * @param certificateNumber - Certificate number for filename
 * @param pdfBuffer - PDF file as Buffer
 * @returns Storage path of uploaded file
 */
export async function uploadCertificatePDF(
  tenantId: string,
  certificateNumber: string,
  pdfBuffer: Buffer
): Promise<string> {
  const supabase = getSupabaseClient();

  // Path format: {tenant_id}/certificates/{certificate_number}.pdf
  const path = `${tenantId}/certificates/${certificateNumber}.pdf`;

  const { data, error } = await supabase.storage
    .from('certificates')
    .upload(path, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true, // Replace if exists
      cacheControl: '3600' // Cache for 1 hour
    });

  if (error) {
    throw new Error(`Failed to upload certificate PDF: ${error.message}`);
  }

  return data.path;
}

/**
 * Get a temporary signed URL for downloading a certificate
 * @param storagePath - Path returned from uploadCertificatePDF
 * @param expiresIn - URL expiry in seconds (default 1 hour)
 * @returns Signed URL for direct download
 */
export async function getCertificateDownloadUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.storage
    .from('certificates')
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  if (!data || !data.signedUrl) {
    throw new Error('No signed URL returned from Supabase');
  }

  return data.signedUrl;
}

/**
 * Delete a certificate PDF from storage
 * @param storagePath - Path to the file
 */
export async function deleteCertificatePDF(storagePath: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.storage
    .from('certificates')
    .remove([storagePath]);

  if (error) {
    throw new Error(`Failed to delete certificate PDF: ${error.message}`);
  }
}

/**
 * Check if certificate storage bucket exists and is configured
 * Useful for health checks
 */
export async function checkStorageHealth(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    // Try to list buckets to verify connection
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
      console.error('Storage health check failed:', error);
      return false;
    }

    // Check if certificates bucket exists
    const certificatesBucket = data?.find(b => b.name === 'certificates');
    if (!certificatesBucket) {
      console.warn('Certificates bucket not found in Supabase Storage');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Storage health check error:', error);
    return false;
  }
}

/**
 * Get public URL for a certificate (if bucket is public)
 * Note: For private buckets, use getCertificateDownloadUrl instead
 */
export function getPublicCertificateUrl(storagePath: string): string {
  const supabase = getSupabaseClient();

  const { data } = supabase.storage
    .from('certificates')
    .getPublicUrl(storagePath);

  return data.publicUrl;
}
