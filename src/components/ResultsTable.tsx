import { useState } from 'react';
import type { InvoiceData } from '../types/invoice';
import DocumentViewer from './DocumentViewer';

interface ResultsTableProps {
  results: InvoiceData[];
  onUpdate: (index: number, field: keyof InvoiceData, value: any) => void;
}

export default function ResultsTable({ results, onUpdate }: ResultsTableProps) {
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
    
    if (isEditing) {
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
        className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded min-h-[2rem]"
        dir={isHebrew ? 'rtl' : 'ltr'}
      >
        {value ?? '-'}
      </div>
    );
  };

  return (
    <>
      <div className="w-full mt-8 p-6 bg-white rounded-lg shadow-md overflow-x-auto">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Processing Results</h2>
        <p className="text-sm text-gray-600 mb-4">Click on any cell to edit</p>
        
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-center font-medium text-gray-700 w-24">Preview</th>
                <th className="px-6 py-3 text-left font-medium text-gray-700 w-48">File Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-24">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-20">Lang</th>
                <th className="px-6 py-3 text-left font-medium text-gray-700 min-w-[250px]">Supplier</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-36">Invoice #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 w-28">Date</th>
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
                <td className="px-6 py-3">
                  {renderCell(idx, 'supplier_name', invoice.supplier_name)}
                </td>
                <td className="px-4 py-3">
                  {renderCell(idx, 'invoice_number', invoice.invoice_number)}
                </td>
                <td className="px-4 py-3">
                  {renderCell(idx, 'invoice_date', invoice.invoice_date)}
                </td>
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

