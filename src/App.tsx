import { useState } from 'react';
import FileUpload from './components/FileUpload';
import ResultsTable from './components/ResultsTable';
import GridView from './components/GridView';
import { uploadFilesToS3, type UploadProgress } from './services/s3Upload';
import { processInvoices, processInvoicesWithLLM } from './api/client';
import type { InvoiceData } from './types/invoice';

type ViewMode = 'list' | 'grid';

function App() {
  const [results, setResults] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [useLLM, setUseLLM] = useState(true); // Default to LLM approach
  const [processingProgress, setProcessingProgress] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list'); // Default to list view

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

        const response = useLLM 
          ? await processInvoicesWithLLM({
              path: pathToProcess,
              recursive: false,
              language_detection: true,
              starting_point: startingPoint,
            })
          : await processInvoices({
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

  const handleUpdateResult = (index: number, field: keyof InvoiceData, value: any) => {
    setResults((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      )
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-[1800px] mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Invoice Handler</h1>
          <p className="text-gray-600 mt-2">Upload and process invoices with AI</p>
        </header>

        {/* Processing Method & View Mode Toggles */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-4 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Processing Method Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Processing Method</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {useLLM 
                    ? '🤖 LLM Mode: Smart extraction + bounding boxes'
                    : '⚡ Azure Mode: Fast extraction + bounding boxes'}
                </p>
              </div>
              <button
                onClick={() => setUseLLM(!useLLM)}
                className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  useLLM ? 'bg-blue-600' : 'bg-gray-300'
                }`}
                disabled={loading}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    useLLM ? 'translate-x-9' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center justify-between border-l border-gray-200 pl-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">View Mode</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {viewMode === 'list'
                    ? '📋 List View: Compact table'
                    : '🎴 Grid View: Detailed cards'}
                </p>
              </div>
              <button
                onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                  viewMode === 'grid' ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    viewMode === 'grid' ? 'translate-x-9' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

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
            <ResultsTable results={results} onUpdate={handleUpdateResult} />
          ) : (
            <GridView results={results} onUpdate={handleUpdateResult} />
          )
        )}
      </div>
    </div>
  );
}

export default App;
