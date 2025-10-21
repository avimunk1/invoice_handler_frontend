export interface LineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  line_total?: number;
}

export interface InvoiceData {
  file_name: string;
  source_path: string;
  language: string;  // "en" or "he"
  document_type: string;  // "invoice", "receipt", "other", or "uncertain"
  supplier_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  currency?: string;
  subtotal?: number;
  tax_amount?: number;
  total?: number;
  line_items?: LineItem[];
  confidence?: number;
}

export interface ProcessRequest {
  path: string;
  recursive: boolean;
  language_detection: boolean;
}

export interface ProcessResponse {
  results: InvoiceData[];
  errors: string[];
}

export interface PresignedUrlResponse {
  url: string;
  fields: Record<string, string>;
  s3_path: string;
}

