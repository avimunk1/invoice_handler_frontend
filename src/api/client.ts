import axios from 'axios';
import type { ProcessRequest, ProcessResponse, PresignedUrlResponse, SaveInvoicesBatchRequest, SaveInvoicesBatchResponse, Customer, InvoiceReportRecord, InvoiceReportFilters, ExportInvoicesRequest } from '../types/invoice';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Upload file directly to Railway backend
 */
export async function uploadFile(file: File): Promise<{ success: boolean; filename: string; path: string; original_filename: string }> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await apiClient.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

/**
 * Process invoices from S3 or local paths (Azure invoice model)
 */
export async function processInvoices(
  request: ProcessRequest
): Promise<ProcessResponse> {
  const response = await apiClient.post<ProcessResponse>('/process', request);
  return response.data;
}

/**
 * Process invoices using LLM approach (Azure OCR + OpenAI)
 */
export async function processInvoicesWithLLM(
  request: ProcessRequest
): Promise<ProcessResponse> {
  const response = await apiClient.post<ProcessResponse>('/process/llm', request);
  return response.data;
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string }> {
  const response = await apiClient.get('/healthz');
  return response.data;
}

/**
 * Save invoices in batch
 */
export async function saveInvoicesBatch(
  payload: SaveInvoicesBatchRequest
): Promise<SaveInvoicesBatchResponse> {
  const response = await apiClient.post<SaveInvoicesBatchResponse>('/invoices/batch', payload);
  return response.data;
}

/**
 * Fetch all active customers
 */
export async function fetchCustomers(): Promise<Customer[]> {
  const response = await apiClient.get<Customer[]>('/customers');
  return response.data;
}

/**
 * Fetch invoices report with filters
 */
export async function fetchInvoicesReport(
  filters: InvoiceReportFilters
): Promise<InvoiceReportRecord[]> {
  const response = await apiClient.get<InvoiceReportRecord[]>('/invoices/report', {
    params: filters
  });
  return response.data;
}

/**
 * Export invoices to Excel file
 */
export async function exportInvoices(
  payload: ExportInvoicesRequest
): Promise<Blob> {
  const response = await apiClient.post('/invoices/export', payload, {
    responseType: 'blob'
  });
  return response.data;
}

