import { useState } from 'react';
import FileUpload from './components/FileUpload';
import ResultsTable from './components/ResultsTable';
import GridView from './components/GridView';
import { uploadFilesToS3, type UploadProgress } from './services/s3Upload';
import { processInvoicesWithLLM } from './api/client';
import type { InvoiceData } from './types/invoice';

type ViewMode = 'list' | 'grid';

function App() {
  const [results, setResults] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [processingProgress, setProcessingProgress] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list'); // Default to list view
  const [vatRate, setVatRate] = useState<number>(0.18);

  const handleFilesSelected = async (files: FileList | null, localPath?: string) => {
    setError(null);
    setLoading(true);
    setUploadProgress([]);
    setProcessingProgress(null);
    setResults([]); // Clear previous results

    try {
      let pathToProcess: string;

      if (files && files.length > 0) {
        // S3 mode: Upload files first, then process the folder
        const s3Paths = await uploadFilesToS3(files, setUploadProgress);
        
        if (s3Paths.length > 0) {
          // Get the directory path from the first uploaded file
          const firstPath = s3Paths[0];
          pathToProcess = firstPath.substring(0, firstPath.lastIndexOf('/'));
        } else {
          throw new Error('No files were uploaded');
        }
      } else if (localPath) {
        // Local mode: Use the provided path directly
        pathToProcess = localPath;
      } else {
        throw new Error('No files or path provided');
      }

      // Process files in batches
      const allResults: InvoiceData[] = [];
      let startingPoint = 0;
      let totalFiles = 0;
      let allErrors: string[] = [];

      // Process the first batch to get total file count
      do {
        // Update progress message
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

        // Update total files count on first iteration
        if (totalFiles === 0) {
          totalFiles = response.total_files;
        }

        // Append results from this batch
        allResults.push(...response.results);
        setResults([...allResults]); // Update UI with accumulated results
        if (response.vat_rate !== undefined && response.vat_rate !== null) {
          setVatRate(response.vat_rate);
        }
        
        // Collect errors
        if (response.errors.length > 0) {
          allErrors.push(...response.errors);
        }

        // Move to next batch
        startingPoint += response.files_handled;

        // Continue if there are more files to process
      } while (startingPoint < totalFiles);

      // Final update
      setProcessingProgress(`Completed processing ${totalFiles} files`);

      if (allErrors.length > 0) {
        setError(`Processing completed with ${allErrors.length} error(s)`);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Processing error:', err);
    } finally {
      setLoading(false);
      setTimeout(() => setProcessingProgress(null), 3000); // Clear progress message after 3 seconds
    }
  };

  const round2 = (n: number | undefined) => (typeof n === 'number' && isFinite(n) ? Math.round(n * 100) / 100 : undefined);

  const handleUpdateResult = (index: number, field: keyof InvoiceData, value: any) => {
    setResults((prev) => {
      const updated = prev.map((item, idx) => (idx === index ? { ...item } : item));
      const inv = updated[index];
      (inv as any)[field] = typeof value === 'number' ? value : (value !== undefined ? value : undefined);

      

      // Recalc logic based on which field changed
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

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-[1800px] mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Invoice Handler</h1>
          <p className="text-gray-600 mt-2">Upload and process invoices with AI</p>
        </header>

        {/* View toggles moved into results bars */}

        <FileUpload
          onFilesSelected={handleFilesSelected}
          uploading={loading}
          uploadProgress={uploadProgress}
        />

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {loading && !uploadProgress.length && (
          <div className="mt-8 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">
              {processingProgress || 'Processing invoices...'}
            </p>
          </div>
        )}

        {processingProgress && !loading && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center">
            {processingProgress}
          </div>
        )}

        {results.length > 0 && (
          viewMode === 'list' ? (
            <ResultsTable results={results} onUpdate={handleUpdateResult} viewMode={viewMode} onChangeView={setViewMode} />
          ) : (
            <GridView results={results} onUpdate={handleUpdateResult} viewMode={viewMode} onChangeView={setViewMode} />
          )
        )}
      </div>
    </div>
  );
}

export default App;
