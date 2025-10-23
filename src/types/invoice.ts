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
}

export interface PresignedUrlResponse {
  url: string;
  fields: Record<string, string>;
  s3_path: string;
}

