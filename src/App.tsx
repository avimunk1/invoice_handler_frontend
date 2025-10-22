import { useState } from 'react';
import FileUpload from './components/FileUpload';
import ResultsTable from './components/ResultsTable';
import { uploadFilesToS3, type UploadProgress } from './services/s3Upload';
import { processInvoices, processInvoicesWithLLM } from './api/client';
import type { InvoiceData } from './types/invoice';

function App() {
  const [results, setResults] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [useLLM, setUseLLM] = useState(true); // Default to LLM approach

  const handleFilesSelected = async (files: FileList | null, localPath?: string) => {
    setError(null);
    setLoading(true);
    setUploadProgress([]);

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

      // Process the folder/bucket with selected method
      const response = useLLM 
        ? await processInvoicesWithLLM({
            path: pathToProcess,
            recursive: false,
            language_detection: true,
          })
        : await processInvoices({
            path: pathToProcess,
            recursive: false,
            language_detection: true,
          });

      setResults(response.results);

      if (response.errors.length > 0) {
        setError(`Processing completed with ${response.errors.length} error(s)`);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Processing error:', err);
    } finally {
      setLoading(false);
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

        {/* Processing Method Toggle */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Processing Method</h3>
              <p className="text-sm text-gray-600 mt-1">
                {useLLM 
                  ? '🤖 LLM Mode: More flexible, better for receipts and Hebrew text'
                  : '⚡ Azure Mode: Faster, structured invoice extraction'}
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
            <p className="mt-4 text-gray-600">Processing invoices...</p>
          </div>
        )}

        {results.length > 0 && (
          <ResultsTable results={results} onUpdate={handleUpdateResult} />
        )}
      </div>
    </div>
  );
}

export default App;
