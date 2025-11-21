import { useState, useEffect, useRef } from 'react';
import ResultsTable from './ResultsTable';
import GridView from './GridView';
import { uploadAndProcess, saveInvoicesBatch, checkInvoiceConflicts, fetchCustomers } from '../api/client';
import type { InvoiceData, SaveInvoicesBatchRequest, Customer } from '../types/invoice';
import type { ConflictCheckResponse } from '../api/client';

type ViewMode = 'list' | 'grid';

export default function UploadPage() {
  // File selection state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]); // Files to be processed next
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Processing state
  const [results, setResults] = useState<InvoiceData[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Save state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [savedInvoiceIds, setSavedInvoiceIds] = useState<Record<number, number>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [vatRate, setVatRate] = useState<number>(0.18);
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  
  // Conflict checking
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictCheckResponse | null>(null);

  // Fetch customers on mount
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const data = await fetchCustomers();
        setCustomers(data);
      } catch (err) {
        console.error('Failed to fetch customers:', err);
      }
    };
    loadCustomers();
  }, []);

  // Load from sessionStorage on mount
  useEffect(() => {
    const savedSelection = sessionStorage.getItem('uploadPage_selection');
    if (savedSelection) {
      try {
        const data = JSON.parse(savedSelection);
        // Note: We can't restore File objects from sessionStorage, only metadata
        // Show a message if there was a previous session
        if (data.fileCount > 0) {
          setError(`Previous session found with ${data.fileCount} file(s). Please select files again.`);
        }
      } catch (e) {
        console.error('Failed to restore session:', e);
      }
    }
  }, []);

  // Save to sessionStorage on unmount
  useEffect(() => {
    return () => {
      if (selectedFiles.length > 0) {
        sessionStorage.setItem('uploadPage_selection', JSON.stringify({
          fileCount: selectedFiles.length,
          timestamp: new Date().toISOString()
        }));
      }
    };
  }, [selectedFiles]);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      
      if (results.length > 0) {
        // We have existing results, so these are "new files to add"
        setNewFiles(files);
      } else {
        // Initial file selection
        setSelectedFiles(prev => [...prev, ...files]);
      }
      
      setError(null);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setNewFiles([]);
    setError(null);
  };

  const handleStartProcessing = async () => {
    if (selectedFiles.length === 0) return;

    setError(null);
    setProcessing(true);
    setResults([]);

    try {
      const response = await uploadAndProcess(selectedFiles);
      
      setResults(response.results);
      if (response.vat_rate !== undefined && response.vat_rate !== null) {
        setVatRate(response.vat_rate);
      }
      
      if (response.errors.length > 0) {
        setError(`Processing completed with ${response.errors.length} error(s)`);
      }
      
      // Clear selected files after processing
      setSelectedFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      console.error('Processing error:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessNewFiles = async () => {
    if (newFiles.length === 0) return;

    setError(null);
    setProcessing(true);

    try {
      const response = await uploadAndProcess(newFiles);
      
      // Append new results to existing results
      setResults(prev => [...prev, ...response.results]);
      
      if (response.vat_rate !== undefined && response.vat_rate !== null) {
        setVatRate(response.vat_rate);
      }
      
      if (response.errors.length > 0) {
        setError(`Processing completed with ${response.errors.length} error(s)`);
      }
      
      // Clear new files after processing
      setNewFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      console.error('Processing error:', err);
    } finally {
      setProcessing(false);
    }
  };

  const round2 = (n: number | undefined) => (typeof n === 'number' && isFinite(n) ? Math.round(n * 100) / 100 : undefined);

  const handleUpdateResult = (index: number, field: keyof InvoiceData, value: any) => {
    setResults((prev) => {
      const updated = prev.map((item, idx) => (idx === index ? { ...item } : item));
      const inv = updated[index];
      (inv as any)[field] = typeof value === 'number' ? value : (value !== undefined ? value : undefined);

      // Recalculate if needed
      if (field === 'subtotal' || field === 'tax_amount') {
        const sub = typeof updated[index].subtotal === 'number' ? updated[index].subtotal : 0;
        const tax = typeof updated[index].tax_amount === 'number' ? updated[index].tax_amount : 0;
        updated[index].total = round2(sub + tax);
      }

      if (field === 'total' || field === 'tax_amount') {
        const total = typeof updated[index].total === 'number' ? updated[index].total : 0;
        const tax = typeof updated[index].tax_amount === 'number' ? updated[index].tax_amount : 0;
        updated[index].subtotal = round2(total - tax);
      }

      if (field === 'total' && !updated[index].tax_amount) {
        const total = typeof updated[index].total === 'number' ? updated[index].total : 0;
        const vatRateCalc = vatRate || 0;
        updated[index].subtotal = round2(total / (1 + vatRateCalc));
        updated[index].tax_amount = round2(total - (updated[index].subtotal || 0));
      }

      return updated;
    });
  };

  const averageConfidence = (fieldConf?: any) => {
    if (!fieldConf || typeof fieldConf !== 'object') return 0;
    const values = Object.values(fieldConf).filter((v): v is number => typeof v === 'number');
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  const handleSaveSingle = async (index: number) => {
    if (!customerId) {
      setError('Please enter a customer ID');
      return;
    }

    const r = results[index];
    if (!r) return;

    setSaving(true);
    setError(null);

    try {
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

      // Check for conflicts first
      const conflictCheck = await checkInvoiceConflicts(payload);
      if (conflictCheck.has_conflicts) {
        setConflicts(conflictCheck);
        setShowConflictModal(true);
        setSaving(false);
        return;
      }

      const resp = await saveInvoicesBatch(payload);
      
      if (resp?.results?.[0]?.error) {
        throw new Error(resp.results[0].error);
      }
      
      if (resp?.results?.[0]?.inserted_id != null) {
        setSavedInvoiceIds(prev => ({
          ...prev,
          [index]: resp.results[0].inserted_id!
        }));
        
        setResults(prev => {
          const updated = [...prev];
          if (resp.results[0].supplier_id != null) {
            (updated[index] as any).supplier_id = resp.results[0].supplier_id;
          }
          return updated;
        });
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    if (!customerId || results.length === 0) return;
    
    setSaving(true);
    setError(null);

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

      // Check for conflicts first (only for unsaved invoices)
      const unsavedInvoices = results.filter((_, idx) => !savedInvoiceIds[idx]);
      if (unsavedInvoices.length > 0) {
        const conflictPayload: SaveInvoicesBatchRequest = {
          customer_id: Number(customerId),
          invoices: payload.invoices.filter((_, idx) => !savedInvoiceIds[idx])
        };
        
        const conflictCheck = await checkInvoiceConflicts(conflictPayload);
        if (conflictCheck.has_conflicts) {
          setConflicts(conflictCheck);
          setShowConflictModal(true);
          setSaving(false);
          return;
        }
      }

      const resp = await saveInvoicesBatch(payload);
      
      if (resp?.results?.length) {
        const insertCount = resp.results.filter(r => !r.is_update && r.inserted_id).length;
        const updateCount = resp.results.filter(r => r.is_update).length;
        const errorCount = resp.results.filter(r => r.error).length;
        
        if (errorCount === 0) {
          // Success - clear everything and reset
          setResults([]);
          setSelectedFiles([]);
          setSavedInvoiceIds({});
          sessionStorage.removeItem('uploadPage_selection');
          setError(null);
          alert(`Successfully saved! ${insertCount} inserted, ${updateCount} updated.`);
        } else {
          setError(`Completed with ${errorCount} error(s). ${insertCount} inserted, ${updateCount} updated.`);
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to save invoices');
    } finally {
      setSaving(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-[1800px] mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Upload & Process</h1>
          <p className="text-gray-600 mt-2">Select files, process with AI, and save to database</p>
        </header>

        {/* Hidden file input - always in DOM so ref works */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          className="hidden"
        />

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* File Selection Area - shown when no results */}
        {results.length === 0 && !processing && (
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Select Invoices</h2>

            {selectedFiles.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-20 h-20 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-600 mb-4">No files selected</p>
                <button
                  onClick={handleFileSelect}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Select Files
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    {selectedFiles.length} file(s) selected • {formatFileSize(totalSize)}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleFileSelect}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      Add More
                    </button>
                    <button
                      onClick={handleClearAll}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                        <div className="text-xs text-gray-500">{formatFileSize(file.size)} • {file.type || 'Unknown type'}</div>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(index)}
                        className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove file"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                <div className="text-center">
                  <button
                    onClick={handleStartProcessing}
                    disabled={processing}
                    className="px-8 py-3 bg-green-600 text-white text-lg font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors shadow-lg"
                  >
                    {processing ? 'Processing...' : 'Start Processing'}
                  </button>
                  <p className="text-sm text-gray-500 mt-2">
                    Files will be uploaded and processed with AI
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Processing Indicator */}
        {processing && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing Invoices...</h3>
            <p className="text-gray-600">Using Azure Document Intelligence + OpenAI for accurate extraction</p>
          </div>
        )}

        {/* Results Section */}
        {results.length > 0 && !processing && (
          <>
            <div className="mb-6 flex items-end gap-3 flex-wrap">
              <button
                onClick={() => {
                  setResults([]);
                  setError(null);
                  setSavedInvoiceIds({});
                  setNewFiles([]);
                }}
                className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700 text-white"
              >
                ← Start Over
              </button>
              <button
                onClick={handleFileSelect}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
              >
                + Add More Files
              </button>
              <div className="flex-grow"></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                >
                  <option value="">Select customer...</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSaveAll}
                disabled={!customerId || saving}
                className={`px-4 py-2 rounded text-white ${!customerId || saving ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                title={!customerId ? 'Select customer' : 'Save all to database'}
              >
                {saving ? 'Saving…' : 'Save All'}
              </button>
            </div>

            {/* Show pending new files to be processed */}
            {newFiles.length > 0 && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">
                  {newFiles.length} New File(s) Ready to Process
                </h3>
                <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                  {newFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-white rounded border border-blue-100">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                        <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                      </div>
                      <button
                        onClick={() => setNewFiles(prev => prev.filter((_, i) => i !== index))}
                        className="ml-4 p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Remove file"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleProcessNewFiles}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Process New Files
                  </button>
                  <button
                    onClick={() => setNewFiles([])}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {viewMode === 'list' ? (
              <ResultsTable results={results} onUpdate={handleUpdateResult} viewMode={viewMode} onChangeView={setViewMode} />
            ) : (
              <GridView results={results} onUpdate={handleUpdateResult} viewMode={viewMode} onChangeView={setViewMode} onSaveSingle={handleSaveSingle} />
            )}
          </>
        )}

        {/* Conflict Modal */}
        {showConflictModal && conflicts && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Conflicts Detected</h3>
              <p className="text-gray-600 mb-4">
                The following conflicts were found. Please resolve them before saving:
              </p>
              <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
                {conflicts.conflicts.map((conflict, idx) => (
                  <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded">
                    <div className="font-medium text-red-900">Invoice: {conflict.invoice_number}</div>
                    <div className="text-sm text-red-700">Type: {conflict.type}</div>
                    <div className="text-sm text-red-600">{conflict.message}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowConflictModal(false);
                    setConflicts(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
