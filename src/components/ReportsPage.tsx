import { useState, useEffect } from 'react';
import { fetchCustomers, fetchInvoicesReport, exportInvoices } from '../api/client';
import type { Customer, InvoiceReportRecord } from '../types/invoice';

const STATUS_OPTIONS = ['pending', 'approved', 'exported', 'rejected'];

export default function ReportsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [invoices, setInvoices] = useState<InvoiceReportRecord[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Fetch customers on mount
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const data = await fetchCustomers();
        setCustomers(data);
      } catch (err) {
        console.error('Failed to fetch customers:', err);
        setError('Failed to load customers');
      }
    };
    loadCustomers();
  }, []);

  const handleApplyFilters = async () => {
    if (!selectedCustomerId) {
      setError('Please select a customer');
      return;
    }

    setLoading(true);
    setError(null);
    setInvoices([]);
    setSelectedInvoiceIds(new Set());

    try {
      const filters = {
        customer_id: Number(selectedCustomerId),
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        status: selectedStatuses.size > 0 ? Array.from(selectedStatuses).join(',') : undefined
      };

      const data = await fetchInvoicesReport(filters);
      setInvoices(data);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = (status: string) => {
    setSelectedStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedInvoiceIds.size === invoices.length) {
      setSelectedInvoiceIds(new Set());
    } else {
      setSelectedInvoiceIds(new Set(invoices.map(inv => inv.id)));
    }
  };

  const handleSelectInvoice = (id: number) => {
    setSelectedInvoiceIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleExport = async () => {
    if (!selectedCustomerId) {
      setError('Please select a customer');
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const payload = {
        customer_id: Number(selectedCustomerId),
        invoice_ids: selectedInvoiceIds.size > 0 ? Array.from(selectedInvoiceIds) : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        status: selectedStatuses.size > 0 ? Array.from(selectedStatuses).join(',') : undefined
      };

      const blob = await exportInvoices(payload);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export invoices:', err);
      setError(err instanceof Error ? err.message : 'Failed to export invoices');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-[1800px] mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Invoice Reports</h1>
          <p className="text-gray-600 mt-2">Filter and export invoice data</p>
        </header>

        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Filters</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Customer Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer *
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select customer...</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Apply Button */}
            <div className="flex items-end">
              <button
                onClick={handleApplyFilters}
                disabled={!selectedCustomerId || loading}
                className={`w-full px-4 py-2 rounded-md text-white font-medium ${
                  !selectedCustomerId || loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {loading ? 'Loading...' : 'Apply Filters'}
              </button>
            </div>
          </div>

          {/* Status Checkboxes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-3">
              {STATUS_OPTIONS.map(status => (
                <label key={status} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.has(status)}
                    onChange={() => handleStatusToggle(status)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 capitalize">{status}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Results Section */}
        {invoices.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Results</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} found
                    {selectedInvoiceIds.size > 0 && ` • ${selectedInvoiceIds.size} selected`}
                  </p>
                </div>
                <button
                  onClick={handleExport}
                  disabled={exporting || invoices.length === 0}
                  className={`px-6 py-2 rounded-md text-white font-medium ${
                    exporting || invoices.length === 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {exporting ? 'Exporting...' : 'Export to Excel'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-center font-medium text-gray-700 w-16">
                      <input
                        type="checkbox"
                        checked={selectedInvoiceIds.size === invoices.length && invoices.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Invoice Date</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Invoice #</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Supplier Name</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Amount</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">VAT</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Total Amount</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-700">Currency</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Doc Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedInvoiceIds.has(invoice.id)}
                          onChange={() => handleSelectInvoice(invoice.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-900">{invoice.invoice_date}</td>
                      <td className="px-4 py-3 text-gray-900">{invoice.invoice_number}</td>
                      <td className="px-4 py-3 text-gray-900">{invoice.supplier_name}</td>
                      <td className="px-4 py-3 text-right text-gray-900 font-mono">
                        {invoice.subtotal.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-mono">
                        {invoice.vat_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-mono font-semibold">
                        {invoice.total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700 font-medium">
                        {invoice.currency}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs">
                        <div className="max-w-[200px] truncate" title={invoice.doc_name || ''}>
                          {invoice.doc_name || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                          invoice.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : invoice.status === 'exported'
                            ? 'bg-blue-100 text-blue-800'
                            : invoice.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No Results */}
        {!loading && invoices.length === 0 && selectedCustomerId && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
            <p className="text-gray-600">Try adjusting your filters or date range</p>
          </div>
        )}
      </div>
    </div>
  );
}

