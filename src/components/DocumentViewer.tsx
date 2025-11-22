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
        // Backend now returns absolute URLs, use them directly
        console.log('Fetching file from:', fileUrl);
        
        const response = await fetch(fileUrl);
        
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 truncate">{fileName}</h2>
          </div>
          <div className="flex items-center gap-3">
            {isPDF && (
              <>
                {/* Zoom controls */}
                <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1 border border-gray-200">
                  <button
                    onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
                    className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors text-gray-700 font-bold"
                    title="Zoom out"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="text-sm font-medium min-w-[60px] text-center text-gray-700">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    onClick={() => setScale(s => Math.min(3, s + 0.25))}
                    className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors text-gray-700 font-bold"
                    title="Zoom in"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
                
                {/* Page navigation */}
                {numPages > 0 && (
                  <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1 border border-gray-200">
                    <button
                      onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                      disabled={pageNumber <= 1}
                      className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-700"
                      title="Previous page"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-sm font-medium min-w-[80px] text-center text-gray-700">
                      {pageNumber} / {numPages}
                    </span>
                    <button
                      onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                      disabled={pageNumber >= numPages}
                      className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-700"
                      title="Next page"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}
            
            <button
              onClick={onClose}
              className="btn px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 inline-flex items-center gap-2"
              title="Close viewer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100 p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="relative inline-flex mb-4">
                  <div className="absolute inset-0 rounded-full bg-blue-400 opacity-25 animate-ping"></div>
                  <div className="spinner w-16 h-16 border-4 border-blue-600"></div>
                </div>
                <p className="text-gray-600 font-medium">Loading document...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center bg-white rounded-xl p-8 shadow-md max-w-md">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-red-600 font-bold mb-2 text-lg">Failed to load file</p>
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
                    <div className="text-center">
                      <div className="spinner w-12 h-12 border-4 border-blue-600 mx-auto mb-3"></div>
                      <p className="text-gray-600 text-sm">Loading PDF...</p>
                    </div>
                  </div>
                }
                error={
                  <div className="flex items-center justify-center p-8">
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <p className="text-red-600 font-semibold">Failed to load PDF file.</p>
                    </div>
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
            <div className="flex justify-center items-center min-h-full">
              <div className="bg-white rounded-xl shadow-lg p-4 max-w-full">
                <img
                  src={actualUrl}
                  alt={fileName}
                  className="max-w-full h-auto rounded-lg"
                  style={{ transform: `scale(${scale})` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center bg-white rounded-xl p-8 shadow-md">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium">Unable to load file</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


