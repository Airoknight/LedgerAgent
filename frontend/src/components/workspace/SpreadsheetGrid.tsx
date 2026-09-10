'use client';

import React, { useState } from 'react';
import { 
  Table as TableIcon, 
  Search, 
  Filter, 
  Download, 
  Link as LinkIcon, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react';
import { DocumentItem } from '@/types';

interface SpreadsheetGridProps {
  document: DocumentItem;
  onOpenLinkedDoc?: (docIdOrName: string) => void;
}

export const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({
  document,
  onOpenLinkedDoc
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMatch, setFilterMatch] = useState<'all' | 'matched' | 'unmatched'>('all');

  const data = document.extracted_data || {};
  const transactions: any[] = data.transactions || [];

  const filteredTxns = transactions.filter((txn) => {
    const matchesSearch = 
      txn.narration?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      txn.ref_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(txn.debit || '').includes(searchTerm) ||
      String(txn.credit || '').includes(searchTerm);

    if (!matchesSearch) return false;

    if (filterMatch === 'matched') return txn.match_status === 'matched';
    if (filterMatch === 'unmatched') return txn.match_status !== 'matched';
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Spreadsheet Header Bar */}
      <div className="h-12 border-b border-slate-800 bg-slate-900/80 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TableIcon className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
              <span>{document.original_filename}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-mono">
                {document.document_type.toUpperCase()}
              </span>
            </h2>
            <p className="text-[10px] text-slate-400">
              Account: <span className="font-mono text-slate-200">{data.account_number || '50200098765432'}</span> • Period: {data.statement_period || 'September 2026'}
            </p>
          </div>
        </div>

        {/* Balance Metrics */}
        <div className="flex items-center gap-4 text-xs">
          <div className="text-right">
            <span className="text-[10px] text-slate-500 uppercase">Opening:</span>
            <span className="font-mono ml-1.5 text-slate-300">₹{(data.opening_balance || 0).toLocaleString()}</span>
          </div>
          <div className="text-right pl-3 border-l border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase">Closing:</span>
            <span className="font-mono ml-1.5 font-bold text-emerald-400">₹{(data.closing_balance || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Filters, Stats */}
      <div className="h-10 border-b border-slate-800/80 bg-slate-900/40 px-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search narration, ref, amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-slate-900 border border-slate-800 rounded-md text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Match Filter Tabs */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-md border border-slate-800 text-[11px]">
            <button
              onClick={() => setFilterMatch('all')}
              className={`px-2 py-0.5 rounded ${filterMatch === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              All ({transactions.length})
            </button>
            <button
              onClick={() => setFilterMatch('matched')}
              className={`px-2 py-0.5 rounded ${filterMatch === 'matched' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Matched
            </button>
            <button
              onClick={() => setFilterMatch('unmatched')}
              className={`px-2 py-0.5 rounded ${filterMatch === 'unmatched' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Unmatched
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
          <span className="font-mono">Showing {filteredTxns.length} records</span>
          <button className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors">
            <Download className="w-3 h-3" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet Table Canvas */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800 z-10 select-none">
            <tr>
              <th className="py-2.5 px-3 border-r border-slate-800 font-semibold w-28">Date</th>
              <th className="py-2.5 px-3 border-r border-slate-800 font-semibold">Transaction Narration</th>
              <th className="py-2.5 px-3 border-r border-slate-800 font-semibold w-32">Reference No</th>
              <th className="py-2.5 px-3 border-r border-slate-800 font-semibold text-right w-28">Debit (₹)</th>
              <th className="py-2.5 px-3 border-r border-slate-800 font-semibold text-right w-28">Credit (₹)</th>
              <th className="py-2.5 px-3 border-r border-slate-800 font-semibold text-right w-28">Balance (₹)</th>
              <th className="py-2.5 px-3 font-semibold text-center w-36">Reconciliation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900">
            {filteredTxns.map((txn, idx) => {
              const isMatched = txn.match_status === 'matched';
              const isPartial = txn.match_status === 'partial_match';

              return (
                <tr key={idx} className="hover:bg-slate-900/60 transition-colors group">
                  <td className="py-2 px-3 border-r border-slate-900 text-slate-400">{txn.txn_date}</td>
                  <td className="py-2 px-3 border-r border-slate-900 font-sans text-slate-200 font-medium truncate max-w-xs">
                    {txn.narration}
                  </td>
                  <td className="py-2 px-3 border-r border-slate-900 text-slate-400">{txn.ref_no || '—'}</td>
                  <td className="py-2 px-3 border-r border-slate-900 text-right text-rose-400 font-medium">
                    {txn.debit > 0 ? (
                      <span className="flex items-center justify-end gap-1">
                        <ArrowDownRight className="w-3 h-3 text-rose-500" />
                        {txn.debit.toLocaleString()}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 px-3 border-r border-slate-900 text-right text-emerald-400 font-medium">
                    {txn.credit > 0 ? (
                      <span className="flex items-center justify-end gap-1">
                        <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                        {txn.credit.toLocaleString()}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 px-3 border-r border-slate-900 text-right text-slate-300 font-semibold">
                    ₹{txn.balance.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {isMatched ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full font-sans">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Matched</span>
                        {txn.linked_doc && (
                          <button 
                            onClick={() => onOpenLinkedDoc && onOpenLinkedDoc(txn.linked_doc)}
                            className="ml-1 underline hover:text-white font-mono"
                          >
                            {txn.linked_doc}
                          </button>
                        )}
                      </span>
                    ) : isPartial ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded-full font-sans">
                        <AlertCircle className="w-3 h-3 text-amber-400" />
                        <span>Variance ₹1,000</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full font-sans">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>Unmatched</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

