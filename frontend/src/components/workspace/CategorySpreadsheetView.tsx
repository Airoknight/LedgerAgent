'use client';

import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Search, 
  Download, 
  ArrowUpDown, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  Hash,
  Check,
  Clock,
  AlertCircle
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

  // Format Indian currency with exact two decimals
  const formatINR = (val: any): string => {
    if (val === undefined || val === null || val === '') return '—';
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Safe field extractor
  const getDocData = (doc: DocumentItem) => {
    const data = doc.extracted_data || {};
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

  // Formula-safe CSV export
  const handleExportCSV = () => {
    if (sortedDocs.length === 0) return;

    let headers = ['Row', 'Filename', 'Category', 'Status', 'Identifier', 'Date', 'Counterparty', 'GSTIN', 'Taxable_Subtotal', 'Tax', 'Grand_Total'];
    const rows = sortedDocs.map((doc, idx) => {
      const d = getDocData(doc);
      // Prepend ' to formula injection trigger characters
      const sanitizeCell = (val: string) => {
        let str = String(val ?? '');
        if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
          str = `'` + str;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };

      return [
        idx + 1,
        sanitizeCell(doc.original_filename),
        sanitizeCell(doc.document_type),
        sanitizeCell(doc.status),
        sanitizeCell(String(d.invNum)),
        sanitizeCell(String(d.invDate)),
        sanitizeCell(String(d.party)),
        sanitizeCell(String(d.gstin)),
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
    <div className="rounded-[8px] border border-[#D9E0E7] bg-white overflow-hidden flex flex-col shadow-xs">
      {/* 1. Ribbon Controls Bar */}
      <div className="bg-[#F8FAFC] border-b border-[#D9E0E7] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#E8F1F8] border border-[#A8C6DC] text-[#1F5D8F] font-semibold text-[11px]">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Tabular Register Grid</span>
          </div>

          <span className="text-[#D9E0E7]">|</span>

          <div className="flex items-center gap-1.5 text-[#17202A] font-medium text-xs">
            <span className="text-[#6B7280]">Register:</span>
            <span className="font-semibold px-2 py-0.5 rounded bg-white border border-[#D9E0E7] text-[#17202A]">
              {currentSheetName}
            </span>
            <span className="text-[11px] text-[#6B7280] tabular-nums">({sortedDocs.length} records)</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Field */}
          <div className="relative w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 text-[#6B7280] absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Filter current register..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 bg-white border border-[#D9E0E7] rounded-[6px] text-xs text-[#17202A] placeholder-[#9CA3AF] focus:outline-none focus:border-[#1F5D8F]"
            />
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            title="Download this table as a formula-safe CSV"
            className="flex items-center gap-1.5 px-3 py-1 rounded-[6px] bg-white hover:bg-[#F8FAFC] text-[#17202A] border border-[#D9E0E7] text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#1F5D8F]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Formula / Active Record Context Bar */}
      <div className="bg-white border-b border-[#D9E0E7] px-4 py-1.5 flex items-center gap-2 font-mono text-[11px] text-[#4B5563] overflow-x-auto select-none">
        <span className="text-[#1F5D8F] font-bold px-1.5 py-0.2 rounded bg-[#E8F1F8] border border-[#A8C6DC]">
          fx
        </span>
        <span className="text-[#6B7280]">
          =REGISTER_RECORD(&quot;{selectedCategory || 'ALL'}&quot;)
        </span>
        <span className="text-[#D9E0E7]">|</span>
        {activeDoc ? (
          <div className="flex items-center gap-2 text-[#17202A] truncate">
            <span className="font-semibold truncate max-w-[200px]">
              [{activeDoc.original_filename}]
            </span>
            <span className="text-[#9CA3AF]">•</span>
            <span className="text-[#4B5563] truncate max-w-[180px]">
              {activeData?.party}
            </span>
            <span className="text-[#9CA3AF]">•</span>
            <span className="font-semibold text-[#17202A] tabular-nums">
              Total: {formatINR(activeData?.total)}
            </span>
          </div>
        ) : (
          <span className="text-[#9CA3AF] italic">Select a row to inspect accounting evidence</span>
        )}
      </div>

      {/* 3. Financial Table */}
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse border-spacing-0">
          {/* Column Gutter & Headers */}
          <thead className="sticky top-0 z-10 bg-[#F8FAFC] select-none border-b border-[#D9E0E7]">
            <tr className="text-[11px] font-semibold text-[#4B5563]">
              <th className="w-10 px-2 py-2 text-center bg-[#EEF2F6] border-r border-[#D9E0E7] font-mono text-[#6B7280]">
                #
              </th>

              {/* Status */}
              <th 
                onClick={() => handleSort('status')}
                className="px-3 py-2 border-r border-[#D9E0E7] cursor-pointer hover:bg-[#EEF2F6] transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-between gap-1">
                  <span>Verification Status</span>
                  <ArrowUpDown className="w-3 h-3 text-[#9CA3AF]" />
                </div>
              </th>

              {/* Identifier */}
              <th 
                onClick={() => handleSort('identifier')}
                className="px-3 py-2 border-r border-[#D9E0E7] cursor-pointer hover:bg-[#EEF2F6] transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-between gap-1">
                  <span>
                    {selectedCategory === 'receipts' 
                      ? 'Receipt No.' 
                      : selectedCategory === 'bank_statements' 
                      ? 'Account No.' 
                      : 'Invoice / Doc No.'}
                  </span>
                  <ArrowUpDown className="w-3 h-3 text-[#9CA3AF]" />
                </div>
              </th>

              {/* Date */}
              <th 
                onClick={() => handleSort('date')}
                className="px-3 py-2 border-r border-[#D9E0E7] cursor-pointer hover:bg-[#EEF2F6] transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-between gap-1">
                  <span>Date</span>
                  <ArrowUpDown className="w-3 h-3 text-[#9CA3AF]" />
                </div>
              </th>

              {/* Party / Counterparty */}
              <th 
                onClick={() => handleSort('party')}
                className="px-3 py-2 border-r border-[#D9E0E7] cursor-pointer hover:bg-[#EEF2F6] transition-colors whitespace-nowrap"
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
                  <ArrowUpDown className="w-3 h-3 text-[#9CA3AF]" />
                </div>
              </th>

              {/* GSTIN / Detail */}
              <th className="px-3 py-2 border-r border-[#D9E0E7] whitespace-nowrap">
                <span>
                  {selectedCategory === 'receipts' 
                    ? 'Payment Mode' 
                    : selectedCategory === 'bank_statements' 
                    ? 'Statement Period' 
                    : 'Counterparty GSTIN'}
                </span>
              </th>

              {/* Taxable Subtotal */}
              <th 
                onClick={() => handleSort('taxable')}
                className="px-3 py-2 border-r border-[#D9E0E7] text-right cursor-pointer hover:bg-[#EEF2F6] transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>
                    {selectedCategory === 'bank_statements' ? 'Opening Bal' : 'Taxable Subtotal'}
                  </span>
                  <ArrowUpDown className="w-3 h-3 text-[#9CA3AF]" />
                </div>
              </th>

              {/* Tax */}
              <th 
                onClick={() => handleSort('tax')}
                className="px-3 py-2 border-r border-[#D9E0E7] text-right cursor-pointer hover:bg-[#EEF2F6] transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>
                    {selectedCategory === 'bank_statements' ? 'Closing Bal' : 'Tax (GST)'}
                  </span>
                  <ArrowUpDown className="w-3 h-3 text-[#9CA3AF]" />
                </div>
              </th>

              {/* Grand Total */}
              <th 
                onClick={() => handleSort('total')}
                className="px-3 py-2 text-right cursor-pointer hover:bg-[#EEF2F6] transition-colors whitespace-nowrap bg-[#F5F7FA]"
              >
                <div className="flex items-center justify-end gap-1 text-[#17202A] font-semibold">
                  <span>Grand Total</span>
                  <ArrowUpDown className="w-3 h-3 text-[#1F5D8F]" />
                </div>
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[#D9E0E7] bg-white">
            {sortedDocs.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-10 text-center text-[#6B7280]">
                  <FileSpreadsheet className="w-8 h-8 mx-auto text-[#9CA3AF] mb-2" />
                  <p className="font-semibold text-[#17202A]">No records found in this register</p>
                  <p className="text-xs text-[#6B7280] mt-1">Uploaded and validated documents will automatically appear here.</p>
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
                        ? 'bg-[#EAF1F8] border-l-2 border-[#1F5D8F]' 
                        : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {/* Gutter Index */}
                    <td className={`w-10 px-1 py-2 text-center font-mono text-[10.5px] border-r border-[#D9E0E7] select-none ${
                      isSelected 
                        ? 'bg-[#DCE5EF] text-[#17202A] font-bold' 
                        : 'bg-[#F8FAFC] text-[#6B7280] group-hover:bg-[#EEF2F6]'
                    }`}>
                      {index + 1}
                    </td>

                    {/* Status Cell */}
                    <td className="px-3 py-2 border-r border-[#D9E0E7] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {isNeedsReview ? (
                          <span className="badge-review">
                            <AlertTriangle className="w-3 h-3 text-[#9A6700]" />
                            <span>Needs Review</span>
                          </span>
                        ) : (
                          <span className="badge-passed">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#237A57]"></span>
                            <span>Checks Passed</span>
                          </span>
                        )}

                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#E8F5EE] text-[#237A57] border border-[#A8D8C1]">
                            <Check className="w-2.5 h-2.5" />
                            <span>CA Approved</span>
                          </span>
                        )}

                        {isDup && (
                          <span 
                            title="Duplicate document detected"
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#FFF5D6] text-[#9A6700] border border-[#E7CA75]"
                          >
                            <AlertCircle className="w-2.5 h-2.5 text-[#9A6700]" />
                            <span>Duplicate</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Identifier */}
                    <td className="px-3 py-2 border-r border-[#D9E0E7] font-mono text-xs text-[#17202A] font-semibold max-w-[150px] truncate" title={String(invNum)}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{invNum || doc.original_filename}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDocDrawer(doc);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#D9E0E7] rounded text-[#6B7280] hover:text-[#17202A] transition-opacity"
                          title="Open document inspection drawer"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-3 py-2 border-r border-[#D9E0E7] font-mono text-[11px] text-[#4B5563] whitespace-nowrap">
                      {invDate}
                    </td>

                    {/* Party */}
                    <td className="px-3 py-2 border-r border-[#D9E0E7] text-xs text-[#17202A] font-medium max-w-[180px] truncate" title={String(party)}>
                      {party}
                    </td>

                    {/* GSTIN / Detail */}
                    <td className="px-3 py-2 border-r border-[#D9E0E7] font-mono text-[11px] text-[#4B5563] whitespace-nowrap">
                      {selectedCategory === 'receipts' 
                        ? (raw.payment_method || raw.expense_category || 'UPI/Card')
                        : selectedCategory === 'bank_statements'
                        ? (raw.statement_period || 'Sep 2026')
                        : gstin}
                    </td>

                    {/* Taxable Subtotal */}
                    <td className="px-3 py-2 border-r border-[#D9E0E7] tabular-nums font-mono text-xs text-right text-[#4B5563] whitespace-nowrap">
                      {formatINR(taxable)}
                    </td>

                    {/* Tax Total */}
                    <td className="px-3 py-2 border-r border-[#D9E0E7] tabular-nums font-mono text-xs text-right text-[#4B5563] whitespace-nowrap">
                      {formatINR(tax)}
                    </td>

                    {/* Grand Total */}
                    <td className="px-3 py-2 tabular-nums font-mono text-xs text-right font-semibold text-[#17202A] whitespace-nowrap">
                      {formatINR(total)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Institutional Calculations Footer */}
      <div className="bg-[#172332] text-[#DCE5EF] px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[#237A57] font-bold">
            <span className="w-2 h-2 rounded-full bg-[#237A57]"></span>
            <span className="text-[#DCE5EF]">STATUS: READY</span>
          </div>
          <span className="text-[#2D425C]">|</span>
          <span className="text-[#94A3B8]">
            REGISTER: <strong className="text-white">{currentSheetName.toUpperCase()}</strong>
          </span>
          <span className="text-[#2D425C]">|</span>
          <span className="text-[#94A3B8] text-[10px]">
            Double-click row to open side-by-side verification
          </span>
        </div>

        {/* Totals Summary */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-[#94A3B8] uppercase text-[10px]">Count:</span>
            <span className="text-white font-bold tabular-nums">{summaryStats.count}</span>
          </div>
          <div className="flex items-center gap-1 pl-3 border-l border-[#2D425C]">
            <span className="text-[#94A3B8] uppercase text-[10px]">Average:</span>
            <span className="text-[#DCE5EF] font-semibold tabular-nums">{formatINR(summaryStats.avg)}</span>
          </div>
          <div className="flex items-center gap-1 pl-3 border-l border-[#2D425C]">
            <span className="text-[#A8C6DC] uppercase text-[10px] font-semibold">Total Sum:</span>
            <span className="text-white font-bold tabular-nums">{formatINR(summaryStats.sum)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
