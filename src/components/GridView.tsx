import { useState, useEffect, Component, type ErrorInfo } from 'react';
import type { InvoiceData, BoundingBox } from '../types/invoice';
import { Document, Page, pdfjs } from 'react-pdf';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// Error boundary for PDF rendering
class PDFErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('PDF Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full bg-gray-100">
          <div className="text-center">
            <p className="text-red-600 text-sm mb-2">PDF Preview Error</p>
            <p className="text-gray-500 text-xs">Unable to display preview</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface GridViewProps {
  results: InvoiceData[];
  onUpdate: (index: number, field: keyof InvoiceData, value: any) => void;
}

interface DocumentPreviewProps {
  fileUrl: string;
  fileName: string;
  boundingBoxes?: Record<string, BoundingBox>;
  selectedField?: string | null;
  onFieldClick?: (field: string) => void;
  fieldConfidence?: Record<string, number>;
}

// Field color mapping for bounding boxes
const FIELD_COLORS: Record<string, string> = {
  supplier_name: '#22c55e',    // Green
  invoice_number: '#3b82f6',   // Blue
  invoice_date: '#a855f7',     // Purple
  currency: '#f97316',         // Orange
  subtotal: '#ef4444',         // Red
  tax_amount: '#ef4444',       // Red
  total: '#dc2626',            // Dark Red
};

const FIELD_LABELS: Record<string, string> = {
  supplier_name: 'Supplier',
  invoice_number: 'Invoice #',
  invoice_date: 'Date',
  currency: 'Currency',
  subtotal: 'Subtotal',
  tax_amount: 'Tax',
  total: 'Total',
};

// Helper function to get confidence level and color
function getConfidenceLevel(confidence?: number): { level: 'high' | 'medium' | 'low' | 'none'; color: string; bgColor: string; borderColor: string } {
  if (confidence === undefined || confidence === null) {
    return { level: 'none', color: 'text-gray-500', bgColor: 'bg-gray-100', borderColor: '#9ca3af' };
  }
  if (confidence >= 0.9) {
    return { level: 'high', color: 'text-green-700', bgColor: 'bg-green-100', borderColor: '#22c55e' };
  }
  if (confidence >= 0.7) {
    return { level: 'medium', color: 'text-yellow-700', bgColor: 'bg-yellow-100', borderColor: '#f59e0b' };
  }
  return { level: 'low', color: 'text-red-700', bgColor: 'bg-red-100', borderColor: '#ef4444' };
}

function BoundingBoxOverlay({
  boundingBoxes,
  currentPage,
  pageWidth,
  pageHeight,
  scale,
  selectedField,
  fieldConfidence,
}: {
  boundingBoxes?: Record<string, BoundingBox>;
  currentPage: number;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  selectedField?: string | null;
  fieldConfidence?: Record<string, number>;
}) {
  if (!boundingBoxes || !pageWidth || !pageHeight) {
    return null;
  }

  // Calculate rendered dimensions (PDF displayed at 600px base width * zoom scale)
  const renderedWidth = 600 * scale;
  const renderedHeight = (pageHeight / pageWidth) * renderedWidth;

  const transformCoordinates = (polygon: number[][]): string => {
    // Normalized coordinates (0-1) to screen pixels
    return polygon
      .map(([x, y]) => `${x * renderedWidth},${y * renderedHeight}`)
      .join(' ');
  };
  
  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      style={{ 
        width: renderedWidth, 
        height: renderedHeight
      }}
    >
      {Object.entries(boundingBoxes).map(([fieldName, bbox]) => {
        if (bbox.page_number !== currentPage) {
          return null;
        }

        // Use confidence-based color if available, otherwise use field-specific color
        const confidence = fieldConfidence?.[fieldName];
        const confidenceInfo = getConfidenceLevel(confidence);
        const color = confidence !== undefined ? confidenceInfo.borderColor : (FIELD_COLORS[fieldName] || '#6b7280');
        const isSelected = selectedField === fieldName;
        const points = transformCoordinates(bbox.polygon);

        return (
          <g key={fieldName}>
            <polygon
              points={points}
              fill={isSelected ? `${color}40` : `${color}20`}
              stroke={color}
              strokeWidth={isSelected ? 3 : 2}
              className="transition-all duration-200"
            />
            {isSelected && (
              <text
                x={bbox.polygon[0][0] * renderedWidth}
                y={bbox.polygon[0][1] * renderedHeight - 5}
                fill={color}
                fontSize="12"
                fontWeight="bold"
                className="drop-shadow"
              >
                {FIELD_LABELS[fieldName] || fieldName}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function DocumentPreview({ fileUrl, fileName, boundingBoxes, selectedField, onFieldClick, fieldConfidence }: DocumentPreviewProps) {
  const [actualUrl, setActualUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [pageHeight, setPageHeight] = useState<number>(0);

  useEffect(() => {
    if (!fileUrl) return;

    let isMounted = true;
    let blobUrl: string | null = null;

    const fetchUrl = async () => {
      try {
        if (!isMounted) return;
        setLoading(true);
        setError(null);
        
        const response = await fetch(`http://localhost:8000${fileUrl}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch file`);
        }
        
        const contentType = response.headers.get('content-type');
        
        if (!isMounted) return;
        
        if (contentType?.includes('application/json')) {
          const data = await response.json();
          if (isMounted) {
            setActualUrl(data.url);
          }
        } else {
          const blob = await response.blob();
          blobUrl = URL.createObjectURL(blob);
          if (isMounted) {
            setActualUrl(blobUrl);
          }
        }
      } catch (error) {
        console.error('Error fetching file:', error);
        if (isMounted) {
          setError(error instanceof Error ? error.message : 'Failed to load file');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchUrl();
    
    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [fileUrl]);

  // Auto-navigate to page when field is selected
  useEffect(() => {
    if (selectedField && boundingBoxes && boundingBoxes[selectedField]) {
      const bbox = boundingBoxes[selectedField];
      if (bbox.page_number !== currentPage) {
        setCurrentPage(bbox.page_number);
      }
    }
  }, [selectedField, boundingBoxes, currentPage]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setCurrentPage(1);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error);
    setError('Failed to load PDF');
  };

  const onPageLoadSuccess = (page: any) => {
    const { width, height } = page;
    setPageWidth(width);
    setPageHeight(height);
  };

  const isPDF = fileName.toLowerCase().endsWith('.pdf');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <p className="text-red-600 text-sm">Failed to load preview</p>
      </div>
    );
  }

  if (isPDF && actualUrl) {
    return (
      <div className="flex flex-col h-full bg-gray-100">
        {/* Controls */}
        <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200">
          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
              title="Zoom Out"
            >
              −
            </button>
            <span className="text-xs min-w-[50px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(s => Math.min(3, s + 0.25))}
              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
              title="Zoom In"
            >
              +
            </button>
            <button
              onClick={() => setScale(1.0)}
              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 text-xs"
              title="Reset Zoom"
            >
              Reset
            </button>
          </div>

          {/* Page navigation */}
          {numPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                ◄
              </button>
              <span className="text-xs">
                Page {currentPage} of {numPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                disabled={currentPage >= numPages}
                className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                ►
              </button>
            </div>
          )}
        </div>

        {/* Document viewer */}
        <div className="flex-1 overflow-auto p-4">
          <PDFErrorBoundary>
            <div className="flex justify-center">
              <div className="relative inline-block">
                <Document
                  file={actualUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  }
                  error={
                    <div className="text-center">
                      <p className="text-red-600 text-sm mb-2">Failed to load PDF</p>
                      <p className="text-gray-500 text-xs">Preview unavailable</p>
                    </div>
                  }
                  key={actualUrl}
                >
                  <Page
                    pageNumber={currentPage}
                    width={600 * scale}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onLoadSuccess={onPageLoadSuccess}
                    loading={
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    }
                    error={
                      <div className="text-center">
                        <p className="text-red-600 text-sm">Page load error</p>
                      </div>
                    }
                  />
                </Document>
                {/* Bounding box overlay - positioned absolutely over the PDF page */}
                <BoundingBoxOverlay
                  boundingBoxes={boundingBoxes}
                  currentPage={currentPage}
                  pageWidth={pageWidth}
                  pageHeight={pageHeight}
                  scale={scale}
                  selectedField={selectedField}
                  fieldConfidence={fieldConfidence}
                />
              </div>
            </div>
          </PDFErrorBoundary>
        </div>
      </div>
    );
  }

  if (actualUrl) {
    return (
      <div className="flex flex-col h-full bg-gray-100">
        {/* Controls for images */}
        <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
            >
              −
            </button>
            <span className="text-xs min-w-[50px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(s => Math.min(3, s + 0.25))}
              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
            >
              +
            </button>
            <button
              onClick={() => setScale(1.0)}
              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 text-xs"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="flex justify-center">
            <img
              src={actualUrl}
              alt={fileName}
              className="max-w-full h-auto"
              style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full bg-gray-100">
      <p className="text-gray-600 text-sm">No preview available</p>
    </div>
  );
}

export default function GridView({ results, onUpdate }: GridViewProps) {
  const [editingCell, setEditingCell] = useState<{ index: number; field: keyof InvoiceData } | null>(null);
  const [selectedFields, setSelectedFields] = useState<Record<number, string | null>>({});

  if (results.length === 0) {
    return null;
  }

  const handleCellClick = (index: number, field: keyof InvoiceData) => {
    setEditingCell({ index, field });
  };

  const handleCellBlur = (index: number, field: keyof InvoiceData, value: string) => {
    let convertedValue: any = value;
    
    if (['subtotal', 'tax_amount', 'total', 'confidence'].includes(field)) {
      convertedValue = value ? parseFloat(value) : undefined;
    }
    
    onUpdate(index, field, convertedValue);
    setEditingCell(null);
  };

  const handleFieldHighlight = (index: number, field: string) => {
    // Toggle: if already selected, deselect; otherwise select
    setSelectedFields(prev => ({
      ...prev,
      [index]: prev[index] === field ? null : field,
    }));
  };

  const renderField = (index: number, field: keyof InvoiceData, label: string, value: any, hasBox: boolean = false) => {
    const isEditing = editingCell?.index === index && editingCell?.field === field;
    const isHebrew = results[index].language === 'he';
    const isSelected = selectedFields[index] === field;
    const confidence = results[index].field_confidence?.[field];
    const confidenceInfo = getConfidenceLevel(confidence);
    
    return (
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center justify-between">
          <span>{label}</span>
          <div className="flex items-center gap-2">
            {confidence !== undefined && (
              <span 
                className={`text-xs px-2 py-0.5 rounded ${confidenceInfo.bgColor} ${confidenceInfo.color} font-medium`}
                title={`Confidence: ${(confidence * 100).toFixed(1)}%`}
              >
                {(confidence * 100).toFixed(0)}%
              </span>
            )}
            {hasBox && (
              <button
                onClick={() => handleFieldHighlight(index, field)}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${
                  isSelected
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
                title="Highlight on document"
              >
                👁
              </button>
            )}
          </div>
        </label>
        {isEditing ? (
          <input
            type="text"
            defaultValue={value ?? ''}
            autoFocus
            onBlur={(e) => handleCellBlur(index, field, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            className="w-full px-3 py-2 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            dir={isHebrew ? 'rtl' : 'ltr'}
          />
        ) : (
          <div
            onClick={() => handleCellClick(index, field)}
            className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded cursor-pointer min-h-[2.5rem] flex items-center"
            dir={isHebrew ? 'rtl' : 'ltr'}
          >
            {value ?? '-'}
          </div>
        )}
        {confidence !== undefined && confidence < 0.7 && (
          <p className="text-xs text-red-600 mt-1">⚠️ Low confidence - please verify</p>
        )}
      </div>
    );
  };

  return (
    <div className="w-full mt-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Processing Results</h2>
          <p className="text-sm text-gray-600 mt-1">Click on any field to edit • Click 👁 to highlight on document</p>
          
          {/* Confidence Legend */}
          <div className="flex items-center gap-4 mt-3 text-xs">
            <span className="font-medium text-gray-600">Confidence:</span>
            <div className="flex items-center gap-1">
              <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">≥90%</span>
              <span className="text-gray-500">High</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium">70-89%</span>
              <span className="text-gray-500">Medium</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">&lt;70%</span>
              <span className="text-gray-500">Low</span>
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          {results.length} document{results.length !== 1 ? 's' : ''}
        </div>
      </div>

      {results.map((invoice, idx) => {
        const boundingBoxes = invoice.bounding_boxes;
        const hasBoundingBoxes = boundingBoxes && Object.keys(boundingBoxes).length > 0;
        
        return (
          <div key={idx} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[35%_65%] gap-0">
              {/* Left side: Invoice data */}
              <div className="p-6 border-r border-gray-200 overflow-y-auto max-h-[800px]">
                {/* Header with file info */}
                <div className="mb-6 pb-4 border-b border-gray-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-gray-900 truncate mb-2" title={invoice.file_name}>
                        {invoice.file_name}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          invoice.document_type === 'invoice' 
                            ? 'bg-green-100 text-green-800'
                            : invoice.document_type === 'receipt'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {invoice.document_type}
                        </span>
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                          {invoice.language.toUpperCase()}
                        </span>
                        {invoice.page_count && invoice.page_count > 1 && (
                          <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs font-medium">
                            {invoice.page_count} pages
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {!hasBoundingBoxes && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                    💡 Bounding boxes not available for this document
                  </div>
                )}

                {/* Invoice fields */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    {renderField(
                      idx,
                      'supplier_name',
                      'Supplier Name',
                      invoice.supplier_name,
                      !!(boundingBoxes?.supplier_name)
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      {renderField(
                        idx,
                        'invoice_number',
                        'Invoice Number',
                        invoice.invoice_number,
                        !!(boundingBoxes?.invoice_number)
                      )}
                      {renderField(
                        idx,
                        'invoice_date',
                        'Invoice Date',
                        invoice.invoice_date,
                        !!(boundingBoxes?.invoice_date)
                      )}
                    </div>
                    
                    {renderField(
                      idx,
                      'currency',
                      'Currency',
                      invoice.currency,
                      !!(boundingBoxes?.currency)
                    )}
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center justify-between">
                          <span>Subtotal</span>
                          {boundingBoxes?.subtotal && (
                            <button
                              onClick={() => handleFieldHighlight(idx, 'subtotal')}
                              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                selectedFields[idx] === 'subtotal'
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                              title="Highlight on document"
                            >
                              👁
                            </button>
                          )}
                        </label>
                        {editingCell?.index === idx && editingCell?.field === 'subtotal' ? (
                          <input
                            type="text"
                            defaultValue={invoice.subtotal ?? ''}
                            autoFocus
                            onBlur={(e) => handleCellBlur(idx, 'subtotal', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            className="w-full px-3 py-2 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <div
                            onClick={() => handleCellClick(idx, 'subtotal')}
                            className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded cursor-pointer min-h-[2.5rem] flex items-center justify-end font-mono"
                          >
                            {invoice.subtotal?.toFixed(2) ?? '-'}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center justify-between">
                          <span>Tax</span>
                          {boundingBoxes?.tax_amount && (
                            <button
                              onClick={() => handleFieldHighlight(idx, 'tax_amount')}
                              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                selectedFields[idx] === 'tax_amount'
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                              title="Highlight on document"
                            >
                              👁
                            </button>
                          )}
                        </label>
                        {editingCell?.index === idx && editingCell?.field === 'tax_amount' ? (
                          <input
                            type="text"
                            defaultValue={invoice.tax_amount ?? ''}
                            autoFocus
                            onBlur={(e) => handleCellBlur(idx, 'tax_amount', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            className="w-full px-3 py-2 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <div
                            onClick={() => handleCellClick(idx, 'tax_amount')}
                            className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded cursor-pointer min-h-[2.5rem] flex items-center justify-end font-mono"
                          >
                            {invoice.tax_amount?.toFixed(2) ?? '-'}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center justify-between">
                          <span>Total</span>
                          {boundingBoxes?.total && (
                            <button
                              onClick={() => handleFieldHighlight(idx, 'total')}
                              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                selectedFields[idx] === 'total'
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                              title="Highlight on document"
                            >
                              👁
                            </button>
                          )}
                        </label>
                        {editingCell?.index === idx && editingCell?.field === 'total' ? (
                          <input
                            type="text"
                            defaultValue={invoice.total ?? ''}
                            autoFocus
                            onBlur={(e) => handleCellBlur(idx, 'total', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            className="w-full px-3 py-2 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <div
                            onClick={() => handleCellClick(idx, 'total')}
                            className="w-full px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded cursor-pointer min-h-[2.5rem] flex items-center justify-end font-mono font-semibold text-blue-900"
                          >
                            {invoice.total?.toFixed(2) ?? '-'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right side: Document preview */}
              <div className="bg-gray-50 h-[800px] flex items-center justify-center">
                {invoice.file_url ? (
                  <DocumentPreview
                    fileUrl={invoice.file_url}
                    fileName={invoice.file_name}
                    boundingBoxes={boundingBoxes}
                    selectedField={selectedFields[idx]}
                    onFieldClick={(field) => handleFieldHighlight(idx, field)}
                    fieldConfidence={invoice.field_confidence}
                  />
                ) : (
                  <div className="text-gray-400 text-center">
                    <svg className="w-16 h-16 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/>
                    </svg>
                    <p className="text-sm">No preview available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
