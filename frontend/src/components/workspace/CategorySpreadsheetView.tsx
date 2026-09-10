'use client';

import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Search, 
  Download, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  ExternalLink, 
  MoreVertical,
  Layers,
  Filter,
  RefreshCw,
  Hash
} from 'lucide-react';
import { DocumentItem } from '@/types';

interface CategorySpreadsheetViewProps {
  documents: DocumentItem[];
  selectedCategory: string | null;
  onSelectCategory: (cat: string | null) => void;
  onOpenDocDrawer: (doc: DocumentItem) => void;
  renderThreeDotsMenu?: (doc: DocumentItem, stopProp: boolean) => React.ReactNode;
}

type SortField = 'row' | 'identifier' | 'date' | 'party' | 'taxable' | 'tax' | 'total' | 'status';
type SortDirection = 'asc' | 'desc';

export const CategorySpreadsheetView: React.FC<CategorySpreadsheetViewProps> = ({
  documents,
  selectedCategory,
  onSelectCategory,
  onOpenDocDrawer,
  renderThreeDotsMenu,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(
    documents.length > 0 ? documents[0].id : null
  );
  const [sortField, setSortField] = useState<SortField>('row');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  // Format currency
  const formatINR = (val: any): string => {
    if (val === undefined || val === null || val === '') return '—';
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Helper to extract fields safely
  const getDocData = (doc: DocumentItem) => {
    const data = doc.extracted_data || {};
    const cat = selectedCategory || doc.document_type;

    const invNum = data.invoice_number || data.receipt_number || data.identifier || data.bill_no || doc.original_filename;
    const invDate = data.invoice_date || data.date || data.txn_date || data.statement_period || '—';
    const party = data.seller_name || data.vendor_name || data.customer_name || data.merchant_name || data.bank_name || data.party_name || '—';
    const gstin = data.seller_gstin || data.vendor_gstin || data.customer_gstin || data.merchant_gstin || data.party_tax_id || '—';
    const taxable = data.taxable_amount ?? data.subtotal ?? (data.opening_balance !== undefined ? data.opening_balance : null);
    const tax = data.tax_total ?? data.tax ?? (data.closing_balance !== undefined ? data.closing_balance : null);
    const total = data.grand_total ?? data.total ?? data.invoice_total ?? (data.closing_balance !== undefined ? data.closing_balance : 0);

    return { invNum, invDate, party, gstin, taxable, tax, total, raw: data };
  };

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const q = searchTerm.toLowerCase();
      if (!q) return true;
      const { invNum, party, gstin } = getDocData(doc);
      return (
        doc.original_filename.toLowerCase().includes(q) ||
        String(invNum).toLowerCase().includes(q) ||
        String(party).toLowerCase().includes(q) ||
        String(gstin).toLowerCase().includes(q)
      );
    });
  }, [documents, searchTerm, selectedCategory]);

  // Sorted documents
  const sortedDocs = useMemo(() => {
    const items = [...filteredDocs];
    if (sortField === 'row') {
      return sortDir === 'asc' ? items : items.reverse();
    }

    return items.sort((a, b) => {
      const aData = getDocData(a);
      const bData = getDocData(b);
      let comp = 0;

      if (sortField === 'identifier') {
        comp = String(aData.invNum).localeCompare(String(bData.invNum));
      } else if (sortField === 'date') {
        comp = String(aData.invDate).localeCompare(String(bData.invDate));
      } else if (sortField === 'party') {
        comp = String(aData.party).localeCompare(String(bData.party));
      } else if (sortField === 'taxable') {
        comp = Number(aData.taxable || 0) - Number(bData.taxable || 0);
      } else if (sortField === 'tax') {
        comp = Number(aData.tax || 0) - Number(bData.tax || 0);
      } else if (sortField === 'total') {
        comp = Number(aData.total || 0) - Number(bData.total || 0);
      } else if (sortField === 'status') {
        comp = a.status.localeCompare(b.status);
      }

      return sortDir === 'asc' ? comp : -comp;
    });
  }, [filteredDocs, sortField, sortDir]);

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Summary statistics for bottom status bar
  const summaryStats = useMemo(() => {
    let sum = 0;
    let count = sortedDocs.length;
    for (const doc of sortedDocs) {
      const d = getDocData(doc);
      sum += Number(d.total || 0);
    }
    const avg = count > 0 ? sum / count : 0;
    return { count, sum, avg };
  }, [sortedDocs]);

  // Active selected document for formula bar
  const activeDoc = useMemo(() => {
    return documents.find((d) => d.id === selectedRowId) || sortedDocs[0] || null;
  }, [documents, selectedRowId, sortedDocs]);

  const activeData = activeDoc ? getDocData(activeDoc) : null;

  // Export to CSV functionality
  const handleExportCSV = () => {
    if (sortedDocs.length === 0) return;

    let headers = ['Row', 'Filename', 'Category', 'Status', 'Identifier', 'Date', 'Counterparty', 'GSTIN', 'Taxable_Subtotal', 'Tax', 'Grand_Total'];
    const rows = sortedDocs.map((doc, idx) => {
      const d = getDocData(doc);
      return [
        idx + 1,
        `"${doc.original_filename.replace(/"/g, '""')}"`,
        `"${doc.document_type}"`,
        `"${doc.status}"`,
        `"${String(d.invNum).replace(/"/g, '""')}"`,
        `"${String(d.invDate).replace(/"/g, '""')}"`,
        `"${String(d.party).replace(/"/g, '""')}"`,
        `"${String(d.gstin).replace(/"/g, '""')}"`,
        d.taxable !== null ? Number(d.taxable).toFixed(2) : '',
        d.tax !== null ? Number(d.tax).toFixed(2) : '',
        Number(d.total || 0).toFixed(2)
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ledgeragent_register_${selectedCategory || 'all'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentSheetName = selectedCategory 
    ? selectedCategory.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'All Categories';

  return (
    <div className="rounded-xl border border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col">
      {/* 1. Excel-style Ribbon / Controls Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          {/* Excel Green Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold text-[11px] shadow-sm tracking-wide">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel Register Grid</span>
          </div>

          <span className="text-slate-300">|</span>

          {/* Active Category Sheet Title */}
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-xs">
            <span className="text-emerald-700 font-mono font-bold">Sheet:</span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-medium">
              {currentSheetName}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">({sortedDocs.length} rows)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* In-Sheet Search */}
          <div className="relative w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search in sheet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>

          {/* Export to CSV Button */}
          <button
            onClick={handleExportCSV}
            title="Download this table as a CSV / Excel file"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Excel Formula Bar */}
      <div className="bg-slate-100/90 border-b border-slate-200 px-3 py-1 flex items-center gap-2 font-mono text-[11px] text-slate-600 overflow-x-auto select-none">
        <span className="text-emerald-700 font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200">fx</span>
        <span className="text-slate-400 font-medium">
          =CANONICAL_REGISTER(&quot;{selectedCategory || 'ALL'}&quot;)
        </span>
        <span className="text-slate-300">|</span>
        {activeDoc ? (
          <div className="flex items-center gap-2 text-slate-700 truncate">
            <span className="text-emerald-800 font-semibold truncate max-w-[220px]">
              [{activeDoc.original_filename}]
            </span>
            <span>•</span>
            <span className="text-slate-600 truncate max-w-[180px]">
              {activeData?.party}
            </span>
            <span>•</span>
            <span className="font-bold text-slate-900">
              Total: {formatINR(activeData?.total)}
            </span>
          </div>
        ) : (
          <span className="text-slate-400 italic">Select a row to inspect fields</span>
        )}
      </div>

      {/* 3. True Spreadsheet Grid View with Column Letters and Row Indices */}
      <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse border-spacing-0">
          {/* Column Gutter Row (Excel Column Letters) */}
          <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs select-none">
            <tr className="border-b border-slate-300 text-[10px] text-slate-500 font-mono">
              <th className="w-10 px-1 py-1 text-center bg-slate-200/90 border-r border-slate-300 font-semibold">#</th>
              <th className="px-3 py-1 bg-slate-100 border-r border-slate-300 text-center">A</th>
              <th className="px-3 py-1 bg-slate-100 border-r border-slate-300 text-center">B</th>
              <th className="px-3 py-1 bg-slate-100 border-r border-slate-300 text-center">C</th>
              <th className="px-3 py-1 bg-slate-100 border-r border-slate-300 text-center">D</th>
              <th className="px-3 py-1 bg-slate-100 border-r border-slate-300 text-center">E</th>
              <th className="px-3 py-1 bg-slate-100 border-r border-slate-300 text-center">F</th>
              <th className="px-3 py-1 bg-slate-100 border-r border-slate-300 text-center">G</th>
              <th className="px-3 py-1 bg-slate-100 text-center">H</th>
            </tr>

            {/* Field Headers Row */}
            <tr className="border-b-2 border-slate-300 bg-slate-50 text-[11px] font-bold text-slate-700">
              <th className="w-10 px-2 py-2 text-center bg-slate-200/70 border-r border-slate-300 font-mono text-slate-500">
                <Hash className="w-3 h-3 mx-auto" />
              </th>

              {/* Column A: Status & Validation */}
              <th 
                onClick={() => handleSort('status')}
                className="px-3 py-2 border-r border-slate-300 cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-between gap-1">
                  <span>Verification Status</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Column B: Identifier / Invoice # */}
              <th 
                onClick={() => handleSort('identifier')}
                className="px-3 py-2 border-r border-slate-300 cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-between gap-1">
                  <span>
                    {selectedCategory === 'receipts' 
                      ? 'Receipt No.' 
                      : selectedCategory === 'bank_statements' 
                      ? 'Account No.' 
                      : 'Invoice / Doc No.'}
                  </span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Column C: Date */}
              <th 
                onClick={() => handleSort('date')}
                className="px-3 py-2 border-r border-slate-300 cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-between gap-1">
                  <span>Date</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Column D: Party / Counterparty */}
              <th 
                onClick={() => handleSort('party')}
                className="px-3 py-2 border-r border-slate-300 cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-between gap-1">
                  <span>
                    {selectedCategory === 'invoices' || selectedCategory === 'purchase_records'
                      ? 'Vendor / Seller'
                      : selectedCategory === 'sales_records'
                      ? 'Customer Name'
                      : selectedCategory === 'receipts'
                      ? 'Merchant'
                      : selectedCategory === 'bank_statements'
                      ? 'Bank Name'
                      : 'Party / Counterparty'}
                  </span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Column E: GSTIN / Detail */}
              <th className="px-3 py-2 border-r border-slate-300 whitespace-nowrap">
                <span>
                  {selectedCategory === 'receipts' 
                    ? 'Payment Mode' 
                    : selectedCategory === 'bank_statements' 
                    ? 'Statement Period' 
                    : 'Counterparty GSTIN'}
                </span>
              </th>

              {/* Column F: Taxable / Subtotal */}
              <th 
                onClick={() => handleSort('taxable')}
                className="px-3 py-2 border-r border-slate-300 text-right cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>
                    {selectedCategory === 'bank_statements' ? 'Opening Bal' : 'Taxable Subtotal'}
                  </span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Column G: Tax Total */}
              <th 
                onClick={() => handleSort('tax')}
                className="px-3 py-2 border-r border-slate-300 text-right cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>
                    {selectedCategory === 'bank_statements' ? 'Closing Bal' : 'Tax (GST)'}
                  </span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Column H: Total Amount */}
              <th 
                onClick={() => handleSort('total')}
                className="px-3 py-2 text-right cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap bg-emerald-50/50"
              >
                <div className="flex items-center justify-end gap-1 text-emerald-900 font-extrabold">
                  <span>Grand Total</span>
                  <ArrowUpDown className="w-3 h-3 text-emerald-600" />
                </div>
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-200 bg-white">
            {sortedDocs.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400">
                  <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-600">No records found in this register</p>
                  <p className="text-xs text-slate-400 mt-1">Upload documents to populate canonical spreadsheet rows.</p>
                </td>
              </tr>
            ) : (
              sortedDocs.map((doc, index) => {
                const isSelected = selectedRowId === doc.id;
                const isNeedsReview = doc.status === 'needs_review';
                const isApproved = doc.review_status === 'approved_by_ca';
                const isDup = Boolean(doc.extracted_data?.duplicate_info?.is_duplicate);
                const { invNum, invDate, party, gstin, taxable, tax, total, raw } = getDocData(doc);

                return (
                  <tr
                    key={doc.id}
                    onClick={() => setSelectedRowId(doc.id)}
                    onDoubleClick={() => onOpenDocDrawer(doc)}
                    className={`cursor-pointer transition-colors group select-none ${
                      isSelected 
                        ? 'bg-blue-50/70 hover:bg-blue-50' 
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Left Margin: Excel Row Number Gutter */}
                    <td className={`w-10 px-1 py-1.5 text-center font-mono text-[10.5px] border-r border-b border-slate-200 select-none ${
                      isSelected 
                        ? 'bg-blue-200/80 text-blue-900 font-bold' 
                        : 'bg-slate-100/80 text-slate-500 group-hover:bg-slate-200/70'
                    }`}>
                      {index + 1}
                    </td>

                    {/* Col A: Status & Validation */}
                    <td className="px-3 py-1.5 border-r border-b border-slate-200 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {isNeedsReview ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                            <span>Urgent Variance</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Passed</span>
                          </span>
                        )}

                        {isDup && (
                          <span 
                            title={`Duplicate document detected`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                            <span>Dup</span>
                          </span>
                        )}

                        {isApproved && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                            CA
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Col B: Identifier / Invoice # */}
                    <td className="px-3 py-1.5 border-r border-b border-slate-200 font-mono text-xs text-slate-900 font-semibold max-w-[150px] truncate" title={String(invNum)}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{invNum || doc.original_filename}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDocDrawer(doc);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition-opacity"
                          title="Open document drawer"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Col C: Date */}
                    <td className="px-3 py-1.5 border-r border-b border-slate-200 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {invDate}
                    </td>

                    {/* Col D: Counterparty / Party */}
                    <td className="px-3 py-1.5 border-r border-b border-slate-200 text-xs text-slate-800 font-medium max-w-[180px] truncate" title={String(party)}>
                      {party}
                    </td>

                    {/* Col E: GSTIN or Details */}
                    <td className="px-3 py-1.5 border-r border-b border-slate-200 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {selectedCategory === 'receipts' 
                        ? (raw.payment_method || raw.expense_category || 'UPI/Card')
                        : selectedCategory === 'bank_statements'
                        ? (raw.statement_period || 'Sep 2026')
                        : gstin}
                    </td>

                    {/* Col F: Taxable Subtotal */}
                    <td className="px-3 py-1.5 border-r border-b border-slate-200 font-mono text-xs text-right text-slate-700 whitespace-nowrap">
                      {formatINR(taxable)}
                    </td>

                    {/* Col G: Tax Total */}
                    <td className="px-3 py-1.5 border-r border-b border-slate-200 font-mono text-xs text-right text-slate-700 whitespace-nowrap">
                      {formatINR(tax)}
                    </td>

                    {/* Col H: Grand Total */}
                    <td className="px-3 py-1.5 border-b border-slate-200 font-mono text-xs text-right font-extrabold text-slate-900 bg-slate-50/40 group-hover:bg-transparent whitespace-nowrap">
                      {formatINR(total)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Excel Bottom Status & Calculations Bar */}
      <div className="bg-slate-800 text-slate-200 px-3 py-1.5 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>READY</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300">
            REGISTER: <strong className="text-white">{currentSheetName.toUpperCase()}</strong>
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 text-[10px]">
            Double-click any row to open split verification viewer
          </span>
        </div>

        {/* Dynamic Aggregations */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-slate-400 uppercase text-[10px]">Count:</span>
            <span className="text-white font-bold">{summaryStats.count}</span>
          </div>
          <div className="flex items-center gap-1 pl-3 border-l border-slate-700">
            <span className="text-slate-400 uppercase text-[10px]">Average:</span>
            <span className="text-slate-200 font-semibold">{formatINR(summaryStats.avg)}</span>
          </div>
          <div className="flex items-center gap-1 pl-3 border-l border-slate-700">
            <span className="text-emerald-300 uppercase text-[10px] font-semibold">Sum:</span>
            <span className="text-emerald-400 font-bold">{formatINR(summaryStats.sum)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
