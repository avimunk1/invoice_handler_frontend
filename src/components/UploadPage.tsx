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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">Upload & Process</h1>
          <p className="text-lg text-gray-600">Select invoices, process with AI, and save to your database</p>
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Azure Document Intelligence
            </span>
            <span className="text-gray-300">•</span>
            <span className="inline-flex items-center gap-1">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              OpenAI GPT-4
            </span>
          </div>
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
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 shadow-sm flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* File Selection Area - shown when no results */}
        {results.length === 0 && !processing && (
          <div className="card p-8 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Select Invoices</h2>
            </div>

            {selectedFiles.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 hover:border-blue-400 transition-all duration-200">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-600 mb-2 font-medium">No files selected</p>
                <p className="text-sm text-gray-500 mb-6">PDF, JPG, or PNG formats supported</p>
                <button
                  onClick={handleFileSelect}
                  className="btn btn-primary px-8 py-3 text-lg inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Select Files
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
                      <span className="text-blue-700 font-bold text-lg">{selectedFiles.length}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-blue-900">
                        {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                      </p>
                      <p className="text-xs text-blue-700">{formatFileSize(totalSize)} total</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleFileSelect}
                      className="btn btn-secondary inline-flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add More
                    </button>
                    <button
                      onClick={handleClearAll}
                      className="btn btn-secondary inline-flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-8 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200 group">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-blue-50 transition-colors">
                          <svg className="w-5 h-5 text-gray-600 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <span className="badge badge-info">{formatFileSize(file.size)}</span>
                            <span>{file.type || 'Unknown type'}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(index)}
                        className="ml-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                        title="Remove file"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                <div className="text-center border-t border-gray-200 pt-8">
                  <button
                    onClick={handleStartProcessing}
                    disabled={processing}
                    className="btn btn-success px-12 py-4 text-lg font-semibold inline-flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {processing ? 'Processing...' : 'Start Processing'}
                  </button>
                  <p className="text-sm text-gray-600 mt-4">
                    Files will be uploaded and analyzed with AI-powered document intelligence
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Processing Indicator */}
        {processing && (
          <div className="card p-12 text-center max-w-2xl mx-auto">
            <div className="relative inline-flex mb-6">
              <div className="absolute inset-0 rounded-full bg-blue-400 opacity-25 animate-ping"></div>
              <div className="spinner w-20 h-20 border-4 border-blue-600"></div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Processing Invoices...</h3>
            <p className="text-gray-600 mb-6">Using Azure Document Intelligence + OpenAI GPT-4 for accurate extraction</p>
            <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span>Analyzing documents</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse delay-75"></div>
                <span>Extracting data</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse delay-150"></div>
                <span>Validating results</span>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {results.length > 0 && !processing && (
          <>
            <div className="card p-4 mb-6 flex items-center gap-3 flex-wrap">
              <button
                onClick={() => {
                  setResults([]);
                  setError(null);
                  setSavedInvoiceIds({});
                  setNewFiles([]);
                }}
                className="btn btn-secondary inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Start Over
              </button>
              <button
                onClick={handleFileSelect}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add More Files
              </button>
              <div className="flex-grow"></div>
              <div className="flex items-end gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Customer *</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
                    className="select min-w-[220px]"
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
                  className="btn btn-success px-6 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!customerId ? 'Select customer' : 'Save all to database'}
                >
                  {saving ? (
                    <>
                      <div className="spinner w-4 h-4 border-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      Save All
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Show pending new files to be processed */}
            {newFiles.length > 0 && (
              <div className="mb-6 card bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-blue-900">
                      {newFiles.length} New File{newFiles.length !== 1 ? 's' : ''} Ready to Process
                    </h3>
                    <p className="text-sm text-blue-700">Add these files to your results</p>
                  </div>
                </div>
                <div className="space-y-2 mb-6 max-h-60 overflow-y-auto custom-scrollbar">
                  {newFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded-xl border border-blue-200 shadow-sm">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                          <div className="badge badge-info text-xs mt-1">{formatFileSize(file.size)}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => setNewFiles(prev => prev.filter((_, i) => i !== index))}
                        className="ml-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Remove file"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleProcessNewFiles}
                    className="btn btn-success flex-1 inline-flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Process New Files
                  </button>
                  <button
                    onClick={() => setNewFiles([])}
                    className="btn btn-secondary"
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
              <div className="bg-gradient-to-r from-red-600 to-red-700 p-6">
                <div className="flex items-center gap-3 text-white">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/20">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Conflicts Detected</h3>
                    <p className="text-red-100 mt-1">{conflicts.conflicts.length} issue{conflicts.conflicts.length !== 1 ? 's' : ''} need your attention</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="text-gray-600 mb-6">
                  The following conflicts were found. Please resolve them before saving:
                </p>
                <div className="space-y-3 mb-6 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                  {conflicts.conflicts.map((conflict, idx) => (
                    <div key={idx} className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <div className="font-semibold text-red-900">Invoice: {conflict.invoice_number}</div>
                          <div className="text-sm text-red-700 mt-1">
                            <span className="badge badge-error mr-2">{conflict.type}</span>
                            {conflict.message}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowConflictModal(false);
                      setConflicts(null);
                    }}
                    className="btn btn-secondary px-6"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
