import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Configure PDF.js worker - use local copy
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface DocumentViewerProps {
  fileUrl: string | null;
  fileName: string;
  onClose: () => void;
}

export default function DocumentViewer({ fileUrl, fileName, onClose }: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [actualUrl, setActualUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileUrl) return;

    // Fetch the actual URL if it's an API endpoint
    const fetchUrl = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Fetching file from:', `http://localhost:8000${fileUrl}`);
        
        const response = await fetch(`http://localhost:8000${fileUrl}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        console.log('Content-Type:', contentType);
        
        if (contentType?.includes('application/json')) {
          // It's a JSON response with URL (S3 presigned URL)
          const data = await response.json();
          console.log('Got presigned URL:', data.url);
          setActualUrl(data.url);
        } else {
          // It's a direct file response (local file)
          const blob = await response.blob();
          console.log('Got blob, size:', blob.size, 'type:', blob.type);
          const blobUrl = URL.createObjectURL(blob);
          console.log('Created blob URL:', blobUrl);
          setActualUrl(blobUrl);
        }
      } catch (error) {
        console.error('Error fetching file:', error);
        setError(error instanceof Error ? error.message : 'Failed to load file');
      } finally {
        setLoading(false);
      }
    };

    fetchUrl();
    
    // Cleanup blob URL on unmount
    return () => {
      if (actualUrl && actualUrl.startsWith('blob:')) {
        URL.revokeObjectURL(actualUrl);
      }
    };
  }, [fileUrl]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  const isPDF = fileName.toLowerCase().endsWith('.pdf');

  if (!fileUrl) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full h-full max-w-7xl max-h-[95vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold truncate flex-1">{fileName}</h2>
          <div className="flex items-center gap-4">
            {isPDF && (
              <>
                {/* Zoom controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    −
                  </button>
                  <span className="text-sm min-w-[60px] text-center">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    onClick={() => setScale(s => Math.min(3, s + 0.25))}
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    +
                  </button>
                </div>
                
                {/* Page navigation */}
                {numPages > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                      disabled={pageNumber <= 1}
                      className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                    >
                      ◄
                    </button>
                    <span className="text-sm min-w-[80px] text-center">
                      {pageNumber} / {numPages}
                    </span>
                    <button
                      onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                      disabled={pageNumber >= numPages}
                      className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                    >
                      ►
                    </button>
                  </div>
                )}
              </>
            )}
            
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-red-600 font-semibold mb-2">Failed to load file</p>
                <p className="text-gray-600 text-sm">{error}</p>
              </div>
            </div>
          ) : isPDF && actualUrl ? (
            <div className="flex justify-center">
              <Document
                file={actualUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(error) => {
                  console.error('PDF load error:', error);
                  setError(`Failed to load PDF: ${error.message}`);
                }}
                loading={
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                }
                error={
                  <div className="flex items-center justify-center p-8">
                    <p className="text-red-600">Failed to load PDF file.</p>
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>
            </div>
          ) : actualUrl ? (
            // For images
            <div className="flex justify-center">
              <img
                src={actualUrl}
                alt={fileName}
                className="max-w-full h-auto"
                style={{ transform: `scale(${scale})` }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-600">Unable to load file</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


