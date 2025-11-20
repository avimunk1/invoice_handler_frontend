import { useState } from 'react';
import FileUpload from './FileUpload';
import ResultsTable from './ResultsTable';
import GridView from './GridView';
import { uploadFilesToS3, type UploadProgress } from '../services/s3Upload';
import { processInvoicesWithLLM, saveInvoicesBatch } from '../api/client';
import type { InvoiceData, SaveInvoicesBatchRequest, SaveInvoicesBatchResponse } from '../types/invoice';

type ViewMode = 'list' | 'grid';

export default function UploadPage() {
  const [results, setResults] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [processingProgress, setProcessingProgress] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [vatRate, setVatRate] = useState<number>(0.18);
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveInvoicesBatchResponse | null>(null);

  const handleFilesSelected = async (files: FileList | null, localPath?: string) => {
    setError(null);
    setLoading(true);
    setUploadProgress([]);
    setProcessingProgress(null);
    setResults([]);

    try {
      let pathToProcess: string;

      if (files && files.length > 0) {
        const uploadDir = await uploadFilesToS3(files, setUploadProgress);
        pathToProcess = uploadDir;
      } else if (localPath) {
        pathToProcess = localPath;
      } else {
        throw new Error('No files or path provided');
      }

      const allResults: InvoiceData[] = [];
      let startingPoint = 0;
      let totalFiles = 0;
      let allErrors: string[] = [];

      do {
        if (totalFiles > 0) {
          setProcessingProgress(`Processing ${Math.min(startingPoint + 1, totalFiles)} - ${Math.min(startingPoint + 5, totalFiles)} of ${totalFiles} files`);
        } else {
          setProcessingProgress('Discovering files...');
        }

        const response = await processInvoicesWithLLM({
          path: pathToProcess,
          recursive: false,
          language_detection: true,
          starting_point: startingPoint,
        });

        if (totalFiles === 0) {
          totalFiles = response.total_files;
        }

        allResults.push(...response.results);
        setResults([...allResults]);
        if (response.vat_rate !== undefined && response.vat_rate !== null) {
          setVatRate(response.vat_rate);
        }
        
        if (response.errors.length > 0) {
          allErrors.push(...response.errors);
        }

        startingPoint += response.files_handled;

      } while (startingPoint < totalFiles);

      setProcessingProgress(`Completed processing ${totalFiles} files`);

      if (allErrors.length > 0) {
        setError(`Processing completed with ${allErrors.length} error(s)`);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Processing error:', err);
    } finally {
      setLoading(false);
      setTimeout(() => setProcessingProgress(null), 3000);
    }
  };

  const round2 = (n: number | undefined) => (typeof n === 'number' && isFinite(n) ? Math.round(n * 100) / 100 : undefined);

  const handleUpdateResult = (index: number, field: keyof InvoiceData, value: any) => {
    setResults((prev) => {
      const updated = prev.map((item, idx) => (idx === index ? { ...item } : item));
      const inv = updated[index];
      (inv as any)[field] = typeof value === 'number' ? value : (value !== undefined ? value : undefined);

      if (field === 'subtotal') {
        if (typeof inv.subtotal === 'number') {
          inv.tax_amount = round2(inv.subtotal * vatRate);
          inv.total = round2(inv.subtotal + (inv.tax_amount ?? 0));
        }
      } else if (field === 'tax_amount') {
        if (typeof inv.tax_amount === 'number') {
          inv.subtotal = round2(inv.tax_amount / vatRate);
          inv.total = round2((inv.subtotal ?? 0) + inv.tax_amount);
        }
      } else if (field === 'total') {
        if (typeof inv.total === 'number') {
          inv.subtotal = round2(inv.total / (1 + vatRate));
          inv.tax_amount = round2((inv.subtotal ?? 0) * vatRate);
        }
      }

      return updated;
    });
  };

  const averageConfidence = (conf?: Record<string, number>): number | undefined => {
    if (!conf) return undefined;
    const vals = Object.values(conf).filter((v) => typeof v === 'number');
    if (!vals.length) return undefined;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.round(avg * 1000) / 1000;
  };

  const handleSaveSingle = async (index: number) => {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }
    const r = results[index];
    if (!r) {
      throw new Error('Invoice not found');
    }

    const payload: SaveInvoicesBatchRequest = {
      customer_id: Number(customerId),
      invoices: [{
        supplier_id: (r as any).supplier_id ?? undefined,
        supplier_name: r.supplier_name,
        invoice_number: r.invoice_number || r.file_name,
        invoice_date: (r.invoice_date || '').slice(0, 10),
        due_date: r.due_date ? r.due_date.slice(0, 10) : null,
        payment_terms: r.payment_terms ?? null,
        currency: r.currency || 'ILS',
        subtotal: Number(r.subtotal ?? 0),
        vat_amount: Number(r.tax_amount ?? 0),
        total: Number(r.total ?? 0),
        doc_name: r.file_name,
        doc_full_path: r.source_path,
        document_type: r.document_type || 'invoice',
        status: r.status || 'pending',
        ocr_confidence: typeof r.confidence === 'number' ? r.confidence : averageConfidence(r.field_confidence),
        ocr_language: r.language,
        ocr_metadata: {
          field_confidence: r.field_confidence,
          bounding_boxes: r.bounding_boxes,
          page_count: r.page_count,
        },
        needs_review: false,
      }]
    };

    const resp = await saveInvoicesBatch(payload);
    
    if (resp?.results?.[0]?.error) {
      throw new Error(resp.results[0].error);
    }
    
    if (resp?.results?.[0]?.supplier_id != null) {
      setResults(prev => {
        const updated = [...prev];
        (updated[index] as any).supplier_id = resp.results[0].supplier_id;
        return updated;
      });
    }
  };

  const handleSaveAll = async () => {
    if (!customerId || results.length === 0) return;
    setSaving(true);
    setError(null);
    setSaveResult(null);
    try {
      const payload: SaveInvoicesBatchRequest = {
        customer_id: Number(customerId),
        invoices: results.map((r) => ({
          supplier_id: (r as any).supplier_id ?? undefined,
          supplier_name: r.supplier_name,
          invoice_number: r.invoice_number || r.file_name,
          invoice_date: (r.invoice_date || '').slice(0, 10),
          due_date: r.due_date ? r.due_date.slice(0, 10) : null,
          payment_terms: r.payment_terms ?? null,
          currency: r.currency || 'ILS',
          subtotal: Number(r.subtotal ?? 0),
          vat_amount: Number(r.tax_amount ?? 0),
          total: Number(r.total ?? 0),
          doc_name: r.file_name,
          doc_full_path: r.source_path,
          document_type: r.document_type || 'invoice',
          status: r.status || 'pending',
          ocr_confidence: typeof r.confidence === 'number' ? r.confidence : averageConfidence(r.field_confidence),
          ocr_language: r.language,
          ocr_metadata: {
            field_confidence: r.field_confidence,
            bounding_boxes: r.bounding_boxes,
            page_count: r.page_count,
          },
          needs_review: false,
        }))
      };

      const resp = await saveInvoicesBatch(payload);
      setSaveResult(resp);
      if (resp?.results?.length) {
        setResults(prev => {
          const updated = [...prev];
          resp.results.forEach(r => {
            if (r.supplier_id != null && updated[r.index]) {
              (updated[r.index] as any).supplier_id = r.supplier_id;
            }
          });
          return updated;
        });
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to save invoices');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-[1800px] mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Upload & Process</h1>
          <p className="text-gray-600 mt-2">Upload and process invoices with AI</p>
        </header>

        {/* Show upload area only when not loading and no results */}
        {!loading && results.length === 0 && (
          <FileUpload
            onFilesSelected={handleFilesSelected}
            uploading={loading}
          />
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Loading indicator with stages */}
        {loading && (
          <div className="mt-8 bg-white rounded-lg shadow-md p-8">
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-6">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
              </div>
              
              {/* Upload progress */}
              {uploadProgress.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Uploading Files...</h3>
                  <div className="space-y-2">
                    {uploadProgress.map((progress, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <span className="text-sm text-gray-700 truncate flex-1">{progress.filename}</span>
                        <span className={`text-sm font-medium ml-4 ${
                          progress.status === 'completed' ? 'text-green-600' :
                          progress.status === 'error' ? 'text-red-600' :
                          progress.status === 'uploading' ? 'text-blue-600' :
                          'text-gray-400'
                        }`}>
                          {progress.status === 'completed' ? '✓ Uploaded' :
                           progress.status === 'error' ? '✗ Failed' :
                           progress.status === 'uploading' ? '⟳ Uploading...' :
                           '○ Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Processing progress */}
              {processingProgress && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Processing Invoices...</h3>
                  <p className="text-center text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    {processingProgress}
                  </p>
                  <p className="text-sm text-gray-500 text-center mt-3">
                    Using Azure Document Intelligence + OpenAI for accurate extraction
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {processingProgress && !loading && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center">
            ✓ {processingProgress}
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-6 flex items-end gap-3 flex-wrap">
            <button
              onClick={() => {
                setResults([]);
                setError(null);
                setSaveResult(null);
                setUploadProgress([]);
                setProcessingProgress(null);
              }}
              className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700 text-white"
            >
              ← Upload More Files
            </button>
            <div className="flex-grow"></div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Customer ID</label>
              <input
                type="number"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
                className="px-3 py-2 border rounded w-40"
                placeholder="e.g. 1"
                min={1}
              />
            </div>
            <button
              onClick={handleSaveAll}
              disabled={!customerId || saving}
              className={`px-4 py-2 rounded text-white ${!customerId || saving ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              title={!customerId ? 'Enter customer ID' : 'Save all to database'}
            >
              {saving ? 'Saving…' : 'Save All'}
            </button>
            {saveResult && (
              <div className="text-sm text-gray-700">
                Saved: {saveResult.results.filter(r => r.inserted_id).length} • Conflicts: {saveResult.results.filter(r => r.conflict).length} • Errors: {saveResult.results.filter(r => r.error).length}
              </div>
            )}
          </div>
        )}

        {results.length > 0 && (
          viewMode === 'list' ? (
            <ResultsTable results={results} onUpdate={handleUpdateResult} viewMode={viewMode} onChangeView={setViewMode} />
          ) : (
            <GridView results={results} onUpdate={handleUpdateResult} viewMode={viewMode} onChangeView={setViewMode} onSaveSingle={handleSaveSingle} />
          )
        )}
      </div>
    </div>
  );
}

