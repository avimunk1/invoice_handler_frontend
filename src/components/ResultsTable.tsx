import { useState } from 'react';
import type { InvoiceData } from '../types/invoice';
import DocumentViewer from './DocumentViewer';

interface ResultsTableProps {
  results: InvoiceData[];
  onUpdate: (index: number, field: keyof InvoiceData, value: any) => void;
  viewMode?: 'list' | 'grid';
  onChangeView?: (mode: 'list' | 'grid') => void;
}

// Helper function to get confidence background color
function getConfidenceBgColor(confidence?: number): string {
  if (confidence === undefined || confidence === null) return '';
  if (confidence >= 0.9) return 'bg-green-50';
  if (confidence >= 0.7) return 'bg-yellow-50';
  return 'bg-red-50';
}

export default function ResultsTable({ results, onUpdate, viewMode = 'list', onChangeView }: ResultsTableProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; field: keyof InvoiceData } | null>(null);
  const [viewingDoc, setViewingDoc] = useState<{ url: string; name: string } | null>(null);

  if (results.length === 0) {
    return null;
  }

  const handleCellClick = (row: number, field: keyof InvoiceData) => {
    setEditingCell({ row, field });
  };

  const handleCellBlur = (row: number, field: keyof InvoiceData, value: string) => {
    // Convert value based on field type
    let convertedValue: any = value;
    
    if (['subtotal', 'tax_amount', 'total', 'confidence'].includes(field)) {
      convertedValue = value ? parseFloat(value) : undefined;
    }
    
    onUpdate(row, field, convertedValue);
    setEditingCell(null);
  };

  const renderCell = (row: number, field: keyof InvoiceData, value: any) => {
    const isEditing = editingCell?.row === row && editingCell?.field === field;
    const isHebrew = results[row].language === 'he';
    const confidence = results[row].field_confidence?.[field];
    const bgColor = getConfidenceBgColor(confidence);
    
    if (isEditing) {
      if (field === 'status') {
        return (
          <select
            autoFocus
            defaultValue={value ?? 'pending'}
            onBlur={(e) => handleCellBlur(row, field, e.target.value)}
            onChange={(e) => handleCellBlur(row, field, e.target.value)}
            className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none bg-white"
          >
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="exported">exported</option>
            <option value="rejected">rejected</option>
          </select>
        );
      }
      return (
        <input
          type="text"
          defaultValue={value ?? ''}
          autoFocus
          onBlur={(e) => handleCellBlur(row, field, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none"
          dir={isHebrew ? 'rtl' : 'ltr'}
        />
      );
    }

    return (
      <div
        onClick={() => handleCellClick(row, field)}
        className={`cursor-pointer px-2 py-1 hover:bg-gray-100 rounded min-h-[2rem] ${bgColor}`}
        dir={isHebrew ? 'rtl' : 'ltr'}
        title={confidence !== undefined ? `Confidence: ${(confidence * 100).toFixed(1)}%` : undefined}
      >
        {value ?? '-'}
      </div>
    );
  };

  return (
    <>
      <div className="w-full mt-8 p-6 bg-white rounded-lg shadow-md overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Processing Results</h2>
            <p className="text-sm text-gray-600 mt-1">Click on any cell to edit • Hover over cells to see confidence</p>
            {/* Confidence Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs">
              <span className="font-medium text-gray-600">Cell Colors:</span>
              <div className="flex items-center gap-1">
                <div className="w-12 h-4 bg-green-50 border border-green-200 rounded"></div>
                <span className="text-gray-500">≥90%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-12 h-4 bg-yellow-50 border border-yellow-200 rounded"></div>
                <span className="text-gray-500">70-89%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-12 h-4 bg-red-50 border border-red-200 rounded"></div>
                <span className="text-gray-500">&lt;70%</span>
              </div>
            </div>
          </div>
          {/* View mode icons */}
          {onChangeView && (
            <div className="flex items-center gap-2 text-gray-500">
              <button
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-gray-200 text-gray-900' : 'hover:bg-gray-100'}`}
                title="List view"
                onClick={() => onChangeView('list')}
              >
                📋
              </button>
              <button
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-200 text-gray-900' : 'hover:bg-gray-100'}`}
                title="Grid view"
                onClick={() => onChangeView('grid')}
              >
                🎴
              </button>
            </div>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-center font-medium text-gray-700 w-24">Preview</th>
                <th className="px-6 py-3 text-left font-medium text-gray-700 w-48">File Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-24">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-20">Lang</th>
                <th className="px-6 py-3 text-left font-medium text-gray-700 min-w-[250px]">Supplier</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-28">Supplier ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-36">Invoice #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-28">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-28">Due</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-32">Terms</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-28">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-20">Currency</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700 w-28">Subtotal</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700 w-28">Tax</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700 w-28">Total</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700 w-24">Action</th>
              </tr>
            </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {results.map((invoice, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center">
                    <div className="w-16 h-20 bg-gray-200 rounded border border-gray-300 flex items-center justify-center text-xs text-gray-600 overflow-hidden">
                      {invoice.file_name.toLowerCase().endsWith('.pdf') ? (
                        <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 18h12V6h-4V2H4v16zm-2 1V0h12l4 4v16H2v-1z"/>
                          <text x="10" y="14" fontSize="6" textAnchor="middle" fill="currentColor">PDF</text>
                        </svg>
                      ) : invoice.file_name.toLowerCase().match(/\.(png|jpg|jpeg|gif|webp)$/) ? (
                        <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
                        </svg>
                      ) : (
                        <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3 text-sm font-medium text-gray-900">
                  <div className="max-w-[180px] truncate" title={invoice.file_name}>
                    {invoice.file_name}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                    invoice.document_type === 'invoice' 
                      ? 'bg-green-100 text-green-800'
                      : invoice.document_type === 'receipt'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {invoice.document_type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                    {invoice.language.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-3">{renderCell(idx, 'supplier_name', invoice.supplier_name)}</td>
                <td className="px-4 py-3 text-gray-600">{(invoice as any).supplier_id ?? '-'}</td>
                <td className="px-4 py-3">
                  {renderCell(idx, 'invoice_number', invoice.invoice_number)}
                </td>
                <td className="px-4 py-3">{renderCell(idx, 'invoice_date', invoice.invoice_date)}</td>
                <td className="px-4 py-3">{renderCell(idx, 'due_date', invoice.due_date)}</td>
                <td className="px-4 py-3">{renderCell(idx, 'payment_terms', invoice.payment_terms)}</td>
                <td className="px-4 py-3">{renderCell(idx, 'status', invoice.status ?? 'pending')}</td>
                <td className="px-4 py-3">
                  {renderCell(idx, 'currency', invoice.currency)}
                </td>
                <td className="px-4 py-3 text-right">
                  {renderCell(idx, 'subtotal', invoice.subtotal?.toFixed(2))}
                </td>
                <td className="px-4 py-3 text-right">
                  {renderCell(idx, 'tax_amount', invoice.tax_amount?.toFixed(2))}
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {renderCell(idx, 'total', invoice.total?.toFixed(2))}
                </td>
                <td className="px-4 py-3 text-center">
                  {invoice.file_url && (
                    <button
                      onClick={() => setViewingDoc({ url: invoice.file_url!, name: invoice.file_name })}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      VIEW
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        Processed {results.length} document{results.length !== 1 ? 's' : ''}
      </div>
    </div>

    {/* Document Viewer Modal */}
      {viewingDoc && (
        <DocumentViewer
          fileUrl={viewingDoc.url}
          fileName={viewingDoc.name}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </>
  );
}

