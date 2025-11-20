export interface BoundingBox {
  polygon: number[][];  // [[x1,y1], [x2,y2], [x3,y3], [x4,y4]] normalized coordinates (0-1)
  page_number: number;
}

export interface LineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  line_total?: number;
}

export interface InvoiceData {
  file_name: string;
  source_path: string;
  file_url?: string;  // URL to view/download the file
  language: string;  // "en" or "he"
  document_type: string;  // "invoice", "receipt", "other", or "uncertain"
  supplier_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string | null;
  payment_terms?: string | null;
  status?: 'pending' | 'approved' | 'exported' | 'rejected';
  currency?: string;
  subtotal?: number;
  tax_amount?: number;
  total?: number;
  line_items?: LineItem[];
  confidence?: number;
  bounding_boxes?: Record<string, BoundingBox>;  // Field name -> bounding box
  page_count?: number;  // Total number of pages in document
  field_confidence?: Record<string, number>;  // Field name -> confidence score (0-1)
}

export interface ProcessRequest {
  path: string;
  recursive: boolean;
  language_detection: boolean;
  starting_point?: number;  // Index to start processing from (0-based)
}

export interface ProcessResponse {
  results: InvoiceData[];
  errors: string[];
  total_files: number;       // Total number of files discovered
  files_handled: number;     // Number of files processed in this batch
  vat_rate?: number;
}

export interface PresignedUrlResponse {
  url: string;
  fields: Record<string, string>;
  s3_path: string;
}

export interface SaveInvoicePayload {
  supplier_id?: number;
  supplier_name?: string;
  invoice_number: string;
  invoice_date: string; // YYYY-MM-DD
  currency: string;
  subtotal: number;
  vat_amount: number;
  total: number;
  expense_account_id?: number;
  deductible_pct?: number;
  doc_name?: string;
  doc_full_path?: string;
  document_type?: string; // invoice | receipt | other
  status?: string;        // pending | approved | exported | rejected
  ocr_confidence?: number;
  ocr_language?: string;
  ocr_metadata?: any;
  needs_review?: boolean;
  due_date?: string | null;
  payment_terms?: string | null;
}

export interface SaveInvoicesBatchRequest {
  customer_id: number;
  invoices: SaveInvoicePayload[];
}

export interface SaveInvoicesBatchResult {
  index: number;
  invoice_number: string;
  inserted_id?: number | null;
  supplier_id?: number | null;
  supplier_created?: boolean | null;
  conflict?: boolean;
  error?: string;
}

export interface SaveInvoicesBatchResponse {
  results: SaveInvoicesBatchResult[];
}

export interface Customer {
  id: number;
  name: string;
}

export interface InvoiceReportRecord {
  id: number;
  invoice_date: string;
  subtotal: number;
  vat_amount: number;
  total: number;
  supplier_name: string;
  doc_name: string | null;
  status: string;
  invoice_number: string;
  currency: string;
}

export interface InvoiceReportFilters {
  customer_id: number;
  start_date?: string;
  end_date?: string;
  status?: string;
}

export interface ExportInvoicesRequest {
  customer_id: number;
  invoice_ids?: number[];
  start_date?: string;
  end_date?: string;
  status?: string;
}

