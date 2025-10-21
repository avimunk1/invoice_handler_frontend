import axios from 'axios';
import type { ProcessRequest, ProcessResponse, PresignedUrlResponse } from '../types/invoice';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Get presigned URL for S3 upload
 */
export async function getPresignedUrl(filename: string): Promise<PresignedUrlResponse> {
  const response = await apiClient.post<PresignedUrlResponse>(
    '/upload/presigned-url',
    null,
    { params: { filename } }
  );
  return response.data;
}

/**
 * Upload file to S3 using presigned URL
 */
export async function uploadToS3(
  file: File,
  presignedData: PresignedUrlResponse
): Promise<void> {
  const formData = new FormData();
  
  // Add all presigned fields
  Object.entries(presignedData.fields).forEach(([key, value]) => {
    formData.append(key, value);
  });
  
  // Add the file last
  formData.append('file', file);
  
  await axios.post(presignedData.url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

/**
 * Process invoices from S3 or local paths
 */
export async function processInvoices(
  request: ProcessRequest
): Promise<ProcessResponse> {
  const response = await apiClient.post<ProcessResponse>('/process', request);
  return response.data;
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string }> {
  const response = await apiClient.get('/healthz');
  return response.data;
}

