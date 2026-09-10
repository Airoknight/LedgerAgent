'use client';

import React from 'react';
import { 
  BarChart3, 
  CheckCircle2, 
  AlertTriangle, 
  FileDown, 
  Layers, 
  Calendar,
  Building2,
  TrendingUp,
  FileCheck2
} from 'lucide-react';

interface ReportViewProps {
  summary: {
    period: string;
    total_documents: number;
    checks_passed: number;
    needs_review: number;
    approved_by_ca: number;
    pending_review: number;
    open_exceptions: number;
    close_readiness_score: number;
  };
  onExportTally: () => void;
}

export const ReportView: React.FC<ReportViewProps> = ({
  summary,
  onExportTally
}) => {
  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto p-8">
      {/* Report Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2.5 text-xs text-indigo-400 font-semibold uppercase tracking-wider">
            <BarChart3 className="w-4 h-4" />
            <span>Operational & Analytical Accounting Report</span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1">Period Close Readiness: {summary.period || 'September 2026'}</h1>
          <p className="text-xs text-slate-400 mt-1">
            Alpha Enterprises Pvt Ltd • Automated calculations generated from verified structured vouchers
          </p>
        </div>

        {/* TallyPrime Export Action */}
        <button
          onClick={onExportTally}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-900/30 transition-colors"
        >
          <FileDown className="w-4 h-4" />
          <span>Export Approved Vouchers to TallyPrime</span>
        </button>
      </div>

      {/* Top 4 Metric KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
          <div className="text-slate-400 text-xs font-medium">Total Ingested Files</div>
          <div className="text-2xl font-bold font-mono text-white mt-2">{summary.total_documents}</div>
          <div className="text-[11px] text-slate-500 mt-1">PDFs, CSVs, Excel, Scans</div>
        </div>

        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
          <div className="text-slate-400 text-xs font-medium">Automated Checks Passed</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">{summary.checks_passed}</div>
          <div className="text-[11px] text-emerald-500 mt-1">Math & rules verified</div>
        </div>

        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
          <div className="text-slate-400 text-xs font-medium">Flagged Exceptions</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-2">{summary.open_exceptions}</div>
          <div className="text-[11px] text-amber-500 mt-1">Needs CA review</div>
        </div>

        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
          <div className="text-slate-400 text-xs font-medium">CA Final Sign-off</div>
          <div className="text-2xl font-bold font-mono text-teal-300 mt-2">{summary.approved_by_ca}</div>
          <div className="text-[11px] text-teal-400 mt-1">Ready for posting</div>
        </div>
      </div>

      {/* Close Readiness Checklist & Reconciliation Status */}
      <div className="grid grid-cols-2 gap-6">
        {/* Readiness Checklist */}
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-indigo-400" />
            <span>Period Close Checklist</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-3">
                {summary.open_exceptions === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
                <div>
                  <div className="font-semibold text-slate-200">Zero Unresolved Discrepancies</div>
                  <div className="text-[11px] text-slate-400">All arithmetic checks and tax lines must match</div>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                summary.open_exceptions === 0 ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'
              }`}>
                {summary.open_exceptions === 0 ? 'CLEARED' : `${summary.open_exceptions} PENDING`}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="font-semibold text-slate-200">Bank Statement Reconciliation</div>
                  <div className="text-[11px] text-slate-400">Debits matched to vendor bills</div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300">
                100% RECONCILED
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-3">
                {summary.pending_review === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-blue-400" />
                )}
                <div>
                  <div className="font-semibold text-slate-200">Human CA Approval Sign-offs</div>
                  <div className="text-[11px] text-slate-400">Chartered Accountant maker-checker control</div>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                summary.pending_review === 0 ? 'bg-emerald-950 text-emerald-300' : 'bg-blue-950 text-blue-300'
              }`}>
                {summary.pending_review === 0 ? 'ALL APPROVED' : `${summary.pending_review} PENDING`}
              </span>
            </div>
          </div>
        </div>

        {/* GST & Tax Preparation Summary */}
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            <span>Tax Reconciliation Preparation (GST ITC)</span>
          </h3>

          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Eligible Input Tax Credit (ITC - CGST):</span>
              <span className="text-slate-200 font-semibold">₹5,805.00</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400 font-sans">Eligible Input Tax Credit (ITC - SGST):</span>
              <span className="text-slate-200 font-semibold">₹5,805.00</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400 font-sans">GSTR-2B Auto-Drafted Match Rate:</span>
              <span className="text-emerald-400 font-semibold">100% (All 2A/2B match)</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400 font-sans">Ineligible / Disputed ITC:</span>
              <span className="text-amber-400 font-semibold">₹0.00</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

