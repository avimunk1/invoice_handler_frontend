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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">Invoice Reports</h1>
          <p className="text-lg text-gray-600">Filter, analyze, and export your invoice data</p>
        </header>

        {/* Filters Section */}
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Filters</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Customer Dropdown */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Customer *
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
                className="select"
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input"
              />
            </div>

            {/* Apply Button */}
            <div className="flex items-end">
              <button
                onClick={handleApplyFilters}
                disabled={!selectedCustomerId || loading}
                className="btn btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="spinner w-5 h-5 border-2"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Apply Filters
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Status Checkboxes */}
          <div className="border-t border-gray-200 pt-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Filter by Status (optional)
            </label>
            <div className="flex flex-wrap gap-3">
              {STATUS_OPTIONS.map(status => (
                <label 
                  key={status} 
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                    selectedStatuses.has(status)
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedStatuses.has(status)}
                    onChange={() => handleStatusToggle(status)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium capitalize">{status}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 shadow-sm flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Results Section */}
        {invoices.length > 0 && (
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-200">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Results</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-semibold text-blue-700">{invoices.length}</span> invoice{invoices.length !== 1 ? 's' : ''} found
                      {selectedInvoiceIds.size > 0 && (
                        <>
                          <span className="text-gray-400 mx-2">•</span>
                          <span className="font-semibold text-blue-700">{selectedInvoiceIds.size}</span> selected
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleExport}
                  disabled={exporting || invoices.length === 0}
                  className="btn btn-success inline-flex items-center gap-2 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? (
                    <>
                      <div className="spinner w-5 h-5 border-2"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export to Excel
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table text-sm">
                <thead className="table-header">
                  <tr>
                    <th className="px-6 py-4 text-center font-semibold text-gray-700 w-16">
                      <input
                        type="checkbox"
                        checked={selectedInvoiceIds.size === invoices.length && invoices.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700">Invoice Date</th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700">Invoice #</th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700">Supplier Name</th>
                    <th className="px-6 py-4 text-right font-semibold text-gray-700">Amount</th>
                    <th className="px-6 py-4 text-right font-semibold text-gray-700">VAT</th>
                    <th className="px-6 py-4 text-right font-semibold text-gray-700">Total Amount</th>
                    <th className="px-6 py-4 text-center font-semibold text-gray-700">Currency</th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700">Doc Name</th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="table-row">
                      <td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedInvoiceIds.has(invoice.id)}
                          onChange={() => handleSelectInvoice(invoice.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 text-gray-900">{invoice.invoice_date}</td>
                      <td className="px-6 py-4 font-semibold text-blue-600">{invoice.invoice_number}</td>
                      <td className="px-6 py-4 text-gray-900">{invoice.supplier_name}</td>
                      <td className="px-6 py-4 text-right text-gray-900 font-mono">
                        {invoice.subtotal.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-900 font-mono">
                        {invoice.vat_amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-900 font-mono font-bold">
                        {invoice.total.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="badge badge-info">{invoice.currency}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm">
                        <div className="max-w-[200px] truncate" title={invoice.doc_name || ''}>
                          {invoice.doc_name || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge ${
                          invoice.status === 'approved'
                            ? 'badge-success'
                            : invoice.status === 'exported'
                            ? 'badge-info'
                            : invoice.status === 'rejected'
                            ? 'badge-error'
                            : 'badge-warning'
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

